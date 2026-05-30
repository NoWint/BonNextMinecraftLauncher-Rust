export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

const MAX_ENTRIES = 200;
const entries: LogEntry[] = [];

function formatTimestamp(): string {
  return new Date().toISOString();
}

function pushEntry(entry: LogEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function log(level: LogLevel, category: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    category,
    message,
    data,
  };

  pushEntry(entry);

  const prefix = `[BonNext][${entry.timestamp}][${level.toUpperCase()}][${category}]`;
  switch (level) {
    case 'info':
      console.info(prefix, message, data ?? '');
      break;
    case 'warn':
      console.warn(prefix, message, data ?? '');
      break;
    case 'error':
      console.error(prefix, message, data ?? '');
      break;
  }
}

export function info(category: string, message: string, data?: unknown): void {
  log('info', category, message, data);
}

export function warn(category: string, message: string, data?: unknown): void {
  log('warn', category, message, data);
}

export function error(category: string, message: string, data?: unknown): void {
  log('error', category, message, data);
}

export function getLogEntries(): LogEntry[] {
  return [...entries];
}

export function clearLogEntries(): void {
  entries.length = 0;
}

if (import.meta.env.DEV) {
  window.__bonnext_logs = {
    getEntries: getLogEntries,
    clear: clearLogEntries,
  };
}
