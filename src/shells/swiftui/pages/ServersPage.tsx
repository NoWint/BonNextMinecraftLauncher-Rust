import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../shared/api';
import type { ServerListEntry, BatchPingResult, ServerAddress } from '../../../shared/api/servers';
import { useInstances } from '../../../shared/stores/instanceStore';
import { Button, Badge, Modal, SearchField, FormField, Spinner } from '../components/ui';
import { GlobeIcon, PlusIcon, RefreshIcon, TrashIcon, HeartIcon } from '../components/icons';
import styles from './ServersPage.module.css';

type SortKey = 'favorite' | 'name' | 'latency' | 'players';
type FilterStatus = 'all' | 'online' | 'offline';

export default function ServersPage() {
  const { state: instState } = useInstances();
  const [servers, setServers] = useState<ServerListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('favorite');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [pingResults, setPingResults] = useState<Map<number, BatchPingResult>>(new Map());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPort, setNewPort] = useState('25565');
  const [importInstanceId, setImportInstanceId] = useState(instState.instances[0]?.id || '');
  const [importedServers, setImportedServers] = useState<ServerAddress[]>([]);

  const loadServers = useCallback(async () => {
    setLoading(true);
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

  const handlePingAll = async () => {
    if (servers.length === 0) return;
    setPinging(true);
    try {
      const ids = servers.map((s) => s.id);
      const results = await api.servers.batchPingServers(ids);
      const map = new Map<number, BatchPingResult>();
      for (const r of results) {
        map.set(r.id, r);
      }
      setPingResults(map);
    } catch (e) {
      console.error('Batch ping failed:', e);
    } finally {
      setPinging(false);
    }
  };

  const handlePingOne = async (address: string, port: number, id: number) => {
    try {
      const result = await api.servers.pingServer(address, port);
      if (result) {
        await api.servers.updateServerPing(id, result.info, result.latency_ms);
        setPingResults((prev) => {
          const next = new Map(prev);
          next.set(id, { id, online: true, latency_ms: result.latency_ms, info: result.info });
          return next;
        });
      } else {
        setPingResults((prev) => {
          const next = new Map(prev);
          next.set(id, { id, online: false, latency_ms: null, info: null });
          return next;
        });
      }
    } catch {
      setPingResults((prev) => {
        const next = new Map(prev);
        next.set(id, { id, online: false, latency_ms: null, info: null });
        return next;
      });
    }
  };

  const handleAddServer = async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    try {
      await api.servers.addServer(newName.trim(), newAddress.trim(), parseInt(newPort) || 25565);
      setAddModalOpen(false);
      setNewName('');
      setNewAddress('');
      setNewPort('25565');
      await loadServers();
    } catch (e) {
      console.error('Failed to add server:', e);
    }
  };

  const handleRemoveServer = async (id: number) => {
    try {
      await api.servers.removeServer(id);
      await loadServers();
    } catch (e) {
      console.error('Failed to remove server:', e);
    }
  };

  const handleToggleFavorite = async (id: number, current: boolean) => {
    try {
      await api.servers.toggleServerFavorite(id, !current);
      await loadServers();
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  const handleImportFromInstance = async () => {
    if (!importInstanceId) return;
    try {
      const result = await api.servers.readServersDat(importInstanceId);
      setImportedServers(result);
    } catch (e) {
      console.error('Failed to read servers.dat:', e);
    }
  };

  const handleImportServer = async (server: ServerAddress) => {
    try {
      await api.servers.addServer(server.name, server.address, server.port);
      await loadServers();
    } catch (e) {
      console.error('Failed to import server:', e);
    }
  };

  const isOnline = (server: ServerListEntry): boolean => {
    const ping = pingResults.get(server.id);
    if (ping) return ping.online;
    return server.last_ping_result !== null;
  };

  const getLatency = (server: ServerListEntry): number | null => {
    const ping = pingResults.get(server.id);
    if (ping) return ping.latency_ms;
    return server.latency_ms;
  };

  const getPlayers = (server: ServerListEntry): { online: number; max: number } | null => {
    const ping = pingResults.get(server.id);
    if (ping?.info) return { online: ping.info.players.online, max: ping.info.players.max };
    if (server.last_ping_result) return { online: server.last_ping_result.players.online, max: server.last_ping_result.players.max };
    return null;
  };

  const filtered = servers
    .filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.address.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus === 'online' && !isOnline(s)) return false;
      if (filterStatus === 'offline' && isOnline(s)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'favorite':
          if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
          return a.name.localeCompare(b.name);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'latency': {
          const la = getLatency(a) ?? Infinity;
          const lb = getLatency(b) ?? Infinity;
          return la - lb;
        }
        case 'players': {
          const pa = getPlayers(a)?.online ?? -1;
          const pb = getPlayers(b)?.online ?? -1;
          return pb - pa;
        }
        default:
          return 0;
      }
    });

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Servers</h1>
      <p className="swiftui-page-subtitle">Multiplayer server browser</p>

      <div className={styles.toolbar}>
        <SearchField placeholder="Search servers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className={styles.toolbarActions}>
          <select className={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            <option value="favorite">Favorites first</option>
            <option value="name">Name</option>
            <option value="latency">Latency</option>
            <option value="players">Players</option>
          </select>
          <select className={styles.filterSelect} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}>
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <Button variant="secondary" size="small" onClick={handlePingAll} disabled={pinging}>
            <RefreshIcon size={14} />
            {pinging ? 'Pinging...' : 'Ping All'}
          </Button>
          <Button variant="secondary" size="small" onClick={() => setImportModalOpen(true)}>
            Import
          </Button>
          <Button variant="primary" size="small" onClick={() => setAddModalOpen(true)}>
            <PlusIcon size={14} />
            Add Server
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>
          <Spinner size="medium" />
          <p style={{ marginTop: 'var(--swift-spacing-md)' }}>Loading servers...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <GlobeIcon size={32} />
          <p style={{ marginTop: 'var(--swift-spacing-md)' }}>
            {servers.length === 0 ? 'No servers added yet' : 'No servers match your filters'}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((server) => {
            const online = isOnline(server);
            const latency = getLatency(server);
            const players = getPlayers(server);
            return (
              <div key={server.id} className={styles.serverCard}>
                <div className={styles.serverInfo}>
                  <div className={styles.serverHeader}>
                    <button
                      className={styles.starButton}
                      onClick={() => handleToggleFavorite(server.id, server.is_favorite)}
                      aria-label={server.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <HeartIcon size={14} filled={server.is_favorite} />
                    </button>
                    <span className={styles.serverName}>{server.name}</span>
                    <Badge variant={online ? 'success' : 'default'}>{online ? 'Online' : 'Offline'}</Badge>
                  </div>
                  <div className={styles.serverAddress}>
                    {server.address}:{server.port}
                  </div>
                  {online && (
                    <div className={styles.serverMeta}>
                      {latency !== null && (
                        <span className={latency < 50 ? styles.latencyGood : latency < 150 ? styles.latencyMedium : styles.latencyBad}>
                          {latency}ms
                        </span>
                      )}
                      {players && <span>{players.online}/{players.max} players</span>}
                    </div>
                  )}
                </div>
                <div className={styles.serverActions}>
                  <Button variant="plain" size="small" onClick={() => handlePingOne(server.address, server.port, server.id)}>
                    <RefreshIcon size={12} />
                  </Button>
                  <Button variant="plain" size="small" onClick={() => handleRemoveServer(server.id)}>
                    <TrashIcon size={12} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Server" footer={
        <div style={{ display: 'flex', gap: 'var(--swift-spacing-sm)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setAddModalOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAddServer} disabled={!newName.trim() || !newAddress.trim()}>Add</Button>
        </div>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--swift-spacing-md)' }}>
          <FormField label="Server Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Server" />
          <FormField label="Address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="play.example.com" />
          <FormField label="Port" type="number" value={newPort} onChange={(e) => setNewPort(e.target.value)} placeholder="25565" />
        </div>
      </Modal>

      <Modal open={importModalOpen} onClose={() => { setImportModalOpen(false); setImportedServers([]); }} title="Import from Instance" footer={
        <div style={{ display: 'flex', gap: 'var(--swift-spacing-sm)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setImportModalOpen(false); setImportedServers([]); }}>Close</Button>
        </div>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--swift-spacing-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--swift-spacing-sm)', alignItems: 'center' }}>
            <select className={styles.sortSelect} value={importInstanceId} onChange={(e) => setImportInstanceId(e.target.value)}>
              {instState.instances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
            <Button variant="primary" size="small" onClick={handleImportFromInstance} disabled={!importInstanceId}>
              Scan
            </Button>
          </div>
          {importedServers.length > 0 && (
            <div className={styles.list}>
              {importedServers.map((s, i) => (
                <div key={i} className={styles.serverCard}>
                  <div className={styles.serverInfo}>
                    <span className={styles.serverName}>{s.name}</span>
                    <span className={styles.serverAddress}>{s.address}:{s.port}</span>
                  </div>
                  <Button variant="secondary" size="small" onClick={() => handleImportServer(s)}>Import</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
