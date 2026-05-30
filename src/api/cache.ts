export const ipcInflight = new Map<string, Promise<unknown>>();

export function cachedInvoke<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = ipcInflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => ipcInflight.delete(key));
  ipcInflight.set(key, promise);
  return promise;
}

export function invalidateCache(_keys?: string[]) {}
