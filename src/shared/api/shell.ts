import { invoke } from '@tauri-apps/api/core';

export const getActiveShell = (): Promise<string> =>
  invoke<string>('get_active_shell');

export const setActiveShell = (shellId: string): Promise<void> =>
  invoke<void>('set_active_shell', { shellId });
