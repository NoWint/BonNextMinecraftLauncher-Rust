import React from 'react';
import { useI18n } from '../../../../shared/i18n';
import styles from './Status.module.css';

interface StatusDotProps {
  status: 'ready' | 'processing' | 'error' | 'inactive';
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, className = '' }) => (
  <div className={`${styles.statusDot} ${styles[`statusDot--${status}`]} ${className}`} />
);

interface BadgeProps {
  variant?: 'accent' | 'default' | 'muted';
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', children }) => (
  <span className={`${styles.badge} ${styles[`badge--${variant}`]} ${className}`}>
    {children}
  </span>
);

interface ProgressBarProps {
  progress: number;
  done?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  done = false,
  showLabel = true,
  className = '',
}) => {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className={`${styles.progressBar} ${done ? styles['progressBar--done'] : ''} ${className}`}>
        <div
          className={styles.progressBar__fill}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={`${styles.progressBar__label} ${done ? styles['progressBar__label--done'] : styles['progressBar__label--active']}`}
        >
          {done ? t('ui.progress.done') : `${Math.round(progress)}%`}
        </span>
      )}
    </div>
  );
};
