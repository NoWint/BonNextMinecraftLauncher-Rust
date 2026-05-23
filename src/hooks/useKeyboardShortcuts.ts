import { useEffect, useCallback, useRef } from 'react';
import { type GameInstance } from '../api';

interface ShortcutHandlers {
  /** Navigate to a page by ID */
  navigate: (id: string, params?: Record<string, string>) => void;
  /** Launch an instance by id */
  launchInstance: (instanceId: string) => void | Promise<void>;
  /** Toggle search palette visibility */
  setSearchOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  /** Trigger version refresh */
  onRefresh: () => void;
  /** Current array of instances */
  instances: GameInstance[];
  /** Whether to enable shortcuts */
  enabled: boolean;
}

export function useKeyboardShortcuts({
  navigate,
  launchInstance,
  setSearchOpen,
  onRefresh,
  instances,
  enabled,
}: ShortcutHandlers) {
  const refs = useRef({ navigate, launchInstance, setSearchOpen, onRefresh, instances, enabled });
  refs.current = { navigate, launchInstance, setSearchOpen, onRefresh, instances, enabled };

  const handler = useCallback((e: KeyboardEvent) => {
    if (!refs.current.enabled) return;

    // Don't fire shortcuts when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Ctrl+K always works for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      refs.current.setSearchOpen((prev) => !prev);
      return;
    }

    // Escape to close search
    if (e.key === 'Escape') {
      refs.current.setSearchOpen(false);
      return;
    }

    if (isInput) return;

    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          refs.current.navigate('new_instance');
          break;
        case ',':
          e.preventDefault();
          refs.current.navigate('settings');
          break;
        case 'l':
          e.preventDefault();
          const active = refs.current.instances[0];
          if (active) refs.current.launchInstance(active.id);
          break;
      }
      return;
    }

    if (e.key === 'F5') {
      e.preventDefault();
      refs.current.onRefresh();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
