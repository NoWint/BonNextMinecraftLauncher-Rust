import type { AuthState, AuthAction } from './authTypes';

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
