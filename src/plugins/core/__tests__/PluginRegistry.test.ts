import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../PluginRegistry';
import type { Plugin } from '../types';

const createMockPlugin = (id: string): Plugin => ({
  id,
  name: `Plugin ${id}`,
  version: '1.0.0',
  async activate() {},
  async deactivate() {},
});

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('should register a plugin', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    expect(registry.get('com.test.a')).toBeDefined();
    expect(registry.get('com.test.a')!.plugin.id).toBe('com.test.a');
  });

  it('should silently ignore duplicate registration', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.register(plugin);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should unregister a plugin', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.unregister('com.test.a');
    expect(registry.get('com.test.a')).toBeUndefined();
  });

  it('should track plugin state', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    expect(registry.getState('com.test.a')).toBe('registered');
  });

  it('should transition plugin state', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.setState('com.test.a', 'activating');
    expect(registry.getState('com.test.a')).toBe('activating');
    registry.setState('com.test.a', 'active');
    expect(registry.getState('com.test.a')).toBe('active');
  });

  it('should throw on invalid state transition', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.setState('com.test.a', 'activating');
    registry.setState('com.test.a', 'active');
    expect(() => registry.setState('com.test.a', 'activating')).toThrow(/Invalid transition/);
  });

  it('should list all registered plugins', () => {
    registry.register(createMockPlugin('com.test.a'));
    registry.register(createMockPlugin('com.test.b'));
    expect(registry.getAll()).toHaveLength(2);
  });

  it('should return undefined for unknown plugin', () => {
    expect(registry.get('com.test.unknown')).toBeUndefined();
  });

  it('should return undefined state for unknown plugin', () => {
    expect(registry.getState('com.test.unknown')).toBeUndefined();
  });
});
