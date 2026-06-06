import type { HTMLAttributes, ReactNode } from 'react';
import { useGlassEffect } from '../../hooks/useGlassEffect';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  clickable?: boolean;
  children: ReactNode;
}

export function Card({ header, footer, compact = false, clickable = false, children, className, ...props }: CardProps) {
  const cardRef = useGlassEffect<HTMLDivElement>('normal');
  const classNames = [styles.card, 'glass-regular', compact ? styles.compact : '', clickable ? styles.clickable : '', className || ''].filter(Boolean).join(' ');
  return (
    <div ref={cardRef} className={classNames} {...(clickable ? { role: 'button', tabIndex: 0 } : {})} {...props}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
