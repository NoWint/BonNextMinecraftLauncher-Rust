import { useState, useEffect, useRef } from 'react';
import { type ModResult } from '../../../../shared/api';
import { logger } from '../../../../shared/utils/logger';
import { useI18n } from '../../../../shared/i18n';
import { SectionHeader } from '../layout';
import { Button, ContentCard, contentFromModResult, CollectionButton } from '../ui';
import { CardSkeleton } from '../ui/Skeleton';
import type { ContentType, DataSource } from './types';
import { getDiscoverData } from './contentSource';
import styles from './DiscoverView.module.css';

interface DiscoverViewProps {
  contentType: ContentType;
  source: DataSource;
  onNavigate: (slug: string) => void;
}

export default function DiscoverView({ contentType, source, onNavigate }: DiscoverViewProps) {
  const { t } = useI18n();
  const [featured, setFeatured] = useState<ModResult[]>([]);
  const [trending, setTrending] = useState<ModResult[]>([]);
  const [recent, setRecent] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDiscoverData(source, contentType);
        if (!cancelled) {
          setFeatured(data.featured);
          setTrending(data.trending);
          setRecent(data.recent);
        }
      } catch (e) {
        if (!cancelled) {
          logger.error('Failed to load discover data:', e);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [contentType, source]);

  useEffect(() => {
    if (featured.length <= 1) return;

    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        setFeaturedIndex((i) => (i + 1) % featured.length);
      }, 5000);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    // 页面隐藏时暂停轮播,可见时恢复,避免后台耗电与 race condition
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
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

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.error__message}>{error}</div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setError(null);
            setLoading(true);
            getDiscoverData(source, contentType)
              .then((data) => {
                setFeatured(data.featured);
                setTrending(data.trending);
                setRecent(data.recent);
              })
              .catch((e) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setLoading(false));
          }}
        >
          {t('common.retry')}
        </Button>
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
                <div className={styles.banner__author}>{t('contentCard.by', { author: item.author })}</div>
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
                    {t('marketplace.view')}
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
            <SectionHeader title={t('marketplace.trending')} />
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
            <SectionHeader title={t('marketplace.recentlyUpdated')} />
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
