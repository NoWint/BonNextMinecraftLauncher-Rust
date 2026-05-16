import { useState } from 'react';
import { useToast, type Toast } from '../../stores/toastStore';
import styles from './Toast.module.css';

const ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={`${styles.toast} ${styles[`toast--${toast.type}`]} ${exiting ? styles['toast--exiting'] : ''}`}
      onClick={handleDismiss}
    >
      <span className={styles.icon}>{ICONS[toast.type]}</span>
      <div className={styles.content}>
        <div className={styles.title}>{toast.title}</div>
        {toast.message && <div className={styles.message}>{toast.message}</div>}
      </div>
      <button className={styles.close} onClick={(e) => { e.stopPropagation(); handleDismiss(); }}>
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
