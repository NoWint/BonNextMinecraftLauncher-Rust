import { useEffect, useCallback, type ReactNode } from 'react';
import { CloseIcon } from '../icons';
import { useGlassEffect } from '../../hooks/useGlassEffect';
import styles from './Modal.module.css';

interface ModalProps { open: boolean; onClose: () => void; title?: string; footer?: ReactNode; children: ReactNode; }

export function Modal({ open, onClose, title, footer, children }: ModalProps) {
  const modalRef = useGlassEffect<HTMLDivElement>('strong');
  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    if (open) { document.addEventListener('keydown', handleKeyDown); return () => document.removeEventListener('keydown', handleKeyDown); }
  }, [open, handleKeyDown]);
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div ref={modalRef} className={`${styles.modal} glass-thick`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          <button className={styles.closeButton} onClick={onClose} aria-label="Close"><CloseIcon size={14} /></button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
