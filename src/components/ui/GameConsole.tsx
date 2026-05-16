import { useState, useEffect, useRef } from 'react';

interface LogLine {
  id: number;
  text: string;
  stream: 'stdout' | 'stderr';
  time: string;
}

// This listens for real-time game output via a Tauri event.
// In the Rust backend, the game process stdout/stderr are piped
// and emitted as 'game-output' events.
export default function GameConsole({ visible }: { visible: boolean }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  let nextId = useRef(0);

  useEffect(() => {
    // Listen to game output events from the Rust backend
    const setup = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<{ text: string; stream: string }>('game-output', (event) => {
          const line: LogLine = {
            id: ++nextId.current,
            text: event.payload.text,
            stream: event.payload.stream as 'stdout' | 'stderr',
            time: new Date().toLocaleTimeString(),
          };
          setLines((prev) => [...prev.slice(-500), line]);
        });
        return unlisten;
      } catch {
        return () => {};
      }
    };
    const promise = setup();
    return () => { promise.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 40, left: 20, right: 20,
      height: 200, background: '#0A0A0A', border: '1px solid #2A2A2A',
      zIndex: 100, display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-mono)', fontSize: '0.45em',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 10px', borderBottom: '1px solid #1A1A1A',
        background: '#111',
      }}>
        <span style={{ color: '#FFE600', letterSpacing: 2 }}>GAME CONSOLE</span>
        <label style={{ fontSize: '0.9em', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', padding: '6px 10px',
        color: '#AAA', lineHeight: 1.6,
      }}>
        {lines.length === 0 && (
          <div style={{ color: '#444', textAlign: 'center', paddingTop: 40 }}>
            Waiting for game output...
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} style={{
            color: l.stream === 'stderr' ? '#FF6B6B' : '#AAA',
          }}>
            <span style={{ color: '#444', marginRight: 8 }}>{l.time}</span>
            {l.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
