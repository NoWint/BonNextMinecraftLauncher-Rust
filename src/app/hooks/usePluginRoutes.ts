// src/app/hooks/usePluginRoutes.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginRoutes() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getRoutes(),
  );
}
