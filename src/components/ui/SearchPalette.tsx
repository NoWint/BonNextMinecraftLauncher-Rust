import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type GameInstance, type VersionEntry } from '../../shared/api';
import { useI18n } from '../../shared/i18n';
import { Icon } from './Icon';
import styles from './SearchPalette.module.css';

interface SearchResult {
  type: 'instance' | 'version' | 'setting' | 'page';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

interface NlpResult {
  slug: string;
  name: string;
  relevance: number;
  interpretation: string;
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  instances: GameInstance[];
  versions: VersionEntry[];
  navigate: (id: string, params?: Record<string, string>) => void;
}

function getSettingItems(t: (key: string) => string): Omit<SearchResult, 'action'>[] {
  return [
    {
      type: 'setting',
      id: 'settings_account',
      title: t('searchPalette.account'),
      subtitle: t('searchPalette.accountDesc'),
      icon: 'A',
    },
    {
      type: 'setting',
      id: 'settings_java',
      title: t('searchPalette.java'),
      subtitle: t('searchPalette.javaDesc'),
      icon: 'J',
    },
    {
      type: 'setting',
      id: 'settings_memory',
      title: t('searchPalette.memory'),
      subtitle: t('searchPalette.memoryDesc'),
      icon: 'M',
    },
    {
      type: 'setting',
      id: 'settings_launch',
      title: t('searchPalette.launch'),
      subtitle: t('searchPalette.launchDesc'),
      icon: 'L',
    },
    {
      type: 'setting',
      id: 'settings_data',
      title: t('searchPalette.data'),
      subtitle: t('searchPalette.dataDesc'),
      icon: 'D',
    },
    {
      type: 'setting',
      id: 'settings_theme',
      title: t('searchPalette.theme'),
      subtitle: t('searchPalette.themeDesc'),
      icon: 'T',
    },
  ];
}

function getPageItems(t: (key: string) => string): Omit<SearchResult, 'action'>[] {
  return [
    { type: 'page', id: 'nav_home', title: t('searchPalette.home'), subtitle: t('searchPalette.homeDesc'), icon: 'H' },
    {
      type: 'page',
      id: 'nav_instances',
      title: t('searchPalette.instances'),
      subtitle: t('searchPalette.instancesDesc'),
      icon: 'I',
    },
    {
      type: 'page',
      id: 'nav_versions',
      title: t('searchPalette.versions'),
      subtitle: t('searchPalette.versionsDesc'),
      icon: 'V',
    },
    {
      type: 'page',
      id: 'nav_mods',
      title: t('searchPalette.modBrowser'),
      subtitle: t('searchPalette.modBrowserDesc'),
      icon: 'M',
    },
    {
      type: 'page',
      id: 'nav_settings',
      title: t('searchPalette.settings'),
      subtitle: t('searchPalette.settingsDesc'),
      icon: 'S',
    },
    {
      type: 'page',
      id: 'nav_new',
      title: t('searchPalette.newInstance'),
      subtitle: t('searchPalette.newInstanceDesc'),
      icon: '+',
    },
  ];
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({
  open,
  onClose,
  instances,
  versions,
  navigate: navigateTo,
}) => {
  const { t } = useI18n();
  const routerNavigate = useNavigate();
  const SETTING_ITEMS = useMemo(() => getSettingItems(t), [t]);
  const PAGE_ITEMS = useMemo(() => getPageItems(t), [t]);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeNlpIndex, setActiveNlpIndex] = useState(0);
  const [nlpResults, setNlpResults] = useState<NlpResult[]>([]);
  const [nlpLoading, setNlpLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nlpTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when opened, reset state
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setActiveNlpIndex(0);
      setNlpResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // NLP search with debounce when query > 15 chars
  useEffect(() => {
    if (nlpTimerRef.current) {
      clearTimeout(nlpTimerRef.current);
    }
    if (query.trim().length > 15) {
      setNlpLoading(true);
      nlpTimerRef.current = setTimeout(async () => {
        try {
          const results = await api.nlpSearchContent(query.trim());
          setNlpResults(results);
        } catch {
          setNlpResults([]);
        }
        setNlpLoading(false);
      }, 600);
    } else {
      setNlpResults([]);
      setNlpLoading(false);
    }
    return () => {
      if (nlpTimerRef.current) {
        clearTimeout(nlpTimerRef.current);
      }
    };
  }, [query]);

  const hasNlpResults = nlpResults.length > 0;

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
          navigateTo('instances');
          setTimeout(() => {
            routerNavigate(`/instances/${inst.id}`);
          }, 0);
        },
      }));

    const versionResults: SearchResult[] = versions
      .filter((v) => !q || v.id.toLowerCase().includes(q) || v.type.toLowerCase().includes(q))
      .slice(0, 10)
      .map((v) => ({
        type: 'version' as const,
        id: v.id,
        title: v.id,
        subtitle: v.type === 'release' ? t('searchPalette.release') : t('searchPalette.snapshot'),
        icon: 'V',
        action: () => {
          onClose();
          navigateTo('versions');
        },
      }));

    const settingResults: SearchResult[] = SETTING_ITEMS.filter(
      (s) => !q || s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q),
    ).map((s) => ({
      ...s,
      action: () => {
        onClose();
        navigateTo('settings');
      },
    }));

    const pageResults: SearchResult[] = PAGE_ITEMS.filter(
      (p) => !q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q),
    ).map((p) => ({
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
        navigateTo(map[p.id]);
      },
    }));

    return [...instanceResults, ...versionResults, ...settingResults, ...pageResults];
  }, [query, instances, versions, navigateTo, onClose]);

  // Clamp active index
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, results.length - 1)));
    setActiveNlpIndex((prev) => Math.min(prev, Math.max(0, nlpResults.length - 1)));
  }, [results.length, nlpResults.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (hasNlpResults && activeIndex >= results.length - 1) {
            setActiveNlpIndex((prev) => Math.min(prev + 1, nlpResults.length - 1));
            setActiveIndex(results.length - 1);
          } else {
            setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
            setActiveNlpIndex(-1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (activeNlpIndex > 0) {
            setActiveNlpIndex((prev) => Math.max(prev - 1, 0));
          } else if (activeNlpIndex === 0 && hasNlpResults) {
            setActiveNlpIndex(-1);
            setActiveIndex(results.length - 1);
          } else {
            setActiveIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (activeNlpIndex >= 0 && nlpResults[activeNlpIndex]) {
            onClose();
            navigateTo('store');
            setTimeout(() => {
              routerNavigate(`/store/mod/${nlpResults[activeNlpIndex].slug}`);
            }, 0);
          } else if (results[activeIndex]) {
            results[activeIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, activeIndex, activeNlpIndex, nlpResults, hasNlpResults, navigateTo, onClose],
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
          {query.trim().length > 15 && (
            <span className={styles.aiBadge}>{nlpLoading ? <Icon name="hourglass" size={12} /> : 'AI'}</span>
          )}
          <span className={styles.shortcutHint}>ESC</span>
        </div>

        <div className={styles.results} ref={listRef}>
          {results.length === 0 && !hasNlpResults ? (
            <div className={styles.empty}>
              {query.trim().length > 15 && nlpLoading ? t('searchPalette.aiLoading') : t('searchPalette.noResults')}
            </div>
          ) : (
            <>
              {results.map((result, idx) => (
                <div
                  key={result.id}
                  className={`${styles.resultItem} ${idx === activeIndex && activeNlpIndex < 0 ? styles['resultItem--active'] : ''}`}
                  onClick={() => result.action()}
                  onMouseEnter={() => {
                    setActiveIndex(idx);
                    setActiveNlpIndex(-1);
                  }}
                >
                  <div className={styles.resultIcon}>{result.icon}</div>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultTitle}>{result.title}</div>
                    <div className={styles.resultSubtitle}>{result.subtitle}</div>
                  </div>
                  <div className={styles.resultType}>{result.type.toUpperCase()}</div>
                </div>
              ))}

              {hasNlpResults && (
                <>
                  <div className={styles.nlpDivider}>
                    <span className={styles.nlpDividerLabel}>
                      <Icon name="bolt" size={14} /> {t('searchPalette.aiUnderstanding')}
                    </span>
                  </div>
                  {nlpResults.map((nlp, idx) => (
                    <div
                      key={nlp.slug}
                      className={`${styles.resultItem} ${styles.nlpResult} ${idx === activeNlpIndex ? styles['resultItem--active'] : ''}`}
                      onClick={() => {
                        onClose();
                        navigateTo('store');
                        setTimeout(() => {
                          routerNavigate(`/store/mod/${nlp.slug}`);
                        }, 0);
                      }}
                      onMouseEnter={() => {
                        setActiveNlpIndex(idx);
                        setActiveIndex(results.length - 1);
                      }}
                    >
                      <div className={styles.nlpIcon}>
                        <Icon name="sparkles" size={14} />
                      </div>
                      <div className={styles.resultInfo}>
                        <div className={styles.resultTitle}>{nlp.name}</div>
                        <div className={styles.nlpInterpretation}>{nlp.interpretation}</div>
                      </div>
                      <div className={styles.nlpRelevance}>{Math.round(nlp.relevance)}%</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
