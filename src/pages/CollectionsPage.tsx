import { useState, useEffect, useCallback } from 'react';
import { api, type CollectionItem } from '../api';
import { useI18n } from '../i18n';
import { SectionHeader, Ticker } from '../components/layout';
import { Button, ContentCard, Tabs } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './CollectionsPage.module.css';

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
  icon: string;
}

const ACHIEVEMENT_ICON_FALLBACK = '\u{1F3C6}';

export default function CollectionsPage() {
  const { t } = useI18n();
  const TYPE_TABS = [
    { id: 'all', label: t('versions.all') },
    { id: 'mod', label: t('instanceDetail.mods') },
    { id: 'modpack', label: t('store.modpacks') },
    { id: 'resourcepack', label: t('store.resourcePacks') },
    { id: 'shader', label: t('store.shaders') },
  ];
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listCollection());
    } catch (e) {
      console.error('Failed to load collections:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getAchievements().then((list) => {
      setAchievements(list);
    }).catch(() => {}).finally(() => setAchievementsLoading(false));
  }, []);

  const filtered = filter === 'all'
    ? items
    : items.filter((i) => i.content_type === filter);

  return (
    <div className={`page-enter ${styles.page}`}>
      <SectionHeader title="MY COLLECTION" subtitle={`${items.length} ${t('common.installed')}`} />

      <Tabs tabs={TYPE_TABS} activeId={filter} onChange={setFilter} />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyState__icon}>{'\u{2661}'}</div>
          <div className={styles.emptyState__title}>
            {items.length === 0 ? `${t('collections.empty')}` : `${t('instances.noMatch')}`}
          </div>
          <div className={styles.emptyState__desc}>
            {items.length === 0
              ? t('collections.emptyDesc')
              : t('collections.tryDifferent')}
          </div>
          {items.length === 0 && (
            <Button variant="primary" size="md" onClick={() => (window.location.hash = '#/store')}>
              {t('collections.browseMarketplace')}
            </Button>
          )}
        </div>
      ) : (
        <div className={styles.listView}>
          {filtered.map((item) => ({
            ...item,
            latest_version: null as string | null,
            date_modified: item.added_at,
          })).map((content) => (
            <ContentCard
              key={content.slug}
              content={{
                slug: content.slug,
                title: content.title,
                description: content.description,
                author: content.author,
                icon_url: content.icon_url,
                categories: content.categories,
                downloads: content.downloads,
                latest_version: null,
                date_modified: content.added_at,
                project_type: content.content_type,
              }}
              variant="list"
              onNavigate={(slug) => {
                window.location.hash = `#/store/${content.content_type}/${slug}`;
              }}
            />
          ))}
        </div>
      )}

      <div className={styles.footerTicker}>
        <Ticker messages={[
          `Saved ${items.length} items to collection`,
          'Collections are stored locally',
          'Click the heart icon to save or remove items',
        ]} />
      </div>

      <div className={styles.achievementsSection}>
        <div className={styles.achievementsSection__header}>
          <div className={styles.achievementsSection__bar} />
          <span className={styles.achievementsSection__title}>ACHIEVEMENTS</span>
        </div>
        {achievementsLoading ? (
          <div className={styles.achievementsSection__loading}>Loading achievements...</div>
        ) : (
          <div className={styles.achievementsGrid}>
            {achievements.map((a) => (
              <div
                key={a.id}
                className={`${styles.achievementCard} ${a.unlocked ? styles['achievementCard--unlocked'] : styles['achievementCard--locked']}`}
              >
                <div className={styles.achievementCard__icon}>
                  {a.icon || ACHIEVEMENT_ICON_FALLBACK}
                </div>
                <div className={styles.achievementCard__info}>
                  <div className={styles.achievementCard__name}>{a.name}</div>
                  <div className={styles.achievementCard__desc}>{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
