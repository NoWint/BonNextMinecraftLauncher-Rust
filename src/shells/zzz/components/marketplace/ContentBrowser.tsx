/**
 * ContentBrowser - 可复用的内容浏览器组件
 *
 * 封装 FilterBar + SubViewSwitch + DiscoverView/ResultsView，
 * 通过 contentType prop 驱动，自带状态管理。
 * 用于 VersionsPage 下载中心的内容标签页（模组/资源包/光影/世界/整合包）。
 */
import { useReducer, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterBar from './FilterBar';
import SubViewSwitch from './SubViewSwitch';
import DiscoverView from './DiscoverView';
import ResultsView from './ResultsView';
import {
  marketplaceReducer,
  INITIAL_STATE,
  type ContentType,
  type DataSource,
  type SubView,
  type ViewMode,
} from './types';

interface ContentBrowserProps {
  contentType: ContentType;
  /** 是否显示 Discover/Results 子视图切换器，默认 true */
  showSubViewSwitch?: boolean;
}

export default function ContentBrowser({ contentType, showSubViewSwitch = true }: ContentBrowserProps) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(marketplaceReducer, {
    ...INITIAL_STATE,
    activeTab: contentType,
    subView: 'results',
  });

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

  const handleSubViewChange = useCallback((view: SubView) => {
    dispatch({ type: 'SET_SUB_VIEW', payload: view });
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  const handleNavigate = useCallback(
    (slug: string) => {
      const sourceParam = state.source === 'curseforge' ? '?source=curseforge' : '';
      navigate(`/store/${contentType}/${slug}${sourceParam}`);
    },
    [state.source, contentType, navigate],
  );

  return (
    <>
      <FilterBar
        contentType={contentType}
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

      {showSubViewSwitch && (
        <SubViewSwitch
          subView={state.subView}
          viewMode={state.viewMode}
          onSubViewChange={handleSubViewChange}
          onViewModeChange={handleViewModeChange}
        />
      )}

      {state.subView === 'discover' ? (
        <DiscoverView contentType={contentType} source={state.source} onNavigate={handleNavigate} />
      ) : (
        <ResultsView
          contentType={contentType}
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
    </>
  );
}
