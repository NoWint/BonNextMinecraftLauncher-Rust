import DOMPurify from 'dompurify';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { formatError } from '../utils/errorMapping';
import { api, type ModProjectFull, type ModVersion } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useI18n } from '../i18n';
import { Breadcrumb, Button, Badge, StatBadge, StatusDot, Tabs } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { InstallButton } from '../components/ui/InstallButton';
import { CollectionButton } from '../components/ui/CollectionButton';
import { InstanceSelect } from '../components/ui/InstanceSelect';
import { SectionHeader, Ticker } from '../components/layout';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './ContentDetailPage.module.css';

function useRouteParams(): { type: string; slug: string; source: string } | null {
  const { type, slug } = useParams<{ type: string; slug: string }>();
  const [searchParams] = useSearchParams();
  if (!type || !slug) return null;
  const source = searchParams.get('source') === 'curseforge' ? 'curseforge' : 'modrinth';
  return { type, slug, source };
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

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'hr',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'span',
      'div',
      'sup',
      'sub',
      'del',
      's',
      'mark',
      'details',
      'summary',
    ],
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'src',
      'alt',
      'title',
      'class',
      'id',
      'width',
      'height',
      'colspan',
      'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

export default function ContentDetailPage() {
  const navigate = useNavigate();
  const parsed = useRouteParams();
  const { state: instState } = useInstances();

  const [project, setProject] = useState<ModProjectFull | null>(null);
  const [allVersions, setAllVersions] = useState<ModVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [activeTab, setActiveTab] = useState('versions');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);

  const { t } = useI18n();

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
        let proj: ModProjectFull;
        let vers: ModVersion[];

        if (parsed.source === 'curseforge') {
          const modId = parseInt(parsed.slug, 10);
          [proj, vers] = await Promise.all([api.getCfProjectDetails(modId), api.getCfModVersions(modId)]);
        } else {
          [proj, vers] = await Promise.all([api.getProjectDetails(parsed.slug), api.getModVersions(parsed.slug)]);
        }

        if (!cancelled) {
          setProject(proj);
          setAllVersions(vers);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(formatError(e) || 'Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [parsed?.slug, parsed?.type, parsed?.source]);

  // Keyboard: lightbox navigation
  useEffect(() => {
    if (!lightboxOpen || !project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        return;
      }
      if (e.key === 'ArrowLeft') setGalleryIndex((i) => (i > 0 ? i - 1 : project.gallery.length - 1));
      if (e.key === 'ArrowRight') setGalleryIndex((i) => (i < project.gallery.length - 1 ? i + 1 : 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, project]);

  const activeInstance = useMemo(() => instances.find((i) => i.id === selectedInstance), [instances, selectedInstance]);

  // Compute compatibility for each version vs active instance
  const versionCompat = useMemo(() => {
    if (!activeInstance) return {} as Record<string, 'green' | 'yellow' | 'grey'>;
    const instVer = activeInstance.version_id;
    const instLoader = activeInstance.loader_type;
    const result: Record<string, 'green' | 'yellow' | 'grey'> = {};
    for (const v of allVersions) {
      const verMatch = v.game_versions.includes(instVer);
      const loaderMatch = !instLoader || v.loaders.includes(instLoader);
      if (verMatch && loaderMatch) result[v.id] = 'green';
      else if (verMatch) result[v.id] = 'yellow';
      else result[v.id] = 'grey';
    }
    return result;
  }, [allVersions, activeInstance]);

  // Get the currently selected version object
  const selectedVersion = allVersions.find((v) => v.id === selectedVersionId) || null;

  // Close dropdown on outside click
  useEffect(() => {
    if (!versionDropdownOpen) return;
    const close = () => setVersionDropdownOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [versionDropdownOpen]);

  // Auto-select first compatible (green) version, else first
  useEffect(() => {
    if (allVersions.length === 0 || selectedVersionId) return;
    const firstGreen = allVersions.find((v) => versionCompat[v.id] === 'green');
    setSelectedVersionId(firstGreen ? firstGreen.id : allVersions[0].id);
  }, [allVersions, versionCompat, selectedVersionId]);

  if (!parsed) {
    return <div className={styles.notFound}>Invalid URL — expected #/store/:type/:slug</div>;
  }

  if (error) {
    return (
      <div className={styles.notFound}>
        <div className={styles.notFound__icon}>⚠</div>
        <div className={styles.notFound__title}>{error}</div>
        <div className={styles.notFound__hint}>
          {error.includes('HTTP') || error.includes('network') || error.includes('Network')
            ? t('contentDetail.networkErrorHint')
            : ''}
        </div>
        <div className={styles.notFound__actions}>
          <button
            className={styles.notFound__retryBtn}
            onClick={() => {
              setError('');
              setLoading(true);
              setProject(null);
              setAllVersions([]);
            }}
          >
            {t('common.retry')}
          </button>
          <button
            className={styles.notFound__settingsBtn}
            onClick={() => { navigate('/settings'); }}
          >
            {t('contentDetail.goToSettings')}
          </button>
        </div>
      </div>
    );
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
    { label: 'Marketplace', href: '/store' },
    { label: getTypeLabel(parsed.type), href: `/mods?type=${parsed.type}` },
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
            <StatBadge icon="download" value={formatNum(project.downloads)} label="downloads" />
            <StatBadge icon="heart" value={formatNum(project.follows)} label="follows" />
            {project.categories.map((cat) => (
              <Badge key={cat} variant="muted">
                {cat}
              </Badge>
            ))}
            <StatusDot
              status={
                project.client_side === 'required'
                  ? 'ready'
                  : project.client_side === 'optional'
                    ? 'processing'
                    : 'inactive'
              }
            />
            <span style={{ fontSize: '0.5em', color: 'var(--color-text-dim)' }}>
              {project.client_side === 'required'
                ? 'Client required'
                : project.client_side === 'optional'
                  ? 'Client optional'
                  : 'Server only'}
            </span>
          </div>
        </div>

        <div className={styles.header__actions}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CollectionButton
              slug={project.slug}
              title={project.title}
              author={project.author}
              iconUrl={project.icon_url}
              contentType={parsed.type}
              description={project.description}
              downloads={project.downloads}
              categories={project.categories}
              size="md"
            />
            <InstanceSelect value={selectedInstance} onChange={setSelectedInstance} instances={instances} />
          </div>
          <InstallButton
            contentSlug={project.slug}
            contentTitle={project.title}
            instanceId={selectedInstance}
            contentType={parsed.type}
            source={parsed.source as 'modrinth' | 'curseforge'}
            size="md"
          />
        </div>
      </div>

      {/* Description */}
      <div className={styles.descSection}>
        <SectionHeader title="DESCRIPTION" />
        <div className={styles.descBody} dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.body) }} />
      </div>

      {/* Gallery */}
      <div>
        <SectionHeader title="GALLERY" />
        {project.gallery.length > 0 ? (
          <div className={styles.gallerySection}>
            {/* Main image */}
            <div className={styles.gallery__main}>
              <img
                className={styles.gallery__mainImg}
                src={project.gallery[galleryIndex].url}
                alt={project.gallery[galleryIndex].title || `Screenshot ${galleryIndex + 1}`}
                onClick={() => setLightboxOpen(true)}
              />

              {project.gallery.length > 1 && (
                <>
                  <button
                    className={`${styles.gallery__nav} ${styles['gallery__nav--prev']}`}
                    onClick={() => setGalleryIndex((i) => (i > 0 ? i - 1 : project.gallery.length - 1))}
                    aria-label="Previous image"
                  >
                    {'\u{2039}'}
                  </button>
                  <button
                    className={`${styles.gallery__nav} ${styles['gallery__nav--next']}`}
                    onClick={() => setGalleryIndex((i) => (i < project.gallery.length - 1 ? i + 1 : 0))}
                    aria-label="Next image"
                  >
                    {'\u{203A}'}
                  </button>
                  <div className={styles.gallery__counter}>
                    {galleryIndex + 1} / {project.gallery.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {project.gallery.length > 1 && (
              <div className={styles.gallery__thumbs}>
                {project.gallery.map((img, i) => (
                  <img
                    key={i}
                    className={`${styles.gallery__thumb} ${i === galleryIndex ? styles['gallery__thumb--active'] : ''}`}
                    src={img.url}
                    alt={img.title || `Thumbnail ${i + 1}`}
                    onClick={() => setGalleryIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.gallery__empty}>{t('contentDetail.noScreenshots')}</div>
        )}
      </div>

      {/* External links */}
      {(project.source_url || project.wiki_url || project.discord_url || project.issues_url) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {project.source_url && (
            <a href={project.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">
                Source
              </Button>
            </a>
          )}
          {project.wiki_url && (
            <a href={project.wiki_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">
                Wiki
              </Button>
            </a>
          )}
          {project.discord_url && (
            <a href={project.discord_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">
                Discord
              </Button>
            </a>
          )}
          {project.issues_url && (
            <a href={project.issues_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="sm">
                Issues
              </Button>
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
          {/* Version selector dropdown */}
          <div className={styles.versionSelect}>
            <button
              className={styles.versionSelect__trigger}
              onClick={() => setVersionDropdownOpen(!versionDropdownOpen)}
              type="button"
            >
              {selectedVersion && (
                <div
                  className={`${styles.versionSelect__compat} ${styles[`versionSelect__compat--${versionCompat[selectedVersion.id] || 'grey'}`]}`}
                />
              )}
              <span className={styles.versionSelect__label}>
                {selectedVersion
                  ? `${selectedVersion.version_number} — ${selectedVersion.game_versions.slice(0, 2).join(', ')}`
                  : 'Select version...'}
              </span>
              <span className={styles.versionSelect__arrow}>
                {versionDropdownOpen ? <Icon name="chevronUp" size={10} /> : <Icon name="chevronDown" size={10} />}
              </span>
            </button>

            <div
              className={`${styles.versionSelect__dropdown} ${versionDropdownOpen ? styles['versionSelect__dropdown--open'] : ''}`}
            >
              {allVersions.length === 0 ? (
                <div className={styles.versionSelect__empty}>No versions available</div>
              ) : (
                allVersions.map((ver) => {
                  const compat = versionCompat[ver.id] || 'grey';
                  return (
                    <div
                      key={ver.id}
                      className={`${styles.versionSelect__option} ${ver.id === selectedVersionId ? styles['versionSelect__option--active'] : ''}`}
                      onClick={() => {
                        setSelectedVersionId(ver.id);
                        setVersionDropdownOpen(false);
                      }}
                    >
                      <div
                        className={`${styles.versionSelect__compat} ${styles[`versionSelect__compat--${compat}`]}`}
                      />
                      <span>{ver.version_number}</span>
                      <div className={styles.versionSelect__optionBadges}>
                        {ver.game_versions.slice(0, 3).map((v) => (
                          <Badge key={v} variant="accent">
                            {v}
                          </Badge>
                        ))}
                        {ver.loaders.slice(0, 2).map((l) => (
                          <Badge key={l} variant="muted">
                            {l}
                          </Badge>
                        ))}
                      </div>
                      <div className={styles.versionSelect__optionDate}>
                        {new Date(ver.date_published).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Compatibility hint */}
          {!activeInstance && (
            <div className={styles.versionSelect__hint}>
              <div className={`${styles.versionSelect__compat} ${styles['versionSelect__compat--grey']}`} />
              <span>{t('contentDetail.noInstanceHint')}</span>
            </div>
          )}
          {activeInstance && (
            <div className={styles.versionSelect__hint}>
              <div className={`${styles.versionSelect__compat} ${styles['versionSelect__compat--green']}`} />
              <span>{t('contentDetail.compatible')}</span>
              <div
                className={`${styles.versionSelect__compat} ${styles['versionSelect__compat--yellow']}`}
                style={{ marginLeft: 8 }}
              />
              <span>{t('contentDetail.loaderMismatch')}</span>
              <div
                className={`${styles.versionSelect__compat} ${styles['versionSelect__compat--grey']}`}
                style={{ marginLeft: 8 }}
              />
              <span>{t('contentDetail.versionMismatch')}</span>
            </div>
          )}

          {/* Selected version detail */}
          {selectedVersion && (
            <div style={{ marginTop: 10 }}>
              <div className={styles.versionRow}>
                <div className={styles.versionRow__num}>{selectedVersion.version_number}</div>
                <div className={styles.versionRow__tags}>
                  {selectedVersion.game_versions.map((v) => (
                    <Badge key={v} variant="accent">
                      {v}
                    </Badge>
                  ))}
                  {selectedVersion.loaders.map((l) => (
                    <Badge key={l} variant="muted">
                      {l}
                    </Badge>
                  ))}
                </div>
                {(() => {
                  const primaryFile =
                    selectedVersion.files.find(
                      (f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'),
                    ) || selectedVersion.files[0];
                  return (
                    <>
                      {primaryFile && <div className={styles.versionRow__size}>{formatSize(primaryFile.size)}</div>}
                      <div className={styles.versionRow__date}>
                        {new Date(selectedVersion.date_published).toLocaleDateString()}
                      </div>
                      {primaryFile && selectedInstance && (
                        <InstallButton
                          contentSlug={project.slug}
                          contentTitle={`${project.title} ${selectedVersion.version_number}`}
                          instanceId={selectedInstance}
                          gameVersion={selectedVersion.game_versions[0]}
                          loader={selectedVersion.loaders[0]}
                          contentType={parsed.type}
                          source={parsed.source as 'modrinth' | 'curseforge'}
                          size="sm"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dependencies' && (
        <div className={styles.depList}>
          {selectedVersion && selectedVersion.dependencies.length > 0 ? (
            selectedVersion.dependencies.map((dep, i) => (
              <div key={i} className={styles.depRow}>
                <Badge
                  variant={
                    dep.dependency_type === 'required'
                      ? 'accent'
                      : dep.dependency_type === 'incompatible'
                        ? 'muted'
                        : 'default'
                  }
                >
                  {dep.dependency_type}
                </Badge>
                <span style={{ color: 'var(--color-text-secondary)' }}>{dep.project_id || 'Unknown project'}</span>
                {dep.version_id && <span style={{ color: 'var(--color-text-dim)' }}>requires {dep.version_id}</span>}
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
        <div
          style={{
            fontSize: '0.5em',
            color: 'var(--color-text-dim)',
            padding: '6px 10px',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
          }}
        >
          License: {project.license.name}
          {project.license.url && (
            <>
              {' '}
              &mdash;{' '}
              <a
                href={project.license.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-accent)' }}
              >
                View
              </a>
            </>
          )}
        </div>
      )}

      <Ticker
        messages={[
          `Updated ${new Date(project.date_modified).toLocaleDateString()}`,
          `Created ${new Date(project.date_created).toLocaleDateString()}`,
          `${project.project_type} · ${parsed.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}`,
        ]}
      />

      {/* Lightbox */}
      {lightboxOpen && project.gallery.length > 0 && (
        <div className={styles.lightbox} onClick={() => setLightboxOpen(false)}>
          <button className={styles.lightbox__close} onClick={() => setLightboxOpen(false)}>
            {'\u{2715}'}
          </button>

          {project.gallery.length > 1 && (
            <>
              <button
                className={`${styles.lightbox__nav} ${styles['lightbox__nav--prev']}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryIndex((i) => (i > 0 ? i - 1 : project.gallery.length - 1));
                }}
              >
                {'\u{2039}'}
              </button>
              <button
                className={`${styles.lightbox__nav} ${styles['lightbox__nav--next']}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryIndex((i) => (i < project.gallery.length - 1 ? i + 1 : 0));
                }}
              >
                {'\u{203A}'}
              </button>
              <div className={styles.lightbox__counter}>
                {galleryIndex + 1} / {project.gallery.length}
              </div>
            </>
          )}

          <img
            className={styles.lightbox__img}
            src={project.gallery[galleryIndex].url}
            alt={project.gallery[galleryIndex].title || `Screenshot ${galleryIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
