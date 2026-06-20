// src/plugins/core/index.ts
export { definePlugin } from './definePlugin';
export { PluginManager } from './PluginManager';
export { PluginLoader, pluginLoader } from './PluginLoader';
export { EventBus } from './EventBus';
export { PermissionValidator } from './PermissionValidator';
export { createPluginContext } from './PluginContext';
export { createPluginLogger } from './PluginLogger';
export { createPluginStorage } from './PluginStorage';
export { createPluginHttpClient } from './PluginHttpClient';
export { createPluginFileSystem } from './PluginFileSystem';
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
