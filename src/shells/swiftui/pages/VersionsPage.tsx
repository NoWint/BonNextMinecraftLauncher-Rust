import { useState, useEffect } from 'react';
import { api } from '../../../shared/api';
import type { VersionEntry } from '../../../shared/api/types';
import { Tabs, Button, Skeleton } from '../components/ui';
import { DownloadIcon } from '../components/icons';
import { useDownloads } from '../../../shared/stores/downloadStore';
import { useToast } from '../../../shared/stores/toastStore';
import styles from './VersionsPage.module.css';

export default function VersionsPage() {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [type, setType] = useState('release');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { addTask, updateTask } = useDownloads();
  const { addToast } = useToast();

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const data = await api.getVersions();
        setVersions(data || []);
      } catch (e) {
        addToast({ type: 'error', title: 'Failed to load versions', message: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [addToast]);

  const filtered = versions.filter((v) => type === 'release' ? v.type === 'release' : true);

  const handleDownload = async (v: VersionEntry) => {
    if (downloading) return;
    setDownloading(v.id);
    const taskId = `version-${v.id}-${Date.now()}`;
    addTask({
      id: taskId,
      title: `Download ${v.id}`,
      filename: v.id,
      status: 'downloading',
      startedAt: Date.now(),
    });
    try {
      await api.downloadVersion(v.id, v.url);
      updateTask(taskId, 'complete');
    } catch (e) {
      addToast({ type: 'error', title: 'Download failed', message: e instanceof Error ? e.message : String(e) });
      updateTask(taskId, 'failed', e instanceof Error ? e.message : 'Download failed');
    }
    setDownloading(null);
  };

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Versions</h1>
      <p className="swiftui-page-subtitle">Browse and download Minecraft versions</p>
      <Tabs tabs={[
        { id: 'release', label: 'Releases', content: null },
        { id: 'all', label: 'All', content: null },
      ]} onChange={(id) => setType(id)} />
      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.versionCard}>
              <Skeleton variant="title" />
              <Skeleton variant="text" />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((v) => (
            <div key={v.id} className={styles.versionCard}>
              <div className={styles.versionId}>{v.id}</div>
              <div className={styles.versionType}>{v.type}</div>
              <div style={{ marginTop: 'var(--swift-spacing-sm)' }}>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleDownload(v)}
                  disabled={downloading === v.id}
                >
                  <DownloadIcon size={12} /> {downloading === v.id ? 'Downloading...' : 'Download'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
