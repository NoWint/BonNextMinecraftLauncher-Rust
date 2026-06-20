import { describe, it, expect } from 'vitest';
import { instanceReducer } from '../instanceStore';
import type { GameInstance } from '../../api';

const initialState = {
  instances: [] as GameInstance[],
  loading: true,
  error: '',
};

const mockInstances: GameInstance[] = [
  {
    id: 'inst-1',
    name: 'Vanilla 1.20',
    version_id: '1.20',
    version_url: 'https://example.com/1.20.json',
    loader_type: null,
    loader_version: null,
    description: '',
    max_memory: 2048,
    min_memory: 512,
    java_path: null,
    jvm_args: null,
    created_at: '2024-01-01',
    last_played: null,
    playtime_seconds: 0,
  },
  {
    id: 'inst-2',
    name: 'Fabric 1.20',
    version_id: '1.20',
    version_url: 'https://example.com/1.20.json',
    loader_type: 'fabric',
    loader_version: '0.15.0',
    description: 'Fabric modded instance',
    max_memory: 4096,
    min_memory: 1024,
    java_path: null,
    jvm_args: null,
    created_at: '2024-01-01',
    last_played: '2024-01-15',
    playtime_seconds: 3600,
  },
];

describe('instanceReducer', () => {
  it('should handle SET_INSTANCES action', () => {
    const state = { ...initialState, loading: true, error: 'old error' };
    const next = instanceReducer(state, { type: 'SET_INSTANCES', instances: mockInstances });
    expect(next.instances).toEqual(mockInstances);
    expect(next.loading).toBe(false);
    expect(next.error).toBe('');
  });

  it('should handle SET_LOADING action', () => {
    const state = { ...initialState, loading: false };
    const next = instanceReducer(state, { type: 'SET_LOADING', loading: true });
    expect(next.loading).toBe(true);
  });

  it('should handle SET_ERROR action', () => {
    const state = { ...initialState, loading: true };
    const next = instanceReducer(state, { type: 'SET_ERROR', error: 'Failed to load instances' });
    expect(next.error).toBe('Failed to load instances');
    expect(next.loading).toBe(false);
  });

  it('should handle SET_INSTANCES_LOADED action', () => {
    const state = { ...initialState, loading: true, error: 'old error' };
    const next = instanceReducer(state, { type: 'SET_INSTANCES_LOADED', instances: mockInstances });
    expect(next.instances).toEqual(mockInstances);
    expect(next.loading).toBe(false);
    expect(next.error).toBe('');
  });

  it('should return current state for unknown action type', () => {
    const next = instanceReducer(initialState, { type: 'UNKNOWN' } as unknown as Parameters<typeof instanceReducer>[1]);
    expect(next).toEqual(initialState);
  });
});
