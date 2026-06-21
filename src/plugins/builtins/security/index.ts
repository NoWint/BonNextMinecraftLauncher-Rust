// src/plugins/builtins/security/index.ts
// Security 内置插件：审计日志 + 凭证迁移 + JVM白名单 + 沙箱 + 文件权限
//
// 注意：加密（AES-256-GCM）和凭证存储的核心实现保留在后端核心中，
// 因为认证模块依赖它。本插件只提供事件监听和上下文菜单管理功能。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

interface ThreatPayload {
  kind?: string;
  args?: string;
  valid?: boolean;
  error?: string;
  warnings?: string[];
}

interface LoginPayload {
  username?: string;
  method?: string;
  success?: boolean;
}

export const securityPlugin = definePlugin({
  id: 'com.bonnext.security',
  name: 'Security',
  version: '1.0.0',
  description: 'Audit log, credential migration, JVM whitelist, sandbox, and file permissions',

  activate(ctx: PluginContext) {
    // 监听安全相关事件：威胁检测
    ctx.events.on('security:threat-detected', (data) => {
      const payload = (data ?? {}) as ThreatPayload;
      ctx.logger.warn('Security threat detected', payload);
      // 查询当前安全评分，便于 UI 刷新
      ctx
        .invoke<number>('get_security_score')
        .then((score) => {
          ctx.logger.info(`Security score after threat: ${score}`);
        })
        .catch((e) => ctx.logger.warn('get_security_score failed', e));
    });

    // 监听登录事件，记录审计条目（后端 auth 模块已自动记录，这里仅做日志）
    ctx.events.on('auth:login', (data) => {
      const payload = (data ?? {}) as LoginPayload;
      ctx.logger.info('User logged in, recording audit entry', payload);
    });

    // 上下文菜单：检查实例文件权限
    ctx.addContextMenuItem({
      id: 'security-check-perms',
      label: 'Check File Permissions',
      icon: '🛡',
      where: ['instance'],
      action: () => {
        ctx
          .invoke<unknown[]>('check_file_permissions')
          .then((results) => {
            ctx.logger.info('File permission check completed', results);
          })
          .catch((e) => ctx.logger.warn('check_file_permissions failed', e));
      },
    });

    // 上下文菜单：修复文件权限
    ctx.addContextMenuItem({
      id: 'security-fix-perms',
      label: 'Fix File Permissions',
      icon: '🔧',
      where: ['instance'],
      action: () => {
        ctx
          .invoke<unknown[]>('fix_file_permissions')
          .then((results) => {
            ctx.logger.info('File permissions fixed', results);
          })
          .catch((e) => ctx.logger.warn('fix_file_permissions failed', e));
      },
    });

    ctx.logger.info('Security plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default securityPlugin;
