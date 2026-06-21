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
} from './types';
import { EventBus } from './EventBus';
import { PermissionValidator } from './PermissionValidator';
import { createPluginContext } from './PluginContext';
import { createPluginLogger } from './PluginLogger';
import { createPluginStorage } from './PluginStorage';
import { createPluginHttpClient } from './PluginHttpClient';
import { createPluginFileSystem } from './PluginFileSystem';
import { ServiceRegistry } from './ServiceRegistry';
import { ExtensionPointRegistry, CORE_EXTENSION_POINTS } from './ExtensionPoint';
import { SideEffectTracker } from './SideEffectTracker';
import { getVersion } from '@tauri-apps/api/app';
import { PluginSession } from './PluginSession';
import { applyDeclarativeContributions } from './DeclarativeContributions';
import type { LifecycleHookName, HookResult } from './LifecycleHooks';
import semver from 'semver';
import { registerPluginI18n, unregisterPluginI18n } from '../../shared/i18n';

/** localStorage key：记录用户手动启用的默认禁用内置插件 ID 列表 */
const ENABLED_BUILTIN_PLUGINS_KEY = 'bonnext:enabled-builtin-plugins';

/** 读取用户手动启用的默认禁用内置插件列表 */
export function readEnabledBuiltinPlugins(): Set<string> {
  try {
    const raw = localStorage.getItem(ENABLED_BUILTIN_PLUGINS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

/** 持久化用户对某个默认禁用内置插件的启用/禁用选择 */
function persistBuiltinEnabledState(pluginId: string, enabled: boolean): void {
  try {
    const set = readEnabledBuiltinPlugins();
    if (enabled) {
      set.add(pluginId);
    } else {
      set.delete(pluginId);
    }
    localStorage.setItem(ENABLED_BUILTIN_PLUGINS_KEY, JSON.stringify([...set]));
  } catch (e) {
    console.warn('[PluginManager] Failed to persist builtin plugin enabled state:', e);
  }
}

export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>();
  private eventBus = new EventBus();
  // Plugin session tokens (for backend auth on plugin_* commands).
  private sessions = new Map<string, PluginSession>();
  // Plugin-to-plugin service registry (provide/consume/requestService).
  private serviceRegistry = new ServiceRegistry();
  // Extension point registry (declarative contributions via ctx.contribute).
  private extensionPointRegistry = new ExtensionPointRegistry();
  /** Per-plugin side effect trackers (pluginId → tracker) */
  private sideEffectTrackers = new Map<string, SideEffectTracker>();

  constructor() {
    // 声明核心扩展点
    for (const ep of CORE_EXTENSION_POINTS) {
      this.extensionPointRegistry.declare(ep);
    }
  }

  // Cached app version (resolved asynchronously from Tauri / env / fallback)
  private appVersion: string = '1.0.0';
  private appVersionInitialized: boolean = false;

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

  register(definition: PluginDefinition, manifest?: PluginManifest, enabledByDefault = true): void {
    if (this.plugins.has(definition.id)) {
      return; // Idempotent
    }
    this.plugins.set(definition.id, {
      definition,
      manifest,
      state: 'registered',
      defaultDisabled: !enabledByDefault,
    });
    this.notify();
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    if (plugin.autoDisabled) {
      throw new Error(
        `Plugin "${pluginId}" is auto-disabled after repeated failures. Reset it before activating.`,
      );
    }
    if (plugin.state === 'active') {
      return;
    }

    // Ensure app version is resolved before manifest validation (minAppVersion check).
    await this.initAppVersion();

    // Validate manifest requirements (minAppVersion + dependencies) before activating.
    const validationError = this.validateManifest(plugin.manifest);
    if (validationError) {
      plugin.error = validationError;
      this.setState(pluginId, 'error');
      this.notify();
      console.error(`[PluginManager] Plugin "${pluginId}" failed manifest validation: ${validationError}`);
      throw new Error(validationError);
    }

    this.setState(pluginId, 'activating');
    this.notify();

    // Declared outside try so the catch block can revoke it on failure.
    const session = new PluginSession(pluginId, plugin.manifest?.permissions ?? []);

    try {
      // Default to minimal permissions if manifest is missing — no broad core access.
      const permissions = new PermissionValidator(plugin.manifest?.permissions ?? []);
      const logger = createPluginLogger(pluginId);
      await session.register();
      const storage = createPluginStorage(session);
      const http = createPluginHttpClient(permissions, logger, session);
      const fs = createPluginFileSystem(permissions, logger, session);

      const sideEffectTracker = new SideEffectTracker();
      this.sideEffectTrackers.set(pluginId, sideEffectTracker);

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
        this.serviceRegistry,
        this.extensionPointRegistry,
        sideEffectTracker,
      );

      plugin.context = ctx;
      // 注册插件 i18n 资源到全局 i18n（在声明式贡献之前，确保 sidebar label 解析时资源已就绪）
      if (plugin.manifest?.i18n) {
        registerPluginI18n(pluginId, plugin.manifest.i18n);
      }
      applyDeclarativeContributions(plugin.manifest, ctx);
      await plugin.definition.activate(ctx);
      this.sessions.set(pluginId, session);
      // 激活成功，重置失败计数
      plugin.failureCount = 0;
      plugin.lastError = undefined;
      plugin.autoDisabled = false;
      // 用户手动激活默认禁用的内置插件后，清除标记并持久化到 localStorage，
      // 下次启动时 loadBuiltinPlugins 会读取 localStorage 决定是否注册为可自动激活。
      if (plugin.defaultDisabled) {
        plugin.defaultDisabled = false;
        persistBuiltinEnabledState(pluginId, true);
      }
      this.setState(pluginId, 'active');
      this.notify();
    } catch (e) {
      // Session was created but activation failed — revoke it before cleanup.
      await session.revoke().catch(() => {});
      // 注销可能已注册的 i18n 资源（在 applyDeclarativeContributions 之后失败的情况）
      unregisterPluginI18n(pluginId);
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      plugin.error = errorMessage;
      plugin.failureCount = (plugin.failureCount ?? 0) + 1;
      plugin.lastError = {
        message: errorMessage,
        stack: errorStack,
        timestamp: Date.now(),
      };
      // 3 次失败后自动禁用，避免反复崩溃拖累启动
      if (plugin.failureCount >= 3) {
        plugin.autoDisabled = true;
        console.warn(
          `[PluginManager] Plugin "${pluginId}" auto-disabled after ${plugin.failureCount} failures`,
        );
      }
      // Clean up any UI injections that were registered before the failure.
      this.removePluginInjections(pluginId);
      this.setState(pluginId, 'error');
      this.notify();
      console.error(`[PluginManager] Failed to activate plugin "${pluginId}":`, e);
      throw e;
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }
    // Allow deactivation from both 'active' and 'error' states.
    // 'error' state plugins may have partial UI injections that need cleanup.
    if (plugin.state !== 'active' && plugin.state !== 'error') {
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

    // Unregister all services provided by this plugin.
    this.serviceRegistry.unregisterByPlugin(pluginId);
    // Remove all extension point contributions from this plugin.
    this.extensionPointRegistry.removeByPlugin(pluginId);

    // Clean up all tracked side effects (timers, listeners, DOM nodes, subscriptions).
    const tracker = this.sideEffectTrackers.get(pluginId);
    if (tracker) {
      tracker.cleanup();
      this.sideEffectTrackers.delete(pluginId);
    }

    // Remove all UI injections from this plugin
    this.removePluginInjections(pluginId);

    // 注销插件 i18n 资源
    unregisterPluginI18n(pluginId);

    // Revoke the plugin session token (backend auth cleanup).
    const session = this.sessions.get(pluginId);
    if (session) {
      await session.revoke().catch(() => {});
      this.sessions.delete(pluginId);
    }

    plugin.context = undefined;
    plugin.error = undefined;
    // 若停用的是用户手动启用的默认禁用内置插件，从 localStorage 移除，
    // 下次启动时恢复默认禁用状态（需用户再次手动激活）。
    if (readEnabledBuiltinPlugins().has(pluginId)) {
      persistBuiltinEnabledState(pluginId, false);
    }
    this.setState(pluginId, 'inactive');
    this.notify();
  }

  async activateAll(): Promise<void> {
    // Collect plugins that need activation, preserving Map insertion order.
    const toActivate: RegisteredPlugin[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.autoDisabled) {
        console.info(
          `[PluginManager] Skipping auto-disabled plugin "${plugin.definition.id}"`,
        );
        continue;
      }
      if (plugin.defaultDisabled) {
        // 默认禁用的内置插件不参与自动激活，需用户在插件管理 UI 中手动激活。
        console.info(
          `[PluginManager] Skipping default-disabled plugin "${plugin.definition.id}"`,
        );
        continue;
      }
      if (plugin.state === 'registered' || plugin.state === 'inactive') {
        toActivate.push(plugin);
      }
    }

    if (toActivate.length === 0) return;

    // Resolve app version once before activating any plugin.
    await this.initAppVersion();

    // Activate in dependency-aware topological order.
    const toActivateIds = new Set(toActivate.map((p) => p.definition.id));
    const sorted = this.topologicalSort(toActivate, toActivateIds);

    for (const plugin of sorted) {
      // 单个插件激活失败不应中断其他插件。PluginProvider 依赖
      // activateAll 不抛出异常来保证 ready 状态最终被设置。
      try {
        await this.activate(plugin.definition.id);
      } catch (e) {
        console.error(
          `[PluginManager] Failed to activate "${plugin.definition.id}":`,
          e,
        );
      }
    }

    // 所有插件激活完成后，触发 onAppReady 钩子
    await this.emitLifecycleHook('onAppReady', {
      appVersion: this.getAppVersion(),
    });
  }

  /**
   * Topologically sort plugins by their manifest.dependencies.
   * Only dependencies that are themselves in the activation set create edges;
   * already-active or external dependencies are treated as satisfied.
   * If a cycle is detected, a warning is logged and the remaining plugins
   * are appended in original order (best-effort fallback).
   */
  private topologicalSort(
    plugins: RegisteredPlugin[],
    toActivateIds: Set<string>,
  ): RegisteredPlugin[] {
    const idToPlugin = new Map(plugins.map((p) => [p.definition.id, p]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // depId -> [dependentIds]

    for (const p of plugins) {
      inDegree.set(p.definition.id, 0);
      dependents.set(p.definition.id, []);
    }

    for (const p of plugins) {
      const deps = p.manifest?.dependencies ?? [];
      for (const dep of deps) {
        if (toActivateIds.has(dep) && idToPlugin.has(dep)) {
          inDegree.set(p.definition.id, (inDegree.get(p.definition.id) ?? 0) + 1);
          dependents.get(dep)!.push(p.definition.id);
        }
      }
    }

    const result: RegisteredPlugin[] = [];
    const processed = new Set<string>();

    // Repeatedly pick the first plugin (in original order) with in-degree 0,
    // so that original insertion order is preserved among unconstrained plugins.
    while (result.length < plugins.length) {
      let picked: RegisteredPlugin | null = null;
      for (const p of plugins) {
        const id = p.definition.id;
        if (processed.has(id)) continue;
        if ((inDegree.get(id) ?? 0) === 0) {
          picked = p;
          break;
        }
      }

      if (!picked) {
        // Cycle detected — remaining plugins have unresolved circular dependencies.
        const cyclic = plugins
          .filter((p) => !processed.has(p.definition.id))
          .map((p) => p.definition.id);
        console.warn(
          `[PluginManager] Circular dependency detected among plugins: ${cyclic.join(', ')}. ` +
            'Falling back to original activation order for these plugins.',
        );
        for (const p of plugins) {
          if (!processed.has(p.definition.id)) {
            result.push(p);
          }
        }
        return result;
      }

      const pickedId = picked.definition.id;
      result.push(picked);
      processed.add(pickedId);
      for (const depId of dependents.get(pickedId) ?? []) {
        inDegree.set(depId, (inDegree.get(depId) ?? 0) - 1);
      }
    }

    return result;
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

  /**
   * 重置插件的失败计数和自动禁用状态，允许重新尝试激活。
   * 不会自动激活插件，调用方需显式调用 activate()。
   */
  resetPlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    plugin.failureCount = 0;
    plugin.lastError = undefined;
    plugin.autoDisabled = false;
    plugin.error = undefined;
    if (plugin.state === 'error') {
      this.setState(pluginId, 'inactive');
    }
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

  /** 获取扩展点注册表（供 useExtensions hook 使用） */
  getExtensionPointRegistry(): ExtensionPointRegistry {
    return this.extensionPointRegistry;
  }

  /**
   * 触发生命周期钩子，遍历所有 active 插件调用对应 hook。
   *
   * - before* 钩子（INTERCEPTABLE）：任一插件返回 { allow: false } 即中止，返回拦截结果
   * - after* 钩子（FIRE_AND_FORGET）：所有插件依次调用，错误仅记录
   *
   * @param hookName 钩子名称
   * @param args 钩子参数
   * @returns 对于 before* 钩子，返回 { allow, reason }；对于 after* 钩子，返回 { allow: true }
   */
  async emitLifecycleHook(
    hookName: LifecycleHookName,
    args: unknown,
  ): Promise<HookResult> {
    const isInterceptable = hookName.startsWith('before');

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.state !== 'active') continue;
      const hook = plugin.definition.hooks?.[hookName];
      if (!hook) continue;

      try {
        const result = await (hook as (args: unknown) => unknown)(args);

        if (isInterceptable) {
          const hookResult = result as HookResult | undefined;
          if (hookResult && hookResult.allow === false) {
            console.info(
              `[PluginManager] Lifecycle hook "${hookName}" blocked by plugin "${pluginId}": ${hookResult.reason ?? 'no reason'}`,
            );
            return { allow: false, reason: hookResult.reason ?? `Blocked by plugin ${pluginId}` };
          }
        }
      } catch (e) {
        if (isInterceptable) {
          // before* 钩子抛异常 → fail-closed，视为拦截
          console.error(
            `[PluginManager] Lifecycle hook "${hookName}" threw in plugin "${pluginId}":`,
            e,
          );
          return {
            allow: false,
            reason: `Plugin "${pluginId}" hook error: ${e instanceof Error ? e.message : String(e)}`,
          };
        } else {
          // after* 钩子抛异常 → 仅记录，不中断
          console.error(
            `[PluginManager] Lifecycle hook "${hookName}" threw in plugin "${pluginId}":`,
            e,
          );
        }
      }
    }

    return { allow: true };
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
   * Remove all UI injections contributed by a plugin.
   * Used during deactivation and activation failure cleanup.
   */
  private removePluginInjections(pluginId: string): void {
    this.sidebarItems = this.sidebarItems.filter((i) => i.pluginId !== pluginId);
    this.settingsSections = this.settingsSections.filter((s) => s.pluginId !== pluginId);
    this.routes = this.routes.filter((r) => r.pluginId !== pluginId);
    this.contextMenuItems = this.contextMenuItems.filter((i) => i.pluginId !== pluginId);
    this.instanceTabs = this.instanceTabs.filter((t) => t.pluginId !== pluginId);
    this.themes = this.themes.filter((t) => t.pluginId !== pluginId);
    // Also remove any event subscriptions the plugin registered via ctx.events.on()
    this.eventBus.removePluginListeners(pluginId);
    // Also unregister any services the plugin provided (covers activation failure cleanup).
    this.serviceRegistry.unregisterByPlugin(pluginId);
    this.extensionPointRegistry.removeByPlugin(pluginId);

    // Clean up side effects registered before the failure.
    const tracker = this.sideEffectTrackers.get(pluginId);
    if (tracker) {
      tracker.cleanup();
      this.sideEffectTrackers.delete(pluginId);
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
        return `Plugin requires app version ${manifest.minAppVersion}, but current version is ${appVersion}`;
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
    return this.appVersion;
  }

  /**
   * Asynchronously resolve and cache the real app version.
   * Priority: import.meta.env.VITE_APP_VERSION → Tauri getVersion() → '1.0.0'.
   * Safe to call multiple times — subsequent calls are no-ops after the first.
   */
  async initAppVersion(): Promise<void> {
    if (this.appVersionInitialized) return;
    this.appVersionInitialized = true;

    // 1. Prefer build-time injected env var (fastest, no IPC).
    const envVersion = import.meta.env.VITE_APP_VERSION as string | undefined;
    if (envVersion && envVersion.trim().length > 0) {
      this.appVersion = envVersion.trim();
      return;
    }

    // 2. Fall back to Tauri runtime app version (reads tauri.conf.json / Cargo.toml).
    try {
      const tauriVersion = await getVersion();
      if (tauriVersion && tauriVersion.trim().length > 0) {
        this.appVersion = tauriVersion.trim();
        return;
      }
    } catch {
      // Non-Tauri environment (e.g. unit tests) — keep default '1.0.0'.
    }

    // 3. Keep the default '1.0.0' already assigned to this.appVersion.
  }

  private isVersionSatisfied(current: string, required: string): boolean {
    // 当前版本无效时拒绝（fail-closed）
    if (!semver.valid(current)) {
      console.warn(`[PluginManager] Invalid app version "${current}", failing version check`);
      return false;
    }

    // 裸版本号（如 "1.0.0"）→ ">=1.0.0"（向后兼容）
    // 含范围操作符的字符串（如 "^1.0.0"、">=1.0.0 <2.0.0"）直接使用
    const range = this.normalizeVersionRange(required);
    return semver.satisfies(current, range);
  }

  /**
   * 把裸版本号规范化为 semver range。
   * "1.2.3" → ">=1.2.3"
   * "^1.2.3" → "^1.2.3"（不变）
   * ">=1.0.0" → ">=1.0.0"（不变）
   */
  private normalizeVersionRange(version: string): string {
    const trimmed = version.trim();
    // 含范围操作符或通配符 → 已是 range，直接返回
    if (/^[~^>=<\*x]/.test(trimmed) || /\s/.test(trimmed) || trimmed.includes('||')) {
      return trimmed;
    }
    // 裸版本号 → ">=" 前缀
    return `>=${trimmed}`;
  }
}

