import { useState, useEffect, useMemo } from 'react';
import { formatError } from '../shared/utils/errorMapping';
import { api, type VersionEntry } from '../shared/api';
import { useI18n } from '../shared/i18n';
import { SectionHeader } from '../components/layout';
import { Badge, Button, Select } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/Skeleton';
import { useSkeleton } from '../shared/hooks/useSkeleton';
import styles from './VersionsPage.module.css';

export default function VersionsPage() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const { showSkeleton } = useSkeleton({ loading, minDuration: 300 });

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const v = await api.getVersions();
      setVersions(v);
    } catch (e: unknown) {
      setError(formatError(e) || 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (v: VersionEntry) => {
    setDownloading(v.id);
    setError('');
    try {
      await api.downloadVersion(v.id, v.url);
    } catch (e: unknown) {
      setError(formatError(e) || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? versions : versions.filter((v) => v.type === filter)),
    [versions, filter],
  );

  return (
    <div className={styles.page}>
      <SectionHeader title={t('versions.title').toUpperCase()} subtitle={`${versions.length} ${t('versions.count')}`} />
      <div className={styles.controls}>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'release' | 'snapshot' | 'all')}
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
      {showSkeleton ? (
        <div className={`${styles.grid} stagger-children`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.card__header}>
                <Skeleton variant="icon" />
                <Skeleton variant="text" width="50px" />
              </div>
              <Skeleton variant="title" />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="80px" style={{ marginTop: 'auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className={`${styles.grid} stagger-children`}>
          {filtered.map((v) => (
            <div key={v.id} className={`${styles.card} card-glow-hover`}>
              <div className={styles.card__header}>
                <div
                  className={`${styles.card__icon} ${v.type === 'release' ? styles['card__icon--release'] : styles['card__icon--snapshot']}`}
                >
                  <Icon name={v.type === 'release' ? 'cube' : 'bolt'} size={14} />
                </div>
                <Badge variant={v.type === 'release' ? 'accent' : 'default'}>
                  {v.type === 'release' ? t('versions.releaseBadge') : t('versions.snapshotBadge')}
                </Badge>
              </div>
              <div className={styles.card__version}>{v.id}</div>
              <div className={styles.card__meta}>
                <span className={styles.card__type}>{v.type === 'release' ? 'Release' : 'Snapshot'}</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={downloading !== null}
                onClick={() => handleDownload(v)}
                className={styles.card__btn}
              >
                {downloading === v.id ? t('versions.downloading') : t('versions.download')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
