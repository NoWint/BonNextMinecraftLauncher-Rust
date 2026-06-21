import React, { useEffect, useCallback, useRef } from 'react';
import styles from './Modal.module.css';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea',
  'input',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const modalStack: string[] = [];
const stackListeners = new Set<() => void>();

function pushModal(id: string) {
  modalStack.push(id);
  stackListeners.forEach((fn) => fn());
}

function popModal(id: string) {
  const idx = modalStack.lastIndexOf(id);
  if (idx !== -1) modalStack.splice(idx, 1);
  stackListeners.forEach((fn) => fn());
}

function isTopModal(id: string): boolean {
  return modalStack.length > 0 && modalStack[modalStack.length - 1] === id;
}

function modalDepth(id: string): number {
  const idx = modalStack.indexOf(id);
  return idx >= 0 ? idx : 0;
}

function subscribeStack(fn: () => void): () => void {
  stackListeners.add(fn);
  return () => {
    stackListeners.delete(fn);
  };
}

function setRootAriaHidden(hidden: boolean) {
  const root = document.getElementById('root');
  if (!root) return;
  if (hidden) {
    root.setAttribute('aria-hidden', 'true');
  } else {
    root.removeAttribute('aria-hidden');
  }
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, actions }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef(Math.random().toString(36).slice(2));
  const titleId = `modal-title-${modalIdRef.current}`;

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!modalRef.current) return [];
    return Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTORS));
  }, []);

  const handleClose = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isTopModal(modalIdRef.current)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [handleClose, getFocusableElements],
  );

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      pushModal(modalIdRef.current);
    }
    return () => {
      if (open) {
        popModal(modalIdRef.current);
      }
    };
  }, [open]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open && isTopModal(modalIdRef.current)) {
      requestAnimationFrame(() => {
        const focusable = getFocusableElements();
        if (focusable.length > 0) focusable[0].focus();
      });
    }
  }, [open, getFocusableElements]);

  useEffect(() => {
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const syncAriaHidden = () => {
      setRootAriaHidden(modalStack.length > 0);
    };

    syncAriaHidden();
    const unsub = subscribeStack(syncAriaHidden);

    return () => {
      unsub();
      if (modalStack.length === 0) {
        setRootAriaHidden(false);
      }
    };
  }, [open]);

  if (!open) return null;

  const top = isTopModal(modalIdRef.current);
  const depth = modalDepth(modalIdRef.current);
  const zIndex = 200 + depth * 10;

  return (
    <div className={styles.overlay} style={{ zIndex }} onClick={top ? handleClose : undefined} aria-hidden={!top}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
};
