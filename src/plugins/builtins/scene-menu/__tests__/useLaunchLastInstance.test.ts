import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLaunchLastInstance } from '../hooks/useLaunchLastInstance';

function makeCtx(invokeImpl: ReturnType<typeof vi.fn>, eventsOn: ReturnType<typeof vi.fn> = vi.fn()) {
  return { invoke: invokeImpl, events: { on: eventsOn } } as any;
}

describe('useLaunchLastInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('launches last_played instance (most recent)', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 'a', name: 'A', last_played: '2026-01-01T00:00:00Z' },
        { id: 'b', name: 'B', last_played: '2026-06-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce(undefined);
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    expect(invoke).toHaveBeenCalledWith('launch_game', { instance_id: 'b' });
    expect(result.current.state).toBe('launching');
  });

  it('falls back to first instance when no last_played', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'a', name: 'A', last_played: null }])
      .mockResolvedValueOnce(undefined);
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    expect(invoke).toHaveBeenCalledWith('launch_game', { instance_id: 'a' });
  });

  it('navigates to /instances/new when no instances', async () => {
    const invoke = vi.fn().mockResolvedValueOnce([]);
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    expect(window.location.hash).toBe('#/instances/new');
    expect(invoke).not.toHaveBeenCalledWith('launch_game', expect.anything());
  });

  it('sets error state when launch_game throws', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'a', name: 'A', last_played: null }])
      .mockRejectedValueOnce(new Error('boom'));
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    await waitFor(() => expect(result.current.state).toBe('crashed'));
    expect(result.current.error).toBe('boom');
  });
});
