// src/plugin-sdk/types.ts
// 插件开发 SDK 类型定义（发布为 npm 包 @bonnext/plugin-sdk）
// 重新导出核心插件系统类型，供第三方插件开发使用

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
} from '../plugins/core/types';
