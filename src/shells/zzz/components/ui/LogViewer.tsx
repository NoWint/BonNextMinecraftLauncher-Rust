import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TextComponentRenderer from './TextComponentRenderer';
import { useI18n } from '../../../../shared/i18n';
import styles from './LogViewer.module.css';

interface LogLine {
  id: number;
  text: string;
  stream: 'stdout' | 'stderr';
  time: string;
}

interface RecentLogLine {
  line: string;
  level: string;
}

const MAX_LINES = 10000;

function getLevelClass(text: string, stream: string): string {
  if (stream === 'stderr') return styles.levelError;
  const upper = text.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('EXCEPTION')) return styles.levelError;
  if (upper.includes('WARN') || upper.includes('WARNING')) return styles.levelWarn;
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return styles.levelDebug;
  return styles.levelInfo;
}

function detectLevel(text: string, stream: string): string {
  if (stream === 'stderr') return 'ERROR';
  const upper = text.toUpperCase();
  if (upper.includes('FATAL') || upper.includes('SEVERE')) return 'FATAL';
  if (upper.includes('ERROR') || upper.includes('EXCEPTION') || upper.includes('CAUSED BY')) return 'ERROR';
  if (upper.includes('WARN') || upper.includes('WARNING')) return 'WARN';
  return 'INFO';
}

interface LogViewerProps {
  instanceId: string;
  visible: boolean;
  onClose?: () => void;
}

export default function LogViewer({ instanceId, visible }: LogViewerProps) {
  const { t } = useI18n();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set(['INFO', 'WARN', 'ERROR', 'FATAL']));
  const [searchTerm, setSearchTerm] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !instanceId) return;

    invoke<RecentLogLine[]>('get_recent_logs', { instanceId, lines: 500 })
      .then((recent) => {
        const logLines: LogLine[] = recent.map((r) => ({
          id: --nextId.current,
          text: r.line,
          stream: r.level === 'ERROR' ? 'stderr' : 'stdout',
          time: '',
        }));
        setLines((prev) => [...logLines, ...prev].slice(-MAX_LINES));
      })
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ text: string; stream: string }>('game-output', (event) => {
        const line: LogLine = {
          id: ++nextId.current,
          text: event.payload.text,
          stream: event.payload.stream as 'stdout' | 'stderr',
          time: new Date().toLocaleTimeString(),
        };
        setLines((prev) => [...prev, line].slice(-MAX_LINES));
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [visible, instanceId]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom !== autoScroll) {
      setAutoScroll(atBottom);
    }
  }, [autoScroll]);

  if (!visible) return null;

  const filtered = lines.filter((l) => {
    const level = detectLevel(l.text, l.stream);
    if (!levelFilter.has(level)) return false;
    if (filter && !l.text.toLowerCase().includes(filter.toLowerCase())) return false;
    if (searchTerm && !l.text.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{t('logViewer.title')}</span>
        <div className={styles.controls}>
          <input
            type="text"
            className={styles.filterInput}
            placeholder={t('logViewer.filterPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <label className={styles.autoScrollLabel}>
            <input
              type="checkbox"
              className={styles.autoScrollCheckbox}
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            {t('logViewer.autoScroll')}
          </label>
        </div>
      </div>
      <div className={styles.filterBar}>
        {(['INFO', 'WARN', 'ERROR', 'FATAL'] as const).map((level) => (
          <button
            key={level}
            className={`${styles.filterBtn} ${levelFilter.has(level) ? styles.active : ''} ${styles[`level_${level}`]}`}
            onClick={() => {
              const next = new Set(levelFilter);
              if (next.has(level)) next.delete(level); else next.add(level);
              setLevelFilter(next);
            }}
          >
            {level}
          </button>
        ))}
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t('logViewer.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className={styles.body} ref={scrollContainerRef} onScroll={handleScroll}>
        {filtered.length === 0 && <div className={styles.empty}>{t('logViewer.waiting')}</div>}
        {filtered.map((l) => (
          <div key={l.id} className={styles.line}>
            {l.time && <span className={styles.lineTime}>{l.time}</span>}
            <span className={`${styles.lineText} ${getLevelClass(l.text, l.stream)}`}>
              {l.text.includes('\u00A7') ? (
                <TextComponentRenderer component={l.text} />
              ) : (
                l.text
              )}
            </span>
          </div>
        ))}
        <div ref={bottomRef} className={styles.bottomAnchor} />
      </div>
    </div>
  );
}
