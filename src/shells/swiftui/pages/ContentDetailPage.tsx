import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../shared/api';
import { Badge } from '../components/ui';
import { InstallButton, CollectionButton } from '../components/features';
import styles from './ContentDetailPage.module.css';

export default function ContentDetailPage() {
  const { slug } = useParams<{ type: string; slug: string }>();
  const [project, setProject] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [collected, setCollected] = useState(false);

  useEffect(() => {
    async function fetch() {
      if (!slug) return;
      try {
        const data = await api.getProjectDetails(slug);
        setProject(data);
        const vData = await api.getModVersions(slug);
        setVersions(vData || []);
      } catch (e) {
        console.error('Failed to fetch project:', e);
      }
    }
    fetch();
  }, [slug]);

  if (!project)
    return (
      <div className="swift-animate-page-enter">
        <p style={{ color: 'var(--swift-text-tertiary)' }}>Loading...</p>
      </div>
    );

  return (
    <div className="swift-animate-page-enter">
      <div className={styles.header}>
        {project.icon_url && (
          <img className={styles.icon} src={project.icon_url} alt={project.title} />
        )}
        <div className={styles.info}>
          <h1 className={styles.title}>{project.title}</h1>
          <p className={styles.description}>{project.description}</p>
          <div className={styles.meta}>
            <span>by {project.author || 'Unknown'}</span>
            <span>{project.downloads?.toLocaleString()} downloads</span>
            {project.categories?.map((c: string) => (
              <Badge key={c} variant="default">
                {c}
              </Badge>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--swift-spacing-md)',
              marginTop: 'var(--swift-spacing-md)',
            }}
          >
            <InstallButton status="idle" onClick={() => {}} />
            <CollectionButton collected={collected} onClick={() => setCollected(!collected)} />
          </div>
        </div>
      </div>
      <div className={styles.versions}>
        <h2 className="swiftui-section-title">Versions</h2>
        {versions.map((v: any) => (
          <div key={v.id} className={styles.versionRow}>
            <span className={styles.versionName}>{v.version_number || v.name}</span>
            <span className={styles.versionDate}>
              {v.date_published ? new Date(v.date_published).toLocaleDateString() : ''}
            </span>
            <InstallButton status="idle" onClick={() => {}} />
          </div>
        ))}
      </div>
    </div>
  );
}
