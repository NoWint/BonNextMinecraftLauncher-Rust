import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { api, type AppConfig } from '../api';

interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  error: string;
}

type ConfigAction =
  | { type: 'SET_CONFIG'; config: AppConfig }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string };

export function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.config, loading: false, error: '' };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    default:
      return state;
  }
}

const ConfigContext = createContext<{
  state: ConfigState;
  saveConfig: (config: AppConfig) => Promise<void>;
  reloadConfig: () => Promise<void>;
} | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(configReducer, { config: null, loading: true, error: '' });

  const reloadConfig = useCallback(async () => {
    try {
      const c = await api.getConfig();
      dispatch({ type: 'SET_CONFIG', config: c });
    } catch (e) {
      dispatch({ type: 'SET_LOADING', loading: false });
      dispatch({ type: 'SET_ERROR', error: e instanceof Error ? e.message : 'Failed to load config' });
    }
  }, []);

  useEffect(() => {
    reloadConfig();
  }, [reloadConfig]);

  const saveConfig = useCallback(
    async (config: AppConfig) => {
      const previousConfig = state.config;
      dispatch({ type: 'SET_CONFIG', config });
      try {
        await api.saveConfig(config);
      } catch (e) {
        if (previousConfig) {
          dispatch({ type: 'SET_CONFIG', config: previousConfig });
        }
        dispatch({ type: 'SET_ERROR', error: e instanceof Error ? e.message : 'Failed to save config' });
      }
    },
    [state.config],
  );

  const contextValue = useMemo(
    () => ({
      state,
      saveConfig,
      reloadConfig,
    }),
    [state, saveConfig, reloadConfig],
  );

  return <ConfigContext.Provider value={contextValue}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
