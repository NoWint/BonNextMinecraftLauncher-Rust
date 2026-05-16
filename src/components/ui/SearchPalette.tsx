import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { type GameInstance, type VersionEntry } from '../../api';
import { useI18n } from '../../i18n';
import styles from './SearchPalette.module.css';

interface SearchResult {
  type: 'instance' | 'version' | 'setting' | 'page';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  instances: GameInstance[];
  versions: VersionEntry[];
  navigate: (id: string) => void;
}

const SETTING_ITEMS: Omit<SearchResult, 'action'>[] = [
  { type: 'setting', id: 'settings_account', title: 'Account', subtitle: 'Manage accounts and login', icon: 'A' },
  { type: 'setting', id: 'settings_java', title: 'Java Runtime', subtitle: 'Configure Java path and JVM args', icon: 'J' },
  { type: 'setting', id: 'settings_memory', title: 'Memory & Performance', subtitle: 'Set RAM allocation and resolution', icon: 'M' },
  { type: 'setting', id: 'settings_launch', title: 'Launch Behavior', subtitle: 'Configure startup options', icon: 'L' },
  { type: 'setting', id: 'settings_data', title: 'Data Directory', subtitle: 'Set instance path location', icon: 'D' },
  { type: 'setting', id: 'settings_theme', title: 'Theme', subtitle: 'Toggle dark, light, or OLED theme', icon: 'T' },
];

const PAGE_ITEMS: Omit<SearchResult, 'action'>[] = [
  { type: 'page', id: 'nav_home', title: 'Home', subtitle: 'Go to home page', icon: 'H' },
  { type: 'page', id: 'nav_instances', title: 'Instances', subtitle: 'Manage game instances', icon: 'I' },
  { type: 'page', id: 'nav_versions', title: 'Versions', subtitle: 'Browse Minecraft versions', icon: 'V' },
  { type: 'page', id: 'nav_mods', title: 'Mod Browser', subtitle: 'Browse and install mods', icon: 'M' },
  { type: 'page', id: 'nav_settings', title: 'Settings', subtitle: 'Configure launcher', icon: 'S' },
  { type: 'page', id: 'nav_new', title: 'New Instance', subtitle: 'Create a new game instance', icon: '+' },
];

export const SearchPalette: React.FC<SearchPaletteProps> = ({
  open,
  onClose,
  instances,
  versions,
  navigate,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened, reset state
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();

    const instanceResults: SearchResult[] = instances
      .filter((inst) => !q || inst.name.toLowerCase().includes(q) || inst.version_id.toLowerCase().includes(q))
      .map((inst) => ({
        type: 'instance' as const,
        id: inst.id,
        title: inst.name,
        subtitle: `${inst.version_id}${inst.loader_type ? ' · ' + inst.loader_type : ''} · ${Math.round(inst.max_memory / 1024)}GB`,
        icon: 'P',
        action: () => {
          navigate('instances');
          setTimeout(() => { window.location.hash = `#/instances/${inst.id}`; }, 0);
        },
      }));

    const versionResults: SearchResult[] = versions
      .filter((v) => !q || v.id.toLowerCase().includes(q) || v.type.toLowerCase().includes(q))
      .slice(0, 10)
      .map((v) => ({
        type: 'version' as const,
        id: v.id,
        title: v.id,
        subtitle: v.type === 'release' ? 'Release' : 'Snapshot',
        icon: 'V',
        action: () => {
          onClose();
          navigate('versions');
        },
      }));

    const settingResults: SearchResult[] = SETTING_ITEMS
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q))
      .map((s) => ({
        ...s,
        action: () => {
          onClose();
          navigate('settings');
        },
      }));

    const pageResults: SearchResult[] = PAGE_ITEMS
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
      .map((p) => ({
        ...p,
        action: () => {
          onClose();
          const map: Record<string, string> = {
            nav_home: 'home',
            nav_instances: 'instances',
            nav_versions: 'versions',
            nav_mods: 'mods',
            nav_settings: 'settings',
            nav_new: 'new_instance',
          };
          navigate(map[p.id]);
        },
      }));

    return [...instanceResults, ...versionResults, ...settingResults, ...pageResults];
  }, [query, instances, versions, navigate, onClose]);

  // Clamp active index
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, results.length - 1)));
  }, [results.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[activeIndex]) {
            results[activeIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, activeIndex, onClose],
  );

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>/</span>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('common.search') + '...'}
            autoComplete="off"
            spellCheck={false}
          />
          <span className={styles.shortcutHint}>ESC</span>
        </div>

        <div className={styles.results} ref={listRef}>
          {results.length === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            results.map((result, idx) => (
              <div
                key={result.id}
                className={`${styles.resultItem} ${idx === activeIndex ? styles['resultItem--active'] : ''}`}
                onClick={() => result.action()}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className={styles.resultIcon}>{result.icon}</div>
                <div className={styles.resultInfo}>
                  <div className={styles.resultTitle}>{result.title}</div>
                  <div className={styles.resultSubtitle}>{result.subtitle}</div>
                </div>
                <div className={styles.resultType}>{result.type.toUpperCase()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
