import { useEffect, useRef } from 'react';
import styles from './SearchPalette.module.css';

interface SearchItem { id: string; title: string; meta?: string; }
interface SearchPaletteProps { open: boolean; onClose: () => void; items: SearchItem[]; onSelect: (id: string) => void; }

export function SearchPalette({ open, onClose, items, onSelect }: SearchPaletteProps) {
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
        <input ref={inputRef} className={styles.searchInput} placeholder="Search..." onKeyDown={(e) => { if (e.key === 'Enter' && items[0]) onSelect(items[0].id); }} />
        <div className={styles.results}>
          {items.map((item) => (
            <div key={item.id} className={styles.result} onClick={() => { onSelect(item.id); onClose(); }}>
              <span className={styles.resultTitle}>{item.title}</span>
              {item.meta && <span className={styles.resultMeta}>{item.meta}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
