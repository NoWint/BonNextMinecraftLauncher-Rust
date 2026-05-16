import { useState, useEffect, useCallback } from 'react';
import { api, type ModResult } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { SectionHeader, Ticker } from '../components/layout';
import {
  Button, TextInput, Select, StatusDot, Tabs, Pagination,
  ContentCard, contentFromModResult,
} from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './ModsPage.module.css';

const CONTENT_TYPES = [
  { id: 'mod', label: 'MODS' },
  { id: 'modpack', label: 'MODPACKS' },
  { id: 'resourcepack', label: 'RESOURCE PACKS' },
  { id: 'shader', label: 'SHADERS' },
];

const GAME_VERSIONS = [
  '', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19', '1.18.2', '1.18', '1.17.1', '1.16.5',
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
  { value: 'downloads', label: 'Downloads' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Updated' },
];

const PAGE_SIZE = 20;

export default function ModsPage() {
  const { state: instState } = useInstances();
  const { addToast } = useToast();

  const [contentType, setContentType] = useState('mod');
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const [sort, setSort] = useState('relevance');
  const [mods, setMods] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('');
  const [page, setPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalHits / PAGE_SIZE));
  const instances = instState.instances;
  const activeInstance = instances.length > 0 ? instances[0] : null;

  const loadMods = useCallback(async (query = '', pageNum = 1) => {
    setLoading(true);
    setError('');
    try {
      const offset = (pageNum - 1) * PAGE_SIZE;

      const [results, total] = query.trim()
        ? await api.searchContent(query, contentType, version || undefined, loader || undefined, sort, PAGE_SIZE, offset)
        : await api.getTrendingContent(
            contentType,
            version || undefined,
            PAGE_SIZE,
          ).then((r) => [r, r.length] as [ModResult[], number]);

      setMods(results);
      setTotalHits(total);
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load content');
      setMods([]);
    } finally {
      setLoading(false);
    }
  }, [contentType, version, loader, sort]);

  useEffect(() => {
    setPage(1);
    loadMods(search, 1);
  }, [contentType, sort]); // reload when type or sort changes

  const handleSearch = () => {
    setPage(1);
    loadMods(search, 1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    loadMods(search, p);
  };

  const handleInstall = async (mod: ModResult) => {
    if (!activeInstance) {
      addToast({ type: 'warning', title: 'No instance', message: 'Create an instance first.' });
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
        addToast({ type: 'error', title: 'No compatible version', message: `${mod.title} not available for your setup.` });
        setInstalling(null);
        return;
      }
      const latest = versions[0];
      const primaryFile = latest.files.find(
        (f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'),
      ) || latest.files[0];

      await api.installMod(primaryFile.url, primaryFile.filename, activeInstance.id, primaryFile.hashes.sha1 || undefined);
      addToast({ type: 'success', title: 'Installed', message: `${mod.title} ${latest.version_number}` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Install failed', message: e?.toString() || '' });
    } finally {
      setInstalling(null);
    }
  };

  const handleNavigate = (slug: string) => {
    window.location.hash = `#/store/${contentType}/${slug}`;
  };

  return (
    <div className={`page-enter ${styles.page}`}>
      <SectionHeader
        title={`${CONTENT_TYPES.find((t) => t.id === contentType)?.label || 'CONTENT'} BROWSER`}
        subtitle={totalHits > 0 ? `${totalHits} results · via Modrinth` : 'via Modrinth'}
      />

      {/* Content type tabs */}
      <Tabs
        tabs={CONTENT_TYPES}
        activeId={contentType}
        onChange={setContentType}
      />

      {/* Search & filters */}
      <div className={styles.toolbar}>
        <div className={styles.toolbar__search}>
          <TextInput
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className={styles.toolbar__select}>
          <Select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            options={[
              { value: '', label: 'All versions' },
              ...GAME_VERSIONS.filter(Boolean).map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div className={styles.toolbar__select}>
          <Select
            value={loader}
            onChange={(e) => setLoader(e.target.value)}
            options={LOADER_OPTIONS}
          />
        </div>
        <div className={styles.toolbar__select}>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={SORT_OPTIONS}
          />
        </div>
        <Button variant="primary" size="md" onClick={handleSearch}>
          Search
        </Button>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggle__btn} ${viewMode === 'list' ? styles['viewToggle__btn--active'] : ''}`}
            onClick={() => setViewMode('list')}
          >
            LIST
          </button>
          <button
            className={`${styles.viewToggle__btn} ${viewMode === 'gallery' ? styles['viewToggle__btn--active'] : ''}`}
            onClick={() => setViewMode('gallery')}
          >
            GRID
          </button>
        </div>
      </div>

      {/* No instance warning */}
      {!activeInstance && instances.length === 0 && (
        <div className={styles.warning}>
          <StatusDot status="inactive" />
          <span className={styles.warning__text}>Create an instance first to install content with one click.</span>
          <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/instances/new')}>
            New instance
          </Button>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Total info */}
      {!loading && totalHits > 0 && (
        <div className={styles.totalLabel}>
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalHits)} of {totalHits}
        </div>
      )}

      {/* Content list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : mods.length === 0 ? (
        <div className={styles.empty}>
          {search ? 'No results found matching your search.' : 'Enter a search term to find content.'}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.paginationRow}>
          <Pagination current={page} total={totalPages} onPage={handlePageChange} />
        </div>
      )}

      {/* Footer */}
      <Ticker messages={[
        `Modrinth · Open source modding platform`,
        `All content downloaded from Modrinth.com`,
        `Active instance: ${activeInstance?.name || 'None'} · ${activeInstance?.version_id || 'N/A'}`,
      ]} />
    </div>
  );
}
