// src/plugins/core/PluginFileSystem.ts
import type { PluginFileSystem } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionValidator } from './PermissionValidator';
import type { PluginSession } from './PluginSession';

type FsScope = 'instances' | 'config' | 'global';

/**
 * Detect the filesystem scope from a path prefix and split it into the
 * scope + a path relative to that scope's root. The backend performs the
 * final canonicalization check, so this is only for permission gating.
 *
 * Conventions:
 *   `instances/...` → scope `instances`, root = game_dir/instances
 *   `config/...`    → scope `config`,    root = config_dir
 *   anything else   → scope `global`,    root = game_dir
 */
const checkScope = (path: string): { scope: FsScope; relativePath: string } => {
  const normalized = path.replace(/^\/+/, '');
  if (normalized === 'instances' || normalized.startsWith('instances/')) {
    return {
      scope: 'instances',
      relativePath: normalized.slice('instances'.length).replace(/^\/+/, ''),
    };
  }
  if (normalized === 'config' || normalized.startsWith('config/')) {
    return {
      scope: 'config',
      relativePath: normalized.slice('config'.length).replace(/^\/+/, ''),
    };
  }
  return { scope: 'global', relativePath: normalized };
};

export function createPluginFileSystem(
  permissions: PermissionValidator,
  logger: { warn: (msg: string, ...args: unknown[]) => void },
  session: PluginSession,
): PluginFileSystem {
  return {
    async readFile(path) {
      const { scope, relativePath } = checkScope(path);
      if (!permissions.canFsRead(scope)) {
        logger.warn(`FS read denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot read ${scope}`);
      }
      return invoke<string>('plugin_fs_read', {
        token: session.getToken(),
        scope,
        path: relativePath,
      });
    },

    async writeFile(path, content) {
      const { scope, relativePath } = checkScope(path);
      if (!permissions.canFsWrite(scope)) {
        logger.warn(`FS write denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot write ${scope}`);
      }
      return invoke('plugin_fs_write', {
        token: session.getToken(),
        scope,
        path: relativePath,
        content,
      });
    },

    async readDir(path) {
      const { scope, relativePath } = checkScope(path);
      if (!permissions.canFsRead(scope)) {
        logger.warn(`FS readDir denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot read ${scope}`);
      }
      return invoke<string[]>('plugin_fs_read_dir', {
        token: session.getToken(),
        scope,
        path: relativePath,
      });
    },

    async exists(path) {
      const { scope, relativePath } = checkScope(path);
      if (!permissions.canFsRead(scope)) {
        logger.warn(`FS exists denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot read ${scope}`);
      }
      return invoke<boolean>('plugin_fs_exists', {
        token: session.getToken(),
        scope,
        path: relativePath,
      });
    },
  };
}
