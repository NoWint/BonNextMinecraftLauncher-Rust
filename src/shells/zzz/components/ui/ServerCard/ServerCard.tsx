import type { ServerListEntry } from '../../../../../shared/api/servers';
import ServerPingBadge from '../ServerPingBadge/ServerPingBadge';
import styles from './ServerCard.module.css';

interface Props {
  server: ServerListEntry;
  onPing: (id: number) => void;
  onFavorite: (id: number, fav: boolean) => void;
  onRemove: (id: number) => void;
}

export default function ServerCard({ server, onPing, onFavorite, onRemove }: Props) {
  const info = server.last_ping_result;
  const latencyMs = server.latency_ms;
  const online = info !== null;
  const motd = info?.description?.text || '';
  const playerCount = info ? `${info.players.online}/${info.players.max}` : '--';
  const version = info?.version?.name || '--';

  return (
    <div className={styles.card}>
      <div className={styles.icon}>
        {server.icon_base64 ? (
          <img src={server.icon_base64} alt="" />
        ) : (
          <div className={styles.iconPlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{server.name}</div>
        <div className={styles.address}>
          {server.address}:{server.port}
        </div>
        {motd && <div className={styles.motd}>{motd}</div>}
        <div className={styles.meta}>
          <span>{version}</span>
          <span>{playerCount}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <ServerPingBadge online={online} latencyMs={latencyMs} />
        <button className={styles.actionBtn} onClick={() => onPing(server.id)}>
          PING
        </button>
        <button
          className={styles.favBtn}
          onClick={() => onFavorite(server.id, !server.is_favorite)}
        >
          {server.is_favorite ? '\u2605' : '\u2606'}
        </button>
        <button className={styles.removeBtn} onClick={() => onRemove(server.id)}>
          {'\u2715'}
        </button>
      </div>
    </div>
  );
}
