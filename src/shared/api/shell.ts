import { invoke } from '@tauri-apps/api/core';
import type { CustomShellMeta } from '../types/custom-shell';

export const getActiveShell = (): Promise<string> =>
  invoke<string>('get_active_shell');

export const setActiveShell = (shellId: string): Promise<void> =>
  invoke<void>('set_active_shell', { shellId });

export const scanCustomShells = (): Promise<CustomShellMeta[]> =>
  invoke<CustomShellMeta[]>('scan_custom_shells');

export const importCustomShell = (path: string): Promise<CustomShellMeta> =>
  invoke<CustomShellMeta>('import_custom_shell', { path });

export const removeCustomShell = (id: string): Promise<void> =>
  invoke<void>('remove_custom_shell', { id });

export const getCustomShellEntry = (id: string): Promise<string> =>
  invoke<string>('get_custom_shell_entry', { id });

export const getCustomShellCss = (id: string): Promise<string | null> =>
  invoke<string | null>('get_custom_shell_css', { id });

export const saveShellConfig = (shellId: string, configJson: string): Promise<void> =>
  invoke<void>('save_shell_config', { shellId, configJson });

export const loadShellConfig = (shellId: string): Promise<string> =>
  invoke<string>('load_shell_config', { shellId });
