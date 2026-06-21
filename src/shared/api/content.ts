import { invoke } from '@tauri-apps/api/core';
import type {
  InstalledModInfo,
  WorldInfo,
  WorldBackupInfo,
  LogFileInfo,
  ContentCounts,
  UpdateInfo,
  RecentLogLine,
  AtomicInstallFile,
  AtomicInstallResult,
} from './types';

export const listInstanceMods = (instanceId: string) =>
  invoke<InstalledModInfo[]>('list_instance_mods', { instanceId });
export const listInstanceResourcepacks = (instanceId: string) =>
  invoke<string[]>('list_instance_resourcepacks', { instanceId });
export const listInstanceShaders = (instanceId: string) => invoke<string[]>('list_instance_shaders', { instanceId });
export const listInstanceSchematics = (instanceId: string) => invoke<string[]>('list_instance_schematics', { instanceId });
export const listInstanceSaves = (instanceId: string) => invoke<WorldInfo[]>('list_instance_saves', { instanceId });
export const exportWorld = (instanceId: string, saveName: string, outputPath: string) =>
  invoke<string>('export_world', { instanceId, saveName, outputPath });
export const listInstanceLogs = (instanceId: string) => invoke<LogFileInfo[]>('list_instance_logs', { instanceId });
export const readLogFile = (instanceId: string, filename: string, maxLines?: number) =>
  invoke<string>('read_log_file', { instanceId, filename, maxLines });
export const getRecentLogs = (instanceId: string, lines?: number) =>
  invoke<RecentLogLine[]>('get_recent_logs', { instanceId, lines });
export const removeInstalledMod = (instanceId: string, filename: string) =>
  invoke<void>('remove_installed_mod', { instanceId, filename });
export const getContentCounts = (instanceId: string) => invoke<ContentCounts>('get_content_counts', { instanceId });
export const checkContentUpdates = (instanceId: string) =>
  invoke<UpdateInfo[]>('check_content_updates', { instanceId });
export const bulkUpdateContent = (instanceId: string) =>
  invoke<{ succeeded: number; failed: number; skipped_pinned: number; errors: string[] }>('bulk_update_content', {
    instanceId,
  });
export const pinMod = (instanceId: string, slug: string) => invoke<boolean>('pin_mod', { instanceId, slug });
export const unpinMod = (instanceId: string, slug: string) => invoke<boolean>('unpin_mod', { instanceId, slug });
export const isModPinned = (instanceId: string, slug: string) => invoke<boolean>('is_mod_pinned', { instanceId, slug });
export const atomicInstallContent = (instanceId: string, files: AtomicInstallFile[]) =>
  invoke<AtomicInstallResult>('atomic_install_content', { instanceId, files });

// ═══════════════════════════════════════════════════════════════════
// 世界备份/恢复/管理 API（参考 HMCL WorldBackupTask）
// ═══════════════════════════════════════════════════════════════════
export const backupWorld = (instanceId: string, saveName: string) =>
  invoke<string>('backup_world', { instanceId, saveName });
export const listWorldBackups = (instanceId: string) =>
  invoke<WorldBackupInfo[]>('list_world_backups', { instanceId });
export const restoreWorld = (instanceId: string, backupFilename: string, targetName?: string) =>
  invoke<string>('restore_world', { instanceId, backupFilename, targetName });
export const deleteWorldBackup = (instanceId: string, backupFilename: string) =>
  invoke<void>('delete_world_backup', { instanceId, backupFilename });
export const importWorld = (instanceId: string, zipPath: string, worldName?: string) =>
  invoke<string>('import_world', { instanceId, zipPath, worldName });
export const deleteWorld = (instanceId: string, saveName: string) =>
  invoke<void>('delete_world', { instanceId, saveName });
export const renameWorld = (instanceId: string, oldName: string, newName: string) =>
  invoke<void>('rename_world', { instanceId, oldName, newName });
export const duplicateWorld = (instanceId: string, saveName: string, newName: string) =>
  invoke<void>('duplicate_world', { instanceId, saveName, newName });
