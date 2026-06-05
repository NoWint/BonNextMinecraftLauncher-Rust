import type { ShellDefinition } from '../../shared/types/shell';

export const tvShell: ShellDefinition = {
  id: 'tv',
  name: 'TV / 10-foot UI',
  description: '大屏电视遥控器操作界面',
  icon: '📺',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/:id',
    '/library', '/settings',
  ],
  supportedThemes: ['dark'],
};
