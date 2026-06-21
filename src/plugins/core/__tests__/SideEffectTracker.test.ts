import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SideEffectTracker } from '../SideEffectTracker';

describe('SideEffectTracker', () => {
  let tracker: SideEffectTracker;

  beforeEach(() => {
    tracker = new SideEffectTracker();
  });

  it('should track and clean up setInterval', () => {
    const handler = vi.fn();
    const id = tracker.setInterval(handler, 100);
    expect(id).toBeDefined();

    tracker.cleanup();

    // 等待一段时间确认 interval 已清除
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(handler).not.toHaveBeenCalled();
        resolve();
      }, 150);
    });
  });

  it('should track and clean up setTimeout', () => {
    const handler = vi.fn();
    const id = tracker.setTimeout(handler, 100);
    expect(id).toBeDefined();

    tracker.cleanup();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(handler).not.toHaveBeenCalled();
        resolve();
      }, 150);
    });
  });

  it('should track and clean up addEventListener', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    tracker.addEventListener(target, 'test-event', handler);

    tracker.cleanup();

    target.dispatchEvent(new Event('test-event'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should track and clean up subscribeStore', () => {
    const unsubscribe = vi.fn();
    tracker.subscribeStore(unsubscribe);

    tracker.cleanup();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should track and clean up mountPortal', () => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    expect(document.body.contains(node)).toBe(true);

    tracker.mountPortal(node);
    tracker.cleanup();

    expect(document.body.contains(node)).toBe(false);
  });

  it('should track and clean up custom cleanup via track()', () => {
    const cleanup = vi.fn();
    tracker.track(cleanup);

    tracker.cleanup();

    expect(cleanup).toHaveBeenCalled();
  });

  it('should clean up in LIFO order', () => {
    const order: number[] = [];
    tracker.track(() => order.push(1));
    tracker.track(() => order.push(2));
    tracker.track(() => order.push(3));

    tracker.cleanup();

    expect(order).toEqual([3, 2, 1]);
  });

  it('should continue cleanup even if one cleanup throws', () => {
    const cleanup1 = vi.fn().mockImplementation(() => {
      throw new Error('cleanup error');
    });
    const cleanup2 = vi.fn();
    tracker.track(cleanup1);
    tracker.track(cleanup2);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    tracker.cleanup();
    errorSpy.mockRestore();

    expect(cleanup1).toHaveBeenCalled();
    expect(cleanup2).toHaveBeenCalled();
  });

  it('should report correct size', () => {
    expect(tracker.size).toBe(0);
    tracker.track(() => {});
    tracker.track(() => {});
    expect(tracker.size).toBe(2);
    tracker.cleanup();
    expect(tracker.size).toBe(0);
  });

  it('should handle multiple side effects of different types', () => {
    const intervalHandler = vi.fn();
    const timeoutHandler = vi.fn();
    const eventHandler = vi.fn();
    const unsubStore = vi.fn();

    const target = new EventTarget();

    tracker.setInterval(intervalHandler, 1000);
    tracker.setTimeout(timeoutHandler, 1000);
    tracker.addEventListener(target, 'evt', eventHandler);
    tracker.subscribeStore(unsubStore);

    expect(tracker.size).toBe(4);

    tracker.cleanup();

    expect(tracker.size).toBe(0);
    expect(unsubStore).toHaveBeenCalled();

    // 确认 event listener 已移除
    target.dispatchEvent(new Event('evt'));
    expect(eventHandler).not.toHaveBeenCalled();
  });
});
