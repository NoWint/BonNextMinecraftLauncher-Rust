import { useState } from 'react';
import { usePluginLogs, type PluginLogEntry } from '../hooks/usePluginLogs';
import styles from './PluginLogViewer.module.css';

type LevelFilter = 'all' | 'info' | 'warn' | 'error';

export function PluginLogViewer({ pluginId }: { pluginId?: string }) {
  const logs = usePluginLogs(pluginId);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  const filtered =
    levelFilter === 'all' ? logs : logs.filter((l) => l.level === levelFilter);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Plugin Logs{pluginId ? ` (${pluginId})` : ''}
        </h3>
        <select
          className={styles.filter}
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
        >
          <option value="all">All</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div className={styles.logList}>
        {filtered.length === 0 && <div className={styles.empty}>No logs</div>}
        {filtered.map((log: PluginLogEntry, i: number) => (
          <div
            key={i}
            className={`${styles.logEntry} ${styles[log.level] ?? ''}`}
          >
            <span className={styles.timestamp}>
              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
            </span>
            <span className={styles.level}>{log.level.toUpperCase()}</span>
            <span className={styles.message}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
