// src/plugins/core/SandboxLoader.ts
import type { PluginDefinition, PluginManifest } from './types';
import type { PluginContext } from './types';
import { SandboxHost } from './SandboxHost';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * 把一个 sandbox 插件包装成 PluginDefinition。
 *
 * 流程：
 * 1. activate(ctx) 时：通过 convertFileSrc 获取插件入口 URL
 * 2. fetch() 下载入口 JS 源码（text）
 * 3. 创建 SandboxHost(pluginId, source, permissions)
 * 4. host.activate(ctx) — 创建 iframe，加载源码，调用插件 activate
 * 5. 保存 host 引用，deactivate() 时调用 host.deactivate()
 *
 * 注意：sandbox 插件的 activate 是异步的（需要 fetch 源码 + iframe 通信）。
 */
export function createSandboxedPluginDefinition(
  pluginId: string,
  entryPath: string, // 磁盘绝对路径（info.directory + '/' + entry）
  manifest: PluginManifest | undefined,
): PluginDefinition {
  let host: SandboxHost | null = null;

  return {
    id: pluginId,
    name: manifest?.name ?? pluginId,
    version: manifest?.version ?? '0.0.0',
    description: manifest?.description,
    async activate(ctx: PluginContext) {
      // 1. 获取插件入口 URL
      const assetUrl = convertFileSrc(entryPath);

      // 2. 下载插件源码
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sandbox plugin entry: ${response.status} ${response.statusText}`);
      }
      const pluginSource = await response.text();

      // 3. 创建并激活 SandboxHost
      const permissions = manifest?.permissions ?? [];
      host = new SandboxHost(pluginId, pluginSource, permissions);
      await host.activate(ctx);
    },
    async deactivate() {
      if (host) {
        await host.deactivate();
        host = null;
      }
    },
  };
}
