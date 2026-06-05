import type { InputHTMLAttributes } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; horizontal?: boolean; }

export function FormField({ label, horizontal = false, className, id, ...props }: FormFieldProps) {
  const fieldClass = `${styles.field} ${horizontal ? styles.horizontal : ''} ${className || ''}`;
  return (
    <div className={fieldClass}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <input className={styles.input} id={id} {...props} />
    </div>
  );
}
