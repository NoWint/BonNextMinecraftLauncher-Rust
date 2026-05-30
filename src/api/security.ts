import { invoke } from '@tauri-apps/api/core';
import type {
  SecurityConfig,
  AuditEntry,
  LoginHistoryEntry,
  KeyStatus,
  SandboxAvailability,
  FilePermissionResult,
  FilePermissionFixResult,
} from './types';

export const getSecurityConfig = () => invoke<SecurityConfig>('get_security_config');
export const saveSecurityConfig = (security: SecurityConfig) => invoke<void>('save_security_config', { security });
export const getSecurityScore = () => invoke<number>('get_security_score');
export const getAuditLog = (category?: string, limit?: number, offset?: number) =>
  invoke<AuditEntry[]>('get_audit_log', { category, limit, offset });
export const getLoginHistory = () => invoke<LoginHistoryEntry[]>('get_login_history');
export const migrateCredentials = () => invoke<void>('migrate_credentials');
export const getEncryptionStatus = () => invoke<{ encrypted: boolean; plain: boolean }>('get_encryption_status');
export const saveApiKey = (name: string, value: string) => invoke<void>('save_api_key', { name, value });
export const deleteApiKey = (name: string) => invoke<void>('delete_api_key', { name });
export const getApiKeyStatus = (name: string) => invoke<KeyStatus>('get_api_key_status', { name });
export const checkFilePermissions = () => invoke<FilePermissionResult[]>('check_file_permissions');
export const fixFilePermissions = () => invoke<FilePermissionFixResult[]>('fix_file_permissions');
export const validateJvmArgs = (args: string) =>
  invoke<{ valid: boolean; args?: string[]; error?: string; warnings?: string[] }>('validate_jvm_args', { args });
export const getSandboxAvailability = () => invoke<SandboxAvailability>('get_sandbox_availability');
