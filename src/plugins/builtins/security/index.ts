// src/plugins/builtins/security/index.ts
// Security 内置插件：审计日志 + 凭证迁移 + JVM白名单 + 沙箱 + 文件权限
//
// 注意：加密（AES-256-GCM）和凭证存储的核心实现保留在后端核心中，
// 因为认证模块依赖它。本插件只提供 UI 和管理功能。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const securityPlugin = definePlugin({
  id: 'com.bonnext.security',
  name: 'Security',
  version: '1.0.0',
  description: 'Audit log, credential migration, JVM whitelist, sandbox, and file permissions',

  activate(ctx: PluginContext) {
    // 监听安全相关事件
    ctx.events.on('security:threat-detected', (data) => {
      ctx.logger.warn('Security threat detected', data);
    });

    ctx.events.on('auth:login', (data) => {
      ctx.logger.info('User logged in, recording audit entry', data);
    });

    ctx.logger.info('Security plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default securityPlugin;
