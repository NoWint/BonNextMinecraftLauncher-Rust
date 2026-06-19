// src/plugins/core/types.ts

/** 插件定义，由 definePlugin() 包装 */
export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/** 插件清单（manifest.json） */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  minAppVersion?: string;
  dependencies?: string[];
  permissions?: string[];
  contributes?: {
    routes?: Array<{ path: string; component: string }>;
    sidebar?: Array<{ id: string; label: string; icon: string; route: string; order: number }>;
    settings?: Array<{ id: string; label: string; component: string; order: number }>;
  };
}

/** 插件运行时状态 */
export type PluginState = 'registered' | 'activating' | 'active' | 'deactivating' | 'inactive' | 'error';

/** 已注册的插件实例 */
export interface RegisteredPlugin {
  definition: PluginDefinition;
  manifest?: PluginManifest;
  state: PluginState;
  context?: PluginContext;
  error?: string;
}

/** 侧边栏注入项 */
export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  order: number;
  pluginId: string;
}

/** 设置页注入项 */
export interface SettingsSection {
  id: string;
  label: string;
  component: () => Promise<{ default: React.ComponentType<unknown> }>;
  order: number;
  pluginId: string;
}

/** 路由注入项 */
export interface PluginRoute {
  path: string;
  component: () => Promise<{ default: React.ComponentType<unknown> }>;
  pluginId: string;
}

/** 上下文菜单注入项 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: (context: { type: string; data: unknown }) => void;
  where: string[];
  pluginId: string;
}

/** 实例详情标签页注入项 */
export interface InstanceTab {
  id: string;
  label: string;
  component: () => Promise<{ default: React.ComponentType<unknown> }>;
  order: number;
  pluginId: string;
}

/** 主题注入项 */
export interface ThemeContribution {
  id: string;
  name: string;
  cssVariables: Record<string, string>;
  mode: 'light' | 'dark' | 'auto';
  pluginId: string;
}

/** 插件上下文，激活时传入 */
export interface PluginContext {
  pluginId: string;

  // UI 注入
  registerRoute(path: string, lazyComponent: () => Promise<{ default: React.ComponentType<unknown> }>): void;
  addSidebarItem(item: Omit<SidebarItem, 'pluginId'>): void;
  addSettingsSection(section: Omit<SettingsSection, 'pluginId'>): void;
  addContextMenuItem(item: Omit<ContextMenuItem, 'pluginId'>): void;
  addInstanceTab(tab: Omit<InstanceTab, 'pluginId'>): void;
  registerTheme(theme: Omit<ThemeContribution, 'pluginId'>): void;

  // 后端访问
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;

  // 通用能力
  http: PluginHttpClient;
  fs: PluginFileSystem;
  events: PluginEventBus;

  // 存储
  storage: PluginStorage;

  // 日志
  logger: PluginLogger;
}

export interface PluginHttpClient {
  get(url: string, options?: { params?: Record<string, string>; headers?: Record<string, string> }): Promise<unknown>;
  post(url: string, body: unknown, options?: { headers?: Record<string, string> }): Promise<unknown>;
}

export interface PluginFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

export interface PluginEventBus {
  on(event: string, handler: (data: unknown) => void): () => void;
  emit(event: string, data: unknown): void;
}

export interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
