# BonNext 插件化架构设计

**日期**: 2026-06-19
**状态**: 已批准
**作者**: Brainstorming Session

## 1. 概述

将 BonNext 从单体架构重构为"最小核心 + 插件系统"架构。仅保留启动器最基础功能在核心中，其余功能（市场、社交、AI、服务器、安全等）全部插件化。

### 1.1 目标

- **最小核心**: 仅保留版本管理、下载、启动、实例CRUD、认证、Java检测、配置（~50个后端命令）
- **前后端都插件化**: 后端通过 Cargo feature flag 控制，前端通过动态 `import()` 加载
- **简化插件 API**: 删除现有复杂的 ServiceRegistry/ExtensionPoint/DependencyResolver，用 `ctx.registerXxx()` 直接注册
- **UI 注入**: 插件可注入路由、侧边栏、设置页、上下文菜单、实例标签页、主题
- **后端访问**: 插件可通过 `ctx.invoke`/`ctx.http`/`ctx.fs`/`ctx.events` 访问后端能力
- **生态机制**: 内置插件默认启用，支持从 `.zip` 文件或 URL 安装第三方插件
- **删除多 Shell 架构**: 默认 ZZZ Shell，Swift Shell 作为插件

### 1.2 非目标

- 不实现官方插件市场（仅支持本地文件/URL 安装）
- 不实现插件代码沙箱（通过权限声明 + 用户审批控制）
- 不支持运行时动态加载 Rust 后端代码（后端通过 feature flag 编译时确定）

## 2. 核心范围

以下功能保留在核心中，不可插件化：

| 模块 | 前端 | 后端 | 命令数 |
|------|------|------|--------|
| 版本管理 | `src/shared/api/versions.ts` | `src-tauri/src/version/` | ~5 |
| 下载系统 | `src/shared/api/versions.ts` | `src-tauri/src/download/` | ~5 |
| 启动器 | `src/shared/api/instances.ts` (launchGame) | `src-tauri/src/launch/` | ~3 |
| 实例 CRUD | `src/shared/api/instances.ts` | `src-tauri/src/instance/` | ~8 |
| 认证 | `src/shared/api/auth.ts` | `src-tauri/src/auth/` | ~8 |
| Java 检测 | `src/shared/api/instances.ts` | `src-tauri/src/platform/java.rs` | ~5 |
| 配置 | `src/shared/api/instances.ts` | `src-tauri/src/config.rs` | ~2 |
| 平台抽象 | — | `src-tauri/src/platform/` | 0 |
| 错误处理 | `src/shared/api/errors.ts` | `src-tauri/src/error.rs` | 0 |
| HTTP 客户端 | — | `src-tauri/src/http_client.rs` | 0 |
| 缓存 | `src/shared/api/cache.ts` | `src-tauri/src/cache.rs` | 0 |
| 加密 | — | `src-tauri/src/security/crypto.rs` | 0 |
| 凭证存储 | — | `src-tauri/src/security/credential_store.rs` | 0 |
| Shell 系统 | `src/shell-registry.ts` | `src-tauri/src/commands/shell.rs` | ~6 |

**总计**: ~50 个后端命令

## 3. 插件包格式

插件以 `.zip` 文件分发，解压后结构：

```
my-plugin/
├── manifest.json      # 元数据、权限、依赖、UI 贡献声明
├── index.js           # ES module 入口（打包后的 JS bundle）
├── styles.css         # 可选 CSS
└── assets/            # 可选静态资源（图标等）
```

### 3.1 manifest.json

```json
{
  "id": "com.bonnext.marketplace",
  "name": "Marketplace",
  "version": "1.0.0",
  "description": "Modrinth & CurseForge content browser",
  "author": "BonNext",
  "minAppVersion": "1.0.0",
  "dependencies": [],
  "permissions": [
    "http:modrinth.com",
    "http:curseforge.com",
    "fs:read:instances",
    "invoke:core",
    "invoke:marketplace"
  ],
  "contributes": {
    "routes": [
      { "path": "/store", "component": "StorePage" },
      { "path": "/store/:type/:slug", "component": "ContentDetailPage" }
    ],
    "sidebar": [
      { "id": "store", "label": "Store", "icon": "🛒", "route": "/store", "order": 2 }
    ],
    "settings": [
      { "id": "marketplace", "label": "Marketplace", "component": "MarketplaceSettings", "order": 5 }
    ]
  }
}
```

### 3.2 权限模型

| 权限 | 说明 |
|------|------|
| `http:<domain>` | 允许向指定域名发起 HTTP 请求 |
| `fs:read:<scope>` | 允许读取文件，scope 可为 `instances`/`config`/`global` |
| `fs:write:<scope>` | 允许写入文件 |
| `invoke:core` | 允许调用核心命令 |
| `invoke:<namespace>` | 允许调用指定命名空间的后端命令 |
| `events:listen` | 允许监听事件总线 |
| `events:emit` | 允许发送事件 |

权限在插件激活时校验，未声明的权限调用将被拒绝并记录警告日志。

## 4. 插件 API

### 4.1 definePlugin() 辅助函数

```typescript
// src/plugins/core/definePlugin.ts
import type { PluginContext, PluginDefinition } from './types';

export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
```

### 4.2 PluginDefinition 接口

```typescript
interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
```

### 4.3 PluginContext 接口

```typescript
interface PluginContext {
  // 元数据
  pluginId: string;

  // UI 注入
  registerRoute(path: string, lazyComponent: () => Promise<{ default: React.ComponentType }>): void;
  addSidebarItem(item: SidebarItem): void;
  addSettingsSection(section: SettingsSection): void;
  addContextMenuItem(item: ContextMenuItem): void;
  addInstanceTab(tab: InstanceTab): void;
  registerTheme(theme: ThemeContribution): void;

  // 后端访问
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;

  // 通用能力
  http: PluginHttpClient;
  fs: PluginFileSystem;
  events: PluginEventBus;

  // 存储
  storage: PluginStorage;

  // 日志
  logger: PluginLogger;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  order: number;
}

interface SettingsSection {
  id: string;
  label: string;
  component: () => Promise<{ default: React.ComponentType }>;
  order: number;
}

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: (context: { type: string; data: unknown }) => void;
  where: string[]; // 如 ['instance', 'mod', 'server']
}

interface InstanceTab {
  id: string;
  label: string;
  component: () => Promise<{ default: React.ComponentType }>;
  order: number;
}

interface ThemeContribution {
  id: string;
  name: string;
  cssVariables: Record<string, string>;
  mode: 'light' | 'dark' | 'auto';
}

interface PluginHttpClient {
  get(url: string, options?: { params?: Record<string, string>; headers?: Record<string, string> }): Promise<unknown>;
  post(url: string, body: unknown, options?: { headers?: Record<string, string> }): Promise<unknown>;
}

interface PluginFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
}

interface PluginEventBus {
  on(event: string, handler: (data: unknown) => void): () => void;
  emit(event: string, data: unknown): void;
}

interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

### 4.4 插件入口示例

```typescript
// plugins/builtins/marketplace/index.ts
import { definePlugin } from '@bonnext/plugin-sdk';

export default definePlugin({
  id: 'com.bonnext.marketplace',
  name: 'Marketplace',
  version: '1.0.0',

  activate(ctx) {
    ctx.registerRoute('/store', () => import('./pages/StorePage'));
    ctx.registerRoute('/store/:type/:slug', () => import('./pages/ContentDetailPage'));
    ctx.addSidebarItem({ id: 'store', label: 'Store', icon: '🛒', route: '/store', order: 2 });
    ctx.addSettingsSection({ id: 'marketplace', label: 'Marketplace', component: () => import('./settings'), order: 5 });

    ctx.events.on('instance:created', () => {
      ctx.logger.info('New instance created, refreshing recommendations');
    });
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});
```

## 5. UI 注入点

| 注入点 | API | 说明 |
|--------|-----|------|
| 路由页面 | `ctx.registerRoute(path, lazyComponent)` | 注册新页面路由 |
| 侧边栏项 | `ctx.addSidebarItem(item)` | 添加左侧导航项 |
| 设置页 section | `ctx.addSettingsSection(section)` | 添加设置页分区 |
| 上下文菜单项 | `ctx.addContextMenuItem(item)` | 右键菜单项 |
| 实例详情标签页 | `ctx.addInstanceTab(tab)` | 实例详情页新标签页 |
| 主题 | `ctx.registerTheme(theme)` | 注册主题 |

### 5.1 实现机制

核心 UI 组件从 PluginManager 读取已注册的注入项：

```typescript
// src/app/components/Sidebar.tsx
function Sidebar() {
  const pluginManager = usePluginManager();
  const items = pluginManager.getSidebarItems(); // 返回所有插件注册的侧边栏项
  // 渲染核心项 + 插件项，按 order 排序
}

// src/app/components/SettingsPage.tsx
function SettingsPage() {
  const pluginManager = usePluginManager();
  const sections = pluginManager.getSettingsSections(); // 返回所有插件注册的设置分区
  // 渲染核心设置 + 插件设置，按 order 排序
}
```

路由注入通过动态 `<Routes>` 生成：

```typescript
// src/app/AppRoutes.tsx
function AppRoutes() {
  const pluginManager = usePluginManager();
  const pluginRoutes = pluginManager.getRoutes(); // [{ path, lazyComponent }]

  return (
    <Routes>
      {/* 核心路由 */}
      <Route path="/home" element={<HomePage />} />
      <Route path="/instances" element={<InstancesPage />} />
      ...
      {/* 插件路由 */}
      {pluginRoutes.map(r => (
        <Route key={r.path} path={r.path} element={<Suspense fallback={<Loading />}><r.lazyComponent /></Suspense>} />
      ))}
    </Routes>
  );
}
```

## 6. 后端访问

### 6.1 调用核心命令

```typescript
const instances = await ctx.invoke('list_instances');
await ctx.invoke('launch_game', { versionId, ... });
```

核心命令不加命名空间前缀。

### 6.2 调用插件命名空间命令

```typescript
const results = await ctx.invoke('marketplace:search', { query });
```

后端命令注册时使用插件 ID 前缀作为命名空间。Feature flag 控制是否编译：

```rust
// src-tauri/src/commands/marketplace.rs
#[cfg(feature = "plugin-marketplace")]
#[tauri::command]
pub async fn marketplace_search(query: String) -> Result<...> { ... }
```

### 6.3 核心通用能力

**ctx.http**: 通过核心后端代理 HTTP 请求，受权限中的 `http:<domain>` 控制。

**ctx.fs**: 通过核心后端文件系统命令，受权限中的 `fs:read/write:<scope>` 控制。

**ctx.events**: 纯前端事件总线，插件间通信。核心也发布事件（如 `instance:launched`、`download:completed`）。

## 7. 插件生命周期

```
安装 → 注册 → 激活 → 运行 → 停用 → 卸载
         ↑                ↓
         └──── 重新激活 ←──┘
```

| 阶段 | 说明 |
|------|------|
| 安装 | 解压 `.zip` 到 `game_dir/plugins/<id>/`，校验 manifest.json |
| 注册 | PluginManager 读取 manifest，注册到 Registry |
| 激活 | 校验权限 → 校验依赖 → 调用 `plugin.activate(ctx)` → 注册 UI 注入项 |
| 运行 | 插件功能可用，响应用户交互 |
| 停用 | 调用 `plugin.deactivate()` → 自动清理所有注册项 |
| 卸载 | 从 `game_dir/plugins/` 删除目录 |

## 8. 内置插件清单

| 插件 ID | 名称 | 包含模块 | 后端命令数 |
|---------|------|---------|-----------|
| `com.bonnext.marketplace` | 市场 | Modrinth + CurseForge + ModpackIndex + 搜索 + 收藏 + 内容安装 + 优化预设 | ~40 |
| `com.bonnext.social` | 社交 | 好友 + 聊天 + P2P + Discord RPC | ~25 |
| `com.bonnext.ai` | AI 助手 | AI 聊天 + 工作流 + 崩溃分析 | ~10 |
| `com.bonnext.servers` | 服务器 | 服务器列表 + Ping + LAN 发现 + Terracotta | ~15 |
| `com.bonnext.security` | 安全 | 审计日志 + 凭证迁移 + JVM白名单 + 沙箱 + 文件权限 | ~15 |
| `com.bonnext.mod-tools` | Mod 工具 | Mod 扫描 + 监视 + 兼容性检查 | ~10 |
| `com.bonnext.system-tools` | 系统工具 | 成就 + 新闻 + 快照 + 迁移工具 + 优化建议 + 性能分析 | ~15 |
| `com.bonnext.shell.swiftui` | Swift Shell | SwiftUI 风格 Shell | 0 |

**注意**: 加密（AES-256-GCM）和凭证存储的核心实现保留在后端核心中，因为认证模块依赖它。安全插件只提供 UI 和管理功能。

## 9. 文件结构

```
src/
├── app/                          # 核心 UI（原 ZZZ Shell 简化）
│   ├── components/               # 核心组件（Sidebar, SettingsPage, AppRoutes）
│   ├── pages/                    # 核心页面（Home, Instances, Versions, Settings）
│   ├── App.tsx
│   └── providers/
├── plugins/
│   ├── core/                     # 插件系统核心
│   │   ├── types.ts              # PluginDefinition, PluginContext 等接口
│   │   ├── definePlugin.ts       # definePlugin() 辅助函数
│   │   ├── PluginManager.ts      # 插件管理器（简化版）
│   │   ├── PluginContext.ts      # PluginContext 实现
│   │   ├── PluginLoader.ts       # 插件加载器
│   │   ├── PluginProvider.tsx    # React Provider
│   │   ├── permission.ts         # 权限校验
│   │   └── eventBus.ts           # 事件总线
│   └── builtins/                 # 内置插件
│       ├── marketplace/
│       │   ├── manifest.json
│       │   ├── index.ts
│       │   ├── pages/
│       │   ├── components/
│       │   └── settings/
│       ├── social/
│       ├── ai/
│       ├── servers/
│       ├── security/
│       ├── mod-tools/
│       ├── system-tools/
│       └── shell-swiftui/
├── shared/                       # 核心共享代码
│   ├── api/                      # 核心 API（仅保留核心命令）
│   ├── stores/                   # 核心 stores
│   ├── types/
│   └── utils/
└── plugin-sdk/                   # 插件开发 SDK（发布为 npm 包）
    ├── index.ts                  # 导出 definePlugin, 类型
    └── types.ts                  # 类型定义

src-tauri/
├── src/
│   ├── core/                     # 核心后端模块
│   │   ├── version/
│   │   ├── download/
│   │   ├── launch/
│   │   ├── instance/
│   │   ├── auth/
│   │   ├── platform/
│   │   ├── config.rs
│   │   ├── error.rs
│   │   ├── http_client.rs
│   │   └── security/             # 仅 crypto + credential_store
│   ├── plugins/                  # 插件后端模块（feature flag 控制）
│   │   ├── marketplace.rs        # #[cfg(feature = "plugin-marketplace")]
│   │   ├── social.rs
│   │   ├── ai.rs
│   │   ├── servers.rs
│   │   ├── security.rs
│   │   ├── mod_tools.rs
│   │   └── system_tools.rs
│   ├── commands/                 # 命令注册（按命名空间分组）
│   └── lib.rs                    # 入口，feature flag 条件注册
└── Cargo.toml                    # feature flag 定义
```

### 9.1 Cargo.toml feature flags

```toml
[features]
default = [
    "plugin-marketplace",
    "plugin-social",
    "plugin-ai",
    "plugin-servers",
    "plugin-security",
    "plugin-mod-tools",
    "plugin-system-tools",
]
plugin-marketplace = []
plugin-social = []
plugin-ai = []
plugin-servers = []
plugin-security = []
plugin-mod-tools = []
plugin-system-tools = []
```

## 10. 迁移策略（5 阶段）

### 阶段 1：重构插件系统基础（不改变现有功能）

- 重写 `src/plugins/` 核心：简化 API、添加 `definePlugin()`、实现 `PluginContext` 新接口
- 实现 UI 注入点机制（路由/侧边栏/设置/上下文菜单/实例标签页/主题）
- 实现 `ctx.invoke`/`ctx.http`/`ctx.fs`/`ctx.events`
- 将 `PluginProvider` 接入 `AppProviders` 链
- 后端：实现命令命名空间隔离 + feature flag 框架
- 创建 `plugin-sdk/` 包，导出 `definePlugin` 和类型

### 阶段 2：迁移第一个插件 — Marketplace

- 将 Modrinth/CurseForge/ModpackIndex 前端代码移入 `plugins/builtins/marketplace/`
- 后端命令加 `marketplace:` 命名空间前缀，加 `#[cfg(feature = "plugin-marketplace")]`
- 验证插件 API 是否足够，迭代改进

### 阶段 3：迁移其余插件

按顺序迁移：
1. system-tools（成就 + 新闻 + 快照 + 迁移 + 优化 + 性能分析）
2. servers（服务器列表 + Ping + LAN + Terracotta）
3. security（审计 + 凭证迁移 + JVM白名单 + 沙箱 + 文件权限）
4. mod-tools（Mod 扫描 + 监视 + 兼容性）
5. social（好友 + 聊天 + P2P + Discord RPC）
6. ai（AI 聊天 + 工作流 + 崩溃分析）
7. shell-swiftui（SwiftUI Shell）

每个插件迁移后运行 `tsc --noEmit` + `cargo check` 验证。

### 阶段 4：删除多 Shell 架构

- 移除 `shell-registry.ts` 多 shell 调度逻辑
- ZZZ Shell 代码移入 `src/app/`（成为唯一内置 UI）
- Swift Shell 作为插件保留在 `plugins/builtins/shell-swiftui/`
- Editor Shell 作为插件保留在 `plugins/builtins/shell-editor/`（可视化 Shell 编辑器是元工具，有独立价值）

### 阶段 5：插件生态完善

- 实现插件安装/卸载/更新 UI（设置页新增"插件管理"section）
- 实现插件依赖检查
- 实现插件权限审批 UI（安装时展示权限列表，用户确认）
- 编写插件开发指南文档

## 11. 与现有系统的关系

### 11.1 删除的现有代码

- `src/plugins/core/PluginRegistry.ts` — 用简化的 PluginManager 替代
- `src/plugins/core/ServiceRegistry.ts` — 删除，用事件总线替代
- `src/plugins/core/DependencyResolver.ts` — 简化为 manifest.json 中的 dependencies 数组
- `src/plugins/extensions/ExtensionPoint.ts` — 删除，用 ctx.registerXxx() 替代
- `src/plugins/extensions/ThemeExtensionPoint.ts` — 删除，用 ctx.registerTheme() 替代
- `src/plugins/builtins/zzz-theme/` — 主题功能移入核心或作为独立主题插件
- `src/shell-registry.ts` — 多 shell 调度删除
- `src/shells/swiftui/` — 移入 `plugins/builtins/shell-swiftui/`
- `src/shells/editor/` — 移入 `plugins/builtins/shell-editor/` 或删除

### 11.2 保留的现有代码

- `src/shells/zzz/` — 移入 `src/app/`，成为核心 UI
- `src/shared/api/` — 仅保留核心命令的 API 文件
- `src/shared/stores/` — 仅保留核心 stores（auth, config, instance, toast, theme, download）
- `src-tauri/src/` 核心模块 — 保留

## 12. 已知设计决策（审查记录 2026-06-20）

本节记录插件架构实现过程中做出的、与原始设计有偏差或需明确说明的决策。

### 12.1 内置插件自动激活，绕过用户权限审批

**决策**: 内置插件（`src/plugins/builtins/`）在应用启动时由 `PluginLoader.loadAndActivateAll()` 自动注册并激活，不经过用户权限审批对话框。

**原因**: 内置插件随应用分发，其权限已由开发者审核，无需再次询问用户。第三方插件（通过 `.zip`/URL 安装）仍需用户在安装/激活时审批权限（见 `PluginManagementSection.tsx`）。

**注意**: 内置插件仍受 `PermissionValidator` 运行时约束 — 其 manifest 中声明的权限决定了 `ctx.invoke`/`ctx.http`/`ctx.fs`/`ctx.events` 的可用范围。仅"审批"步骤被跳过，权限执行并未绕过。

**相关代码**: [PluginLoader.ts](file:///Users/xiatian/Desktop/BonNext/src/plugins/core/PluginLoader.ts)、[PluginManager.ts activateAll()](file:///Users/xiatian/Desktop/BonNext/src/plugins/core/PluginManager.ts)

### 12.2 已安装第三方插件 activate 为空操作（占位）

**决策**: 通过 `list_installed_plugins` 后端命令发现的第三方插件，其 `activate()` 为空操作（no-op），不会执行任何实际功能。

**原因**: 真正的动态 `import()` 加载插件入口 JS 需要打包系统支持（将插件入口打包为可动态加载的模块），当前不具备。为让已安装插件能出现在插件管理 UI 中（展示其 manifest、权限、版本），采用占位 `PluginDefinition`。

**影响**: 已安装的第三方插件在 UI 中可见但无实际效果。待打包系统实现后，`createPlaceholderDefinition()` 应替换为通过 `import()` 加载插件入口模块的真实 definition。

**相关代码**: [PluginLoader.ts createPlaceholderDefinition()](file:///Users/xiatian/Desktop/BonNext/src/plugins/core/PluginLoader.ts)

### 12.3 Social / AI 功能 UI 硬编码在 Shell 中，未插件化

**决策**: Social 功能（好友面板 `FriendsPanel`）直接硬编码在 `src/shells/zzz/` 中，由 `socialStore` 驱动，而非由 social 插件通过 `ctx.registerSidebarItem()` 等注入。AI 功能仅有后端命令（`ai_chat`），前端无任何 UI。

**原因**: 这些功能在插件化重构前已存在于 shell 中，且与 shell 布局深度耦合（如 `FriendsPanel` 作为侧边栏抽屉）。将其迁移为插件注入需要重构 shell 的布局系统，超出本次插件架构审查范围。

**后续**: 待 shell 布局支持插件注入的侧边栏抽屉/面板后，应将 `FriendsPanel` 迁移为 social 插件的 `contributes.sidebar` 贡献项。AI 聊天 UI 应作为独立 ai 插件实现。

**相关代码**: [AppShell.tsx FriendsPanel 引用](file:///Users/xiatian/Desktop/BonNext/src/shells/zzz/AppShell.tsx)、[FriendsPanel.tsx](file:///Users/xiatian/Desktop/BonNext/src/shells/zzz/components/social/FriendsPanel.tsx)

### 12.4 后端命令命名空间映射（COMMAND_NAMESPACE_MAP）

**决策**: 后端 Tauri 命令使用扁平命名（如 `search_mods`、`list_friends`、`ping_server`），未按插件域分组为 `marketplace:search_mods` 等命名空间形式。前端 `PermissionValidator` 通过 `COMMAND_NAMESPACE_MAP` 映射表将扁平命令名映射到插件命名空间，使 `invoke:marketplace` 等权限能匹配实际命令名。

**原因**: 重命名所有后端命令会破坏整个项目（需同步修改 `lib.rs` 注册、所有 `api/*.ts` 调用、所有 React 组件），风险过高。映射表方案以最小改动实现权限校验。

**风险**: 映射表需手动维护 — 新增后端命令时必须同步更新 `COMMAND_NAMESPACE_MAP`，否则该命令会被归入 `core` 命名空间（默认放行）。

**相关代码**: [PermissionValidator.ts COMMAND_NAMESPACE_MAP](file:///Users/xiatian/Desktop/BonNext/src/plugins/core/PermissionValidator.ts)

### 12.5 Cargo plugin-* feature flags 为预留，未实际使用

**决策**: `src-tauri/Cargo.toml` 定义了 7 个 `plugin-*` feature（marketplace/social/ai/servers/security/mod-tools/system-tools），全部包含在 `default` 中，但代码中无任何 `#[cfg(feature = "plugin-*")]` 使用。

**原因**: 这些 feature 为未来"最小核心构建"预留 — 届时可通过 `--no-default-features` 构建仅含核心功能的精简版，再按需启用插件域 feature。当前所有功能默认全开，无需条件编译。

**后续**: 实现精简构建时，需在 `lib.rs` 的 `invoke_handler!` 宏中按 feature 门控各域命令注册（需将单个宏调用拆分为多个条件块）。

**相关代码**: [Cargo.toml features](file:///Users/xiatian/Desktop/BonNext/src-tauri/Cargo.toml)
