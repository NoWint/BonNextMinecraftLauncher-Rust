import { useState, useEffect } from 'react';
import { api, type VersionEntry } from '../api';
import { useI18n } from '../i18n';
import { SectionHeader } from '../components/layout';
import { Badge, Button, Select } from '../components/ui';
import styles from './VersionsPage.module.css';

export default function VersionsPage() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'release' | 'snapshot' | 'all'>('release');

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

  const filtered = filter === 'all' ? versions : versions.filter((v) => v.type === filter);

  return (
    <div className="page-enter">
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
      <div className={`${styles.list} stagger-children`}>
        {filtered.map((v) => (
          <div key={v.id} className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowName}>{v.id}</span>
              <Badge variant={v.type === 'release' ? 'accent' : 'default'}>
                {v.type === 'release' ? 'RELEASE' : 'SNAPSHOT'}
              </Badge>
            </div>
            <Button variant="primary" size="sm" disabled={downloading !== null} onClick={() => handleDownload(v)}>
              {downloading === v.id ? t('versions.downloading') : t('versions.download')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
