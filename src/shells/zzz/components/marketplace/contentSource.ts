import { api, type ModResult } from '../../../../shared/api';
import type { ContentType, DataSource } from './types';
import { PAGE_SIZE } from './types';

export interface SearchParams {
  query: string;
  contentType: ContentType;
  gameVersion?: string;
  loader?: string;
  tags: string[];
  sortBy: string;
  limit?: number;
  offset: number;
}

export interface DiscoverData {
  featured: ModResult[];
  trending: ModResult[];
  recent: ModResult[];
}

/**
 * Search content across the given source. Returns results and total hit count.
 * CurseForge uses category (first tag) instead of loader; Modrinth uses loader.
 */
export async function searchContent(
  source: DataSource,
  { query, contentType, gameVersion, loader, tags, sortBy, limit = PAGE_SIZE, offset }: SearchParams,
): Promise<[ModResult[], number]> {
  if (source === 'curseforge') {
    return api.searchCfMods(
      query,
      gameVersion || undefined,
      tags[0] || undefined,
      sortBy,
      limit,
      offset,
    );
  }
  return api.searchContent(
    query,
    contentType,
    gameVersion || undefined,
    loader || undefined,
    sortBy,
    limit,
    offset,
  );
}

/**
 * Get browse/trending content when no search query is provided.
 * CurseForge returns featured items; Modrinth returns trending content.
 */
export async function getBrowseContent(
  source: DataSource,
  contentType: ContentType,
  gameVersion?: string,
  limit: number = PAGE_SIZE,
): Promise<ModResult[]> {
  if (source === 'curseforge') {
    return api.getCfFeatured();
  }
  return api.getTrendingContent(contentType, gameVersion, limit);
}

/**
 * Get discover page data: featured banner, trending row, recently updated row.
 * CurseForge lacks a "recently updated" endpoint, so recent is empty for CF.
 */
export async function getDiscoverData(
  source: DataSource,
  contentType: ContentType,
): Promise<DiscoverData> {
  if (source === 'curseforge') {
    const cfData = await api.getCfFeatured();
    return {
      featured: cfData.slice(0, 5),
      trending: cfData.slice(0, 10),
      recent: [],
    };
  }
  const [trending, recent] = await Promise.all([
    api.getTrendingContent(contentType, undefined, 10),
    api.getRecentlyUpdated(contentType, 10),
  ]);
  return {
    featured: trending.slice(0, 5),
    trending,
    recent,
  };
}
