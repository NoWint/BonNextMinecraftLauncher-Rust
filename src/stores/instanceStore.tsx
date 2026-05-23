import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { api, type GameInstance } from '../api';

interface InstanceState {
  instances: GameInstance[];
  loading: boolean;
  error: string;
}

type InstanceAction =
  | { type: 'SET_INSTANCES'; instances: GameInstance[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_INSTANCES_LOADED'; instances: GameInstance[] };

function instanceReducer(state: InstanceState, action: InstanceAction): InstanceState {
  switch (action.type) {
    case 'SET_INSTANCES':
      return { ...state, instances: action.instances, loading: false, error: '' };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'SET_INSTANCES_LOADED':
      return { ...state, instances: action.instances, loading: false, error: '' };
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
    try {
      const list = await api.listInstances();
      dispatch({ type: 'SET_INSTANCES_LOADED', instances: list });
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

  const contextValue = useMemo(() => ({
    state, reloadInstances, createInstance, deleteInstance,
  }), [state, reloadInstances, createInstance, deleteInstance]);

  return (
    <InstanceContext.Provider value={contextValue}>
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstances() {
  const ctx = useContext(InstanceContext);
  if (!ctx) throw new Error('useInstances must be used within InstanceProvider');
  return ctx;
}
