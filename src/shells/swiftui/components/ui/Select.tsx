import type { SelectHTMLAttributes } from 'react';
import { ChevronIcon } from '../icons';
import styles from './Select.module.css';

interface SelectOption { value: string; label: string; }
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> { options: SelectOption[]; }

export function Select({ options, className, ...props }: SelectProps) {
  return (
    <div className={styles.select}>
      <select className={`${styles.selectInput} ${className || ''}`} {...props}>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <span className={styles.chevron}><ChevronIcon size={12} direction="down" /></span>
    </div>
  );
}
