import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'plugin_register_session') return Promise.resolve('mock-token');
    if (cmd === 'plugin_revoke_session') return Promise.resolve();
    return Promise.resolve();
  }),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('1.0.0'),
}));

import { PluginManager } from '../PluginManager';
import type { PluginDefinition } from '../types';

describe('PluginManager ExtensionPoint integration', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should declare core extension points on construction', () => {
    const registry = manager.getExtensionPointRegistry();
    expect(registry.isDeclared('home:widget')).toBe(true);
    expect(registry.isDeclared('instance:tab')).toBe(true);
    expect(registry.isDeclared('sidebar:action')).toBe(true);
  });

  it('should allow plugins to contribute via ctx.contribute', async () => {
    const plugin: PluginDefinition = {
      id: 'test:contributor',
      name: 'Test Contributor',
      version: '1.0.0',
      activate(ctx) {
        ctx.contribute('home:widget', {
          id: 'my-widget',
          title: 'My Widget',
          component: () => Promise.resolve({ default: () => null }),
        }, 10);
      },
    };

    manager.register(plugin);
    await manager.activate('test:contributor');

    const registry = manager.getExtensionPointRegistry();
    const contributions = registry.getContributions('home:widget');
    expect(contributions).toHaveLength(1);
    expect(contributions[0].value).toMatchObject({ id: 'my-widget', title: 'My Widget' });
    expect(contributions[0].pluginId).toBe('test:contributor');
  });

  it('should remove contributions when plugin is deactivated', async () => {
    const plugin: PluginDefinition = {
      id: 'test:removable',
      name: 'Test Removable',
      version: '1.0.0',
      activate(ctx) {
        ctx.contribute('home:widget', {
          id: 'temp-widget',
          title: 'Temp',
          component: () => Promise.resolve({ default: () => null }),
        });
      },
    };

    manager.register(plugin);
    await manager.activate('test:removable');
    expect(manager.getExtensionPointRegistry().getContributions('home:widget')).toHaveLength(1);

    await manager.deactivate('test:removable');
    expect(manager.getExtensionPointRegistry().getContributions('home:widget')).toHaveLength(0);
  });

  it('should propagate validation errors from contribute', async () => {
    const plugin: PluginDefinition = {
      id: 'test:invalid',
      name: 'Test Invalid',
      version: '1.0.0',
      activate(ctx) {
        // 传入不符合 HomeWidgetContribution 结构的值
        ctx.contribute('home:widget', { missing: 'fields' } as never);
      },
    };

    manager.register(plugin);
    await expect(manager.activate('test:invalid')).rejects.toThrow(/failed validation/);
  });
});
