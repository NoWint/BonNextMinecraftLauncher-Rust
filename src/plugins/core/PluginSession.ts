// src/plugins/core/PluginSession.ts
import { invoke } from '@tauri-apps/api/core';

/**
 * 前端插件会话管理：激活时向后端注册并获取 token，
 * deactivate 时撤销。token 传递给所有 plugin_* 命令做后端鉴权。
 */
export class PluginSession {
  private token: string | null = null;

  constructor(
    private readonly pluginId: string,
    private readonly permissions: string[],
  ) {}

  /** 激活时调用：向后端注册会话，获取 token */
  async register(): Promise<void> {
    this.token = await invoke<string>('plugin_register_session', {
      pluginId: this.pluginId,
      permissions: this.permissions,
    });
  }

  /** deactivate 时调用：撤销 token */
  async revoke(): Promise<void> {
    if (this.token) {
      try {
        await invoke('plugin_revoke_session', { token: this.token });
      } catch {
        // 后端可能已不可用，忽略错误
      }
      this.token = null;
    }
  }

  /** 获取当前 token（供 PluginHttpClient/FileSystem/Storage 使用） */
  getToken(): string {
    if (!this.token) {
      throw new Error(`Plugin session not registered for ${this.pluginId}`);
    }
    return this.token;
  }

  isActive(): boolean {
    return this.token !== null;
  }
}
