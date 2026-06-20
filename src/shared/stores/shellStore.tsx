import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ShellDefinition } from '../types/shell';
import type { CustomShellMeta } from '../types/custom-shell';
import { api } from '../api';
import { getAllShells, registerCustomShell, clearCustomShells, unregisterShell } from '../../shell-registry';
import { customShellToDefinition, loadShellCss, ejectShellCss } from '../utils/custom-shell-loader';

interface ShellState {
  activeShell: string;
  availableShells: ShellDefinition[];
  isSwitching: boolean;
  customShells: CustomShellMeta[];
}

const initialState: ShellState = {
  activeShell: 'zzz',
  availableShells: [],
  isSwitching: false,
  customShells: [],
};

type ShellAction =
  | { type: 'SET_ACTIVE_SHELL'; payload: string }
  | { type: 'SET_SWITCHING'; payload: boolean }
  | { type: 'SET_AVAILABLE_SHELLS'; payload: ShellDefinition[] }
  | { type: 'INIT_FROM_CONFIG'; payload: string }
  | { type: 'SET_CUSTOM_SHELLS'; payload: CustomShellMeta[] }
  | { type: 'ADD_CUSTOM_SHELL'; payload: CustomShellMeta }
  | { type: 'REMOVE_CUSTOM_SHELL'; payload: string };

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'SET_ACTIVE_SHELL':
      return { ...state, activeShell: action.payload, isSwitching: true };
    case 'SET_SWITCHING':
      return { ...state, isSwitching: action.payload };
    case 'SET_AVAILABLE_SHELLS':
      return { ...state, availableShells: action.payload };
    case 'INIT_FROM_CONFIG':
      return { ...state, activeShell: action.payload };
    case 'SET_CUSTOM_SHELLS':
      return { ...state, customShells: action.payload };
    case 'ADD_CUSTOM_SHELL':
      return { ...state, customShells: [...state.customShells, action.payload] };
    case 'REMOVE_CUSTOM_SHELL':
      return { ...state, customShells: state.customShells.filter(s => s.id !== action.payload) };
    default:
      return state;
  }
}

interface ShellContextValue {
  state: ShellState;
  setActiveShell: (shellId: string) => Promise<void>;
  importShell: (path: string) => Promise<void>;
  removeShell: (id: string) => Promise<void>;
  refreshCustomShells: () => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialState);

  const loadCustomShells = useCallback(async () => {
    try {
      const customMetas = await api.scanCustomShells();
      clearCustomShells();
      for (const meta of customMetas) {
        const def = customShellToDefinition(meta);
        registerCustomShell(def);
      }
      dispatch({ type: 'SET_CUSTOM_SHELLS', payload: customMetas });
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    } catch (e) {
      console.error('Failed to load custom shells:', e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const savedShell = await api.getActiveShell();
        dispatch({ type: 'INIT_FROM_CONFIG', payload: savedShell });
      } catch {
        // Config read failed, use default 'zzz'
      }
      await loadCustomShells();
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    }
    init();
  }, [loadCustomShells]);

  const setActiveShell = useCallback(async (shellId: string) => {
    const prevShell = state.availableShells.find(s => s.id === state.activeShell);
    if (prevShell?.isCustom) {
      ejectShellCss(prevShell.id);
    }

    dispatch({ type: 'SET_ACTIVE_SHELL', payload: shellId });
    try {
      await api.setActiveShell(shellId);
      const newShell = state.availableShells.find(s => s.id === shellId);
      if (newShell?.isCustom) {
        await loadShellCss(shellId);
      }
    } catch (e) {
      console.error('Failed to persist shell selection:', e);
    }
  }, [state.activeShell, state.availableShells]);

  const importShell = useCallback(async (path: string) => {
    const meta = await api.importCustomShell(path);
    const def = customShellToDefinition(meta);
    registerCustomShell(def);
    dispatch({ type: 'ADD_CUSTOM_SHELL', payload: meta });
    dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
  }, []);

  const removeShell = useCallback(async (id: string) => {
    await api.removeCustomShell(id);
    ejectShellCss(id);
    unregisterShell(id);
    dispatch({ type: 'REMOVE_CUSTOM_SHELL', payload: id });
    dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    if (state.activeShell === id) {
      await setActiveShell('zzz');
    }
  }, [state.activeShell, setActiveShell]);

  const refreshCustomShells = useCallback(async () => {
    await loadCustomShells();
  }, [loadCustomShells]);

  return (
    <ShellContext.Provider value={{ state, setActiveShell, importShell, removeShell, refreshCustomShells }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShellStore(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShellStore must be used within a ShellProvider');
  }
  return context;
}
