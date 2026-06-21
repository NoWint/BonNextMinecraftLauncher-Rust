// src/plugins/builtins/social/index.ts
// Social 内置插件：好友 + 聊天 + P2P + Discord RPC
//
// 社交功能的好友列表、聊天窗口、P2P 消息和 Discord Rich Presence。
// UI 组件（FriendsPanel、ChatWindow）由核心 AppShell 渲染为覆盖层，
// 本插件负责事件监听和后端命令命名空间注册。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

interface InstanceLaunchedPayload {
  instanceId?: string;
  instanceName?: string;
  version?: string;
}

interface InstanceExitedPayload {
  instanceId?: string;
}

export const socialPlugin = definePlugin({
  id: 'com.bonnext.social',
  name: 'Social',
  version: '1.0.0',
  description: 'Friends, chat, P2P messaging, and Discord Rich Presence',

  activate(ctx: PluginContext) {
    // 监听游戏启动事件，更新 Discord RPC
    ctx.events.on('instance:launched', (data) => {
      const payload = (data ?? {}) as InstanceLaunchedPayload;
      ctx.logger.info('Game launched, updating Discord presence', payload);
      ctx
        .invoke<void>('update_discord_presence', {
          state: 'Playing',
          details: payload.instanceName ?? 'Minecraft',
          largeImageKey: 'minecraft',
        })
        .catch((e) => {
          ctx.logger.warn('update_discord_presence failed', e);
        });
    });

    // 监听游戏退出事件
    ctx.events.on('instance:exited', (data) => {
      const payload = (data ?? {}) as InstanceExitedPayload;
      ctx.logger.info('Game exited, clearing Discord presence', payload);
      ctx
        .invoke<void>('update_discord_presence', {
          state: 'Idle',
          details: '',
          largeImageKey: 'bonnext',
        })
        .catch((e) => {
          ctx.logger.warn('clear discord presence failed', e);
        });
    });

    // 上下文菜单：分享实例快照
    ctx.addContextMenuItem({
      id: 'social-share-instance',
      label: 'Share Instance',
      icon: '📤',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) {
          ctx.logger.warn('Share Instance: missing instanceId in context');
          return;
        }
        ctx
          .invoke<{ snapshotPath?: string; error?: string }>('generate_instance_snapshot', {
            instanceId: data.instanceId,
          })
          .then((result) => {
            ctx.events.emit('social:instance-shared', {
              instanceId: data.instanceId,
              snapshotPath: result?.snapshotPath,
              error: result?.error,
            });
            if (result?.error) {
              ctx.logger.warn('Instance snapshot error:', result.error);
            } else {
              ctx.logger.info('Instance snapshot generated:', result?.snapshotPath);
            }
          })
          .catch((e) => {
            ctx.logger.warn('generate_instance_snapshot failed', e);
          });
      },
    });

    // 上下文菜单：邀请好友同游（coplay）
    ctx.addContextMenuItem({
      id: 'social-coplay',
      label: 'Invite to Co-Play',
      icon: '🎮',
      where: ['instance'],
      action: (context) => {
        const data = (context.data ?? {}) as { instanceId?: string };
        if (!data.instanceId) return;
        ctx
          .invoke<void>('start_coplay', { instanceId: data.instanceId })
          .then(() => {
            ctx.events.emit('social:coplay-started', { instanceId: data.instanceId });
            ctx.logger.info('Co-play session started');
          })
          .catch((e) => {
            ctx.logger.warn('start_coplay failed', e);
          });
      },
    });

    ctx.logger.info('Social plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default socialPlugin;
