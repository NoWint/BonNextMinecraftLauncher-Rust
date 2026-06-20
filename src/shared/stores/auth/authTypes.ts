import type { OfflineAuthResult, StoredAccount } from '../../api';

export interface AuthState {
  currentUser: OfflineAuthResult | null;
  accounts: StoredAccount[];
  activeAccountId: string | null;
  loading: boolean;
  error: string;
}

export type AuthAction =
  | { type: 'LOGIN'; user: OfflineAuthResult }
  | { type: 'LOGOUT' }
  | { type: 'SET_ACCOUNTS'; accounts: StoredAccount[] }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | {
      type: 'SET_ALL';
      accounts: StoredAccount[];
      activeAccountId: string | null;
      currentUser: OfflineAuthResult | null;
    };

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}
