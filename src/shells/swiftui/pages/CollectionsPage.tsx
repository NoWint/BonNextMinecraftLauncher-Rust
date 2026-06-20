import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api';
import type { CollectionItem } from '../../../shared/api/types';
import { Skeleton } from '../components/ui/Skeleton';
import { ContentCard } from '../components/features';
import { useToast } from '../../../shared/stores/toastStore';
import styles from './CollectionsPage.module.css';

export default function CollectionsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const data = await api.listCollection();
        setItems(data || []);
      } catch (e) {
        addToast({ type: 'error', title: 'Failed to load collections', message: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [addToast]);

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Collections</h1>
      <p className="swiftui-page-subtitle">Your saved and wishlisted items</p>
      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--swift-spacing-sm)' }}>
              <Skeleton variant="rect" className={styles.skeletonCard} />
              <Skeleton variant="title" />
              <Skeleton variant="text" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className={styles.grid}>
          {items.map((item: CollectionItem) => (
            <ContentCard key={item.slug} title={item.title} description={item.description} imageUrl={item.icon_url} onClick={() => navigate(`/store/mod/${item.slug}`)} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>No items in your collection yet</div>
      )}
    </div>
  );
}
