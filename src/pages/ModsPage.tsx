import { useState, useEffect, useCallback } from 'react';
import { api, type ModResult } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { SectionHeader, Ticker } from '../components/layout';
import { Button, TextInput, Select, Badge, StatusDot } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';

const MINECRAFT_VERSIONS = [
  '', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.5', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.3', '1.19.2', '1.19',
  '1.18.2', '1.18.1', '1.18',
  '1.17.1', '1.17',
  '1.16.5',
];

const LOADER_OPTIONS = [
  { value: '', label: 'All loaders' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'forge', label: 'Forge' },
];

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ModCard({
  mod,
  onInstall,
  installing,
}: {
  mod: ModResult;
  onInstall: () => void;
  installing: boolean;
}) {
  return (
    <div
      style={{
        background: '#141414',
        border: '1px solid #1C1C1C',
        padding: '14px 16px',
        display: 'flex',
        gap: 14,
        transition: 'border-color 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2A2A2A')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1C1C1C')}
    >
      <div
        style={{
          width: 52,
          height: 52,
          background: '#1A1A1A',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%)',
        }}
      >
        {mod.icon_url ? (
          <img
            src={mod.icon_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span style={{ color: '#444', fontSize: '1.2em' }}>?</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.78em', color: '#FFF' }}>
            {mod.title}
          </span>
          <Badge variant="accent">{formatDownloads(mod.downloads)}</Badge>
          {mod.categories.slice(0, 2).map((cat) => (
            <Badge key={cat} variant="muted">
              {cat}
            </Badge>
          ))}
        </div>
        <div
          style={{
            fontSize: '0.55em',
            color: '#666',
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {mod.description}
        </div>
        <div style={{ fontSize: '0.5em', color: '#555', marginTop: 4 }}>
          by {mod.author} · Updated {new Date(mod.date_modified).toLocaleDateString()}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Button variant="secondary-highlight" size="sm" disabled={installing} onClick={onInstall}>
          {installing ? '...' : '安装'}
        </Button>
      </div>
    </div>
  );
}

export default function ModsPage() {
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const [mods, setMods] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const instances = instState.instances;
  const activeInstance = instances.length > 0 ? instances[0] : null;

  const loadMods = useCallback(async (query = '') => {
    setLoading(true);
    setError('');
    try {
      if (query.trim()) {
        const [results] = await api.searchMods(query.trim(), version || undefined, loader || undefined, 30, 0);
        setMods(results);
      } else {
        const results = await api.getPopularMods(version || undefined, 30);
        setMods(results);
      }
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load mods');
      setMods([]);
    } finally {
      setLoading(false);
    }
  }, [version, loader]);

  useEffect(() => {
    loadMods();
  }, [loadMods]);

  const handleSearch = () => loadMods(search);

  const handleInstall = async (mod: ModResult) => {
    if (!activeInstance) {
      addToast({ type: 'warning', title: 'No instance selected', message: 'Create an instance first to install mods.' });
      return;
    }
    setInstalling(mod.slug);
    try {
      const versions = await api.getModVersions(
        mod.slug,
        version || activeInstance.version_id,
        loader || activeInstance.loader_type || 'fabric',
      );
      if (versions.length === 0) {
        addToast({
          type: 'error',
          title: 'No compatible version',
          message: `${mod.title} is not available for your version/loader combination.`,
        });
        setInstalling(null);
        return;
      }
      const latest = versions[0];
      const primaryFile = latest.files.find((f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'))
        || latest.files[0];

      await api.installMod(primaryFile.url, primaryFile.filename, activeInstance.id, primaryFile.hashes.sha1 || undefined);
      addToast({
        type: 'success',
        title: 'Mod installed',
        message: `${mod.title} ${latest.version_number} installed to ${activeInstance.name}`,
      });
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Install failed',
        message: e?.toString() || 'Failed to install mod',
      });
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <SectionHeader
        title="MOD BROWSER"
        subtitle={`${mods.length} mods · via Modrinth`}
      />

      {/* Search & filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <TextInput
            placeholder="Search mods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div style={{ minWidth: 130 }}>
          <Select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            options={[
              { value: '', label: 'All versions' },
              ...MINECRAFT_VERSIONS.filter(Boolean).map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div style={{ minWidth: 120 }}>
          <Select
            value={loader}
            onChange={(e) => setLoader(e.target.value)}
            options={LOADER_OPTIONS}
          />
        </div>
        <Button variant="primary" size="md" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {!activeInstance && instances.length === 0 && (
        <div style={{
          background: '#1A1A1A', border: '1px solid #2A2A2A',
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <StatusDot status="inactive" />
          <span style={{ fontSize: '0.55em', color: '#888' }}>
            Create an instance first to install mods with one click.
          </span>
          <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/instances/new')}>
            New instance
          </Button>
        </div>
      )}

      {error && (
        <div style={{ color: '#FF4444', fontSize: '0.55em' }}>{error}</div>
      )}

      {/* Mod list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : mods.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 200, color: '#555', fontSize: '0.7em',
            border: '1px dashed #333',
          }}>
            {search ? 'No mods found matching your search.' : 'Enter a search term to find mods.'}
          </div>
        ) : (
          <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mods.map((mod) => (
              <ModCard
                key={mod.slug}
                mod={mod}
                onInstall={() => handleInstall(mod)}
                installing={installing === mod.slug}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer ticker */}
      <div style={{ marginTop: 'auto' }}>
        <Ticker messages={[
          'Modrinth · Open source modding platform',
          'All mods are downloaded from Modrinth.com',
          `Active instance: ${activeInstance?.name || 'None'} · ${activeInstance?.version_id || 'N/A'}`,
        ]} />
      </div>
    </div>
  );
}
