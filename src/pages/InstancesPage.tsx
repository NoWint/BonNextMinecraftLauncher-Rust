import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type GameInstance } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { Badge, Modal, TextInput, Button } from '../components/ui';
import styles from './InstancesPage.module.css';

function getLoaderIcon(loader: string | null): string {
  switch (loader) { case 'fabric': return '🧵'; case 'forge': return '⚒'; default: return '📦'; }
}

function getLoaderLabel(loader: string | null): string {
  switch (loader) { case 'fabric': return 'Fabric'; case 'forge': return 'Forge'; default: return 'Vanilla'; }
}

function getLoaderClass(loader: string | null): string {
  return loader === 'fabric' ? 'fabric' : loader === 'forge' ? 'forge' : 'vanilla';
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never played';
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
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return '< 1m';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
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
  const { addToast } = useToast();
  const auth = authState.currentUser;
  const { instances } = state;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [confirmDelete, setConfirmDelete] = useState<GameInstance | null>(null);
  const [error, setError] = useState('');
  const [duplicating, setDuplicating] = useState<GameInstance | null>(null);
  const [dupName, setDupName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; inst: GameInstance } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleLaunch = useCallback(async (inst: GameInstance) => {
    setError('');
    try {
      await api.launchGame(
        inst.version_id, inst.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', inst.max_memory, inst.min_memory,
        inst.java_path || undefined, inst.jvm_args || undefined,
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
          className={styles.hero}
          onClick={() => handleLaunch(heroInstance)}
          onContextMenu={(e) => handleContextMenu(e, heroInstance)}
        >
          <div className={`${styles.hero__bg} ${styles[`hero__bg--${loaderClass}`]}`} />
          <div className={styles.hero__decor} />

          <div className={styles.hero__content}>
            <div className={`${styles.hero__icon} ${styles[`hero__icon--${loaderClass}`]}`}>
              {getLoaderIcon(heroInstance.loader_type)}
            </div>

            <div className={styles.hero__info}>
              <div className={styles.hero__label}>
                {heroInstance.last_played ? 'LAST PLAYED' : 'READY TO PLAY'}
              </div>
              <h1 className={styles.hero__name}>{heroInstance.name}</h1>
              <div className={styles.hero__meta}>
                <span className={styles.hero__metaItem}>
                  <span className={`${styles.hero__metaDot} ${isHeroReady === true ? styles['hero__metaDot--ready'] : isHeroReady === false ? styles['hero__metaDot--download'] : styles['hero__metaDot--unknown']}`} />
                  {isHeroReady === null ? 'Checking...' : isHeroReady ? 'Ready' : 'Needs download'}
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
              <button className={styles.hero__playBtn} title="Play">▶</button>
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
                className={styles.coverCard}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => handleLaunch(inst)}
                onContextMenu={(e) => handleContextMenu(e, inst)}
              >
                <div className={`${styles.coverCard__cover} ${coverClass}`}>
                  <div className={styles.coverCard__coverPattern} />
                  <div className={styles.coverCard__overlay}>
                    <div className={styles.coverCard__playCircle}>▶</div>
                  </div>
                  <div className={`${styles.coverCard__statusDot} ${isReady === true ? styles['coverCard__statusDot--ready'] : isReady === false ? styles['coverCard__statusDot--download'] : styles['coverCard__statusDot--unknown']}`} />
                  {getLoaderIcon(inst.loader_type)}
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

    </div>
  );
}
