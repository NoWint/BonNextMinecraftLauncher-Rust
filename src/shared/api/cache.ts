import { invoke } from '@tauri-apps/api/core';

export const ipcInflight = new Map<string, Promise<unknown>>();

export function cachedInvoke<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = ipcInflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => ipcInflight.delete(key));
  ipcInflight.set(key, promise);
  return promise;
}

export function invalidateCache(_keys?: string[]) {
  if (!_keys || _keys.length === 0) {
    ipcInflight.clear();
    return;
  }

  for (const prefix of _keys) {
    for (const key of [...ipcInflight.keys()]) {
      if (key.startsWith(prefix) || key.includes(prefix)) {
        ipcInflight.delete(key);
      }
    }
  }
}

// ── Persistent cache (second layer, backed by disk) ──

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a value from the persistent (disk-backed) cache.
 * Returns null if the key is not found or has expired.
 */
export async function persistentCacheGet(key: string): Promise<string | null> {
  const result = await invoke<string | null>('cache_get', { key });
  return result;
}

/**
 * Set a value in the persistent (disk-backed) cache.
 * @param key Cache key
 * @param value Value to store (will be stored as string)
 * @param ttlSecs Time-to-live in seconds (default: 300 / 5 minutes)
 */
export async function persistentCacheSet(key: string, value: string, ttlSecs: number = DEFAULT_TTL): Promise<void> {
  await invoke('cache_set', { key, value, ttlSecs });
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 */
export async function persistentCacheInvalidate(keyPrefix: string): Promise<void> {
  await invoke('cache_invalidate', { keyPrefix });
}

/**
 * Evict all expired entries from the persistent cache.
 * Returns the number of entries removed.
 */
export async function persistentCacheEvictExpired(): Promise<number> {
  return await invoke<number>('cache_evict_expired');
}

/**
 * Two-layer cached invoke: checks in-memory inflight cache first,
 * then persistent disk cache, and finally calls the function.
 */
export async function twoLayerCachedInvoke<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSecs: number = DEFAULT_TTL,
): Promise<T> {
  // Layer 1: in-memory inflight dedup
  const existing = ipcInflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    // Layer 2: persistent disk cache
    try {
      const cached = await persistentCacheGet(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // persistent cache miss or parse error — fall through
    }

    // Layer 3: actual invoke
    const result = await fn();

    // Store in persistent cache in background (don't block return)
    try {
      await persistentCacheSet(key, JSON.stringify(result), ttlSecs);
    } catch {
      // persistent cache write failure — non-critical
    }

    return result;
  })().finally(() => ipcInflight.delete(key));

  ipcInflight.set(key, promise);
  return promise;
}
