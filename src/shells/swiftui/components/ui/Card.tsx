import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  clickable?: boolean;
  children: ReactNode;
}

export function Card({ header, footer, compact = false, clickable = false, children, className, ...props }: CardProps) {
  const classNames = [styles.card, compact ? styles.compact : '', clickable ? styles.clickable : '', className || ''].filter(Boolean).join(' ');
  return (
    <div className={classNames} {...props}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
