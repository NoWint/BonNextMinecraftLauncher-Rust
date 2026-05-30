import { describe, it, expect } from 'vitest';
import type { Plugin, PluginState, PluginManifest } from '../types';

describe('Plugin Types', () => {
  it('should accept valid Plugin objects', () => {
    const plugin: Plugin = {
      id: 'com.bonnext.test',
      name: 'Test Plugin',
      version: '1.0.0',
      async activate() {},
      async deactivate() {},
    };
    expect(plugin.id).toBe('com.bonnext.test');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should accept Plugin with optional fields', () => {
    const plugin: Plugin = {
      id: 'com.bonnext.test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      dependencies: [{ id: 'com.bonnext.core', version: '^1.0.0' }],
      async activate() {},
      async deactivate() {},
    };
    expect(plugin.dependencies).toHaveLength(1);
  });

  it('should enumerate all PluginState values', () => {
    const states: PluginState[] = ['registered', 'activating', 'active', 'deactivating', 'inactive'];
    expect(states).toHaveLength(5);
  });

  it('should accept valid PluginManifest', () => {
    const manifest: PluginManifest = {
      id: 'com.bonnext.test',
      name: 'Test Plugin',
      version: '1.0.0',
      entry: 'index.js',
      dependencies: { 'bonnext:theme': '^1.0.0' },
      permissions: ['theme:read'],
      minAppVersion: '0.0.3',
    };
    expect(manifest.id).toBe('com.bonnext.test');
  });
});
