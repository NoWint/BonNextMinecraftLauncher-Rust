import { invoke } from '@tauri-apps/api/core';
import type { ModResult, ModVersion, ModProjectFull, OptimizationPreset } from './types';

export const searchMods = (query: string, gameVersion?: string, loader?: string, limit?: number, offset?: number) =>
  invoke<[ModResult[], number]>('search_mods', { query, gameVersion, loader, limit, offset });
export const getPopularMods = (gameVersion?: string, limit?: number) =>
  invoke<ModResult[]>('get_popular_mods', { gameVersion, limit });
export const getModDetails = (slug: string) => invoke<ModResult>('get_mod_details', { slug });
export const getModVersions = (slug: string, gameVersion?: string, loader?: string) =>
  invoke<ModVersion[]>('get_mod_versions', { slug, gameVersion, loader });
export const getVersionById = (versionId: string) => invoke<ModVersion>('get_version_by_id', { versionId });
export const installMod = (fileUrl: string, filename: string, instanceId: string, sha1?: string) =>
  invoke<string>('install_mod', { fileUrl, filename, instanceId, sha1 });
export const installContent = (
  fileUrl: string,
  filename: string,
  instanceId: string,
  contentType?: string,
  sha1?: string,
  slug?: string,
  versionId?: string,
  source?: string,
) => invoke<string>('install_content', { fileUrl, filename, instanceId, contentType, sha1, slug, versionId, source });
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
