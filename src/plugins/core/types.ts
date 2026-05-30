export type PluginState = 'registered' | 'activating' | 'active' | 'deactivating' | 'inactive';

export interface PluginDependency {
  id: string;
  version?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: PluginDependency[];
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

export interface PluginStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface ExtensionPoint<T = unknown> {
  id: string;
  name: string;
  onContribute(contribution: T): void;
  onRetract(contribution: T): void;
}

export interface PluginContext {
  pluginId: string;
  provideService(id: string, service: unknown): void;
  consumeService(id: string): unknown;
  registerExtensionPoint(point: ExtensionPoint): void;
  contributeExtension(pointId: string, contribution: unknown): void;
  contributeExtensionRuntime(pointId: string, contribution: unknown): void;
  retractExtension(pointId: string, contribution: unknown): void;
  storage: PluginStorage;
  logger: PluginLogger;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  minAppVersion?: string;
}

export interface RegisteredPlugin {
  plugin: Plugin;
  state: PluginState;
  context: PluginContext;
}
