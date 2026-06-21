// src/plugins/core/EventBus.ts
import type { PluginEventBus } from './types';

interface HandlerEntry {
  handler: (data: unknown) => void;
  pluginId: string;
}

interface RequestHandlerEntry {
  handler: (data: unknown) => unknown | Promise<unknown>;
  pluginId: string;
}

/** RPC 请求负载（通过内部事件传递） */
interface RpcRequestPayload {
  correlationId: string;
  data: unknown;
  requesterPluginId: string;
}

/** RPC 响应负载（通过内部事件传递） */
interface RpcResponsePayload {
  correlationId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export class EventBus implements PluginEventBus {
  private handlers = new Map<string, Set<HandlerEntry>>();
  private requestHandlers = new Map<string, Set<RequestHandlerEntry>>();
  /** pending RPC 请求的 resolver：correlationId → { resolve, reject, timer } */
  private pendingRequests = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  on(event: string, handler: (data: unknown) => void, pluginId?: string): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const entry: HandlerEntry = { handler, pluginId: pluginId ?? '' };
    this.handlers.get(event)!.add(entry);
    return () => {
      this.handlers.get(event)?.delete(entry);
    };
  }

  emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((entry) => {
      try {
        entry.handler(data);
      } catch (e) {
        console.error(`[EventBus] Handler error for event "${event}":`, e);
      }
    });
  }

  /**
   * 注册 RPC 请求处理器。
   *
   * @param requestType 请求类型，应包含命名空间前缀（如 "plugin-a:get-status"）
   * @param handler 处理函数，接收请求数据，返回响应（支持 async）
   * @param pluginId 注册者插件 ID（用于 deactivate 时清理）
   * @returns 取消注册函数
   */
  handleRequest(
    requestType: string,
    handler: (data: unknown) => unknown | Promise<unknown>,
    pluginId?: string,
  ): () => void {
    if (!this.requestHandlers.has(requestType)) {
      this.requestHandlers.set(requestType, new Set());
    }
    const entry: RequestHandlerEntry = { handler, pluginId: pluginId ?? '' };
    this.requestHandlers.get(requestType)!.add(entry);

    // 同时注册一个内部事件监听器，处理传入的 RPC 请求
    const internalEvent = `rpc:request:${requestType}`;
    const internalHandler = (payload: unknown) => {
      const req = payload as RpcRequestPayload;
      this.handleIncomingRequest(requestType, req).catch((e) => {
        console.error(`[EventBus] RPC handler error for "${requestType}":`, e);
      });
    };
    this.on(internalEvent, internalHandler, pluginId);

    return () => {
      this.requestHandlers.get(requestType)?.delete(entry);
      // 内部事件监听器会通过 removePluginListeners 或手动 unsub 清理
    };
  }

  /**
   * 发送 RPC 请求并等待响应。
   *
   * @param requestType 请求类型（如 "plugin-a:get-status"）
   * @param data 请求数据
   * @param timeoutMs 超时毫秒数，默认 5000
   * @param requesterPluginId 请求方插件 ID（用于调试）
   * @returns 响应数据
   */
  async request<T = unknown>(
    requestType: string,
    data: unknown,
    timeoutMs: number = 5000,
    requesterPluginId?: string,
  ): Promise<T> {
    // 检查是否有 handler 注册
    const handlers = this.requestHandlers.get(requestType);
    if (!handlers || handlers.size === 0) {
      throw new Error(`No handler registered for request type "${requestType}"`);
    }

    const correlationId = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const payload: RpcRequestPayload = {
      correlationId,
      data,
      requesterPluginId: requesterPluginId ?? '',
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`RPC request "${requestType}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(correlationId, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      // 监听响应
      const responseEvent = `rpc:response:${correlationId}`;
      const responseHandler = (resp: unknown) => {
        const r = resp as RpcResponsePayload;
        if (r.correlationId !== correlationId) return;
        const pending = this.pendingRequests.get(correlationId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(correlationId);
          if (r.ok) {
            pending.resolve(r.result);
          } else {
            pending.reject(new Error(r.error ?? 'RPC request failed'));
          }
        }
      };
      this.on(responseEvent, responseHandler, requesterPluginId);

      // 发送请求
      this.emit(`rpc:request:${requestType}`, payload);
    });
  }

  /**
   * 处理传入的 RPC 请求：调用 handler，发送响应。
   */
  private async handleIncomingRequest(
    requestType: string,
    req: RpcRequestPayload,
  ): Promise<void> {
    const handlers = this.requestHandlers.get(requestType);
    if (!handlers || handlers.size === 0) {
      // 无 handler，发送错误响应
      this.emit(`rpc:response:${req.correlationId}`, {
        correlationId: req.correlationId,
        ok: false,
        error: `No handler for "${requestType}"`,
      } as RpcResponsePayload);
      return;
    }

    // 取第一个 handler（多 handler 时只有第一个生效）
    const firstHandler = handlers.values().next().value;
    if (!firstHandler) return;

    try {
      const result = await firstHandler.handler(req.data);
      this.emit(`rpc:response:${req.correlationId}`, {
        correlationId: req.correlationId,
        ok: true,
        result,
      } as RpcResponsePayload);
    } catch (e) {
      this.emit(`rpc:response:${req.correlationId}`, {
        correlationId: req.correlationId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      } as RpcResponsePayload);
    }
  }

  /**
   * Remove all handlers registered by a specific plugin.
   * Called during plugin deactivation to prevent stale subscriptions.
   */
  removePluginListeners(pluginId: string): void {
    // 清理普通事件监听器
    for (const [event, entries] of this.handlers) {
      for (const entry of entries) {
        if (entry.pluginId === pluginId) {
          entries.delete(entry);
        }
      }
      if (entries.size === 0) {
        this.handlers.delete(event);
      }
    }

    // 清理 RPC 请求处理器
    for (const [requestType, entries] of this.requestHandlers) {
      for (const entry of entries) {
        if (entry.pluginId === pluginId) {
          entries.delete(entry);
        }
      }
      if (entries.size === 0) {
        this.requestHandlers.delete(requestType);
      }
    }

    // 拒绝该插件发起的 pending 请求
    for (const [correlationId, pending] of this.pendingRequests) {
      // 注意：pendingRequests 不存储 requesterPluginId，无法精确匹配
      // 这里不做处理，超时会自动 reject
      void correlationId;
      void pending;
    }
  }

  clear(): void {
    this.handlers.clear();
    this.requestHandlers.clear();
    // 拒绝所有 pending 请求
    for (const [, { reject, timer }] of this.pendingRequests) {
      clearTimeout(timer);
      reject(new Error('EventBus cleared'));
    }
    this.pendingRequests.clear();
  }
}
