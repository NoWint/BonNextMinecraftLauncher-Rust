import { invoke } from '@tauri-apps/api/core';
import type { CompatibilityReport } from '../shared/ai/types';

export const modpackApi = {
  checkModCompatibility: (
    mods: Array<{ slug: string; version_id: string; source: string }>,
    gameVersion: string,
    loaderType?: string,
  ) =>
    invoke<CompatibilityReport>('check_mod_compatibility', {
      mods,
      gameVersion,
      loaderType,
    }),
};
