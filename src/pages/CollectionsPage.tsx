import { useState, useEffect, useCallback } from 'react';
import { api, type CollectionItem } from '../api';
import { SectionHeader, Ticker } from '../components/layout';
import { Button, ContentCard, Tabs } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './ModsPage.module.css';

const TYPE_TABS = [
  { id: 'all', label: 'ALL' },
  { id: 'mod', label: 'MODS' },
  { id: 'modpack', label: 'MODPACKS' },
  { id: 'resourcepack', label: 'RESOURCE PACKS' },
  { id: 'shader', label: 'SHADERS' },
];

export default function CollectionsPage() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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

  const filtered = filter === 'all'
    ? items
    : items.filter((i) => i.content_type === filter);

  return (
    <div className={`page-enter ${styles.page}`}>
      <SectionHeader title="MY COLLECTION" subtitle={`${items.length} saved items`} />

      <Tabs tabs={TYPE_TABS} activeId={filter} onChange={setFilter} />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyState__icon}>{'\u{2661}'}</div>
          <div className={styles.emptyState__title}>
            {items.length === 0 ? 'NO SAVED ITEMS' : 'NO ITEMS IN THIS CATEGORY'}
          </div>
          <div className={styles.emptyState__desc}>
            {items.length === 0
              ? 'Click the heart icon on any content to save it to your collection.'
              : 'Try selecting a different category.'}
          </div>
          {items.length === 0 && (
            <Button variant="primary" size="md" onClick={() => (window.location.hash = '#/store')}>
              Browse Marketplace
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
    </div>
  );
}
