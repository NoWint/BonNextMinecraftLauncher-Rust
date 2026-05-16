import { useState, useEffect, useCallback } from 'react';
import { api, type ModResult } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import {
  Button, TextInput, Select, Pagination,
  ContentCard, contentFromModResult,
} from '../components/ui';
import styles from './ModsPage.module.css';

const GAME_VERSIONS = [
  '', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19', '1.18.2', '1.16.5',
];

const LOADER_OPTIONS = [
  { value: '', label: 'All loaders' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'forge', label: 'Forge' },
  { value: 'neoforge', label: 'NeoForge' },
  { value: 'quilt', label: 'Quilt' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Most downloads' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' },
];

const POPULAR_TAGS = [
  'optimization', 'tech', 'magic', 'decoration',
  'worldgen', 'adventure', 'utility', 'storage',
];

const PAGE_SIZE = 24;

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

export default function ModsPage() {
  const { state: instState } = useInstances();
  const { addToast } = useToast();

  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('gallery');
  const [sort, setSort] = useState('relevance');
  const [mods, setMods] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [page, setPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalHits / PAGE_SIZE));
  const instances = instState.instances;
  const activeInstance = instances.length > 0 ? instances[0] : null;

  const loadMods = useCallback(async (query = '', pageNum = 1, tag = activeTag) => {
    setLoading(true);
    setError('');
    try {
      const effectiveQuery = query || tag;
      const offset = (pageNum - 1) * PAGE_SIZE;

      let results: ModResult[];
      let total: number;

      if (effectiveQuery.trim()) {
        [results, total] = await api.searchContent(
          effectiveQuery, 'mod', version || undefined, loader || undefined,
          sort, PAGE_SIZE, offset,
        );
      } else {
        results = await api.getTrendingContent('mod', version || undefined, PAGE_SIZE);
        total = results.length;
      }

      setMods(results);
      setTotalHits(total);
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load content');
      setMods([]);
    } finally {
      setLoading(false);
    }
  }, [version, loader, sort]);

  useEffect(() => {
    setPage(1);
    loadMods(search, 1, activeTag);
  }, [sort]);

  useEffect(() => {
    setPage(1);
    loadMods(activeTag ? '' : search, 1, activeTag);
  }, [activeTag, version, loader]);

  const handleSearch = () => {
    setPage(1);
    setActiveTag('');
    loadMods(search, 1, '');
  };

  const handleTagClick = (tag: string) => {
    const next = tag === activeTag ? '' : tag;
    setActiveTag(next);
    setSearch('');
    setPage(1);
    loadMods(next ? '' : search, 1, next);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    loadMods(search, p, activeTag);
  };

  const handleInstall = async (mod: ModResult) => {
    if (!activeInstance) {
      addToast({ type: 'warning', title: 'No instance', message: 'Create an instance first to install mods.' });
      return;
    }
    setInstalling(mod.slug);
    try {
      const versions = await api.getModVersions(
        mod.slug,
        version || activeInstance.version_id,
        loader || activeInstance.loader_type || 'fabric',
      );
      if (versions.length === 0) {
        addToast({ type: 'error', title: 'Not compatible', message: `${mod.title} has no version for your setup.` });
        setInstalling(null);
        return;
      }
      const latest = versions[0];
      const primaryFile = latest.files.find(
        (f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'),
      ) || latest.files[0];

      await api.installContent(
        primaryFile.url, primaryFile.filename, activeInstance.id,
        'mod', primaryFile.hashes.sha1 || undefined,
        mod.slug, latest.id,
      );
      addToast({ type: 'success', title: 'Installed', message: `${mod.title} ${latest.version_number}` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Install failed', message: e?.toString() || '' });
    } finally {
      setInstalling(null);
    }
  };

  const handleNavigate = (slug: string) => {
    window.location.hash = `#/store/mod/${slug}`;
  };

  const hasActiveFilters = !!(search || activeTag || version || loader);

  return (
    <div className={`page-enter ${styles.page}`}>

      {/* ---- Top bar ---- */}
      <div className={styles.topBar}>
        <div className={styles.topBar__left}>
          <h1 className={styles.topBar__title}>MOD BROWSER</h1>
          <span className={styles.topBar__subtitle}>
            {totalHits > 0
              ? `${totalHits.toLocaleString()} mods available via Modrinth`
              : 'via Modrinth'}
          </span>
        </div>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggle__btn} ${viewMode === 'gallery' ? styles['viewToggle__btn--active'] : ''}`}
            onClick={() => setViewMode('gallery')}
          >
            ▦ GRID
          </button>
          <button
            className={`${styles.viewToggle__btn} ${viewMode === 'list' ? styles['viewToggle__btn--active'] : ''}`}
            onClick={() => setViewMode('list')}
          >
            ☰ LIST
          </button>
        </div>
      </div>

      {/* ---- Category quick-filters ---- */}
      <div className={styles.categoryRow}>
        {POPULAR_TAGS.map((tag) => (
          <button
            key={tag}
            className={`${styles.categoryChip} ${activeTag === tag ? styles['categoryChip--active'] : ''}`}
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            className={styles.categoryChip}
            onClick={() => {
              setActiveTag('');
              setSearch('');
              setVersion('');
              setLoader('');
              setPage(1);
              loadMods('', 1, '');
            }}
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* ---- Filter bar ---- */}
      <div className={styles.filterBar}>
        <div className={styles.filterBar__search}>
          <TextInput
            placeholder="Search mods, resource packs, shaders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className={styles.filterBar__select}>
          <Select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            options={[
              { value: '', label: 'All versions' },
              ...GAME_VERSIONS.filter(Boolean).map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div className={styles.filterBar__select}>
          <Select
            value={loader}
            onChange={(e) => setLoader(e.target.value)}
            options={LOADER_OPTIONS}
          />
        </div>
        <div className={styles.filterBar__sort}>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      {/* ---- No instance warning ---- */}
      {!activeInstance && instances.length === 0 && (
        <div className={styles.warning}>
          <span className={styles.warning__icon}>⚠</span>
          <span className={styles.warning__text}>
            You need an instance before you can install mods. Create one first.
          </span>
          <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/instances/new')}>
            + New instance
          </Button>
        </div>
      )}

      {/* ---- Error ---- */}
      {error && <div className={styles.error}>{error}</div>}

      {/* ---- Status bar ---- */}
      {!loading && (
        <div className={styles.statusBar}>
          <span>
            {totalHits > 0
              ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalHits)} of ${totalHits.toLocaleString()}`
              : (activeTag || search) ? 'No results' : 'Enter a search term or pick a category'}
          </span>
          {totalHits > 0 && <span>Page {page}/{totalPages}</span>}
        </div>
      )}

      {/* ---- Content ---- */}
      {loading ? (
        <SkeletonGrid />
      ) : mods.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyState__icon}>
            {search || activeTag ? '🔍' : '📦'}
          </div>
          <div className={styles.emptyState__title}>
            {search || activeTag ? 'NO RESULTS FOUND' : 'DISCOVER MODS'}
          </div>
          <div className={styles.emptyState__desc}>
            {search || activeTag
              ? 'Try a different search term or browse by category instead.'
              : 'Search for your favorite mods or pick a category above to start exploring the Modrinth library.'}
          </div>
          {(search || activeTag) && (
            <Button variant="secondary" size="sm" onClick={() => {
              setSearch(''); setActiveTag(''); setPage(1); loadMods('', 1, '');
            }}>
              Clear & show trending
            </Button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'gallery' ? styles.galleryView : styles.listView}>
          {mods.map((mod) => (
            <ContentCard
              key={mod.slug}
              content={contentFromModResult(mod)}
              variant={viewMode}
              onInstall={activeInstance ? () => handleInstall(mod) : undefined}
              onNavigate={handleNavigate}
              installing={installing === mod.slug}
            />
          ))}
        </div>
      )}

      {/* ---- Pagination ---- */}
      {totalPages > 1 && !loading && (
        <div className={styles.paginationRow}>
          <Pagination current={page} total={totalPages} onPage={handlePageChange} />
        </div>
      )}

    </div>
  );
}
