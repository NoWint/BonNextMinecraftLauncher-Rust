import { useState, useEffect, useCallback } from 'react';
import { resolveConfirmation } from '../../shared/ai/pi';
import styles from './ConfirmDialog.module.css';

interface PendingConfirm {
  taskId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export const ConfirmDialog: React.FC = () => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PendingConfirm>).detail;
      if (detail) setPending(detail);
    };
    window.addEventListener('ai:confirm-required', handler);
    return () => window.removeEventListener('ai:confirm-required', handler);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pending) {
      resolveConfirmation(pending.taskId, true);
      setPending(null);
    }
  }, [pending]);

  const handleDeny = useCallback(() => {
    if (pending) {
      resolveConfirmation(pending.taskId, false);
      setPending(null);
    }
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') handleDeny();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, handleConfirm, handleDeny]);

  if (!pending) return null;

  const displayName = pending.toolName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const argsSummary = Object.entries(pending.args)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ');

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.warning}>⚠️</div>
        <div className={styles.title}>Confirm Action</div>
        <div className={styles.toolName}>{displayName}</div>
        {argsSummary && <div className={styles.args}>{argsSummary}</div>}
        <div className={styles.hint}>This action may modify your system.</div>
        <div className={styles.buttons}>
          <button className={styles.denyBtn} onClick={handleDeny}>
            Cancel
          </button>
          <button className={styles.confirmBtn} onClick={handleConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
