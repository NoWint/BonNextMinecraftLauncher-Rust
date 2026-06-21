import { useState, useEffect } from 'react';
import { logger, type LogEntry } from '@/shared/utils/logger';

export type { LogEntry as PluginLogEntry };

export function usePluginLogs(pluginId?: string): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const allLogs = logger.getBuffer();
    const filtered = pluginId
      ? allLogs.filter((l) => l.message.includes(`[plugin:${pluginId}]`))
      : allLogs.filter((l) => l.message.includes('[plugin:'));
    setLogs(filtered);

    const unsubscribe = logger.subscribe((entry) => {
      if (!entry.message.includes('[plugin:')) return;
      if (pluginId && !entry.message.includes(`[plugin:${pluginId}]`)) return;
      setLogs((prev) => [...prev.slice(-199), entry]);
    });

    return unsubscribe;
  }, [pluginId]);

  return logs;
}
