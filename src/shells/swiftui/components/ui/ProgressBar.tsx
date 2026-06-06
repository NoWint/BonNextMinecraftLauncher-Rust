import styles from './ProgressBar.module.css';

interface ProgressBarProps { value: number; className?: string; }

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`${styles.track} ${className || ''}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
