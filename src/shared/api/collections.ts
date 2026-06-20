import { invoke } from '@tauri-apps/api/core';
import { cachedInvoke } from './cache';
import type { CollectionItem } from './types';

export const addToCollection = (
  slug: string,
  title: string,
  author: string,
  iconUrl: string,
  contentType: string,
  description: string,
  downloads: number,
  categories: string[],
) =>
  invoke<void>('add_to_collection', { slug, title, author, iconUrl, contentType, description, downloads, categories });
export const removeFromCollection = (slug: string) => invoke<void>('remove_from_collection', { slug });
export const isInCollection = (slug: string) => invoke<boolean>('is_in_collection', { slug });
export const listCollection = () => cachedInvoke('collection', () => invoke<CollectionItem[]>('list_collection'));
