import styles from './Skeleton.module.css';

interface SkeletonProps {
  variant?: 'text' | 'title' | 'card' | 'icon' | 'avatar';
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ variant = 'text', width, height, className = '' }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${styles[`skeleton--${variant}`]} ${className}`}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div style={{
      background: '#141414', border: '1px solid #1C1C1C',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <Skeleton variant="icon" />
      <div style={{ flex: 1 }}>
        <Skeleton variant="title" />
        <Skeleton variant="text" width="60%" />
      </div>
      <Skeleton variant="text" width="50px" />
    </div>
  );
}
