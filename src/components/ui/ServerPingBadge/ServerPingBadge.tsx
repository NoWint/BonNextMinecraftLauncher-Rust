import styles from './ServerPingBadge.module.css';

interface Props {
  latencyMs: number | null;
  online: boolean;
}

export default function ServerPingBadge({ latencyMs, online }: Props) {
  if (!online) {
    return <span className={`${styles.badge} ${styles.offline}`}>OFFLINE</span>;
  }
  const cls =
    latencyMs !== null && latencyMs < 50
      ? styles.fast
      : latencyMs !== null && latencyMs < 150
        ? styles.medium
        : styles.slow;
  return (
    <span className={`${styles.badge} ${cls}`}>
      {latencyMs !== null ? `${latencyMs}ms` : '--'}
    </span>
  );
}
