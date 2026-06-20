# Store & Mods 合并页面设计

## 背景

当前 BonNext 有两个独立的内容浏览页面：

- **StorePage** (`#/store`) — 发现型页面，展示精选轮播、分类卡片、Trending、最近更新。仅 Modrinth 数据源，无搜索/筛选/安装功能。
- **ModsPage** (`#/mods`) — 搜索型页面，提供搜索、标签筛选、版本/加载器/排序下拉、Modrinth/CurseForge 双源切换、直接安装。但内容类型硬编码为 `mod`。

两个页面功能重叠且割裂：StorePage 的分类卡片点击后跳转到 ModsPage，ModsPage 缺少发现型内容。合并为统一页面可消除导航跳转、统一数据源、支持全部内容类型。

## 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 内容类型 | 全部 6 种（Mods/Modpacks/Resource Packs/Shaders/Data Packs/Plugins） | 一步到位，StorePage 已定义 6 种分类 |
| 页面定位 | 搜索型为主 | 用户主要行为是搜索和浏览结果 |
| 发现区处理 | 保留为子视图（Discover） | 保留精选/Trending 内容，但不干扰搜索 |
| 数据源切换 | 搜索栏旁切换按钮 | 延续 ModsPage 现有模式，清晰直观 |
| 类型切换 | 顶部 Tab 栏 | 6 种类型需突出展示，Tab 栏最直观 |
| 布局方案 | 子视图切换（Discover / Results） | 各视图专注，搜索时自动切换 |

## 页面结构

### 整体布局（从上到下）

```
┌─────────────────────────────────────────────────┐
│ ① 类型 Tab 栏                                    │
│   Mods | Modpacks | Resource Packs | Shaders |   │
│   Data Packs | Plugins                           │
├─────────────────────────────────────────────────┤
│ ② 搜索栏 + 数据源切换                             │
│   [🔍 Search...]  [Modrinth | CurseForge]        │
├─────────────────────────────────────────────────┤
│ ③ 标签快筛 + 筛选下拉                             │
│   [optimization] [tech] [magic] ...              │
│   Version ▾  Loader ▾  Sort ▾                    │
├─────────────────────────────────────────────────┤
│ ④ 子视图切换                                      │
│   ✨ Discover | 📋 Results   Showing 1-24/1234  │
├─────────────────────────────────────────────────┤
│ ⑤ 内容区域（Discover 或 Results）                 │
│                                                   │
│                                                   │
│                                                   │
└─────────────────────────────────────────────────┘
```

### ① 类型 Tab 栏

- 6 个 Tab：Mods / Modpacks / Resource Packs / Shaders / Data Packs / Plugins
- 当前选中 Tab 高亮（#FFE600），其余为暗色边框
- 切换 Tab 时重置搜索和筛选，重新拉取该类型的 Trending 数据
- Tab 状态映射到 URL 参数：`#/store?tab=mods`、`#/store?tab=shaders`

### ② 搜索栏 + 数据源切换

- 搜索输入框占满剩余宽度
- 右侧为 Modrinth / CurseForge 切换按钮组
- 切换数据源时重新拉取当前视图的数据
- 输入搜索词后自动切换到 Results 子视图

### ③ 标签快筛 + 筛选下拉

- 热门标签横向排列，点击筛选/取消，支持多选
- 标签列表根据当前内容类型动态变化（Mods 显示 optimization/tech/magic 等，Shaders 显示 realistic/cartoon 等）
- 右侧下拉：游戏版本、加载器、排序方式
- 选择任何筛选条件后自动切换到 Results 子视图

### ④ 子视图切换

- **✨ Discover** — 发现视图，展示精选和热门内容
- **📋 Results** — 搜索结果视图（默认）
- 默认显示 Results 子视图
- 输入搜索词或选择筛选 → 自动切换到 Results
- 点击 Discover → 切换到发现视图
- Results 子视图右侧显示结果计数和 Grid/List 视图切换

### ⑤ Results 子视图（默认）

- 结果计数 + Grid/List 视图切换按钮
- 内容卡片网格（Grid 模式）或列表（List 模式）
- 每个卡片包含：图标、标题、简介、下载量、安装按钮
- 安装流程：获取版本 → 解析依赖 → 下载安装（复用现有 InstallButton 组件）
- 分页：每页 24 条，底部分页器
- 空状态和错误状态提示
- 无实例时显示警告提示

### ⑥ Discover 子视图

- Featured Banner：5 条精选内容轮播，每 5 秒切换
- Trending This Week：横向滚动卡片列表（10 条）
- Recently Updated：横向滚动卡片列表（10 条）
- 点击内容卡片跳转到 ContentDetailPage
- 数据源跟随搜索栏的 Modrinth/CurseForge 选择

## 数据流

### API 调用映射

| 场景 | Modrinth | CurseForge |
|------|----------|------------|
| Results 有搜索词 | `searchContent(query, type, version, loader, sort, 24, offset)` | `searchCfMods(query, version, tag, sort, 24, offset)` |
| Results 无搜索词 | `getTrendingContent(type, version, 24)` | `getCfFeatured()` |
| Discover Banner | `getTrendingContent(type, undefined, 5)` | `getCfFeatured()` 取前 5 |
| Discover Trending | `getTrendingContent(type, undefined, 10)` | `getCfFeatured()` 取前 10 |
| Discover Updated | `getRecentlyUpdated(undefined, 10)` | CurseForge 无对应 API，隐藏该区块 |
| 安装 | `getModVersions()` → `installContent()` | `getCfModFiles()` → `downloadCfMod()` |

### 内容类型映射

| Tab | Modrinth facet | CurseForge categoryId |
|-----|---------------|----------------------|
| Mods | `mod` | 6 |
| Modpacks | `modpack` | 4471 |
| Resource Packs | `resourcepack` | 12 |
| Shaders | `shader` | 6552 |
| Data Packs | `datapack` | 6945 |
| Plugins | `plugin` | 5 |

## 路由变更

### 当前路由

| Hash | Page |
|------|------|
| `#/store` | StorePage |
| `#/store/:type/:slug` | ContentDetailPage |
| `#/mods` | ModsPage |

### 合并后路由

| Hash | Page |
|------|------|
| `#/store` | 新的合并页面（MarketplacePage） |
| `#/store?tab=mods` | Mods Tab |
| `#/store?tab=shaders` | Shaders Tab |
| `#/store/:type/:slug` | ContentDetailPage（不变） |

- `#/mods` 重定向到 `#/store?tab=mods`
- 侧边栏导航项从 Store + Mods 合并为一个 "Marketplace"
- ContentDetailPage 的 activeNav 映射为 `store`

## 组件架构

### 新文件

- `src/pages/MarketplacePage.tsx` — 合并后的页面主组件
- `src/pages/MarketplacePage.module.css` — 页面样式
- `src/components/marketplace/TypeTabs.tsx` — 类型 Tab 栏
- `src/components/marketplace/SubViewSwitch.tsx` — Discover/Results 子视图切换
- `src/components/marketplace/DiscoverView.tsx` — Discover 子视图（Banner + Trending + Updated）
- `src/components/marketplace/ResultsView.tsx` — Results 子视图（搜索结果 + 分页 + 安装）
- `src/components/marketplace/FilterBar.tsx` — 搜索栏 + 数据源切换 + 标签 + 筛选下拉

### 复用组件

- `ContentCard` — 内容卡片（gallery/list 变体）
- `InstallButton` — 安装按钮（含依赖解析）
- `CollectionButton` — 收藏按钮
- `Pagination` — 分页器
- `Select` / `TextInput` — 筛选控件
- `CardSkeleton` — 骨架屏

### 删除文件

- `src/pages/StorePage.tsx`
- `src/pages/StorePage.module.css`
- `src/pages/ModsPage.tsx`
- `src/pages/ModsPage.module.css`
- `src/components/ui/CategoryCard.tsx`（功能被 TypeTabs 替代）
- `src/components/ui/Ticker.tsx`（移除底部滚动条）

### 修改文件

- `src/App.tsx` — 路由更新，NAV_ITEMS 合并
- `src/components/layout/Sidebar.tsx` — 导航项更新
- `src/api.ts` — 可能需要新增 CurseForge 的 Trending/Updated API

## 状态管理

MarketplacePage 内部使用 `useReducer` 管理状态：

```typescript
type MarketplaceState = {
  activeTab: ContentType;          // 当前内容类型
  subView: 'discover' | 'results'; // 子视图
  source: 'modrinth' | 'curseforge'; // 数据源
  searchQuery: string;
  selectedTags: string[];
  gameVersion: string | null;
  loader: string | null;
  sortBy: string;
  page: number;
  viewMode: 'grid' | 'list';
};
```

子视图切换逻辑：
- 默认 `subView: 'results'`
- `searchQuery` 非空 → 自动切到 `results`
- `selectedTags` 非空 → 自动切到 `results`
- `gameVersion` / `loader` / `sortBy` 变更 → 自动切到 `results`
- 用户手动点击 Discover → 切到 `discover`

## 错误处理

- API 请求失败：显示错误状态，提供重试按钮
- 无实例时：Results 视图顶部显示警告，引导创建实例
- 搜索无结果：显示空状态提示
- CurseForge 模式下无 Recently Updated API：Discover 视图隐藏该区块

## 测试要点

- 6 种类型 Tab 切换正确拉取对应数据
- Modrinth/CurseForge 切换正确切换 API 调用
- 搜索/筛选自动切换到 Results 子视图
- 分页正确工作
- 安装流程完整（版本获取 → 依赖解析 → 下载）
- URL 参数同步（`#/store?tab=mods`）
- `#/mods` 重定向到 `#/store?tab=mods`
- ContentDetailPage 返回后恢复之前的状态
