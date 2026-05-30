import { useState, useEffect, useCallback } from 'react';
import { formatError } from '../../utils/errorMapping';
import { api, type ModResult } from '../../api';
import { useInstances } from '../../stores/instanceStore';
import { useToast } from '../../stores/toastStore';
import { Button, Pagination, ContentCard, contentFromModResult } from '../ui';
import { Icon } from '../ui/Icon';
import type { ContentType, DataSource, ViewMode } from './types';
import { PAGE_SIZE } from './types';
import styles from './ResultsView.module.css';

interface ResultsViewProps {
  contentType: ContentType;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  page: number;
  viewMode: ViewMode;
  onPageChange: (page: number) => void;
  onNavigate: (slug: string) => void;
  onTotalHitsChange: (total: number) => void;
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
  page,
  viewMode,
  onPageChange,
  onNavigate,
  onTotalHitsChange,
}: ResultsViewProps) {
  const { state: instState } = useInstances();
  const { addToast } = useToast();

  const [mods, setMods] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHits, setTotalHits] = useState(0);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const instances = instState.instances;
  const activeInstance = instances.length > 0 ? instances[0] : null;
  const totalPages = Math.max(1, Math.ceil(totalHits / PAGE_SIZE));

  const loadMods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const effectiveQuery = searchQuery || selectedTags.join(' ');
      const offset = (page - 1) * PAGE_SIZE;

      let results: ModResult[];
      let total: number;

      if (effectiveQuery.trim()) {
        if (source === 'curseforge') {
          [results, total] = await api.searchCfMods(
            effectiveQuery,
            gameVersion || undefined,
            selectedTags[0] || undefined,
            sortBy,
            PAGE_SIZE,
            offset,
          );
        } else {
          [results, total] = await api.searchContent(
            effectiveQuery,
            contentType,
            gameVersion || undefined,
            loader || undefined,
            sortBy,
            PAGE_SIZE,
            offset,
          );
        }
      } else {
        if (source === 'curseforge') {
          results = await api.getCfFeatured();
        } else {
          results = await api.getTrendingContent(contentType, gameVersion || undefined, PAGE_SIZE);
        }
        total = results.length;
      }

      setMods(results);
      setTotalHits(total);
      onTotalHitsChange(total);
    } catch (e: unknown) {
      setError(formatError(e) || 'Failed to load content');
      setMods([]);
      setTotalHits(0);
      onTotalHitsChange(0);
    } finally {
      setLoading(false);
    }
  }, [contentType, source, searchQuery, selectedTags, gameVersion, loader, sortBy, page, onTotalHitsChange]);

  useEffect(() => {
    loadMods();
  }, [loadMods]);

  const handleInstall = async (mod: ModResult) => {
    if (!activeInstance) {
      addToast({ type: 'warning', title: 'No instance', message: 'Create an instance first to install content.' });
      return;
    }
    setInstalling(mod.slug);
    try {
      if (source === 'curseforge') {
        const modId = parseInt(mod.slug, 10);
        const files = await api.getCfModFiles(modId);
        if (files.length === 0) {
          addToast({ type: 'error', title: 'No files', message: `${mod.title} has no downloadable files.` });
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
        addToast({ type: 'success', title: 'Installed', message: `${mod.title}` });
      } else {
        const versions = await api.getModVersions(
          mod.slug,
          gameVersion || activeInstance.version_id,
          loader || activeInstance.loader_type || 'fabric',
        );
        if (versions.length === 0) {
          addToast({ type: 'error', title: 'Not compatible', message: `${mod.title} has no version for your setup.` });
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
        addToast({ type: 'success', title: 'Installed', message: `${mod.title} ${latest.version_number}` });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Install failed', message: formatError(e) });
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
            You need an instance before you can install content. Create one first.
          </span>
          <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/instances/new')}>
            + New instance
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
            {searchQuery || selectedTags.length > 0 ? 'NO RESULTS FOUND' : 'DISCOVER CONTENT'}
          </div>
          <div className={styles.emptyState__desc}>
            {searchQuery || selectedTags.length > 0
              ? 'Try a different search term or browse by category instead.'
              : "Search for your favorite content or switch to the Discover view to see what's trending."}
          </div>
        </div>
      ) : (
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
      )}

      {totalPages > 1 && !loading && (
        <div className={styles.paginationRow}>
          <Pagination current={page} total={totalPages} onPage={onPageChange} />
        </div>
      )}
    </div>
  );
}
