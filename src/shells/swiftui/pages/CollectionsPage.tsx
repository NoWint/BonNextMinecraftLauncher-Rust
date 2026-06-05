import { useState, useEffect } from 'react';
import { api } from '../../../shared/api';
import { ContentCard } from '../components/features';
import styles from './CollectionsPage.module.css';

export default function CollectionsPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    async function fetch() {
      try { const data = await api.listCollection(); setItems(data || []); } catch (e) { console.error('Failed to fetch collections:', e); }
    }
    fetch();
  }, []);

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Collections</h1>
      <p className="swiftui-page-subtitle">Your saved and wishlisted items</p>
      {items.length > 0 ? (
        <div className={styles.grid}>
          {items.map((item: any) => (
            <ContentCard key={item.slug || item.id} title={item.title || item.name} description={item.description} imageUrl={item.icon_url} onClick={() => { window.location.hash = `#/store/mod/${item.slug || item.id}`; }} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>No items in your collection yet</div>
      )}
    </div>
  );
}
