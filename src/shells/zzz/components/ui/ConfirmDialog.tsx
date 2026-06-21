import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { useI18n } from '../../../../shared/i18n';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  dangerLevel?: 'low' | 'medium' | 'high';
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  dangerLevel = 'low',
  confirmText,
  cancelText,
}) => {
  const { t } = useI18n();
  const finalConfirmText = confirmText ?? t('common.confirm');
  const finalCancelText = cancelText ?? t('common.cancel');
  const [typed, setTyped] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      setTyped('');
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const requiresTyping = dangerLevel === 'high';
  const canConfirm = requiresTyping ? typed === finalConfirmText : true;

  const dialogClass = [
    styles.dialog,
    dangerLevel === 'high' ? styles.dangerHigh : '',
    dangerLevel === 'medium' ? styles.dangerMedium : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconClass = [
    styles.icon,
    dangerLevel === 'high' ? styles.iconHigh : '',
    dangerLevel === 'medium' ? styles.iconMedium : '',
    dangerLevel === 'low' ? styles.iconLow : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconChar = dangerLevel === 'high' ? '\u26A0' : dangerLevel === 'medium' ? '\u26A1' : '\u2139';

  const confirmVariant = dangerLevel === 'high' ? 'danger' : dangerLevel === 'medium' ? 'danger' : 'primary';

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={dialogClass} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <div className={styles.iconRow}>
          <span className={iconClass}>{iconChar}</span>
          <div className={styles.message}>{message}</div>
        </div>
        {requiresTyping && (
          <div className={styles.confirmInputWrapper}>
            <label className={styles.confirmInputLabel}>{t('confirmDialog.typeToConfirm', { text: finalConfirmText })}</label>
            <input className={styles.confirmInput} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {finalCancelText}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm} disabled={!canConfirm}>
            {finalConfirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
