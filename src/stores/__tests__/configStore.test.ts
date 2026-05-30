import { describe, it, expect } from 'vitest';
import { configReducer } from '../configStore';
import type { AppConfig } from '../../api';

const initialState = {
  config: null,
  loading: true,
  error: '',
};

const mockConfig: AppConfig = {
  game_dir: '/home/user/.bonnext',
  java_path: '/usr/bin/java',
  max_memory: 2048,
  min_memory: 512,
  window_width: 854,
  window_height: 480,
  fullscreen: false,
  download_source: 'official',
  max_concurrent_downloads: 8,
  jvm_args: null,
  selected_instance: null,
  auth_type: 'offline',
  keep_launcher_open: false,
  show_log_on_crash: true,
  auto_update_java: false,
  java_download_source: 'official',
  force_memory: false,
  force_java_path: false,
  security: {
    credential_encryption: false,
    strict_verification: false,
    enforce_https: true,
    jvm_args_mode: 'default',
    sandbox_mode: 'none',
    proxy_enabled: false,
    proxy_url: null,
    proxy_username: null,
    proxy_password: null,
    audit_log_enabled: false,
    secure_launch_check: false,
  },
};

describe('configReducer', () => {
  it('should handle SET_CONFIG action', () => {
    const state = { ...initialState, loading: true, error: 'old error' };
    const next = configReducer(state, { type: 'SET_CONFIG', config: mockConfig });
    expect(next.config).toEqual(mockConfig);
    expect(next.loading).toBe(false);
    expect(next.error).toBe('');
  });

  it('should handle SET_LOADING action', () => {
    const state = { ...initialState, loading: false };
    const next = configReducer(state, { type: 'SET_LOADING', loading: true });
    expect(next.loading).toBe(true);
  });

  it('should handle SET_ERROR action', () => {
    const state = { ...initialState, loading: true };
    const next = configReducer(state, { type: 'SET_ERROR', error: 'Failed to load config' });
    expect(next.error).toBe('Failed to load config');
    expect(next.loading).toBe(false);
  });

  it('should return current state for unknown action type', () => {
    const next = configReducer(initialState, { type: 'UNKNOWN' } as unknown as Parameters<typeof configReducer>[1]);
    expect(next).toEqual(initialState);
  });
});
