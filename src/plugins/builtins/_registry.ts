// src/plugins/builtins/_registry.ts
// 内置组件注册到 ComponentRegistry，供 manifest.contributes 字符串引用
import { componentRegistry } from '../core/ComponentRegistry';

export function registerBuiltinComponents(): void {
  // Marketplace
  componentRegistry.register('MarketplacePage', () => import('../../shells/zzz/pages/MarketplacePage'));
  componentRegistry.register('ContentDetailPage', () => import('../../shells/zzz/pages/ContentDetailPage'));
  componentRegistry.register('CollectionsPage', () => import('../../shells/zzz/pages/CollectionsPage'));
  componentRegistry.register('LibraryPage', () => import('../../shells/zzz/pages/LibraryPage'));
  // Servers
  componentRegistry.register('ServersPage', () => import('../../shells/zzz/pages/ServersPage'));
}
