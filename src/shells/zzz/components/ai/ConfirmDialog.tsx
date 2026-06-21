import { useState, useEffect, useCallback } from 'react';
import { resolveConfirmation } from '../../../../shared/ai/pi';
import { useI18n } from '../../../../shared/i18n';
import { ConfirmDialog as UIConfirmDialog } from '../ui/ConfirmDialog';

interface PendingConfirm {
  taskId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export const ConfirmDialog: React.FC = () => {
  const { t } = useI18n();
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
    <UIConfirmDialog
      open
      onConfirm={handleConfirm}
      onCancel={handleDeny}
      title={t('ai.confirm.title')}
      message={argsSummary ? `${displayName} — ${argsSummary}` : displayName}
      dangerLevel="medium"
      confirmText={t('ai.confirm.confirm')}
      cancelText={t('ai.confirm.cancel')}
    />
  );
};
