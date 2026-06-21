// src/plugins/core/PluginLoader.ts
// 插件加载器 — 负责发现、加载并注册插件到 PluginManager。
// 内置插件从 ../builtins 导入；已安装插件从后端 plugin_storage 读取清单，
// 并通过 convertFileSrc + 动态 import() 加载插件入口 JS。
import type { PluginManager } from './PluginManager';
import { readEnabledBuiltinPlugins } from './PluginManager';
import type { PluginDefinition, PluginManifest } from './types';
import { builtinPlugins } from '../builtins';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { createSandboxedPluginDefinition } from './SandboxLoader';

/**
 * 已安装插件的后端返回结构（与 list_installed_plugins 命令对应）。
 * 字段必须与 src-tauri/src/commands/plugin_proxy.rs 中的 InstalledPluginInfo struct 一致。
 */
interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  permissions: string[];
  directory: string;
  contributes: unknown | null;
  entry: string | null;
  /** 是否在 iframe 沙箱中运行（后端 list_installed_plugins 返回） */
  sandbox?: boolean;
}

/**
 * 通过 convertFileSrc + 动态 import() 加载插件入口 JS 模块。
 *
 * 流程：
 * 1. 拼接插件目录 + entry（默认 index.js）得到磁盘绝对路径
 * 2. convertFileSrc 把磁盘路径转成 asset:// URL（受 tauri.conf.json assetProtocol.scope 控制）
 * 3. 用 @vite-ignore 的动态 import() 在运行时加载该 URL
 * 4. 取 module.default（或 module 本身）作为 PluginDefinition
 *
 * @vite-ignore 让 Vite 跳过静态分析，保留运行时 import()，否则 Vite 会尝试在构建期解析模块。
 */
async function loadPluginEntry(info: InstalledPluginInfo): Promise<PluginDefinition | null> {
  const entry = info.entry ?? 'index.js';
  const filePath = `${info.directory}/${entry}`;
  const url = convertFileSrc(filePath);

  try {
    // @vite-ignore 让 Vite 跳过静态分析，保留运行时 import()
    const module = await import(/* @vite-ignore */ url);
    const definition = module.default ?? module;
    if (!definition || typeof definition.activate !== 'function') {
      console.error(`[PluginLoader] Plugin "${info.id}" entry has no valid default export`);
      return null;
    }
    return definition;
  } catch (e) {
    console.error(`[PluginLoader] Failed to load plugin entry "${info.id}":`, e);
    return null;
  }
}

/** 根据后端返回的已安装插件信息，构造 PluginManifest（用于权限/贡献信息记录） */
function createManifestFromInstalled(info: InstalledPluginInfo): PluginManifest {
  // 从 contributes 同级的 sandbox 字段读取（后端 InstalledPluginInfo 需要返回此字段）
  // 当前后端返回的 manifest 是 serde_json::Value，sandbox 字段在顶层
  // 这里从 info 的扩展字段读取（见下方 loadInstalledPlugins 中的解析）
  return {
    id: info.id,
    name: info.name,
    version: info.version,
    description: info.description ?? undefined,
    author: info.author ?? undefined,
    permissions: info.permissions,
    contributes: info.contributes as PluginManifest['contributes'] | undefined,
  };
}

export class PluginLoader {
  /**
   * 加载所有内置插件并注册到 PluginManager。
   * 内置插件按 builtinPlugins 数组顺序注册（主题插件优先）。
   *
   * 对于 enabledByDefault: false 的内置插件：
   * - 检查 localStorage 中用户是否手动启用过
   * - 若已启用：按默认启用注册（enabledByDefault=true），会被 activateAll 自动激活
   * - 若未启用：注册为 defaultDisabled，activateAll 跳过，需用户在设置页手动激活
   */
  loadBuiltinPlugins(manager: PluginManager): void {
    const userEnabled = readEnabledBuiltinPlugins();
    for (const entry of builtinPlugins) {
      const enabledByDefault =
        entry.enabledByDefault === false ? userEnabled.has(entry.definition.id) : true;
      manager.register(entry.definition, entry.manifest, enabledByDefault);
    }
  }

  /**
   * 加载已安装的第三方插件（从后端 list_installed_plugins 命令读取）。
   *
   * 对每个已安装插件：
   * 1. 通过 loadPluginEntry 动态 import() 加载入口 JS 模块
   * 2. 若入口加载成功，注册真实 PluginDefinition
   * 3. 若入口加载失败，注册一个 activate 会抛错的占位定义，使插件仍出现在管理 UI 中
   *    （manifest 中的权限/贡献信息仍会被记录到 RegisteredPlugin）
   */
  async loadInstalledPlugins(manager: PluginManager): Promise<void> {
    let installed: InstalledPluginInfo[] = [];
    try {
      const result = await invoke<InstalledPluginInfo[]>('list_installed_plugins');
      // 防御性检查：后端可能返回 null（命令未注册或序列化异常）
      installed = Array.isArray(result) ? result : [];
    } catch (e) {
      // 后端命令可能不可用（feature flag 未启用）或无已安装插件
      console.debug('[PluginLoader] No installed plugins or command unavailable:', e);
      return;
    }

    for (const info of installed) {
      // 跳过已注册的插件（避免与内置插件冲突）
      if (manager.getPlugin(info.id)) {
        continue;
      }

      try {
        const manifest = createManifestFromInstalled(info);

        // 读取 sandbox 标记：后端 InstalledPluginInfo 的 contributes 是完整 manifest 的 contributes 字段，
        // sandbox 标记在 manifest 顶层。我们需要从后端获取完整 manifest 来判断。
        // 当前 info 结构中没有 sandbox 字段，先尝试从 contributes 同级读取（后端需扩展）。
        // 临时方案：检查 info 是否有 sandbox 字段（通过 as any 访问，后端扩展后自然生效）
        const isSandboxed = (info as { sandbox?: boolean }).sandbox === true;

        if (isSandboxed) {
          // sandbox 插件：用 SandboxLoader 包装
          const entry = info.entry ?? 'index.js';
          const entryPath = `${info.directory}/${entry}`;
          const definition = createSandboxedPluginDefinition(info.id, entryPath, manifest);
          manager.register(definition, manifest);
          console.info(`[PluginLoader] Sandbox plugin loaded: ${info.id}@${info.version}`);
        } else {
          // 普通插件：直接动态 import
          const definition = await loadPluginEntry(info);
          if (!definition) {
            manager.register(
              {
                id: info.id,
                name: info.name,
                version: info.version,
                description: info.description ?? undefined,
                activate() {
                  throw new Error('Plugin entry failed to load');
                },
              },
              manifest,
            );
            continue;
          }
          manager.register(definition, manifest);
          console.info(`[PluginLoader] Installed plugin loaded: ${info.id}@${info.version}`);
        }
      } catch (e) {
        console.error(`[PluginLoader] Failed to load installed plugin "${info.id}":`, e);
      }
    }
  }

  /**
   * 加载所有插件（内置 + 已安装）并激活。
   * 这是 PluginProvider 初始化时调用的主入口。
   */
  async loadAndActivateAll(manager: PluginManager): Promise<void> {
    // 1. 注册内置插件
    this.loadBuiltinPlugins(manager);

    // 2. 发现已安装的第三方插件
    await this.loadInstalledPlugins(manager);

    // 3. 激活所有已注册插件
    await manager.activateAll();
  }
}

/** 单例实例，供 PluginProvider 使用 */
export const pluginLoader = new PluginLoader();
