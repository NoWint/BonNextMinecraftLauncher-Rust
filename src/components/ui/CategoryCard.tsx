import styles from './CategoryCard.module.css';

interface CategoryCardProps {
  id: string;
  label: string;
  icon: string;
  description: string;
  contentCount?: number;
  onClick: (id: string) => void;
}

export function CategoryCard({ id, label, icon, description, contentCount, onClick }: CategoryCardProps) {
  return (
    <div
      className={styles.card}
      onClick={() => onClick(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(id); }}
    >
      <div className={styles.card__icon}>{icon}</div>
      <div className={styles.card__label}>{label}</div>
      <div className={styles.card__desc}>{description}</div>
      {contentCount !== undefined && (
        <div className={styles.card__count}>{contentCount.toLocaleString()} items</div>
      )}
    </div>
  );
}
