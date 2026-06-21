import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type {
  SecurityConfig,
  AuditEntry,
  LoginHistoryEntry,
  KeyStatus,
  SandboxAvailability,
  FilePermissionResult,
  FilePermissionFixResult,
  TrustedKey,
  SignatureVerificationResult,
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
export const validateJvmArgs = async (args: string) => {
  const result = await invoke<{ valid: boolean; args?: string[]; error?: string; warnings?: string[] }>(
    'validate_jvm_args',
    { args },
  );
  // 当检测到危险 JVM 参数时，通知插件 EventBus
  if (!result.valid || (result.warnings && result.warnings.length > 0)) {
    void emit('security:threat-detected', {
      kind: 'jvm-args',
      args,
      valid: result.valid,
      error: result.error,
      warnings: result.warnings,
    });
  }
  return result;
};
export const getSandboxAvailability = () => invoke<SandboxAvailability>('get_sandbox_availability');

// ===== Plugin signature verification (P4-1) =====

/** List all trusted public keys (built-in + user-added). */
export const listTrustedKeys = () => invoke<TrustedKey[]>('list_trusted_keys');

/** Add a user-trusted public key. */
export const addTrustedKey = (key: {
  id: string;
  label: string;
  public_key: string;
}) => invoke<void>('add_trusted_key', { key });

/** Remove a user-trusted key by ID. Built-in keys cannot be removed. */
export const removeTrustedKey = (id: string) => invoke<void>('remove_trusted_key', { id });

/** Verify a plugin archive's signature. */
export const verifyPluginSignature = (archivePath: string) =>
  invoke<SignatureVerificationResult>('verify_plugin_signature_command', { archivePath });
