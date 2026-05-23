import { useState, useEffect, useRef } from 'react';
import { api, type ModResult } from '../../api';
import { SectionHeader } from '../layout';
import { Button, ContentCard, contentFromModResult, CollectionButton } from '../ui';
import { CardSkeleton } from '../ui/Skeleton';
import type { ContentType, DataSource } from './types';
import styles from './DiscoverView.module.css';

interface DiscoverViewProps {
  contentType: ContentType;
  source: DataSource;
  onNavigate: (slug: string) => void;
}

export default function DiscoverView({ contentType, source, onNavigate }: DiscoverViewProps) {
  const [featured, setFeatured] = useState<ModResult[]>([]);
  const [trending, setTrending] = useState<ModResult[]>([]);
  const [recent, setRecent] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (source === 'curseforge') {
          const cfData = await api.getCfFeatured();
          if (!cancelled) {
            setFeatured(cfData.slice(0, 5));
            setTrending(cfData.slice(0, 10));
            setRecent([]);
          }
        } else {
          const [t, r] = await Promise.all([
            api.getTrendingContent(contentType, undefined, 10),
            api.getRecentlyUpdated(contentType, 10),
          ]);
          if (!cancelled) {
            setTrending(t);
            setFeatured(t.slice(0, 5));
            setRecent(r);
          }
        }
      } catch (e) {
        console.error('Failed to load discover data:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [contentType, source]);

  useEffect(() => {
    if (featured.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % featured.length);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [featured.length]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className={styles.view}>
      {featured.length > 0 && (
        <div className={styles.banner}>
          {featured.map((item, i) => (
            <div
              key={item.slug}
              className={`${styles.banner__slide} ${i === featuredIndex ? styles['banner__slide--active'] : ''}`}
            >
              {item.icon_url ? (
                <img className={styles.banner__img} src={item.icon_url} alt="" />
              ) : (
                <div className={styles.banner__imgPlaceholder}>?</div>
              )}
              <div className={styles.banner__body}>
                <div className={styles.banner__title}>{item.title}</div>
                <div className={styles.banner__author}>by {item.author}</div>
                <div className={styles.banner__desc}>{item.description}</div>
                <div className={styles.banner__actions}>
                  <CollectionButton
                    slug={item.slug}
                    title={item.title}
                    author={item.author}
                    iconUrl={item.icon_url}
                    contentType={contentType}
                    description={item.description}
                    downloads={item.downloads}
                    categories={item.categories}
                    size="md"
                  />
                  <Button variant="primary" size="md" onClick={() => onNavigate(item.slug)}>
                    View
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <div className={styles.banner__dots}>
            {featured.map((_, i) => (
              <div
                key={i}
                className={`${styles.banner__dot} ${i === featuredIndex ? styles['banner__dot--active'] : ''}`}
                onClick={() => setFeaturedIndex(i)}
              />
            ))}
          </div>
        </div>
      )}

      {trending.length > 0 && (
        <div className={styles.row}>
          <div className={styles.row__header}>
            <SectionHeader title="TRENDING THIS WEEK" />
          </div>
          <div className={styles.row__scroll}>
            {trending.map((mod) => (
              <ContentCard
                key={mod.slug}
                content={contentFromModResult(mod)}
                variant="gallery"
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className={styles.row}>
          <div className={styles.row__header}>
            <SectionHeader title="RECENTLY UPDATED" />
          </div>
          <div className={styles.row__scroll}>
            {recent.map((mod) => (
              <ContentCard
                key={mod.slug}
                content={contentFromModResult(mod)}
                variant="gallery"
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
