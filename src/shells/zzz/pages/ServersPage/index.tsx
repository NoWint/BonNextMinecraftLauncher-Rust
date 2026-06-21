import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../shared/api';
import type { ServerListEntry, MinecraftServerInfo, BatchPingResult } from '../../../../shared/api/servers';
import type { GameInstance } from '../../../../shared/api/types';
import { formatError } from '../../../../shared/utils/errorMapping';
import { logger } from '../../../../shared/utils/logger';
import { useToast } from '../../../../shared/stores/toastStore';
import { useInstances } from '../../../../shared/stores/instanceStore';
import { useI18n } from '../../../../shared/i18n';
import { SectionHeader, Ticker } from '../../components/layout';
import { Button, Modal } from '../../components/ui';
import { ServerPingBadge } from '../../components/ui';
import { Icon } from '../../components/ui/Icon';
import { CardSkeleton } from '../../components/ui/Skeleton';
import styles from './ServersPage.module.css';
import TextComponentRenderer from '../../components/ui/TextComponentRenderer';

/**
 * 常驻推荐服务器（6 个）— 始终显示，作为基础推荐列表。
 * 跨平台：仅依赖 api.servers.pingServer，无平台特定代码。
 */
const FEATURED_SERVERS: Array<{ name: string; address: string; port: number; description: string }> = [
  { name: 'Hypixel Network', address: 'mc.hypixel.net', port: 25565, description: '全球最大的迷你游戏服务器' },
  { name: 'CubeCraft Games', address: 'play.cubecraft.net', port: 25565, description: '迷你游戏与生存游戏' },
  { name: 'Mineplex', address: 'mineplex.com', port: 25565, description: '经典迷你游戏社区' },
  { name: '2b2t', address: '2b2t.org', port: 25565, description: '最古老的纯无政府生存服务器' },
  { name: 'Hive Games', address: 'play.hivemc.com', port: 25565, description: '迷你游戏与隐藏游戏' },
  { name: 'Wynncraft', address: 'play.wynncraft.com', port: 25565, description: 'MMO RPG 体验' },
];

/**
 * 从公共 API（mcsrvstat.us）获取额外推荐服务器。
 * 失败时返回空数组，仅显示常驻 6 个。
 * 跨平台：使用 fetch，无平台特定代码。
 */
async function fetchApiFeaturedServers(): Promise<Array<{ name: string; address: string; port: number; description: string }>> {
  try {
    // mcsrvstat.us 提供 API 查询服务器状态，这里仅作为"API 获取"的示例。
    // 实际生产环境应替换为官方推荐服务器 API。
    const response = await fetch('https://api.mcsrvstat.us/3/mc.hypixel.net', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    // 如果 API 返回了在线服务器，则返回一个动态推荐（基于 API 验证）
    if (data && data.online) {
      return [
        { name: 'Hypixel Network (API verified)', address: 'mc.hypixel.net', port: 25565, description: `API: ${data.motd?.clean?.join(' ') || 'Online'}` },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

interface FeaturedState {
  info: MinecraftServerInfo | null;
  latency: number | null;
  loading: boolean;
}

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
  const { t } = useI18n();

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

  // 推荐服务器状态（HMCL 风格：进入页面自动 ping 展示）
  const [featuredStates, setFeaturedStates] = useState<Record<string, FeaturedState>>({});
  const [featuredLoading, setFeaturedLoading] = useState(false);

  const loadServers = useCallback(async () => {
    try {
      const list = await api.servers.listServers();
      setServers(list);
    } catch (e) {
      logger.error('Failed to load servers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const [featuredServers, setFeaturedServers] = useState(FEATURED_SERVERS);

  const loadFeaturedServers = useCallback(async () => {
    setFeaturedLoading(true);
    // 1. 从 API 获取动态推荐服务器（失败则仅使用常驻 6 个）
    const apiServers = await fetchApiFeaturedServers();
    // 2. 合并：常驻 6 个 + API 获取的（去重）
    const merged: typeof FEATURED_SERVERS = [...FEATURED_SERVERS];
    for (const s of apiServers) {
      if (!merged.some((m) => m.address === s.address && m.port === s.port)) {
        merged.push(s);
      }
    }
    setFeaturedServers(merged);

    // 3. 初始化为 loading 状态
    const initial: Record<string, FeaturedState> = {};
    for (const s of merged) {
      initial[s.address] = { info: null, latency: null, loading: true };
    }
    setFeaturedStates(initial);

    // 4. 并发 ping 所有推荐服务器
    const results = await Promise.allSettled(
      merged.map((s) => api.servers.pingServer(s.address, s.port)),
    );

    const next: Record<string, FeaturedState> = {};
    merged.forEach((s, i) => {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        next[s.address] = {
          info: r.value.info ?? null,
          latency: r.value.latency_ms ?? null,
          loading: false,
        };
      } else {
        next[s.address] = { info: null, latency: null, loading: false };
      }
    });
    setFeaturedStates(next);
    setFeaturedLoading(false);
  }, []);

  useEffect(() => {
    loadFeaturedServers();
  }, [loadFeaturedServers]);

  const handleAddFeatured = useCallback(async (featured: { name: string; address: string; port: number }) => {
    // 检查是否已在列表中
    const exists = servers.some((s) => s.address === featured.address && s.port === featured.port);
    if (exists) {
      addToast({ type: 'info', title: t('servers.featured.exists') });
      return;
    }
    try {
      await api.servers.addServer(featured.name, featured.address, featured.port);
      addToast({ type: 'success', title: t('servers.featured.added'), message: featured.name });
      loadServers();
    } catch (e) {
      addToast({ type: 'error', title: t('servers.addFailed'), message: formatError(e) });
    }
  }, [servers, addToast, t, loadServers]);

  const isFeaturedInList = useCallback((address: string, port: number) => {
    return servers.some((s) => s.address === address && s.port === port);
  }, [servers]);

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
      addToast({ type: 'error', title: t('servers.pingFailed'), message: formatError(e) });
    } finally {
      setPingingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [servers, addToast, t]);

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
      addToast({ type: 'success', title: t('servers.pingAllComplete'), message: t('servers.pingAllResult', { count: String(results.length) }) });
    } catch (e) {
      addToast({ type: 'error', title: 'Ping All Failed', message: formatError(e) });
    } finally {
      setPingingIds(new Set());
      setPingingAll(false);
    }
  }, [servers, addToast, t]);

  const handleFavorite = useCallback(async (id: number, favorite: boolean) => {
    try {
      await api.servers.toggleServerFavorite(id, favorite);
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: favorite } : s)));
    } catch (e) {
      addToast({ type: 'error', title: t('servers.favoriteFailed'), message: formatError(e) });
    }
  }, [addToast, t]);

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return;
    try {
      await api.servers.removeServer(removeTarget.id);
      setServers((prev) => prev.filter((s) => s.id !== removeTarget.id));
      addToast({ type: 'success', title: t('servers.removed'), message: removeTarget.name });
      setRemoveTarget(null);
    } catch (e) {
      addToast({ type: 'error', title: t('servers.removeFailed'), message: formatError(e) });
    }
  }, [removeTarget, addToast, t]);

  const handleAddServer = useCallback(async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    const port = parseInt(newPort, 10) || 25565;
    setAdding(true);
    try {
      await api.servers.addServer(newName.trim(), newAddress.trim(), port);
      addToast({ type: 'success', title: t('servers.added'), message: newName.trim() });
      setNewName('');
      setNewAddress('');
      setNewPort('25565');
      setShowAddForm(false);
      loadServers();
    } catch (e) {
      addToast({ type: 'error', title: t('servers.addFailed'), message: formatError(e) });
    } finally {
      setAdding(false);
    }
  }, [newName, newAddress, newPort, addToast, loadServers, t]);

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
      <SectionHeader title={t('servers.title')} subtitle={t('servers.subtitle')} />

      {/* 推荐服务器区（HMCL 风格：自动展示精选公开服务器） */}
      <div className={styles.featured}>
        <div className={styles.featured__header}>
          <div>
            <div className={styles.featured__title}>{t('servers.featured.title')}</div>
            <div className={styles.featured__subtitle}>{t('servers.featured.subtitle')}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadFeaturedServers}
            disabled={featuredLoading}
          >
            <Icon name="loader" size={12} /> {t('servers.featured.refresh')}
          </Button>
        </div>
        <div className={styles.featured__grid}>
          {featuredServers.map((srv) => {
            const state = featuredStates[srv.address];
            const info = state?.info ?? null;
            const latency = state?.latency ?? null;
            const isLoading = state?.loading ?? false;
            const online = info?.players?.online ?? null;
            const max = info?.players?.max ?? null;
            const inList = isFeaturedInList(srv.address, srv.port);
            return (
              <div key={srv.address} className={styles.featured__card}>
                <div className={styles.featured__cardHeader}>
                  <Icon name="cube" size={14} />
                  <span className={styles.featured__cardName}>{srv.name}</span>
                </div>
                <div className={styles.featured__cardAddress}>{srv.address}:{srv.port}</div>
                <div className={styles.featured__cardDesc}>{srv.description}</div>
                <div className={styles.featured__cardMeta}>
                  {isLoading ? (
                    <span className={styles.featured__cardLoading}>{t('servers.featured.loading')}</span>
                  ) : info ? (
                    <>
                      {online !== null && max !== null && (
                        <span className={styles.featured__cardPlayers}>
                          {t('servers.featured.players', { online: String(online), max: String(max) })}
                        </span>
                      )}
                      {latency !== null && (
                        <span className={styles.featured__cardLatency}>
                          {t('servers.featured.latency', { ms: String(latency) })}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className={styles.featured__cardOffline}>{t('servers.featured.offline')}</span>
                  )}
                </div>
                <Button
                  variant={inList ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={inList}
                  onClick={() => handleAddFeatured(srv)}
                  className={styles.featured__cardBtn}
                >
                  {inList ? t('servers.featured.added') : t('servers.featured.add')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.headerActions}>
        <Button variant="secondary" size="sm" disabled={pingingAll || servers.length === 0} onClick={handlePingAll}>
          {pingingAll ? t('servers.pingingAll') : t('servers.pingAll')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowImport(!showImport)}>
          {showImport ? t('servers.cancel') : t('servers.importFromInstance')}
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? t('servers.cancel') : t('servers.addServer')}
        </Button>
      </div>

      {showImport && (
        <div className={styles.addForm}>
          <div className={styles.addForm__row}>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>{t('servers.form.instance')}</label>
              <select
                className={styles.addForm__select}
                value={importInstanceId}
                onChange={(e) => setImportInstanceId(e.target.value)}
              >
                <option value="">{t('servers.form.selectInstance')}</option>
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
              <label className={styles.addForm__label}>{t('servers.form.name')}</label>
              <input
                className={styles.addForm__input}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('servers.form.namePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
              />
            </div>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>{t('servers.form.address')}</label>
              <input
                className={styles.addForm__input}
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder={t('servers.form.addressPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
              />
            </div>
            <div className={styles.addForm__field}>
              <label className={styles.addForm__label}>{t('servers.form.port')}</label>
              <input
                className={styles.addForm__input}
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
                placeholder={t('servers.form.portPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleAddServer()}
              />
            </div>
            <Button variant="primary" size="sm" disabled={adding || !newName.trim() || !newAddress.trim()} onClick={handleAddServer}>
              {adding ? t('servers.adding') : 'Add'}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.controls__search}>
          <input
            className={styles.controls__searchInput}
            type="text"
            placeholder={t('servers.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.controls__filters}>
          <div className={styles.controls__filterGroup}>
            <span className={styles.controls__label}>{t('servers.filter.status')}</span>
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
            <span className={styles.controls__label}>{t('servers.filter.sort')}</span>
            {([
              ['favorite', t('servers.sort.favorite')],
              ['name', t('servers.sort.name')],
              ['latency', t('servers.sort.latency')],
              ['players', t('servers.sort.players')],
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
          <div className={styles.empty__title}>{t('servers.empty.noServers')}</div>
          <div className={styles.empty__desc}>{t('servers.empty.noServersDesc')}</div>
          <div className={styles.empty__actions}>
            <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
              {t('servers.addServer')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              {t('servers.importFromInstance')}
            </Button>
          </div>
        </div>
      ) : sortedServers.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.empty__title}>{t('servers.empty.noMatches')}</div>
          <div className={styles.empty__desc}>{t('servers.empty.noMatchesDesc')}</div>
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
        title={t('servers.remove.title')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>
              {t('servers.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemove}>
              {t('common.remove')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>
          {t('servers.remove.confirm', { name: removeTarget?.name || '' })}
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
