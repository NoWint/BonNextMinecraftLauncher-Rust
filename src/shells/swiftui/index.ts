import type { ShellDefinition } from '../../shared/types/shell';

export const swiftuiShell: ShellDefinition = {
  id: 'swiftui',
  name: 'SwiftUI Style',
  description: 'Apple HIG + Liquid Glass design language',
  icon: 'apple',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings', '/servers',
  ],
  supportedThemes: ['light', 'dark'],
};
