import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DownloadProgressEvent {
  completed: number;
  total: number;
  bytes_downloaded: number;
  current_url: string;
  phase: string;
  finished: boolean;
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

export const api = {
  onDownloadProgress: (callback: (progress: DownloadProgressEvent) => void) => {
    return listen<DownloadProgressEvent>('download-progress', (event) => {
      callback(event.payload);
    });
  },

  getVersions: () => invoke<VersionEntry[]>('get_versions'),
  getLaunchState: () => invoke<LaunchState>('get_launch_state'),
  resetLaunchState: () => invoke<void>('reset_launch_state'),
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: (config: AppConfig) => invoke<void>('save_config', { config }),
  findJava: () => invoke<string>('find_java'),
  checkJavaVersion: (javaPath: string) => invoke<number | null>('check_java_version', { javaPath }),
  offlineLogin: (username: string) => invoke<OfflineAuthResult>('offline_login', { username }),
  startMicrosoftAuth: () => invoke<DeviceCodeResponse>('start_microsoft_auth'),
  pollMicrosoftAuth: (deviceCode: string) => invoke<MicrosoftAuthResult>('poll_microsoft_auth', { deviceCode }),
  downloadVersion: (versionId: string, versionUrl: string) => invoke<void>('download_version', { versionId, versionUrl }),
  launchGame: (versionId: string, versionUrl: string, username: string, uuid: string, accessToken: string, maxMemory?: number, minMemory?: number, javaPath?: string, jvmArgs?: string) =>
    invoke<void>('launch_game', { versionId, versionUrl, username, uuid, accessToken, maxMemory, minMemory, javaPath, jvmArgs }),
  getGameDir: () => invoke<string>('get_game_dir'),
  getDefaultGameDir: () => invoke<string>('get_default_game_dir'),
  listInstances: () => invoke<GameInstance[]>('list_instances'),
  createInstance: (instance: GameInstance) => invoke<void>('create_instance', { instance }),
  deleteInstance: (id: string) => invoke<void>('delete_instance', { id }),
  updateInstance: (instance: GameInstance) => invoke<void>('update_instance', { instance }),
  getInstance: (id: string) => invoke<GameInstance | null>('get_instance', { id }),
  openFolder: (path: string) => invoke<void>('open_folder', { path }),

  // Account management
  listAccounts: () => invoke<StoredAccount[]>('list_accounts'),
  getActiveAccount: () => invoke<StoredAccount | null>('get_active_account'),
  setActiveAccount: (id: string) => invoke<void>('set_active_account', { id }),
  removeAccount: (id: string) => invoke<void>('remove_account', { id }),
  refreshAuthToken: () => invoke<string | null>('refresh_auth_token'),

  // Loader
  getLoaderVersions: (loaderType: string) => invoke<string[]>('get_loader_versions', { loaderType }),
  installLoader: (loaderType: string, versionId: string, versionUrl: string, loaderVersion: string, instanceId: string) =>
    invoke<LoaderInstallResult>('install_loader', { loaderType, versionId, versionUrl, loaderVersion, instanceId }),

  // Modrinth
  searchMods: (query: string, gameVersion?: string, loader?: string, limit?: number, offset?: number) =>
    invoke<[ModResult[], number]>('search_mods', { query, gameVersion, loader, limit, offset }),
  getPopularMods: (gameVersion?: string, limit?: number) =>
    invoke<ModResult[]>('get_popular_mods', { gameVersion, limit }),
  getModDetails: (slug: string) => invoke<ModResult>('get_mod_details', { slug }),
  getModVersions: (slug: string, gameVersion?: string, loader?: string) =>
    invoke<ModVersion[]>('get_mod_versions', { slug, gameVersion, loader }),

  getVersionById: (versionId: string) =>
    invoke<ModVersion>('get_version_by_id', { versionId }),
  installMod: (fileUrl: string, filename: string, instanceId: string, sha1?: string) =>
    invoke<string>('install_mod', { fileUrl, filename, instanceId, sha1 }),

  installContent: (
    fileUrl: string, filename: string, instanceId: string,
    contentType?: string, sha1?: string, slug?: string, versionId?: string,
  ) => invoke<string>('install_content', { fileUrl, filename, instanceId, contentType, sha1, slug, versionId }),

  // Marketplace
  searchContent: (
    query: string,
    contentType?: string,
    gameVersion?: string,
    loader?: string,
    sort?: string,
    limit?: number,
    offset?: number,
  ) => invoke<[ModResult[], number]>('search_content', {
    query, contentType, gameVersion, loader, sort, limit, offset,
  }),

  getProjectDetails: (slug: string) =>
    invoke<ModProjectFull>('get_project_details', { slug }),

  getTrendingContent: (
    projectType?: string,
    gameVersion?: string,
    limit?: number,
  ) => invoke<ModResult[]>('get_trending_content', {
    projectType, gameVersion, limit,
  }),

  getRecentlyUpdated: (
    projectType?: string,
    limit?: number,
  ) => invoke<ModResult[]>('get_recently_updated', {
    projectType, limit,
  }),

  // Content library
  listInstanceMods: (instanceId: string) =>
    invoke<InstalledModInfo[]>('list_instance_mods', { instanceId }),

  listInstanceResourcepacks: (instanceId: string) =>
    invoke<string[]>('list_instance_resourcepacks', { instanceId }),

  listInstanceShaders: (instanceId: string) =>
    invoke<string[]>('list_instance_shaders', { instanceId }),

  removeInstalledMod: (instanceId: string, filename: string) =>
    invoke<void>('remove_installed_mod', { instanceId, filename }),

  getContentCounts: (instanceId: string) =>
    invoke<ContentCounts>('get_content_counts', { instanceId }),

  checkContentUpdates: (instanceId: string) =>
    invoke<UpdateInfo[]>('check_content_updates', { instanceId }),

  // Collections / wishlist
  addToCollection: (
    slug: string, title: string, author: string, iconUrl: string,
    contentType: string, description: string, downloads: number,
    categories: string[],
  ) => invoke<void>('add_to_collection', {
    slug, title, author, iconUrl, contentType, description, downloads, categories,
  }),

  removeFromCollection: (slug: string) =>
    invoke<void>('remove_from_collection', { slug }),

  isInCollection: (slug: string) =>
    invoke<boolean>('is_in_collection', { slug }),

  listCollection: () =>
    invoke<CollectionItem[]>('list_collection'),

  // CurseForge
  searchCfMods: (
    query: string, gameVersion?: string, category?: string,
    sort?: string, limit?: number, offset?: number,
  ) => invoke<[ModResult[], number]>('search_cf_mods', {
    query, gameVersion, category, sort, limit, offset,
  }),

  getCfMod: (modId: number) =>
    invoke<ModResult>('get_cf_mod', { modId }),

  getCfFeatured: () =>
    invoke<ModResult[]>('get_cf_featured'),

  getCfModFiles: (modId: number) =>
    invoke<ModFile[]>('get_cf_mod_files', { modId }),

  downloadCfMod: (fileUrl: string, filename: string, instanceId: string) =>
    invoke<string>('download_cf_mod', { fileUrl, filename, instanceId }),

  // Quick start & UX
  quickStart: () => invoke<void>('quick_start'),
  selectFastestMirror: () => invoke<string>('select_fastest_mirror'),
  getSystemInfo: () => invoke<SystemInfo>('get_system_info'),
  autoTuneMemory: () => invoke<number>('auto_tune_memory_cmd'),
  checkInstanceReady: (instanceId: string) => invoke<boolean>('check_instance_ready', { instanceId }),
  duplicateInstance: (instanceId: string, newName: string) => invoke<GameInstance>('duplicate_instance', { id: instanceId, newName }),
  exportInstance: (instanceId: string, outputPath: string) => invoke<void>('export_instance', { id: instanceId, outputPath }),
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
