import { useEffect, useRef, useState } from 'react';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  action: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

let globalSetMenu: ((s: ContextMenuState | null) => void) | null = null;

export function showContextMenu(e: React.MouseEvent, items: ContextMenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  globalSetMenu?.({ x: e.clientX, y: e.clientY, items });
}

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalSetMenu = setMenu;
    return () => { globalSetMenu = null; };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Adjust position to stay in viewport
  const adjustedPos = menu ? {
    x: Math.min(menu.x, window.innerWidth - 180),
    y: Math.min(menu.y, window.innerHeight - menu.items.length * 36 - 20),
  } : { x: 0, y: 0 };

  return (
    <>
      {children}
      {menu && (
        <div
          ref={ref}
          className={styles.menu}
          style={{ left: adjustedPos.x, top: adjustedPos.y }}
        >
          {menu.items.map((item) =>
            item.separator ? (
              <div key={item.id} className={styles.separator} />
            ) : (
              <button
                key={item.id}
                className={`${styles.item} ${item.danger ? styles['item--danger'] : ''}`}
                onClick={() => {
                  item.action();
                  setMenu(null);
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}
