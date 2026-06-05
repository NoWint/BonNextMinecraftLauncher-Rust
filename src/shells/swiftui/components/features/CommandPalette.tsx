import { useEffect, useRef } from 'react';
import styles from './CommandPalette.module.css';

interface Command { id: string; label: string; shortcut?: string; action: () => void; }
interface CommandPaletteProps { open: boolean; onClose: () => void; commands: Command[]; }

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} className={styles.searchInput} placeholder="Type a command..." />
        <div className={styles.results}>
          {commands.map((cmd) => (
            <div key={cmd.id} className={styles.result} onClick={() => { cmd.action(); onClose(); }}>
              <span className={styles.resultLabel}>{cmd.label}</span>
              {cmd.shortcut && <span className={styles.resultShortcut}>{cmd.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
