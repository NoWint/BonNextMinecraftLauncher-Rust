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
    game_dir: '/home/user/.bonnext/instances/vanilla-1.20',
    icon: null,
    last_played: null,
    total_playtime: 0,
  },
  {
    id: 'inst-2',
    name: 'Fabric 1.20',
    version_id: '1.20',
    version_url: 'https://example.com/1.20.json',
    loader_type: 'fabric',
    loader_version: '0.15.0',
    game_dir: '/home/user/.bonnext/instances/fabric-1.20',
    icon: null,
    last_played: '2024-01-01',
    total_playtime: 3600,
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
    const next = instanceReducer(initialState, { type: 'UNKNOWN' } as any);
    expect(next).toEqual(initialState);
  });
});
