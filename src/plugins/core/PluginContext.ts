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
import type { ServiceRegistry } from './ServiceRegistry';
import type { ExtensionPointRegistry } from './ExtensionPoint';
import type { SideEffectTracker } from './SideEffectTracker';
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
  serviceRegistry: ServiceRegistry,
  extensionPointRegistry: ExtensionPointRegistry,
  sideEffectTracker: SideEffectTracker,
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

    // Wrap events with permission checks.
    // events:listen controls subscription, events:emit controls broadcasting.
    events: {
      on(event: string, handler: (data: unknown) => void): () => void {
        if (!permissions.canListenEvents()) {
          logger.warn(`Events listen denied (no permission): ${event}`);
          return () => {}; // no-op unsubscribe
        }
        return events.on(event, handler, pluginId);
      },
      emit(event: string, data: unknown): void {
        if (!permissions.canEmitEvents()) {
          logger.warn(`Events emit denied (no permission): ${event}`);
          return;
        }
        events.emit(event, data);
      },
      handleRequest(
        requestType: string,
        handler: (data: unknown) => unknown | Promise<unknown>,
      ): () => void {
        if (!permissions.canEmitEvents() || !permissions.canListenEvents()) {
          logger.warn(`Events handleRequest denied (no permission): ${requestType}`);
          return () => {};
        }
        return events.handleRequest(requestType, handler, pluginId);
      },
      async request<T = unknown>(requestType: string, data: unknown, timeoutMs?: number): Promise<T> {
        if (!permissions.canEmitEvents() || !permissions.canListenEvents()) {
          logger.warn(`Events request denied (no permission): ${requestType}`);
          throw new Error(`Permission denied: cannot send RPC request ${requestType}`);
        }
        return events.request<T>(requestType, data, timeoutMs, pluginId);
      },
    },

    storage,

    provide<T>(serviceId: string, factory: () => T | Promise<T>): void {
      serviceRegistry.provide(serviceId, pluginId, factory);
    },
    consume<T>(serviceId: string): T | Promise<T | undefined> | undefined {
      return serviceRegistry.consume<T>(serviceId);
    },
    async requestService<T>(serviceId: string, timeoutMs?: number): Promise<T> {
      return serviceRegistry.requestService<T>(serviceId, timeoutMs);
    },

    contribute<T>(epId: string, value: T, order?: number): void {
      extensionPointRegistry.contribute(epId, pluginId, value, order);
    },

    setInterval(handler: () => void, timeout: number): ReturnType<typeof setInterval> {
      return sideEffectTracker.setInterval(handler, timeout);
    },
    setTimeout(handler: () => void, timeout: number): ReturnType<typeof setTimeout> {
      return sideEffectTracker.setTimeout(handler, timeout);
    },
    addEventListener(
      target: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      sideEffectTracker.addEventListener(target, type, listener, options);
    },
    subscribeStore(unsubscribe: () => void): () => void {
      return sideEffectTracker.subscribeStore(unsubscribe);
    },
    mountPortal(node: HTMLElement): void {
      sideEffectTracker.mountPortal(node);
    },

    logger,
  };
}
