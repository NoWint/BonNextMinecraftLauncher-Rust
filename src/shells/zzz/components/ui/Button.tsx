import React from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'secondary-highlight' | 'icon' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

// 显式映射,避免 CSS Modules 动态拼接被 tree-shake 误删
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles['button--primary'],
  secondary: styles['button--secondary'],
  'secondary-highlight': styles['button--secondary-highlight'],
  icon: styles['button--icon'],
  danger: styles['button--danger'],
};

const SIZE_CLASS: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: styles['button--sm'],
  md: styles['button--md'],
  lg: styles['button--lg'],
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft,
  iconRight,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const variantClass = VARIANT_CLASS[variant] || '';
  const sizeClass = SIZE_CLASS[size] || '';
  const isDisabled = disabled || loading;

  return (
    <button
      className={`${styles.button} ${variantClass} ${sizeClass} ${className}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className={styles.button__spinner} aria-hidden="true" />}
      {!loading && iconLeft && <span className={styles.button__icon} aria-hidden="true">{iconLeft}</span>}
      {children}
      {!loading && iconRight && <span className={styles.button__icon} aria-hidden="true">{iconRight}</span>}
    </button>
  );
};
