import styles from './Spinner.module.css';

interface SpinnerProps { size?: 'small' | 'medium' | 'large'; className?: string; }

export function Spinner({ size = 'medium', className }: SpinnerProps) {
  return <div className={`${styles.spinner} ${styles[size]} ${className || ''}`} />;
}
