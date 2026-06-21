// src/plugins/core/ServiceRegistry.ts

/**
 * 插件间服务注册表。
 * - 插件通过 ctx.provide(serviceId, factory) 注册服务
 * - 其他插件通过 ctx.consume<T>(serviceId) 获取服务实例
 * - ctx.requestService<T>(serviceId, timeoutMs?) 是 consume 的 Promise 版本，等待服务可用
 * - 插件 deactivate 时自动注销其注册的所有服务
 */

export type ServiceFactory<T = unknown> = () => T | Promise<T>;

interface ServiceEntry {
  providerPluginId: string;
  factory: ServiceFactory;
  /** 缓存的实例（懒加载，首次 consume 时调用 factory） */
  cachedInstance?: unknown;
  /** factory 是否已执行（用于区分 undefined 实例和未执行） */
  initialized: boolean;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceEntry>();
  /** 等待某 serviceId 出现的 pending request resolvers */
  private pendingWaiters = new Map<string, Array<{ resolve: (s: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>>();

  /**
   * 注册一个服务。同 id 重复注册会覆盖并告警。
   */
  provide(serviceId: string, providerPluginId: string, factory: ServiceFactory): void {
    if (this.services.has(serviceId)) {
      console.warn(
        `[ServiceRegistry] Service "${serviceId}" already registered, overwriting (provider: ${providerPluginId})`,
      );
    }
    this.services.set(serviceId, {
      providerPluginId,
      factory,
      initialized: false,
    });

    // 唤醒等待此 serviceId 的 waiter
    const waiters = this.pendingWaiters.get(serviceId);
    if (waiters && waiters.length > 0) {
      this.pendingWaiters.delete(serviceId);
      // 异步触发，避免在 provide 调用栈中执行 consume 逻辑
      queueMicrotask(() => {
        for (const w of waiters) {
          clearTimeout(w.timer);
          this.consumeInternal(serviceId).then(w.resolve).catch(w.reject);
        }
      });
    }
  }

  /**
   * 同步消费一个已注册服务（如果未初始化则调用 factory）。
   * 如果服务未注册，返回 undefined。
   * 如果 factory 是 async，会返回 Promise — 调用方需要处理。
   */
  consume<T>(serviceId: string): T | Promise<T | undefined> | undefined {
    const entry = this.services.get(serviceId);
    if (!entry) return undefined;
    return this.consumeInternal<T>(serviceId);
  }

  private async consumeInternal<T>(serviceId: string): Promise<T | undefined> {
    const entry = this.services.get(serviceId);
    if (!entry) return undefined;
    if (!entry.initialized) {
      try {
        entry.cachedInstance = await entry.factory();
        entry.initialized = true;
      } catch (e) {
        console.error(`[ServiceRegistry] Service factory "${serviceId}" threw:`, e);
        throw new Error(`Service "${serviceId}" factory failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return entry.cachedInstance as T;
  }

  /**
   * 异步等待服务可用，带超时。
   * 如果服务已注册，立即返回实例。
   * 如果未注册，等待 provide() 被调用，最长 timeoutMs。
   */
  async requestService<T>(serviceId: string, timeoutMs: number = 5000): Promise<T> {
    // 先尝试同步消费
    const existing = this.services.get(serviceId);
    if (existing) {
      const instance = await this.consumeInternal<T>(serviceId);
      if (instance === undefined) {
        throw new Error(`Service "${serviceId}" factory returned undefined`);
      }
      return instance;
    }

    // 注册 waiter
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // 从 pending 列表移除
        const waiters = this.pendingWaiters.get(serviceId) ?? [];
        const idx = waiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new Error(`Service "${serviceId}" not available within ${timeoutMs}ms`));
      }, timeoutMs);

      const waiter = { resolve: (s: unknown) => resolve(s as T), reject, timer };
      const list = this.pendingWaiters.get(serviceId) ?? [];
      list.push(waiter);
      this.pendingWaiters.set(serviceId, list);
    });
  }

  /**
   * 注销某插件提供的所有服务（插件 deactivate 时调用）。
   * 已缓存的实例会被丢弃，下次 consume 会重新调用 factory（如果服务被重新注册）。
   */
  unregisterByPlugin(pluginId: string): void {
    for (const [id, entry] of this.services) {
      if (entry.providerPluginId === pluginId) {
        this.services.delete(id);
      }
    }
  }

  /** 检查服务是否已注册（不触发 factory） */
  has(serviceId: string): boolean {
    return this.services.has(serviceId);
  }

  /** 获取服务提供者 pluginId（调试用） */
  getProvider(serviceId: string): string | undefined {
    return this.services.get(serviceId)?.providerPluginId;
  }

  /** 清空所有服务（测试用） */
  clear(): void {
    this.services.clear();
    // 拒绝所有 pending waiter
    for (const [id, waiters] of this.pendingWaiters) {
      for (const w of waiters) {
        clearTimeout(w.timer);
        w.reject(new Error(`Service "${id}" registry cleared`));
      }
    }
    this.pendingWaiters.clear();
  }
}
