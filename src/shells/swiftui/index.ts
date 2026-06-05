import type { ShellDefinition } from '../../shared/types/shell';

export const swiftuiShell: ShellDefinition = {
  id: 'swiftui',
  name: 'SwiftUI Style',
  description: '遵循 Apple Human Interface Guidelines 的设计语言',
  icon: '🍎',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['light', 'dark'],
};
