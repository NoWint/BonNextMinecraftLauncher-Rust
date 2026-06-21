import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tauri invoke 和 getVersion
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

function makeFailingPlugin(id: string, failTimes: number): PluginDefinition {
  let calls = 0;
  return {
    id,
    name: id,
    version: '1.0.0',
    activate() {
      calls++;
      if (calls <= failTimes) {
        throw new Error(`Activation failure ${calls}`);
      }
      // 成功路径不返回 Promise
    },
  };
}

function makeSuccessPlugin(id: string): PluginDefinition {
  return {
    id,
    name: id,
    version: '1.0.0',
    activate() {},
  };
}

describe('PluginManager error recovery', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should increment failureCount on activation failure', async () => {
    const plugin = makeFailingPlugin('test:fail-1', 1);
    manager.register(plugin);
    await expect(manager.activate('test:fail-1')).rejects.toThrow(/Activation failure 1/);
    const registered = manager.getPlugin('test:fail-1');
    expect(registered?.failureCount).toBe(1);
    expect(registered?.lastError?.message).toBe('Activation failure 1');
    expect(registered?.lastError?.timestamp).toBeGreaterThan(0);
    expect(registered?.autoDisabled).toBeUndefined();
  });

  it('should auto-disable after 3 failures', async () => {
    const plugin = makeFailingPlugin('test:fail-3', 5);
    manager.register(plugin);

    for (let i = 0; i < 3; i++) {
      await expect(manager.activate('test:fail-3')).rejects.toThrow();
    }
    const registered = manager.getPlugin('test:fail-3');
    expect(registered?.failureCount).toBe(3);
    expect(registered?.autoDisabled).toBe(true);
  });

  it('should reject activate() when autoDisabled is true', async () => {
    const plugin = makeFailingPlugin('test:disabled', 5);
    manager.register(plugin);

    for (let i = 0; i < 3; i++) {
      await expect(manager.activate('test:disabled')).rejects.toThrow();
    }
    // 第 4 次应被拒绝（auto-disabled）
    await expect(manager.activate('test:disabled')).rejects.toThrow(/auto-disabled/);
  });

  it('should skip auto-disabled plugins in activateAll()', async () => {
    const failing = makeFailingPlugin('test:failing', 5);
    const success = makeSuccessPlugin('test:success');
    manager.register(failing);
    manager.register(success);

    // 让 failing 插件失败 3 次
    for (let i = 0; i < 3; i++) {
      await expect(manager.activate('test:failing')).rejects.toThrow();
    }

    // 创建新 manager 模拟重启，重新注册并 activateAll
    const manager2 = new PluginManager();
    // 复制状态：手动设置 autoDisabled
    manager2.register(failing);
    manager2.register(success);
    const failingReg = manager2.getPlugin('test:failing');
    if (failingReg) {
      failingReg.autoDisabled = true;
      failingReg.failureCount = 3;
      failingReg.state = 'error';
    }

    await manager2.activateAll();
    // failing 插件应保持 error 状态（被跳过）
    expect(manager2.getPlugin('test:failing')?.state).toBe('error');
    // success 插件应被激活
    expect(manager2.getPlugin('test:success')?.state).toBe('active');
  });

  it('should reset failureCount and autoDisabled via resetPlugin()', async () => {
    const plugin = makeFailingPlugin('test:reset', 5);
    manager.register(plugin);

    for (let i = 0; i < 3; i++) {
      await expect(manager.activate('test:reset')).rejects.toThrow();
    }
    expect(manager.getPlugin('test:reset')?.autoDisabled).toBe(true);

    manager.resetPlugin('test:reset');
    const reset = manager.getPlugin('test:reset');
    expect(reset?.failureCount).toBe(0);
    expect(reset?.autoDisabled).toBe(false);
    expect(reset?.lastError).toBeUndefined();
    expect(reset?.error).toBeUndefined();
    // 状态应从 error 转为 inactive
    expect(reset?.state).toBe('inactive');
  });

  it('should reset failureCount on successful activation', async () => {
    // 失败 2 次后第 3 次成功
    const plugin = makeFailingPlugin('test:recover', 2);
    manager.register(plugin);

    await expect(manager.activate('test:recover')).rejects.toThrow();
    await expect(manager.activate('test:recover')).rejects.toThrow();
    expect(manager.getPlugin('test:recover')?.failureCount).toBe(2);

    // 第 3 次成功
    await manager.activate('test:recover');
    const registered = manager.getPlugin('test:recover');
    expect(registered?.state).toBe('active');
    expect(registered?.failureCount).toBe(0);
    expect(registered?.lastError).toBeUndefined();
    expect(registered?.autoDisabled).toBe(false);
  });

  it('should capture error stack when available', async () => {
    const plugin: PluginDefinition = {
      id: 'test:stack',
      name: 'test:stack',
      version: '1.0.0',
      activate() {
        throw new Error('With stack');
      },
    };
    manager.register(plugin);
    await expect(manager.activate('test:stack')).rejects.toThrow();
    const registered = manager.getPlugin('test:stack');
    expect(registered?.lastError?.message).toBe('With stack');
    expect(registered?.lastError?.stack).toBeTruthy();
  });

  it('should handle non-Error throws', async () => {
    const plugin: PluginDefinition = {
      id: 'test:string-throw',
      name: 'test:string-throw',
      version: '1.0.0',
      activate() {
        throw 'string error'; // eslint-disable-line no-throw-literal
      },
    };
    manager.register(plugin);
    await expect(manager.activate('test:string-throw')).rejects.toBe('string error');
    const registered = manager.getPlugin('test:string-throw');
    expect(registered?.failureCount).toBe(1);
    expect(registered?.lastError?.message).toBe('string error');
    expect(registered?.lastError?.stack).toBeUndefined();
  });
});
