import type { Plugin, PluginState, RegisteredPlugin } from './types';

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  registered: ['activating', 'inactive'],
  activating: ['active', 'inactive'],
  active: ['deactivating'],
  deactivating: ['inactive', 'active'],
  inactive: ['activating'],
};

export class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      return;
    }
    this.plugins.set(plugin.id, {
      plugin,
      state: 'registered',
      context: null as unknown as RegisteredPlugin['context'],
    });
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  get(id: string): RegisteredPlugin | undefined {
    return this.plugins.get(id);
  }

  getState(id: string): PluginState | undefined {
    return this.plugins.get(id)?.state;
  }

  setState(id: string, newState: PluginState): void {
    const entry = this.plugins.get(id);
    if (!entry) {
      throw new Error(`Plugin "${id}" is not registered`);
    }
    const allowed = VALID_TRANSITIONS[entry.state];
    if (!allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${entry.state} → ${newState} for plugin "${id}"`);
    }
    entry.state = newState;
  }

  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }
}
