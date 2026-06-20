// src/app/hooks/usePluginInstanceTabs.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginInstanceTabs() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getInstanceTabs(),
  );
}
