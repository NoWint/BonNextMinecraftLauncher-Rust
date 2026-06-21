// src/plugins/core/SandboxHost.ts
import type { PluginContext } from './types';
import { type SandboxMessage, type SandboxRpcRequest } from './SandboxProtocol';
import { SANDBOX_BOOTSTRAP_HTML } from './SandboxBootstrap';

/**
 * 沙箱宿主：管理一个 iframe 并代理 PluginContext 操作。
 *
 * 生命周期：
 * 1. constructor(pluginId, pluginSource, permissions)
 * 2. activate(ctx) — 创建 iframe，等待 ready，发送 load，等待 activated/error
 * 3. 期间持续处理来自 iframe 的 RPC 请求
 * 4. deactivate() — 发送 deactivate 消息，等待 deactivated，移除 iframe
 */
export class SandboxHost {
  private iframe: HTMLIFrameElement | null = null;
  private pendingRpc = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private activatedPromise: Promise<void> | null = null;
  private activatedResolve: (() => void) | null = null;
  private activatedReject: ((e: Error) => void) | null = null;
  private deactivatedPromise: Promise<void> | null = null;
  private deactivatedResolve: (() => void) | null = null;
  private messageListener: ((e: MessageEvent) => void) | null = null;
  private ctx: PluginContext | null = null;

  constructor(
    private readonly pluginId: string,
    private readonly pluginSource: string,
    private readonly permissions: string[],
  ) {}

  /**
   * 创建 iframe 并激活沙箱插件。
   * 调用方需传入真实 PluginContext（由 PluginManager 构造）。
   */
  async activate(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;

    // 创建 iframe
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('sandbox', 'allow-scripts');
    this.iframe.style.display = 'none';
    this.iframe.srcdoc = SANDBOX_BOOTSTRAP_HTML;

    // 准备 ready/activated Promise
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
    this.activatedPromise = new Promise<void>((resolve, reject) => {
      this.activatedResolve = resolve;
      this.activatedReject = reject;
    });

    // 监听 iframe 消息
    this.messageListener = (e: MessageEvent) => this.handleMessage(e);
    window.addEventListener('message', this.messageListener);

    // 挂载 iframe
    document.body.appendChild(this.iframe);

    // 等待 ready
    await this.readyPromise;

    // 发送 load 消息
    this.postMessage({
      kind: 'load',
      pluginId: this.pluginId,
      pluginSource: this.pluginSource,
      permissions: this.permissions,
    });

    // 等待 activated 或 error
    await this.activatedPromise;
  }

  /** 停用沙箱插件：发送 deactivate，等待响应，移除 iframe */
  async deactivate(): Promise<void> {
    if (!this.iframe || !this.iframe.contentWindow) return;

    this.deactivatedPromise = new Promise<void>((resolve) => {
      this.deactivatedResolve = resolve;
    });

    this.postMessage({ kind: 'deactivate' });

    // 超时保护 5s
    await Promise.race([
      this.deactivatedPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);

    this.cleanup();
  }

  /** 向 iframe 内部转发事件 */
  pushEvent(event: string, data: unknown): void {
    this.postMessage({ kind: 'event-push', event, data });
  }

  /** 处理来自 iframe 的消息 */
  private handleMessage(e: MessageEvent): void {
    // 安全：只接受来自我们 iframe 的消息
    if (this.iframe && e.source !== this.iframe.contentWindow) return;

    const msg = e.data as SandboxMessage;
    if (!msg || typeof msg !== 'object' || typeof msg.kind !== 'string') return;

    switch (msg.kind) {
      case 'ready':
        this.readyResolve?.();
        break;
      case 'activated':
        this.activatedResolve?.();
        break;
      case 'error':
        this.activatedReject?.(new Error(msg.message));
        break;
      case 'deactivated':
        this.deactivatedResolve?.();
        break;
      case 'rpc':
        void this.handleRpc(msg);
        break;
      case 'rpc-response':
        // iframe 不会向 host 发 rpc-response（只有 host → iframe）
        break;
      // event-push 是 host → guest 方向，这里不应收到
    }
  }

  /** 处理来自 iframe 的 RPC 请求 */
  private async handleRpc(req: SandboxRpcRequest): Promise<void> {
    if (!this.ctx) {
      this.sendRpcResponse(req.id, false, undefined, 'PluginContext not available');
      return;
    }
    try {
      const result = await this.dispatchRpc(req.method, req.args);
      this.sendRpcResponse(req.id, true, result);
    } catch (e) {
      this.sendRpcResponse(req.id, false, undefined, e instanceof Error ? e.message : String(e));
    }
  }

  /** 把 RPC 方法分发到真实 PluginContext */
  private async dispatchRpc(method: string, args: unknown[]): Promise<unknown> {
    const ctx = this.ctx!;
    switch (method) {
      case 'invoke':
        return ctx.invoke(args[0] as string, args[1] as Record<string, unknown> | undefined);
      case 'http-get':
        return ctx.http.get(args[0] as string, args[1] as { params?: Record<string, string>; headers?: Record<string, string> } | undefined);
      case 'http-post':
        return ctx.http.post(args[0] as string, args[1], args[2] as { headers?: Record<string, string> } | undefined);
      case 'fs-read':
        return ctx.fs.readFile(args[0] as string);
      case 'fs-write':
        return ctx.fs.writeFile(args[0] as string, args[1] as string);
      case 'fs-exists':
        return ctx.fs.exists(args[0] as string);
      case 'fs-readdir':
        return ctx.fs.readDir(args[0] as string);
      case 'storage-get':
        return ctx.storage.get(args[0] as string);
      case 'storage-set':
        return ctx.storage.set(args[0] as string, args[1]);
      case 'storage-delete':
        return ctx.storage.delete(args[0] as string);
      case 'log-info':
        ctx.logger.info(args[0] as string);
        return undefined;
      case 'log-warn':
        ctx.logger.warn(args[0] as string);
        return undefined;
      case 'log-error':
        ctx.logger.error(args[0] as string);
        return undefined;
      case 'emit-event':
        ctx.events.emit(args[0] as string, args[1]);
        return undefined;
      case 'provide-service':
        // sandbox 插件提供的服务：factory 无法跨 iframe 传递
        // host 侧注册一个占位 factory，consume 时返回错误
        ctx.provide(args[0] as string, () => {
          throw new Error('Service provided by sandboxed plugin cannot be called from host');
        });
        return undefined;
      case 'consume-service':
        return ctx.consume(args[0] as string);
      case 'request-service':
        return ctx.requestService(args[0] as string, args[1] as number | undefined);
      case 'register-route':
        // sandbox 插件无法渲染 React 组件到主窗口
        // 注册一个占位组件（显示"sandboxed plugin"提示）
        ctx.registerRoute(args[0] as string, () => Promise.resolve({
          default: () => null, // 实际渲染由 host 侧占位处理
        }));
        return undefined;
      case 'add-sidebar-item':
        ctx.addSidebarItem(args[0] as never);
        return undefined;
      case 'add-settings-section':
        ctx.addSettingsSection(args[0] as never);
        return undefined;
      case 'add-context-menu-item':
        ctx.addContextMenuItem(args[0] as never);
        return undefined;
      case 'add-instance-tab':
        ctx.addInstanceTab(args[0] as never);
        return undefined;
      case 'register-theme':
        ctx.registerTheme(args[0] as never);
        return undefined;
      default:
        throw new Error(`Unknown RPC method: ${method}`);
    }
  }

  /** 发送 RPC 响应到 iframe */
  private sendRpcResponse(id: string, ok: boolean, result?: unknown, error?: string): void {
    this.postMessage({ kind: 'rpc-response', id, ok, result, error });
  }

  /** 向 iframe 发送消息 */
  private postMessage(msg: SandboxMessage): void {
    this.iframe?.contentWindow?.postMessage(msg, '*');
  }

  /** 清理 iframe 和事件监听 */
  private cleanup(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.ctx = null;
    // 拒绝所有 pending RPC
    for (const [, { reject }] of this.pendingRpc) {
      reject(new Error('Sandbox deactivated'));
    }
    this.pendingRpc.clear();
  }
}
