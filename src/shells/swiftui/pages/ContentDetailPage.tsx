import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../shared/api';
import type { ModProjectFull, ModVersion } from '../../../shared/api/types';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useToast } from '../../../shared/stores/toastStore';
import { Badge, Skeleton } from '../components/ui';
import { InstallButton, CollectionButton, InstanceSelect } from '../components/features';
import styles from './ContentDetailPage.module.css';

type InstallStatus = 'idle' | 'installing' | 'installed' | 'updating';

export default function ContentDetailPage() {
  const { type, slug } = useParams<{ type: string; slug: string }>();
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const [project, setProject] = useState<ModProjectFull | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [collected, setCollected] = useState(false);
  const [installStatus, setInstallStatus] = useState<InstallStatus>('idle');
  const [versionStatuses, setVersionStatuses] = useState<Record<string, InstallStatus>>({});
  const [selectedInstanceId, setSelectedInstanceId] = useState(instState.instances[0]?.id);
  const [loading, setLoading] = useState(true);

  const source = type === 'curseforge' ? 'curseforge' : 'modrinth';

  useEffect(() => {
    async function fetch() {
      if (!slug) return;
      setLoading(true);
      try {
        if (source === 'curseforge') {
          const modId = Number(slug);
          const data = await api.getCfProjectDetails(modId);
          setProject(data);
          const vData = await api.getCfModVersions(modId);
          setVersions(vData || []);
        } else {
          const data = await api.getProjectDetails(slug);
          setProject(data);
          const vData = await api.getModVersions(slug);
          setVersions(vData || []);
        }
      } catch (e) {
        addToast({ type: 'error', title: 'Failed to load project', message: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [slug, source, addToast]);

  useEffect(() => {
    if (!slug) return;
    api.isInCollection(slug)
      .then((isCollected) => setCollected(isCollected))
      .catch(() => setCollected(false));
  }, [slug]);

  const handleInstall = async (version?: ModVersion) => {
    if (!slug || !selectedInstanceId) {
      addToast({ type: 'warning', title: 'Select an instance first' });
      return;
    }

    const targetVersion = version || versions[0];
    if (!targetVersion) {
      addToast({ type: 'error', title: 'No version available' });
      return;
    }

    const file = targetVersion.files?.[0];
    if (!file) {
      addToast({ type: 'error', title: 'No download file available' });
      return;
    }

    const setStatus = (s: InstallStatus) => {
      if (version) {
        setVersionStatuses((prev) => ({ ...prev, [version.id]: s }));
      } else {
        setInstallStatus(s);
      }
    };

    setStatus('installing');
    try {
      await api.installContent(
        file.url,
        file.filename,
        selectedInstanceId,
        project?.project_type,
        file.hashes?.sha1 ?? undefined,
        slug,
        targetVersion.id,
        source,
      );
      setStatus('installed');
      addToast({ type: 'success', title: 'Installed', message: `${project?.title || slug} installed successfully` });
    } catch (e) {
      setStatus('idle');
      addToast({ type: 'error', title: 'Install failed', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  };

  const handleToggleCollection = async () => {
    if (!slug || !project) return;
    try {
      if (collected) {
        await api.removeFromCollection(slug);
        setCollected(false);
        addToast({ type: 'info', title: 'Removed from collection' });
      } else {
        await api.addToCollection(
          slug,
          project.title,
          project.author,
          project.icon_url,
          project.project_type,
          project.description,
          project.downloads,
          project.categories,
        );
        setCollected(true);
        addToast({ type: 'success', title: 'Added to collection' });
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Collection update failed', message: e instanceof Error ? e.message : 'Unknown error' });
    }
  };

  if (loading || !project)
    return (
      <div className="swift-animate-page-enter">
        <div className={styles.header}>
          <Skeleton variant="avatar" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--swift-spacing-sm)' }}>
            <Skeleton variant="title" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <div style={{ display: 'flex', gap: 'var(--swift-spacing-sm)' }}>
              <Skeleton variant="text" className={styles.skeletonShort} />
              <Skeleton variant="text" className={styles.skeletonShort} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 'var(--swift-spacing-lg)' }}>
          <Skeleton variant="title" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--swift-spacing-md)', marginTop: 'var(--swift-spacing-sm)' }}>
              <div style={{ flex: 1 }}><Skeleton variant="text" /></div>
              <Skeleton variant="text" className={styles.skeletonShort} />
            </div>
          ))}
        </div>
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
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <InstanceSelect
              instances={instState.instances}
              selectedId={selectedInstanceId}
              onSelect={setSelectedInstanceId}
            />
            <InstallButton
              status={installStatus}
              onClick={() => handleInstall()}
            />
            <CollectionButton collected={collected} onClick={handleToggleCollection} />
          </div>
        </div>
      </div>
      <div className={styles.versions}>
        <h2 className="swiftui-section-title">Versions</h2>
        {versions.map((v) => (
          <div key={v.id} className={styles.versionRow}>
            <span className={styles.versionName}>{v.version_number || v.name}</span>
            <span className={styles.versionDate}>
              {v.date_published ? new Date(v.date_published).toLocaleDateString() : ''}
            </span>
            <InstallButton
              status={versionStatuses[v.id] || 'idle'}
              onClick={() => handleInstall(v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
