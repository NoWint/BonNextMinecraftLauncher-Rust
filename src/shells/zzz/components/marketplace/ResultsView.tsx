import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatError } from '../../../../shared/utils/errorMapping';
import { api, type ModResult } from '../../../../shared/api';
import { useInstances } from '../../../../shared/stores/instanceStore';
import { useToast } from '../../../../shared/stores/toastStore';
import { useI18n } from '../../../../shared/i18n';
import { Button, Pagination, ContentCard, contentFromModResult } from '../ui';
import { Icon } from '../ui/Icon';
import type { ContentType, DataSource, ViewMode } from './types';
import { PAGE_SIZE } from './types';
import { searchContent, getBrowseContent } from './contentSource';
import styles from './ResultsView.module.css';

interface ResultsViewProps {
  contentType: ContentType;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  viewMode: ViewMode;
  onNavigate: (slug: string) => void;
}

function SkeletonGrid() {
  return (
    <div className={styles.skeletonGrid}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonCard__img} />
          <div className={styles.skeletonCard__body}>
            <div className={styles.skeletonCard__line} style={{ width: '80%' }} />
            <div className={`${styles.skeletonCard__line} ${styles['skeletonCard__line--short']}`} />
            <div className={styles.skeletonCard__line} style={{ width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResultsView({
  contentType,
  source,
  searchQuery,
  selectedTags,
  gameVersion,
  loader,
  sortBy,
  viewMode,
  onNavigate,
}: ResultsViewProps) {
  const navigate = useNavigate();
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();

  const [mods, setMods] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [totalHits, setTotalHits] = useState(0);
  const [page, setPage] = useState(1);

  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const instances = instState.instances;
  const activeInstance = instances.length > 0 ? instances[0] : null;

  const fetchPage = useCallback(
    async (offset: number): Promise<[ModResult[], number]> => {
      const effectiveQuery = searchQuery || selectedTags.join(' ');
      if (effectiveQuery.trim()) {
        return searchContent(source, {
          query: effectiveQuery,
          contentType,
          gameVersion: gameVersion || undefined,
          loader: loader || undefined,
          tags: selectedTags,
          sortBy,
          offset,
        });
      }
      const results = await getBrowseContent(source, contentType, gameVersion || undefined);
      return [results, results.length];
    },
    [contentType, source, searchQuery, selectedTags, gameVersion, loader, sortBy],
  );

  const loadMods = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
        setHasMore(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      setError('');
      try {
        const offset = reset ? 0 : offsetRef.current;
        const [results, total] = await fetchPage(offset);

        setTotalHits(total);

        if (reset) {
          setMods(results);
        } else {
          setMods((prev) => [...prev, ...results]);
        }

        offsetRef.current = offset + results.length;
        setHasMore(offsetRef.current < total);
      } catch (e: unknown) {
        setError(formatError(e) || 'Failed to load content');
        if (reset) setMods([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [fetchPage],
  );

  const loadModsAt = useCallback(
    async (targetOffset: number) => {
      setLoading(true);
      setError('');
      try {
        const [results, total] = await fetchPage(targetOffset);
        setMods(results);
        setTotalHits(total);
        setHasMore(targetOffset + results.length < total);
      } catch (e: unknown) {
        setError(formatError(e) || 'Failed');
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  // Reset and reload when filters change
  useEffect(() => {
    loadMods(true);
  }, [loadMods]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMods(false);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMods]);

  const handleInstall = async (mod: ModResult) => {
    if (!activeInstance) {
      addToast({ type: 'warning', title: t('marketplace.noInstance'), message: t('marketplace.noInstanceDesc') });
      return;
    }
    setInstalling(mod.slug);
    try {
      if (source === 'curseforge') {
        const modId = parseInt(mod.slug, 10);
        const files = await api.getCfModFiles(modId);
        if (files.length === 0) {
          addToast({ type: 'error', title: t('marketplace.noFiles'), message: t('marketplace.noFilesDesc', { title: mod.title }) });
          setInstalling(null);
          return;
        }
        const latest = files[0];
        await api.downloadCfMod(
          latest.url,
          latest.filename,
          activeInstance.id,
          contentType,
          undefined,
          mod.slug,
          undefined,
        );
        addToast({ type: 'success', title: t('marketplace.installed'), message: `${mod.title}` });
      } else {
        const versions = await api.getModVersions(
          mod.slug,
          gameVersion || activeInstance.version_id,
          loader || activeInstance.loader_type || 'fabric',
        );
        if (versions.length === 0) {
          addToast({ type: 'error', title: t('marketplace.notCompatible'), message: t('marketplace.notCompatibleDesc', { title: mod.title }) });
          setInstalling(null);
          return;
        }
        const latest = versions[0];
        const primaryFile =
          latest.files.find((f) => !f.filename.includes('sources') && !f.filename.includes('javadoc')) ||
          latest.files[0];

        await api.installContent(
          primaryFile.url,
          primaryFile.filename,
          activeInstance.id,
          contentType,
          primaryFile.hashes.sha1 || undefined,
          mod.slug,
          latest.id,
        );
        addToast({ type: 'success', title: t('marketplace.installed'), message: `${mod.title} ${latest.version_number}` });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('marketplace.installFailed'), message: formatError(e) });
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className={styles.view}>
      {!activeInstance && instances.length === 0 && (
        <div className={styles.warning}>
          <span className={styles.warning__icon}>
            <Icon name="warning" size={14} />
          </span>
          <span className={styles.warning__text}>
            {t('marketplace.needInstance')}
          </span>
          <Button variant="secondary" size="sm" onClick={() => navigate('/instances/new')}>
            {t('marketplace.newInstance')}
          </Button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <SkeletonGrid />
      ) : mods.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyState__icon}>
            {searchQuery || selectedTags.length > 0 ? <Icon name="search" size={16} /> : <Icon name="cube" size={16} />}
          </div>
          <div className={styles.emptyState__title}>
            {searchQuery || selectedTags.length > 0 ? t('marketplace.noResults') : t('marketplace.discoverContent')}
          </div>
          <div className={styles.emptyState__desc}>
            {searchQuery || selectedTags.length > 0
              ? t('marketplace.noResultsDesc')
              : t('marketplace.discoverDesc')}
          </div>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? styles.galleryView : styles.listView}>
            {mods.map((mod) => (
              <ContentCard
                key={mod.slug}
                content={contentFromModResult(mod)}
                variant={viewMode === 'grid' ? 'gallery' : 'list'}
                onInstall={activeInstance ? () => handleInstall(mod) : undefined}
                onNavigate={onNavigate}
                installing={installing === mod.slug}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1, marginTop: 8 }} />

          {loadingMore && (
            <div style={{ padding: '1em 0', display: 'flex', justifyContent: 'center' }}>
              <SkeletonGrid />
            </div>
          )}

          {totalHits > PAGE_SIZE && !loading && (
            <Pagination
              current={page}
              total={Math.max(1, Math.ceil(totalHits / PAGE_SIZE))}
              onPage={(p) => {
                setPage(p);
                const newOffset = (p - 1) * PAGE_SIZE;
                offsetRef.current = newOffset;
                loadModsAt(newOffset);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
