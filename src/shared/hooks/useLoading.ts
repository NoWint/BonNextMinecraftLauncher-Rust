import { useState, useCallback, useRef, useEffect } from 'react';

interface UseLoadingOptions {
  timeout?: number;
  onError?: (error: Error) => void;
}

interface UseLoadingReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useLoading<T = unknown>(options: UseLoadingOptions = {}): UseLoadingReturn<T> {
  const { timeout = 30000, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError(new Error('Request timed out'));
    }, timeout);

    try {
      const result = await fn();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setData(result);
      setLoading(false);
      return result;
    } catch (e) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setLoading(false);
      onError?.(err);
      return null;
    }
  }, [timeout, onError]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { data, loading, error, execute, reset };
}
