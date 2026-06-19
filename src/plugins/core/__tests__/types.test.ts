// src/plugins/core/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import type { PluginDefinition, PluginContext, SidebarItem } from '../types';

describe('Plugin types', () => {
  it('PluginDefinition should accept correct shape', () => {
    const def: PluginDefinition = {
      id: 'com.test.plugin',
      name: 'Test',
      version: '1.0.0',
      activate: (_ctx: PluginContext) => {},
    };
    expect(def.id).toBe('com.test.plugin');
  });

  it('SidebarItem should have pluginId', () => {
    const item: SidebarItem = {
      id: 'test',
      label: 'Test',
      icon: '🧪',
      route: '/test',
      order: 1,
      pluginId: 'com.test.plugin',
    };
    expect(item.pluginId).toBe('com.test.plugin');
  });
});
