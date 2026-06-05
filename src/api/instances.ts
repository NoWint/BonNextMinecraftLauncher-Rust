import { invoke } from '@tauri-apps/api/core';
import { cachedInvoke } from './cache';
import type {
  AppConfig,
  GameInstance,
  JavaInfo,
  LoaderInstallResult,
  HealthCheckReport,
  PreLaunchReport,
  RepairResult,
  InstanceCheckResult,
} from './types';

export const getConfig = () => cachedInvoke('config', () => invoke<AppConfig>('get_config'));
export const saveConfig = (config: AppConfig) => invoke<void>('save_config', { config });
export const findJava = () => invoke<string>('find_java');
export const findAllJava = () => invoke<JavaInfo[]>('find_all_java');
export const checkJavaVersion = (javaPath: string) => invoke<number | null>('check_java_version', { javaPath });
export const listInstances = () => cachedInvoke('instances', () => invoke<GameInstance[]>('list_instances'));
export const createInstance = (instance: GameInstance) => invoke<void>('create_instance', { instance });
export const deleteInstance = (id: string) => invoke<void>('delete_instance', { id });
export const softDeleteInstance = (id: string) => invoke<void>('soft_delete_instance', { id });
export const restoreInstance = (id: string) => invoke<GameInstance>('restore_instance', { id });
export const cleanupTrash = () => invoke<number>('cleanup_trash');
export const updateInstance = (instance: GameInstance) => invoke<void>('update_instance', { instance });
export const getInstance = (id: string) => invoke<GameInstance | null>('get_instance', { id });
export const openFolder = (path: string) => invoke<void>('open_folder', { path });
export const getGameDir = () => invoke<string>('get_game_dir');
export const getDefaultGameDir = () => invoke<string>('get_default_game_dir');
export const getLoaderVersions = (loaderType: string) => invoke<string[]>('get_loader_versions', { loaderType });
export const installLoader = (
  loaderType: string,
  versionId: string,
  versionUrl: string,
  loaderVersion: string,
  instanceId: string,
) => invoke<LoaderInstallResult>('install_loader', { loaderType, versionId, versionUrl, loaderVersion, instanceId });
export const launchGame = (
  versionId: string,
  versionUrl: string,
  username: string,
  uuid: string,
  accessToken: string,
  maxMemory?: number,
  minMemory?: number,
  javaPath?: string,
  jvmArgs?: string,
  instanceId?: string,
) =>
  invoke<void>('launch_game', {
    versionId,
    versionUrl,
    username,
    uuid,
    accessToken,
    maxMemory,
    minMemory,
    javaPath,
    jvmArgs,
    instanceId,
  });
export const debugLaunch = (
  versionId: string,
  versionUrl: string,
  username: string,
  uuid: string,
  accessToken: string,
  maxMemory?: number,
  minMemory?: number,
  javaPath?: string,
  jvmArgs?: string,
  instanceId?: string,
  debugPort?: number,
) =>
  invoke<void>('debug_launch', {
    versionId,
    versionUrl,
    username,
    uuid,
    accessToken,
    maxMemory,
    minMemory,
    javaPath,
    jvmArgs,
    instanceId,
    debugPort,
  });
export const duplicateInstance = (instanceId: string, newName: string) =>
  invoke<GameInstance>('duplicate_instance', { id: instanceId, newName });
export const exportInstance = (instanceId: string, outputPath: string) =>
  invoke<void>('export_instance', { id: instanceId, outputPath });
export const importModpack = (path: string) => invoke<GameInstance>('import_modpack', { path });
export const importModpackAuto = (path: string) => invoke<GameInstance>('import_modpack_auto', { path });
export const detectModpackFormat = (path: string) => invoke<string>('detect_modpack_format', { path });
export const exportMrpack = (instanceId: string, outputPath: string) =>
  invoke<void>('export_mrpack', { id: instanceId, outputPath });
export const checkInstanceReady = (instanceId: string) => invoke<boolean>('check_instance_ready', { instanceId });
export const batchCheckInstances = (instanceIds: string[]) =>
  invoke<InstanceCheckResult[]>('batch_check_instances', { instanceIds });
export const healthCheck = (instanceId: string) => invoke<HealthCheckReport>('health_check', { instanceId });
export const getInstanceCoverImage = (instanceId: string) =>
  invoke<string | null>('get_instance_cover_image', { instanceId });
export const getLastPlayedInstance = () => invoke<GameInstance | null>('get_last_played_instance');
export const createSnapshot = (instanceId: string, name: string) =>
  invoke<{ id: string; name: string; created_at: string; size_bytes: number }>('create_snapshot', { instanceId, name });
export const listSnapshots = (instanceId: string) =>
  invoke<Array<{ id: string; name: string; created_at: string; size_bytes: number }>>('list_snapshots', { instanceId });
export const restoreSnapshot = (instanceId: string, snapshotId: string) =>
  invoke<void>('restore_snapshot', { instanceId, snapshotId });
export const deleteSnapshot = (instanceId: string, snapshotId: string) =>
  invoke<void>('delete_snapshot', { instanceId, snapshotId });
export const checkModConflicts = (instanceId: string) =>
  invoke<Array<{ mod_a: string; mod_b: string; reason: string; severity: string }>>('check_mod_conflicts', {
    instanceId,
  });
export const exportInstanceConfig = (instanceId: string) => invoke<string>('export_instance_config', { instanceId });
export const importInstanceConfig = (configCode: string) =>
  invoke<GameInstance>('import_instance_config', { configCode });
export const setInstanceIcon = (instanceId: string, iconPath: string) =>
  invoke<void>('set_instance_icon', { instanceId, iconPath });
export const warmupLaunch = (instanceId: string) => invoke<void>('warmup_launch', { instanceId });
export const createGuestInstance = () => invoke<GameInstance>('create_guest_instance');
export const getGcRecommendations = (instanceId: string) =>
  invoke<
    Array<{
      gc_type: string;
      heap_size_mb: number;
      metaspace_mb: number;
      jvm_args: string[];
      description: string;
      suitable_for: string;
      reason: string;
    }>
  >('get_gc_recommendations', { instanceId });
export const detectAnomalies = (instanceId: string) =>
  invoke<Array<{ anomaly_type: string; severity: string; message: string; suggestion: string }>>('detect_anomalies', {
    instanceId,
  });
export const smartTuneMemory = (instanceId: string) => invoke<number>('smart_tune_memory_cmd', { instanceId });
export const toggleMod = (instanceId: string, filename: string) =>
  invoke<boolean>('toggle_mod', { instanceId, filename });
export const recordPlaytime = (instanceId: string, seconds: number) =>
  invoke<void>('record_playtime', { instanceId, seconds });
export const getLaunchProfilingData = (instanceId: string) =>
  invoke<Array<{ stage: string; duration_ms: number; details: string }>>('get_launch_profiling_data', { instanceId });
export const getFrameTimeData = (instanceId: string) =>
  invoke<{
    avg_fps: number;
    min_fps: number;
    max_fps: number;
    frame_times_ms: number[];
    stutter_count: number;
    analysis: string;
  }>('get_frame_time_data', { instanceId });
export const listScreenshots = (instanceId: string) =>
  invoke<Array<{ filename: string; path: string; size_bytes: number; modified: string }>>('list_screenshots', {
    instanceId,
  });
export const getRecommendations = (instanceId: string) =>
  invoke<Array<{ slug: string; name: string; reason: string; category: string }>>('get_recommendations', {
    instanceId,
  });
export const checkMigrationReadiness = (instanceId: string, targetVersion: string) =>
  invoke<Array<{ mod_slug: string; mod_name: string; status: string; detail: string }>>('check_migration_readiness', {
    instanceId,
    targetVersion,
  });
export const detectLaunchers = () => invoke<import('./types').DetectedLauncher[]>('detect_launchers');
export const scanLauncherInstances = (launcherType: string, gameDir: string) =>
  invoke<import('./types').MigrateableInstance[]>('scan_launcher_instances', { launcherType, gameDir });
export const scanCustomDirectory = (path: string) =>
  invoke<import('./types').MigrateableInstance[]>('scan_custom_directory', { path });
export const migrateInstance = (params: {
  name: string;
  versionId: string;
  loaderType: string | null;
  loaderVersion: string | null;
  sourceGameDir: string;
  launcherType: string;
  javaPath: string | null;
  jvmArgs: string | null;
  minMemory: number | null;
  maxMemory: number | null;
}) =>
  invoke<GameInstance>('migrate_instance', {
    name: params.name,
    versionId: params.versionId,
    loaderType: params.loaderType,
    loaderVersion: params.loaderVersion,
    sourceGameDir: params.sourceGameDir,
    launcherType: params.launcherType,
    javaPath: params.javaPath,
    jvmArgs: params.jvmArgs,
    minMemory: params.minMemory,
    maxMemory: params.maxMemory,
  });
export const diagnoseMigration = (instanceId: string) =>
  invoke<import('./types').MigrationIssue[]>('diagnose_migration', { instanceId });
export const fixMigrationIssues = (instanceId: string, issues: import('./types').MigrationIssue[]) =>
  invoke<import('./types').MigrationFixResult>('fix_migration_issues', { instanceId, issues });
export const readConfigFile = (instanceId: string, relativePath: string) =>
  invoke<string>('read_config_file', { instanceId, relativePath });
export const writeConfigFile = (instanceId: string, relativePath: string, content: string) =>
  invoke<void>('write_config_file', { instanceId, relativePath, content });
export const preLaunchCheck = (instanceId: string) => invoke<PreLaunchReport>('pre_launch_check', { instanceId });
export const repairInstance = (instanceId: string) => invoke<RepairResult>('repair_instance', { instanceId });
