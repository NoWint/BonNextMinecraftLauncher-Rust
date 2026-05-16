import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api, type GameInstance } from '../api';

interface InstanceState {
  instances: GameInstance[];
  loading: boolean;
  error: string;
}

type InstanceAction =
  | { type: 'SET_INSTANCES'; instances: GameInstance[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string };

function instanceReducer(state: InstanceState, action: InstanceAction): InstanceState {
  switch (action.type) {
    case 'SET_INSTANCES':
      return { ...state, instances: action.instances, loading: false, error: '' };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    default:
      return state;
  }
}

const InstanceContext = createContext<{
  state: InstanceState;
  reloadInstances: () => Promise<void>;
  createInstance: (inst: GameInstance) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
} | null>(null);

export function InstanceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(instanceReducer, { instances: [], loading: true, error: '' });

  const reloadInstances = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const list = await api.listInstances();
      dispatch({ type: 'SET_INSTANCES', instances: list });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e?.toString() || 'Failed to load' });
    }
  }, []);

  useEffect(() => { reloadInstances(); }, [reloadInstances]);

  const createInstance = useCallback(async (inst: GameInstance) => {
    await api.createInstance(inst);
    await reloadInstances();
  }, [reloadInstances]);

  const deleteInstance = useCallback(async (id: string) => {
    await api.deleteInstance(id);
    await reloadInstances();
  }, [reloadInstances]);

  return (
    <InstanceContext.Provider value={{ state, reloadInstances, createInstance, deleteInstance }}>
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstances() {
  const ctx = useContext(InstanceContext);
  if (!ctx) throw new Error('useInstances must be used within InstanceProvider');
  return ctx;
}
