// src/plugins/core/__tests__/EventBus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../EventBus';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', { foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('should return unsubscribe function', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('test:event', handler);
    unsub();
    bus.emit('test:event', null);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple handlers for same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test:event', h1);
    bus.on('test:event', h2);
    bus.emit('test:event', null);
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('should not throw when emitting event with no handlers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('unheard:event', null)).not.toThrow();
  });
});
