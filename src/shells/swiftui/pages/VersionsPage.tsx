import { useState, useEffect } from 'react';
import { api } from '../../../shared/api';
import { Tabs, Button } from '../components/ui';
import { DownloadIcon } from '../components/icons';
import styles from './VersionsPage.module.css';

export default function VersionsPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [type, setType] = useState('release');

  useEffect(() => {
    async function fetch() {
      try { const data = await api.getVersions(); setVersions(data || []); } catch (e) { console.error('Failed to fetch versions:', e); }
    }
    fetch();
  }, []);

  const filtered = versions.filter((v: any) => type === 'release' ? v.type === 'release' : true);

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Versions</h1>
      <p className="swiftui-page-subtitle">Browse and download Minecraft versions</p>
      <Tabs tabs={[
        { id: 'release', label: 'Releases', content: null },
        { id: 'all', label: 'All', content: null },
      ]} onChange={(id) => setType(id)} />
      <div className={styles.grid}>
        {filtered.map((v: any) => (
          <div key={v.id} className={styles.versionCard}>
            <div className={styles.versionId}>{v.id}</div>
            <div className={styles.versionType}>{v.type}</div>
            <div style={{ marginTop: 'var(--swift-spacing-sm)' }}>
              <Button variant="secondary" size="small"><DownloadIcon size={12} /> Download</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
