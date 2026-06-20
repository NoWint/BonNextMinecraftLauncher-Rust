import type { ShellDefinition } from '../../shared/types/shell';

export const editorShell: ShellDefinition = {
  id: 'editor',
  name: 'Shell Editor',
  description: '可视化 Shell 编辑器 — 拖拽创建自定义界面',
  icon: '🎨',
  loader: () => import('./AppShell'),
  supportedRoutes: ['/editor'],
  supportedThemes: ['dark', 'light'],
};
