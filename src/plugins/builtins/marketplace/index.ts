// src/plugins/builtins/marketplace/index.ts
// Marketplace 内置插件：Modrinth + CurseForge + ModpackIndex + 搜索 + 收藏 + 内容安装 + 优化预设
//
// 路由与侧边栏导航项由 manifest.contributes 声明式注册（见 manifest.json），
// 由 PluginManager.activate() 在调用本 activate() 之前自动消费。
// 本插件只保留事件订阅和日志。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const marketplacePlugin = definePlugin({
  id: 'com.bonnext.marketplace',
  name: 'Marketplace',
  version: '1.0.0',
  description: 'Modrinth & CurseForge & ModpackIndex content browser',

  activate(ctx: PluginContext) {
    // 监听实例创建事件，刷新推荐
    ctx.events.on('instance:created', () => {
      ctx.logger.info('New instance created, refreshing recommendations');
    });

    ctx.logger.info('Marketplace plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});

export { manifest };
export default marketplacePlugin;
