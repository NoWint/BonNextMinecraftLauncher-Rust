import { describe, it, expect } from 'vitest';
import { DependencyResolver } from '../DependencyResolver';
import type { Plugin } from '../types';

const createPlugin = (id: string, deps?: string[]): Plugin => ({
  id,
  name: `Plugin ${id}`,
  version: '1.0.0',
  dependencies: deps?.map((d) => ({ id: d })),
  async activate() {},
  async deactivate() {},
});

describe('DependencyResolver', () => {
  it('should return single plugin with no dependencies', () => {
    const resolver = new DependencyResolver();
    const plugin = createPlugin('a');
    const order = resolver.resolve([plugin]);
    expect(order).toEqual(['a']);
  });

  it('should resolve linear dependency chain', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a');
    const b = createPlugin('b', ['a']);
    const c = createPlugin('c', ['b']);
    const order = resolver.resolve([c, b, a]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('should resolve diamond dependency', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a');
    const b = createPlugin('b', ['a']);
    const c = createPlugin('c', ['a']);
    const d = createPlugin('d', ['b', 'c']);
    const order = resolver.resolve([d, c, b, a]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('should throw on circular dependency', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a', ['b']);
    const b = createPlugin('b', ['a']);
    expect(() => resolver.resolve([a, b])).toThrow(/Circular dependency/);
  });

  it('should throw on missing dependency', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a', ['missing']);
    expect(() => resolver.resolve([a])).toThrow(/Missing dependency/);
  });

  it('should handle independent plugins', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a');
    const b = createPlugin('b');
    const order = resolver.resolve([a, b]);
    expect(order).toContain('a');
    expect(order).toContain('b');
  });
});
