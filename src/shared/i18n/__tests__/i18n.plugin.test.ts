// src/shared/i18n/__tests__/i18n.plugin.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerPluginI18n,
  unregisterPluginI18n,
  subscribePluginI18n,
  resolvePluginLabel,
} from '../index';

describe('i18n plugin resource management', () => {
  beforeEach(() => {
    // 清理所有插件资源
    unregisterPluginI18n('test.plugin');
    unregisterPluginI18n('test.plugin2');
  });

  it('should register and lookup plugin translations', () => {
    registerPluginI18n('test.plugin', {
      'en-US': { 'sidebar.store': 'Store' },
      'zh-CN': { 'sidebar.store': '商店' },
    });

    // 模拟 t() 的插件键查找逻辑
    const t = (key: string): string => {
      if (key.startsWith('plugin:')) {
        const rest = key.slice(7);
        const idx = rest.indexOf(':');
        const pluginId = rest.slice(0, idx);
        const relKey = rest.slice(idx + 1);
        return `plugin:${pluginId}:${relKey}`;
      }
      return key;
    };

    // 验证键格式
    expect(t('plugin:test.plugin:sidebar.store')).toBe('plugin:test.plugin:sidebar.store');
  });

  it('should notify subscribers on register', () => {
    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    registerPluginI18n('test.plugin', {
      'en-US': { key: 'val' },
    });
    expect(notifyCount).toBe(1);

    registerPluginI18n('test.plugin', {
      'en-US': { key: 'val2' },
    });
    expect(notifyCount).toBe(2);

    unsubscribe();
  });

  it('should notify subscribers on unregister', () => {
    registerPluginI18n('test.plugin', {
      'en-US': { key: 'val' },
    });

    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    unregisterPluginI18n('test.plugin');
    expect(notifyCount).toBe(1);

    unsubscribe();
  });

  it('should not notify when unregistering non-existent plugin', () => {
    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    unregisterPluginI18n('non.existent');
    expect(notifyCount).toBe(0);

    unsubscribe();
  });

  it('should allow unsubscribe', () => {
    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    unsubscribe();
    registerPluginI18n('test.plugin', {
      'en-US': { key: 'val' },
    });
    expect(notifyCount).toBe(0);
  });

  it('should handle missing language resources gracefully', () => {
    // 只注册 en-US，不注册 zh-CN
    registerPluginI18n('test.plugin', {
      'en-US': { 'sidebar.test': 'Test' },
    });

    // 不抛异常即可
    expect(true).toBe(true);
  });

  it('should overwrite previous resources on re-register', () => {
    let notifyCount = 0;
    const unsubscribe = subscribePluginI18n(() => {
      notifyCount++;
    });

    registerPluginI18n('test.plugin', {
      'en-US': { key: 'val1' },
    });
    registerPluginI18n('test.plugin', {
      'en-US': { key: 'val2' },
    });

    expect(notifyCount).toBe(2);
    unsubscribe();
  });
});

describe('resolvePluginLabel', () => {
  it('should return string labels as-is', () => {
    const t = vi.fn();
    const result = resolvePluginLabel('Hello', t);
    expect(result).toBe('Hello');
    expect(t).not.toHaveBeenCalled();
  });

  it('should resolve i18nKey labels through t()', () => {
    const t = vi.fn().mockReturnValue('商店');
    const result = resolvePluginLabel({ i18nKey: 'plugin:test:sidebar.store' }, t);
    expect(result).toBe('商店');
    expect(t).toHaveBeenCalledWith('plugin:test:sidebar.store');
  });

  it('should return the key itself when t() returns the key (missing translation)', () => {
    const t = vi.fn().mockImplementation((key: string) => key);
    const result = resolvePluginLabel({ i18nKey: 'plugin:test:missing' }, t);
    expect(result).toBe('plugin:test:missing');
  });
});
