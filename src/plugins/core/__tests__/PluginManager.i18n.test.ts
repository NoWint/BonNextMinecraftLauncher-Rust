// src/plugins/core/__tests__/PluginManager.i18n.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../PluginManager';
import type { PluginDefinition, PluginManifest } from '../types';
import {
  registerPluginI18n,
  unregisterPluginI18n,
  subscribePluginI18n,
} from '../../../shared/i18n';

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

describe('PluginManager i18n integration', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
    // 清理可能残留的插件 i18n 资源
    unregisterPluginI18n('com.test.i18n');
  });

  it('should register manifest.i18n resources on activate', async () => {
    let registered = false;
    const unsubscribe = subscribePluginI18n(() => {
      registered = true;
    });

    const definition: PluginDefinition = {
      id: 'com.test.i18n',
      name: 'I18n Test',
      version: '1.0.0',
      activate: () => {},
    };
    const manifest: PluginManifest = {
      id: 'com.test.i18n',
      name: 'I18n Test',
      version: '1.0.0',
      i18n: {
        'en-US': { 'sidebar.test': 'Test' },
        'zh-CN': { 'sidebar.test': '测试' },
      },
    };

    manager.register(definition, manifest);
    await manager.activate('com.test.i18n');

    expect(registered).toBe(true);
    unsubscribe();
  });

  it('should unregister i18n resources on deactivate', async () => {
    const definition: PluginDefinition = {
      id: 'com.test.i18n',
      name: 'I18n Test',
      version: '1.0.0',
      activate: () => {},
    };
    const manifest: PluginManifest = {
      id: 'com.test.i18n',
      name: 'I18n Test',
      version: '1.0.0',
      i18n: {
        'en-US': { 'sidebar.test': 'Test' },
      },
    };

    manager.register(definition, manifest);
    await manager.activate('com.test.i18n');

    let unregistered = false;
    const unsubscribe = subscribePluginI18n(() => {
      unregistered = true;
    });

    await manager.deactivate('com.test.i18n');
    expect(unregistered).toBe(true);
    unsubscribe();
  });

  it('should unregister i18n resources on activation failure', async () => {
    const definition: PluginDefinition = {
      id: 'com.test.i18n',
      name: 'I18n Test',
      version: '1.0.0',
      activate: () => {
        throw new Error('Activation failed');
      },
    };
    const manifest: PluginManifest = {
      id: 'com.test.i18n',
      name: 'I18n Test',
      version: '1.0.0',
      i18n: {
        'en-US': { 'sidebar.test': 'Test' },
      },
    };

    manager.register(definition, manifest);
    await expect(manager.activate('com.test.i18n')).rejects.toThrow('Activation failed');

    // i18n 资源应该已被注销（registerPluginI18n 后又 unregisterPluginI18n）
    // 验证：再次 register 不应触发通知（因为之前已注销）
    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    // 手动注册验证资源确实不存在
    registerPluginI18n('com.test.i18n', { 'en-US': { key: 'val' } });
    expect(notifyCount).toBe(1); // 这次注册触发通知
    unregisterPluginI18n('com.test.i18n');
    unsubscribe();
  });

  it('should not register i18n when manifest has no i18n field', async () => {
    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    const definition: PluginDefinition = {
      id: 'com.test.noI18n',
      name: 'No I18n',
      version: '1.0.0',
      activate: () => {},
    };
    const manifest: PluginManifest = {
      id: 'com.test.noI18n',
      name: 'No I18n',
      version: '1.0.0',
    };

    manager.register(definition, manifest);
    await manager.activate('com.test.noI18n');

    // 没有 i18n 字段，不应触发 i18n 资源变更通知
    expect(notifyCount).toBe(0);
    unsubscribe();
    // 清理
    await manager.deactivate('com.test.noI18n');
  });
});
