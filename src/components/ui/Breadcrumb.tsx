import React from 'react';
import styles from './Breadcrumb.module.css';

interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => (
  <div className={`${styles.breadcrumb} ${className}`}>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className={styles.separator}>▸</span>}
        {i === items.length - 1 ? (
          <span className={`${styles.crumb} ${styles['crumb--active']}`}>{item.label}</span>
        ) : (
          <button
            className={styles.crumb}
            onClick={() => item.href && (window.location.hash = item.href)}
          >
            {item.label}
          </button>
        )}
      </React.Fragment>
    ))}
  </div>
);
