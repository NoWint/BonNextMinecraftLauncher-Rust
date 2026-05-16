import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api, type AppConfig } from '../api';

interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
}

type ConfigAction =
  | { type: 'SET_CONFIG'; config: AppConfig }
  | { type: 'SET_LOADING'; loading: boolean };

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.config, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
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
  const [state, dispatch] = useReducer(configReducer, { config: null, loading: true });

  const reloadConfig = useCallback(async () => {
    try {
      const c = await api.getConfig();
      dispatch({ type: 'SET_CONFIG', config: c });
    } catch { dispatch({ type: 'SET_LOADING', loading: false }); }
  }, []);

  useEffect(() => { reloadConfig(); }, [reloadConfig]);

  const saveConfig = useCallback(async (config: AppConfig) => {
    await api.saveConfig(config);
    dispatch({ type: 'SET_CONFIG', config });
  }, []);

  return (
    <ConfigContext.Provider value={{ state, saveConfig, reloadConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
