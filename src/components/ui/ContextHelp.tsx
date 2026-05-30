import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ContextHelp.module.css';

interface ContextHelpProps {
  content: string;
  link?: string;
}

export function ContextHelp({ content, link }: ContextHelpProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.icon} onClick={handleClick} aria-label="Help" type="button">
        ℹ
      </button>
      {open && (
        <div className={styles.popup}>
          <div className={styles.popup__content}>{content}</div>
          {link && (
            <a
              className={styles.popup__link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              Learn more →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
