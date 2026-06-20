// src/app/hooks/usePluginSettingsSections.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginSettingsSections() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getSettingsSections(),
  );
}
