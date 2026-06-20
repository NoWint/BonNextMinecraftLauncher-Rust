import type { ShellDefinition } from '../../shared/types/shell';

export const zzzShell: ShellDefinition = {
  id: 'zzz',
  name: 'ZZZ Neo-Tokyo',
  description: '赛博朋克风格界面，灵感来自绝区零',
  icon: '⚡',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['dark', 'light', 'oled'],
};
