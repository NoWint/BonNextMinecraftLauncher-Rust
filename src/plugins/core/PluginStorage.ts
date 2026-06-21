// src/plugins/core/PluginStorage.ts
import type { PluginStorage } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { PluginSession } from './PluginSession';

export function createPluginStorage(session: PluginSession): PluginStorage {
  return {
    async get(key) {
      try {
        const value = await invoke<string | null>('plugin_storage_get', {
          token: session.getToken(),
          key,
        });
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },

    async set(key, value) {
      await invoke('plugin_storage_set', {
        token: session.getToken(),
        key,
        value: JSON.stringify(value),
      });
    },

    async delete(key) {
      await invoke('plugin_storage_delete', { token: session.getToken(), key });
    },
  };
}
