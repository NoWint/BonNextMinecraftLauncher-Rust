import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceRegistry } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('should register and consume a service', async () => {
    registry.provide('test:simple', 'plugin-a', () => ({ hello: 'world' }));
    const svc = await registry.consume<{ hello: string }>('test:simple');
    expect(svc?.hello).toBe('world');
  });

  it('should return undefined for unregistered service', async () => {
    const svc = await registry.consume('test:missing');
    expect(svc).toBeUndefined();
  });

  it('should cache instance on first consume (factory called once)', async () => {
    const factory = vi.fn(() => ({ count: 0 }));
    registry.provide('test:cached', 'plugin-a', factory);
    await registry.consume('test:cached');
    await registry.consume('test:cached');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('should support async factory', async () => {
    registry.provide('test:async', 'plugin-a', async () => {
      return new Promise<string>((resolve) => setTimeout(() => resolve('async-result'), 10));
    });
    const svc = await registry.consume<string>('test:async');
    expect(svc).toBe('async-result');
  });

  it('should resolve requestService immediately if service already registered', async () => {
    registry.provide('test:immediate', 'plugin-a', () => 42);
    const result = await registry.requestService<number>('test:immediate');
    expect(result).toBe(42);
  });

  it('should wait for service to be provided via requestService', async () => {
    const promise = registry.requestService<string>('test:delayed', 1000);
    // 模拟另一个插件稍后注册服务
    setTimeout(() => registry.provide('test:delayed', 'plugin-b', () => 'late-result'), 50);
    const result = await promise;
    expect(result).toBe('late-result');
  });

  it('should reject requestService on timeout', async () => {
    await expect(registry.requestService('test:never', 50)).rejects.toThrow(
      /not available within 50ms/,
    );
  });

  it('should unregister services by plugin id', async () => {
    registry.provide('test:a', 'plugin-a', () => 'a');
    registry.provide('test:b', 'plugin-a', () => 'b');
    registry.provide('test:c', 'plugin-b', () => 'c');

    registry.unregisterByPlugin('plugin-a');

    expect(registry.has('test:a')).toBe(false);
    expect(registry.has('test:b')).toBe(false);
    expect(registry.has('test:c')).toBe(true);
  });

  it('should reject pending waiters when registry cleared', async () => {
    const promise = registry.requestService('test:clear', 1000);
    registry.clear();
    await expect(promise).rejects.toThrow(/registry cleared/);
  });

  it('should overwrite and warn on duplicate registration', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.provide('test:dup', 'plugin-a', () => 'first');
    registry.provide('test:dup', 'plugin-b', () => 'second');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    );
    const svc = await registry.consume<string>('test:dup');
    expect(svc).toBe('second');
    warnSpy.mockRestore();
  });

  it('should propagate factory errors', async () => {
    registry.provide('test:throwing', 'plugin-a', () => {
      throw new Error('factory boom');
    });
    await expect(registry.consume('test:throwing')).rejects.toThrow(/factory boom/);
  });

  it('should report provider plugin id', () => {
    registry.provide('test:provider', 'my-plugin', () => null);
    expect(registry.getProvider('test:provider')).toBe('my-plugin');
    expect(registry.getProvider('test:unknown')).toBeUndefined();
  });
});
