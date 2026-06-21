import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { emit } from '@tauri-apps/api/event';
import { formatError } from '../utils/errorMapping';
import { api, invalidateCache, type GameInstance } from '../api';

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

export function instanceReducer(state: InstanceState, action: InstanceAction): InstanceState {
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
  restoreInstance: (id: string) => Promise<void>;
  cleanupTrash: () => Promise<void>;
} | null>(null);

export function InstanceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(instanceReducer, { instances: [], loading: true, error: '' });

  const reloadInstances = useCallback(async () => {
    try {
      invalidateCache(['instances', 'config', 'active_account']);
      const list = await api.listInstances();
      dispatch({ type: 'SET_INSTANCES_LOADED', instances: list });
    } catch (e: unknown) {
      dispatch({ type: 'SET_ERROR', error: formatError(e) || 'Failed to load' });
    }
  }, []);

  useEffect(() => {
    reloadInstances();
  }, [reloadInstances]);

  const createInstance = useCallback(
    async (inst: GameInstance) => {
      await api.createInstance(inst);
      invalidateCache(['instances', 'config', 'active_account']);
      // 通知插件 EventBus：新实例已创建
      void emit('instance:created', { instanceId: inst.id, name: inst.name });
      await reloadInstances();
    },
    [reloadInstances],
  );

  const deleteInstance = useCallback(
    async (id: string) => {
      await api.deleteInstance(id);
      invalidateCache(['instances', 'config', 'active_account']);
      await reloadInstances();
    },
    [reloadInstances],
  );

  const restoreInstance = useCallback(
    async (id: string) => {
      await api.restoreInstance(id);
      invalidateCache(['instances', 'config', 'active_account']);
      await reloadInstances();
    },
    [reloadInstances],
  );

  const cleanupTrash = useCallback(async () => {
    await api.cleanupTrash();
    await reloadInstances();
  }, [reloadInstances]);

  const contextValue = useMemo(
    () => ({
      state,
      reloadInstances,
      createInstance,
      deleteInstance,
      restoreInstance,
      cleanupTrash,
    }),
    [state, reloadInstances, createInstance, deleteInstance, restoreInstance, cleanupTrash],
  );

  return <InstanceContext.Provider value={contextValue}>{children}</InstanceContext.Provider>;
}

export function useInstances() {
  const ctx = useContext(InstanceContext);
  if (!ctx) throw new Error('useInstances must be used within InstanceProvider');
  return ctx;
}
