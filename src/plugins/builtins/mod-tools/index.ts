// src/plugins/builtins/mod-tools/index.ts
// Mod Tools 内置插件：Mod 扫描 + 监视 + 兼容性检查
//
// 该插件为实例提供 Mod 相关的上下文菜单操作：
// - 扫描实例 mods 目录
// - 检查 Mod 兼容性
// - 检查 Mod 更新
// 操作通过事件总线广播结果，便于其他 UI（如 LibraryPage）刷新。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const modToolsPlugin = definePlugin({
  id: 'com.bonnext.mod-tools',
  name: 'Mod Tools',
  version: '1.0.0',
  description: 'Mod scanning, watching, and compatibility checking',

  activate(ctx: PluginContext) {
    // 监听 mod 安装事件：扫描冲突并广播
    ctx.events.on('mod:installed', (data) => {
      ctx.logger.info('Mod installed, scanning for conflicts', data);
      const payload = (data ?? {}) as { instanceId?: string };
      if (!payload.instanceId) return;
      ctx
        .invoke<{ conflicts: unknown[] }>('check_mod_conflicts', { instanceId: payload.instanceId })
        .then((result) => {
          ctx.events.emit('mod:conflicts-scanned', {
            instanceId: payload.instanceId,
            conflicts: result?.conflicts ?? [],
          });
        })
        .catch((e) => {
          ctx.logger.warn('check_mod_conflicts failed', e);
        });
    });

    // 上下文菜单：扫描实例 mods 目录
    ctx.addContextMenuItem({
      id: 'mod-tools-scan',
      label: 'Scan Mods',
      icon: '🔍',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) {
          ctx.logger.warn('Scan Mods: missing instanceId in context');
          return;
        }
        ctx
          .invoke<unknown[]>('scan_mods_directory', { instanceId: data.instanceId })
          .then((mods) => {
            ctx.events.emit('mod:scanned', { instanceId: data.instanceId, mods });
            ctx.logger.info(`Scanned ${Array.isArray(mods) ? mods.length : 0} mods`);
          })
          .catch((e) => {
            ctx.logger.warn('scan_mods_directory failed', e);
          });
      },
    });

    // 上下文菜单：检查兼容性
    ctx.addContextMenuItem({
      id: 'mod-tools-check-compat',
      label: 'Check Compatibility',
      icon: '✓',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) {
          ctx.logger.warn('Check Compatibility: missing instanceId in context');
          return;
        }
        ctx
          .invoke<{ conflicts: unknown[] }>('check_mod_conflicts', { instanceId: data.instanceId })
          .then((result) => {
            ctx.events.emit('mod:compat-checked', {
              instanceId: data.instanceId,
              conflicts: result?.conflicts ?? [],
            });
            ctx.logger.info('Compatibility check completed', result);
          })
          .catch((e) => {
            ctx.logger.warn('check_mod_conflicts failed', e);
          });
      },
    });

    // 上下文菜单：检查 Mod 更新
    ctx.addContextMenuItem({
      id: 'mod-tools-check-updates',
      label: 'Check Mod Updates',
      icon: '⬆',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) return;
        ctx
          .invoke<unknown[]>('check_mod_updates', { instanceId: data.instanceId })
          .then((updates) => {
            ctx.events.emit('mod:updates-checked', {
              instanceId: data.instanceId,
              updates,
            });
            ctx.logger.info(`Found ${Array.isArray(updates) ? updates.length : 0} mod updates`);
          })
          .catch((e) => {
            ctx.logger.warn('check_mod_updates failed', e);
          });
      },
    });

    ctx.logger.info('Mod Tools plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default modToolsPlugin;
