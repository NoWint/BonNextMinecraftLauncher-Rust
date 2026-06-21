// src/plugins/core/SideEffectTracker.ts

/**
 * 插件副作用追踪器。
 *
 * 追踪插件通过 ctx 受控 API 注册的副作用（timer、event listener、DOM node、store subscription），
 * 在插件 deactivate 时自动清理，避免内存泄漏。
 *
 * 插件作者使用 ctx.setInterval / ctx.setTimeout / ctx.addEventListener 等受控 API，
 * 而非原生 setInterval / setTimeout / addEventListener，即可获得自动清理能力。
 */
export class SideEffectTracker {
  /** 清理函数列表，按注册顺序逆序执行（LIFO） */
  private cleanupFns: (() => void)[] = [];

  /**
   * 注册一个清理函数。
   * @returns 传入的清理函数（便于手动调用）
   */
  track(cleanupFn: () => void): () => void {
    this.cleanupFns.push(cleanupFn);
    return cleanupFn;
  }

  /**
   * 追踪一个 interval timer。
   * 返回的 timer ID 与原生 setInterval 一致，但 deactivate 时会自动 clearInterval。
   */
  setInterval(handler: () => void, timeout: number): ReturnType<typeof setInterval> {
    const id = setInterval(handler, timeout);
    this.cleanupFns.push(() => clearInterval(id));
    return id;
  }

  /**
   * 追踪一个 timeout timer。
   * 返回的 timer ID 与原生 setTimeout 一致，但 deactivate 时会自动 clearTimeout。
   * 注意：如果 timeout 已执行，clearTimeout 是 no-op，安全。
   */
  setTimeout(handler: () => void, timeout: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(handler, timeout);
    this.cleanupFns.push(() => clearTimeout(id));
    return id;
  }

  /**
   * 追踪一个 event listener。
   * 参数与原生 addEventListener 一致，deactivate 时自动 removeEventListener。
   */
  addEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.cleanupFns.push(() => target.removeEventListener(type, listener, options));
  }

  /**
   * 追踪一个 store 订阅（如 useSyncExternalStore 的 subscribe 函数返回的 unsubscribe）。
   * @param unsubscribe 订阅时返回的取消订阅函数
   */
  subscribeStore(unsubscribe: () => void): () => void {
    this.cleanupFns.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * 追踪一个 DOM 节点（挂载到 document.body 的 portal 容器等）。
   * deactivate 时自动从父节点移除。
   */
  mountPortal(node: HTMLElement): void {
    // 假设 node 已被挂载到 DOM
    this.cleanupFns.push(() => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  /**
   * 执行所有清理函数（LIFO 顺序）。
   * 每个清理函数的错误被捕获并记录，不中断后续清理。
   */
  cleanup(): void {
    // LIFO：后注册的先清理（与 React useEffect 清理顺序一致）
    while (this.cleanupFns.length > 0) {
      const fn = this.cleanupFns.pop()!;
      try {
        fn();
      } catch (e) {
        console.error('[SideEffectTracker] Cleanup error:', e);
      }
    }
  }

  /** 获取已注册的清理函数数量（测试用） */
  get size(): number {
    return this.cleanupFns.length;
  }
}
