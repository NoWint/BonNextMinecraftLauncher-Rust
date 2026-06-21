import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxHost } from '../SandboxHost';
import type { PluginContext } from '../types';
import type { SandboxRpcRequest } from '../SandboxProtocol';

// Mock document.createElement and window.addEventListener
function setupIframeMock() {
  const iframe = {
    setAttribute: vi.fn(),
    style: {} as { display?: string },
    srcdoc: '',
    contentWindow: {
      postMessage: vi.fn(),
    },
    parentNode: null as unknown,
  };
  const appendChild = vi.fn();
  const removeChild = vi.fn();
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  vi.spyOn(document, 'createElement').mockReturnValue(iframe as never);
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    iframe.parentNode = document.body;
    appendChild(node);
    return node;
  });
  vi.spyOn(document.body, 'removeChild').mockImplementation((node) => {
    iframe.parentNode = null;
    removeChild(node);
    return node;
  });
  vi.spyOn(window, 'addEventListener').mockImplementation(addEventListener);
  vi.spyOn(window, 'removeEventListener').mockImplementation(removeEventListener);

  return { iframe, addEventListener, removeEventListener };
}

function createMockCtx(): PluginContext {
  return {
    pluginId: 'test',
    invoke: vi.fn().mockResolvedValue('invoke-result'),
    http: {
      get: vi.fn().mockResolvedValue({ data: 'get' }),
      post: vi.fn().mockResolvedValue({ data: 'post' }),
    },
    fs: {
      readFile: vi.fn().mockResolvedValue('file-content'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readDir: vi.fn().mockResolvedValue(['a.txt']),
      exists: vi.fn().mockResolvedValue(true),
    },
    events: {
      on: vi.fn().mockReturnValue(() => {}),
      emit: vi.fn(),
    },
    storage: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    provide: vi.fn(),
    consume: vi.fn().mockReturnValue(undefined),
    requestService: vi.fn().mockResolvedValue(undefined),
    registerRoute: vi.fn(),
    addSidebarItem: vi.fn(),
    addSettingsSection: vi.fn(),
    addContextMenuItem: vi.fn(),
    addInstanceTab: vi.fn(),
    registerTheme: vi.fn(),
  } as never;
}

describe('SandboxHost', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create iframe with sandbox="allow-scripts" and display:none', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source code', []);

    // 启动 activate 但不 await（需要手动触发 ready）
    const activatePromise = host.activate(ctx);

    // iframe 应已创建
    expect(iframe.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-scripts');
    expect(iframe.style.display).toBe('none');
    expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

    // 模拟 iframe 发送 ready
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);

    // 等待 load 消息发送
    await new Promise((r) => setTimeout(r, 10));

    // 应发送 load 消息
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'load', pluginId: 'test-plugin' }),
      '*',
    );

    // 模拟 activated
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;
  });

  it('should reject activate on error message from iframe', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);

    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));

    msgListener({
      source: iframe.contentWindow,
      data: { kind: 'error', message: 'Plugin failed to load' },
    } as never);

    await expect(activatePromise).rejects.toThrow('Plugin failed to load');
  });

  it('should dispatch RPC invoke to ctx.invoke', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;

    // 模拟 iframe 发送 RPC 请求
    const rpcReq: SandboxRpcRequest = {
      kind: 'rpc',
      id: 'rpc-1',
      method: 'invoke',
      args: ['some_command', { arg: 1 }],
    };
    msgListener({ source: iframe.contentWindow, data: rpcReq } as never);

    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.invoke).toHaveBeenCalledWith('some_command', { arg: 1 });
    // 应发送 RPC 响应
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rpc-response',
        id: 'rpc-1',
        ok: true,
        result: 'invoke-result',
      }),
      '*',
    );
  });

  it('should dispatch RPC http-get to ctx.http.get', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;

    msgListener({
      source: iframe.contentWindow,
      data: { kind: 'rpc', id: 'rpc-2', method: 'http-get', args: ['https://example.com', null] },
    } as never);

    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.http.get).toHaveBeenCalledWith('https://example.com', null);
  });

  it('should dispatch RPC storage-set to ctx.storage.set', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;

    msgListener({
      source: iframe.contentWindow,
      data: { kind: 'rpc', id: 'rpc-3', method: 'storage-set', args: ['key', { value: 42 }] },
    } as never);

    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.storage.set).toHaveBeenCalledWith('key', { value: 42 });
  });

  it('should send rpc-response with ok=false on dispatch error', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    (ctx.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invoke failed'));
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;

    msgListener({
      source: iframe.contentWindow,
      data: { kind: 'rpc', id: 'rpc-err', method: 'invoke', args: ['cmd'] },
    } as never);

    await new Promise((r) => setTimeout(r, 10));
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'rpc-response',
        id: 'rpc-err',
        ok: false,
        error: 'invoke failed',
      }),
      '*',
    );
  });

  it('should ignore messages from non-iframe sources', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;

    // 发送 ready 但 source 不匹配
    msgListener({ source: window, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));

    // 不应发送 load 消息（ready 未触发）
    expect(iframe.contentWindow.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'load' }),
      '*',
    );

    // 用正确 source 触发 ready
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;
  });

  it('should send deactivate message and cleanup on deactivate()', async () => {
    const { iframe, addEventListener, removeEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;

    const deactivatePromise = host.deactivate();
    await new Promise((r) => setTimeout(r, 10));

    // 应发送 deactivate 消息
    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'deactivate' }),
      '*',
    );

    // 模拟 iframe 响应 deactivated
    msgListener({ source: iframe.contentWindow, data: { kind: 'deactivated' } } as never);
    await deactivatePromise;

    // 应移除事件监听和 iframe
    expect(removeEventListener).toHaveBeenCalled();
  });

  it('should push events to iframe', async () => {
    const { iframe, addEventListener } = setupIframeMock();
    const ctx = createMockCtx();
    const host = new SandboxHost('test-plugin', 'source', []);

    const activatePromise = host.activate(ctx);
    const msgListener = addEventListener.mock.calls[0][1] as (e: MessageEvent) => void;
    msgListener({ source: iframe.contentWindow, data: { kind: 'ready' } } as never);
    await new Promise((r) => setTimeout(r, 10));
    msgListener({ source: iframe.contentWindow, data: { kind: 'activated' } } as never);
    await activatePromise;

    host.pushEvent('test:event', { payload: 123 });

    expect(iframe.contentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'event-push',
        event: 'test:event',
        data: { payload: 123 },
      }),
      '*',
    );
  });
});
