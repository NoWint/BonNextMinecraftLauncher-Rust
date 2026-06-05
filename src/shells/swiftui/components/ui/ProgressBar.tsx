import styles from './ProgressBar.module.css';

interface ProgressBarProps { value: number; className?: string; }

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`${styles.track} ${className || ''}`}>
      <div className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
