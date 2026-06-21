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

describe('PluginManager lifecycle hooks', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should call beforeInstanceLaunch hook and allow when all return allow:true', async () => {
    const hook = vi.fn().mockReturnValue({ allow: true });
    const plugin: PluginDefinition = {
      id: 'test:allow',
      name: 'Test',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook },
    };
    manager.register(plugin);
    await manager.activate('test:allow');

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', {
      instanceId: 'inst-1',
      instanceName: 'Test Instance',
      versionId: '1.20.1',
    });

    expect(result.allow).toBe(true);
    expect(hook).toHaveBeenCalledWith({
      instanceId: 'inst-1',
      instanceName: 'Test Instance',
      versionId: '1.20.1',
    });
  });

  it('should block when a plugin returns allow:false', async () => {
    const hook = vi.fn().mockReturnValue({ allow: false, reason: 'Not allowed' });
    const plugin: PluginDefinition = {
      id: 'test:block',
      name: 'Test',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook },
    };
    manager.register(plugin);
    await manager.activate('test:block');

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', {
      instanceId: 'inst-1',
      instanceName: 'Test',
      versionId: '1.20.1',
    });

    expect(result.allow).toBe(false);
    expect(result.reason).toBe('Not allowed');
  });

  it('should stop calling subsequent hooks after first block', async () => {
    const hook1 = vi.fn().mockReturnValue({ allow: false, reason: 'Blocked by first' });
    const hook2 = vi.fn().mockReturnValue({ allow: true });
    manager.register({
      id: 'test:first',
      name: 'First',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook1 },
    });
    manager.register({
      id: 'test:second',
      name: 'Second',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook2 },
    });
    await manager.activate('test:first');
    await manager.activate('test:second');

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', { instanceId: 'x' });

    expect(result.allow).toBe(false);
    expect(hook2).not.toHaveBeenCalled();
  });

  it('should treat hook exception as block (fail-closed)', async () => {
    const hook = vi.fn().mockImplementation(() => {
      throw new Error('Hook crashed');
    });
    const plugin: PluginDefinition = {
      id: 'test:crash',
      name: 'Test',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook },
    };
    manager.register(plugin);
    await manager.activate('test:crash');

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', { instanceId: 'x' });

    expect(result.allow).toBe(false);
    expect(result.reason).toContain('Hook crashed');
  });

  it('should support async before hooks', async () => {
    const hook = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { allow: true };
    });
    const plugin: PluginDefinition = {
      id: 'test:async',
      name: 'Test',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook },
    };
    manager.register(plugin);
    await manager.activate('test:async');

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', { instanceId: 'x' });
    expect(result.allow).toBe(true);
  });

  it('should call afterInstanceLaunch hook (fire-and-forget)', async () => {
    const hook = vi.fn().mockResolvedValue(undefined);
    const plugin: PluginDefinition = {
      id: 'test:after',
      name: 'Test',
      version: '1.0.0',
      activate() {},
      hooks: { afterInstanceLaunch: hook },
    };
    manager.register(plugin);
    await manager.activate('test:after');

    const result = await manager.emitLifecycleHook('afterInstanceLaunch', {
      instanceId: 'x',
      instanceName: 'Test',
      versionId: '1.0',
      success: true,
    });

    expect(result.allow).toBe(true); // after hooks always return allow:true
    expect(hook).toHaveBeenCalled();
  });

  it('should not interrupt after hooks on error', async () => {
    const errorHook = vi.fn().mockImplementation(() => {
      throw new Error('After hook error');
    });
    const successHook = vi.fn().mockResolvedValue(undefined);
    manager.register({
      id: 'test:error-after',
      name: 'ErrorAfter',
      version: '1.0.0',
      activate() {},
      hooks: { afterInstanceLaunch: errorHook },
    });
    manager.register({
      id: 'test:success-after',
      name: 'SuccessAfter',
      version: '1.0.0',
      activate() {},
      hooks: { afterInstanceLaunch: successHook },
    });
    await manager.activate('test:error-after');
    await manager.activate('test:success-after');

    const result = await manager.emitLifecycleHook('afterInstanceLaunch', {
      instanceId: 'x',
      success: true,
    });

    expect(result.allow).toBe(true);
    expect(errorHook).toHaveBeenCalled();
    expect(successHook).toHaveBeenCalled(); // 第二个 hook 仍被调用
  });

  it('should skip inactive plugins', async () => {
    const hook = vi.fn().mockReturnValue({ allow: true });
    manager.register({
      id: 'test:inactive',
      name: 'Inactive',
      version: '1.0.0',
      activate() {},
      hooks: { beforeInstanceLaunch: hook },
    });
    // 不激活插件

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', { instanceId: 'x' });

    expect(result.allow).toBe(true);
    expect(hook).not.toHaveBeenCalled();
  });

  it('should skip plugins without the requested hook', async () => {
    const otherHook = vi.fn();
    manager.register({
      id: 'test:no-hook',
      name: 'NoHook',
      version: '1.0.0',
      activate() {},
      hooks: { beforeModInstall: otherHook },
    });
    await manager.activate('test:no-hook');

    const result = await manager.emitLifecycleHook('beforeInstanceLaunch', { instanceId: 'x' });

    expect(result.allow).toBe(true);
    expect(otherHook).not.toHaveBeenCalled();
  });

  it('should trigger onAppReady after activateAll', async () => {
    const readyHook = vi.fn();
    manager.register({
      id: 'test:ready',
      name: 'Ready',
      version: '1.0.0',
      activate() {},
      hooks: { onAppReady: readyHook },
    });

    await manager.activateAll();

    expect(readyHook).toHaveBeenCalledWith({ appVersion: '1.0.0' });
  });

  it('should support beforeModInstall hook', async () => {
    const hook = vi.fn().mockReturnValue({ allow: true });
    manager.register({
      id: 'test:mod',
      name: 'Mod',
      version: '1.0.0',
      activate() {},
      hooks: { beforeModInstall: hook },
    });
    await manager.activate('test:mod');

    const result = await manager.emitLifecycleHook('beforeModInstall', {
      instanceId: 'x',
      modSlug: 'sodium',
      modName: 'Sodium',
      versionId: '1.0',
    });

    expect(result.allow).toBe(true);
    expect(hook).toHaveBeenCalledWith({
      instanceId: 'x',
      modSlug: 'sodium',
      modName: 'Sodium',
      versionId: '1.0',
    });
  });
});
