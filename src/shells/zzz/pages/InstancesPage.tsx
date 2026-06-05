import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type GameInstance, type ServerStatus, type PlaytimeStats, type RepairResult } from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useToast } from '../../../shared/stores/toastStore';
import { useI18n } from '../../../shared/i18n';
import { Badge, Modal, TextInput, Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { MigrationModal } from '../components/ui/MigrationModal';
import { SubLabel } from '../components/layout';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { formatError } from '../../../shared/utils/errorMapping';
import styles from './InstancesPage.module.css';

function getLoaderClass(loader: string | null): string {
  if (loader === 'fabric') return 'fabric';
  if (loader === 'forge') return 'forge';
  if (loader === 'quilt') return 'quilt';
  if (loader === 'neoforge') return 'neoforge';
  return 'vanilla';
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

export default function InstancesPage() {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { state, deleteInstance, reloadInstances } = useInstances();
  const { t } = useI18n();
  const { addToast } = useToast();
  const auth = authState.currentUser;

  const getLoaderLabel = (loader: string | null): string => {
    switch (loader) {
      case 'fabric':
        return t('common.fabric');
      case 'forge':
        return t('common.forge');
      default:
        return t('common.vanilla');
    }
  };

  const relativeTime = (dateStr: string | null): string => {
    if (!dateStr) return t('common.neverPlayed');
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('instances.justNow');
    if (mins < 60) return t('instances.minAgo', { mins: String(mins) });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('instances.hrAgo', { hrs: String(hrs) });
    const days = Math.floor(hrs / 24);
    if (days < 7) return t('instances.dayAgo', { days: String(days) });
    return d.toLocaleDateString();
  };

  const SORT_OPTIONS: { key: SortKey; label: string }[] = useMemo(
    () => [
      { key: 'recent', label: t('instances.sortRecent') },
      { key: 'name', label: t('instances.sortName') },
      { key: 'playtime', label: t('instances.sortPlaytime') },
      { key: 'version', label: t('instances.sortVersion') },
    ],
    [t],
  );

  const { instances } = state;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [confirmDelete, setConfirmDelete] = useState<GameInstance | null>(null);
  const [exportingInstance, setExportingInstance] = useState<GameInstance | null>(null);
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [duplicating, setDuplicating] = useState<GameInstance | null>(null);
  const [dupName, setDupName] = useState('');
  const [importing, setImporting] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; inst: GameInstance } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [servers, setServers] = useState<Array<{ name: string; address: string }>>(() => {
    try {
      const saved = localStorage.getItem('bonnext_servers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newAddress, setNewAddress] = useState('');
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus | null>>({});
  const [editingServerName, setEditingServerName] = useState<Record<string, string>>({});
  const [playtimeStats, setPlaytimeStats] = useState<PlaytimeStats | null>(null);
  const [anomalies, setAnomalies] = useState<
    Array<{ anomaly_type: string; severity: string; message: string; suggestion: string }>
  >([]);
  const [mpInstalled, setMpInstalled] = useState(false);
  const [mpRunning, setMpRunning] = useState(false);
  const [mpState, setMpState] = useState<string>('idle');
  const [mpRoomCode, setMpRoomCode] = useState('');
  const [mpJoinCode, setMpJoinCode] = useState('');
  const [mpLoading, setMpLoading] = useState(false);

  const [lanWorlds, setLanWorlds] = useState<
    Array<{ host: string; port: number; motd: string; world_type: string | null }>
  >([]);
  const [lanDiscovering, setLanDiscovering] = useState(false);

  const [gameDir, setGameDir] = useState<string>('');
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});
  const [repairingIds, setRepairingIds] = useState<Set<string>>(new Set());
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);

  useEffect(() => {
    api
      .getGameDir()
      .then(setGameDir)
      .catch(() => {});
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
      const results = await Promise.allSettled(instances.map((inst) => api.checkInstanceReady(inst.id)));
      const states: Record<string, boolean | null> = {};
      results.forEach((result, i) => {
        states[instances[i].id] = result.status === 'fulfilled' ? result.value : null;
      });
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
    try {
      localStorage.setItem('bonnext_servers', JSON.stringify(servers));
    } catch {
      /* localStorage unavailable */
    }
  }, [servers]);

  useEffect(() => {
    api
      .getPlaytimeStats()
      .then(setPlaytimeStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pollAll = async () => {
      const results = await Promise.allSettled(servers.map((s) => api.pingServer(s.address)));
      const statuses: Record<string, ServerStatus | null> = {};
      results.forEach((result, i) => {
        statuses[servers[i].address] = result.status === 'fulfilled' ? result.value : null;
      });
      setServerStatuses(statuses);
    };
    pollAll();
    const timer = setInterval(pollAll, 30000);
    return () => clearInterval(timer);
  }, [servers]);

  useEffect(() => {
    if (instances.length > 0) {
      Promise.allSettled(instances.map((inst) => api.detectAnomalies(inst.id)))
        .then((results) => {
          const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
          setAnomalies(all);
        })
        .catch(() => setAnomalies([]));
    } else {
      setAnomalies([]);
    }
  }, [instances]);

  useEffect(() => {
    api
      .isTerracottaInstalled()
      .then(setMpInstalled)
      .catch(() => setMpInstalled(false));
    api
      .getTerracottaState()
      .then((s) => {
        setMpRunning(true);
        setMpState(s.state);
        setMpRoomCode(String(s.invitation_code || s.room_code || ''));
      })
      .catch(() => {
        setMpRunning(false);
      });
  }, []);

  const handleAddServer = () => {
    const trimmed = newAddress.trim();
    if (!trimmed) return;
    if (servers.some((s) => s.address === trimmed)) return;
    const name = trimmed.split(':')[0];
    setServers((prev) => [...prev, { name, address: trimmed }]);
    setNewAddress('');
  };

  const handleRemoveServer = (address: string) => {
    setServers((prev) => prev.filter((s) => s.address !== address));
    setServerStatuses((prev) => {
      const next = { ...prev };
      delete next[address];
      return next;
    });
  };

  const handleServerNameSave = (address: string) => {
    const newName = editingServerName[address];
    if (newName && newName.trim()) {
      setServers((prev) => prev.map((s) => (s.address === address ? { ...s, name: newName.trim() } : s)));
    }
    setEditingServerName((prev) => {
      const next = { ...prev };
      delete next[address];
      return next;
    });
  };

  const handleLaunch = useCallback(
    async (inst: GameInstance) => {
      setError('');
      try {
        await api.launchGame(
          inst.version_id,
          inst.version_url,
          auth?.username || 'Player',
          auth?.uuid || '',
          auth?.access_token || '',
          inst.max_memory,
          inst.min_memory,
          inst.java_path || undefined,
          inst.jvm_args || undefined,
          inst.id,
        );
        addToast({
          type: 'success',
          title: t('instances.launching'),
          message: t('instances.isStarting', { name: inst.name }),
        });
      } catch (e: unknown) {
        setError(formatError(e) || t('instances.launchFailed'));
        addToast({ type: 'error', title: t('instances.launchFailed'), message: formatError(e) || '' });
      }
    },
    [auth, addToast, t],
  );

  const handleRepair = useCallback(
    async (inst: GameInstance) => {
      setRepairingIds((prev) => new Set(prev).add(inst.id));
      try {
        addToast({ type: 'info', title: t('instances.repairing'), message: t('instances.repairingMsg', { name: inst.name }) });
        const result = await api.repairInstance(inst.id);
        setRepairResult(result);
        if (result.fixed) {
          addToast({ type: 'success', title: t('instances.repairSuccess'), message: t('instances.repairSuccessMsg', { name: inst.name }) });
          const ready = await api.checkInstanceReady(inst.id);
          setReadyStates((prev) => ({ ...prev, [inst.id]: ready }));
        } else {
          addToast({ type: 'warning', title: t('instances.repairPartial'), message: t('instances.repairPartialMsg', { name: inst.name }) });
        }
      } catch (e: unknown) {
        addToast({ type: 'error', title: t('instances.repairFailed'), message: formatError(e) || '' });
      } finally {
        setRepairingIds((prev) => {
          const next = new Set(prev);
          next.delete(inst.id);
          return next;
        });
      }
    },
    [addToast, t],
  );

  const handleDuplicate = useCallback(async () => {
    if (!duplicating || !dupName.trim()) return;
    try {
      await api.duplicateInstance(duplicating.id, dupName.trim());
      addToast({
        type: 'success',
        title: t('instances.duplicated'),
        message: t('instances.created', { name: dupName }),
      });
      await reloadInstances();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instances.failed'), message: formatError(e) || '' });
    } finally {
      setDuplicating(null);
      setDupName('');
    }
  }, [duplicating, dupName, reloadInstances, addToast, t]);

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }],
      });
      if (!selected || typeof selected !== 'string') return;
      setImporting(true);
      addToast({ type: 'info', title: t('instances.importing'), message: t('instances.parsingMods') });
      const inst = await api.importModpackAuto(selected);
      await reloadInstances();
      setImporting(false);
      addToast({
        type: 'success',
        title: t('instances.imported'),
        message: t('instances.importedReady', { name: inst.name }),
      });
      navigate(`/instances/${inst.id}`);
    } catch (e: unknown) {
      setImporting(false);
      addToast({ type: 'error', title: t('instances.importFailed'), message: formatError(e) || '' });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, inst: GameInstance) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, inst });
  };

  const handleMpInstall = async () => {
    setMpLoading(true);
    try {
      await api.downloadTerracotta();
      setMpInstalled(true);
      addToast({ type: 'success', title: t('instanceDetail.mpInstallSuccess'), message: '' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.mpInstallFailed'), message: formatError(e) || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpStart = async () => {
    setMpLoading(true);
    try {
      await api.startTerracotta();
      setMpRunning(true);
      const s = await api.getTerracottaState();
      setMpState(s.state);
      addToast({ type: 'success', title: t('instanceDetail.mpStarted'), message: '' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.mpStartFailed'), message: formatError(e) || '' });
      setMpRunning(false);
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpStop = async () => {
    setMpLoading(true);
    try {
      await api.stopTerracotta();
      setMpRunning(false);
      setMpState('idle');
      setMpRoomCode('');
      addToast({ type: 'success', title: t('instanceDetail.mpStopped'), message: '' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.mpStopFailed'), message: formatError(e) || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpHost = async () => {
    setMpLoading(true);
    try {
      await api.terracottaSetHost();
      const s = await api.getTerracottaState();
      setMpState(s.state);
      setMpRoomCode(String(s.invitation_code || s.room_code || ''));
      addToast({ type: 'success', title: t('instanceDetail.mpHosting'), message: '' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.mpHostFailed'), message: formatError(e) || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpJoin = async () => {
    if (!mpJoinCode.trim()) return;
    setMpLoading(true);
    try {
      await api.terracottaSetGuest(mpJoinCode.trim());
      const s = await api.getTerracottaState();
      setMpState(s.state);
      addToast({ type: 'success', title: t('instanceDetail.mpJoining'), message: '' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.mpJoinFailed'), message: formatError(e) || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpDisconnect = async () => {
    setMpLoading(true);
    try {
      await api.terracottaSetIdle();
      setMpState('idle');
      setMpRoomCode('');
      addToast({ type: 'success', title: t('instanceDetail.mpDisconnected'), message: '' });
    } catch (e: unknown) {
      addToast({ type: 'error', title: '', message: formatError(e) || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      instances
        .filter((inst) => !search || inst.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          switch (sortKey) {
            case 'recent': {
              const aTime = a.last_played ? new Date(a.last_played).getTime() : 0;
              const bTime = b.last_played ? new Date(b.last_played).getTime() : 0;
              return bTime - aTime;
            }
            case 'name':
              return a.name.localeCompare(b.name);
            case 'playtime':
              return b.playtime_seconds - a.playtime_seconds;
            case 'version':
              return b.version_id.localeCompare(a.version_id);
            default:
              return 0;
          }
        }),
    [instances, search, sortKey],
  );

  const heroInstance = filtered.length > 0 ? filtered[0] : null;
  const loaderClass = getLoaderClass(heroInstance?.loader_type ?? null);
  const isHeroReady = heroInstance ? readyStates[heroInstance.id] : null;

  return (
    <div className={styles.page}>
      <div className={styles.page__sticky}>
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
                  {heroInstance.last_played ? t('instances.lastPlayed') : t('instances.readyToPlay')}
                </div>
                <h1 className={styles.hero__name}>{heroInstance.name}</h1>
                <div className={styles.hero__meta}>
                  <span className={styles.hero__metaItem}>
                    <span
                      className={`${styles.hero__metaDot} ${isHeroReady === true ? styles['hero__metaDot--ready'] : isHeroReady === false ? styles['hero__metaDot--download'] : styles['hero__metaDot--unknown']}`}
                    />
                    {isHeroReady === null
                      ? t('common.checking')
                      : isHeroReady
                        ? t('common.ready')
                        : t('common.needsDownload')}
                  </span>
                  <span className={styles.hero__metaItem}>
                    <Badge variant="accent">{heroInstance.version_id}</Badge>
                  </span>
                  {heroInstance.loader_type && (
                    <span className={styles.hero__metaItem}>
                      <Badge variant="muted">
                        {getLoaderLabel(heroInstance.loader_type)}
                        {heroInstance.loader_version ? ` ${heroInstance.loader_version}` : ''}
                      </Badge>
                    </span>
                  )}
                  <span className={styles.hero__metaItem}>{Math.round(heroInstance.max_memory / 1024)}GB</span>
                  <span className={styles.hero__metaItem}>{formatPlaytime(heroInstance.playtime_seconds)}</span>
                </div>
              </div>

              <div className={styles.hero__actions}>
                <button
                  className={`${styles.hero__playBtn} play-pulse`}
                  title={t('instances.play')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLaunch(heroInstance);
                  }}
                >
                  <Icon name="play" size={14} />
                </button>
                <button
                  className={styles.hero__contextBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/instances/${heroInstance.id}`);
                  }}
                >
                  <><Icon name="settings" size={14} /> {t('instances.details')}</>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- Header bar ---- */}
        <div className={styles.headerBar}>
          <div className={styles.headerBar__left}>
            <span className={styles.headerBar__title}>{t('instances.allInstances')}</span>
            <span className={styles.headerBar__count}>{t('instances.total', { count: String(instances.length) })}</span>
          </div>
          <div className={styles.headerBar__right}>
            <TextInput placeholder={t('instances.filter')} value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="secondary" size="sm" onClick={handleImport} disabled={importing}>
              {importing ? t('instances.importingBtn') : <><Icon name="download" size={14} /> {t('instances.importBtn')}</>}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowMigration(true)}>
              <><Icon name="arrowCurveLeft" size={14} /> {t('migration.btn')}</>
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/instances/new')}>
              {'+ ' + t('instances.newBtn')}
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
      </div>

      {/* ---- Scrollable content area ---- */}
      <div className={styles.page__scrollArea}>
        {instances.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyState__icon}><Icon name="cube" size={16} /></div>
            <div className={styles.emptyState__title}>{t('instances.noInstancesTitle')}</div>
            <div className={styles.emptyState__desc}>{t('instances.noInstancesDesc')}</div>
            <Button variant="primary" size="md" onClick={() => navigate('/instances/new')}>
              {'+ ' + t('instances.createInstance')}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.noMatch}>{t('instances.noMatch')}</div>
        ) : (
          <div className={styles.instanceList}>
            {filtered.map((inst) => {
              const ldrClass = getLoaderClass(inst.loader_type);
              const isReady = readyStates[inst.id] ?? null;

              return (
                <div
                  key={inst.id}
                  className={`${styles.instanceRow} card-glow-hover`}
                  onClick={() => { navigate(`/instances/${inst.id}`); }}
                  onContextMenu={(e) => handleContextMenu(e, inst)}
                >
                  <div className={`${styles.instanceRow__icon} ${styles[`instanceRow__icon--${ldrClass}`]}`}>
                    {iconUrls[inst.id] && !failedIcons.has(inst.id) ? (
                      <img
                        src={iconUrls[inst.id]}
                        alt={inst.name}
                        className={styles.instanceRow__iconImg}
                        onError={() => {
                          setFailedIcons((prev) => new Set(prev).add(inst.id));
                        }}
                      />
                    ) : (
                      <span className={styles.instanceRow__iconChar}>{inst.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className={styles.instanceRow__info}>
                    <div className={styles.instanceRow__nameRow}>
                      <span className={styles.instanceRow__name}>{inst.name}</span>
                      <span className={styles.instanceRow__version}>{inst.version_id}</span>
                      {inst.loader_type && (
                        <span className={styles.instanceRow__loaderBadge}>{getLoaderLabel(inst.loader_type)}</span>
                      )}
                    </div>
                    <div className={styles.instanceRow__meta}>
                      <span className={styles.instanceRow__metaItem}>
                        <span
                          className={`${styles.instanceRow__statusDot} ${isReady === true ? styles['instanceRow__statusDot--ready'] : isReady === false ? styles['instanceRow__statusDot--download'] : styles['instanceRow__statusDot--unknown']}`}
                        />
                        {isReady === null ? t('common.checking') : isReady ? t('common.ready') : t('common.needsDownload')}
                      </span>
                      <span className={styles.instanceRow__metaItem}>{formatPlaytime(inst.playtime_seconds)}</span>
                      <span className={styles.instanceRow__metaItem}>{relativeTime(inst.last_played)}</span>
                      <span className={styles.instanceRow__metaItem}>{Math.round(inst.max_memory / 1024)}GB</span>
                    </div>
                  </div>

                  <div className={styles.instanceRow__actions}>
                    {isReady === false ? (
                      <button
                        className={`${styles.instanceRow__actionBtn} ${styles['instanceRow__actionBtn--repair']}`}
                        disabled={repairingIds.has(inst.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRepair(inst);
                        }}
                      >
                        {repairingIds.has(inst.id) ? <><Icon name="loader" size={14} /> {t('instances.repairing')}</> : <><Icon name="wrench" size={14} /> {t('instances.repair')}</>}
                      </button>
                    ) : (
                      <button
                        className={`${styles.instanceRow__actionBtn} ${styles['instanceRow__actionBtn--play']}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunch(inst);
                        }}
                      >
                        <><Icon name="play" size={14} /> {t('instances.play')}</>
                      </button>
                    )}
                    <button
                      className={`${styles.instanceRow__actionBtn} ${styles['instanceRow__actionBtn--manage']}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/instances/${inst.id}`);
                      }}
                    >
                      <><Icon name="settings" size={14} /> {t('instances.manage')}</>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {instances.length > 0 && filtered.length > 0 && (
          <>
            <div className={styles.toolDivider} />
            <div className={styles.toolSections}>
              {/* ---- Server Monitor ---- */}
        <div className={styles.serverMonitor}>
          <div className={styles.serverMonitor__header}>
            <SubLabel>{t('instances.serverMonitor')}</SubLabel>
            <span className={styles.serverMonitor__count}>{String(servers.length).padStart(2, '0')}</span>
          </div>

          <div className={styles.serverMonitor__addRow}>
            <input
              className={styles.serverMonitor__input}
              type="text"
              placeholder={t('instances.serverAddPlaceholder')}
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddServer();
              }}
            />
            <Button variant="primary" size="sm" onClick={handleAddServer}>
              {'+ ' + t('instances.serverAddBtn')}
            </Button>
          </div>

          <div className={styles.serverMonitor__list}>
            {servers.length === 0 ? (
              <div className={styles.serverMonitor__empty}>{t('instances.serverEmpty')}</div>
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
                          isOnline === null
                            ? styles['serverCard__dot--unknown']
                            : isOnline
                              ? styles['serverCard__dot--online']
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
                            setEditingServerName((prev) => ({
                              ...prev,
                              [server.address]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleServerNameSave(server.address);
                            if (e.key === 'Escape') {
                              setEditingServerName((prev) => {
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
                            setEditingServerName((prev) => ({
                              ...prev,
                              [server.address]: server.name,
                            }))
                          }
                          title={t('instances.doubleClickRename')}
                        >
                          {server.name}
                        </span>
                      )}
                      <span className={styles.serverCard__address}>{server.address}</span>
                      <div className={styles.serverCard__meta}>
                        <span className={styles.serverCard__statusLabel}>
                          {isOnline === null
                            ? t('instances.serverPinging')
                            : isOnline
                              ? t('instances.serverOnline')
                              : t('instances.serverOffline')}
                        </span>
                        {isOnline && status && (
                          <>
                            <span className={styles.serverCard__metaSep}>·</span>
                            <span className={styles.serverCard__players}>
                              {status.players_online}/{status.players_max}
                            </span>
                            <span className={styles.serverCard__metaSep}>·</span>
                            <span className={styles.serverCard__latency}>{status.latency_ms}ms</span>
                            {status.version && (
                              <>
                                <span className={styles.serverCard__metaSep}>·</span>
                                <span className={styles.serverCard__version}>{status.version}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      className={styles.serverCard__remove}
                      onClick={() => handleRemoveServer(server.address)}
                      title={t('instances.removeServer')}
                    >
                      <Icon name="cross" size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ---- LAN Discovery ---- */}
        <div className={styles.serverMonitor} style={{ marginTop: 8 }}>
          <div className={styles.serverMonitor__header}>
            <SubLabel>{t('instances.lanDiscovery') || 'LAN Worlds'}</SubLabel>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setLanDiscovering(true);
              try {
                await api.startLanDiscovery();
                const worlds = await api.getLanWorlds();
                setLanWorlds(worlds);
              } catch {
                /* empty */
              }
              setLanDiscovering(false);
            }}
            disabled={lanDiscovering}
          >
            {lanDiscovering ? 'Scanning...' : 'Scan for LAN Worlds'}
          </Button>
          {lanWorlds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {lanWorlds.map((w, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'var(--color-panel-alt)',
                    fontSize: '0.55em',
                  }}
                >
                  <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>ON</span>
                  <span style={{ color: 'var(--color-text)' }}>{w.motd || `${w.host}:${w.port}`}</span>
                  <span style={{ color: 'var(--color-text-dim)', marginLeft: 'auto' }}>{w.world_type || 'unknown'}</span>
                </div>
              ))}
            </div>
          )}
          {!lanDiscovering && lanWorlds.length === 0 && (
            <div style={{ fontSize: '0.5em', color: 'var(--color-text-dim)', marginTop: 4 }}>No LAN worlds found</div>
          )}
        </div>

        {/* ---- Terracotta Multiplayer ---- */}
        <div className={styles.mpSection}>
          <div className={styles.mpSection__header}>
            <SubLabel>{t('instanceDetail.mpTitle')}</SubLabel>
          </div>

          {!mpInstalled ? (
            <div className={styles.mpCard}>
              <div style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                {t('instanceDetail.mpNotInstalled')}
              </div>
              <Button variant="primary" size="md" onClick={handleMpInstall} disabled={mpLoading}>
                {mpLoading ? t('instanceDetail.mpInstalling') : t('instanceDetail.mpInstall')}
              </Button>
            </div>
          ) : !mpRunning ? (
            <div className={styles.mpCard}>
              <div style={{ fontSize: '0.5em', color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
                {t('instanceDetail.mpReady')}
              </div>
              <Button variant="primary" size="md" onClick={handleMpStart} disabled={mpLoading}>
                {mpLoading ? '...' : t('instanceDetail.mpStart')}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                className={styles.mpCard}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div>
                  <span style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
                    {t('instanceDetail.mpStatus')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.5em',
                      color: mpState === 'idle' ? 'var(--color-text-tertiary)' : 'var(--color-accent)',
                      marginLeft: 8,
                      fontWeight: 600,
                    }}
                  >
                    {mpState === 'idle'
                      ? t('instanceDetail.mpIdle')
                      : mpState === 'hosting'
                        ? t('instanceDetail.mpHostingStatus')
                        : mpState === 'guesting'
                          ? t('instanceDetail.mpGuestingStatus')
                          : mpState === 'scanning'
                            ? t('instanceDetail.mpScanningStatus')
                            : mpState}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={handleMpStop} disabled={mpLoading}>
                  {t('instanceDetail.mpStop')}
                </Button>
              </div>

              {mpState === 'idle' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className={styles.mpCard} style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.7em',
                        color: 'var(--color-accent)',
                        letterSpacing: 2,
                        marginBottom: 6,
                      }}
                    >
                      {t('instanceDetail.mpHostMode')}
                    </div>
                    <div
                      style={{
                        fontSize: '0.45em',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      {t('instanceDetail.mpHostDesc')}
                    </div>
                    <Button variant="primary" size="sm" onClick={handleMpHost} disabled={mpLoading}>
                      {t('instanceDetail.mpCreateRoom')}
                    </Button>
                  </div>
                  <div className={styles.mpCard} style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.7em',
                        color: 'var(--color-accent)',
                        letterSpacing: 2,
                        marginBottom: 6,
                      }}
                    >
                      {t('instanceDetail.mpGuestMode')}
                    </div>
                    <div
                      style={{
                        fontSize: '0.45em',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      {t('instanceDetail.mpGuestDesc')}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={mpJoinCode}
                        onChange={(e) => setMpJoinCode(e.target.value)}
                        placeholder={t('instanceDetail.mpEnterCode')}
                        style={{
                          flex: 1,
                          background: '#0D0D0D',
                          border: '1px solid #2A2A2A',
                          color: '#FFF',
                          fontSize: '0.5em',
                          padding: '5px 8px',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleMpJoin()}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleMpJoin}
                        disabled={mpLoading || !mpJoinCode.trim()}
                      >
                        {t('instanceDetail.mpJoin')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {mpState === 'hosting' && mpRoomCode && (
                <div className={styles.mpCard} style={{ borderColor: 'var(--color-accent-15)' }}>
                  <div
                    style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', letterSpacing: 1, marginBottom: 4 }}
                  >
                    {t('instanceDetail.mpInvitationCode')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7em',
                        color: 'var(--color-accent)',
                        letterSpacing: 2,
                        wordBreak: 'break-all',
                      }}
                    >
                      {mpRoomCode}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(mpRoomCode);
                        addToast({ type: 'success', title: t('instanceDetail.mpCopied'), message: '' });
                      }}
                    >
                      {t('instanceDetail.mpCopy')}
                    </Button>
                  </div>
                  <div style={{ fontSize: '0.4em', color: 'var(--color-text-faint)', marginTop: 6, lineHeight: 1.5 }}>
                    {t('instanceDetail.mpHostHint')}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Button variant="secondary" size="sm" onClick={handleMpDisconnect}>
                      {t('instanceDetail.mpDisconnect')}
                    </Button>
                  </div>
                </div>
              )}

              {mpState === 'guesting' && (
                <div className={styles.mpCard} style={{ borderColor: 'var(--color-accent-15)' }}>
                  <div style={{ fontSize: '0.5em', color: 'var(--color-success)', marginBottom: 6 }}>
                    {t('instanceDetail.mpConnected')}
                  </div>
                  <div style={{ fontSize: '0.4em', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                    {t('instanceDetail.mpGuestHint')}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Button variant="secondary" size="sm" onClick={handleMpDisconnect}>
                      {t('instanceDetail.mpDisconnect')}
                    </Button>
                  </div>
                </div>
              )}

              {mpState === 'scanning' && (
                <div className={styles.mpCard} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.5em', color: 'var(--color-accent)' }}>{t('instanceDetail.mpScanning')}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Playtime Dashboard ---- */}
        <div className={styles.playtimeDashboard}>
          <div className={styles.playtimeDashboard__header}>
            <SubLabel>{t('instances.playtimeTitle')}</SubLabel>
          </div>
          <div className={styles.playtimeDashboard__grid}>
            <div className={styles.playtimeDashboard__stat}>
              <div className={styles.playtimeDashboard__statValue}>
                {(instances.reduce((s, i) => s + (i.playtime_seconds || 0), 0) / 3600).toFixed(1)}
                <span className={styles.playtimeDashboard__statUnit}>h</span>
              </div>
              <div className={styles.playtimeDashboard__statLabel}>{t('instances.playtimeTotal')}</div>
            </div>
            <div className={styles.playtimeDashboard__stat}>
              <div className={styles.playtimeDashboard__statValue}>
                {playtimeStats
                  ? formatTodayPlaytime(playtimeStats.daily[new Date().toISOString().slice(0, 10)] || 0)
                  : '—'}
              </div>
              <div className={styles.playtimeDashboard__statLabel}>{t('instances.playtimeToday')}</div>
            </div>
          </div>
          {playtimeStats && playtimeStats.top_instances.length > 0 && (
            <div className={styles.playtimeDashboard__topList}>
              <div className={styles.playtimeDashboard__topLabel}>{t('instances.playtimeTop')}</div>
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
              <SubLabel>{t('instances.anomalyTitle')}</SubLabel>
              <span className={styles.anomalySection__count}>{String(anomalies.length).padStart(2, '0')}</span>
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
                    <span className={styles.anomalyCard__suggestionLabel}>{t('instances.anomalySuggestion')}</span>
                    {a.suggestion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
            </div>
          </>
        )}
      </div>

      {/* ---- Context menu ---- */}
      {contextMenu && (
        <div ref={menuRef} className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            className={styles.contextMenu__item}
            onClick={() => {
              handleLaunch(contextMenu.inst);
              setContextMenu(null);
            }}
          >
            <><Icon name="play" size={14} /> {t('instances.contextPlay')}</>
          </button>
          <button
            className={styles.contextMenu__item}
            onClick={() => {
              navigate(`/instances/${contextMenu.inst.id}`);
              setContextMenu(null);
            }}
          >
            <><Icon name="settings" size={14} /> {t('instances.contextDetails')}</>
          </button>
          {readyStates[contextMenu.inst.id] === false && (
            <button
              className={styles.contextMenu__item}
              disabled={repairingIds.has(contextMenu.inst.id)}
              onClick={() => {
                handleRepair(contextMenu.inst);
                setContextMenu(null);
              }}
            >
              <><Icon name="wrench" size={14} /> {t('instances.contextRepair')}</>
            </button>
          )}
          <div className={styles.contextMenu__separator} />
          <button
            className={styles.contextMenu__item}
            onClick={() => {
              setDuplicating(contextMenu.inst);
              setDupName(`${contextMenu.inst.name} (Copy)`);
              setContextMenu(null);
            }}
          >
            <><Icon name="copy" size={14} /> {t('instances.contextDuplicate')}</>
          </button>
          <button
            className={styles.contextMenu__item}
            onClick={() => {
              setExportingInstance(contextMenu.inst);
              setContextMenu(null);
            }}
          >
            <><Icon name="upload" size={14} /> {t('instances.contextExport')}</>
          </button>
          <div className={styles.contextMenu__separator} />
          <button
            className={`${styles.contextMenu__item} ${styles['contextMenu__item--danger']}`}
            onClick={() => {
              setConfirmDelete(contextMenu.inst);
              setContextMenu(null);
            }}
          >
            <><Icon name="trash" size={14} /> {t('instances.contextDelete')}</>
          </button>
        </div>
      )}

      {/* ---- Repair result modal ---- */}
      <Modal
        open={repairResult !== null}
        onClose={() => setRepairResult(null)}
        title={t('instances.repairResult')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setRepairResult(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {repairResult && (
          <div className={styles.repairResult}>
            {repairResult.actions.length === 0 ? (
              <p>{t('instances.repairNoActions')}</p>
            ) : (
              repairResult.actions.map((action, i) => (
                <div key={i} className={`${styles.repairAction} ${action.success ? styles['repairAction--success'] : styles['repairAction--fail']}`}>
                  <div className={styles.repairAction__header}>
                    <span className={styles.repairAction__status}>{action.success ? '✓' : '✗'}</span>
                    <span className={styles.repairAction__desc}>{action.description}</span>
                  </div>
                  <div className={styles.repairAction__message}>{action.message}</div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* ---- Delete modal ---- */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t('instances.deleteInstance')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (confirmDelete) {
                  try {
                    await deleteInstance(confirmDelete.id);
                    addToast({
                      type: 'success',
                      title: t('instances.deleted'),
                      message: `"${confirmDelete.name}" removed`,
                    });
                  } catch (e) {
                    addToast({
                      type: 'error',
                      title: t('instances.deleteFailed') || 'Delete failed',
                      message: formatError(e),
                    });
                  }
                }
                setConfirmDelete(null);
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {t('instances.deleteConfirm', { name: confirmDelete?.name || '' })}
      </Modal>

      {exportingInstance && (
        <Modal
          open={!!exportingInstance}
          onClose={() => setExportingInstance(null)}
          title={t('instances.exportAsMrpack') || 'Export'}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setExportingInstance(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  try {
                    const { save } = await import('@tauri-apps/plugin-dialog');
                    const path = await save({
                      defaultPath: `${exportingInstance.name}.mrpack`,
                      filters: [{ name: 'Mrpack', extensions: ['mrpack'] }],
                    });
                    if (path && typeof path === 'string') {
                      await api.exportMrpack(exportingInstance.id, path);
                      addToast({ type: 'success', title: t('instances.exportAsMrpack') || 'Exported' });
                    }
                  } catch (e) {
                    addToast({ type: 'error', title: formatError(e) });
                    return;
                  }
                  setExportingInstance(null);
                }}
              >
                {t('common.save')}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: '0.7em', color: 'var(--color-text-muted)' }}>{exportingInstance.name}</p>
        </Modal>
      )}

      {/* ---- Duplicate modal ---- */}
      <Modal
        open={duplicating !== null}
        onClose={() => {
          setDuplicating(null);
          setDupName('');
        }}
        title={t('instances.duplicateInstance')}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDuplicating(null);
                setDupName('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleDuplicate} disabled={!dupName.trim()}>
              {t('instances.duplicateBtn')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>{t('instances.nameLabel')}</label>
          <TextInput
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
            placeholder={t('instances.instanceName')}
            autoFocus
          />
        </div>
      </Modal>

      <MigrationModal open={showMigration} onClose={() => setShowMigration(false)} onMigrated={reloadInstances} />
    </div>
  );
}
