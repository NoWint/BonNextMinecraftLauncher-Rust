// src/plugins/builtins/servers/index.ts
// Servers 内置插件：服务器列表 + Ping + LAN 发现 + Terracotta
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const serversPlugin = definePlugin({
  id: 'com.bonnext.servers',
  name: 'Servers',
  version: '1.0.0',
  description: 'Server list, ping, LAN discovery, and Terracotta multiplayer',

  activate(ctx: PluginContext) {
    ctx.registerRoute('/servers', () => import('../../../shells/zzz/pages/ServersPage'));
    ctx.addSidebarItem({ id: 'servers', label: 'Servers', icon: '🌐', route: '/servers', order: 7 });

    ctx.logger.info('Servers plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default serversPlugin;
