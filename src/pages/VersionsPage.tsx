import { useState, useEffect } from 'react';
import { api, type VersionEntry } from '../api';
import { SectionHeader } from '../components/layout';
import { Badge, Button, Select } from '../components/ui';
import styles from './VersionsPage.module.css';

export default function VersionsPage() {
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
      <SectionHeader title="VERSIONS" subtitle={`${versions.length} 个版本`} />
      <div className={styles.controls}>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          options={[
            { value: 'release', label: '正式版' },
            { value: 'snapshot', label: '快照' },
            { value: 'all', label: '全部' },
          ]}
        />
        <Button variant="secondary" size="sm" onClick={loadVersions} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
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
              {downloading === v.id ? '下载中...' : '下载'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
