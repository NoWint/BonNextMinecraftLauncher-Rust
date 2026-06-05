import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  size?: 'small' | 'default' | 'large';
  iconOnly?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'default', iconOnly = false, children, className, ...props }: ButtonProps) {
  const classNames = [styles.button, styles[variant], size !== 'default' ? styles[size] : '', iconOnly ? styles.iconOnly : '', className || ''].filter(Boolean).join(' ');
  return <button className={classNames} {...props}>{children}</button>;
}
