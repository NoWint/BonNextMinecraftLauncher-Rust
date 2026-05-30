import { Icon, type IconName } from './Icon';
import styles from './StatBadge.module.css';

interface StatBadgeProps {
  icon: IconName;
  value: string;
  label?: string;
  variant?: 'default' | 'accent';
}

export function StatBadge({ icon, value, label, variant = 'default' }: StatBadgeProps) {
  const variantClass = variant === 'accent' ? styles['badge--accent'] : '';

  return (
    <span className={`${styles.badge} ${variantClass}`}>
      <span className={styles.badge__icon}>
        <Icon name={icon} size={14} />
      </span>
      <span>{value}</span>
      {label && <span className={styles.badge__label}>{label}</span>}
    </span>
  );
}
