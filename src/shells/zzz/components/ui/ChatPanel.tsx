import { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import styles from './ChatPanel.module.css';

interface ChatMessage {
  player: string;
  message: string;
  timestamp: number;
}

interface ChatPanelProps {
  maxHeight?: number;
}

const PLAYER_COLORS = [
  '#FFE600',
  '#FF6B6B',
  '#6BFFB8',
  '#6BB5FF',
  '#FF6BFF',
  '#FFB86B',
  '#6BFFFF',
  '#B86BFF',
  '#6BFF6B',
  '#FF6B9D',
];

function getPlayerColor(player: string): string {
  if (!player) return 'var(--color-text-muted)';
  let hash = 0;
  for (let i = 0; i < player.length; i++) {
    hash = player.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ maxHeight = 400 }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<ChatMessage>('chat-message', (event) => {
      setMessages((prev) => [...prev.slice(-199), event.payload]);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  if (collapsed) {
    return (
      <div
        className={styles.collapsedBar}
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed(false);
          }
        }}
        aria-label="Expand chat"
      >
        <span className={styles.collapsedIcon}>💬</span>
        <span className={styles.collapsedCount}>{messages.length}</span>
      </div>
    );
  }

  return (
    <div className={styles.panel} style={{ maxHeight }}>
      <div className={styles.header}>
        <span className={styles.title}>Chat</span>
        <div className={styles.headerActions}>
          <button className={styles.headerBtn} onClick={handleClear} aria-label="Clear chat">
            Clear
          </button>
          <button className={styles.headerBtn} onClick={() => setCollapsed(true)} aria-label="Collapse chat">
            −
          </button>
        </div>
      </div>
      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>No chat messages yet. Start a game to see in-game chat.</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={styles.message}>
              <span className={styles.time}>{formatTime(msg.timestamp)}</span>
              {msg.player ? (
                <>
                  <span className={styles.player} style={{ color: getPlayerColor(msg.player) }}>
                    &lt;{msg.player}&gt;
                  </span>
                  <span className={styles.text}>{msg.message}</span>
                </>
              ) : (
                <span className={styles.systemText}>{msg.message}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
