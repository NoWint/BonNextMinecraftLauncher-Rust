import { api } from '../../../shared/api';
import type { ShellConfig } from './schema';

export async function saveShellConfig(config: ShellConfig): Promise<void> {
  const json = JSON.stringify(config, null, 2);
  await api.saveShellConfig(config.id, json);
}

export async function loadShellConfig(shellId: string): Promise<ShellConfig | null> {
  const json = await api.loadShellConfig(shellId);
  if (!json || json === '{}') return null;
  return JSON.parse(json) as ShellConfig;
}

export function createDefaultConfig(id: string, name: string): ShellConfig {
  return {
    id,
    name,
    version: '1.0.0',
    author: '',
    description: '',
    theme: {
      mode: 'dark',
      variables: {
        '--bg-primary': '#0d0d0d',
        '--bg-secondary': '#141414',
        '--bg-card': '#1a1a1a',
        '--text-primary': '#ffffff',
        '--accent': '#ffe600',
      },
    },
    pages: {
      '/home': { layout: { id: 'root', type: 'FlexRow', props: { gap: '0' }, children: [] } },
      '/instances': { layout: { id: 'root', type: 'FlexRow', props: { gap: '0' }, children: [] } },
      '/settings': { layout: { id: 'root', type: 'FlexRow', props: { gap: '0' }, children: [] } },
    },
  };
}
