import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverlayVisibility } from '../hooks/useOverlayVisibility';

function makeCtx(
  overrides: Partial<{ invoke: ReturnType<typeof vi.fn>; events: { on: ReturnType<typeof vi.fn> } }> = {},
) {
  return {
    invoke: overrides.invoke ?? vi.fn(),
    events: { on: overrides.events?.on ?? vi.fn() },
  } as any;
}

describe('useOverlayVisibility', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.clearAllMocks();
  });

  it('hidden when not authenticated (get_active_account returns null)', async () => {
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue(null) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.authResolved).toBe(true));
    });
    expect(result.current.visible).toBe(false);
  });

  it('hidden when authenticated but hash is not home', async () => {
    window.location.hash = '#/instances';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.authResolved).toBe(true));
    });
    expect(result.current.visible).toBe(false);
  });

  it('visible when authenticated and hash is #/home', async () => {
    window.location.hash = '#/home';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.visible).toBe(true));
    });
  });

  it('visible when authenticated and hash is #/ (redirects to home)', async () => {
    window.location.hash = '#/';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.visible).toBe(true));
    });
  });

  it('becomes visible on hashchange to #/home', async () => {
    window.location.hash = '#/instances';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.authResolved).toBe(true));
    });
    expect(result.current.visible).toBe(false);
    await act(async () => {
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.visible).toBe(true);
  });
});
