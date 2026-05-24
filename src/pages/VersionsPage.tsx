import { useState, useEffect, useMemo, useCallback } from 'react';
import { api, type VersionEntry } from '../api';
import { useI18n } from '../i18n';
import { SectionHeader } from '../components/layout';
import { Badge, Button, Select } from '../components/ui';
import styles from './VersionsPage.module.css';

const ITEM_HEIGHT = 48;

export default function VersionsPage() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => { loadVersions(); }, []);

  const loadVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const v = await api.getVersions();
      setVersions(v);
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (v: VersionEntry) => {
    setDownloading(v.id);
    setError('');
    try {
      await api.downloadVersion(v.id, v.url);
    } catch (e: any) {
      setError(e?.toString() || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const filtered = useMemo(() =>
    filter === 'all' ? versions : versions.filter((v) => v.type === filter),
    [versions, filter]
  );

  const VISIBLE_COUNT = Math.ceil(window.innerHeight / ITEM_HEIGHT) + 10;
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = Math.min(startIndex + VISIBLE_COUNT, filtered.length);
  const visibleItems = filtered.slice(startIndex, endIndex);
  const totalHeight = filtered.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div>
      <SectionHeader title={t('versions.title').toUpperCase()} subtitle={`${versions.length} ${t('versions.count')}`} />
      <div className={styles.controls}>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          options={[
            { value: 'release', label: t('versions.release') },
            { value: 'snapshot', label: t('versions.snapshot') },
            { value: 'all', label: t('versions.all') },
          ]}
        />
        <Button variant="secondary" size="sm" onClick={loadVersions} disabled={loading}>
          {loading ? t('versions.loading') : t('versions.refresh')}
        </Button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div
        className={`${styles.list} stagger-children`}
        style={{ height: Math.min(totalHeight, window.innerHeight - 200), overflowY: 'auto' }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
            {visibleItems.map((v) => (
              <div key={v.id} className={styles.row} style={{ height: ITEM_HEIGHT }}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowName}>{v.id}</span>
                  <Badge variant={v.type === 'release' ? 'accent' : 'default'}>
                    {v.type === 'release' ? t('versions.releaseBadge') : t('versions.snapshotBadge')}
                  </Badge>
                </div>
                <Button variant="primary" size="sm" disabled={downloading !== null} onClick={() => handleDownload(v)}>
                  {downloading === v.id ? t('versions.downloading') : t('versions.download')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
