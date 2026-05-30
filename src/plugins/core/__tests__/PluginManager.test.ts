import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '../PluginManager';
import type { Plugin } from '../types';

const createPlugin = (id: string, deps?: string[]): Plugin & { activated: boolean; deactivated: boolean } =>
  ({
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    dependencies: deps?.map((d) => ({ id: d })),
    activated: false,
    deactivated: false,
    async activate() {
      this.activated = true;
    },
    async deactivate() {
      this.deactivated = true;
    },
  }) as Plugin & { activated: boolean; deactivated: boolean };

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should register and activate a plugin', async () => {
    const plugin = createPlugin('com.test.a');
    manager.register(plugin);
    await manager.activate('com.test.a');
    expect(manager.getState('com.test.a')).toBe('active');
  });

  it('should deactivate a plugin', async () => {
    const plugin = createPlugin('com.test.a');
    manager.register(plugin);
    await manager.activate('com.test.a');
    await manager.deactivate('com.test.a');
    expect(manager.getState('com.test.a')).toBe('inactive');
  });

  it('should activate plugins in dependency order', async () => {
    const activationOrder: string[] = [];
    const a: Plugin = {
      id: 'a',
      name: 'A',
      version: '1.0.0',
      async activate() {
        activationOrder.push('a');
      },
      async deactivate() {},
    };
    const b: Plugin = {
      id: 'b',
      name: 'B',
      version: '1.0.0',
      dependencies: [{ id: 'a' }],
      async activate() {
        activationOrder.push('b');
      },
      async deactivate() {},
    };

    manager.register(a);
    manager.register(b);
    await manager.activateAll();
    expect(activationOrder).toEqual(['a', 'b']);
  });

  it('should provide and consume services', async () => {
    const service = { hello: 'world' };
    const provider: Plugin = {
      id: 'provider',
      name: 'Provider',
      version: '1.0.0',
      async activate(ctx) {
        ctx.provideService('test:service', service);
      },
      async deactivate() {},
    };
    let consumed: unknown;
    const consumer: Plugin = {
      id: 'consumer',
      name: 'Consumer',
      version: '1.0.0',
      dependencies: [{ id: 'provider' }],
      async activate(ctx) {
        consumed = ctx.consumeService('test:service');
      },
      async deactivate() {},
    };

    manager.register(provider);
    manager.register(consumer);
    await manager.activateAll();
    expect(consumed).toBe(service);
  });

  it('should throw when activating unknown plugin', async () => {
    await expect(manager.activate('unknown')).rejects.toThrow(/not registered/);
  });

  it('should return all active plugins', async () => {
    manager.register(createPlugin('a'));
    manager.register(createPlugin('b'));
    await manager.activateAll();
    expect(manager.getActivePlugins()).toHaveLength(2);
  });
});
