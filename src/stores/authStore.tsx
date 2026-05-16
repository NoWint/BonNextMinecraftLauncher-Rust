import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api, type OfflineAuthResult, type StoredAccount } from '../api';

interface AuthState {
  currentUser: OfflineAuthResult | null;
  accounts: StoredAccount[];
  activeAccountId: string | null;
  loading: boolean;
  error: string;
}

type AuthAction =
  | { type: 'LOGIN'; user: OfflineAuthResult }
  | { type: 'LOGOUT' }
  | { type: 'SET_ACCOUNTS'; accounts: StoredAccount[] }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_LOADING'; loading: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
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
    default:
      return state;
  }
}

const AuthContext = createContext<{
  state: AuthState;
  offlineLogin: (username: string) => Promise<void>;
  microsoftLogin: () => Promise<any>;
  logout: () => void;
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
      const accounts = await api.listAccounts();
      dispatch({ type: 'SET_ACCOUNTS', accounts });
      const active = await api.getActiveAccount();
      if (active) {
        dispatch({ type: 'SET_ACTIVE', id: active.id });
        dispatch({
          type: 'LOGIN',
          user: {
            username: active.username,
            uuid: active.uuid,
            access_token: active.access_token,
          },
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const offlineLogin = useCallback(async (username: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const result = await api.offlineLogin(username);
      dispatch({ type: 'LOGIN', user: result });
      await refreshAccounts();
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e?.toString() || 'Login failed' });
    }
  }, [refreshAccounts]);

  const microsoftLogin = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const code = await api.startMicrosoftAuth();
      // Poll is handled by the LoginPage component
      dispatch({ type: 'SET_LOADING', loading: false });
      return code;
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e?.toString() || 'MS login failed' });
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  const switchAccount = useCallback(async (id: string) => {
    try {
      await api.setActiveAccount(id);
      dispatch({ type: 'SET_ACTIVE', id });
      await refreshAccounts();
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e?.toString() || 'Switch failed' });
    }
  }, [refreshAccounts]);

  return (
    <AuthContext.Provider value={{ state, offlineLogin, microsoftLogin, logout, switchAccount, refreshAccounts }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
