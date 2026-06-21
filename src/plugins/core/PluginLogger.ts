// src/plugins/core/PluginLogger.ts
import type { PluginLogger } from './types';
import { log } from '@/shared/utils/logger';

export function createPluginLogger(pluginId: string): PluginLogger {
  const tag = `[plugin:${pluginId}]`;
  const category = `plugin:${pluginId}`;
  return {
    info(message: string, ...args: unknown[]) {
      log('info', category, `${tag} ${message}`, args.length > 0 ? args : undefined);
    },
    warn(message: string, ...args: unknown[]) {
      log('warn', category, `${tag} ${message}`, args.length > 0 ? args : undefined);
    },
    error(message: string, ...args: unknown[]) {
      log('error', category, `${tag} ${message}`, args.length > 0 ? args : undefined);
    },
  };
}
