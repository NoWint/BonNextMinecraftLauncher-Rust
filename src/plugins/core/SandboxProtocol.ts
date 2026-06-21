// src/plugins/core/SandboxProtocol.ts

/**
 * iframe 沙箱 postMessage 协议类型定义。
 * 主窗口（host）与 iframe（guest）之间的所有通信都使用这些类型。
 *
 * 协议约定：
 * - 所有消息通过 `window.postMessage(msg, '*')` 发送
 * - host → guest 的消息 targetWindow 为 iframe.contentWindow
 * - guest → host 的消息 targetWindow 为 window.parent
 * - 请求/响应通过 `id` 字段关联
 */

/** 唯一请求 ID 生成（host 侧调用） */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** guest → host 的 RPC 请求（guest 调用 host 的 PluginContext 方法） */
export interface SandboxRpcRequest {
  kind: 'rpc';
  id: string;
  method: SandboxRpcMethod;
  args: unknown[];
}

/** 支持的 RPC 方法列表 */
export type SandboxRpcMethod =
  | 'invoke'
  | 'http-get'
  | 'http-post'
  | 'fs-read'
  | 'fs-write'
  | 'fs-exists'
  | 'fs-readdir'
  | 'storage-get'
  | 'storage-set'
  | 'storage-delete'
  | 'log-info'
  | 'log-warn'
  | 'log-error'
  | 'emit-event'
  | 'provide-service'
  | 'consume-service'
  | 'request-service'
  | 'register-route'
  | 'add-sidebar-item'
  | 'add-settings-section'
  | 'add-context-menu-item'
  | 'add-instance-tab'
  | 'register-theme';

/** host → guest 的 RPC 响应 */
export interface SandboxRpcResponse {
  kind: 'rpc-response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** host → guest 的事件推送（主窗口 emit 事件时转发给 iframe） */
export interface SandboxEventPush {
  kind: 'event-push';
  event: string;
  data: unknown;
}

/** guest → host：iframe bootstrap 就绪，等待加载指令 */
export interface SandboxReadyMessage {
  kind: 'ready';
}

/** host → guest：发送插件源码和元数据，触发加载 */
export interface SandboxLoadMessage {
  kind: 'load';
  pluginId: string;
  pluginSource: string;
  permissions: string[];
}

/** guest → host：插件 activate() 调用完成 */
export interface SandboxActivatedMessage {
  kind: 'activated';
}

/** guest → host：插件 activate() 抛出异常 */
export interface SandboxErrorMessage {
  kind: 'error';
  message: string;
  stack?: string;
}

/** host → guest：要求 iframe 调用 deactivate() */
export interface SandboxDeactivateMessage {
  kind: 'deactivate';
}

/** guest → host：deactivate() 完成 */
export interface SandboxDeactivatedMessage {
  kind: 'deactivated';
}

/** 所有消息的联合类型 */
export type SandboxMessage =
  | SandboxRpcRequest
  | SandboxRpcResponse
  | SandboxEventPush
  | SandboxReadyMessage
  | SandboxLoadMessage
  | SandboxActivatedMessage
  | SandboxErrorMessage
  | SandboxDeactivateMessage
  | SandboxDeactivatedMessage;

/** 类型守卫：判断消息是否为 RPC 请求 */
export function isRpcRequest(msg: SandboxMessage): msg is SandboxRpcRequest {
  return msg.kind === 'rpc';
}

export function isRpcResponse(msg: SandboxMessage): msg is SandboxRpcResponse {
  return msg.kind === 'rpc-response';
}
