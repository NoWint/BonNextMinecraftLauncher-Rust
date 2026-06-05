import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ShellDefinition } from '../types/shell';
import { api } from '../api';
import { getAllShells } from '../../shell-registry';

interface ShellState {
  activeShell: string;
  availableShells: ShellDefinition[];
  isSwitching: boolean;
}

const initialState: ShellState = {
  activeShell: 'zzz',
  availableShells: [],
  isSwitching: false,
};

type ShellAction =
  | { type: 'SET_ACTIVE_SHELL'; payload: string }
  | { type: 'SET_SWITCHING'; payload: boolean }
  | { type: 'SET_AVAILABLE_SHELLS'; payload: ShellDefinition[] }
  | { type: 'INIT_FROM_CONFIG'; payload: string };

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
    default:
      return state;
  }
}

interface ShellContextValue {
  state: ShellState;
  setActiveShell: (shellId: string) => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialState);

  useEffect(() => {
    async function init() {
      try {
        const savedShell = await api.getActiveShell();
        dispatch({ type: 'INIT_FROM_CONFIG', payload: savedShell });
      } catch {
        // Config read failed, use default 'zzz'
      }
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    }
    init();
  }, []);

  const setActiveShell = useCallback(async (shellId: string) => {
    dispatch({ type: 'SET_ACTIVE_SHELL', payload: shellId });
    try {
      await api.setActiveShell(shellId);
    } catch (e) {
      console.error('Failed to persist shell selection:', e);
    }
  }, []);

  return (
    <ShellContext.Provider value={{ state, setActiveShell }}>
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
