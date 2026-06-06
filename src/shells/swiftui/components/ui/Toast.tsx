import { useEffect } from 'react';
import { CloseIcon } from '../icons';
import styles from './Toast.module.css';

interface ToastItem { id: string; message: string; duration?: number; }
interface ToastProps { toasts: ToastItem[]; onDismiss: (id: string) => void; }

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((toast) => <ToastItemComponent key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </div>
  );
}

function ToastItemComponent({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);
  return (
    <div className={`${styles.toast} glass-thin`} role="alert">
      <span className={styles.message}>{toast.message}</span>
      <button className={styles.closeButton} onClick={() => onDismiss(toast.id)}><CloseIcon size={12} /></button>
    </div>
  );
}
