// src/plugins/core/PluginManager.ts
import type {
  PluginDefinition,
  PluginManifest,
  RegisteredPlugin,
  PluginState,
  SidebarItem,
  SettingsSection,
  PluginRoute,
  ContextMenuItem,
  InstanceTab,
  ThemeContribution,
  PluginEventBus,
} from './types';
import { EventBus } from './EventBus';
import { PermissionValidator } from './PermissionValidator';
import { createPluginContext } from './PluginContext';
import { createPluginLogger } from './PluginLogger';
import { createPluginStorage } from './PluginStorage';
import { createPluginHttpClient } from './PluginHttpClient';
import { createPluginFileSystem } from './PluginFileSystem';

export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>();
  private eventBus = new EventBus();

  // UI injection collections
  private sidebarItems: SidebarItem[] = [];
  private settingsSections: SettingsSection[] = [];
  private routes: PluginRoute[] = [];
  private contextMenuItems: ContextMenuItem[] = [];
  private instanceTabs: InstanceTab[] = [];
  private themes: ThemeContribution[] = [];

  register(definition: PluginDefinition, manifest?: PluginManifest): void {
    if (this.plugins.has(definition.id)) {
      return; // Idempotent
    }
    this.plugins.set(definition.id, {
      definition,
      manifest,
      state: 'registered',
    });
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    if (plugin.state === 'active') {
      return;
    }

    this.setState(pluginId, 'activating');

    try {
      const permissions = new PermissionValidator(plugin.manifest?.permissions ?? ['invoke:core']);
      const logger = createPluginLogger(pluginId);
      const storage = createPluginStorage(pluginId);
      const http = createPluginHttpClient(permissions, logger);
      const fs = createPluginFileSystem(permissions, logger);

      const ctx = createPluginContext(
        pluginId,
        permissions,
        {
          onRegisterRoute: (r) => this.routes.push(r),
          onAddSidebarItem: (i) => this.sidebarItems.push(i),
          onAddSettingsSection: (s) => this.settingsSections.push(s),
          onAddContextMenuItem: (i) => this.contextMenuItems.push(i),
          onAddInstanceTab: (t) => this.instanceTabs.push(t),
          onRegisterTheme: (t) => this.themes.push(t),
        },
        http,
        fs,
        this.eventBus,
        storage,
        logger,
      );

      plugin.context = ctx;
      await plugin.definition.activate(ctx);
      this.setState(pluginId, 'active');
    } catch (e) {
      plugin.error = e instanceof Error ? e.message : String(e);
      this.setState(pluginId, 'error');
      console.error(`[PluginManager] Failed to activate plugin "${pluginId}":`, e);
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.state !== 'active') {
      return;
    }

    this.setState(pluginId, 'deactivating');

    try {
      if (plugin.definition.deactivate) {
        await plugin.definition.deactivate();
      }
    } catch (e) {
      console.error(`[PluginManager] Error during deactivation of "${pluginId}":`, e);
    }

    // Remove all UI injections from this plugin
    this.sidebarItems = this.sidebarItems.filter((i) => i.pluginId !== pluginId);
    this.settingsSections = this.settingsSections.filter((s) => s.pluginId !== pluginId);
    this.routes = this.routes.filter((r) => r.pluginId !== pluginId);
    this.contextMenuItems = this.contextMenuItems.filter((i) => i.pluginId !== pluginId);
    this.instanceTabs = this.instanceTabs.filter((t) => t.pluginId !== pluginId);
    this.themes = this.themes.filter((t) => t.pluginId !== pluginId);

    plugin.context = undefined;
    this.setState(pluginId, 'inactive');
  }

  async activateAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.state === 'registered' || plugin.state === 'inactive') {
        await this.activate(plugin.definition.id);
      }
    }
  }

  async deactivateAll(): Promise<void> {
    for (const plugin of [...this.plugins.values()].reverse()) {
      if (plugin.state === 'active') {
        await this.deactivate(plugin.definition.id);
      }
    }
  }

  getPlugin(id: string): RegisteredPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): RegisteredPlugin[] {
    return [...this.plugins.values()];
  }

  getSidebarItems(): SidebarItem[] {
    return [...this.sidebarItems].sort((a, b) => a.order - b.order);
  }

  getSettingsSections(): SettingsSection[] {
    return [...this.settingsSections].sort((a, b) => a.order - b.order);
  }

  getRoutes(): PluginRoute[] {
    return [...this.routes];
  }

  getContextMenuItems(): ContextMenuItem[] {
    return [...this.contextMenuItems];
  }

  getInstanceTabs(): InstanceTab[] {
    return [...this.instanceTabs].sort((a, b) => a.order - b.order);
  }

  getThemes(): ThemeContribution[] {
    return [...this.themes];
  }

  getEventBus(): PluginEventBus {
    return this.eventBus;
  }

  private setState(pluginId: string, state: PluginState): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.state = state;
    }
  }
}
