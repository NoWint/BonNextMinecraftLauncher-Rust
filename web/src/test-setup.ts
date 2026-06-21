import '@testing-library/jest-dom';

// Node 25+ ships a native `localStorage` that is initialised in a broken state
// when the `--localstorage-file` flag is forwarded without a valid path (which
// Vitest/jsdom does). The resulting global `localStorage` is an empty object
// with no Storage methods, breaking any test that relies on `localStorage`.
// Restore a fully-functional in-memory Storage so the jsdom environment behaves
// as expected.
if (typeof globalThis.localStorage === 'undefined' ||
    typeof globalThis.localStorage?.clear !== 'function') {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.has(key) ? store.get(key)! : null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });
}
