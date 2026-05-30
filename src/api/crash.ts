import { invoke } from '@tauri-apps/api/core';
import type { CrashDiagnosis, CrashInfo } from './types';

export const crashApi = {
  parseCrashReport: (reportPath: string) => invoke<CrashInfo>('parse_crash_report', { reportPath }),

  diagnoseCrash: (reportPath: string) => invoke<CrashDiagnosis>('diagnose_crash', { reportPath }),
};
