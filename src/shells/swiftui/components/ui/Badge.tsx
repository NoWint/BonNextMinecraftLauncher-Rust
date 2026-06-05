import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { variant?: 'default' | 'accent' | 'success' | 'warning' | 'error'; }

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[variant]} ${className || ''}`} {...props}>{children}</span>;
}
