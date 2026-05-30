import React, { createContext, useContext, useMemo, useEffect, useRef, useState } from 'react';
import { PluginManager } from './PluginManager';
import type { Plugin, ExtensionPoint } from './types';

interface PluginContextValue {
  manager: PluginManager;
  ready: boolean;
}

const PluginContext = createContext<PluginContextValue | null>(null);

interface PluginProviderProps {
  children: React.ReactNode;
  builtinPlugins?: Plugin[];
  extensionPoints?: ExtensionPoint[];
}

export function PluginProvider({ children, builtinPlugins = [], extensionPoints = [] }: PluginProviderProps) {
  const managerRef = useRef<PluginManager | null>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

  if (!managerRef.current) {
    managerRef.current = new PluginManager();
  }

  const manager = managerRef.current;

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    for (const point of extensionPoints) {
      manager.registerExtensionPoint(point);
    }

    for (const plugin of builtinPlugins) {
      manager.register(plugin);
    }

    manager
      .activateAll()
      .then(() => {
        setReady(true);
      })
      .catch((e: unknown) => {
        console.error('Failed to activate plugins:', e);
        setReady(true);
      });

    return () => {
      manager.deactivateAll().catch((e: unknown) => {
        console.error('Failed to deactivate plugins:', e);
      });
    };
  }, [manager, builtinPlugins, extensionPoints]);

  const contextValue = useMemo(() => ({ manager, ready }), [manager, ready]);

  return <PluginContext.Provider value={contextValue}>{children}</PluginContext.Provider>;
}

export function usePluginManager(): PluginManager {
  const ctx = useContext(PluginContext);
  if (!ctx) throw new Error('usePluginManager must be used within PluginProvider');
  return ctx.manager;
}

export function usePluginReady(): boolean {
  const ctx = useContext(PluginContext);
  if (!ctx) return false;
  return ctx.ready;
}
