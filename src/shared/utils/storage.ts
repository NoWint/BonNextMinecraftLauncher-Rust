/**
 * BonNext localStorage wrapper
 *
 * 统一 try/catch、JSON 序列化与 key 命名空间,
 * 避免各页面直接访问 localStorage 时重复处理异常。
 */

const NAMESPACE = 'bonnext';

function namespacedKey(key: string): string {
  return key.startsWith(`${NAMESPACE}_`) ? key : `${NAMESPACE}_${key}`;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(namespacedKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(namespacedKey(key), JSON.stringify(value));
  } catch {
    /* localStorage unavailable or quota exceeded */
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(namespacedKey(key));
  } catch {
    /* localStorage unavailable */
  }
}
