import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { cachedInvoke } from './cache';
import type {
  VersionEntry,
  LaunchState,
  RunningGameInfo,
  JreSourceInfo,
  JreRelease,
  JreDownloadProgress,
  DownloadProgressEvent,
  ContentDownloadProgress,
  ModpackImportProgress,
} from './types';

export function onDownloadProgress(callback: (progress: DownloadProgressEvent) => void) {
  return listen<DownloadProgressEvent>('download-progress', (event) => {
    callback(event.payload);
  });
}

export function onContentDownloadProgress(callback: (progress: ContentDownloadProgress) => void) {
  return listen<ContentDownloadProgress>('content-download-progress', (event) => {
    callback(event.payload);
  });
}

export function onModpackImportProgress(callback: (progress: ModpackImportProgress) => void) {
  return listen<ModpackImportProgress>('modpack-import-progress', (event) => {
    callback(event.payload);
  });
}

export function onJreDownloadProgress(callback: (p: JreDownloadProgress) => void) {
  return listen<JreDownloadProgress>('jre-download-progress', (event) => callback(event.payload));
}

export const checkJreAvailable = (majorVersion: number) => invoke<boolean>('check_jre_available', { majorVersion });
export const getJreSources = () => invoke<JreSourceInfo[]>('get_jre_sources');
export const fetchAvailableJreVersions = (majorVersion: number) =>
  invoke<JreRelease[]>('fetch_available_jre_versions', { majorVersion });
export const downloadJavaVersion = (majorVersion: number, source: string) =>
  invoke<string>('download_java_version', { majorVersion, source });
export const listDownloadedJres = () => invoke<number[]>('list_downloaded_jres');

export const getVersions = () => cachedInvoke('versions', () => invoke<VersionEntry[]>('get_versions'));
export const getLaunchState = () => invoke<LaunchState>('get_launch_state');
export const getInstanceLaunchState = (instanceId: string) =>
  invoke<LaunchState>('get_instance_launch_state', { instanceId });
export const getRunningGames = () => invoke<RunningGameInfo[]>('get_running_games');
export const resetLaunchState = () => invoke<void>('reset_launch_state');
export const resetInstanceLaunchState = (instanceId: string, force?: boolean) =>
  invoke<void>('reset_instance_launch_state', { instanceId, force });
export const cancelLaunch = (instanceId: string) => invoke<void>('cancel_launch', { instanceId });

export const pauseDownload = () => invoke<void>('pause_download');
export const resumeDownload = () => invoke<void>('resume_download');
export const cancelDownload = (url: string) => invoke<void>('cancel_download', { url });
export const isDownloadPaused = () => invoke<boolean>('is_download_paused');
