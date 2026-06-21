import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'plugin_register_session') return Promise.resolve('mock-token');
    if (cmd === 'plugin_revoke_session') return Promise.resolve();
    return Promise.resolve();
  }),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('1.2.3'),
}));

import { PluginManager } from '../PluginManager';
import type { PluginDefinition } from '../types';

function makePlugin(id: string): PluginDefinition {
  return {
    id,
    name: id,
    version: '1.0.0',
    activate() {},
  };
}

describe('PluginManager semver validation', () => {
  let manager: PluginManager;

  beforeEach(async () => {
    manager = new PluginManager();
    // 设置 app version 为 1.2.3
    await manager.initAppVersion();
  });

  it('should accept exact version (backward compat: treated as >=)', async () => {
    manager.register(makePlugin('test:exact'), {
      id: 'test:exact',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '1.2.3',
    });
    await manager.activate('test:exact');
    expect(manager.getPlugin('test:exact')?.state).toBe('active');
  });

  it('should accept caret range ^1.0.0', async () => {
    manager.register(makePlugin('test:caret'), {
      id: 'test:caret',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '^1.0.0',
    });
    await manager.activate('test:caret');
    expect(manager.getPlugin('test:caret')?.state).toBe('active');
  });

  it('should accept tilde range ~1.2.0', async () => {
    manager.register(makePlugin('test:tilde'), {
      id: 'test:tilde',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '~1.2.0',
    });
    await manager.activate('test:tilde');
    expect(manager.getPlugin('test:tilde')?.state).toBe('active');
  });

  it('should accept >= range', async () => {
    manager.register(makePlugin('test:ge'), {
      id: 'test:ge',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '>=1.0.0',
    });
    await manager.activate('test:ge');
    expect(manager.getPlugin('test:ge')?.state).toBe('active');
  });

  it('should accept compound range >=1.0.0 <2.0.0', async () => {
    manager.register(makePlugin('test:compound'), {
      id: 'test:compound',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '>=1.0.0 <2.0.0',
    });
    await manager.activate('test:compound');
    expect(manager.getPlugin('test:compound')?.state).toBe('active');
  });

  it('should accept x-range 1.x', async () => {
    manager.register(makePlugin('test:xrange'), {
      id: 'test:xrange',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '1.x',
    });
    await manager.activate('test:xrange');
    expect(manager.getPlugin('test:xrange')?.state).toBe('active');
  });

  it('should accept star *', async () => {
    manager.register(makePlugin('test:star'), {
      id: 'test:star',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '*',
    });
    await manager.activate('test:star');
    expect(manager.getPlugin('test:star')?.state).toBe('active');
  });

  it('should reject when version too low (bare version)', async () => {
    manager.register(makePlugin('test:too-low'), {
      id: 'test:too-low',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '2.0.0',
    });
    await expect(manager.activate('test:too-low')).rejects.toThrow(/requires app version/);
    expect(manager.getPlugin('test:too-low')?.state).toBe('error');
  });

  it('should reject when caret range not satisfied', async () => {
    manager.register(makePlugin('test:caret-fail'), {
      id: 'test:caret-fail',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '^2.0.0',
    });
    await expect(manager.activate('test:caret-fail')).rejects.toThrow(/requires app version/);
  });

  it('should reject when compound range not satisfied', async () => {
    manager.register(makePlugin('test:compound-fail'), {
      id: 'test:compound-fail',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '>=2.0.0 <3.0.0',
    });
    await expect(manager.activate('test:compound-fail')).rejects.toThrow(/requires app version/);
  });

  it('should reject when upper bound exceeded', async () => {
    manager.register(makePlugin('test:upper'), {
      id: 'test:upper',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '>=1.0.0 <1.2.0',
    });
    await expect(manager.activate('test:upper')).rejects.toThrow(/requires app version/);
  });

  it('should accept prerelease versions with range', async () => {
    // 1.2.3-beta.1 should satisfy ^1.0.0-beta.0
    manager.register(makePlugin('test:prerelease'), {
      id: 'test:prerelease',
      name: 'test',
      version: '1.0.0',
      minAppVersion: '^1.0.0-beta.0',
    });
    await manager.activate('test:prerelease');
    expect(manager.getPlugin('test:prerelease')?.state).toBe('active');
  });
});
