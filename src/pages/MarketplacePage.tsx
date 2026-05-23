import { useReducer, useCallback } from 'react';
import { SectionHeader } from '../components/layout';
import TypeTabs from '../components/marketplace/TypeTabs';
import FilterBar from '../components/marketplace/FilterBar';
import SubViewSwitch from '../components/marketplace/SubViewSwitch';
import DiscoverView from '../components/marketplace/DiscoverView';
import ResultsView from '../components/marketplace/ResultsView';
import {
  marketplaceReducer, INITIAL_STATE, PAGE_SIZE,
  type ContentType, type DataSource, type SubView, type ViewMode,
} from '../components/marketplace/types';
import styles from './MarketplacePage.module.css';

export default function MarketplacePage() {
  const [state, dispatch] = useReducer(marketplaceReducer, INITIAL_STATE);
  const [totalHits, setTotalHits] = useReducer((_s: number, a: number) => a, 0);

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

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  const handleNavigate = useCallback((slug: string) => {
    const sourceParam = state.source === 'curseforge' ? '?source=curseforge' : '';
    window.location.hash = `#/store/${state.activeTab}/${slug}${sourceParam}`;
  }, [state.source, state.activeTab]);

  return (
    <div className={`page-enter ${styles.page}`}>
      <SectionHeader title="MARKETPLACE" subtitle="Discover and install Minecraft content" />

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
        page={state.page}
        pageSize={PAGE_SIZE}
        totalHits={totalHits}
        onSubViewChange={handleSubViewChange}
        onViewModeChange={handleViewModeChange}
      />

      {state.subView === 'discover' ? (
        <DiscoverView
          contentType={state.activeTab}
          source={state.source}
          onNavigate={handleNavigate}
        />
      ) : (
        <ResultsView
          contentType={state.activeTab}
          source={state.source}
          searchQuery={state.searchQuery}
          selectedTags={state.selectedTags}
          gameVersion={state.gameVersion}
          loader={state.loader}
          sortBy={state.sortBy}
          page={state.page}
          viewMode={state.viewMode}
          onPageChange={handlePageChange}
          onNavigate={handleNavigate}
          onTotalHitsChange={setTotalHits}
        />
      )}
    </div>
  );
}
