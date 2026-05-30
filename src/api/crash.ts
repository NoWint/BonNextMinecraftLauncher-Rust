import { invoke } from '@tauri-apps/api/core';
import type { CrashDiagnosis, CrashInfo } from './types';

export const crashApi = {
  parseCrashReport: (reportPath: string) => invoke<CrashInfo>('parse_crash_report', { reportPath }),

  diagnoseCrash: (reportPath: string) => invoke<CrashDiagnosis>('diagnose_crash', { reportPath }),

  /** Auto-find and diagnose the latest crash report for an instance. */
  diagnoseInstanceCrash: (instanceId: string) => invoke<CrashDiagnosis>('diagnose_instance_crash', { instanceId }),
};
