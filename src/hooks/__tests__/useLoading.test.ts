import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoading } from '../useLoading';

describe('useLoading', () => {
  it('should have correct initial state', () => {
    const { result } = renderHook(() => useLoading());
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle execute success', async () => {
    const { result } = renderHook(() => useLoading<string>());

    let resolvedValue: string | null = null;
    await act(async () => {
      resolvedValue = await result.current.execute(async () => 'hello');
    });

    expect(resolvedValue).toBe('hello');
    expect(result.current.data).toBe('hello');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle execute failure', async () => {
    const { result } = renderHook(() => useLoading<string>());

    let resolvedValue: string | null = null;
    await act(async () => {
      resolvedValue = await result.current.execute(async () => {
        throw new Error('something went wrong');
      });
    });

    expect(resolvedValue).toBeNull();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('something went wrong');
  });

  it('should handle reset', async () => {
    const { result } = renderHook(() => useLoading<string>());

    await act(async () => {
      await result.current.execute(async () => 'data');
    });

    expect(result.current.data).toBe('data');

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should call onError callback on failure', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useLoading<string>({ onError }));

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error('callback error');
      });
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'callback error' }));
  });

  it('should wrap non-Error throws in Error', async () => {
    const { result } = renderHook(() => useLoading());

    await act(async () => {
      await result.current.execute(async () => {
        throw 'string error';
      });
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });
});
