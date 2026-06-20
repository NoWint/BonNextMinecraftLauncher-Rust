// src/app/hooks/useAllPlugins.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';
import type { RegisteredPlugin } from '../../plugins/core/types';

export function useAllPlugins(): RegisteredPlugin[] {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getAllPlugins(),
  );
}
