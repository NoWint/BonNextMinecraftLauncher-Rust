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

const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>();
  private eventBus = new EventBus();

  // UI injection collections (mutable source)
  private sidebarItems: SidebarItem[] = [];
  private settingsSections: SettingsSection[] = [];
  private routes: PluginRoute[] = [];
  private contextMenuItems: ContextMenuItem[] = [];
  private instanceTabs: InstanceTab[] = [];
  private themes: ThemeContribution[] = [];

  // Cached snapshots (stable references for useSyncExternalStore)
  private sidebarSnapshot: SidebarItem[] = [];
  private settingsSnapshot: SettingsSection[] = [];
  private routesSnapshot: PluginRoute[] = [];
  private contextMenuSnapshot: ContextMenuItem[] = [];
  private instanceTabsSnapshot: InstanceTab[] = [];
  private themesSnapshot: ThemeContribution[] = [];
  private pluginsSnapshot: RegisteredPlugin[] = [];

  // Subscription listeners (for reactive UI updates)
  private listeners = new Set<() => void>();

  private notify(): void {
    // Recompute cached snapshots before notifying listeners
    this.sidebarSnapshot = [...this.sidebarItems].sort((a, b) => a.order - b.order);
    this.settingsSnapshot = [...this.settingsSections].sort((a, b) => a.order - b.order);
    this.routesSnapshot = [...this.routes];
    this.contextMenuSnapshot = [...this.contextMenuItems];
    this.instanceTabsSnapshot = [...this.instanceTabs].sort((a, b) => a.order - b.order);
    this.themesSnapshot = [...this.themes];
    this.pluginsSnapshot = [...this.plugins.values()];

    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('[PluginManager] Listener error:', e);
      }
    });
  }

  /** Subscribe to injection changes. Returns unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  register(definition: PluginDefinition, manifest?: PluginManifest): void {
    if (this.plugins.has(definition.id)) {
      return; // Idempotent
    }
    this.plugins.set(definition.id, {
      definition,
      manifest,
      state: 'registered',
    });
    this.notify();
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    if (plugin.state === 'active') {
      return;
    }

    // Validate manifest requirements (minAppVersion + dependencies) before activating.
    const validationError = this.validateManifest(plugin.manifest);
    if (validationError) {
      plugin.error = validationError;
      this.setState(pluginId, 'error');
      this.notify();
      console.error(`[PluginManager] Plugin "${pluginId}" failed manifest validation: ${validationError}`);
      return;
    }

    this.setState(pluginId, 'activating');
    this.notify();

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
      this.notify();
    } catch (e) {
      plugin.error = e instanceof Error ? e.message : String(e);
      this.setState(pluginId, 'error');
      this.notify();
      console.error(`[PluginManager] Failed to activate plugin "${pluginId}":`, e);
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.state !== 'active') {
      return;
    }

    this.setState(pluginId, 'deactivating');
    this.notify();

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
    this.notify();
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

  /** Unregister a plugin completely (deactivate + remove from registry). */
  async unregister(pluginId: string): Promise<void> {
    await this.deactivate(pluginId);
    this.plugins.delete(pluginId);
    this.notify();
  }

  getPlugin(id: string): RegisteredPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): RegisteredPlugin[] {
    return this.pluginsSnapshot;
  }

  getSidebarItems(): SidebarItem[] {
    return this.sidebarSnapshot;
  }

  getSettingsSections(): SettingsSection[] {
    return this.settingsSnapshot;
  }

  getRoutes(): PluginRoute[] {
    return this.routesSnapshot;
  }

  getContextMenuItems(): ContextMenuItem[] {
    return this.contextMenuSnapshot;
  }

  getInstanceTabs(): InstanceTab[] {
    return this.instanceTabsSnapshot;
  }

  getThemes(): ThemeContribution[] {
    return this.themesSnapshot;
  }

  getEventBus(): PluginEventBus {
    return this.eventBus;
  }

  /**
   * 向所有已注册监听器广播一个插件事件。
   * 核心代码（启动器、下载器、认证等）通过此方法把事件转发给插件 EventBus。
   */
  emitEvent(event: string, data: unknown): void {
    this.eventBus.emit(event, data);
  }

  private setState(pluginId: string, state: PluginState): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.state = state;
    }
  }

  /**
   * Validate that a plugin's manifest requirements are met.
   * Returns an error message string if validation fails, or null if OK.
   */
  private validateManifest(manifest: PluginManifest | undefined): string | null {
    if (!manifest) return null; // No manifest = no constraints

    // Check minAppVersion
    if (manifest.minAppVersion) {
      const appVersion = this.getAppVersion();
      if (!this.isVersionSatisfied(appVersion, manifest.minAppVersion)) {
        return `Plugin requires app version >= ${manifest.minAppVersion}, but current version is ${appVersion}`;
      }
    }

    // Check dependencies
    if (manifest.dependencies && manifest.dependencies.length > 0) {
      const missing: string[] = [];
      const inactive: string[] = [];
      for (const depId of manifest.dependencies) {
        const dep = this.plugins.get(depId);
        if (!dep) {
          missing.push(depId);
        } else if (dep.state !== 'active') {
          inactive.push(depId);
        }
      }
      if (missing.length > 0) {
        return `Missing dependencies: ${missing.join(', ')}`;
      }
      if (inactive.length > 0) {
        return `Dependencies not active: ${inactive.join(', ')}. Please activate them first.`;
      }
    }

    return null;
  }

  private getAppVersion(): string {
    // Try to get from import.meta.env or a constant
    // Fallback to '1.0.0' if not available
    return (import.meta.env.VITE_APP_VERSION as string) || '1.0.0';
  }

  private isVersionSatisfied(current: string, required: string): boolean {
    // Simple semver comparison: split by '.', compare numeric parts
    const cur = current.split('.').map((n) => parseInt(n, 10) || 0);
    const req = required.split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(cur.length, req.length);
    for (let i = 0; i < len; i++) {
      const c = cur[i] || 0;
      const r = req[i] || 0;
      if (c > r) return true;
      if (c < r) return false;
    }
    return true; // equal
  }
}

// Ensure EMPTY_ARRAY is referenced to avoid unused warning (kept for future use)
void EMPTY_ARRAY;
