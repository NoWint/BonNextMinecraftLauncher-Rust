// src/plugins/builtins/social/index.ts
// Social 内置插件：好友 + 聊天 + P2P + Discord RPC
//
// 社交功能的好友列表、聊天窗口、P2P 消息和 Discord Rich Presence。
// UI 组件（FriendsPanel、ChatWindow）由核心 AppShell 渲染为覆盖层，
// 本插件负责事件监听和后端命令命名空间注册。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const socialPlugin = definePlugin({
  id: 'com.bonnext.social',
  name: 'Social',
  version: '1.0.0',
  description: 'Friends, chat, P2P messaging, and Discord Rich Presence',

  activate(ctx: PluginContext) {
    // 监听游戏启动事件，更新 Discord RPC
    ctx.events.on('instance:launched', (data) => {
      ctx.logger.info('Game launched, updating Discord presence', data);
    });

    // 监听游戏退出事件
    ctx.events.on('instance:exited', (data) => {
      ctx.logger.info('Game exited, clearing Discord presence', data);
    });

    // 上下文菜单：好友相关操作
    ctx.addContextMenuItem({
      id: 'social-share-instance',
      label: 'Share Instance',
      icon: '📤',
      where: ['instance'],
      action: (context) => {
        ctx.logger.info('Sharing instance', context.data);
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
