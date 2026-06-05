import { useState, useEffect } from 'react';
import { api } from '../../../shared/api';
import { Tabs, SearchField } from '../components/ui';
import { ContentCard } from '../components/features';
import styles from './MarketplacePage.module.css';

export default function MarketplacePage() {
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('modrinth');

  useEffect(() => {
    async function fetchPopular() {
      try {
        const data =
          tab === 'modrinth'
            ? await api.getPopularMods()
            : await api.getCfFeatured();
        setResults(data || []);
      } catch (e) {
        console.error('Failed to fetch:', e);
      }
    }
    fetchPopular();
  }, [tab]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    try {
      const data =
        tab === 'modrinth'
          ? await api.searchMods(q)
          : await api.searchCfMods(q);
      setResults(data || []);
    } catch (e) {
      console.error('Search failed:', e);
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
      <div className={styles.grid}>
        {results.map((item: any) => (
          <ContentCard
            key={item.slug || item.id}
            title={item.title || item.name}
            description={item.description}
            imageUrl={item.icon_url || item.logo?.url}
            author={item.author}
            downloads={item.downloads}
            categories={item.categories}
            onClick={() =>
              (window.location.hash = `#/store/mod/${item.slug || item.id}`)
            }
          />
        ))}
      </div>
    </div>
  );
}
