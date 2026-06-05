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
