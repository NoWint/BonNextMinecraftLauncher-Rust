import { useState, useEffect, useRef } from 'react';
import { api, type ModResult } from '../api';
import { SectionHeader, Ticker } from '../components/layout';
import { Button, ContentCard, contentFromModResult, CategoryCard, CollectionButton } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './StorePage.module.css';

const CATEGORIES = [
  { id: 'mod', label: 'MODS', icon: '\u{1F9F5}', description: 'Gameplay mods, libraries, and utilities' },
  { id: 'modpack', label: 'MODPACKS', icon: '\u{1F4E6}', description: 'Curated mod collections and quests' },
  { id: 'resourcepack', label: 'RESOURCE PACKS', icon: '\u{1F3A8}', description: 'Textures, fonts, and visual overhauls' },
  { id: 'shader', label: 'SHADERS', icon: '\u{2728}', description: 'Lighting, shadows, and post-processing' },
  { id: 'datapack', label: 'DATA PACKS', icon: '\u{1F4BF}', description: 'Vanilla-friendly gameplay tweaks' },
  { id: 'plugin', label: 'PLUGINS', icon: '\u{2699}', description: 'Server-side plugins and tools' },
];

export default function StorePage() {
  const [featured, setFeatured] = useState<ModResult[]>([]);
  const [trending, setTrending] = useState<ModResult[]>([]);
  const [recent, setRecent] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [t, r] = await Promise.all([
          api.getTrendingContent('mod', undefined, 10),
          api.getRecentlyUpdated(undefined, 10),
        ]);
        if (!cancelled) {
          setTrending(t);
          setFeatured(t.slice(0, 5)); // Use top 5 as featured banner items
          setRecent(r);
        }
      } catch (e) {
        console.error('Failed to load store data:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate banner
  useEffect(() => {
    if (featured.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % featured.length);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [featured.length]);

  const handleCategoryClick = (id: string) => {
    window.location.hash = `#/mods?type=${id}`;
  };

  const handleBannerClick = (slug: string) => {
    window.location.hash = `#/store/mod/${slug}`;
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <SectionHeader title="MARKETPLACE" subtitle="Discover Minecraft content" />
        <div className={styles.loadingGrid}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={`page-enter ${styles.page}`}>
      <SectionHeader title="MARKETPLACE" subtitle="Discover and install Minecraft content" />

      {/* Featured Banner */}
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
                    contentType="mod"
                    description={item.description}
                    downloads={item.downloads}
                    categories={item.categories}
                    size="md"
                  />
                  <Button variant="primary" size="md" onClick={() => handleBannerClick(item.slug)}>
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

      {/* Category Grid */}
      <div>
        <SectionHeader title="BROWSE BY CATEGORY" />
        <div className={styles.categories}>
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              label={cat.label}
              icon={cat.icon}
              description={cat.description}
              onClick={handleCategoryClick}
            />
          ))}
        </div>
      </div>

      {/* Trending This Week */}
      {trending.length > 0 && (
        <div className={styles.row}>
          <div className={styles.row__header}>
            <SectionHeader title="TRENDING THIS WEEK" />
            <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/mods')}>
              View All
            </Button>
          </div>
          <div className={styles.row__scroll}>
            {trending.map((mod) => (
              <ContentCard
                key={mod.slug}
                content={contentFromModResult(mod)}
                variant="gallery"
                onNavigate={(slug) => { window.location.hash = `#/store/mod/${slug}`; }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Updated */}
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
                onNavigate={(slug) => { window.location.hash = `#/store/mod/${slug}`; }}
              />
            ))}
          </div>
        </div>
      )}

      <Ticker messages={[
        'All content via Modrinth · Open source modding platform',
        'Install with one click · Automatic dependency handling',
        'New content added daily · Stay tuned for updates',
      ]} />
    </div>
  );
}
