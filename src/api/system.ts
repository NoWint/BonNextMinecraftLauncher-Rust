import { invoke } from '@tauri-apps/api/core';
import { cachedInvoke } from './cache';
import type {
  SystemInfo,
  HardwareProfile,
  DiskUsage,
  ServerStatus,
  PlaytimeStats,
  MinecraftNewsEntry,
  MinecraftArticle,
  TerracottaState,
  AppUpdateInfo,
  JreVersionInfo,
  RecommendedConfig,
} from './types';

export const quickStart = () => invoke<void>('quick_start');
export const selectFastestMirror = () => invoke<string>('select_fastest_mirror');
export const getActiveDownloadSource = () => invoke<string>('get_active_download_source');
export const getSystemInfo = () => cachedInvoke('system_info', () => invoke<SystemInfo>('get_system_info'));
export const autoTuneMemory = () => invoke<number>('auto_tune_memory_cmd');
export const getPlaytimeStats = () => cachedInvoke('playtime_stats', () => invoke<PlaytimeStats>('get_playtime_stats'));
export const pingServer = (address: string) => invoke<ServerStatus>('ping_server', { address });
export const getHardwareProfile = () =>
  cachedInvoke('hardware_profile', () => invoke<HardwareProfile>('get_hardware_profile'));
export const getDiskUsage = () => cachedInvoke('disk_usage', () => invoke<DiskUsage>('get_disk_usage'));
export const listInstalledVersions = () =>
  invoke<Array<{ version_id: string; size_bytes: number; version_type: string; path: string }>>(
    'list_installed_versions',
  );
export const deleteVersion = (versionId: string) => invoke<void>('delete_version_cmd', { versionId });
export const getDirSize = (path: string) => invoke<number>('get_dir_size_cmd', { path });
export const getBatteryStatus = () =>
  invoke<{ on_battery: boolean; percentage: number; charging: boolean }>('get_battery_status');
export const cliLaunch = (instanceId: string) => invoke<void>('cli_launch', { instanceId });
export const getWebApiStatus = () => invoke<{ running: boolean; port: number; token: string }>('get_web_api_status');
export const listFriends = () =>
  invoke<Array<{ id: string; name: string; status: string; current_game: string | null }>>('list_friends');
export const addFriend = (id: string, name: string) => invoke<void>('add_friend', { id, name });
export const removeFriend = (id: string) => invoke<void>('remove_friend', { id });
export const startLanDiscovery = () => invoke<void>('start_lan_discovery');
export const stopLanDiscovery = () => invoke<void>('stop_lan_discovery');
export const getLanWorlds = () =>
  invoke<
    Array<{
      host: string;
      port: number;
      motd: string;
      world_type: string | null;
      players_online: number | null;
      players_max: number | null;
    }>
  >('get_lan_worlds');
export const scanP2PPeers = () =>
  invoke<Array<{ name: string; address: string; available_bytes: number }>>('scan_p2p_peers');
export const sendFileP2P = (peerAddress: string, filePath: string) =>
  invoke<void>('send_file_p2p', { peerAddress, filePath });
export const startDiscordRpc = () => invoke<void>('start_discord_rpc');
export const stopDiscordRpc = () => invoke<void>('stop_discord_rpc');
export const updateDiscordPresence = (details: string, state: string) =>
  invoke<void>('update_discord_presence', { details, state });
export const nlpSearchContent = (query: string) =>
  invoke<Array<{ slug: string; name: string; relevance: number; interpretation: string }>>('nlp_search_content', {
    query,
  });
export const getMinecraftNews = () => invoke<MinecraftNewsEntry[]>('get_minecraft_news');
export const getMinecraftArticle = (url: string) => invoke<MinecraftArticle>('get_minecraft_article', { url });
export const openUrl = (url: string) => invoke<void>('open_url', { url });
export const downloadTerracotta = () => invoke<void>('download_terracotta');
export const isTerracottaInstalled = () => invoke<boolean>('is_terracotta_installed');
export const startTerracotta = () => invoke<number>('start_terracotta');
export const stopTerracotta = () => invoke<void>('stop_terracotta');
export const getTerracottaState = () => invoke<TerracottaState>('get_terracotta_state');
export const terracottaSetHost = () => invoke<void>('terracotta_set_host');
export const terracottaSetGuest = (room: string) => invoke<void>('terracotta_set_guest', { room });
export const terracottaSetIdle = () => invoke<void>('terracotta_set_idle');
export const getDownloadScheduleConfig = () =>
  invoke<{ max_speed_bytes: number; active_during_game: boolean; priority: string }>('get_download_schedule_config');
export const setDownloadScheduleConfig = (config: {
  max_speed_bytes: number;
  active_during_game: boolean;
  priority: string;
}) => invoke<void>('set_download_schedule_config', { config });
export const getAchievements = () =>
  invoke<
    Array<{
      id: string;
      name: string;
      description: string;
      unlocked: boolean;
      unlocked_at: string | null;
      icon: string;
      rarity: string;
    }>
  >('get_achievements');
export const unlockAchievement = (achievementId: string) => invoke<void>('unlock_achievement', { achievementId });
export const checkAchievements = () => invoke<string[]>('check_achievements');

export const checkForUpdates = () => invoke<AppUpdateInfo | null>('check_for_updates');
export const installUpdate = () => invoke<void>('install_update');

export const autoSelectJre = (instanceId: string) =>
  invoke<{ java_version: number; java_path: string | null; needs_download: boolean }>('auto_select_jre', {
    instanceId,
  });
export const downloadJreVersionCmd = (javaVersion: number) =>
  invoke<string>('download_jre_version_cmd', { javaVersion });
export const listJreVersions = () => invoke<JreVersionInfo[]>('list_jre_versions');
export const getCachedImage = (url: string) => invoke<string>('get_cached_image', { url });
export const getRecommendedConfig = () => invoke<RecommendedConfig>('get_recommended_config');

export interface UrlConfigSnapshot {
  git_proxy_enabled: boolean;
  git_proxy_url: string;
}

export const getUrlConfig = () => invoke<UrlConfigSnapshot>('get_url_config');
export const setGitProxy = (enabled: boolean, proxyUrl: string | null) =>
  invoke<void>('set_git_proxy', { enabled, proxyUrl: proxyUrl });
