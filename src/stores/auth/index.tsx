import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { authReducer } from './authReducer';
import { createAuthActions } from './authActions';
import type { AuthState } from './authTypes';

export type { AuthState, AuthAction, DeviceCodeResponse } from './authTypes';
export { authReducer } from './authReducer';

const AuthContext = createContext<{
  state: AuthState;
  offlineLogin: (username: string) => Promise<void>;
  microsoftLogin: () => Promise<import('./authTypes').DeviceCodeResponse | undefined>;
  yggdrasilLogin: (
    serverUrl: string,
    email: string,
    password: string,
  ) => Promise<import('../../api').YggdrasilAuthResult>;
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

  const actions = useMemo(() => createAuthActions(dispatch), []);

  const refreshAccounts = useCallback(actions.refreshAccounts, [actions]);
  const offlineLogin = useCallback(actions.offlineLogin, [actions]);
  const microsoftLogin = useCallback(actions.microsoftLogin, [actions]);
  const yggdrasilLogin = useCallback(actions.yggdrasilLogin, [actions]);
  const switchAccount = useCallback(actions.switchAccount, [actions]);

  const logout = useCallback(async () => {
    await actions.logout(state.activeAccountId);
  }, [actions, state.activeAccountId]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

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
