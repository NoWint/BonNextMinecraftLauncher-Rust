// src/app/hooks/usePluginRoutes.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginRoutes() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => {
      const interval = setInterval(cb, 1000);
      return () => clearInterval(interval);
    },
    () => manager.getRoutes(),
  );
}
