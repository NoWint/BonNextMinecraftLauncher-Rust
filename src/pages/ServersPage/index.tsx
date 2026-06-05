import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import type { ServerListEntry, MinecraftServerInfo } from '../../api/servers';
import { formatError } from '../../utils/errorMapping';
import { useToast } from '../../stores/toastStore';
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
    setPingingAll(true);
    for (const server of servers) {
      setPingingIds((prev) => new Set(prev).add(server.id));
      try {
        const result = await api.servers.pingServer(server.address, server.port);
        const info = result?.info ?? null;
        const latency = result?.latency_ms ?? null;
        setServers((prev) =>
          prev.map((s) =>
            s.id === server.id
              ? { ...s, last_ping_result: info, last_ping_at: info ? Date.now() : null, latency_ms: latency }
              : s,
          ),
        );
        api.servers.updateServerPing(server.id, info, latency).catch(() => {});
      } catch {
        setServers((prev) =>
          prev.map((s) =>
            s.id === server.id ? { ...s, last_ping_result: null, last_ping_at: null, latency_ms: null } : s,
          ),
        );
      } finally {
        setPingingIds((prev) => {
          const next = new Set(prev);
          next.delete(server.id);
          return next;
        });
      }
    }
    setPingingAll(false);
    addToast({ type: 'success', title: 'Ping All Complete', message: `Pinged ${servers.length} servers` });
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

  const sortedServers = [...servers].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    return 0;
  });

  const onlineCount = servers.filter((s) => s.last_ping_result !== null).length;

  return (
    <div className={styles.page}>
      <SectionHeader title="SERVERS" subtitle="Browse & ping multiplayer servers" />

      <div className={styles.headerActions}>
        <Button variant="secondary" size="sm" disabled={pingingAll || servers.length === 0} onClick={handlePingAll}>
          {pingingAll ? 'Pinging...' : 'Ping All'}
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add Server'}
        </Button>
      </div>

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

      {loading ? (
        <div className={styles.loadingGrid}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : servers.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.empty__title}>No Servers</div>
          <div className={styles.empty__desc}>Add a server to start browsing multiplayer worlds</div>
          <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
            + Add Server
          </Button>
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
