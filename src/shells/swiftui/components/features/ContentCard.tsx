import { Badge } from '../ui';
import styles from './ContentCard.module.css';

interface ContentCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  author?: string;
  downloads?: number;
  categories?: string[];
  variant?: 'gallery' | 'list';
  onClick?: () => void;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContentCard({ title, description, imageUrl, author, downloads, categories, variant = 'gallery', onClick }: ContentCardProps) {
  return (
    <div className={`${styles.card} ${variant === 'list' ? styles.listCard : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {imageUrl && <img className={styles.image} src={imageUrl} alt={title} loading="lazy" />}
      <div className={styles.info}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
        <div className={styles.meta}>
          {author && <span>by {author}</span>}
          {downloads !== undefined && <span>{formatDownloads(downloads)} downloads</span>}
          {categories?.[0] && <Badge variant="default">{categories[0]}</Badge>}
        </div>
      </div>
    </div>
  );
}
