import { useReducer, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeader } from '../components/layout';
import TypeTabs from '../components/marketplace/TypeTabs';
import FilterBar from '../components/marketplace/FilterBar';
import SubViewSwitch from '../components/marketplace/SubViewSwitch';
import DiscoverView from '../components/marketplace/DiscoverView';
import ResultsView from '../components/marketplace/ResultsView';
import { Skeleton } from '../components/ui/Skeleton';
import {
  marketplaceReducer,
  INITIAL_STATE,
  type ContentType,
  type DataSource,
  type SubView,
  type ViewMode,
} from '../components/marketplace/types';
import { useConfig } from '../stores/configStore';
import { useInstances } from '../stores/instanceStore';
import { api } from '../api';
import styles from './MarketplacePage.module.css';
import badgeStyles from '../components/ui/Status.module.css';

interface RecommendationItem {
  slug: string;
  name: string;
  reason: string;
  category: string;
}

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(marketplaceReducer, INITIAL_STATE);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const { state: configState } = useConfig();
  const { state: instanceState } = useInstances();

  const instanceId = configState.config?.selected_instance || instanceState.instances[0]?.id || null;

  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    setRecsLoading(true);
    api
      .getRecommendations(instanceId)
      .then((recs) => {
        if (!cancelled) {
          setRecommendations(recs);
          setRecsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const handleTabChange = useCallback((tab: ContentType) => {
    dispatch({ type: 'SET_TAB', payload: tab });
  }, []);

  const handleSubViewChange = useCallback((view: SubView) => {
    dispatch({ type: 'SET_SUB_VIEW', payload: view });
  }, []);

  const handleSourceChange = useCallback((source: DataSource) => {
    dispatch({ type: 'SET_SOURCE', payload: source });
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const handleSearchSubmit = useCallback(() => {
    dispatch({ type: 'SEARCH_TRIGGERED' });
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    dispatch({ type: 'TOGGLE_TAG', payload: tag });
  }, []);

  const handleClearTags = useCallback(() => {
    dispatch({ type: 'CLEAR_TAGS' });
  }, []);

  const handleVersionChange = useCallback((version: string) => {
    dispatch({ type: 'SET_VERSION', payload: version });
  }, []);

  const handleLoaderChange = useCallback((loader: string) => {
    dispatch({ type: 'SET_LOADER', payload: loader });
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    dispatch({ type: 'SET_SORT', payload: sort });
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  const handleNavigate = useCallback(
    (slug: string) => {
      const sourceParam = state.source === 'curseforge' ? '?source=curseforge' : '';
      navigate(`/store/${state.activeTab}/${slug}${sourceParam}`);
    },
    [state.source, state.activeTab],
  );

  return (
    <div className={styles.page}>
      <SectionHeader title="MARKETPLACE" subtitle="Discover and install Minecraft content" />

      {(recsLoading || recommendations.length > 0) && (
        <div className={styles.recommendations}>
          <div className={styles.recommendations__header}>
            <span className={styles.recommendations__title}>RECOMMENDED FOR YOU</span>
          </div>
          <div className={styles.recommendations__row}>
            {recsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={styles.recommendations__card}>
                    <Skeleton variant="title" />
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="text" width="50px" />
                  </div>
                ))
              : recommendations.map((rec) => (
                  <button
                    key={rec.slug}
                    className={styles.recommendations__card}
                    onClick={() => {
                      navigate(`/store/mod/${rec.slug}`);
                    }}
                  >
                    <div className={styles.recommendations__cardName}>{rec.name}</div>
                    <div className={styles.recommendations__cardReason}>{rec.reason}</div>
                    <span
                      className={`${badgeStyles.badge} ${badgeStyles['badge--accent']} ${styles.recommendations__cardBadge}`}
                    >
                      {rec.category}
                    </span>
                  </button>
                ))}
          </div>
        </div>
      )}

      <TypeTabs activeTab={state.activeTab} onTabChange={handleTabChange} />

      <FilterBar
        contentType={state.activeTab}
        source={state.source}
        searchQuery={state.searchQuery}
        selectedTags={state.selectedTags}
        gameVersion={state.gameVersion}
        loader={state.loader}
        sortBy={state.sortBy}
        onSourceChange={handleSourceChange}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onTagToggle={handleTagToggle}
        onClearTags={handleClearTags}
        onVersionChange={handleVersionChange}
        onLoaderChange={handleLoaderChange}
        onSortChange={handleSortChange}
      />

      <SubViewSwitch
        subView={state.subView}
        viewMode={state.viewMode}
        onSubViewChange={handleSubViewChange}
        onViewModeChange={handleViewModeChange}
      />

      {state.subView === 'discover' ? (
        <DiscoverView contentType={state.activeTab} source={state.source} onNavigate={handleNavigate} />
      ) : (
        <ResultsView
          contentType={state.activeTab}
          source={state.source}
          searchQuery={state.searchQuery}
          selectedTags={state.selectedTags}
          gameVersion={state.gameVersion}
          loader={state.loader}
          sortBy={state.sortBy}
          viewMode={state.viewMode}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
