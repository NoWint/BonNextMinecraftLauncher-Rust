// src/app/hooks/usePluginContextMenuItems.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginContextMenuItems() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getContextMenuItems(),
  );
}
