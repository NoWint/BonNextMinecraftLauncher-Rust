// src/plugins/core/PluginProvider.tsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { PluginManager } from './PluginManager';

interface PluginProviderContext {
  manager: PluginManager;
  ready: boolean;
}

const Context = createContext<PluginProviderContext | null>(null);

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => new PluginManager());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Register and activate built-in plugins
      // (Built-in plugins will be added in later phases)
      await manager.activateAll();
      if (!cancelled) {
        setReady(true);
      }
    }

    init();

    return () => {
      cancelled = true;
      manager.deactivateAll();
    };
  }, [manager]);

  const value = useMemo(() => ({ manager, ready }), [manager, ready]);

  return React.createElement(Context.Provider, { value }, children);
}

export function usePluginManager(): PluginManager {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error('usePluginManager must be used within PluginProvider');
  }
  return ctx.manager;
}

export function usePluginReady(): boolean {
  const ctx = useContext(Context);
  return ctx?.ready ?? false;
}
