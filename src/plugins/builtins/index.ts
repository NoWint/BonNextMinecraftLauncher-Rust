// src/plugins/builtins/index.ts
// 内置插件注册表
// 所有内置插件在此统一导出，由 PluginProvider 注册并激活。
import type { PluginDefinition, PluginManifest } from '../core/types';
import { marketplacePlugin, manifest as marketplaceManifest } from './marketplace';
import { serversPlugin, manifest as serversManifest } from './servers';
import { socialPlugin, manifest as socialManifest } from './social';
import { aiPlugin, manifest as aiManifest } from './ai';
import { securityPlugin, manifest as securityManifest } from './security';
import { modToolsPlugin, manifest as modToolsManifest } from './mod-tools';
import { systemToolsPlugin, manifest as systemToolsManifest } from './system-tools';
import { swiftUIShellPlugin, manifest as swiftUIShellManifest } from './shell-swiftui';
import { shellEditorPlugin, manifest as shellEditorManifest } from './shell-editor';
import { zzzThemePlugin, manifest as zzzThemeManifest } from './zzz-theme';
import { sceneMenuPlugin, manifest as sceneMenuManifest } from './scene-menu';

export interface BuiltinPluginEntry {
  definition: PluginDefinition;
  manifest?: PluginManifest;
}

/**
 * 所有内置插件清单。
 * 内置插件默认启用，通过 PluginProvider 注册到 PluginManager。
 */
export const builtinPlugins: BuiltinPluginEntry[] = [
  // 主题插件（最先激活，确保主题可用）
  { definition: zzzThemePlugin, manifest: zzzThemeManifest as PluginManifest },
  // 功能插件
  { definition: marketplacePlugin, manifest: marketplaceManifest as PluginManifest },
  { definition: serversPlugin, manifest: serversManifest as PluginManifest },
  { definition: socialPlugin, manifest: socialManifest as PluginManifest },
  { definition: aiPlugin, manifest: aiManifest as PluginManifest },
  { definition: securityPlugin, manifest: securityManifest as PluginManifest },
  { definition: modToolsPlugin, manifest: modToolsManifest as PluginManifest },
  { definition: systemToolsPlugin, manifest: systemToolsManifest as PluginManifest },
  // Shell 插件（备选 Shell）
  { definition: swiftUIShellPlugin, manifest: swiftUIShellManifest as PluginManifest },
  { definition: shellEditorPlugin, manifest: shellEditorManifest as PluginManifest },
  // 3D 场景主菜单（覆盖首页，可逆）
  { definition: sceneMenuPlugin, manifest: sceneMenuManifest as PluginManifest },
];

