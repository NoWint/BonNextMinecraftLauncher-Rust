// src/plugin-sdk/index.ts
// BonNext 插件开发 SDK 入口
// 第三方插件通过 `import { definePlugin } from '@bonnext/plugin-sdk'` 使用

export { definePlugin } from '../plugins/core/definePlugin';
export type {
  PluginDefinition,
  PluginManifest,
  PluginContext,
  PluginState,
  RegisteredPlugin,
  SidebarItem,
  SettingsSection,
  PluginRoute,
  ContextMenuItem,
  InstanceTab,
  ThemeContribution,
  PluginHttpClient,
  PluginFileSystem,
  PluginEventBus,
  PluginStorage,
  PluginLogger,
} from './types';
