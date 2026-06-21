import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExtensionPointRegistry,
  HOME_WIDGET_EP,
  INSTANCE_TAB_EP,
  type HomeWidgetContribution,
} from '../ExtensionPoint';

describe('ExtensionPointRegistry', () => {
  let registry: ExtensionPointRegistry;

  beforeEach(() => {
    registry = new ExtensionPointRegistry();
    registry.declare(HOME_WIDGET_EP);
    registry.declare(INSTANCE_TAB_EP);
  });

  it('should declare extension points', () => {
    expect(registry.isDeclared('home:widget')).toBe(true);
    expect(registry.isDeclared('instance:tab')).toBe(true);
    expect(registry.isDeclared('unknown:ep')).toBe(false);
  });

  it('should accept valid contributions', () => {
    const widget: HomeWidgetContribution = {
      id: 'weather',
      title: 'Weather',
      component: () => Promise.resolve({ default: () => null }),
    };
    registry.contribute('home:widget', 'plugin-a', widget, 10);
    const contributions = registry.getContributions<HomeWidgetContribution>('home:widget');
    expect(contributions).toHaveLength(1);
    expect(contributions[0].value.id).toBe('weather');
    expect(contributions[0].pluginId).toBe('plugin-a');
    expect(contributions[0].order).toBe(10);
  });

  it('should reject contributions that fail validation', () => {
    expect(() => {
      registry.contribute('home:widget', 'plugin-a', { invalid: true } as never);
    }).toThrow(/failed validation/);
  });

  it('should sort contributions by order (ascending)', () => {
    registry.contribute('home:widget', 'plugin-a', {
      id: 'c',
      title: 'C',
      component: () => Promise.resolve({ default: () => null }),
    }, 30);
    registry.contribute('home:widget', 'plugin-b', {
      id: 'a',
      title: 'A',
      component: () => Promise.resolve({ default: () => null }),
    }, 10);
    registry.contribute('home:widget', 'plugin-c', {
      id: 'b',
      title: 'B',
      component: () => Promise.resolve({ default: () => null }),
    }, 20);

    const contributions = registry.getContributions<HomeWidgetContribution>('home:widget');
    expect(contributions.map((c) => c.value.id)).toEqual(['a', 'b', 'c']);
  });

  it('should default order to 100 when not specified', () => {
    registry.contribute('home:widget', 'plugin-a', {
      id: 'no-order',
      title: 'No Order',
      component: () => Promise.resolve({ default: () => null }),
    });
    registry.contribute('home:widget', 'plugin-b', {
      id: 'with-order',
      title: 'With Order',
      component: () => Promise.resolve({ default: () => null }),
    }, 50);

    const contributions = registry.getContributions<HomeWidgetContribution>('home:widget');
    expect(contributions.map((c) => c.value.id)).toEqual(['with-order', 'no-order']);
  });

  it('should remove contributions by plugin id', () => {
    registry.contribute('home:widget', 'plugin-a', {
      id: 'a',
      title: 'A',
      component: () => Promise.resolve({ default: () => null }),
    });
    registry.contribute('home:widget', 'plugin-b', {
      id: 'b',
      title: 'B',
      component: () => Promise.resolve({ default: () => null }),
    });
    registry.contribute('instance:tab', 'plugin-a', {
      id: 'tab-a',
      label: 'Tab A',
      component: () => Promise.resolve({ default: () => null }),
    });

    registry.removeByPlugin('plugin-a');

    expect(registry.getContributions('home:widget')).toHaveLength(1);
    expect(registry.getContributions('home:widget')[0].pluginId).toBe('plugin-b');
    expect(registry.getContributions('instance:tab')).toHaveLength(0);
  });

  it('should notify subscribers on changes', () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.contribute('home:widget', 'plugin-a', {
      id: 'test',
      title: 'Test',
      component: () => Promise.resolve({ default: () => null }),
    });
    expect(listener).toHaveBeenCalledTimes(1);

    registry.removeByPlugin('plugin-a');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('should return cached snapshot when unchanged', () => {
    registry.contribute('home:widget', 'plugin-a', {
      id: 'test',
      title: 'Test',
      component: () => Promise.resolve({ default: () => null }),
    });

    const first = registry.getContributions('home:widget');
    const second = registry.getContributions('home:widget');
    expect(first).toBe(second); // 同一引用（缓存）
  });

  it('should warn but accept contributions to undeclared extension points', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.contribute('undeclared:ep', 'plugin-a', { any: 'value' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('undeclared extension point'),
    );
    expect(registry.getContributions('undeclared:ep')).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it('should clear all state', () => {
    registry.contribute('home:widget', 'plugin-a', {
      id: 'test',
      title: 'Test',
      component: () => Promise.resolve({ default: () => null }),
    });
    registry.clear();
    expect(registry.getContributions('home:widget')).toHaveLength(0);
    expect(registry.isDeclared('home:widget')).toBe(false);
  });

  it('should handle multiple contributions from same plugin', () => {
    registry.contribute('home:widget', 'plugin-a', {
      id: 'widget-1',
      title: 'Widget 1',
      component: () => Promise.resolve({ default: () => null }),
    }, 10);
    registry.contribute('home:widget', 'plugin-a', {
      id: 'widget-2',
      title: 'Widget 2',
      component: () => Promise.resolve({ default: () => null }),
    }, 20);

    const contributions = registry.getContributions<HomeWidgetContribution>('home:widget');
    expect(contributions).toHaveLength(2);
    expect(contributions.every((c) => c.pluginId === 'plugin-a')).toBe(true);
  });
});
