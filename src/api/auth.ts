import { invoke } from '@tauri-apps/api/core';
import { cachedInvoke } from './cache';
import type {
  OfflineAuthResult,
  MicrosoftAuthResult,
  DeviceCodeResponse,
  YggdrasilAuthResult,
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
export const getYggdrasilPresets = () => invoke<[string, string][]>('get_yggdrasil_presets');
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
export const checkAuthlibInjector = () => invoke<AuthlibCheckResult>('check_authlib_injector');
