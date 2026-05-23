import { describe, it, expect } from 'vitest';
import { authReducer } from '../authStore';
import type { OfflineAuthResult, StoredAccount } from '../../api';

const initialState = {
  currentUser: null,
  accounts: [] as StoredAccount[],
  activeAccountId: null,
  loading: false,
  error: '',
};

const mockUser: OfflineAuthResult = {
  username: 'TestPlayer',
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  access_token: 'mock-token',
};

const mockAccounts: StoredAccount[] = [
  {
    id: 'acc-1',
    username: 'Player1',
    uuid: '11111111-1111-1111-1111-111111111111',
    access_token: 'token-1',
    refresh_token: null,
  },
  {
    id: 'acc-2',
    username: 'Player2',
    uuid: '22222222-2222-2222-2222-222222222222',
    access_token: 'token-2',
    refresh_token: 'refresh-2',
  },
];

describe('authReducer', () => {
  it('should handle LOGIN action', () => {
    const state = { ...initialState, loading: true, error: 'some error' };
    const next = authReducer(state, { type: 'LOGIN', user: mockUser });
    expect(next.currentUser).toEqual(mockUser);
    expect(next.loading).toBe(false);
    expect(next.error).toBe('');
  });

  it('should handle LOGOUT action', () => {
    const state = { ...initialState, currentUser: mockUser, error: 'some error' };
    const next = authReducer(state, { type: 'LOGOUT' });
    expect(next.currentUser).toBeNull();
    expect(next.error).toBe('');
  });

  it('should handle SET_ACCOUNTS action', () => {
    const next = authReducer(initialState, { type: 'SET_ACCOUNTS', accounts: mockAccounts });
    expect(next.accounts).toEqual(mockAccounts);
    expect(next.accounts).toHaveLength(2);
  });

  it('should handle SET_ACTIVE action', () => {
    const next = authReducer(initialState, { type: 'SET_ACTIVE', id: 'acc-1' });
    expect(next.activeAccountId).toBe('acc-1');
  });

  it('should handle SET_ERROR action', () => {
    const next = authReducer(initialState, { type: 'SET_ERROR', error: 'Login failed' });
    expect(next.error).toBe('Login failed');
  });

  it('should handle SET_LOADING action', () => {
    const next = authReducer(initialState, { type: 'SET_LOADING', loading: true });
    expect(next.loading).toBe(true);
  });

  it('should handle SET_ALL action', () => {
    const state = { ...initialState, loading: true, error: 'old error' };
    const next = authReducer(state, {
      type: 'SET_ALL',
      accounts: mockAccounts,
      activeAccountId: 'acc-1',
      currentUser: mockUser,
    });
    expect(next.accounts).toEqual(mockAccounts);
    expect(next.activeAccountId).toBe('acc-1');
    expect(next.currentUser).toEqual(mockUser);
    expect(next.error).toBe('');
    expect(next.loading).toBe(false);
  });

  it('should return current state for unknown action type', () => {
    const next = authReducer(initialState, { type: 'UNKNOWN' } as any);
    expect(next).toEqual(initialState);
  });
});
