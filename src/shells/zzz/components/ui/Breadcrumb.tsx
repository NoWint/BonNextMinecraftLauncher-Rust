import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './Breadcrumb.module.css';

export interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  const navigate = useNavigate();

  return (
    <div className={`${styles.breadcrumb} ${className}`}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className={styles.separator}>
              <Icon name="bulletRight" size={10} />
            </span>
          )}
          {i === items.length - 1 ? (
            <span className={`${styles.crumb} ${styles['crumb--active']}`}>{item.label}</span>
          ) : (
            <button className={styles.crumb} onClick={() => item.href && navigate(item.href)}>
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
