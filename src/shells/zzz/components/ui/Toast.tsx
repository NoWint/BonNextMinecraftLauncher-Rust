import { useState } from 'react';
import { Check, X, Info, AlertTriangle } from 'lucide-react';
import { useToast, type Toast } from '../../../../shared/stores/toastStore';
import styles from './Toast.module.css';

const ICONS: Record<Toast['type'], React.ReactNode> = {
  success: <Check size={14} />,
  error: <X size={14} />,
  info: <Info size={14} />,
  warning: <AlertTriangle size={14} />,
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [exiting, setExiting] = useState(false);
  const isError = toast.type === 'error';

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={`${styles.toast} ${styles[`toast--${toast.type}`]} ${exiting ? styles['toast--exiting'] : ''}`}
      onClick={handleDismiss}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className={styles.icon}>{ICONS[toast.type]}</span>
      <div className={styles.content}>
        <div className={styles.title}>{toast.title}</div>
        {toast.message && <div className={styles.message}>{toast.message}</div>}
      </div>
      <button className={styles.close} aria-label="Close" onClick={(e) => { e.stopPropagation(); handleDismiss(); }}>
        <X size={12} />
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
