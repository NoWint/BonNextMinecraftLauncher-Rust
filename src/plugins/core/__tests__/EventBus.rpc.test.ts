import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../EventBus';

describe('EventBus RPC', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should handle request and return response', async () => {
    bus.handleRequest('test:echo', (data) => `echo: ${data}`, 'plugin-a');
    const result = await bus.request<string>('test:echo', 'hello', 1000, 'plugin-b');
    expect(result).toBe('echo: hello');
  });

  it('should support async handlers', async () => {
    bus.handleRequest('test:async', async (data) => {
      await new Promise((r) => setTimeout(r, 10));
      return { processed: data };
    }, 'plugin-a');
    const result = await bus.request<{ processed: string }>('test:async', 'data', 1000);
    expect(result.processed).toBe('data');
  });

  it('should reject when no handler registered', async () => {
    await expect(bus.request('test:no-handler', null, 100)).rejects.toThrow(
      /No handler registered/,
    );
  });

  it('should timeout when handler does not respond', async () => {
    // 注册一个永不返回的 handler
    bus.handleRequest('test:slow', () => new Promise(() => {}), 'plugin-a');
    await expect(bus.request('test:slow', null, 50)).rejects.toThrow(/timed out/);
  });

  it('should propagate handler errors', async () => {
    bus.handleRequest('test:error', () => {
      throw new Error('handler boom');
    }, 'plugin-a');
    await expect(bus.request('test:error', null, 1000)).rejects.toThrow(/handler boom/);
  });

  it('should propagate async handler errors', async () => {
    bus.handleRequest('test:async-error', async () => {
      throw new Error('async boom');
    }, 'plugin-a');
    await expect(bus.request('test:async-error', null, 1000)).rejects.toThrow(/async boom/);
  });

  it('should only use first handler when multiple registered', async () => {
    bus.handleRequest('test:multi', () => 'first', 'plugin-a');
    bus.handleRequest('test:multi', () => 'second', 'plugin-b');
    const result = await bus.request<string>('test:multi', null, 1000);
    // 第一个 handler 的返回值作为响应
    expect(result).toBe('first');
  });

  it('should support concurrent requests with different correlationIds', async () => {
    bus.handleRequest('test:concurrent', async (data) => {
      const delay = (data as { delay: number }).delay;
      await new Promise((r) => setTimeout(r, delay));
      return `done-${delay}`;
    }, 'plugin-a');

    const [r1, r2] = await Promise.all([
      bus.request<string>('test:concurrent', { delay: 20 }, 1000),
      bus.request<string>('test:concurrent', { delay: 10 }, 1000),
    ]);
    expect(r1).toBe('done-20');
    expect(r2).toBe('done-10');
  });

  it('should clean up pending requests on clear()', async () => {
    bus.handleRequest('test:clear', () => new Promise(() => {}), 'plugin-a');
    const promise = bus.request('test:clear', null, 5000);
    bus.clear();
    await expect(promise).rejects.toThrow(/EventBus cleared/);
  });

  it('should remove handlers by plugin id', async () => {
    bus.handleRequest('test:cleanup', () => 'result', 'plugin-a');
    bus.removePluginListeners('plugin-a');
    await expect(bus.request('test:cleanup', null, 100)).rejects.toThrow(
      /No handler registered/,
    );
  });

  it('should handle complex data types', async () => {
    bus.handleRequest('test:complex', (data) => {
      const req = data as { items: number[] };
      return { sum: req.items.reduce((a, b) => a + b, 0), count: req.items.length };
    }, 'plugin-a');
    const result = await bus.request<{ sum: number; count: number }>(
      'test:complex',
      { items: [1, 2, 3, 4, 5] },
      1000,
    );
    expect(result.sum).toBe(15);
    expect(result.count).toBe(5);
  });

  it('should return unsubscribe function from handleRequest', async () => {
    const unsub = bus.handleRequest('test:unsub', () => 'result', 'plugin-a');
    expect(typeof unsub).toBe('function');
    unsub();
    await expect(bus.request('test:unsub', null, 100)).rejects.toThrow(
      /No handler registered/,
    );
  });
});
