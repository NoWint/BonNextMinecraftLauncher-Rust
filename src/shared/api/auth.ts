import { invoke } from '@tauri-apps/api/core';
import { cachedInvoke } from './cache';
import type {
  OfflineAuthResult,
  MicrosoftAuthResult,
  DeviceCodeResponse,
  YggdrasilAuthResult,
  YggdrasilProfile,
  YggdrasilSkinProfile,
  StoredAccount,
  McSkinProfile,
  SkinValidationResult,
  AuthlibCheckResult,
} from './types';

export const offlineLogin = (username: string) => invoke<OfflineAuthResult>('offline_login', { username });
export const startMicrosoftAuth = () => invoke<DeviceCodeResponse>('start_microsoft_auth');
export const pollMicrosoftAuth = (deviceCode: string) =>
  invoke<MicrosoftAuthResult>('poll_microsoft_auth', { deviceCode });
export const listAccounts = () => cachedInvoke('accounts', () => invoke<StoredAccount[]>('list_accounts'));
export const getActiveAccount = () =>
  cachedInvoke('active_account', () => invoke<StoredAccount | null>('get_active_account'));
export const setActiveAccount = (id: string) => invoke<void>('set_active_account', { id });
export const removeAccount = (id: string) => invoke<void>('remove_account', { id });
export const refreshAuthToken = () => invoke<string | null>('refresh_auth_token');
export const yggdrasilLogin = (serverUrl: string, email: string, password: string) =>
  invoke<YggdrasilAuthResult>('yggdrasil_login', { serverUrl, email, password });
export const yggdrasilRefreshToken = () => invoke<void>('yggdrasil_refresh_token');
export const yggdrasilGetProfile = (uuid: string, serverUrl: string, accessToken: string) =>
  invoke<YggdrasilSkinProfile>('yggdrasil_get_profile', { uuid, serverUrl, accessToken });
export const yggdrasilUploadSkin = (
  uuid: string,
  serverUrl: string,
  accessToken: string,
  filePath: string,
  model: string,
) => invoke<void>('yggdrasil_upload_skin', { uuid, serverUrl, accessToken, filePath, model });
export const yggdrasilResetSkin = (uuid: string, serverUrl: string, accessToken: string) =>
  invoke<void>('yggdrasil_reset_skin', { uuid, serverUrl, accessToken });
export const yggdrasilSelectProfile = (accountId: string, profileId: string) =>
  invoke<void>('yggdrasil_select_profile', { accountId, profileId });
export interface YggdrasilServerPreset {
  name: string;
  base_url: string;
  client_id: string | null;
  client_secret: string | null;
  auth_mode: string;
  authorize_path: string | null;
  token_path: string | null;
  profile_path: string | null;
  scope: string | null;
}

export interface YggdrasilOAuthStartResult {
  auth_url: string;
  state: string;
}

export interface YggdrasilOAuthResult {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_in: number | null;
  profiles: YggdrasilProfile[];
}

export const getYggdrasilServerPresets = () => invoke<YggdrasilServerPreset[]>('get_yggdrasil_server_presets');

export const startYggdrasilOAuth = (serverName: string) =>
  invoke<YggdrasilOAuthStartResult>('start_yggdrasil_oauth', { serverName });

export const completeYggdrasilOAuth = (serverName: string, code: string) =>
  invoke<YggdrasilOAuthResult>('complete_yggdrasil_oauth', { serverName, code });

export const getYggdrasilPresets = () => invoke<[string, string][]>('get_yggdrasil_presets');
export const testYggdrasilServer = (serverUrl: string) =>
  invoke<void>('test_yggdrasil_server', { serverUrl });
export const yggdrasilValidateToken = (serverUrl: string, accessToken: string, clientToken: string) =>
  invoke<boolean>('yggdrasil_validate_token', { serverUrl, accessToken, clientToken });
export const ensureAuthlibInjector = () => invoke<string>('ensure_authlib_injector');
export const setLocalSkin = (accountId: string, skinPath: string | null, skinModel: string | null) =>
  invoke<void>('set_local_skin', { accountId, skinPath, skinModel });
export const readSkinFile = (filePath: string) => invoke<string>('read_skin_file', { filePath });
export const validateSkinFile = (filePath: string) => invoke<SkinValidationResult>('validate_skin_file', { filePath });
export const microsoftGetSkinProfile = (accessToken: string) =>
  invoke<McSkinProfile>('microsoft_get_skin_profile', { accessToken });
export const microsoftUploadSkin = (accessToken: string, filePath: string, variant: string) =>
  invoke<void>('microsoft_upload_skin', { accessToken, filePath, variant });
export const microsoftDeleteSkin = (accessToken: string, skinId: string) =>
  invoke<void>('microsoft_delete_skin', { accessToken, skinId });

export interface MojangProfile {
  id: string;
  name: string;
  skins: { id: string; state: string; url: string; variant: string }[];
  capes: { id: string; state: string; url: string; alias: string }[];
}

export const uploadSkin = (accessToken: string, filePath: string, variant: string) =>
  invoke<void>('upload_skin', { accessToken, filePath, variant });
export const resetSkin = (accessToken: string) => invoke<void>('reset_skin', { accessToken });
export const equipCape = (accessToken: string, capeId: string) =>
  invoke<void>('equip_cape', { accessToken, capeId });
export const hideCape = (accessToken: string) => invoke<void>('hide_cape', { accessToken });
export const getMojangProfile = (accessToken: string) =>
  invoke<MojangProfile>('get_mojang_profile', { accessToken });

export const checkAuthlibInjector = () => invoke<AuthlibCheckResult>('check_authlib_injector');
export const downloadAuthlibInjector = (gameDir: string) =>
  invoke<string>('download_authlib_injector', { gameDir });
export const loginYggdrasil = (authServerUrl: string, username: string, password: string, clientToken?: string) =>
  invoke<YggdrasilAuthResult>('login_yggdrasil', { authServerUrl, username, password, clientToken });
