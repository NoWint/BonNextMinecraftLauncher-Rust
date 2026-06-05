# BonNext 多 Shell 架构设计

> 日期：2026-06-05
> 状态：已确认，待实施

## 1. 概述

### 1.1 目标

将 BonNext 从单 UI 架构重构为多 Shell 架构，允许用户在同一个 App 内切换不同的前端 UI 实现（类似切换主题）。所有 Shell 共享同一套 Rust 后端核心逻辑和前端 API/状态管理层，但各自拥有完全独立的 UI 实现。

### 1.2 设计原则

1. **后端核心不变**：Rust 后端承载 ~90% 业务逻辑，与 Tauri IPC 的耦合仅在 `commands/` 薄壳层，无需重构
2. **Shell 完全独立**：每个 Shell 有自己的组件、页面、样式、布局，不依赖其他 Shell 的代码
3. **共享层稳定**：API 封装、状态管理、类型定义作为所有 Shell 的公共基础，接口稳定不变
4. **懒加载切换**：Shell 通过 React.lazy 按需加载，切换时状态保持，无白屏
5. **增量迁移**：先迁移现有 ZZZ UI，再逐步添加新 Shell，每步可验证

### 1.3 初始 Shell 清单

| Shell ID | 名称 | 设计语言 | 优先级 |
|----------|------|---------|--------|
| `zzz` | ZZZ Neo-Tokyo | 赛博朋克风格（现有） | P0 - 迁移 |
| `swiftui` | SwiftUI Style | Apple HIG | P1 - 新建 |
| `fluent` | Fluent UI Style | Microsoft Fluent Design 2 | P2 - 新建 |
| `tv` | TV / 10-foot UI | 大屏遥控器操作 | P3 - 新建 |

### 1.4 废弃项

- MD3 主题插件（`src/plugins/md3-theme/`）及相关代码全部移除
- `MD3AppShell` 组件移除
- `themeStore` 中的 MD3 主题选项移除
- CSS 中的 MD3 变量移除

---

## 2. 目录结构

### 2.1 完整目录树

```
src/
├── shells/                          # 所有 Shell 实现
│   ├── zzz/                         # ZZZ/Neo-Tokyo 风格
│   │   ├── components/              # Shell 专属 UI 组件
│   │   │   ├── ui/                  # 基础组件（Button, Modal, Tabs 等）
│   │   │   ├── ContentCard.tsx      # 业务组件
│   │   │   ├── InstallButton.tsx
│   │   │   ├── CollectionButton.tsx
│   │   │   ├── DownloadPanel.tsx
│   │   │   ├── InstanceSelect.tsx
│   │   │   └── ...
│   │   ├── pages/                   # Shell 专属页面
│   │   │   ├── HomePage.tsx
│   │   │   ├── MarketplacePage.tsx
│   │   │   ├── ContentDetailPage.tsx
│   │   │   ├── InstancesPage.tsx
│   │   │   ├── NewInstancePage.tsx
│   │   │   ├── InstanceDetailPage.tsx
│   │   │   ├── CollectionsPage.tsx
│   │   │   ├── LibraryPage.tsx
│   │   │   ├── VersionsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── styles/                  # Shell 专属样式
│   │   │   ├── tokens.css           # ZZZ 设计令牌
│   │   │   ├── themes.css           # ZZZ 主题变体（dark/light/OLED）
│   │   │   └── ux-delight.css       # ZZZ 动效
│   │   ├── hooks/                   # Shell 专属 hooks
│   │   ├── AppShell.tsx             # Shell 布局入口
│   │   └── index.ts                 # 导出 ShellDefinition
│   │
│   ├── swiftui/                     # SwiftUI 风格
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── ...
│   │   ├── pages/
│   │   ├── styles/
│   │   │   ├── tokens.css           # SwiftUI 设计令牌
│   │   │   └── themes.css           # 浅色/深色模式
│   │   ├── hooks/
│   │   ├── AppShell.tsx
│   │   └── index.ts
│   │
│   ├── fluent/                      # Fluent UI 风格
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── ...
│   │   ├── pages/
│   │   ├── styles/
│   │   │   ├── tokens.css           # Fluent 设计令牌
│   │   │   └── themes.css
│   │   ├── hooks/
│   │   ├── AppShell.tsx
│   │   └── index.ts
│   │
│   └── tv/                          # TV 端
│       ├── components/
│       │   ├── ui/
│       │   └── ...
│       ├── pages/
│       ├── styles/
│       │   ├── tokens.css           # TV 设计令牌
│       │   └── themes.css
│       ├── hooks/
│       │   └── useFocusManager.ts   # 方向键焦点管理
│       ├── AppShell.tsx
│       └── index.ts
│
├── shared/                          # 跨 Shell 共享层
│   ├── api/                         # Tauri IPC 封装
│   │   ├── types.ts                 # 全部 TypeScript 类型定义
│   │   ├── cache.ts                 # cachedInvoke + invalidateCache
│   │   ├── versions.ts              # 版本/启动状态/下载控制
│   │   ├── auth.ts                  # 认证
│   │   ├── instances.ts             # 实例管理
│   │   ├── modrinth.ts              # Modrinth
│   │   ├── curseforge.ts            # CurseForge
│   │   ├── content.ts               # 已安装内容
│   │   ├── collections.ts           # 收藏
│   │   ├── security.ts              # 安全
│   │   ├── system.ts                # 系统信息/硬件/新闻
│   │   ├── social.ts                # 社交
│   │   ├── chat.ts                  # 聊天
│   │   ├── workflow.ts              # 工作流
│   │   ├── modpack.ts               # 整合包
│   │   ├── modpackindex.ts          # ModpackIndex
│   │   ├── modScanner.ts            # Mod 扫描
│   │   ├── servers.ts               # 服务器 ping
│   │   ├── p2p.ts                   # P2P
│   │   ├── crash.ts                 # 崩溃分析
│   │   └── index.ts                 # 统一导出为 api 对象
│   │
│   ├── stores/                      # React Context 状态管理
│   │   ├── authStore.tsx            # 认证状态
│   │   ├── configStore.tsx          # 应用配置
│   │   ├── instanceStore.tsx        # 实例管理
│   │   ├── toastStore.tsx           # Toast 通知
│   │   ├── themeStore.tsx           # Shell 内主题变体
│   │   ├── downloadStore.tsx        # 下载队列
│   │   └── shellStore.tsx           # Shell 切换状态（新增）
│   │
│   ├── types/                       # 共享类型定义
│   │   ├── shell.ts                 # ShellDefinition 等类型
│   │   └── index.ts
│   │
│   ├── hooks/                       # 跨 Shell 共享 hooks
│   │   ├── useInstallFlow.ts        # 安装流程编排
│   │   ├── useDownloadProgress.ts   # 下载进度监听
│   │   └── index.ts
│   │
│   └── utils/                       # 工具函数
│       ├── errorMapping.ts          # 错误映射
│       ├── logger.ts                # 日志系统
│       ├── composeProviders.tsx     # Provider 组合
│       └── index.ts
│
├── shell-registry.ts                # Shell 注册表 + 懒加载
├── App.tsx                          # 顶层：Provider + Shell 渲染
└── main.tsx                         # 入口
```

### 2.2 依赖规则

```
shells/zzz/ ──────┐
shells/swiftui/ ──┤──→ shared/ ──→ @tauri-apps/api
shells/fluent/ ───┤
shells/tv/ ───────┘

规则：
1. Shell 只能依赖 shared/，不能依赖其他 Shell
2. shared/ 不能依赖任何 Shell 的代码
3. Shell 之间零耦合
4. shared/ 中的 hooks 只返回数据/callback，不返回 JSX
```

---

## 3. Shell 注册与懒加载机制

### 3.1 ShellDefinition 类型

```typescript
// src/shared/types/shell.ts

export interface ShellDefinition {
  /** Shell 唯一标识符，用于配置持久化和路由 */
  id: string;
  /** Shell 显示名称 */
  name: string;
  /** Shell 描述 */
  description: string;
  /** Shell 图标（emoji 或 SVG path） */
  icon: string;
  /** React.lazy 工厂函数，Vite 自动代码分割 */
  loader: () => Promise<{ default: React.ComponentType }>;
  /** 该 Shell 支持的功能路由（TV Shell 可能省略部分页面） */
  supportedRoutes: string[];
  /** 该 Shell 支持的主题变体 */
  supportedThemes: string[];
}
```

### 3.2 Shell 注册表实现

```typescript
// src/shell-registry.ts

import type { ShellDefinition } from './shared/types/shell';

type LazyShellComponent = React.LazyExoticComponent<React.ComponentType>;

const registry = new Map<string, ShellDefinition>();
const components = new Map<string, LazyShellComponent>();

/**
 * 注册一个 Shell。在模块顶层调用，确保 App 启动时所有 Shell 已注册。
 */
export function registerShell(shell: ShellDefinition): void {
  if (registry.has(shell.id)) {
    console.warn(`Shell "${shell.id}" already registered, skipping.`);
    return;
  }
  registry.set(shell.id, shell);
  components.set(shell.id, React.lazy(shell.loader));
}

/**
 * 获取指定 Shell 的懒加载组件。
 * 用于 App.tsx 中根据 activeShell 渲染对应 Shell。
 */
export function getShellComponent(id: string): LazyShellComponent {
  const component = components.get(id);
  if (!component) {
    throw new Error(`Shell "${id}" not registered. Available: ${Array.from(registry.keys()).join(', ')}`);
  }
  return component;
}

/**
 * 获取所有已注册 Shell 的定义信息。
 * 用于设置页的 Shell 选择器 UI。
 */
export function getAllShells(): ShellDefinition[] {
  return Array.from(registry.values());
}

/**
 * 检查 Shell 是否已注册。
 */
export function isShellRegistered(id: string): boolean {
  return registry.has(id);
}

// ---- 注册所有 Shell ----
// 每个 Shell 的 index.ts 导出 ShellDefinition，这里统一注册
import { zzzShell } from './shells/zzz';
import { swiftuiShell } from './shells/swiftui';
import { fluentShell } from './shells/fluent';
import { tvShell } from './shells/tv';

registerShell(zzzShell);
registerShell(swiftuiShell);
registerShell(fluentShell);
registerShell(tvShell);
```

### 3.3 各 Shell 的 index.ts 导出

```typescript
// src/shells/zzz/index.ts
import type { ShellDefinition } from '../../shared/types/shell';

export const zzzShell: ShellDefinition = {
  id: 'zzz',
  name: 'ZZZ Neo-Tokyo',
  description: '赛博朋克风格界面，灵感来自绝区零',
  icon: '⚡',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['dark', 'light', 'oled'],
};
```

```typescript
// src/shells/swiftui/index.ts
import type { ShellDefinition } from '../../shared/types/shell';

export const swiftuiShell: ShellDefinition = {
  id: 'swiftui',
  name: 'SwiftUI Style',
  description: '遵循 Apple Human Interface Guidelines 的设计语言',
  icon: '🍎',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['light', 'dark'],
};
```

```typescript
// src/shells/fluent/index.ts
import type { ShellDefinition } from '../../shared/types/shell';

export const fluentShell: ShellDefinition = {
  id: 'fluent',
  name: 'Fluent UI Style',
  description: '遵循 Microsoft Fluent Design System 2 的设计语言',
  icon: '🪟',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['light', 'dark'],
};
```

```typescript
// src/shells/tv/index.ts
import type { ShellDefinition } from '../../shared/types/shell';

export const tvShell: ShellDefinition = {
  id: 'tv',
  name: 'TV / 10-foot UI',
  description: '大屏电视遥控器操作界面',
  icon: '📺',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/:id',
    '/library', '/settings',
    // TV Shell 省略：/instances/new, /collections, /versions
  ],
  supportedThemes: ['dark'],
};
```

### 3.4 App.tsx 渲染逻辑

```typescript
// src/App.tsx

import React, { Suspense } from 'react';
import { getShellComponent } from './shell-registry';
import { AppProviders } from './shared/utils/composeProviders';
import { useShellStore } from './shared/stores/shellStore';

function ShellLoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div>Loading Shell...</div>
    </div>
  );
}

function ShellRenderer() {
  const { activeShell } = useShellStore();
  const ShellComponent = getShellComponent(activeShell);

  return (
    <Suspense fallback={<ShellLoadingScreen />}>
      <ShellComponent />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProviders>
      <ShellRenderer />
    </AppProviders>
  );
}
```

### 3.5 Shell 切换流程

```
1. 用户在设置页选择新 Shell（如从 ZZZ 切换到 SwiftUI）
2. shellStore.setActiveShell('swiftui') 被调用
3. shellStore 更新 React 状态 + 调用 api.setActiveShell('swiftui') 持久化到 Rust 配置
4. ShellRenderer 响应 activeShell 变化
5. getShellComponent('swiftui') 返回 SwiftUI 的 React.lazy 组件
6. 如果 SwiftUI chunk 未加载过，React.lazy 触发网络请求下载 chunk
7. Suspense 显示 ShellLoadingScreen
8. chunk 下载完成，SwiftUI AppShell 渲染
9. 所有 shared/stores 状态保持不变（认证、实例、下载队列等）
```

### 3.6 Vite 代码分割行为

由于每个 Shell 的 `loader` 使用 `() => import('./AppShell')` 动态导入，Vite 会自动将每个 Shell 打包为独立 chunk：

```
dist/
├── assets/
│   ├── index-[hash].js              # 主入口 + shared/ 代码
│   ├── shells-zzz-AppShell-[hash].js    # ZZZ Shell chunk
│   ├── shells-swiftui-AppShell-[hash].js # SwiftUI Shell chunk
│   ├── shells-fluent-AppShell-[hash].js  # Fluent Shell chunk
│   └── shells-tv-AppShell-[hash].js      # TV Shell chunk
```

初始加载只下载 `index.js` + 当前激活 Shell 的 chunk，其他 Shell 按需加载。

### 3.7 import 副作用说明

`shell-registry.ts` 在模块顶层 import 了所有 Shell 的 `index.ts`：

```typescript
import { zzzShell } from './shells/zzz';
import { swiftuiShell } from './shells/swiftui';
```

这些 import **不会触发 Shell 组件的加载**。每个 `index.ts` 只导出一个 `ShellDefinition` 对象（纯数据，约 20 行代码），不 import 任何组件或样式。Shell 的实际组件代码仅在 `React.lazy(shell.loader)` 被执行时（即用户切换到该 Shell 时）才会下载。

```
App 启动时加载：shell-registry.ts + 4 个 index.ts（共 ~80 行代码，< 1KB）
用户切换 Shell 时加载：对应 Shell 的 AppShell chunk（~100-300KB）
```

### 3.8 ShellLoadingScreen 说明

`ShellLoadingScreen` 使用 inline styles 而非 CSS Modules，因为它是 Shell 加载前的兜底组件，此时没有任何 Shell 的样式表可用。这是项目中唯一允许 inline styles 的例外。

---

## 4. 共享层（shared/）详细设计

### 4.1 API 层（shared/api/）

**迁移策略**：将现有 `src/api/` 整体迁入 `src/shared/api/`，仅修改导入路径，不修改任何函数签名或实现。

**关键约束**：
- API 层只使用 `invoke()` 和 `listen()`，不包含任何 UI 逻辑
- 所有方法都是纯数据转换：参数 → invoke → 返回值
- `cachedInvoke` 继续提供请求去重功能
- `types.ts` 中的 60+ 接口/类型与传输层无关，天然可共享

**API 层不做的事**：
- 不做 UI 状态管理（由 stores 负责）
- 不做错误提示（由 shells 的 UI 层负责）
- 不做数据转换/格式化（由 shells 的 hooks 负责）

### 4.2 状态管理层（shared/stores/）

**迁移策略**：将现有 `src/stores/` 迁入 `src/shared/stores/`，修改导入路径。

**新增 store：shellStore**

```typescript
// src/shared/stores/shellStore.tsx

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ShellDefinition } from '../types/shell';
import { api } from '../api';
import { getAllShells } from '../../shell-registry';

// ---- State ----
interface ShellState {
  /** 当前激活的 Shell ID */
  activeShell: string;
  /** 所有已注册 Shell 的定义信息 */
  availableShells: ShellDefinition[];
  /** 是否正在切换 Shell（用于 Suspense 过渡） */
  isSwitching: boolean;
}

const initialState: ShellState = {
  activeShell: 'zzz',  // 默认值，App 启动时从 Rust 配置覆盖
  availableShells: [],
  isSwitching: false,
};

// ---- Actions ----
type ShellAction =
  | { type: 'SET_ACTIVE_SHELL'; payload: string }
  | { type: 'SET_SWITCHING'; payload: boolean }
  | { type: 'SET_AVAILABLE_SHELLS'; payload: ShellDefinition[] }
  | { type: 'INIT_FROM_CONFIG'; payload: string };

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'SET_ACTIVE_SHELL':
      return { ...state, activeShell: action.payload, isSwitching: true };
    case 'SET_SWITCHING':
      return { ...state, isSwitching: action.payload };
    case 'SET_AVAILABLE_SHELLS':
      return { ...state, availableShells: action.payload };
    case 'INIT_FROM_CONFIG':
      return { ...state, activeShell: action.payload };
    default:
      return state;
  }
}

// ---- Context ----
interface ShellContextValue {
  state: ShellState;
  setActiveShell: (shellId: string) => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

// ---- Provider ----
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialState);

  // 初始化：从 Rust 配置读取 activeShell，从注册表读取可用 Shell 列表
  useEffect(() => {
    async function init() {
      try {
        const savedShell = await api.getActiveShell();
        dispatch({ type: 'INIT_FROM_CONFIG', payload: savedShell });
      } catch {
        // 配置读取失败，使用默认值 'zzz'
      }
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    }
    init();
  }, []);

  const setActiveShell = useCallback(async (shellId: string) => {
    dispatch({ type: 'SET_ACTIVE_SHELL', payload: shellId });
    try {
      await api.setActiveShell(shellId);
    } catch (e) {
      console.error('Failed to persist shell selection:', e);
      // 持久化失败不影响前端切换，下次启动会恢复默认
    }
  }, []);

  return (
    <ShellContext.Provider value={{ state, setActiveShell }}>
      {children}
    </ShellContext.Provider>
  );
}

// ---- Hook ----
export function useShellStore(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShellStore must be used within a ShellProvider');
  }
  return context;
}
```

**shellStore 在 composeProviders 中的位置**：

```typescript
// src/shared/utils/composeProviders.tsx
// Provider 顺序：HashRouter → ShellProvider → ThemeBridge → I18n → Auth → Config → Instance → Toast → Download → ContextMenu
// ShellProvider 在 ThemeBridge 之前，因为主题变体依赖于当前 Shell 的 supportedThemes
```

**themeStore 变更**：

现有 `themeStore` 管理跨 Shell 的主题切换（包括 MD3），重构后简化为：
- 移除 MD3 主题选项
- `theme` 变为 Shell 内部的主题变体（如 ZZZ 的 dark/light/OLED）
- Shell 切换由 `shellStore` 管理，不再由 `themeStore` 管理
- `themeStore` 的职责变为：管理当前 Shell 的主题变体

```typescript
// 重构后的 themeStore 职责
interface ThemeState {
  variant: 'dark' | 'light' | 'oled';  // 当前 Shell 的主题变体
  // 不再包含 shell 切换逻辑
}
```

### 4.3 共享 Hooks（shared/hooks/）

**原则**：共享 hooks 只返回数据和回调函数，**绝不返回 JSX**。这确保 hooks 与 UI 实现解耦。

```typescript
// src/shared/hooks/useInstallFlow.ts

/**
 * 安装流程编排 hook。
 * 返回安装状态、进度、操作回调，不包含任何 UI 渲染。
 * 各 Shell 自行决定如何展示这些数据。
 */
export function useInstallFlow(projectId: string, projectType: string) {
  const [state, setState] = useState<'idle' | 'loading' | 'installing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startInstall = useCallback(async (instanceId: string, versionId: string) => {
    setState('loading');
    try {
      // 调用 shared/api 获取版本信息
      const versions = await api.getModVersions(projectId);
      // 解析依赖
      // 逐个下载
      setState('installing');
      // ...
      setState('done');
    } catch (e) {
      setError(String(e));
      setState('error');
    }
  }, [projectId, projectType]);

  return { state, progress, error, startInstall };
}
```

```typescript
// src/shared/hooks/useDownloadProgress.ts

/**
 * 下载进度监听 hook。
 * 订阅 Tauri 事件，返回实时进度数据。
 */
export function useDownloadProgress(taskId: string) {
  const [progress, setProgress] = useState({ bytesDownloaded: 0, totalBytes: 0, speed: 0 });

  useEffect(() => {
    const unlisten = listen('download-progress', (event) => {
      if (event.payload.taskId === taskId) {
        setProgress(event.payload);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [taskId]);

  return progress;
}
```

### 4.4 共享工具（shared/utils/）

| 工具 | 职责 | 变更 |
|------|------|------|
| `errorMapping.ts` | 错误类型映射 + 用户友好建议 | 无变更，仅迁移 |
| `logger.ts` | 统一日志（200 条内存缓冲） | 无变更，仅迁移 |
| `composeProviders.tsx` | Provider 组合工具 | 移除 MD3 相关 Provider |

---

## 5. Rust 后端变更

### 5.1 配置结构变更

```rust
// src-tauri/src/config.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    // ---- 新增字段 ----
    /// 当前激活的 Shell ID，默认 "zzz"
    pub active_shell: String,

    // ---- 现有字段保持不变 ----
    pub max_memory: u32,
    pub min_memory: u32,
    pub game_directory: String,
    pub concurrent_downloads: u32,
    // ...
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            active_shell: "zzz".to_string(),  // 新增默认值
            max_memory: 2048,
            min_memory: 512,
            // ...
        }
    }
}
```

### 5.2 新增 Tauri 命令

```rust
// src-tauri/src/commands/config.rs（或 lib.rs 中追加）

#[tauri::command]
pub async fn get_active_shell(state: State<'_, AppConfig>) -> Result<String, LauncherError> {
    Ok(state.active_shell.clone())
}

#[tauri::command]
pub async fn set_active_shell(
    state: State<'_, AppConfig>,
    shell_id: String,
) -> Result<(), LauncherError> {
    // 验证 shell_id 合法性
    let valid_shells = ["zzz", "swiftui", "fluent", "tv"];
    if !valid_shells.contains(&shell_id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Unknown shell: {}", shell_id
        )));
    }
    // 更新配置并持久化
    state.active_shell = shell_id;
    state.save().await?;
    Ok(())
}
```

### 5.3 命令注册

在 `lib.rs` 的 `generate_handler![]` 宏中追加：

```rust
get_active_shell, set_active_shell,
```

### 5.4 前端 API 封装

```typescript
// src/shared/api/config.ts（追加）

export const getActiveShell = (): Promise<string> =>
  invoke<string>('get_active_shell');

export const setActiveShell = (shellId: string): Promise<void> =>
  invoke<void>('set_active_shell', { shellId });
```

### 5.5 无需变更的部分

- 所有现有 Tauri 命令（170+）——对所有 Shell 通用
- 核心业务模块（auth/、download/、launch/、instance/ 等）
- 状态管理（AppState、DownloadControlState 等）
- HTTP 客户端、缓存机制

---

## 6. MD3 代码清理清单

### 6.1 前端清理

| 文件/目录 | 操作 | 说明 |
|-----------|------|------|
| `src/plugins/md3-theme/` | 删除整个目录 | MD3 主题插件（迁移后路径不变，plugins/ 不属于任何 Shell） |
| `src/plugins/` 中 MD3 注册代码 | 移除相关行 | ThemeExtensionPoint 的 MD3 实现 |
| `src/shells/zzz/styles/themes.css` | 移除 MD3 变量段 | 保留 ZZZ dark/light/OLED 变量（迁移后路径） |
| `src/shells/zzz/components/` 中 `MD3AppShell` | 删除 | MD3 布局组件（迁移后路径） |
| `src/shared/stores/themeStore.tsx` | 移除 MD3 选项 | 简化为 Shell 内主题变体（迁移后路径） |
| `src/shared/api/types.ts` 中 MD3 类型 | 删除 | MD3Theme 类型定义（迁移后路径） |
| `src/App.tsx` 中 MD3 条件分支 | 移除 | 不再需要 MD3/ZZZ 切换逻辑 |
| `src/shared/utils/composeProviders.tsx` | 移除 MD3 Provider | 清理 Provider 列表（迁移后路径） |

### 6.2 Rust 端

无 MD3 相关代码，无需清理。

### 6.3 清理验证

清理后运行以下检查确保无残留：
1. `grep -r "md3\|MD3\|material.*design.*3" src/` 应无结果
2. `pnpm build` 编译通过
3. ZZZ Shell 功能与清理前完全一致

---

## 7. 各 Shell 设计规范

### 7.1 ZZZ Shell（迁移，保持不变）

**视觉特征**：
- 深色主题，#FFE600 黄色强调色
- Bebas Neue 标题字体，Inter 正文字体，DM Mono 数据字体
- Clip-path 斜切角（`--clip-primary/medium/small/badge/diamond`）
- SVG 噪点叠加（`.noise-overlay`）+ 扫描线（`.scanline-overlay`）
- 尺寸使用 `em` 单位，基础 16px

**导航范式**：
- 左侧 Sidebar + 右侧内容区
- Sidebar 包含：Logo、导航项、实例选择器、用户头像

**主题变体**：dark（默认）、light、oled

**CSS 策略**：CSS Modules + tokens.css + themes.css + ux-delight.css

### 7.2 SwiftUI Shell

**设计语言**：Apple Human Interface Guidelines

**视觉特征**：
- 圆角卡片（12-16px border-radius）
- SF Pro 字体族（-apple-system, BlinkMacSystemFont 回退）
- 半透明模糊背景（backdrop-filter: blur(20px)）
- 系统级动画曲线（cubic-bezier(0.25, 0.1, 0.25, 1)）
- 细线分隔（1px solid with 0.1 opacity）
- SF Symbols 风格图标（使用 Lucide 或 Phosphor 图标库近似）

**导航范式**：
- 侧边栏 + 内容区（macOS 风格 NavigationSplitView）
- 侧边栏可折叠，内容区自适应
- 顶部工具栏（Toolbar）包含搜索和操作按钮

**组件风格**：
- List 视图：交替行背景色
- Form 布局：分组 + 标签 + 控件
- 按钮样式：系统蓝填充 / 灰色描边 / 纯文字
- 输入框：圆角矩形，浅灰边框
- 模态框：居中弹出，毛玻璃背景

**配色**：
- 浅色模式：#FFFFFF 背景，#000000 文字，#007AFF 强调色
- 深色模式：#1C1C1E 背景，#FFFFFF 文字，#0A84FF 强调色
- 跟随系统 prefers-color-scheme

**主题变体**：light、dark

**CSS 策略**：CSS Modules + tokens-swiftui.css + themes-swiftui.css

### 7.3 Fluent UI Shell

**设计语言**：Microsoft Fluent Design System 2

**视觉特征**：
- Acrylic 材质（半透明 + 噪点纹理 + 模糊背景）
- Reveal Hover 高亮效果（鼠标跟随光晕）
- 4px 圆角（Fluent 2 标准）
- Segoe UI 字体族（Segoe UI, Tahoma 回退）
- 阴影层级：shadow2（2px offset）、shadow4、shadow8、shadow16、shadow64
- Fluent Icons（使用 @fluentui/svg-icons 或近似图标库）

**导航范式**：
- Navigation View（汉堡菜单 + 侧边栏）
- 侧边栏展开/折叠/最小化三种状态
- 顶部命令栏（CommandBar）包含操作按钮
- 面包屑导航

**组件风格**：
- 按钮样式：Primary（品牌色填充）、Secondary（描边）、Subtle（透明）
- 输入框：4px 圆角，底部边框高亮
- 卡片：4px 圆角，微妙阴影，hover 提升
- 标签页：下划线式，活跃标签品牌色下划线
- Persona 卡片：圆形头像 + 名称 + 副标题

**配色**：
- 浅色模式：#FAFAFA 背景，#242424 文字，#0078D4 品牌色
- 深色模式：#1A1A1A 背景，#FFFFFF 文字，#4CC2FF 品牌色
- 跟随系统 prefers-color-scheme

**主题变体**：light、dark

**CSS 策略**：CSS Modules + tokens-fluent.css + themes-fluent.css

### 7.4 TV Shell

**设计语言**：10-foot UI（电视遥控器操作距离）

**视觉特征**：
- 大字体（基础 24px+，标题 48px+）
- 高对比度配色
- 大焦点框（4px 品牌色描边 + 发光效果）
- 简化信息密度——每屏显示更少内容
- 横向行滚动（Netflix / Apple TV 风格）
- 最少文字，图标优先

**导航范式**：
- 方向键导航（上下左右 + 确认/返回）
- 焦点管理系统（`useFocusManager` hook）
- 横向行滚动：每行是一个内容类别
- 顶部 Tab 导航（大图标 + 文字）
- 无鼠标悬停交互，纯焦点驱动

**组件风格**：
- 超大卡片（最小 200x300px）
- 醒目焦点状态（描边 + 缩放 + 阴影）
- 进度条加粗（8px+）
- 大按钮（最小 48px 高度）
- 全屏模态（无弹窗，全屏覆盖）

**配色**：
- 仅深色模式（TV 环境默认暗室）
- #0D0D0D 背景，#FFFFFF 文字，#FFE600 强调色（与 ZZZ 一致）
- 高对比度，WCAG AAA 标准

**功能范围**（精简）：
- 支持：首页、内容浏览、内容详情、实例管理（查看+启动）、已安装内容、基本设置
- 不支持：新建实例、收藏管理、版本浏览器、高级设置

**主题变体**：dark（唯一）

**CSS 策略**：CSS Modules + tokens-tv.css + themes-tv.css

**焦点管理 hook**：

```typescript
// src/shells/tv/hooks/useFocusManager.ts

/**
 * TV Shell 的焦点管理系统。
 * 管理方向键导航、焦点环、焦点陷阱。
 */
export function useFocusManager() {
  // 实现方向键导航逻辑
  // 上/下/左/右 焦点移动
  // Enter 确认，Escape/Back 返回
  // 焦点环（focus trap）用于模态框
  // 焦点记忆（返回上一页时恢复焦点位置）
}
```

---

## 8. Shell 间功能路由映射

### 8.1 路由表

| 路由 | ZZZ | SwiftUI | Fluent | TV | 最低功能要求 |
|------|-----|---------|--------|----|-------------|
| `/home` | ✅ | ✅ | ✅ | ✅ | 当前实例 + 启动按钮 |
| `/store` | ✅ | ✅ | ✅ | ✅ | 搜索 + 分类 + 列表 |
| `/store/:type/:slug` | ✅ | ✅ | ✅ | ✅ | 描述 + 版本 + 安装 |
| `/instances` | ✅ | ✅ | ✅ | ✅ | 实例列表 |
| `/instances/new` | ✅ | ✅ | ✅ | ❌ | 新建实例向导 |
| `/instances/:id` | ✅ | ✅ | ✅ | ✅ | 实例详情 + 管理 |
| `/collections` | ✅ | ✅ | ✅ | ❌ | 收藏列表 |
| `/library` | ✅ | ✅ | ✅ | ✅ | 已安装内容 |
| `/versions` | ✅ | ✅ | ✅ | ❌ | 版本浏览器 |
| `/settings` | ✅ | ✅ | ✅ | ✅（精简） | 基本配置 |

### 8.2 路由守卫

当用户在 TV Shell 中访问不支持的路由时（如 `/instances/new`），应重定向到首页或显示"此功能在 TV 模式下不可用"提示。

```typescript
// 各 Shell 的 AppShell 内部路由配置
// TV Shell 只注册 supportedRoutes 中列出的路由
```

---

## 9. 迁移策略

### 9.1 阶段 1：骨架搭建 + ZZZ 迁移

**目标**：建立多 Shell 目录结构，将现有 ZZZ UI 迁移到 `shells/zzz/`，功能零变更。

**步骤**：

1. **创建目录结构**
   - 创建 `src/shells/zzz/`、`src/shared/` 目录
   - 创建 `src/shell-registry.ts`
   - 创建 `src/shared/types/shell.ts`

2. **迁移 shared 层**（仅移动文件 + 修改导入路径）
   - `src/api/` → `src/shared/api/`
   - `src/stores/` → `src/shared/stores/`
   - `src/utils/` → `src/shared/utils/`
   - `src/api/types.ts` → `src/shared/types/`（拆分到 types/ 目录）

3. **迁移 ZZZ Shell**（仅移动文件 + 修改导入路径）
   - `src/components/` → `src/shells/zzz/components/`
   - `src/pages/` → `src/shells/zzz/pages/`
   - `src/styles/` → `src/shells/zzz/styles/`
   - 创建 `src/shells/zzz/AppShell.tsx`（从现有 AppShell 逻辑提取）
   - 创建 `src/shells/zzz/index.ts`（导出 ShellDefinition）

4. **实现 Shell 注册机制**
   - 实现 `shell-registry.ts`
   - 实现 `shellStore.tsx`
   - 改造 `App.tsx` 使用 Shell 渲染逻辑

5. **Rust 端变更**
   - `config.rs` 增加 `active_shell` 字段
   - 新增 `get_active_shell` / `set_active_shell` 命令
   - `lib.rs` 注册新命令

6. **全局导入路径更新**
   - 所有从 `src/api/` 导入的路径改为 `src/shared/api/`
   - 所有从 `src/stores/` 导入的路径改为 `src/shared/stores/`
   - 所有从 `src/utils/` 导入的路径改为 `src/shared/utils/`
   - ZZZ Shell 内部的导入路径更新

7. **验证**
   - `pnpm build` 编译通过
   - ZZZ Shell 功能与迁移前完全一致
   - Shell 切换机制工作正常（虽然只有 ZZZ 一个 Shell）

### 9.2 阶段 2：MD3 清理

**目标**：移除所有 MD3 相关代码，简化 themeStore。

**步骤**：

1. 删除 `src/plugins/md3-theme/` 目录
2. 清理 `src/plugins/` 中 MD3 注册代码
3. 移除 `src/shells/zzz/styles/themes.css` 中的 MD3 变量
4. 删除 `MD3AppShell` 组件
5. 简化 `themeStore`：移除 MD3 选项，只保留 Shell 内主题变体
6. 清理 `composeProviders.tsx` 中的 MD3 Provider
7. 全局搜索 `md3|MD3|material.*design.*3` 确认无残留
8. 验证：`pnpm build` 通过，ZZZ Shell 功能正常

### 9.3 阶段 3：SwiftUI Shell

**目标**：实现第一个新 Shell，验证多 Shell 架构可行性。

**步骤**：

1. 创建 `src/shells/swiftui/` 骨架目录
2. 创建 `tokens-swiftui.css`（设计令牌）
3. 创建 `themes-swiftui.css`（浅色/深色模式）
4. 实现 `AppShell.tsx`（侧边栏 + 内容区布局）
5. 逐页实现：
   - HomePage（当前实例 + 启动按钮）
   - MarketplacePage（搜索 + 分类 + 列表）
   - ContentDetailPage（描述 + 版本 + 安装）
   - InstancesPage（实例列表）
   - InstanceDetailPage（实例详情）
   - LibraryPage（已安装内容）
   - SettingsPage（配置项 + Shell 切换器）
6. 实现基础 UI 组件（Button, Modal, Tabs, Card 等）
7. 在设置页添加 Shell 切换器 UI
8. 验证：ZZZ ↔ SwiftUI 切换流畅，功能一致

### 9.4 阶段 4+：Fluent Shell、TV Shell

按照阶段 3 的模式依次实现。每个 Shell 的开发独立进行，不影响其他 Shell。

---

## 10. 风险与缓解

| 风险 | 严重性 | 缓解措施 |
|------|--------|---------|
| 迁移导致 ZZZ Shell 回归 | 高 | 阶段 1 纯迁移不改功能，每步可验证；迁移前后截图对比 |
| Shell 切换时状态丢失 | 高 | stores 在 shared/ 层，不随 Shell 组件卸载而丢失；React Context 保持挂载 |
| 共享 hooks 与 Shell 耦合 | 中 | hooks 只返回数据/callback，不返回 JSX；接口评审时检查 |
| 包体积膨胀（4 套 UI） | 中 | React.lazy 按需加载，未使用的 Shell 不打入初始包；Vite 自动 tree-shake |
| CSS 类名冲突 | 低 | CSS Modules 天然隔离，每个 Shell 独立作用域 |
| Shell 间功能不一致 | 中 | ShellDefinition.supportedRoutes 声明功能范围；路由守卫处理不支持的路由 |
| 导入路径迁移遗漏 | 中 | TypeScript 编译器会捕获遗漏；全局搜索验证 |
| TV Shell 焦点管理复杂 | 中 | 独立 useFocusManager hook，可单独测试和迭代 |

---

## 11. 测试策略

### 11.1 单元测试

- `shell-registry.ts`：注册、获取、重复注册、未注册 Shell 错误处理
- `shellStore`：状态切换、持久化调用
- 共享 hooks：useInstallFlow、useDownloadProgress 的状态流转

### 11.2 集成测试

- Shell 切换：ZZZ → SwiftUI → Fluent → TV → ZZZ 循环切换，状态保持
- 路由守卫：TV Shell 访问不支持路由时的重定向
- 懒加载：首次切换 Shell 时 chunk 下载，二次切换命中缓存

### 11.3 视觉回归测试

- ZZZ Shell 迁移前后截图对比（每个页面）
- 各 Shell 的关键页面截图基线

---

## 12. 性能考量

### 12.1 初始加载

- 主入口 + shared/ 代码 + 当前 Shell chunk
- 预估：~500KB gzipped（与当前单 Shell 相当）
- 其他 Shell chunk 不加载

### 12.2 Shell 切换

- 首次切换：下载 Shell chunk（~100-300KB gzipped）+ 渲染
- 后续切换：chunk 已缓存，仅组件重渲染
- 切换期间：Suspense 显示加载画面

### 12.3 内存

- 同一时刻只有一个 Shell 的组件树在内存中
- React.lazy 切换时旧 Shell 组件卸载，新 Shell 组件挂载
- shared/stores 始终在内存中（不随 Shell 切换卸载）

### 12.4 包体积

- 每个 Shell 是独立 chunk，互不影响
- shared/ 代码只打包一次
- Vite tree-shaking 确保未使用的代码不打包
