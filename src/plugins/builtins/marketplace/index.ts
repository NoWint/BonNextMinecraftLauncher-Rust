// src/plugins/builtins/marketplace/index.ts
// Marketplace 内置插件：Modrinth + CurseForge + ModpackIndex + 搜索 + 收藏 + 内容安装 + 优化预设
//
// 该插件将市场相关页面（MarketplacePage、ContentDetailPage、CollectionsPage、LibraryPage）
// 注册到核心 UI，并通过侧边栏注入导航项。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const marketplacePlugin = definePlugin({
  id: 'com.bonnext.marketplace',
  name: 'Marketplace',
  version: '1.0.0',
  description: 'Modrinth & CurseForge & ModpackIndex content browser',

  activate(ctx: PluginContext) {
    // 路由注册（懒加载页面组件）
    ctx.registerRoute('/store', () => import('../../../shells/zzz/pages/MarketplacePage'));
    ctx.registerRoute('/mods', () => import('../../../shells/zzz/pages/MarketplacePage'));
    ctx.registerRoute('/store/:type/:slug', () => import('../../../shells/zzz/pages/ContentDetailPage'));
    ctx.registerRoute('/collections', () => import('../../../shells/zzz/pages/CollectionsPage'));
    ctx.registerRoute('/library', () => import('../../../shells/zzz/pages/LibraryPage'));

    // 侧边栏导航项
    ctx.addSidebarItem({ id: 'marketplace', label: 'Store', icon: '🛒', route: '/store', order: 2 });
    ctx.addSidebarItem({ id: 'collections', label: 'Collections', icon: '📚', route: '/collections', order: 3 });
    ctx.addSidebarItem({ id: 'library', label: 'Library', icon: '📦', route: '/library', order: 5 });

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
