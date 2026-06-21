import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { emit } from '@tauri-apps/api/event';
import { api } from '../api';
import { formatError } from '../utils/errorMapping';
import type { AuthState, AuthAction, DeviceCodeResponse } from './auth/authTypes';

export type { AuthState, AuthAction, DeviceCodeResponse } from './auth/authTypes';

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, currentUser: action.user, error: '', loading: false };
    case 'LOGOUT':
      return { ...state, currentUser: null, error: '' };
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.accounts };
    case 'SET_ACTIVE':
      return { ...state, activeAccountId: action.id };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ALL':
      return {
        ...state,
        accounts: action.accounts,
        activeAccountId: action.activeAccountId,
        currentUser: action.currentUser,
        error: '',
        loading: false,
      };
    default:
      return state;
  }
}

const AuthContext = createContext<{
  state: AuthState;
  offlineLogin: (username: string) => Promise<void>;
  microsoftLogin: () => Promise<DeviceCodeResponse | undefined>;
  yggdrasilLogin: (serverUrl: string, email: string, password: string) => Promise<import('../api').YggdrasilAuthResult>;
  logout: () => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
  refreshAccounts: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    currentUser: null,
    accounts: [],
    activeAccountId: null,
    loading: false,
    error: '',
  });

  const refreshAccounts = useCallback(async () => {
    try {
      // 并行请求账户列表和活跃账户，减少 1 个 IPC 往返。
      const [accounts, active] = await Promise.all([
        api.listAccounts(),
        api.getActiveAccount(),
      ]);
      dispatch({
        type: 'SET_ALL',
        accounts,
        activeAccountId: active ? active.id : null,
        currentUser: active
          ? { username: active.username, uuid: active.uuid, access_token: active.access_token }
          : null,
      });
    } catch (e) {
      console.warn('Failed to refresh accounts:', e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const offlineLogin = useCallback(
    async (username: string) => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        const result = await api.offlineLogin(username);
        dispatch({ type: 'LOGIN', user: result });
        // 通知插件 EventBus：用户已登录
        void emit('auth:login', { username: result.username, uuid: result.uuid, method: 'offline' });
        await refreshAccounts();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Login failed';
        dispatch({ type: 'SET_ERROR', error: msg });
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    },
    [refreshAccounts],
  );

  const microsoftLogin = useCallback(async (): Promise<DeviceCodeResponse | undefined> => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const code = (await api.startMicrosoftAuth()) as DeviceCodeResponse;
      dispatch({ type: 'SET_LOADING', loading: false });
      return code;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'MS login failed';
      dispatch({ type: 'SET_ERROR', error: msg });
      dispatch({ type: 'SET_LOADING', loading: false });
      return undefined;
    }
  }, []);

  const yggdrasilLogin = useCallback(
    async (serverUrl: string, email: string, password: string): Promise<import('../api').YggdrasilAuthResult> => {
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        const result = await api.yggdrasilLogin(serverUrl, email, password);
        dispatch({
          type: 'LOGIN',
          user: { username: result.username, uuid: result.uuid, access_token: result.access_token },
        });
        // 通知插件 EventBus：用户已登录
        void emit('auth:login', { username: result.username, uuid: result.uuid, method: 'yggdrasil' });
        await refreshAccounts();
        return result;
      } catch (e) {
        const msg = formatError(e);
        dispatch({ type: 'SET_ERROR', error: msg });
        dispatch({ type: 'SET_LOADING', loading: false });
        throw e;
      }
    },
    [refreshAccounts],
  );

  const logout = useCallback(async () => {
    const activeId = state.activeAccountId;
    if (activeId) {
      try {
        await api.removeAccount(activeId);
      } catch (e) {
        console.warn('Failed to remove account on server:', e instanceof Error ? e.message : String(e));
      }
    }
    dispatch({ type: 'LOGOUT' });
  }, [state.activeAccountId]);

  const switchAccount = useCallback(
    async (id: string) => {
      try {
        await api.setActiveAccount(id);
        dispatch({ type: 'SET_ACTIVE', id });
        await refreshAccounts();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Switch failed';
        dispatch({ type: 'SET_ERROR', error: msg });
      }
    },
    [refreshAccounts],
  );

  const contextValue = useMemo(
    () => ({
      state,
      offlineLogin,
      microsoftLogin,
      yggdrasilLogin,
      logout,
      switchAccount,
      refreshAccounts,
    }),
    [state, offlineLogin, microsoftLogin, yggdrasilLogin, logout, switchAccount, refreshAccounts],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
