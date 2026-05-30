import { invoke } from '@tauri-apps/api/core';
import type { ModResult, ModProjectFull } from './types';

export const modpackindexApi = {
  // Mods
  searchMods: (query: string, limit?: number, page?: number) =>
    invoke<[ModResult[], number]>('search_mpi_mods', { query, limit, page }),

  getMod: (modId: number) => invoke<ModProjectFull>('get_mpi_mod', { modId }),

  getModModpacks: (modId: number, limit?: number, page?: number) =>
    invoke<[ModResult[], number]>('get_mpi_mod_modpacks', { modId, limit, page }),

  // Modpacks
  searchModpacks: (query: string, limit?: number, page?: number) =>
    invoke<[ModResult[], number]>('search_mpi_modpacks', { query, limit, page }),

  getModpack: (modpackId: number) => invoke<ModProjectFull>('get_mpi_modpack', { modpackId }),

  getModpackMods: (modpackId: number) => invoke<ModResult[]>('get_mpi_modpack_mods', { modpackId }),

  // Popular
  getPopularMods: (limit?: number) => invoke<ModResult[]>('get_mpi_popular_mods', { limit }),

  getPopularModpacks: (limit?: number) => invoke<ModResult[]>('get_mpi_popular_modpacks', { limit }),

  // Categories
  getCategories: () => invoke<[number, string, string][]>('get_mpi_categories'),

  getCategoryMods: (categoryId: number, limit?: number, page?: number) =>
    invoke<[ModResult[], number]>('get_mpi_category_mods', { categoryId, limit, page }),
};
