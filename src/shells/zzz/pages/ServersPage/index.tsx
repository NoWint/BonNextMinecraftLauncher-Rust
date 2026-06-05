import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../shared/api';
import type { ServerListEntry, MinecraftServerInfo, BatchPingResult } from '../../../../shared/api/servers';
import type { GameInstance } from '../../../../shared/api/types';
import { formatError } from '../../../../shared/utils/errorMapping';
import { useToast } from '../../../../shared/stores/toastStore';
import { useInstances } from '../../../../shared/stores/instanceStore';
import { SectionHeader, Ticker } from '../../components/layout';
import { Button, Modal } from '../../components/ui';
import { ServerPingBadge } from '../../components/ui';
import { Icon } from '../../components/ui/Icon';
import { CardSkeleton } from '../../components/ui/Skeleton';
import styles from './ServersPage.module.css';
import TextComponentRenderer from '../../components/ui/TextComponentRenderer';

function extractDescription(info: MinecraftServerInfo): string {
  if (!info) return '';
  if (typeof info.description === 'string') return info.description;
  if (info.description?.text) {
    const extras = info.description.extra?.map((e: { text: string; color?: string }) => e.text).join('') || '';
    return info.description.text + extras;
  }
  return '';
}

type SortMode = 'favorite' | 'name' | 'latency' | 'players';
type FilterStatus = 'all' | 'online' | 'offline';

interface ServerCardProps {
  server: ServerListEntry;
  onPing: (id: number) => void;
  onFavorite: (id: number, fav: boolean) => void;
  onRemove: (id: number) => void;
  pinging: boolean;
}

function ServerCard({ server, onPing, onFavorite, onRemove, pinging }: ServerCardProps) {
  const info = server.last_ping_result;
  const desc = info ? extractDescription(info) : '';
  const online = info?.players?.online ?? null;
  const max = info?.players?.max ?? null;
  const version = info?.version?.name ?? null;

  return (
    <div className={styles.card}>
      <div className={styles.card__icon}>
        {server.icon_base64 ? (
          <img
            src={`data:image/png;base64,${server.icon_base64}`}
            alt=""
            className={styles.card__favicon}
          />
        ) : (
          <Icon name="cube" size={20} />
        )}
      </div>

      <div className={styles.card__body}>
        <div className={styles.card__name}>{server.name}</div>
        <div className={styles.card__address}>
          {server.address}:{server.port}
        </div>
        {info?.description ? (
          <div className={styles.card__desc}>
            <TextComponentRenderer
              component={typeof info.description === 'string'
                ? { text: info.description }
                : info.description as any}
            />
          </div>
        ) : desc ? (
          <div className={styles.card__desc}>{desc}</div>
        ) : null}
        <div className={styles.card__meta}>
          {version && (
            <span className={styles.card__version}>{version}</span>
          )}
          {online !== null && max !== null && (
            <span className={styles.card__players}>
              <Icon name="user" size={10} /> {online}/{max}
            </span>
          )}
        </div>
      </div>

      <div className={styles.card__status}>
        <ServerPingBadge online={!!info} latencyMs={server.latency_ms} />
      </div>

      <div className={styles.card__actions}>
        <button
          className={styles.card__favBtn}
          onClick={() => onFavorite(server.id, !server.is_favorite)}
          title={server.is_favorite ? 'Unfavorite' : 'Favorite'}
        >
          <Icon name={server.is_favorite ? 'heart' : 'star'} size={14} />
        </button>
        <Button variant="secondary" size="sm" disabled={pinging} onClick={() => onPing(server.id)}>
          {pinging ? '...' : 'Ping'}
        </Button>
        <Button variant="danger" size="sm" onClick={() => onRemove(server.id)}>
          <Icon name="trash" size={12} />
        </Button>
      </div>
    </div>
  );
}

export default function ServersPage() {
  const { addToast } = useToast();
  const { state: instanceState } = useInstances();

  const [servers, setServers] = useState<ServerListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingIds, setPingingIds] = useState<Set<number>>(new Set());
  const [pingingAll, setPingingAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPort, setNewPort] = useState('25565');
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [adding, setAdding] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importInstanceId, setImportInstanceId] = useState('');
  const [importing, setImporting] = useState(false);

  // Sort & filter state
  const [sortMode, setSortMode] = useState<SortMode>('favorite');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadServers = useCallback(async () => {
    try {
      const list = await api.servers.listServers();
      setServers(list);
    } catch (e) {
      console.error('Failed to load servers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handlePing = useCallback(async (id: number) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setPingingIds((prev) => new Set(prev).add(id));
    try {
      const result = await api.servers.pingServer(server.address, server.port);
      const info = result?.info ?? null;
      const latency = result?.latency_ms ?? null;
      setServers((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, last_ping_result: info, last_ping_at: info ? Date.now() : null, latency_ms: latency }
            : s,
        ),
      );
      api.servers.updateServerPing(id, info, latency).catch(() => {});
    } catch (e) {
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, last_ping_result: null, last_ping_at: null, latency_ms: null } : s)),
      );
      addToast({ type: 'error', title: 'Ping Failed', message: formatError(e) });
    } finally {
      setPingingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [servers, addToast]);

  const handlePingAll = useCallback(async () => {
    if (servers.length === 0) return;
    setPingingAll(true);
    const ids = servers.map((s) => s.id);
    setPingingIds(new Set(ids));
    try {
      const results = await api.servers.batchPingServers(ids);
      const resultMap = new Map<number, BatchPingResult>();
      for (const r of results) {
        resultMap.set(r.id, r);
      }
      setServers((prev) =>
        prev.map((s) => {
          const r = resultMap.get(s.id);
          if (!r) return s;
          return {
            ...s,
            last_ping_result: r.info,
            last_ping_at: r.online ? Date.now() : null,
            latency_ms: r.latency_ms,
          };
        }),
      );
      // Persist results to DB
      for (const r of results) {
        api.servers.updateServerPing(r.id, r.info, r.latency_ms).catch(() => {});
      }
      addToast({ type: 'success', title: 'Ping All Complete', message: `Pinged ${results.length} servers` });
    } catch (e) {
      addToast({ type: 'error', title: 'Ping All Failed', message: formatError(e) });
    } finally {
      setPingingIds(new Set());
      setPingingAll(false);
    }
  }, [servers, addToast]);

  const handleFavorite = useCallback(async (id: number, favorite: boolean) => {
    try {
      await api.servers.toggleServerFavorite(id, favorite);
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: favorite } : s)));
    } catch (e) {
      addToast({ type: 'error', title: 'Favorite Failed', message: formatError(e) });
    }
  }, [addToast]);

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return;
    try {
      await api.servers.removeServer(removeTarget.id);
      setServers((prev) => prev.filter((s) => s.id !== removeTarget.id));
      addToast({ type: 'success', title: 'Server Removed', message: removeTarget.name });
      setRemoveTarget(null);
    } catch (e) {
      addToast({ type: 'error', title: 'Remove Failed', message: formatError(e) });
    }
  }, [removeTarget, addToast]);

  const handleAddServer = useCallback(async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    const port = parseInt(newPort, 10) || 25565;
    setAdding(true);
    try {
      await api.servers.addServer(newName.trim(), newAddress.trim(), port);
      addToast({ type: 'success', title: 'Server Added', message: newName.trim() });
      setNewName('');
      setNewAddress('');
      setNewPort('25565');
      setShowAddForm(false);
      loadServers();
    } catch (e) {
      addToast({ type: 'error', title: 'Add Server Failed', message: formatError(e) });
    } finally {
      setAdding(false);
    }
  }, [newName, newAddress, newPort, addToast, loadServers]);

  const handleImport = useCallback(async () => {
    if (!importInstanceId) return;
    setImporting(true);
    try {
      const datServers = await api.servers.readServersDat(importInstanceId);
      if (datServers.length === 0) {
        addToast({ type: 'info', title: 'No Servers Found', message: 'This instance has no servers.dat entries' });
        setImporting(false);
        return;
      }
      const existingKeys = new Set(servers.map((s) => `${s.address}:${s.port}`));
      let imported = 0;
      for (const srv of datServers) {
        const key = `${srv.address}:${srv.port}`;
        if (!existingKeys.has(key)) {
          await api.servers.addServer(srv.name || srv.address, srv.address, srv.port);
          existingKeys.add(key);
          imported++;
        }
      }
      addToast({ type: 'success', title: 'Import Complete', message: `Imported ${imported} server${imported !== 1 ? 's' : ''} (${datServers.length - imported} duplicate${datServers.length - imported !== 1 ? 's' : ''} skipped)` });
      setShowImport(false);
      setImportInstanceId('');
      loadServers();
    } catch (e) {
      addToast({ type: 'error', title: 'Import Failed', message: formatError(e) });
    } finally {
      setImporting(false);
    }
  }, [importInstanceId, servers, addToast, loadServers]);

  // Filtering & sorting
  const filteredServers = servers.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.address.toLowerCase().includes(q)) return false;
    }
    if (filterStatus === 'online' && !s.last_ping_result) return false;
    if (filterStatus === 'offline' && s.last_ping_result) return false;
    return true;
  });

  const sortedServers = [...filteredServers].sort((a, b) => {
    switch (sortMode) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'latency': {
        const la = a.latency_ms ?? Infinity;
        const lb = b.latency_ms ?? Infinity;
        return la - lb;
      }
      case 'players': {
        const pa = a.last_ping_result?.players?.online ?? -1;
        const pb = b.last_ping_result?.players?.online ?? -1;
        return pb - pa;
      }
      case 'favorite':
      default:
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
        return 0;
    }
  });

  const onlineCount = servers.filter((s) => s.last_ping_result !== null).length;

  const instanceOptions = instanceState.instances.map((inst: GameInstance) => ({
    value: inst.id,
    label: `${inst.name} (${inst.version_id})`,
  }));

  return (
    <div className={styles.page}>
      <SectionHeader title="SERVERS" subtitle="Browse & ping multiplayer servers" />

      <div className={styles.headerActions}>
        <Button variant="secondary" size="sm" disabled={pingingAll || servers.length === 0} onClick={handlePingAll}>
          {pingingAll ? 'Pinging...' : 'Ping All'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowImport(!showImport)}>
          {showImport ? 'Cancel' : 'Import from Instance'}
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Server'}
        </Button>
      </div>

      {showImport && (
        <div className={styles.addForm}>
          <div className={styles.addForm__row}>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>INSTANCE</label>
              <select
                className={styles.addForm__select}
                value={importInstanceId}
                onChange={(e) => setImportInstanceId(e.target.value)}
              >
                <option value="">Select an instance...</option>
                {instanceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" size="sm" disabled={importing || !importInstanceId} onClick={handleImport}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className={styles.addForm}>
          <div className={styles.addForm__row}>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>NAME</label>
              <input
                className={styles.addForm__input}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Server"
                onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
              />
            </div>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>ADDRESS</label>
              <input
                className={styles.addForm__input}
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="play.example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
              />
            </div>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>PORT</label>
              <input
                className={styles.addForm__input}
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
                placeholder="25565"
                onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
              />
            </div>
            <Button variant="primary" size="sm" disabled={adding || !newName.trim() || !newAddress.trim()} onClick={handleAddServer}>
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.controls__search}>
          <input
            className={styles.controls__searchInput}
            type="text"
            placeholder="Search servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.controls__filters}>
          <div className={styles.controls__filterGroup}>
            <span className={styles.controls__label}>Status:</span>
            {(['all', 'online', 'offline'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                className={`${styles.controls__filterBtn} ${filterStatus === f ? styles['controls__filterBtn--active'] : ''}`}
                onClick={() => setFilterStatus(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className={styles.controls__filterGroup}>
            <span className={styles.controls__label}>Sort:</span>
            {([
              ['favorite', 'Favorite'],
              ['name', 'Name'],
              ['latency', 'Latency'],
              ['players', 'Players'],
            ] as [SortMode, string][]).map(([key, label]) => (
              <button
                key={key}
                className={`${styles.controls__filterBtn} ${sortMode === key ? styles['controls__filterBtn--active'] : ''}`}
                onClick={() => setSortMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingGrid}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : servers.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.empty__title}>No Servers</div>
          <div className={styles.empty__desc}>Add a server or import from an instance to start browsing multiplayer worlds</div>
          <div className={styles.empty__actions}>
            <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
              + Add Server
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              Import from Instance
            </Button>
          </div>
        </div>
      ) : sortedServers.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.empty__title}>No Matches</div>
          <div className={styles.empty__desc}>No servers match your current filters</div>
        </div>
      ) : (
        <div className={styles.list}>
          {sortedServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onPing={handlePing}
              onFavorite={handleFavorite}
              onRemove={(id) => {
                const s = servers.find((sv) => sv.id === id);
                setRemoveTarget(s ? { id: s.id, name: s.name } : null);
              }}
              pinging={pingingIds.has(server.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove Server"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemove}>
              Remove
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>
          Remove "{removeTarget?.name}" from your server list?
        </p>
      </Modal>

      <Ticker
        messages={[
          `${servers.length} server${servers.length !== 1 ? 's' : ''} tracked`,
          `${onlineCount} online`,
          pingingAll ? 'Pinging all servers...' : 'Ready',
        ]}
      />
    </div>
  );
}
