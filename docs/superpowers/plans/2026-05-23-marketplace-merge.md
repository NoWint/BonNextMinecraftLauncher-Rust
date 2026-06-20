# Marketplace 合并页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 StorePage 和 ModsPage 合并为一个 MarketplacePage，支持 6 种内容类型、Discover/Results 双子视图（默认 Results）、Modrinth/CurseForge 双数据源。

**Architecture:** 单页面组件 MarketplacePage 内部用 useReducer 管理全局状态（activeTab、subView、source、search、filters 等），拆分为 TypeTabs、FilterBar、SubViewSwitch、DiscoverView、ResultsView 五个子组件。路由合并为 `#/store`，`#/mods` 重定向。

**Tech Stack:** React 18 + TypeScript + CSS Modules + Tauri IPC

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/pages/MarketplacePage.tsx` | 页面主组件，useReducer 状态管理，组合子组件 |
| `src/pages/MarketplacePage.module.css` | 页面样式 |
| `src/components/marketplace/TypeTabs.tsx` | 6 种内容类型 Tab 栏 |
| `src/components/marketplace/TypeTabs.module.css` | Tab 栏样式 |
| `src/components/marketplace/FilterBar.tsx` | 搜索栏 + 数据源切换 + 标签 + 筛选下拉 |
| `src/components/marketplace/FilterBar.module.css` | 筛选栏样式 |
| `src/components/marketplace/SubViewSwitch.tsx` | Discover/Results 子视图切换 |
| `src/components/marketplace/SubViewSwitch.module.css` | 子视图切换样式 |
| `src/components/marketplace/DiscoverView.tsx` | Discover 子视图（Banner + Trending + Updated） |
| `src/components/marketplace/DiscoverView.module.css` | Discover 样式 |
| `src/components/marketplace/ResultsView.tsx` | Results 子视图（搜索结果 + 分页 + 安装） |
| `src/components/marketplace/ResultsView.module.css` | Results 样式 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 更新 Page 类型、路由解析、NAV_ITEMS、页面渲染 |
| `src/components/layout/Sidebar.tsx` | 无需修改（NAV_ITEMS 由 App 传入） |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/pages/StorePage.tsx` | 被 MarketplacePage 替代 |
| `src/pages/StorePage.module.css` | 被 MarketplacePage.module.css 替代 |
| `src/pages/ModsPage.tsx` | 被 MarketplacePage 替代 |
| `src/pages/ModsPage.module.css` | 被 MarketplacePage.module.css 替代 |
| `src/components/ui/CategoryCard.tsx` | 被 TypeTabs 替代 |
| `src/components/ui/CategoryCard.module.css` | 被 TypeTabs.module.css 替代 |
| `src/components/ui/Ticker.tsx` | 移除底部滚动条 |
| `src/components/ui/Ticker.module.css` | 移除底部滚动条 |

---

### Task 1: 创建类型定义和常量

**Files:**
- Create: `src/components/marketplace/types.ts`

- [ ] **Step 1: 创建类型和常量文件**

```typescript
import type { ModResult } from '../../api';

export type ContentType = 'mod' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'plugin';
export type DataSource = 'modrinth' | 'curseforge';
export type SubView = 'discover' | 'results';
export type ViewMode = 'grid' | 'list';

export interface MarketplaceState {
  activeTab: ContentType;
  subView: SubView;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  page: number;
  viewMode: ViewMode;
}

export type MarketplaceAction =
  | { type: 'SET_TAB'; payload: ContentType }
  | { type: 'SET_SUB_VIEW'; payload: SubView }
  | { type: 'SET_SOURCE'; payload: DataSource }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'TOGGLE_TAG'; payload: string }
  | { type: 'CLEAR_TAGS' }
  | { type: 'SET_VERSION'; payload: string }
  | { type: 'SET_LOADER'; payload: string }
  | { type: 'SET_SORT'; payload: string }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SEARCH_TRIGGERED' };

export const CONTENT_TYPE_TABS: { id: ContentType; label: string; icon: string }[] = [
  { id: 'mod', label: 'MODS', icon: '🧵' },
  { id: 'modpack', label: 'MODPACKS', icon: '📦' },
  { id: 'resourcepack', label: 'RESOURCE PACKS', icon: '🎨' },
  { id: 'shader', label: 'SHADERS', icon: '✨' },
  { id: 'datapack', label: 'DATA PACKS', icon: '💿' },
  { id: 'plugin', label: 'PLUGINS', icon: '⚙' },
];

export const GAME_VERSIONS = [
  '', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
  '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
  '1.19.4', '1.19.2', '1.19', '1.18.2', '1.16.5',
];

export const LOADER_OPTIONS = [
  { value: '', label: 'All loaders' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'forge', label: 'Forge' },
  { value: 'neoforge', label: 'NeoForge' },
  { value: 'quilt', label: 'Quilt' },
];

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Most downloads' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' },
];

export const TAGS_BY_TYPE: Record<ContentType, string[]> = {
  mod: ['optimization', 'tech', 'magic', 'decoration', 'worldgen', 'adventure', 'utility', 'storage'],
  modpack: ['popular', 'kitchen-sink', 'tech', 'magic', 'adventure', 'quests', 'lite', 'vanilla-plus'],
  resourcepack: ['realistic', 'cartoon', 'medieval', 'modern', 'vanilla-like', 'animated', '16x', '32x'],
  shader: ['realistic', 'cartoon', 'fantasy', 'vanilla-plus', 'cinematic', 'performance', 'potato'],
  datapack: ['vanilla-plus', 'game-mechanics', 'worldgen', 'mob', 'recipe', 'quest', 'utility'],
  plugin: ['admin', 'economy', 'chat', 'protection', 'world-management', 'gameplay', 'utility', 'api'],
};

export const PAGE_SIZE = 24;

export const INITIAL_STATE: MarketplaceState = {
  activeTab: 'mod',
  subView: 'results',
  source: 'modrinth',
  searchQuery: '',
  selectedTags: [],
  gameVersion: '',
  loader: '',
  sortBy: 'relevance',
  page: 1,
  viewMode: 'grid',
};

export function marketplaceReducer(state: MarketplaceState, action: MarketplaceAction): MarketplaceState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload, page: 1, searchQuery: '', selectedTags: [], subView: 'results' };
    case 'SET_SUB_VIEW':
      return { ...state, subView: action.payload };
    case 'SET_SOURCE':
      return { ...state, source: action.payload, page: 1 };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'TOGGLE_TAG': {
      const tags = state.selectedTags.includes(action.payload)
        ? state.selectedTags.filter((t) => t !== action.payload)
        : [...state.selectedTags, action.payload];
      return { ...state, selectedTags: tags, page: 1, subView: tags.length > 0 ? 'results' : state.subView };
    }
    case 'CLEAR_TAGS':
      return { ...state, selectedTags: [], page: 1 };
    case 'SET_VERSION':
      return { ...state, gameVersion: action.payload, page: 1, subView: action.payload ? 'results' : state.subView };
    case 'SET_LOADER':
      return { ...state, loader: action.payload, page: 1, subView: action.payload ? 'results' : state.subView };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'CLEAR_FILTERS':
      return { ...INITIAL_STATE, activeTab: state.activeTab, source: state.source, viewMode: state.viewMode };
    case 'SEARCH_TRIGGERED':
      return { ...state, page: 1, selectedTags: [], subView: 'results' };
    default:
      return state;
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误（新文件未被引用，不影响编译）

---

### Task 2: 创建 TypeTabs 组件

**Files:**
- Create: `src/components/marketplace/TypeTabs.tsx`
- Create: `src/components/marketplace/TypeTabs.module.css`

- [ ] **Step 1: 创建 TypeTabs 组件**

```tsx
import { CONTENT_TYPE_TABS, type ContentType } from './types';
import styles from './TypeTabs.module.css';

interface TypeTabsProps {
  activeTab: ContentType;
  onTabChange: (tab: ContentType) => void;
}

export default function TypeTabs({ activeTab, onTabChange }: TypeTabsProps) {
  return (
    <div className={styles.tabs}>
      {CONTENT_TYPE_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles['tab--active'] : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.tab__icon}>{tab.icon}</span>
          <span className={styles.tab__label}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 TypeTabs 样式**

```css
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  font-family: var(--font-body);
  font-size: 0.55em;
  font-weight: 600;
  letter-spacing: 1.5px;
  cursor: pointer;
  clip-path: var(--clip-badge);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tab:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tab--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg);
  font-weight: 700;
}

.tab__icon {
  font-size: 1.1em;
}

.tab__label {
  letter-spacing: 2px;
}
```

---

### Task 3: 创建 FilterBar 组件

**Files:**
- Create: `src/components/marketplace/FilterBar.tsx`
- Create: `src/components/marketplace/FilterBar.module.css`

- [ ] **Step 1: 创建 FilterBar 组件**

```tsx
import { TextInput, Select } from '../ui';
import {
  type ContentType, type DataSource,
  GAME_VERSIONS, LOADER_OPTIONS, SORT_OPTIONS, TAGS_BY_TYPE,
} from './types';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  contentType: ContentType;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  onSourceChange: (source: DataSource) => void;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onTagToggle: (tag: string) => void;
  onClearTags: () => void;
  onVersionChange: (version: string) => void;
  onLoaderChange: (loader: string) => void;
  onSortChange: (sort: string) => void;
}

export default function FilterBar({
  contentType, source, searchQuery, selectedTags,
  gameVersion, loader, sortBy,
  onSourceChange, onSearchChange, onSearchSubmit,
  onTagToggle, onClearTags,
  onVersionChange, onLoaderChange, onSortChange,
}: FilterBarProps) {
  const tags = TAGS_BY_TYPE[contentType] || [];
  const hasActiveFilters = !!(searchQuery || selectedTags.length > 0 || gameVersion || loader);

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchRow}>
        <div className={styles.searchInput}>
          <TextInput
            placeholder={`Search ${contentType}s, modpacks, shaders...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
          />
        </div>
        <div className={styles.sourceToggle}>
          <button
            className={`${styles.sourceBtn} ${source === 'modrinth' ? styles['sourceBtn--active'] : ''}`}
            onClick={() => onSourceChange('modrinth')}
          >
            MODRINTH
          </button>
          <button
            className={`${styles.sourceBtn} ${source === 'curseforge' ? styles['sourceBtn--active'] : ''}`}
            onClick={() => onSourceChange('curseforge')}
          >
            CURSEFORGE
          </button>
        </div>
      </div>

      <div className={styles.tagRow}>
        {tags.map((tag) => (
          <button
            key={tag}
            className={`${styles.tag} ${selectedTags.includes(tag) ? styles['tag--active'] : ''}`}
            onClick={() => onTagToggle(tag)}
          >
            {tag}
          </button>
        ))}
        {hasActiveFilters && (
          <button className={styles.tag} onClick={onClearTags}>
            ✕ Clear filters
          </button>
        )}
      </div>

      <div className={styles.filterRow}>
        <div className={styles.filterSelect}>
          <Select
            value={gameVersion}
            onChange={(e) => onVersionChange(e.target.value)}
            options={[
              { value: '', label: 'All versions' },
              ...GAME_VERSIONS.filter(Boolean).map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={loader}
            onChange={(e) => onLoaderChange(e.target.value)}
            options={LOADER_OPTIONS}
          />
        </div>
        <div className={styles.filterSelect}>
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            options={SORT_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 FilterBar 样式**

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.searchRow {
  display: flex;
  gap: 8px;
  align-items: center;
}

.searchInput {
  flex: 1;
  min-width: 200px;
}

.sourceToggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border-light);
  clip-path: var(--clip-small);
  flex-shrink: 0;
}

.sourceBtn {
  display: flex;
  align-items: center;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  padding: 8px 16px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.58em;
  font-weight: 600;
  letter-spacing: 2px;
  transition: all var(--transition-fast);
}

.sourceBtn:first-child {
  border-right: 1px solid var(--color-border-light);
}

.sourceBtn--active {
  background: var(--color-accent);
  color: var(--color-bg);
}

.sourceBtn:hover:not(.sourceBtn--active) {
  background: var(--color-panel-alt);
  color: var(--color-text);
}

.tagRow {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 5px 12px;
  font-size: 0.55em;
  font-family: var(--font-body);
  font-weight: 500;
  letter-spacing: 1px;
  cursor: pointer;
  clip-path: var(--clip-badge);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tag:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.tag--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg);
  font-weight: 700;
}

.filterRow {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filterSelect {
  width: 140px;
  flex-shrink: 0;
}
```

---

### Task 4: 创建 SubViewSwitch 组件

**Files:**
- Create: `src/components/marketplace/SubViewSwitch.tsx`
- Create: `src/components/marketplace/SubViewSwitch.module.css`

- [ ] **Step 1: 创建 SubViewSwitch 组件**

```tsx
import type { SubView, ViewMode } from './types';
import styles from './SubViewSwitch.module.css';

interface SubViewSwitchProps {
  subView: SubView;
  viewMode: ViewMode;
  resultCount: number;
  page: number;
  pageSize: number;
  totalHits: number;
  onSubViewChange: (view: SubView) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function SubViewSwitch({
  subView, viewMode, resultCount, page, pageSize, totalHits,
  onSubViewChange, onViewModeChange,
}: SubViewSwitchProps) {
  const totalPages = Math.max(1, Math.ceil(totalHits / pageSize));
  const showing = totalHits > 0
    ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalHits)} of ${totalHits.toLocaleString()}`
    : '';

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button
          className={`${styles.switchBtn} ${subView === 'discover' ? styles['switchBtn--active'] : ''}`}
          onClick={() => onSubViewChange('discover')}
        >
          ✨ Discover
        </button>
        <button
          className={`${styles.switchBtn} ${subView === 'results' ? styles['switchBtn--active'] : ''}`}
          onClick={() => onSubViewChange('results')}
        >
          📋 Results
        </button>
      </div>
      <div className={styles.right}>
        {subView === 'results' && showing && (
          <span className={styles.info}>{showing}</span>
        )}
        {subView === 'results' && totalHits > 0 && (
          <span className={styles.info}>Page {page}/{totalPages}</span>
        )}
        {subView === 'results' && (
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles['viewBtn--active'] : ''}`}
              onClick={() => onViewModeChange('grid')}
            >
              ▦
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles['viewBtn--active'] : ''}`}
              onClick={() => onViewModeChange('list')}
            >
              ☰
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 SubViewSwitch 样式**

```css
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.left {
  display: flex;
  gap: 4px;
}

.switchBtn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  font-family: var(--font-body);
  font-size: 0.55em;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  clip-path: var(--clip-badge);
  transition: all var(--transition-fast);
}

.switchBtn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.switchBtn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg);
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info {
  font-family: var(--font-mono);
  font-size: 0.5em;
  color: var(--color-text-dim);
  letter-spacing: 1px;
}

.viewToggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border-light);
  clip-path: var(--clip-small);
}

.viewBtn {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  padding: 4px 10px;
  cursor: pointer;
  font-size: 0.7em;
  transition: all var(--transition-fast);
}

.viewBtn:first-child {
  border-right: 1px solid var(--color-border-light);
}

.viewBtn--active {
  background: var(--color-accent);
  color: var(--color-bg);
}

.viewBtn:hover:not(.viewBtn--active) {
  background: var(--color-panel-alt);
  color: var(--color-text);
}
```

---

### Task 5: 创建 DiscoverView 组件

**Files:**
- Create: `src/components/marketplace/DiscoverView.tsx`
- Create: `src/components/marketplace/DiscoverView.module.css`

- [ ] **Step 1: 创建 DiscoverView 组件**

```tsx
import { useState, useEffect, useRef } from 'react';
import { api, type ModResult } from '../../api';
import { SectionHeader } from '../layout';
import { Button, ContentCard, contentFromModResult, CollectionButton } from '../ui';
import { CardSkeleton } from '../ui/Skeleton';
import type { ContentType, DataSource } from './types';
import styles from './DiscoverView.module.css';

interface DiscoverViewProps {
  contentType: ContentType;
  source: DataSource;
  onNavigate: (slug: string) => void;
}

export default function DiscoverView({ contentType, source, onNavigate }: DiscoverViewProps) {
  const [featured, setFeatured] = useState<ModResult[]>([]);
  const [trending, setTrending] = useState<ModResult[]>([]);
  const [recent, setRecent] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (source === 'curseforge') {
          const cfData = await api.getCfFeatured();
          if (!cancelled) {
            setFeatured(cfData.slice(0, 5));
            setTrending(cfData.slice(0, 10));
            setRecent([]);
          }
        } else {
          const [t, r] = await Promise.all([
            api.getTrendingContent(contentType, undefined, 10),
            api.getRecentlyUpdated(contentType, 10),
          ]);
          if (!cancelled) {
            setTrending(t);
            setFeatured(t.slice(0, 5));
            setRecent(r);
          }
        }
      } catch (e) {
        console.error('Failed to load discover data:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [contentType, source]);

  useEffect(() => {
    if (featured.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % featured.length);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [featured.length]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className={styles.view}>
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
                    contentType={contentType}
                    description={item.description}
                    downloads={item.downloads}
                    categories={item.categories}
                    size="md"
                  />
                  <Button variant="primary" size="md" onClick={() => onNavigate(item.slug)}>
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

      {trending.length > 0 && (
        <div className={styles.row}>
          <div className={styles.row__header}>
            <SectionHeader title="TRENDING THIS WEEK" />
          </div>
          <div className={styles.row__scroll}>
            {trending.map((mod) => (
              <ContentCard
                key={mod.slug}
                content={contentFromModResult(mod)}
                variant="gallery"
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}

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
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 DiscoverView 样式**

```css
.view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.banner {
  position: relative;
  height: 220px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  overflow: hidden;
  clip-path: var(--clip-primary);
}

.banner__slide {
  position: absolute;
  inset: 0;
  display: flex;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}

.banner__slide--active {
  opacity: 1;
  pointer-events: auto;
}

.banner__img {
  width: 40%;
  height: 100%;
  object-fit: cover;
  flex-shrink: 0;
}

.banner__imgPlaceholder {
  width: 40%;
  height: 100%;
  background: var(--color-panel-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3em;
  color: var(--color-text-faint);
  flex-shrink: 0;
}

.banner__body {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.banner__title {
  font-family: var(--font-heading);
  font-size: 1.6em;
  color: var(--color-text);
  letter-spacing: 2px;
  line-height: 1.1;
}

.banner__desc {
  font-size: 0.6em;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.banner__author {
  font-size: 0.5em;
  color: var(--color-text-dim);
}

.banner__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.banner__dots {
  position: absolute;
  bottom: 14px;
  right: 20px;
  display: flex;
  gap: 6px;
  z-index: 2;
}

.banner__dot {
  width: 6px;
  height: 6px;
  background: var(--color-text-faint);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.banner__dot--active {
  background: var(--color-accent);
}

.row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row__scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.row__scroll > * {
  min-width: 280px;
  max-width: 320px;
  flex-shrink: 0;
}
```

---

### Task 6: 创建 ResultsView 组件

**Files:**
- Create: `src/components/marketplace/ResultsView.tsx`
- Create: `src/components/marketplace/ResultsView.module.css`

- [ ] **Step 1: 创建 ResultsView 组件**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { api, type ModResult } from '../../api';
import { useInstances } from '../../stores/instanceStore';
import { useToast } from '../../stores/toastStore';
import { Button, Pagination, ContentCard, contentFromModResult } from '../ui';
import type { ContentType, DataSource, ViewMode } from './types';
import { PAGE_SIZE } from './types';
import styles from './ResultsView.module.css';

interface ResultsViewProps {
  contentType: ContentType;
  source: DataSource;
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string;
  loader: string;
  sortBy: string;
  page: number;
  viewMode: ViewMode;
  onPageChange: (page: number) => void;
  onNavigate: (slug: string) => void;
  onTotalHitsChange: (total: number) => void;
}

function SkeletonGrid() {
  return (
    <div className={styles.skeletonGrid}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonCard__img} />
          <div className={styles.skeletonCard__body}>
            <div className={styles.skeletonCard__line} style={{ width: '80%' }} />
            <div className={`${styles.skeletonCard__line} ${styles['skeletonCard__line--short']}`} />
            <div className={styles.skeletonCard__line} style={{ width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResultsView({
  contentType, source, searchQuery, selectedTags,
  gameVersion, loader, sortBy, page, viewMode,
  onPageChange, onNavigate, onTotalHitsChange,
}: ResultsViewProps) {
  const { state: instState } = useInstances();
  const { addToast } = useToast();

  const [mods, setMods] = useState<ModResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalHits, setTotalHits] = useState(0);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const instances = instState.instances;
  const activeInstance = instances.length > 0 ? instances[0] : null;
  const totalPages = Math.max(1, Math.ceil(totalHits / PAGE_SIZE));

  const loadMods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const effectiveQuery = searchQuery || selectedTags.join(' ');
      const offset = (page - 1) * PAGE_SIZE;

      let results: ModResult[];
      let total: number;

      if (effectiveQuery.trim()) {
        if (source === 'curseforge') {
          [results, total] = await api.searchCfMods(
            effectiveQuery, gameVersion || undefined, selectedTags[0] || undefined,
            sortBy, PAGE_SIZE, offset,
          );
        } else {
          [results, total] = await api.searchContent(
            effectiveQuery, contentType, gameVersion || undefined, loader || undefined,
            sortBy, PAGE_SIZE, offset,
          );
        }
      } else {
        if (source === 'curseforge') {
          results = await api.getCfFeatured();
        } else {
          results = await api.getTrendingContent(contentType, gameVersion || undefined, PAGE_SIZE);
        }
        total = results.length;
      }

      setMods(results);
      setTotalHits(total);
      onTotalHitsChange(total);
    } catch (e: any) {
      setError(e?.toString() || 'Failed to load content');
      setMods([]);
      setTotalHits(0);
      onTotalHitsChange(0);
    } finally {
      setLoading(false);
    }
  }, [contentType, source, searchQuery, selectedTags, gameVersion, loader, sortBy, page, onTotalHitsChange]);

  useEffect(() => {
    loadMods();
  }, [loadMods]);

  const handleInstall = async (mod: ModResult) => {
    if (!activeInstance) {
      addToast({ type: 'warning', title: 'No instance', message: 'Create an instance first to install content.' });
      return;
    }
    setInstalling(mod.slug);
    try {
      if (source === 'curseforge') {
        const modId = parseInt(mod.slug, 10);
        const files = await api.getCfModFiles(modId);
        if (files.length === 0) {
          addToast({ type: 'error', title: 'No files', message: `${mod.title} has no downloadable files.` });
          setInstalling(null);
          return;
        }
        const latest = files[0];
        await api.downloadCfMod(latest.url, latest.filename, activeInstance.id, contentType, undefined, mod.slug, undefined);
        addToast({ type: 'success', title: 'Installed', message: `${mod.title}` });
      } else {
        const versions = await api.getModVersions(
          mod.slug,
          gameVersion || activeInstance.version_id,
          loader || activeInstance.loader_type || 'fabric',
        );
        if (versions.length === 0) {
          addToast({ type: 'error', title: 'Not compatible', message: `${mod.title} has no version for your setup.` });
          setInstalling(null);
          return;
        }
        const latest = versions[0];
        const primaryFile = latest.files.find(
          (f) => !f.filename.includes('sources') && !f.filename.includes('javadoc'),
        ) || latest.files[0];

        await api.installContent(
          primaryFile.url, primaryFile.filename, activeInstance.id,
          contentType, primaryFile.hashes.sha1 || undefined,
          mod.slug, latest.id,
        );
        addToast({ type: 'success', title: 'Installed', message: `${mod.title} ${latest.version_number}` });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Install failed', message: e?.toString() || '' });
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className={styles.view}>
      {!activeInstance && instances.length === 0 && (
        <div className={styles.warning}>
          <span className={styles.warning__icon}>⚠</span>
          <span className={styles.warning__text}>
            You need an instance before you can install content. Create one first.
          </span>
          <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/instances/new')}>
            + New instance
          </Button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <SkeletonGrid />
      ) : mods.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyState__icon}>
            {searchQuery || selectedTags.length > 0 ? '🔍' : '📦'}
          </div>
          <div className={styles.emptyState__title}>
            {searchQuery || selectedTags.length > 0 ? 'NO RESULTS FOUND' : 'DISCOVER CONTENT'}
          </div>
          <div className={styles.emptyState__desc}>
            {searchQuery || selectedTags.length > 0
              ? 'Try a different search term or browse by category instead.'
              : 'Search for your favorite content or switch to the Discover view to see what\'s trending.'}
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? styles.galleryView : styles.listView}>
          {mods.map((mod) => (
            <ContentCard
              key={mod.slug}
              content={contentFromModResult(mod)}
              variant={viewMode === 'grid' ? 'gallery' : 'list'}
              onInstall={activeInstance ? () => handleInstall(mod) : undefined}
              onNavigate={onNavigate}
              installing={installing === mod.slug}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <div className={styles.paginationRow}>
          <Pagination current={page} total={totalPages} onPage={onPageChange} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 ResultsView 样式**

```css
.view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.warning {
  background: var(--color-overlay-30);
  border: 1px solid var(--color-overlay-30);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.warning__icon {
  font-size: 1em;
  flex-shrink: 0;
}

.warning__text {
  font-size: 0.6em;
  color: var(--color-text-secondary);
  flex: 1;
}

.error {
  color: var(--color-error);
  font-size: 0.55em;
  background: var(--color-overlay-30);
  border: 1px solid var(--color-overlay-30);
  padding: 8px 14px;
}

.listView {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.listView > * {
  border-bottom: 1px solid var(--color-border);
}

.listView > *:last-child {
  border-bottom: none;
}

.galleryView {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  align-content: start;
  padding-right: 4px;
}

.skeletonGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  align-content: start;
}

.skeletonCard {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.skeletonCard__img {
  height: 140px;
  background: var(--color-panel-alt);
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeletonCard__body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeletonCard__line {
  height: 10px;
  background: var(--color-panel-alt);
  border-radius: 0;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeletonCard__line--short {
  width: 60%;
}

.emptyState {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 300px;
}

.emptyState__icon {
  font-size: 3em;
  opacity: 0.3;
}

.emptyState__title {
  font-family: var(--font-heading);
  font-size: 1em;
  color: var(--color-text-dim);
  letter-spacing: 3px;
}

.emptyState__desc {
  font-size: 0.6em;
  color: var(--color-text-dim);
  text-align: center;
  max-width: 320px;
  line-height: 1.6;
}

.paginationRow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0 2px;
  flex-shrink: 0;
}
```

---

### Task 7: 创建 MarketplacePage 主页面

**Files:**
- Create: `src/pages/MarketplacePage.tsx`
- Create: `src/pages/MarketplacePage.module.css`

- [ ] **Step 1: 创建 MarketplacePage 组件**

```tsx
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
        resultCount={0}
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
```

- [ ] **Step 2: 创建 MarketplacePage 样式**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  overflow: hidden;
}
```

---

### Task 8: 更新路由和导航

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 更新 App.tsx**

需要做以下修改：

1. 在 `Page` 类型中：将 `'mods' | 'store'` 替换为 `'marketplace'`
2. 在 `getPageFromHash()` 中：`#/store` 和 `#/mods` 都映射到 `'marketplace'`；`#/store/:type/:slug` 仍映射到 `'content_detail'`
3. 在 `NAV_ITEMS` 中：移除 `{ id: 'mods', ... }`，将 `{ id: 'store', ... }` 改为 `{ id: 'marketplace', label: t('nav.marketplace') || 'Marketplace', shortcut: 'S' }`
4. 在 `navigate()` 中：`content_detail` 映射到 `'store'`（保持不变，因为 ContentDetailPage 路由仍是 `#/store/:type/:slug`）
5. 在 `activeNav` 计算中：`page === 'content_detail'` 映射到 `'marketplace'`
6. 在渲染区域：移除 `{page === 'mods' && <ModsPage />}` 和 `{page === 'store' && <StorePage />}`，替换为 `{page === 'marketplace' && <MarketplacePage />}`
7. 更新 import：移除 `ModsPage` 和 `StorePage` 的导入，添加 `MarketplacePage` 的导入

具体代码变更：

```tsx
// 修改 Page 类型
type Page =
  | 'home'
  | 'instances'
  | 'instance_detail'
  | 'new_instance'
  | 'versions'
  | 'marketplace'
  | 'content_detail'
  | 'collections'
  | 'library'
  | 'settings';

// 修改 getPageFromHash
function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#/', '').split('?')[0];
  if (hash === 'instances/new') return 'new_instance';
  if (hash.startsWith('instances/') && hash.split('/')[1]) return 'instance_detail';
  if (hash.startsWith('store/') && hash.split('/').length >= 3) return 'content_detail';
  if (hash === 'store' || hash === 'mods') return 'marketplace';
  if (hash === 'versions') return 'versions';
  if (hash === 'collections') return 'collections';
  if (hash === 'library') return 'library';
  if (hash === 'settings') return 'settings';
  return 'home';
}

// 修改 NAV_ITEMS
const NAV_ITEMS = [
  { id: 'home', label: t('nav.home'), shortcut: 'H' },
  { id: 'marketplace', label: t('nav.marketplace') || 'Marketplace', shortcut: 'S' },
  { id: 'collections', label: t('nav.collections'), shortcut: 'C' },
  { id: 'instances', label: t('nav.instances'), shortcut: 'I' },
  { id: 'library', label: t('nav.library'), shortcut: 'L' },
  { id: 'versions', label: t('nav.versions'), shortcut: 'V' },
  { id: 'settings', label: t('nav.settings'), shortcut: ',' },
];

// 修改 navigate
const navigate = (id: string) => {
  const map: Record<string, string> = {
    new_instance: 'instances/new',
    instance_detail: 'instances',
    content_detail: 'store',
    marketplace: 'store',
  };
  window.location.hash = `#/${map[id] || id}`;
};

// 修改 activeNav
const activeNav =
  page === 'new_instance' || page === 'instance_detail' ? 'instances' :
  page === 'content_detail' || page === 'marketplace' ? 'marketplace' :
  page;

// 修改渲染
{page === 'marketplace' && <MarketplacePage />}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

---

### Task 9: 删除旧文件和清理导出

**Files:**
- Delete: `src/pages/StorePage.tsx`
- Delete: `src/pages/StorePage.module.css`
- Delete: `src/pages/ModsPage.tsx`
- Delete: `src/pages/ModsPage.module.css`
- Delete: `src/components/ui/CategoryCard.tsx`
- Delete: `src/components/ui/CategoryCard.module.css`
- Delete: `src/components/ui/Ticker.tsx`
- Delete: `src/components/ui/Ticker.module.css`
- Modify: `src/components/ui/index.ts` — 移除 CategoryCard 和 Ticker 导出
- Modify: `src/components/layout/index.ts` — 移除 Ticker 导出（如有）

- [ ] **Step 1: 删除旧页面文件**

删除上述 8 个文件。

- [ ] **Step 2: 更新组件导出索引**

检查 `src/components/ui/index.ts`，移除 `CategoryCard` 和 `Ticker` 的导出。检查 `src/components/layout/index.ts`，移除 `Ticker` 的导出。

- [ ] **Step 3: 搜索并修复所有对旧组件的引用**

搜索整个 `src/` 目录中对 `StorePage`、`ModsPage`、`CategoryCard`、`Ticker` 的导入引用，确保没有遗漏。

- [ ] **Step 4: 验证编译**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

---

### Task 10: 更新 i18n 翻译

**Files:**
- Modify: `src/i18n/locales/en.json`（或对应翻译文件）
- Modify: `src/i18n/locales/zh.json`（如有）

- [ ] **Step 1: 添加 marketplace 导航翻译**

在翻译文件中添加 `nav.marketplace` 键：

```json
{
  "nav": {
    "marketplace": "Marketplace"
  }
}
```

中文翻译（如有）：

```json
{
  "nav": {
    "marketplace": "市场"
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

---

### Task 11: 最终验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1`
Expected: 0 errors

- [ ] **Step 2: 运行 Rust 编译检查**

Run: `cargo check --manifest-path /Users/xiatian/Desktop/BonNext/src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: `Finished` 无错误

- [ ] **Step 3: 启动开发服务器验证**

Run: `cd /Users/xiatian/Desktop/BonNext && pnpm tauri dev`
Expected: 应用正常启动，侧边栏显示 Marketplace 导航项，点击进入合并后的页面，6 种类型 Tab 切换正常，Discover/Results 子视图切换正常，搜索和安装功能正常

- [ ] **Step 4: 功能验证清单**

- [ ] 侧边栏 Marketplace 导航项高亮正确
- [ ] 6 种类型 Tab 切换正确拉取对应数据
- [ ] Modrinth/CurseForge 切换正确切换 API
- [ ] 搜索输入后自动切到 Results 子视图
- [ ] 标签筛选后自动切到 Results 子视图
- [ ] Discover 子视图展示 Banner + Trending + Updated
- [ ] Results 子视图展示搜索结果 + 分页
- [ ] 安装功能正常工作
- [ ] ContentDetailPage 返回后状态恢复
- [ ] `#/mods` 重定向到 `#/store` 并显示 Marketplace 页面
