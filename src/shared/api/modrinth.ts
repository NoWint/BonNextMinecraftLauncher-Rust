import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { ModResult, ModVersion, ModProjectFull, OptimizationPreset } from './types';

export const searchMods = (query: string, gameVersion?: string, loader?: string, limit?: number, offset?: number) =>
  invoke<[ModResult[], number]>('search_mods', { query, gameVersion, loader, limit, offset });
export const getPopularMods = (gameVersion?: string, limit?: number) =>
  invoke<ModResult[]>('get_popular_mods', { gameVersion, limit });
export const getModDetails = (slug: string) => invoke<ModResult>('get_mod_details', { slug });
export const getModVersions = (slug: string, gameVersion?: string, loader?: string) =>
  invoke<ModVersion[]>('get_mod_versions', { slug, gameVersion, loader });
export const getVersionById = (versionId: string) => invoke<ModVersion>('get_version_by_id', { versionId });
export const installMod = async (fileUrl: string, filename: string, instanceId: string, sha1?: string) => {
  const result = await invoke<string>('install_mod', { fileUrl, filename, instanceId, sha1 });
  // 通知插件 EventBus：mod 安装完成（mod-tools 等插件监听此事件）
  void emit('mod:installed', { instanceId, filename, url: fileUrl, contentType: 'mod' });
  return result;
};
export const installContent = async (
  fileUrl: string,
  filename: string,
  instanceId: string,
  contentType?: string,
  sha1?: string,
  slug?: string,
  versionId?: string,
  source?: string,
) => {
  const result = await invoke<string>('install_content', {
    fileUrl,
    filename,
    instanceId,
    contentType,
    sha1,
    slug,
    versionId,
    source,
  });
  void emit('mod:installed', {
    instanceId,
    filename,
    slug,
    versionId,
    source,
    contentType: contentType || 'mod',
    url: fileUrl,
  });
  return result;
};
export const getOptimizationPresets = () => invoke<OptimizationPreset[]>('get_optimization_presets_cmd');
export const applyOptimizationPreset = (instanceId: string, presetId: string) =>
  invoke<{ succeeded: number; failed: number; errors: string[] }>('apply_optimization_preset', {
    instanceId,
    presetId,
  });
export const searchContent = (
  query: string,
  contentType?: string,
  gameVersion?: string,
  loader?: string,
  sort?: string,
  limit?: number,
  offset?: number,
) => invoke<[ModResult[], number]>('search_content', { query, contentType, gameVersion, loader, sort, limit, offset });
export const getProjectDetails = (slug: string) => invoke<ModProjectFull>('get_project_details', { slug });
export const getTrendingContent = (projectType?: string, gameVersion?: string, limit?: number) =>
  invoke<ModResult[]>('get_trending_content', { projectType, gameVersion, limit });
export const getRecentlyUpdated = (projectType?: string, limit?: number) =>
  invoke<ModResult[]>('get_recently_updated', { projectType, limit });
export const batchGetProjects = (ids: string[]) => invoke<ModProjectFull[]>('batch_get_projects', { ids });
