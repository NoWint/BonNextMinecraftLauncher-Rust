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

describe('PluginManager side effect tracking', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should auto-clean setInterval on deactivate', async () => {
    const handler = vi.fn();
    const plugin: PluginDefinition = {
      id: 'test:interval',
      name: 'Test',
      version: '1.0.0',
      activate(ctx) {
        ctx.setInterval(handler, 50);
      },
    };
    manager.register(plugin);
    await manager.activate('test:interval');
    await manager.deactivate('test:interval');

    // 等待确认 interval 已清除
    await new Promise((r) => setTimeout(r, 120));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should auto-clean addEventListener on deactivate', async () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const plugin: PluginDefinition = {
      id: 'test:listener',
      name: 'Test',
      version: '1.0.0',
      activate(ctx) {
        ctx.addEventListener(target, 'test-event', handler);
      },
    };
    manager.register(plugin);
    await manager.activate('test:listener');
    await manager.deactivate('test:listener');

    target.dispatchEvent(new Event('test-event'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should auto-clean subscribeStore on deactivate', async () => {
    const unsubscribe = vi.fn();
    const plugin: PluginDefinition = {
      id: 'test:store',
      name: 'Test',
      version: '1.0.0',
      activate(ctx) {
        ctx.subscribeStore(unsubscribe);
      },
    };
    manager.register(plugin);
    await manager.activate('test:store');
    await manager.deactivate('test:store');

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should auto-clean mountPortal on deactivate', async () => {
    const testNode = document.createElement('div');
    testNode.id = 'portal-test';
    document.body.appendChild(testNode);

    const plugin: PluginDefinition = {
      id: 'test:portal',
      name: 'Test',
      version: '1.0.0',
      activate(ctx) {
        ctx.mountPortal(testNode);
      },
    };
    manager.register(plugin);
    await manager.activate('test:portal');
    expect(document.body.contains(testNode)).toBe(true);

    await manager.deactivate('test:portal');
    expect(document.body.contains(testNode)).toBe(false);
  });

  it('should clean up side effects on activation failure', async () => {
    const unsubscribe = vi.fn();
    const plugin: PluginDefinition = {
      id: 'test:fail',
      name: 'Test',
      version: '1.0.0',
      activate(ctx) {
        ctx.subscribeStore(unsubscribe);
        throw new Error('activate failed');
      },
    };
    manager.register(plugin);
    await expect(manager.activate('test:fail')).rejects.toThrow('activate failed');

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should support multiple side effects from same plugin', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();
    const plugin: PluginDefinition = {
      id: 'test:multi',
      name: 'Test',
      version: '1.0.0',
      activate(ctx) {
        ctx.setInterval(h1, 1000);
        ctx.setTimeout(h2, 1000);
        ctx.subscribeStore(h3);
      },
    };
    manager.register(plugin);
    await manager.activate('test:multi');
    await manager.deactivate('test:multi');

    expect(h3).toHaveBeenCalled(); // subscribeStore 的 unsubscribe 被调用
  });
});
