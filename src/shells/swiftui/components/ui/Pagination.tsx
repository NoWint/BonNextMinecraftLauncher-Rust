import { ChevronIcon } from '../icons';
import styles from './Pagination.module.css';

interface PaginationProps { current: number; total: number; onPageChange: (page: number) => void; }

export function Pagination({ current, total, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className={styles.pagination} role="navigation" aria-label="Pagination">
      <button className={styles.pageButton} onClick={() => onPageChange(current - 1)} disabled={current <= 1}><ChevronIcon size={14} direction="left" /></button>
      {pages.map((p) => <button key={p} className={`${styles.pageButton} ${p === current ? styles.active : ''}`} onClick={() => onPageChange(p)}>{p}</button>)}
      <button className={styles.pageButton} onClick={() => onPageChange(current + 1)} disabled={current >= total}><ChevronIcon size={14} direction="right" /></button>
    </div>
  );
}
