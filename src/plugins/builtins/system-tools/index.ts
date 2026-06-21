// src/plugins/builtins/system-tools/index.ts
// System Tools 内置插件：成就 + 新闻 + 快照 + 迁移工具 + 优化建议 + 性能分析
//
// 监听游戏生命周期事件并触发后端逻辑：
// - 启动时记录游玩时间起点
// - 退出时检查成就解锁
// - 下载完成时刷新新闻/成就面板
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

interface InstancePayload {
  instanceId?: string;
  instanceName?: string;
}

interface DownloadPayload {
  url?: string;
  path?: string;
  kind?: string;
}

export const systemToolsPlugin = definePlugin({
  id: 'com.bonnext.system-tools',
  name: 'System Tools',
  version: '1.0.0',
  description: 'Achievements, news, snapshots, migration tools, optimization suggestions, and performance analysis',

  activate(ctx: PluginContext) {
    // 监听游戏启动事件，记录游玩时间起点
    ctx.events.on('instance:launched', (data) => {
      const payload = (data ?? {}) as InstancePayload;
      ctx.logger.info('Instance launched, tracking playtime', payload);
      // 触发成就检查（启动次数等）
      if (payload.instanceId) {
        ctx
          .invoke<unknown>('check_achievements', { instanceId: payload.instanceId })
          .catch((e) => ctx.logger.warn('check_achievements failed', e));
      }
    });

    // 监听游戏退出事件，检查成就解锁
    ctx.events.on('instance:exited', (data) => {
      const payload = (data ?? {}) as InstancePayload;
      ctx.logger.info('Instance exited, checking achievements', payload);
      if (payload.instanceId) {
        ctx
          .invoke<{ newly_unlocked?: unknown[] }>('check_achievements', {
            instanceId: payload.instanceId,
          })
          .then((result) => {
            if (result?.newly_unlocked && Array.isArray(result.newly_unlocked) && result.newly_unlocked.length > 0) {
              ctx.events.emit('achievements:unlocked', {
                instanceId: payload.instanceId,
                achievements: result.newly_unlocked,
              });
            }
          })
          .catch((e) => ctx.logger.warn('check_achievements failed', e));
      }
    });

    // 监听下载完成事件，刷新新闻/成就面板
    ctx.events.on('download:completed', (data) => {
      const payload = (data ?? {}) as DownloadPayload;
      ctx.logger.info('Download completed', payload);
      // 下载完成可能解锁成就
      ctx
        .invoke<unknown>('check_achievements', { kind: payload.kind })
        .catch((e) => ctx.logger.warn('check_achievements failed', e));
    });

    // 上下文菜单：创建实例快照
    ctx.addContextMenuItem({
      id: 'system-tools-snapshot',
      label: 'Create Snapshot',
      icon: '📸',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) return;
        ctx
          .invoke<{ snapshotId?: string; error?: string }>('create_snapshot', {
            instanceId: data.instanceId,
          })
          .then((result) => {
            ctx.events.emit('snapshot:created', {
              instanceId: data.instanceId,
              snapshotId: result?.snapshotId,
              error: result?.error,
            });
            ctx.logger.info('Snapshot created:', result?.snapshotId);
          })
          .catch((e) => ctx.logger.warn('create_snapshot failed', e));
      },
    });

    // 上下文菜单：检查迁移就绪
    ctx.addContextMenuItem({
      id: 'system-tools-migration-check',
      label: 'Check Migration Readiness',
      icon: '🛠',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) return;
        ctx
          .invoke<{ ready?: boolean; issues?: unknown[] }>('check_migration_readiness', {
            instanceId: data.instanceId,
          })
          .then((result) => {
            ctx.events.emit('migration:checked', {
              instanceId: data.instanceId,
              ready: result?.ready,
              issues: result?.issues,
            });
            ctx.logger.info('Migration readiness:', result);
          })
          .catch((e) => ctx.logger.warn('check_migration_readiness failed', e));
      },
    });

    ctx.logger.info('System Tools plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default systemToolsPlugin;
