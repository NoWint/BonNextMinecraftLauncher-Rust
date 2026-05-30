import { useEffect, useState, useRef } from 'react';
import { ipcInflight } from '../api/cache';

interface UseSkeletonOptions {
  loading?: boolean;
  keys?: string[];
  minDuration?: number;
}

export function useSkeleton({ loading = false, keys, minDuration = 0 }: UseSkeletonOptions = {}) {
  const [ipcLoading, setIpcLoading] = useState(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [minActive, setMinActive] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const hasInflight = keys ? keys.some((k) => ipcInflight.has(k)) : ipcInflight.size > 0;
      setIpcLoading(hasInflight);
    }, 100);
    return () => clearInterval(id);
  }, [keys]);

  const active = loading || ipcLoading;

  useEffect(() => {
    if (active) {
      startedAt.current = Date.now();
      setMinActive(true);
    } else if (minActive) {
      const elapsed = Date.now() - startedAt.current;
      if (elapsed < minDuration) {
        minTimerRef.current = setTimeout(() => setMinActive(false), minDuration - elapsed);
        return () => {
          if (minTimerRef.current) clearTimeout(minTimerRef.current);
        };
      }
      setMinActive(false);
    }
  }, [active, minDuration, minActive]);

  return { showSkeleton: active || minActive };
}
