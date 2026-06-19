// src/plugins/core/PluginHttpClient.ts
import type { PluginHttpClient } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionValidator } from './PermissionValidator';

export function createPluginHttpClient(
  permissions: PermissionValidator,
  logger: { warn: (msg: string, ...args: unknown[]) => void },
): PluginHttpClient {
  return {
    async get(url, options) {
      if (!permissions.canHttp(url)) {
        logger.warn(`HTTP GET denied (no permission): ${url}`);
        throw new Error(`Permission denied: cannot access ${new URL(url).hostname}`);
      }
      return invoke('plugin_http_get', {
        url,
        params: options?.params ?? null,
        headers: options?.headers ?? null,
      });
    },

    async post(url, body, options) {
      if (!permissions.canHttp(url)) {
        logger.warn(`HTTP POST denied (no permission): ${url}`);
        throw new Error(`Permission denied: cannot access ${new URL(url).hostname}`);
      }
      return invoke('plugin_http_post', {
        url,
        body,
        headers: options?.headers ?? null,
      });
    },
  };
}
