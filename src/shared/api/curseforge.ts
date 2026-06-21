import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { ModResult, ModVersion, ModFile, ModProjectFull } from './types';

export const searchCfMods = (
  query: string,
  gameVersion?: string,
  category?: string,
  sort?: string,
  limit?: number,
  offset?: number,
) => invoke<[ModResult[], number]>('search_cf_mods', { query, gameVersion, category, sort, limit, offset });
export const getCfMod = (modId: number) => invoke<ModResult>('get_cf_mod', { modId });
export const getCfProjectDetails = (modId: number) => invoke<ModProjectFull>('get_cf_project_details', { modId });
export const getCfModVersions = (modId: number) => invoke<ModVersion[]>('get_cf_mod_versions', { modId });
export const getCfFeatured = () => invoke<ModResult[]>('get_cf_featured');
export const getCfModFiles = (modId: number) => invoke<ModFile[]>('get_cf_mod_files', { modId });
export const downloadCfMod = async (
  fileUrl: string,
  filename: string,
  instanceId: string,
  contentType?: string,
  sha1?: string,
  slug?: string,
  versionId?: string,
) => {
  const result = await invoke<string>('download_cf_mod', {
    fileUrl,
    filename,
    instanceId,
    contentType,
    sha1,
    slug,
    versionId,
  });
  // 通知插件 EventBus：mod 安装完成（mod-tools 等插件监听此事件）
  void emit('mod:installed', {
    instanceId,
    filename,
    slug,
    versionId,
    source: 'curseforge',
    contentType: contentType || 'mod',
    url: fileUrl,
  });
  return result;
};
