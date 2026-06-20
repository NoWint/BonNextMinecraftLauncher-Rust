import type { InputHTMLAttributes } from 'react';
import { SearchIcon } from '../icons';
import styles from './SearchField.module.css';

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {}

export function SearchField({ className, ...props }: SearchFieldProps) {
  return (
    <div className={styles.searchField} role="search">
      <span className={styles.searchIcon}><SearchIcon size={14} /></span>
      <input className={`${styles.input} ${className || ''}`} type="search" aria-label="Search" {...props} />
    </div>
  );
}
