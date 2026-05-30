import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

interface LogViewerProps {
  instanceId: string;
  visible: boolean;
  onClose?: () => void;
}

export default function LogViewer({ instanceId, visible }: LogViewerProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
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

  const filtered = filter ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase())) : lines;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>LOG VIEWER</span>
        <div className={styles.controls}>
          <input
            type="text"
            className={styles.filterInput}
            placeholder="Filter..."
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
            Auto-scroll
          </label>
        </div>
      </div>
      <div className={styles.body} ref={scrollContainerRef} onScroll={handleScroll}>
        {filtered.length === 0 && <div className={styles.empty}>Waiting for game output...</div>}
        {filtered.map((l) => (
          <div key={l.id} className={styles.line}>
            {l.time && <span className={styles.lineTime}>{l.time}</span>}
            <span className={`${styles.lineText} ${getLevelClass(l.text, l.stream)}`}>{l.text}</span>
          </div>
        ))}
        <div ref={bottomRef} className={styles.bottomAnchor} />
      </div>
    </div>
  );
}
