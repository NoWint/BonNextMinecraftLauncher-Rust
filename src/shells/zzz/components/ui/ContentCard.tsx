import { memo } from 'react';
import { type ModResult } from '../../shared/api';
import { Badge } from './Status';
import { Button } from './Button';
import { CollectionButton } from './CollectionButton';
import { Tooltip } from './Tooltip';
import styles from './ContentCard.module.css';

export interface ContentCardData {
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url: string;
  categories: string[];
  downloads: number;
  latest_version: string | null;
  date_modified: string;
  project_type?: string;
}

interface ContentCardProps {
  content: ContentCardData;
  variant?: 'list' | 'gallery';
  onInstall?: () => void;
  onNavigate?: (slug: string) => void;
  installing?: boolean;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const ContentCard = memo(function ContentCard({
  content,
  variant = 'list',
  onInstall,
  onNavigate,
  installing,
}: ContentCardProps) {
  const variantClass = variant === 'gallery' ? styles['card--gallery'] : styles['card--list'];

  const handleClick = () => {
    if (onNavigate) onNavigate(content.slug);
  };

  const handleInstall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInstall) onInstall();
  };

  const icon = content.icon_url ? (
    <img
      className={styles.card__iconImg}
      src={content.icon_url}
      alt=""
      loading="lazy"
    />
  ) : (
    <span className={styles.card__iconFallback}>?</span>
  );

  return (
    <div
      className={`${styles.card} ${variantClass}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      <div className={styles.card__icon}>{icon}</div>

      <div className={styles.card__body}>
        <div className={styles.card__titleRow}>
          <span className={styles.card__title}>{content.title}</span>
          <Badge variant="accent">{formatDownloads(content.downloads)}</Badge>
          {content.categories.slice(0, 2).map((cat) => (
            <Badge key={cat} variant="muted">{cat}</Badge>
          ))}
        </div>
        <div className={styles.card__author}>by {content.author}</div>
        <div className={styles.card__desc}>{content.description}</div>
        {variant === 'list' && (
          <div className={styles.card__meta}>
            {content.latest_version && (
              <Badge variant="accent">{content.latest_version}</Badge>
            )}
            <span style={{ fontSize: '0.48em', color: 'var(--color-text-dim)' }}>
              Updated {new Date(content.date_modified).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      <div className={styles.card__actions} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <CollectionButton
          slug={content.slug}
          title={content.title}
          author={content.author}
          iconUrl={content.icon_url}
          contentType={content.project_type || 'mod'}
          description={content.description}
          downloads={content.downloads}
          categories={content.categories}
        />
        {onInstall && (
          <Tooltip content={`Install ${content.title}`}>
            <Button
              variant="secondary-highlight"
              size="sm"
              disabled={installing}
              onClick={handleInstall}
            >
              {installing ? '...' : 'Install'}
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
});

export function contentFromModResult(mod: ModResult): ContentCardData {
  return {
    slug: mod.slug,
    title: mod.title,
    description: mod.description,
    author: mod.author,
    icon_url: mod.icon_url,
    categories: mod.categories,
    downloads: mod.downloads,
    latest_version: mod.latest_version,
    date_modified: mod.date_modified,
  };
}
