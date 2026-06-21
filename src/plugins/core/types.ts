// src/plugins/core/types.ts
import type { PluginLifecycleHooks } from './LifecycleHooks';

/** 插件定义，由 definePlugin() 包装 */
export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
  /** 生命周期钩子（可选） */
  hooks?: PluginLifecycleHooks;
}

/** 标签：可以是纯字符串，或指向 i18n 资源的键 */
export type PluginLabel = string | { i18nKey: string };

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
  /** 是否在 iframe 沙箱中运行（高安全级插件）。
   * true: 插件代码运行在 sandbox="allow-scripts" 的 iframe 中，无法访问主窗口。
   * false/省略: 直接在主窗口上下文运行（默认，向后兼容）。
   */
  sandbox?: boolean;
  /** 插件提供的 i18n 资源。键为语言代码，值为相对命名空间的翻译字典。
   * 激活时合并到全局 i18n，键前缀为 `plugin:<id>:`。
   * 例如 manifest.i18n['zh-CN']['sidebar.store'] → 全局键 `plugin:com.bonnext.marketplace:sidebar.store`
   */
  i18n?: {
    'en-US'?: Record<string, string>;
    'zh-CN'?: Record<string, string>;
  };
  contributes?: {
    routes?: Array<{ path: string; component: string }>;
    sidebar?: Array<{ id: string; label: PluginLabel; icon: string; route: string; order: number }>;
    settings?: Array<{ id: string; label: string; component: string; order: number }>;
    contextMenu?: Array<{ id: string; label: string; icon?: string; where: string[] }>;
    instanceTabs?: Array<{ id: string; label: string; component: string; order: number }>;
    themes?: Array<{
      id: string;
      name: string;
      cssVariables?: Record<string, string>;
      fonts?: Array<{ family: string; src: string; weight?: number; style?: string }>;
      mode?: 'light' | 'dark' | 'auto';
    }>;
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
  /** 累计激活失败次数（成功激活后重置为 0） */
  failureCount?: number;
  /** 最近一次失败的详细信息（含堆栈和时间戳） */
  lastError?: {
    message: string;
    stack?: string;
    timestamp: number;
  };
  /** 失败次数达到阈值后自动禁用，需用户手动重置才能再次激活 */
  autoDisabled?: boolean;
  /** 内置插件标记为默认禁用（enabledByDefault: false）。
   * activateAll() 会跳过此类插件，需用户在插件管理 UI 中手动激活。
   * 用户手动激活后清除该标记，并写入 localStorage 持久化用户选择。 */
  defaultDisabled?: boolean;
}

/** 侧边栏注入项 */
export interface SidebarItem {
  id: string;
  label: PluginLabel;
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
  fonts?: Array<{ family: string; src: string; weight?: number; style?: string }>;
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

  // 服务互操作
  provide<T>(serviceId: string, factory: () => T | Promise<T>): void;
  consume<T>(serviceId: string): T | Promise<T | undefined> | undefined;
  requestService<T>(serviceId: string, timeoutMs?: number): Promise<T>;

  // 扩展点贡献
  contribute<T>(epId: string, value: T, order?: number): void;

  // 受控副作用（deactivate 时自动清理）
  setInterval(handler: () => void, timeout: number): ReturnType<typeof setInterval>;
  setTimeout(handler: () => void, timeout: number): ReturnType<typeof setTimeout>;
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  subscribeStore(unsubscribe: () => void): () => void;
  mountPortal(node: HTMLElement): void;

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
  on(event: string, handler: (data: unknown) => void, pluginId?: string): () => void;
  emit(event: string, data: unknown): void;
  /** 注册 RPC 请求处理器 */
  handleRequest(
    requestType: string,
    handler: (data: unknown) => unknown | Promise<unknown>,
    pluginId?: string,
  ): () => void;
  /** 发送 RPC 请求并等待响应 */
  request<T = unknown>(
    requestType: string,
    data: unknown,
    timeoutMs?: number,
    requesterPluginId?: string,
  ): Promise<T>;
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
