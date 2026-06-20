import type { ShellDefinition } from '../../shared/types/shell';

export const fluentShell: ShellDefinition = {
  id: 'fluent',
  name: 'Fluent UI Style',
  description: '遵循 Microsoft Fluent Design System 2 的设计语言',
  icon: '🪟',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['light', 'dark'],
};
