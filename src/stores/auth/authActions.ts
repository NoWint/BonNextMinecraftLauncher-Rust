import { api, type YggdrasilAuthResult } from '../../api';
import type { AuthAction, DeviceCodeResponse } from './authTypes';

export type AuthDispatch = React.Dispatch<AuthAction>;

export function createAuthActions(dispatch: AuthDispatch) {
  const refreshAccounts = async () => {
    try {
      const accounts = await api.listAccounts();
      const active = await api.getActiveAccount();
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
  };

  const offlineLogin = async (username: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const result = await api.offlineLogin(username);
      dispatch({ type: 'LOGIN', user: result });
      await refreshAccounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      dispatch({ type: 'SET_ERROR', error: msg });
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  };

  const microsoftLogin = async (): Promise<DeviceCodeResponse | undefined> => {
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
  };

  const yggdrasilLogin = async (serverUrl: string, email: string, password: string): Promise<YggdrasilAuthResult> => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const result = await api.yggdrasilLogin(serverUrl, email, password);
      dispatch({
        type: 'LOGIN',
        user: { username: result.username, uuid: result.uuid, access_token: result.access_token },
      });
      await refreshAccounts();
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch({ type: 'SET_ERROR', error: msg });
      dispatch({ type: 'SET_LOADING', loading: false });
      throw e;
    }
  };

  const logout = async (activeAccountId: string | null) => {
    if (activeAccountId) {
      try {
        await api.removeAccount(activeAccountId);
      } catch (e) {
        console.warn('Failed to remove account on server:', e instanceof Error ? e.message : String(e));
      }
    }
    dispatch({ type: 'LOGOUT' });
  };

  const switchAccount = async (id: string) => {
    try {
      await api.setActiveAccount(id);
      dispatch({ type: 'SET_ACTIVE', id });
      await refreshAccounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Switch failed';
      dispatch({ type: 'SET_ERROR', error: msg });
    }
  };

  return {
    refreshAccounts,
    offlineLogin,
    microsoftLogin,
    yggdrasilLogin,
    logout,
    switchAccount,
  };
}

export type AuthActions = ReturnType<typeof createAuthActions>;
