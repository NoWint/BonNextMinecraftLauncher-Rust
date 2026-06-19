// src/plugins/core/PluginContext.ts
import type {
  PluginContext,
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
import type { PermissionValidator } from './PermissionValidator';
import { invoke } from '@tauri-apps/api/core';

export interface PluginContextCallbacks {
  onRegisterRoute: (route: PluginRoute) => void;
  onAddSidebarItem: (item: SidebarItem) => void;
  onAddSettingsSection: (section: SettingsSection) => void;
  onAddContextMenuItem: (item: ContextMenuItem) => void;
  onAddInstanceTab: (tab: InstanceTab) => void;
  onRegisterTheme: (theme: ThemeContribution) => void;
}

export function createPluginContext(
  pluginId: string,
  permissions: PermissionValidator,
  callbacks: PluginContextCallbacks,
  http: PluginHttpClient,
  fs: PluginFileSystem,
  events: PluginEventBus,
  storage: PluginStorage,
  logger: PluginLogger,
): PluginContext {
  return {
    pluginId,

    registerRoute(path, lazyComponent) {
      callbacks.onRegisterRoute({ path, component: lazyComponent, pluginId });
    },

    addSidebarItem(item) {
      callbacks.onAddSidebarItem({ ...item, pluginId });
    },

    addSettingsSection(section) {
      callbacks.onAddSettingsSection({ ...section, pluginId });
    },

    addContextMenuItem(item) {
      callbacks.onAddContextMenuItem({ ...item, pluginId });
    },

    addInstanceTab(tab) {
      callbacks.onAddInstanceTab({ ...tab, pluginId });
    },

    registerTheme(theme) {
      callbacks.onRegisterTheme({ ...theme, pluginId });
    },

    async invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
      if (!permissions.canInvoke(command)) {
        logger.warn(`Invoke denied (no permission): ${command}`);
        throw new Error(`Permission denied: cannot invoke ${command}`);
      }
      return invoke<T>(command, args);
    },

    http,
    fs,
    events,
    storage,
    logger,
  };
}
