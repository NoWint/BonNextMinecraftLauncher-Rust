import { useState, useEffect, useMemo } from 'react';
import { api, type ModProjectFull, type ModVersion } from '../api';
import { useInstances } from '../stores/instanceStore';
import { Breadcrumb, Button, Badge, StatBadge, StatusDot, Tabs, Select } from '../components/ui';
import { InstallButton } from '../components/ui/InstallButton';
import { InstanceSelect } from '../components/ui/InstanceSelect';
import { SectionHeader, Ticker } from '../components/layout';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './ContentDetailPage.module.css';

function parseHash(): { type: string; slug: string } | null {
  const hash = window.location.hash.replace('#/', '');
  if (!hash.startsWith('store/')) return null;
  const parts = hash.split('/');
  if (parts.length >= 3) {
    return { type: parts[1], slug: parts[2].split('?')[0] };
  }
  return null;
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    mod: 'Mods',
    modpack: 'Modpacks',
    resourcepack: 'Resource Packs',
    shader: 'Shaders',
    datapack: 'Data Packs',
  };
  return map[type] || type;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const GAME_VERSIONS = [
  '', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19', '1.18.2', '1.18', '1.17.1', '1.16.5',
];

const LOADERS = ['', 'fabric', 'forge', 'neoforge', 'quilt'];

export default function ContentDetailPage() {
  const parsed = parseHash();
  const { state: instState } = useInstances();

  const [project, setProject] = useState<ModProjectFull | null>(null);
  const [allVersions, setAllVersions] = useState<ModVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [filterVersion, setFilterVersion] = useState('');
  const [filterLoader, setFilterLoader] = useState('');
  const [activeTab, setActiveTab] = useState('versions');

  const instances = instState.instances;

  useEffect(() => {
    if (instances.length > 0 && !selectedInstance) {
      setSelectedInstance(instances[0].id);
    }
  }, [instances, selectedInstance]);

  useEffect(() => {
    if (!parsed) {
      setError('Invalid URL');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [proj, vers] = await Promise.all([
          api.getProjectDetails(parsed.slug),
          api.getModVersions(parsed.slug),
        ]);
        if (!cancelled) {
          setProject(proj);
          setAllVersions(vers);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.toString() || 'Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [parsed?.slug, parsed?.type]);

  const filteredVersions = useMemo(() => {
    return allVersions.filter((v) => {
      if (filterVersion && !v.game_versions.includes(filterVersion)) return false;
      if (filterLoader && !v.loaders.includes(filterLoader)) return false;
      return true;
    });
  }, [allVersions, filterVersion, filterLoader]);

  const selectedVersion = filteredVersions.length > 0 ? filteredVersions[0] : null;

  if (!parsed) {
    return (
      <div className={styles.notFound}>Invalid URL — expected #/store/:type/:slug</div>
    );
  }

  if (error) {
    return <div className={styles.notFound}>{error}</div>;
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingGrid}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className={styles.notFound}>Project not found</div>;
  }

  const breadcrumbItems = [
    { label: 'Marketplace', href: '#/store' },
    { label: getTypeLabel(parsed.type), href: `#/mods?type=${parsed.type}` },
    { label: project.title },
  ];

  return (
    <div className={`page-enter ${styles.page}`}>
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.header__icon}>
          {project.icon_url ? (
            <img className={styles.header__iconImg} src={project.icon_url} alt="" />
          ) : (
            <span className={styles.header__iconFallback}>?</span>
          )}
        </div>

        <div className={styles.header__info}>
          <div className={styles.header__title}>{project.title}</div>
          <div className={styles.header__author}>by {project.author}</div>
          <div className={styles.header__statsRow}>
            <StatBadge icon="⬇" value={formatNum(project.downloads)} label="downloads" />
            <StatBadge icon="❤" value={formatNum(project.follows)} label="follows" />
            {project.categories.map((cat) => (
              <Badge key={cat} variant="muted">{cat}</Badge>
            ))}
            <StatusDot status={
              project.client_side === 'required' ? 'ready' :
              project.client_side === 'optional' ? 'processing' : 'inactive'
            } />
            <span style={{ fontSize: '0.5em', color: 'var(--color-text-dim)' }}>
              {project.client_side === 'required' ? 'Client required' :
               project.client_side === 'optional' ? 'Client optional' : 'Server only'}
            </span>
          </div>
        </div>

        <div className={styles.header__actions}>
          <InstanceSelect
            value={selectedInstance}
            onChange={setSelectedInstance}
            instances={instances}
          />
          <InstallButton
            contentSlug={project.slug}
            contentTitle={project.title}
            instanceId={selectedInstance}
            size="md"
          />
        </div>
      </div>

      {/* Description */}
      <div className={styles.descSection}>
        <SectionHeader title="DESCRIPTION" />
        <div
          className={styles.descBody}
          dangerouslySetInnerHTML={{ __html: project.body }}
        />
      </div>

      {/* Gallery */}
      {project.gallery.length > 0 && (
        <div>
          <SectionHeader title="GALLERY" />
          <div className={styles.gallery}>
            {project.gallery.map((img, i) => (
              <img
                key={i}
                className={styles.gallery__img}
                src={img.url}
                alt={img.title || `Screenshot ${i + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {/* External links */}
      {(project.source_url || project.wiki_url || project.discord_url || project.issues_url) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {project.source_url && (
            <a href={project.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">Source</Button>
            </a>
          )}
          {project.wiki_url && (
            <a href={project.wiki_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">Wiki</Button>
            </a>
          )}
          {project.discord_url && (
            <a href={project.discord_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">Discord</Button>
            </a>
          )}
          {project.issues_url && (
            <a href={project.issues_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">Issues</Button>
            </a>
          )}
        </div>
      )}

      {/* Tabs: Versions / Dependencies */}
      <Tabs
        tabs={[
          { id: 'versions', label: `VERSIONS (${allVersions.length})` },
          { id: 'dependencies', label: 'DEPENDENCIES' },
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'versions' && (
        <div>
          <div className={styles.versionsFilters}>
            <Select
              value={filterVersion}
              onChange={(e) => setFilterVersion(e.target.value)}
              options={[
                { value: '', label: 'All versions' },
                ...GAME_VERSIONS.filter(Boolean).map((v) => ({ value: v, label: v })),
              ]}
            />
            <Select
              value={filterLoader}
              onChange={(e) => setFilterLoader(e.target.value)}
              options={[
                { value: '', label: 'All loaders' },
                ...LOADERS.filter(Boolean).map((l) => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) })),
              ]}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            {filteredVersions.length === 0 ? (
              <div className={styles.notFound} style={{ height: 100 }}>
                No versions match the selected filters
              </div>
            ) : (
              filteredVersions.map((ver) => {
                const primaryFile = ver.files.find(
                  (f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'),
                ) || ver.files[0];

                return (
                  <div key={ver.id} className={styles.versionRow}>
                    <div className={styles.versionRow__num}>{ver.version_number}</div>
                    <div className={styles.versionRow__tags}>
                      {ver.game_versions.slice(0, 4).map((v) => (
                        <Badge key={v} variant="accent">{v}</Badge>
                      ))}
                      {ver.game_versions.length > 4 && (
                        <Badge variant="muted">+{ver.game_versions.length - 4}</Badge>
                      )}
                      {ver.loaders.map((l) => (
                        <Badge key={l} variant="muted">{l}</Badge>
                      ))}
                    </div>
                    {primaryFile && (
                      <div className={styles.versionRow__size}>{formatSize(primaryFile.size)}</div>
                    )}
                    <div className={styles.versionRow__date}>
                      {new Date(ver.date_published).toLocaleDateString()}
                    </div>
                    {primaryFile && selectedInstance && (
                      <InstallButton
                        contentSlug={project.slug}
                        contentTitle={`${project.title} ${ver.version_number}`}
                        instanceId={selectedInstance}
                        gameVersion={ver.game_versions[0]}
                        loader={ver.loaders[0]}
                        size="sm"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'dependencies' && (
        <div className={styles.depList}>
          {selectedVersion && selectedVersion.dependencies.length > 0 ? (
            selectedVersion.dependencies.map((dep, i) => (
              <div key={i} className={styles.depRow}>
                <Badge variant={
                  dep.dependency_type === 'required' ? 'accent' :
                  dep.dependency_type === 'incompatible' ? 'muted' : 'default'
                }>
                  {dep.dependency_type}
                </Badge>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {dep.project_id || 'Unknown project'}
                </span>
                {dep.version_id && (
                  <span style={{ color: 'var(--color-text-dim)' }}>
                    requires {dep.version_id}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className={styles.notFound} style={{ height: 80 }}>
              No dependencies listed for the latest version
            </div>
          )}
        </div>
      )}

      {/* License */}
      {project.license && (
        <div style={{
          fontSize: '0.5em', color: 'var(--color-text-dim)',
          padding: '6px 10px', background: 'var(--color-panel)',
          border: '1px solid var(--color-border)',
        }}>
          License: {project.license.name}
          {project.license.url && <> &mdash; <a href={project.license.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>View</a></>}
        </div>
      )}

      <Ticker messages={[
        `Updated ${new Date(project.date_modified).toLocaleDateString()}`,
        `Created ${new Date(project.date_created).toLocaleDateString()}`,
        `${project.project_type} · Modrinth`,
      ]} />
    </div>
  );
}
