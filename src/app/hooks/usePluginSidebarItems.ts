// src/app/hooks/usePluginSidebarItems.ts
import { useSyncExternalStore } from 'react';
import { usePluginManager } from './usePluginManager';

export function usePluginSidebarItems() {
  const manager = usePluginManager();
  return useSyncExternalStore(
    (cb) => {
      // Simple: re-render on any plugin state change
      // A more sophisticated approach would use a selector + diff
      const interval = setInterval(cb, 1000);
      return () => clearInterval(interval);
    },
    () => manager.getSidebarItems(),
  );
}
