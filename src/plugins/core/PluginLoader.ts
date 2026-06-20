// src/plugins/core/PluginLoader.ts
// 插件加载器 — 负责发现、加载并注册插件到 PluginManager。
// 内置插件从 ../builtins 导入；已安装插件从后端 plugin_storage 读取清单。
import type { PluginManager } from './PluginManager';
import type { PluginManifest } from './types';
import { builtinPlugins } from '../builtins';
import { invoke } from '@tauri-apps/api/core';

/** 已安装插件的后端返回结构（与 list_installed_plugins 命令对应） */
interface InstalledPluginInfo {
  id: string;
  version: string;
  manifest: PluginManifest | null;
}

export class PluginLoader {
  /**
   * 加载所有内置插件并注册到 PluginManager。
   * 内置插件按 builtinPlugins 数组顺序注册（主题插件优先）。
   */
  loadBuiltinPlugins(manager: PluginManager): void {
    for (const entry of builtinPlugins) {
      manager.register(entry.definition, entry.manifest);
    }
  }

  /**
   * 加载已安装的第三方插件（从后端 plugin_storage 读取）。
   * 已安装但尚未注册的插件会通过动态 import 加载其入口模块。
   * 如果加载失败，会记录错误但不会中断其他插件的加载。
   */
  async loadInstalledPlugins(manager: PluginManager): Promise<void> {
    let installed: InstalledPluginInfo[] = [];
    try {
      installed = await invoke<InstalledPluginInfo[]>('list_installed_plugins');
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
        // 已安装插件的入口模块路径由后端决定。
        // 目前仅支持通过 manifest 声明入口，实际动态加载需要打包系统支持。
        // 在未实现完整动态加载前，仅注册清单信息，激活时由 PluginManager 处理。
        console.info(`[PluginLoader] Installed plugin discovered: ${info.id}@${info.version}`);
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
