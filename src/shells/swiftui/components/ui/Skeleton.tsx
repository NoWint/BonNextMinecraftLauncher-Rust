import styles from './Skeleton.module.css';

interface SkeletonProps { variant?: 'text' | 'title' | 'avatar' | 'rect'; className?: string; }

export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return <div className={`${styles.skeleton} ${styles[variant]} ${className || ''}`} aria-busy="true" aria-label="Loading" role="progressbar" />;
}
