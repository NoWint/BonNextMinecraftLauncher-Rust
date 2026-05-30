import type { Plugin, ExtensionPoint, PluginStorage } from './types';
import { PluginRegistry } from './PluginRegistry';
import { ServiceRegistry } from './ServiceRegistry';
import { DependencyResolver } from './DependencyResolver';
import { PluginContextImpl } from './PluginContext';

class MemoryPluginStorage implements PluginStorage {
  private data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export { MemoryPluginStorage };

export class PluginManager {
  private registry = new PluginRegistry();
  private serviceRegistry = new ServiceRegistry();
  private resolver = new DependencyResolver();
  private extensionPoints = new Map<string, ExtensionPoint>();
  private contexts = new Map<string, PluginContextImpl>();

  register(plugin: Plugin): void {
    this.registry.register(plugin);
  }

  async activate(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    if (entry.plugin.dependencies) {
      for (const dep of entry.plugin.dependencies) {
        const depState = this.registry.getState(dep.id);
        if (depState !== 'active') {
          throw new Error(`Dependency "${dep.id}" for plugin "${pluginId}" is not active (state: ${depState})`);
        }
      }
    }

    this.registry.setState(pluginId, 'activating');

    const context = new PluginContextImpl(pluginId, this.serviceRegistry, new MemoryPluginStorage(), this);

    this.contexts.set(pluginId, context);

    try {
      await entry.plugin.activate(context);

      for (const { pointId, contribution } of context.getContributedExtensions()) {
        const point = this.extensionPoints.get(pointId);
        if (point) {
          point.onContribute(contribution);
        }
      }

      this.registry.setState(pluginId, 'active');
    } catch (e) {
      this.registry.setState(pluginId, 'inactive');
      throw e;
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) return;

    this.registry.setState(pluginId, 'deactivating');

    const context = this.contexts.get(pluginId);

    try {
      if (context) {
        for (const { pointId, contribution } of context.getContributedExtensions()) {
          const point = this.extensionPoints.get(pointId);
          if (point) {
            point.onRetract(contribution);
          }
        }
        context.clearContributions();
      }

      this.serviceRegistry.revokeAllForPlugin(pluginId);
      await entry.plugin.deactivate();
      this.registry.setState(pluginId, 'inactive');
    } catch (e) {
      this.registry.setState(pluginId, 'active');
      throw e;
    }
  }

  async activateAll(): Promise<void> {
    const plugins = this.registry.getAll().map((e) => e.plugin);
    const order = this.resolver.resolve(plugins);

    for (const id of order) {
      await this.activate(id);
    }
  }

  async deactivateAll(): Promise<void> {
    const plugins = this.registry
      .getAll()
      .filter((e) => e.state === 'active')
      .map((e) => e.plugin);
    const order = this.resolver.resolve(plugins).reverse();

    for (const id of order) {
      await this.deactivate(id);
    }
  }

  getState(pluginId: string) {
    return this.registry.getState(pluginId);
  }

  getActivePlugins(): Plugin[] {
    return this.registry
      .getAll()
      .filter((e) => e.state === 'active')
      .map((e) => e.plugin);
  }

  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.id, point);
  }

  getExtensionPoint(id: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(id);
  }

  getService(id: string): unknown {
    return this.serviceRegistry.consume(id);
  }
}
