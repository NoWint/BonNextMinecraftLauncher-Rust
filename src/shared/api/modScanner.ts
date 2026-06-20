import { invoke } from '@tauri-apps/api/core';

export interface ScanResult {
  file_name: string;
  file_hash: string;
  project_id: string | null;
  project_name: string | null;
  project_slug: string | null;
  source: 'Modrinth' | 'CurseForge' | 'Fallback';
  project_type: string | null;
  icon_url: string | null;
}

export interface ModCacheStats {
  total: number;
  modrinth_hits: number;
  curseforge_hits: number;
  fallbacks: number;
}

export interface UrlConfigSnapshot {
  git_proxy_enabled: boolean;
  git_proxy_url: string;
}

export async function scanModFile(path: string): Promise<ScanResult> {
  return invoke<ScanResult>('scan_mod_file', { path });
}

export async function scanModsDirectory(instanceId: string): Promise<ScanResult[]> {
  return invoke<ScanResult[]>('scan_mods_directory', { instanceId });
}

export async function clearModCache(): Promise<void> {
  return invoke('clear_mod_cache');
}

export async function getModCacheStats(): Promise<ModCacheStats> {
  return invoke<ModCacheStats>('get_mod_cache_stats');
}

export async function getUrlConfig(): Promise<UrlConfigSnapshot> {
  return invoke<UrlConfigSnapshot>('get_url_config');
}

export interface ModUpdateInfo {
  file_name: string;
  project_id: string;
  project_slug: string | null;
  current_hash: string;
  latest_hash: string;
  latest_version: string;
  latest_version_id: string;
  download_url: string;
}

export async function checkModUpdates(instanceId: string): Promise<ModUpdateInfo[]> {
  return invoke<ModUpdateInfo[]>('check_mod_updates', { instanceId });
}

export async function watchInstanceMods(instanceId: string): Promise<void> {
  return invoke('watch_instance_mods', { instanceId });
}

export async function unwatchInstanceMods(instanceId: string): Promise<void> {
  return invoke('unwatch_instance_mods', { instanceId });
}

export async function setGitProxy(enabled: boolean, proxyUrl?: string): Promise<void> {
  return invoke('set_git_proxy', { enabled, proxyUrl });
}
