import type { PluginStorage, PluginLogger, ExtensionPoint, PluginContext } from './types';
import type { ServiceRegistry } from './ServiceRegistry';
import type { PluginManager } from './PluginManager';

export class PluginContextImpl implements PluginContext {
  public readonly pluginId: string;
  public readonly storage: PluginStorage;
  public readonly logger: PluginLogger;
  private serviceRegistry: ServiceRegistry;
  private pluginManager: PluginManager;
  private extensionPoints = new Map<string, ExtensionPoint>();
  private contributedExtensions: Array<{ pointId: string; contribution: unknown }> = [];

  constructor(
    pluginId: string,
    serviceRegistry: ServiceRegistry,
    storage: PluginStorage,
    pluginManager: PluginManager,
  ) {
    this.pluginId = pluginId;
    this.serviceRegistry = serviceRegistry;
    this.storage = storage;
    this.pluginManager = pluginManager;
    this.logger = {
      info: (msg: string, ...args: unknown[]) => console.info(`[${pluginId}] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) => console.warn(`[${pluginId}] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) => console.error(`[${pluginId}] ${msg}`, ...args),
    };
  }

  provideService(id: string, service: unknown): void {
    this.serviceRegistry.provide(id, service, this.pluginId);
  }

  consumeService(id: string): unknown {
    return this.serviceRegistry.consume(id);
  }

  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.id, point);
  }

  contributeExtension(pointId: string, contribution: unknown): void {
    this.contributedExtensions.push({ pointId, contribution });
  }

  contributeExtensionRuntime(pointId: string, contribution: unknown): void {
    this.contributedExtensions.push({ pointId, contribution });
    const point = this.pluginManager.getExtensionPoint(pointId);
    if (point) {
      point.onContribute(contribution);
    }
  }

  retractExtension(pointId: string, contribution: unknown): void {
    const idx = this.contributedExtensions.findIndex((e) => e.pointId === pointId && e.contribution === contribution);
    if (idx !== -1) {
      this.contributedExtensions.splice(idx, 1);
    }
    const point = this.pluginManager.getExtensionPoint(pointId);
    if (point) {
      point.onRetract(contribution);
    }
  }

  getExtensionPoint(id: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(id);
  }

  getContributedExtensions(): Array<{ pointId: string; contribution: unknown }> {
    return [...this.contributedExtensions];
  }

  clearContributions(): void {
    this.contributedExtensions = [];
  }
}
