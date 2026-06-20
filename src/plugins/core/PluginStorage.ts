// src/plugins/core/PluginStorage.ts
import type { PluginStorage } from './types';
import { invoke } from '@tauri-apps/api/core';

export function createPluginStorage(pluginId: string): PluginStorage {
  const getStorageKey = (key: string) => `plugin:${pluginId}:${key}`;

  return {
    async get(key: string): Promise<unknown> {
      try {
        const value = await invoke<string | null>('plugin_storage_get', { key: getStorageKey(key) });
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },

    async set(key: string, value: unknown): Promise<void> {
      await invoke('plugin_storage_set', { key: getStorageKey(key), value: JSON.stringify(value) });
    },

    async delete(key: string): Promise<void> {
      await invoke('plugin_storage_delete', { key: getStorageKey(key) });
    },
  };
}
