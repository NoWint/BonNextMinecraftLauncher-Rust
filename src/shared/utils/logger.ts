/**
 * BonNext logger utility
 *
 * 提供与 console.debug/info/warn/error 一致的方法签名,
 * 根据环境自动控制输出:
 * - 生产环境:仅输出 warn 与 error,debug 与 info 静默
 * - 开发环境:全部输出,统一带 `[BonNext]` 前缀便于过滤
 *
 * 纯原生实现,不依赖任何第三方库。
 */

const LOG_PREFIX = '[BonNext]';

function isDev(): boolean {
  // 优先使用 Vite 注入的 DEV 标志,回退到 MODE 判断
  return import.meta.env.DEV || import.meta.env.MODE !== 'production';
}

type ConsoleMethod = (...args: unknown[]) => void;

function createDevLog(method: ConsoleMethod): ConsoleMethod {
  return (...args: unknown[]): void => {
    method(LOG_PREFIX, ...args);
  };
}

function createSilentLog(): ConsoleMethod {
  return (): void => {
    /* 静默 */
  };
}

function buildLogger() {
  const dev = isDev();
  return {
    debug: dev ? createDevLog(console.debug.bind(console)) : createSilentLog(),
    info: dev ? createDevLog(console.info.bind(console)) : createSilentLog(),
    warn: createDevLog(console.warn.bind(console)),
    error: createDevLog(console.error.bind(console)),
    getBuffer(): LogEntry[] {
      return [...entries];
    },
    subscribe(listener: (entry: LogEntry) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const logger = buildLogger();

// ---------------------------------------------------------------------------
// 以下为历史 API,保留以兼容现有调用方(ErrorBoundary / window.__bonnext_logs)
// ---------------------------------------------------------------------------

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
const listeners = new Set<(entry: LogEntry) => void>();

function formatTimestamp(): string {
  return new Date().toISOString();
}

function pushEntry(entry: LogEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  listeners.forEach((listener) => {
    try {
      listener(entry);
    } catch {
      /* ignore listener errors */
    }
  });
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
