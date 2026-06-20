// src/plugins/core/__tests__/PluginManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '../PluginManager';
import type { PluginDefinition, PluginContext } from '../types';

function createMockPlugin(id: string) {
  const state = { activated: false, deactivated: false };
  const definition: PluginDefinition = {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    activate: (ctx: PluginContext) => {
      state.activated = true;
      ctx.addSidebarItem({ id: 'test', label: 'Test', icon: '🧪', route: '/test', order: 1 });
    },
    deactivate: () => {
      state.deactivated = true;
    },
  };
  return { definition, state };
}

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should register a plugin', () => {
    const { definition } = createMockPlugin('com.test.a');
    manager.register(definition);
    expect(manager.getPlugin('com.test.a')).toBeDefined();
    expect(manager.getPlugin('com.test.a')?.state).toBe('registered');
  });

  it('should activate a plugin and collect UI injections', async () => {
    const { definition, state } = createMockPlugin('com.test.a');
    manager.register(definition);
    await manager.activate('com.test.a');
    expect(state.activated).toBe(true);
    expect(manager.getPlugin('com.test.a')?.state).toBe('active');
    expect(manager.getSidebarItems()).toHaveLength(1);
    expect(manager.getSidebarItems()[0].pluginId).toBe('com.test.a');
  });

  it('should deactivate a plugin and remove its UI injections', async () => {
    const { definition, state } = createMockPlugin('com.test.a');
    manager.register(definition);
    await manager.activate('com.test.a');
    await manager.deactivate('com.test.a');
    expect(state.deactivated).toBe(true);
    expect(manager.getPlugin('com.test.a')?.state).toBe('inactive');
    expect(manager.getSidebarItems()).toHaveLength(0);
  });

  it('should activate all registered plugins', async () => {
    const a = createMockPlugin('com.test.a');
    const b = createMockPlugin('com.test.b');
    manager.register(a.definition);
    manager.register(b.definition);
    await manager.activateAll();
    expect(manager.getPlugin('com.test.a')?.state).toBe('active');
    expect(manager.getPlugin('com.test.b')?.state).toBe('active');
  });

  it('should handle activation errors gracefully', async () => {
    const badPlugin: PluginDefinition = {
      id: 'com.test.bad',
      name: 'Bad',
      version: '1.0.0',
      activate: () => {
        throw new Error('Activation failed');
      },
    };
    manager.register(badPlugin);
    await manager.activate('com.test.bad');
    expect(manager.getPlugin('com.test.bad')?.state).toBe('error');
    expect(manager.getPlugin('com.test.bad')?.error).toContain('Activation failed');
  });

  it('should return routes sorted by registration', async () => {
    manager.register({
      id: 'com.test.a',
      name: 'A',
      version: '1.0.0',
      activate: (ctx: PluginContext) => {
        ctx.registerRoute('/a', async () => ({ default: () => null as never }));
      },
    });
    await manager.activate('com.test.a');
    expect(manager.getRoutes()).toHaveLength(1);
    expect(manager.getRoutes()[0].path).toBe('/a');
  });
});
