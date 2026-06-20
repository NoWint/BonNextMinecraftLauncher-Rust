import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api';
import type { ModResult, CollectionItem } from '../../../shared/api/types';
import { Tabs, SearchField } from '../components/ui';
import { Skeleton } from '../components/ui/Skeleton';
import { ContentCard } from '../components/features';
import { useToast } from '../../../shared/stores/toastStore';
import styles from './MarketplacePage.module.css';

type MarketplaceItem = ModResult | CollectionItem;

function getContentType(item: MarketplaceItem): string {
  if ('project_type' in item && item.project_type) return item.project_type;
  if ('content_type' in item && item.content_type) return item.content_type;
  return 'mod';
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [results, setResults] = useState<MarketplaceItem[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('modrinth');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPopular() {
      setLoading(true);
      try {
        const data =
          tab === 'modrinth'
            ? await api.getPopularMods()
            : await api.getCfFeatured();
        setResults(data || []);
      } catch (e) {
        addToast({ type: 'error', title: 'Failed to load content', message: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    }
    fetchPopular();
  }, [tab]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      let searchResults: ModResult[];
      if (tab === 'modrinth') {
        const [mods] = await api.searchMods(q);
        searchResults = mods;
      } else {
        const result = await api.searchCfMods(q);
        searchResults = result[0];
      }
      setResults(searchResults || []);
    } catch (e) {
      addToast({ type: 'error', title: 'Search failed', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Store</h1>
      <p className="swiftui-page-subtitle">Discover mods, resource packs, and more</p>
      <div style={{ marginBottom: 'var(--swift-spacing-lg)' }}>
        <SearchField
          placeholder="Search content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch(query);
          }}
        />
      </div>
      <Tabs
        tabs={[
          { id: 'modrinth', label: 'Modrinth', content: null },
          { id: 'curseforge', label: 'CurseForge', content: null },
        ]}
        onChange={(id) => setTab(id)}
      />
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
      ) : (
        <div className={styles.grid}>
          {results.map((item: MarketplaceItem) => (
            <ContentCard
              key={item.slug}
              title={item.title}
              description={item.description}
              imageUrl={item.icon_url}
              author={item.author}
              downloads={item.downloads}
              categories={item.categories}
              onClick={() => navigate(`/store/${getContentType(item)}/${item.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
