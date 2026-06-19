// src/app/hooks/usePluginSettingsSections.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginSettingsSections() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => {
      const interval = setInterval(cb, 1000);
      return () => clearInterval(interval);
    },
    () => manager.getSettingsSections(),
  );
}
