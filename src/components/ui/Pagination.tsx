import React from 'react';
import styles from './Pagination.module.css';

interface PaginationProps {
  current: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ current, total, onPage, className = '' }) => {
  if (total <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= Math.min(total, 7); i++) {
    pages.push(i);
  }
  if (total > 7) {
    pages.push(-1);
    pages.push(total);
  }

  return (
    <div className={`${styles.pagination} ${className}`}>
      <button
        className={styles.page}
        disabled={current <= 1}
        onClick={() => onPage(current - 1)}
      >
        ‹
      </button>
      {pages.map((p) =>
        p === -1 ? (
          <span key="ellipsis" style={{ color: '#444', padding: '0 4px' }}>
            ...
          </span>
        ) : (
          <button
            key={p}
            className={`${styles.page} ${p === current ? styles['page--active'] : ''}`}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        className={styles.page}
        disabled={current >= total}
        onClick={() => onPage(current + 1)}
      >
        ›
      </button>
    </div>
  );
};
