import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type GameInstance, type ServerStatus, type PlaytimeStats } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { Badge, Modal, TextInput, Button } from '../components/ui';
import { SubLabel } from '../components/layout';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import styles from './InstancesPage.module.css';

function getLoaderClass(loader: string | null): string {
  return loader === 'fabric' ? 'fabric' : loader === 'forge' ? 'forge' : 'vanilla';
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return '< 1m';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatPlaytimeShort(seconds: number): string {
  if (seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTodayPlaytime(seconds: number): string {
  if (seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

type SortKey = 'recent' | 'name' | 'playtime' | 'version';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'name', label: 'A–Z' },
  { key: 'playtime', label: 'Most Played' },
  { key: 'version', label: 'Version' },
];

export default function InstancesPage() {
  const { state: authState } = useAuth();
  const { state, deleteInstance, reloadInstances } = useInstances();
  const { t } = useI18n();
  const { addToast } = useToast();
  const auth = authState.currentUser;

  const getLoaderLabel = (loader: string | null): string => {
    switch (loader) { case 'fabric': return t('common.fabric'); case 'forge': return t('common.forge'); default: return t('common.vanilla'); }
  };

  const relativeTime = (dateStr: string | null): string => {
    if (!dateStr) return t('common.neverPlayed');
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };
  const { instances } = state;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [confirmDelete, setConfirmDelete] = useState<GameInstance | null>(null);
  const [error, setError] = useState('');
  const [duplicating, setDuplicating] = useState<GameInstance | null>(null);
  const [dupName, setDupName] = useState('');
  const [importing, setImporting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; inst: GameInstance } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [servers, setServers] = useState<Array<{ name: string; address: string }>>(() => {
    try {
      const saved = localStorage.getItem('bonnext_servers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newAddress, setNewAddress] = useState('');
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus | null>>({});
  const [editingServerName, setEditingServerName] = useState<Record<string, string>>({});
  const [playtimeStats, setPlaytimeStats] = useState<PlaytimeStats | null>(null);
  const [anomalies, setAnomalies] = useState<Array<{ anomaly_type: string; severity: string; message: string; suggestion: string }>>([]);

  const [gameDir, setGameDir] = useState<string>('');
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getGameDir().then(setGameDir).catch(() => {});
  }, []);

  useEffect(() => {
    if (!gameDir || instances.length === 0) return;
    const urls: Record<string, string> = {};
    instances.forEach((inst) => {
      urls[inst.id] = convertFileSrc(`${gameDir}/instances/${inst.id}/icon.png`);
    });
    setIconUrls(urls);
  }, [gameDir, instances]);

  useEffect(() => {
    const checkAll = async () => {
      const states: Record<string, boolean | null> = {};
      for (const inst of instances) {
        try { states[inst.id] = await api.checkInstanceReady(inst.id); }
        catch { states[inst.id] = null; }
      }
      setReadyStates(states);
    };
    if (instances.length > 0) checkAll();
  }, [instances]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    localStorage.setItem('bonnext_servers', JSON.stringify(servers));
  }, [servers]);

  useEffect(() => {
    api.getPlaytimeStats().then(setPlaytimeStats).catch(() => {});
  }, []);

  useEffect(() => {
    const pollAll = async () => {
      const results: Record<string, ServerStatus | null> = {};
      for (const s of servers) {
        try {
          results[s.address] = await api.pingServer(s.address);
        } catch {
          results[s.address] = null;
        }
      }
      setServerStatuses(results);
    };
    pollAll();
    const timer = setInterval(pollAll, 30000);
    return () => clearInterval(timer);
  }, [servers]);

  useEffect(() => {
    if (instances.length > 0) {
      api.detectAnomalies(instances[0].id).then(setAnomalies).catch(() => setAnomalies([]));
    } else {
      setAnomalies([]);
    }
  }, [instances]);

  const handleAddServer = () => {
    const trimmed = newAddress.trim();
    if (!trimmed) return;
    if (servers.some(s => s.address === trimmed)) return;
    const name = trimmed.split(':')[0];
    setServers(prev => [...prev, { name, address: trimmed }]);
    setNewAddress('');
  };

  const handleRemoveServer = (address: string) => {
    setServers(prev => prev.filter(s => s.address !== address));
    setServerStatuses(prev => {
      const next = { ...prev };
      delete next[address];
      return next;
    });
  };

  const handleServerNameSave = (address: string) => {
    const newName = editingServerName[address];
    if (newName && newName.trim()) {
      setServers(prev => prev.map(s => s.address === address ? { ...s, name: newName.trim() } : s));
    }
    setEditingServerName(prev => {
      const next = { ...prev };
      delete next[address];
      return next;
    });
  };

  const handleLaunch = useCallback(async (inst: GameInstance) => {
    setError('');
    try {
      await api.launchGame(
        inst.version_id, inst.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', inst.max_memory, inst.min_memory,
        inst.java_path || undefined, inst.jvm_args || undefined,
        inst.id,
      );
      addToast({ type: 'success', title: 'Launching', message: `${inst.name} is starting...` });
    } catch (e: any) {
      setError(e?.toString() || 'Launch failed');
      addToast({ type: 'error', title: 'Launch failed', message: e?.toString() || '' });
    }
  }, [auth, addToast]);

  const handleDuplicate = useCallback(async () => {
    if (!duplicating || !dupName.trim()) return;
    try {
      await api.duplicateInstance(duplicating.id, dupName.trim());
      addToast({ type: 'success', title: 'Duplicated', message: `"${dupName}" created` });
      await reloadInstances();
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed', message: e?.toString() || '' });
    } finally {
      setDuplicating(null); setDupName('');
    }
  }, [duplicating, dupName, reloadInstances, addToast]);

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }],
      });
      if (!selected || typeof selected !== 'string') return;
      setImporting(true);
      addToast({ type: 'info', title: 'Importing modpack...', message: 'Parsing and downloading mods' });
      const inst = await api.importModpack(selected);
      await reloadInstances();
      setImporting(false);
      addToast({ type: 'success', title: 'Imported', message: `"${inst.name}" is ready to play` });
      window.location.hash = `#/instances/${inst.id}`;
    } catch (e: any) {
      setImporting(false);
      addToast({ type: 'error', title: 'Import failed', message: e?.toString() || '' });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, inst: GameInstance) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, inst });
  };

  const filtered = instances
    .filter((inst) => !search || inst.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortKey) {
        case 'recent':
          const aTime = a.last_played ? new Date(a.last_played).getTime() : 0;
          const bTime = b.last_played ? new Date(b.last_played).getTime() : 0;
          return bTime - aTime;
        case 'name': return a.name.localeCompare(b.name);
        case 'playtime': return b.playtime_seconds - a.playtime_seconds;
        case 'version': return b.version_id.localeCompare(a.version_id);
        default: return 0;
      }
    });

  const heroInstance = filtered.length > 0 ? filtered[0] : null;
  const loaderClass = getLoaderClass(heroInstance?.loader_type ?? null);
  const isHeroReady = heroInstance ? readyStates[heroInstance.id] : null;

  return (
    <div className={`page-enter ${styles.page}`}>

      {/* ---- Hero Banner ---- */}
      {heroInstance && (
        <div
          className={`${styles.hero} hero-reveal hero-glow-breathe`}
          onClick={() => handleLaunch(heroInstance)}
          onContextMenu={(e) => handleContextMenu(e, heroInstance)}
        >
          <div className={`${styles.hero__bg} ${styles[`hero__bg--${loaderClass}`]}`} />
          <div className={styles.hero__decor} />

          <div className={styles.hero__content}>
            <div className={`${styles.hero__icon} ${styles[`hero__icon--${loaderClass}`]}`}>
              {iconUrls[heroInstance.id] ? (
                <img src={iconUrls[heroInstance.id]} alt={heroInstance.name} className={styles.hero__iconImg} />
              ) : (
                <span className={styles.hero__iconChar}>{heroInstance.name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className={styles.hero__info}>
              <div className={styles.hero__label}>
                {heroInstance.last_played ? 'LAST PLAYED' : 'READY TO PLAY'}
              </div>
              <h1 className={styles.hero__name}>{heroInstance.name}</h1>
              <div className={styles.hero__meta}>
                <span className={styles.hero__metaItem}>
                  <span className={`${styles.hero__metaDot} ${isHeroReady === true ? styles['hero__metaDot--ready'] : isHeroReady === false ? styles['hero__metaDot--download'] : styles['hero__metaDot--unknown']}`} />
                  {isHeroReady === null ? t('common.checking') : isHeroReady ? t('common.ready') : t('common.needsDownload')}
                </span>
                <span className={styles.hero__metaItem}>
                  <Badge variant="accent">{heroInstance.version_id}</Badge>
                </span>
                {heroInstance.loader_type && (
                  <span className={styles.hero__metaItem}>
                    <Badge variant="muted">{getLoaderLabel(heroInstance.loader_type)}{heroInstance.loader_version ? ` ${heroInstance.loader_version}` : ''}</Badge>
                  </span>
                )}
                <span className={styles.hero__metaItem}>
                  {Math.round(heroInstance.max_memory / 1024)}GB
                </span>
                <span className={styles.hero__metaItem}>
                  {formatPlaytime(heroInstance.playtime_seconds)} played
                </span>
              </div>
            </div>

            <div className={styles.hero__actions}>
              <button className={`${styles.hero__playBtn} play-pulse`} title="Play">▶</button>
              <button className={styles.hero__contextBtn} onClick={(e) => { e.stopPropagation(); window.location.hash = `#/instances/${heroInstance.id}`; }}>
                ⚙ Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Header bar ---- */}
      <div className={styles.headerBar}>
        <div className={styles.headerBar__left}>
          <span className={styles.headerBar__title}>ALL INSTANCES</span>
          <span className={styles.headerBar__count}>{instances.length} total</span>
        </div>
        <div className={styles.headerBar__right}>
          <TextInput
            placeholder="Filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" size="sm" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : '📥 Import'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.location.hash = '#/instances/new'}>
            + New
          </Button>
        </div>
      </div>

      {/* ---- Sort pills ---- */}
      <div className={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`${styles.sortPill} ${sortKey === opt.key ? styles['sortPill--active'] : ''}`}
            onClick={() => setSortKey(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ---- Library Grid ---- */}
      {instances.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyState__icon}>📦</div>
          <div className={styles.emptyState__title}>NO INSTANCES YET</div>
          <div className={styles.emptyState__desc}>
            Create your first Minecraft instance to get started. Each instance has its own mods, worlds, and settings.
          </div>
          <Button variant="primary" size="md" onClick={() => window.location.hash = '#/instances/new'}>
            + Create instance
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.noMatch}>No instances match your filter.</div>
      ) : (
        <div className={styles.libraryGrid}>
          {filtered.map((inst, i) => {
            const ldrClass = getLoaderClass(inst.loader_type);
            const isReady = readyStates[inst.id] ?? null;
            const coverClass = styles[`coverCard__cover--${ldrClass}`] || styles['coverCard__cover--vanilla'];

            return (
              <div
                key={inst.id}
                className={`${styles.coverCard} card-glow-hover card-rise`}
                style={{ animationDelay: `${i * 50 + 50}ms` }}
                onContextMenu={(e) => handleContextMenu(e, inst)}
              >
                <div
                  className={`${styles.coverCard__cover} ${coverClass}`}
                  onClick={(e) => { e.stopPropagation(); window.location.hash = `#/instances/${inst.id}`; }}
                >
                  <div className={styles.coverCard__coverPattern} />
                  {iconUrls[inst.id] ? (
                    <img
                      src={iconUrls[inst.id]}
                      alt={inst.name}
                      className={styles.coverCard__coverImg}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove(styles.coverCard__placeholderHidden);
                      }}
                    />
                  ) : null}
                  <div className={`${styles.coverCard__placeholder} ${iconUrls[inst.id] ? styles.coverCard__placeholderHidden : ''}`}>
                    <span className={styles.coverCard__placeholderChar}>{inst.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className={styles.coverCard__overlay}>
                    <div className={`${styles.coverCard__playCircle} play-pulse`}>⚙</div>
                  </div>
                  <div className={`${styles.coverCard__statusDot} ${isReady === true ? styles['coverCard__statusDot--ready'] : isReady === false ? styles['coverCard__statusDot--download'] : styles['coverCard__statusDot--unknown']} ${isReady === true ? 'status-breathe-ready' : isReady === false ? 'status-breathe-download' : ''}`} />
                </div>
                <div className={styles.coverCard__body}>
                  <div className={styles.coverCard__title}>{inst.name}</div>
                  <div className={styles.coverCard__version}>{inst.version_id}</div>
                  <div className={styles.coverCard__meta}>
                    {inst.loader_type && (
                      <span className={styles.coverCard__loaderTag}>{getLoaderLabel(inst.loader_type)}</span>
                    )}
                    <span className={styles.coverCard__playtime}>
                      {formatPlaytime(inst.playtime_seconds)}
                    </span>
                    <span className={styles.coverCard__playtime}>
                      {relativeTime(inst.last_played)}
                    </span>
                  </div>
                  <div className={styles.coverCard__actions}>
                    <button
                      className={styles.coverCard__actionBtn}
                      onClick={(e) => { e.stopPropagation(); handleLaunch(inst); }}
                    >
                      ▶ Play
                    </button>
                    <button
                      className={styles.coverCard__actionBtn}
                      onClick={(e) => { e.stopPropagation(); window.location.hash = `#/instances/${inst.id}`; }}
                    >
                      ⚙ Manage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Context menu ---- */}
      {contextMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className={styles.contextMenu__item} onClick={() => { handleLaunch(contextMenu.inst); setContextMenu(null); }}>
            ▶ Play
          </button>
          <button className={styles.contextMenu__item} onClick={() => { window.location.hash = `#/instances/${contextMenu.inst.id}`; setContextMenu(null); }}>
            ⚙ Details
          </button>
          <div className={styles.contextMenu__separator} />
          <button className={styles.contextMenu__item} onClick={() => { setDuplicating(contextMenu.inst); setDupName(`${contextMenu.inst.name} (Copy)`); setContextMenu(null); }}>
            📋 Duplicate
          </button>
          <button className={styles.contextMenu__item} onClick={() => { setConfirmDelete(contextMenu.inst); setContextMenu(null); }}>
            📤 Export
          </button>
          <div className={styles.contextMenu__separator} />
          <button className={`${styles.contextMenu__item} ${styles['contextMenu__item--danger']}`} onClick={() => { setConfirmDelete(contextMenu.inst); setContextMenu(null); }}>
            🗑 Delete
          </button>
        </div>
      )}

      {/* ---- Delete modal ---- */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete instance"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={async () => {
              if (confirmDelete) { await deleteInstance(confirmDelete.id); addToast({ type: 'success', title: 'Deleted', message: `"${confirmDelete.name}" removed` }); }
              setConfirmDelete(null);
            }}>Delete</Button>
          </>
        }
      >
        Are you sure you want to delete "{confirmDelete?.name}"? This action cannot be undone.
      </Modal>

      {/* ---- Duplicate modal ---- */}
      <Modal
        open={duplicating !== null}
        onClose={() => { setDuplicating(null); setDupName(''); }}
        title="Duplicate instance"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setDuplicating(null); setDupName(''); }}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleDuplicate} disabled={!dupName.trim()}>Duplicate</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>Name:</label>
          <TextInput value={dupName} onChange={(e) => setDupName(e.target.value)} placeholder="Instance name" autoFocus />
        </div>
      </Modal>

      {/* ---- Server Monitor ---- */}
      <div className={styles.serverMonitor}>
        <div className={styles.serverMonitor__header}>
          <SubLabel>SERVER MONITOR</SubLabel>
          <span className={styles.serverMonitor__count}>
            {String(servers.length).padStart(2, '0')}
          </span>
        </div>

        <div className={styles.serverMonitor__addRow}>
          <input
            className={styles.serverMonitor__input}
            type="text"
            placeholder="address:port"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddServer(); }}
          />
          <Button variant="primary" size="sm" onClick={handleAddServer}>
            + ADD
          </Button>
        </div>

        <div className={styles.serverMonitor__list}>
          {servers.length === 0 ? (
            <div className={styles.serverMonitor__empty}>
              No servers added. Enter an address above.
            </div>
          ) : (
            servers.map((server) => {
              const status = serverStatuses[server.address];
              const isOnline = status?.online ?? null;
              const isEditing = editingServerName[server.address] !== undefined;

              return (
                <div key={server.address} className={styles.serverCard}>
                  <div className={styles.serverCard__statusDot}>
                    <span
                      className={`${styles.serverCard__dot} ${
                        isOnline === null ? styles['serverCard__dot--unknown']
                        : isOnline ? styles['serverCard__dot--online']
                        : styles['serverCard__dot--offline']
                      }`}
                    />
                  </div>

                  <div className={styles.serverCard__info}>
                    {isEditing ? (
                      <input
                        className={styles.serverCard__nameInput}
                        value={editingServerName[server.address]}
                        onChange={(e) =>
                          setEditingServerName(prev => ({
                            ...prev,
                            [server.address]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleServerNameSave(server.address);
                          if (e.key === 'Escape') {
                            setEditingServerName(prev => {
                              const next = { ...prev };
                              delete next[server.address];
                              return next;
                            });
                          }
                        }}
                        onBlur={() => handleServerNameSave(server.address)}
                        autoFocus
                      />
                    ) : (
                      <span
                        className={styles.serverCard__name}
                        onDoubleClick={() =>
                          setEditingServerName(prev => ({
                            ...prev,
                            [server.address]: server.name,
                          }))
                        }
                        title="Double-click to rename"
                      >
                        {server.name}
                      </span>
                    )}
                    <span className={styles.serverCard__address}>
                      {server.address}
                    </span>
                    <div className={styles.serverCard__meta}>
                      <span className={styles.serverCard__statusLabel}>
                        {isOnline === null ? 'Pinging...'
                          : isOnline ? 'Online' : 'Offline'}
                      </span>
                      {isOnline && status && (
                        <>
                          <span className={styles.serverCard__metaSep}>·</span>
                          <span className={styles.serverCard__players}>
                            {status.players_online}/{status.players_max}
                          </span>
                          <span className={styles.serverCard__metaSep}>·</span>
                          <span className={styles.serverCard__latency}>
                            {status.latency_ms}ms
                          </span>
                          {status.version && (
                            <>
                              <span className={styles.serverCard__metaSep}>·</span>
                              <span className={styles.serverCard__version}>
                                {status.version}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    className={styles.serverCard__remove}
                    onClick={() => handleRemoveServer(server.address)}
                    title="Remove server"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---- Playtime Dashboard ---- */}
      <div className={styles.playtimeDashboard}>
        <div className={styles.playtimeDashboard__header}>
          <SubLabel>PLAYTIME</SubLabel>
        </div>
        <div className={styles.playtimeDashboard__grid}>
          <div className={styles.playtimeDashboard__stat}>
            <div className={styles.playtimeDashboard__statValue}>
              {(instances.reduce((s, i) => s + (i.playtime_seconds || 0), 0) / 3600).toFixed(1)}
              <span className={styles.playtimeDashboard__statUnit}>h</span>
            </div>
            <div className={styles.playtimeDashboard__statLabel}>Total</div>
          </div>
          <div className={styles.playtimeDashboard__stat}>
            <div className={styles.playtimeDashboard__statValue}>
              {playtimeStats
                ? formatTodayPlaytime(
                    Object.values(playtimeStats.daily).reduce((s, v) => s + v, 0)
                  )
                : '—'}
            </div>
            <div className={styles.playtimeDashboard__statLabel}>Today</div>
          </div>
        </div>
        {playtimeStats && playtimeStats.top_instances.length > 0 && (
          <div className={styles.playtimeDashboard__topList}>
            <div className={styles.playtimeDashboard__topLabel}>Top Playtime</div>
            {playtimeStats.top_instances.slice(0, 3).map((item, i) => (
              <div key={item.id} className={styles.playtimeDashboard__topItem}>
                <span className={styles.playtimeDashboard__topRank}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.playtimeDashboard__topName}>{item.name}</span>
                <span className={styles.playtimeDashboard__topTime}>{formatPlaytimeShort(item.seconds)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Anomaly Detection ---- */}
      {anomalies.length > 0 && (
        <div className={styles.anomalySection}>
          <div className={styles.anomalySection__header}>
            <SubLabel>ANOMALY DETECTION</SubLabel>
            <span className={styles.anomalySection__count}>
              {String(anomalies.length).padStart(2, '0')}
            </span>
          </div>
          <div className={styles.anomalyList}>
            {anomalies.map((a, i) => (
              <div key={i} className={`${styles.anomalyCard} ${styles[`anomalyCard--${a.severity}`]}`}>
                <div className={styles.anomalyCard__header}>
                  <span className={`${styles.anomalyCard__severity} ${styles[`anomalyCard__severity--${a.severity}`]}`}>
                    {a.severity.toUpperCase()}
                  </span>
                  <span className={styles.anomalyCard__type}>{a.anomaly_type}</span>
                </div>
                <div className={styles.anomalyCard__message}>{a.message}</div>
                <div className={styles.anomalyCard__suggestion}>
                  <span className={styles.anomalyCard__suggestionLabel}>SUGGESTION: </span>
                  {a.suggestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
