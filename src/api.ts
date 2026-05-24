import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DownloadProgressEvent {
  completed: number;
  total: number;
  bytes_downloaded: number;
  current_url: string;
  phase: string;
  finished: boolean;
  speed_bytes_per_sec: number;
  eta_seconds: number;
}

export interface VersionEntry {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

export interface AppConfig {
  game_dir: string | null;
  java_path: string | null;
  max_memory: number;
  min_memory: number;
  window_width: number;
  window_height: number;
  fullscreen: boolean;
  download_source: string;
  max_concurrent_downloads: number;
  jvm_args: string | null;
  selected_instance: string | null;
  auth_type: string | null;
  keep_launcher_open: boolean;
  show_log_on_crash: boolean;
  auto_update_java: boolean;
  java_download_source: string;
  force_memory: boolean;
  force_java_path: boolean;
  security: SecurityConfig;
}

export interface SecurityConfig {
  credential_encryption: boolean;
  strict_verification: boolean;
  enforce_https: boolean;
  jvm_args_mode: string;
  sandbox_mode: string;
  proxy_enabled: boolean;
  proxy_url: string | null;
  proxy_username: string | null;
  proxy_password: string | null;
  audit_log_enabled: boolean;
  secure_launch_check: boolean;
}

export interface AuditEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  metadata: unknown | null;
}

export interface LoginHistoryEntry {
  timestamp: string;
  auth_type: string;
  success: boolean;
  username: string;
}

export interface KeyStatus {
  name: string;
  configured: boolean;
  source: string;
}

export interface SandboxAvailability {
  platform: string;
  available: boolean;
  tool: string | null;
  supported_modes: string[];
}

export interface FilePermissionResult {
  path: string;
  secure: boolean;
}

export interface FilePermissionFixResult {
  path: string;
  fixed: boolean;
}

export interface JreSourceInfo {
  id: string;
  label: string;
  available: boolean;
}

export interface JavaInfo {
  path: string;
  version: number | null;
  vendor: string | null;
}

export interface GameInstance {
  id: string;
  name: string;
  version_id: string;
  version_url: string;
  loader_type: string | null;
  loader_version: string | null;
  description: string;
  max_memory: number;
  min_memory: number;
  java_path: string | null;
  jvm_args: string | null;
  created_at: string;
  last_played: string | null;
  playtime_seconds: number;
}

export interface OfflineAuthResult {
  username: string;
  uuid: string;
  access_token: string;
}

export interface MicrosoftAuthResult {
  username: string;
  uuid: string;
  access_token: string;
  refresh_token: string;
}

export interface DeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

export interface StoredAccount {
  id: string;
  username: string;
  uuid: string;
  access_token: string;
  refresh_token: string | null;
  account_type: string;
  last_used: string;
  expires_at: string | null;
  avatar_url: string | null;
}

export interface LoaderInstallResult {
  version_id: string;
  main_class: string;
  extra_libraries: unknown[];
  extra_jvm_args: string[];
  extra_game_args: string[];
}

export interface ModResult {
  slug: string;
  title: string;
  description: string;
  author: string;
  categories: string[];
  downloads: number;
  follows: number;
  icon_url: string;
  client_side: string;
  server_side: string;
  latest_version: string | null;
  date_created: string;
  date_modified: string;
}

export interface ModVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ModFile[];
  dependencies: ModDependency[];
  date_published: string;
}

export interface ModFile {
  url: string;
  filename: string;
  size: number;
  hashes: { sha1: string | null; sha512: string | null };
}

export interface ModDependency {
  project_id: string | null;
  dependency_type: string;
  version_id: string | null;
}

export interface ModProjectFull {
  slug: string;
  title: string;
  description: string;
  body: string;
  author: string;
  categories: string[];
  downloads: number;
  follows: number;
  icon_url: string;
  client_side: string;
  server_side: string;
  project_type: string;
  gallery: { url: string; featured: boolean; title?: string; description?: string; created: string }[];
  issues_url: string | null;
  source_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  license: { id: string; name: string; url: string | null } | null;
  date_created: string;
  date_modified: string;
}

export interface InstalledModInfo {
  filename: string;
  size: number;
  installed_at: string;
}

export interface WorldInfo {
  name: string;
  last_played: string | null;
  game_mode: string;
  seed: string | null;
  difficulty: string;
  size_mb: number;
}

export interface LogFileInfo {
  filename: string;
  size: number;
  modified_at: string;
}

export interface ContentCounts {
  mods: number;
  resourcepacks: number;
  shaders: number;
  worlds: number;
}

export interface CollectionItem {
  slug: string;
  title: string;
  author: string;
  icon_url: string;
  content_type: string;
  description: string;
  downloads: number;
  categories: string[];
  added_at: string;
}

export interface UpdateInfo {
  filename: string;
  slug: string;
  installed_version: string | null;
  latest_version: string;
  content_type: string;
}

export type LaunchState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'validating'
  | 'launching'
  | 'running'
  | 'exited'
  | 'crashed'
  | 'error';

const ipcCache = new Map<string, { data: unknown; expires: number }>();
const IPC_CACHE_TTL = 60_000;

function cachedInvoke<T>(key: string, fn: () => Promise<T>, ttl = IPC_CACHE_TTL): Promise<T> {
  const cached = ipcCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return Promise.resolve(cached.data as T);
  }
  return fn().then((data) => {
    ipcCache.set(key, { data, expires: Date.now() + ttl });
    return data;
  });
}

export function invalidateCache(keys?: string[]) {
  if (keys) {
    keys.forEach((k) => ipcCache.delete(k));
  } else {
    ipcCache.clear();
  }
}

export const api = {
  onDownloadProgress: (callback: (progress: DownloadProgressEvent) => void) => {
    return listen<DownloadProgressEvent>('download-progress', (event) => {
      callback(event.payload);
    });
  },

  onJreDownloadProgress: (callback: (p: JreDownloadProgress) => void) => {
    return listen<JreDownloadProgress>('jre-download-progress', (event) => callback(event.payload));
  },

  checkJreAvailable: (majorVersion: number) => invoke<boolean>('check_jre_available', { majorVersion }),
  getJreSources: () => invoke<JreSourceInfo[]>('get_jre_sources'),

  getVersions: () => cachedInvoke('versions', () => invoke<VersionEntry[]>('get_versions'), 300_000),
  getLaunchState: () => invoke<LaunchState>('get_launch_state'),
  resetLaunchState: () => invoke<void>('reset_launch_state'),
  getConfig: () => cachedInvoke('config', () => invoke<AppConfig>('get_config'), 30_000),
  saveConfig: (config: AppConfig) => invoke<void>('save_config', { config }),
  findJava: () => invoke<string>('find_java'),
  findAllJava: () => invoke<JavaInfo[]>('find_all_java'),
  checkJavaVersion: (javaPath: string) => invoke<number | null>('check_java_version', { javaPath }),
  offlineLogin: (username: string) => invoke<OfflineAuthResult>('offline_login', { username }),
  startMicrosoftAuth: () => invoke<DeviceCodeResponse>('start_microsoft_auth'),
  pollMicrosoftAuth: (deviceCode: string) => invoke<MicrosoftAuthResult>('poll_microsoft_auth', { deviceCode }),
  downloadVersion: (versionId: string, versionUrl: string) =>
    invoke<void>('download_version', { versionId, versionUrl }),
  launchGame: (
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
    }),
  getGameDir: () => invoke<string>('get_game_dir'),
  getDefaultGameDir: () => invoke<string>('get_default_game_dir'),
  listInstances: () => cachedInvoke('instances', () => invoke<GameInstance[]>('list_instances'), 30_000),
  createInstance: (instance: GameInstance) => invoke<void>('create_instance', { instance }),
  deleteInstance: (id: string) => invoke<void>('delete_instance', { id }),
  updateInstance: (instance: GameInstance) => invoke<void>('update_instance', { instance }),
  getInstance: (id: string) => invoke<GameInstance | null>('get_instance', { id }),
  openFolder: (path: string) => invoke<void>('open_folder', { path }),

  // Account management
  listAccounts: () => cachedInvoke('accounts', () => invoke<StoredAccount[]>('list_accounts'), 60_000),
  getActiveAccount: () =>
    cachedInvoke('active_account', () => invoke<StoredAccount | null>('get_active_account'), 30_000),
  setActiveAccount: (id: string) => invoke<void>('set_active_account', { id }),
  removeAccount: (id: string) => invoke<void>('remove_account', { id }),
  refreshAuthToken: () => invoke<string | null>('refresh_auth_token'),

  // Loader
  getLoaderVersions: (loaderType: string) => invoke<string[]>('get_loader_versions', { loaderType }),
  installLoader: (
    loaderType: string,
    versionId: string,
    versionUrl: string,
    loaderVersion: string,
    instanceId: string,
  ) => invoke<LoaderInstallResult>('install_loader', { loaderType, versionId, versionUrl, loaderVersion, instanceId }),

  // Modrinth
  searchMods: (query: string, gameVersion?: string, loader?: string, limit?: number, offset?: number) =>
    invoke<[ModResult[], number]>('search_mods', { query, gameVersion, loader, limit, offset }),
  getPopularMods: (gameVersion?: string, limit?: number) =>
    invoke<ModResult[]>('get_popular_mods', { gameVersion, limit }),
  getModDetails: (slug: string) => invoke<ModResult>('get_mod_details', { slug }),
  getModVersions: (slug: string, gameVersion?: string, loader?: string) =>
    invoke<ModVersion[]>('get_mod_versions', { slug, gameVersion, loader }),

  getVersionById: (versionId: string) => invoke<ModVersion>('get_version_by_id', { versionId }),
  installMod: (fileUrl: string, filename: string, instanceId: string, sha1?: string) =>
    invoke<string>('install_mod', { fileUrl, filename, instanceId, sha1 }),

  installContent: (
    fileUrl: string,
    filename: string,
    instanceId: string,
    contentType?: string,
    sha1?: string,
    slug?: string,
    versionId?: string,
    source?: string,
  ) => invoke<string>('install_content', { fileUrl, filename, instanceId, contentType, sha1, slug, versionId, source }),
  getOptimizationPresets: () => invoke<OptimizationPreset[]>('get_optimization_presets_cmd'),
  applyOptimizationPreset: (instanceId: string, presetId: string) =>
    invoke<{ succeeded: number; failed: number; errors: string[] }>('apply_optimization_preset', {
      instanceId,
      presetId,
    }),

  // Marketplace
  searchContent: (
    query: string,
    contentType?: string,
    gameVersion?: string,
    loader?: string,
    sort?: string,
    limit?: number,
    offset?: number,
  ) =>
    invoke<[ModResult[], number]>('search_content', {
      query,
      contentType,
      gameVersion,
      loader,
      sort,
      limit,
      offset,
    }),

  getProjectDetails: (slug: string) => invoke<ModProjectFull>('get_project_details', { slug }),

  getTrendingContent: (projectType?: string, gameVersion?: string, limit?: number) =>
    invoke<ModResult[]>('get_trending_content', {
      projectType,
      gameVersion,
      limit,
    }),

  getRecentlyUpdated: (projectType?: string, limit?: number) =>
    invoke<ModResult[]>('get_recently_updated', {
      projectType,
      limit,
    }),

  // Content library
  listInstanceMods: (instanceId: string) => invoke<InstalledModInfo[]>('list_instance_mods', { instanceId }),

  listInstanceResourcepacks: (instanceId: string) => invoke<string[]>('list_instance_resourcepacks', { instanceId }),

  listInstanceShaders: (instanceId: string) => invoke<string[]>('list_instance_shaders', { instanceId }),

  listInstanceSaves: (instanceId: string) => invoke<WorldInfo[]>('list_instance_saves', { instanceId }),

  listInstanceLogs: (instanceId: string) => invoke<LogFileInfo[]>('list_instance_logs', { instanceId }),

  readLogFile: (instanceId: string, filename: string, maxLines?: number) =>
    invoke<string>('read_log_file', { instanceId, filename, maxLines }),

  removeInstalledMod: (instanceId: string, filename: string) =>
    invoke<void>('remove_installed_mod', { instanceId, filename }),

  getContentCounts: (instanceId: string) => invoke<ContentCounts>('get_content_counts', { instanceId }),

  checkContentUpdates: (instanceId: string) => invoke<UpdateInfo[]>('check_content_updates', { instanceId }),
  bulkUpdateContent: (instanceId: string) =>
    invoke<{ succeeded: number; failed: number; errors: string[] }>('bulk_update_content', { instanceId }),

  // Collections / wishlist
  addToCollection: (
    slug: string,
    title: string,
    author: string,
    iconUrl: string,
    contentType: string,
    description: string,
    downloads: number,
    categories: string[],
  ) =>
    invoke<void>('add_to_collection', {
      slug,
      title,
      author,
      iconUrl,
      contentType,
      description,
      downloads,
      categories,
    }),

  removeFromCollection: (slug: string) => invoke<void>('remove_from_collection', { slug }),

  isInCollection: (slug: string) => invoke<boolean>('is_in_collection', { slug }),

  listCollection: () => cachedInvoke('collection', () => invoke<CollectionItem[]>('list_collection'), 60_000),

  // CurseForge
  searchCfMods: (
    query: string,
    gameVersion?: string,
    category?: string,
    sort?: string,
    limit?: number,
    offset?: number,
  ) =>
    invoke<[ModResult[], number]>('search_cf_mods', {
      query,
      gameVersion,
      category,
      sort,
      limit,
      offset,
    }),

  getCfMod: (modId: number) => invoke<ModResult>('get_cf_mod', { modId }),

  getCfProjectDetails: (modId: number) => invoke<ModProjectFull>('get_cf_project_details', { modId }),

  getCfModVersions: (modId: number) => invoke<ModVersion[]>('get_cf_mod_versions', { modId }),

  getCfFeatured: () => invoke<ModResult[]>('get_cf_featured'),

  getCfModFiles: (modId: number) => invoke<ModFile[]>('get_cf_mod_files', { modId }),

  downloadCfMod: (
    fileUrl: string,
    filename: string,
    instanceId: string,
    contentType?: string,
    sha1?: string,
    slug?: string,
    versionId?: string,
  ) => invoke<string>('download_cf_mod', { fileUrl, filename, instanceId, contentType, sha1, slug, versionId }),

  // Quick start & UX
  quickStart: () => invoke<void>('quick_start'),
  selectFastestMirror: () => invoke<string>('select_fastest_mirror'),
  getSystemInfo: () => cachedInvoke('system_info', () => invoke<SystemInfo>('get_system_info'), 120_000),
  autoTuneMemory: () => invoke<number>('auto_tune_memory_cmd'),
  smartTuneMemory: (instanceId: string) => invoke<number>('smart_tune_memory_cmd', { instanceId }),
  getPlaytimeStats: () => cachedInvoke('playtime_stats', () => invoke<PlaytimeStats>('get_playtime_stats'), 60_000),
  recordPlaytime: (instanceId: string, seconds: number) => invoke<void>('record_playtime', { instanceId, seconds }),
  checkInstanceReady: (instanceId: string) => invoke<boolean>('check_instance_ready', { instanceId }),
  getInstanceCoverImage: (instanceId: string) => invoke<string | null>('get_instance_cover_image', { instanceId }),
  getLastPlayedInstance: () => invoke<GameInstance | null>('get_last_played_instance'),
  duplicateInstance: (instanceId: string, newName: string) =>
    invoke<GameInstance>('duplicate_instance', { id: instanceId, newName }),
  exportInstance: (instanceId: string, outputPath: string) =>
    invoke<void>('export_instance', { id: instanceId, outputPath }),
  importModpack: (path: string) => invoke<GameInstance>('import_modpack', { path }),
  importModpackAuto: (path: string) => invoke<GameInstance>('import_modpack_auto', { path }),
  detectModpackFormat: (path: string) => invoke<string>('detect_modpack_format', { path }),
  exportMrpack: (instanceId: string, outputPath: string) =>
    invoke<void>('export_mrpack', { id: instanceId, outputPath }),

  // Snapshots
  createSnapshot: (instanceId: string, name: string) =>
    invoke<{ id: string; name: string; created_at: string; size_bytes: number }>('create_snapshot', {
      instanceId,
      name,
    }),
  listSnapshots: (instanceId: string) =>
    invoke<Array<{ id: string; name: string; created_at: string; size_bytes: number }>>('list_snapshots', {
      instanceId,
    }),
  restoreSnapshot: (instanceId: string, snapshotId: string) =>
    invoke<void>('restore_snapshot', { instanceId, snapshotId }),
  deleteSnapshot: (instanceId: string, snapshotId: string) =>
    invoke<void>('delete_snapshot', { instanceId, snapshotId }),

  // Conflict detection
  checkModConflicts: (instanceId: string) =>
    invoke<Array<{ mod_a: string; mod_b: string; reason: string; severity: string }>>('check_mod_conflicts', {
      instanceId,
    }),

  // Server status
  pingServer: (address: string) => invoke<ServerStatus>('ping_server', { address }),

  // Instance config share
  exportInstanceConfig: (instanceId: string) => invoke<string>('export_instance_config', { instanceId }),
  importInstanceConfig: (configCode: string) => invoke<GameInstance>('import_instance_config', { configCode }),

  // Hardware profile
  getHardwareProfile: () =>
    cachedInvoke('hardware_profile', () => invoke<HardwareProfile>('get_hardware_profile'), 120_000),

  // Disk usage
  getDiskUsage: () => cachedInvoke('disk_usage', () => invoke<DiskUsage>('get_disk_usage'), 120_000),

  // File management
  listInstalledVersions: () =>
    invoke<Array<{ version_id: string; size_bytes: number; version_type: string; path: string }>>(
      'list_installed_versions',
    ),
  deleteVersion: (versionId: string) => invoke<void>('delete_version_cmd', { versionId }),
  getDirSize: (path: string) => invoke<number>('get_dir_size_cmd', { path }),

  // Recommendations
  getRecommendations: (instanceId: string) =>
    invoke<Array<{ slug: string; name: string; reason: string; category: string }>>('get_recommendations', {
      instanceId,
    }),

  // Migration
  checkMigrationReadiness: (instanceId: string, targetVersion: string) =>
    invoke<Array<{ mod_slug: string; mod_name: string; status: string; detail: string }>>('check_migration_readiness', {
      instanceId,
      targetVersion,
    }),

  // P2: Pre-warming
  warmupLaunch: (instanceId: string) => invoke<void>('warmup_launch', { instanceId }),

  // P2: Guest mode
  createGuestInstance: () => invoke<GameInstance>('create_guest_instance'),

  // P2: Screenshots
  listScreenshots: (instanceId: string) =>
    invoke<Array<{ filename: string; path: string; size_bytes: number; modified: string }>>('list_screenshots', {
      instanceId,
    }),

  // P2: Achievements
  getAchievements: () =>
    invoke<
      Array<{
        id: string;
        name: string;
        description: string;
        unlocked: boolean;
        unlocked_at: string | null;
        icon: string;
      }>
    >('get_achievements'),
  unlockAchievement: (achievementId: string) => invoke<void>('unlock_achievement', { achievementId }),

  // P2: Instance icon
  setInstanceIcon: (instanceId: string, iconPath: string) =>
    invoke<void>('set_instance_icon', { instanceId, iconPath }),

  // P2: Download scheduler
  getDownloadScheduleConfig: () =>
    invoke<{ max_speed_bytes: number; active_during_game: boolean; priority: string }>('get_download_schedule_config'),
  setDownloadScheduleConfig: (config: { max_speed_bytes: number; active_during_game: boolean; priority: string }) =>
    invoke<void>('set_download_schedule_config', { config }),

  // P2: GC tuning
  getGcRecommendations: (instanceId: string) =>
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
    >('get_gc_recommendations', { instanceId }),

  // P2: Anomaly detection
  detectAnomalies: (instanceId: string) =>
    invoke<Array<{ anomaly_type: string; severity: string; message: string; suggestion: string }>>('detect_anomalies', {
      instanceId,
    }),

  // P3: Battery
  getBatteryStatus: () => invoke<{ on_battery: boolean; percentage: number; charging: boolean }>('get_battery_status'),

  // P3: CLI
  cliLaunch: (instanceId: string) => invoke<void>('cli_launch', { instanceId }),

  // P3: Web API
  getWebApiStatus: () => invoke<{ running: boolean; port: number; token: string }>('get_web_api_status'),

  // Friends
  listFriends: () =>
    invoke<Array<{ id: string; name: string; status: string; current_game: string | null }>>('list_friends'),
  addFriend: (id: string, name: string) => invoke<void>('add_friend', { id, name }),
  removeFriend: (id: string) => invoke<void>('remove_friend', { id }),

  // LAN Discovery
  startLanDiscovery: () => invoke<void>('start_lan_discovery'),
  stopLanDiscovery: () => invoke<void>('stop_lan_discovery'),
  getLanWorlds: () =>
    invoke<
      Array<{
        host: string;
        port: number;
        motd: string;
        world_type: string | null;
        players_online: number | null;
        players_max: number | null;
      }>
    >('get_lan_worlds'),

  // P2P
  scanP2PPeers: () => invoke<Array<{ name: string; address: string; available_bytes: number }>>('scan_p2p_peers'),
  sendFileP2P: (peerAddress: string, filePath: string) => invoke<void>('send_file_p2p', { peerAddress, filePath }),

  // Discord RPC
  startDiscordRpc: () => invoke<void>('start_discord_rpc'),
  stopDiscordRpc: () => invoke<void>('stop_discord_rpc'),
  updateDiscordPresence: (details: string, state: string) =>
    invoke<void>('update_discord_presence', { details, state }),

  // Launch Profiling
  getLaunchProfilingData: (instanceId: string) =>
    invoke<Array<{ stage: string; duration_ms: number; details: string }>>('get_launch_profiling_data', { instanceId }),

  // Frame Time
  getFrameTimeData: (instanceId: string) =>
    invoke<{
      avg_fps: number;
      min_fps: number;
      max_fps: number;
      frame_times_ms: number[];
      stutter_count: number;
      analysis: string;
    }>('get_frame_time_data', { instanceId }),

  // NLP Search
  nlpSearchContent: (query: string) =>
    invoke<Array<{ slug: string; name: string; relevance: number; interpretation: string }>>('nlp_search_content', {
      query,
    }),

  // Minecraft News
  getMinecraftNews: () => invoke<MinecraftNewsEntry[]>('get_minecraft_news'),
  getMinecraftArticle: (url: string) => invoke<MinecraftArticle>('get_minecraft_article', { url }),

  // Terracotta Multiplayer
  downloadTerracotta: () => invoke<void>('download_terracotta'),
  isTerracottaInstalled: () => invoke<boolean>('is_terracotta_installed'),
  startTerracotta: () => invoke<number>('start_terracotta'),
  stopTerracotta: () => invoke<void>('stop_terracotta'),
  getTerracottaState: () => invoke<TerracottaState>('get_terracotta_state'),
  terracottaSetHost: () => invoke<void>('terracotta_set_host'),
  terracottaSetGuest: (room: string) => invoke<void>('terracotta_set_guest', { room }),
  terracottaSetIdle: () => invoke<void>('terracotta_set_idle'),

  getSecurityConfig: () => invoke<SecurityConfig>('get_security_config'),
  saveSecurityConfig: (security: SecurityConfig) => invoke<void>('save_security_config', { security }),
  getSecurityScore: () => invoke<number>('get_security_score'),
  getAuditLog: (category?: string, limit?: number, offset?: number) =>
    invoke<AuditEntry[]>('get_audit_log', { category, limit, offset }),
  getLoginHistory: () => invoke<LoginHistoryEntry[]>('get_login_history'),
  migrateCredentials: () => invoke<void>('migrate_credentials'),
  getEncryptionStatus: () => invoke<{ encrypted: boolean; plain: boolean }>('get_encryption_status'),
  saveApiKey: (name: string, value: string) => invoke<void>('save_api_key', { name, value }),
  deleteApiKey: (name: string) => invoke<void>('delete_api_key', { name }),
  getApiKeyStatus: (name: string) => invoke<KeyStatus>('get_api_key_status', { name }),
  checkFilePermissions: () => invoke<FilePermissionResult[]>('check_file_permissions'),
  fixFilePermissions: () => invoke<FilePermissionFixResult[]>('fix_file_permissions'),
  validateJvmArgs: (args: string) =>
    invoke<{ valid: boolean; args?: string[]; error?: string; warnings?: string[] }>('validate_jvm_args', { args }),
  getSandboxAvailability: () => invoke<SandboxAvailability>('get_sandbox_availability'),
};
export interface SystemInfo {
  total_ram_mb: number;
  used_ram_mb: number;
  cpu_name: string;
  cpu_count: number;
  java_version: string | null;
  os: string;
  arch: string;
}

export interface JreDownloadProgress {
  downloaded: number;
  total: number;
  version: number;
}

export interface CrashInfo {
  description: string;
  suggestion: string;
  severity: string;
  error_type: string;
}

export interface CrashFinding {
  finding: string;
  severity: string;
  category: string;
  detail: string;
}

export interface CrashDiagnosis {
  crash_info: CrashInfo;
  additional_findings: CrashFinding[];
  auto_fix_available: boolean;
  auto_fix_action: string | null;
}

export interface PresetMod {
  slug: string;
  name: string;
}

export interface OptimizationPreset {
  id: string;
  name: string;
  description: string;
  mods: PresetMod[];
  min_ram_mb: number;
  performance_level: string;
}

export interface PlaytimeStats {
  total_seconds: number;
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  top_instances: { id: string; name: string; seconds: number }[];
}

export interface ServerStatus {
  id: string;
  name: string;
  address: string;
  online: boolean;
  players_online: number;
  players_max: number;
  latency_ms: number;
  motd: string;
  version: string;
  favicon: string | null;
}

export interface FriendInfo {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'gaming' | 'away';
  current_game: string | null;
  avatar_url: string | null;
}

export interface HardwareProfile {
  cpu_name: string;
  cpu_count: number;
  total_ram_mb: number;
  gpu_name: string;
  performance_score: number;
  performance_level: string;
}

export interface MinecraftNewsEntry {
  title: string;
  category: string;
  date: string;
  text: string;
  read_more_link: string;
  id: string;
  image_url: string | null;
  tag: string | null;
  news_type: string[] | null;
}

export interface ArticleImage {
  url: string;
  caption: string | null;
}

export interface ArticleSection {
  heading: string | null;
  paragraphs: string[];
  images: ArticleImage[];
  list_items: string[];
}

export interface MinecraftArticle {
  title: string;
  subtitle: string | null;
  author: string | null;
  date: string | null;
  header_image: string | null;
  sections: ArticleSection[];
}

export interface TerracottaState {
  state: string;
  [key: string]: unknown;
}

export interface DiskUsage {
  total_bytes: number;
  instances_bytes: number;
  versions_bytes: number;
  libraries_bytes: number;
  assets_bytes: number;
  logs_bytes: number;
  other_bytes: number;
  breakdown: { name: string; bytes: number; path: string }[];
}
