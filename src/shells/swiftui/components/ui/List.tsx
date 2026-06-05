import type { ReactNode } from 'react';
import styles from './List.module.css';

interface ListGroupProps { label?: string; children: ReactNode; }
export function ListGroup({ label, children }: ListGroupProps) {
  return (
    <div className={styles.group}>
      {label && <div className={styles.groupLabel}>{label}</div>}
      <div className={styles.list}>{children}</div>
    </div>
  );
}

interface ListItemProps { icon?: ReactNode; label: ReactNode; value?: ReactNode; onClick?: () => void; }
export function ListItem({ icon, label, value, onClick }: ListItemProps) {
  return (
    <div className={styles.item} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemLabel}>{label}</span>
      {value && <span className={styles.itemValue}>{value}</span>}
    </div>
  );
}
