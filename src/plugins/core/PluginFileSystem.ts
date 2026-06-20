// src/plugins/core/PluginFileSystem.ts
import type { PluginFileSystem } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionValidator } from './PermissionValidator';

export function createPluginFileSystem(
  permissions: PermissionValidator,
  logger: { warn: (msg: string, ...args: unknown[]) => void },
): PluginFileSystem {
  const checkScope = (path: string): 'instances' | 'config' | 'global' => {
    // Simple scope detection based on path
    if (path.includes('instances') || path.includes('.minecraft')) return 'instances';
    if (path.includes('config')) return 'config';
    return 'global';
  };

  return {
    async readFile(path) {
      const scope = checkScope(path);
      if (!permissions.canFsRead(scope)) {
        logger.warn(`FS read denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot read ${scope}`);
      }
      return invoke<string>('read_config_file', { instanceId: '', relativePath: path });
    },

    async writeFile(path, content) {
      const scope = checkScope(path);
      if (!permissions.canFsWrite(scope)) {
        logger.warn(`FS write denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot write ${scope}`);
      }
      return invoke('write_config_file', { instanceId: '', relativePath: path, content });
    },

    async readDir(path) {
      const scope = checkScope(path);
      if (!permissions.canFsRead(scope)) {
        logger.warn(`FS readDir denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot read ${scope}`);
      }
      // TODO: 后端暂无通用列目录命令，list_instance_mods 返回类型不匹配
      // 后续阶段会在 plugin_proxy.rs 中添加 plugin_fs_read_dir 命令
      logger.warn(`FS readDir not yet implemented for path: ${path}`);
      return [];
    },

    async exists(path) {
      try {
        await invoke<string>('read_config_file', { instanceId: '', relativePath: path });
        return true;
      } catch {
        return false;
      }
    },
  };
}
