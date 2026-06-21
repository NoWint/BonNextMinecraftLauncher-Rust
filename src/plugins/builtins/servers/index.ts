// src/plugins/builtins/servers/index.ts
// Servers 内置插件：服务器列表 + Ping + LAN 发现 + Terracotta
//
// 路由与侧边栏导航项由 manifest.contributes 声明式注册（见 manifest.json），
// 由 PluginManager.activate() 在调用本 activate() 之前自动消费。
import { definePlugin } from '../../core';
import manifest from './manifest.json';

export const serversPlugin = definePlugin({
  id: 'com.bonnext.servers',
  name: 'Servers',
  version: '1.0.0',
  description: 'Server list, ping, LAN discovery, and Terracotta multiplayer',

  activate() {
    // No imperative UI injection — routes/sidebar are declared in manifest.json
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default serversPlugin;
