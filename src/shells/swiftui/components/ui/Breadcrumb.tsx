import { ChevronIcon } from '../icons';
import styles from './Breadcrumb.module.css';

interface Crumb { label: string; onClick?: () => void; }
interface BreadcrumbProps { crumbs: Crumb[]; }

export function Breadcrumb({ crumbs }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb}>
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <ChevronIcon size={10} direction="right" className={styles.separator} />}
          <button className={`${styles.crumb} ${i === crumbs.length - 1 ? styles.current : ''}`} onClick={crumb.onClick} disabled={!crumb.onClick}>{crumb.label}</button>
        </span>
      ))}
    </nav>
  );
}
