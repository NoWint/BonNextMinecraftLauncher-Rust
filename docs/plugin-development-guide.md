# BonNext 插件开发指南

> 本文档面向希望为 BonNext Minecraft Launcher 开发插件的第三方开发者。
> 适用于 BonNext v1.0.0 及以上版本的插件系统（Phase 5 交付物）。

---

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [插件清单 manifest.json](#3-插件清单-manifestjson)
4. [插件定义 definePlugin](#4-插件定义-defineplugin)
5. [插件上下文 PluginContext](#5-插件上下文-plugincontext)
6. [权限系统](#6-权限系统)
7. [核心事件](#7-核心事件)
8. [打包与安装](#8-打包与安装)
9. [完整示例](#9-完整示例)
10. [调试技巧](#10-调试技巧)

---

## 1. 概述

### 1.1 什么是 BonNext 插件系统

BonNext 采用 **"最小核心 + 插件系统"** 架构。启动器核心仅保留版本管理、下载、启动、实例 CRUD、认证、Java 检测、配置等基础功能（约 50 个后端命令），其余功能（市场、社交、AI、服务器、安全、Mod 工具等）全部以插件形式存在。

插件是一个独立的 ES Module 包，通过 `definePlugin()` 函数定义，在 `activate(ctx)` 生命周期中通过 `ctx`（PluginContext）向核心注册 UI 注入项、监听事件、访问后端能力。插件之间通过事件总线松耦合通信。

### 1.2 插件能做什么

通过 `PluginContext` 提供的 API，插件可以：

| 能力             | API                                        | 说明                         |
| ---------------- | ------------------------------------------ | ---------------------------- |
| 注册路由页面     | `ctx.registerRoute(path, lazyComponent)`   | 向启动器注册新的页面路由     |
| 添加侧边栏项     | `ctx.addSidebarItem(item)`                 | 在左侧导航栏添加入口         |
| 添加设置页分区   | `ctx.addSettingsSection(section)`          | 在设置页添加自定义分区       |
| 添加上下文菜单项 | `ctx.addContextMenuItem(item)`             | 在右键菜单中添加操作项       |
| 添加实例标签页   | `ctx.addInstanceTab(tab)`                  | 在实例详情页添加新标签页     |
| 注册主题         | `ctx.registerTheme(theme)`                 | 注册自定义主题（亮/暗/OLED） |
| 调用后端命令     | `ctx.invoke<T>(command, args)`             | 调用核心或命名空间后端命令   |
| HTTP 请求        | `ctx.http.get/post(url, ...)`              | 通过后端代理发起 HTTP 请求   |
| 文件操作         | `ctx.fs.readFile/writeFile/readDir/exists` | 受限作用域的文件读写         |
| 事件总线         | `ctx.events.on/emit(event, data)`          | 监听核心事件或插件间通信     |
| 持久化存储       | `ctx.storage.get/set/delete(key)`          | 插件专属键值存储             |
| 日志输出         | `ctx.logger.info/warn/error(message)`      | 带插件 ID 前缀的日志         |

### 1.3 插件不能做什么

- **不支持运行时加载 Rust 后端代码**：后端能力通过 Cargo feature flag 在编译时确定，插件只能调用已编译进启动器的后端命令（核心命令或已启用 feature 的命名空间命令）。
- **不提供官方插件市场**：当前仅支持从本地 `.zip` 文件安装第三方插件。
- **无代码沙箱**：插件运行在主进程的 JS 上下文中，通过权限声明 + 用户审批机制控制风险，而非沙箱隔离。请仅安装可信来源的插件。

---

## 2. 快速开始

### 2.1 创建插件目录结构

一个最小的插件包目录结构如下：

```
my-plugin/
├── manifest.json      # 插件清单（元数据、权限、依赖、UI 贡献声明）
├── index.js           # ES module 入口（打包后的 JS bundle）
└── assets/            # 可选：静态资源（图标等）
```

> **注意**：开发时建议使用 TypeScript 编写 `index.ts`，然后通过 Vite/esbuild 等工具打包为单个 `index.js` ES module。`manifest.json` 中的 `contributes` 字段是声明性提示，**实际的 UI 注册必须在 `activate(ctx)` 中通过 `ctx.registerXxx()` 完成**。

### 2.2 编写 manifest.json

```json
{
  "id": "com.example.hello",
  "name": "Hello Plugin",
  "version": "1.0.0",
  "description": "一个最小示例插件",
  "author": "Your Name",
  "minAppVersion": "1.0.0",
  "dependencies": [],
  "permissions": ["events:listen", "storage:*"],
  "contributes": {
    "routes": [],
    "sidebar": [],
    "settings": []
  }
}
```

### 2.3 编写 index.ts

```typescript
import { definePlugin } from '@bonnext/plugin-sdk';
import type { PluginContext } from '@bonnext/plugin-sdk';

export default definePlugin({
  id: 'com.example.hello',
  name: 'Hello Plugin',
  version: '1.0.0',
  description: '一个最小示例插件',

  activate(ctx: PluginContext) {
    ctx.logger.info('Hello Plugin 已激活');
    // 在这里通过 ctx 注册 UI 注入项、监听事件等
  },

  deactivate() {
    // 可选：清理插件运行时创建的非托管资源
    // ctx 注册的 UI 注入项会由 PluginManager 自动清理，无需手动移除
  },
});
```

### 2.4 最小示例代码

下面是一个会监听实例创建事件并打印日志的完整最小插件：

```typescript
// index.ts
import { definePlugin } from '@bonnext/plugin-sdk';

export default definePlugin({
  id: 'com.example.hello',
  name: 'Hello Plugin',
  version: '1.0.0',

  activate(ctx) {
    ctx.logger.info('Hello Plugin 已激活');

    ctx.events.on('instance:created', (data) => {
      ctx.logger.info('检测到新实例创建:', data);
    });
  },
});
```

对应的 `manifest.json` 需声明 `events:listen` 权限：

```json
{
  "id": "com.example.hello",
  "name": "Hello Plugin",
  "version": "1.0.0",
  "permissions": ["events:listen"]
}
```

---

## 3. 插件清单 (manifest.json)

`manifest.json` 是插件的元数据文件，描述插件的身份、依赖、权限和 UI 贡献。它对应 `PluginManifest` 接口：

```typescript
interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  minAppVersion?: string;
  dependencies?: string[];
  permissions?: string[];
  contributes?: {
    routes?: Array<{ path: string; component: string }>;
    sidebar?: Array<{ id: string; label: string; icon: string; route: string; order: number }>;
    settings?: Array<{ id: string; label: string; component: string; order: number }>;
  };
}
```

### 3.1 字段说明

| 字段            | 类型       | 必填 | 说明                                                      |
| --------------- | ---------- | ---- | --------------------------------------------------------- |
| `id`            | `string`   | 是   | 插件唯一标识符，需符合命名规范（见 3.2）                  |
| `name`          | `string`   | 是   | 插件显示名称（人类可读）                                  |
| `version`       | `string`   | 是   | 插件版本号，建议使用语义化版本（如 `1.0.0`）              |
| `description`   | `string`   | 否   | 插件功能描述                                              |
| `author`        | `string`   | 否   | 作者名称                                                  |
| `minAppVersion` | `string`   | 否   | 所需的最小启动器版本，激活时会校验                        |
| `dependencies`  | `string[]` | 否   | 依赖的其他插件 ID 列表，激活前会检查这些插件是否已激活    |
| `permissions`   | `string[]` | 否   | 权限声明列表，详见 [第 6 节](#6-权限系统)                 |
| `contributes`   | `object`   | 否   | UI 贡献声明（声明性提示，实际注册在 `activate()` 中完成） |

### 3.2 id 命名规范

- 只能包含 **字母、数字、点（`.`）、短横线（`-`）**
- 建议使用反向域名格式，例如 `com.bonnext.marketplace`、`com.example.my-plugin`
- 必须全局唯一，与已注册的插件 ID 冲突时将被忽略（注册是幂等的）
- 内置插件使用 `com.bonnext.*` 前缀，第三方插件请勿使用该前缀

### 3.3 contributes 字段说明

`contributes` 是声明性字段，用于在插件管理界面展示插件计划贡献的 UI 项。**它不会自动注册 UI**——实际的 UI 注册必须在 `activate(ctx)` 中通过对应的 `ctx.registerXxx()` / `ctx.addXxx()` 方法完成。

```json
"contributes": {
  "routes": [
    { "path": "/store", "component": "MarketplacePage" }
  ],
  "sidebar": [
    { "id": "store", "label": "Store", "icon": "🛒", "route": "/store", "order": 2 }
  ],
  "settings": [
    { "id": "marketplace", "label": "Marketplace", "component": "MarketplaceSettings", "order": 5 }
  ]
}
```

- `routes[].component` / `settings[].component`：字符串形式的组件名，仅用于展示，实际加载由 `activate()` 中的 `() => import(...)` 决定
- `sidebar[].order` / `settings[].order`：排序权重，数值越小越靠前

### 3.4 完整 manifest 示例

参考内置 Marketplace 插件的 `manifest.json`：

```json
{
  "id": "com.bonnext.marketplace",
  "name": "Marketplace",
  "version": "1.0.0",
  "description": "Modrinth & CurseForge & ModpackIndex content browser, search, collections, and optimization presets",
  "author": "BonNext",
  "minAppVersion": "1.0.0",
  "dependencies": [],
  "permissions": [
    "http:modrinth.com",
    "http:curseforge.com",
    "http:modpackindex.com",
    "fs:read:instances",
    "fs:write:instances",
    "invoke:core",
    "invoke:marketplace",
    "events:listen",
    "events:emit"
  ],
  "contributes": {
    "routes": [
      { "path": "/store", "component": "MarketplacePage" },
      { "path": "/store/:type/:slug", "component": "ContentDetailPage" }
    ],
    "sidebar": [{ "id": "marketplace", "label": "Store", "icon": "🛒", "route": "/store", "order": 2 }],
    "settings": []
  }
}
```

---

## 4. 插件定义 (definePlugin)

### 4.1 PluginDefinition 接口

`definePlugin()` 是一个类型辅助函数，接收 `PluginDefinition` 对象并原样返回，主要作用是提供 TypeScript 类型推导：

```typescript
// src/plugins/core/definePlugin.ts
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
```

`PluginDefinition` 接口定义如下：

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

| 字段                                      | 说明                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `id` / `name` / `version` / `description` | 与 `manifest.json` 中对应字段保持一致                                            |
| `activate(ctx)`                           | **必需**。插件激活时调用，接收 `PluginContext`。所有 UI 注册和事件监听应在此完成 |
| `deactivate()`                            | **可选**。插件停用时调用，用于清理非托管资源                                     |

### 4.2 生命周期

插件生命周期由 `PluginManager` 管理，状态机如下：

```
registered → activating → active → deactivating → inactive
                ↓                                       ↓
              error ←──────────（激活失败）──────────────┘
                                  （可重新激活）
```

| 阶段 | 触发时机                                 | 说明                                                                                                                    |
| ---- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 注册 | `manager.register(definition, manifest)` | 仅记录插件定义，不执行任何代码                                                                                          |
| 激活 | `manager.activate(pluginId)`             | 校验 manifest（minAppVersion + dependencies）→ 创建 `PermissionValidator` → 创建 `PluginContext` → 调用 `activate(ctx)` |
| 运行 | `activate()` 返回后                      | 插件注册的 UI 注入项对核心可见，事件监听器生效                                                                          |
| 停用 | `manager.deactivate(pluginId)`           | 调用 `deactivate()`（若定义）→ 自动清理该插件的所有 UI 注入项（路由/侧边栏/设置/菜单/标签页/主题）                      |
| 卸载 | `manager.unregister(pluginId)`           | 停用 + 从注册表中删除                                                                                                   |

**重要**：`PluginManager` 会在停用时**自动清理**插件通过 `ctx` 注册的所有 UI 注入项，你无需在 `deactivate()` 中手动移除它们。`deactivate()` 仅用于清理插件自行创建的非托管资源（如定时器、WebSocket 连接、外部服务等）。

### 4.3 async activate 的用法

`activate` 支持返回 `Promise`，可用于异步初始化（如从后端加载配置）：

```typescript
export default definePlugin({
  id: 'com.example.async',
  name: 'Async Init Plugin',
  version: '1.0.0',

  async activate(ctx) {
    // 异步加载初始数据
    const config = await ctx.storage.get('config');
    if (!config) {
      await ctx.storage.set('config', { theme: 'dark', pageSize: 20 });
    }

    // 异步调用后端命令
    const instances = await ctx.invoke('list_instances');
    ctx.logger.info(`加载到 ${instances.length} 个实例`);

    // 注册 UI（必须在 activate 完成前注册，否则可能错过首次渲染）
    ctx.addSidebarItem({
      id: 'my-panel',
      label: 'My Panel',
      icon: '🎯',
      route: '/my-panel',
      order: 10,
    });
    ctx.registerRoute('/my-panel', () => import('./MyPanelPage'));
  },
});
```

> **注意**：`PluginManager.activateAll()` 会**串行**激活所有插件（`for...of` + `await`），因此请避免在 `activate()` 中执行耗时过长的同步操作，以免阻塞其他插件和启动器初始化。

---

## 5. 插件上下文 (PluginContext)

`PluginContext`（简称 `ctx`）是插件访问启动器能力的唯一入口，在 `activate(ctx)` 时由 `PluginManager` 创建并传入。它包含以下几组 API：

### 5.1 UI 注入 API

#### `ctx.registerRoute(path, lazyComponent)`

注册一个路由页面。`lazyComponent` 是一个返回动态 `import()` 的函数，核心会用 `<Suspense>` 包裹渲染。

```typescript
ctx.registerRoute('/my-panel', () => import('./MyPanelPage'));
ctx.registerRoute('/my-panel/:id', () => import('./MyPanelDetailPage'));
```

- `path`：路由路径，支持动态参数（如 `:id`、`:type/:slug`），遵循 React Router 路径语法
- `lazyComponent`：`() => Promise<{ default: React.ComponentType<unknown> }>`，即标准的动态 `import()` 形式

#### `ctx.addSidebarItem(item)`

添加左侧导航栏项。

```typescript
ctx.addSidebarItem({
  id: 'my-panel',
  label: 'My Panel',
  icon: '🎯', // emoji 或图标标识
  route: '/my-panel', // 点击时跳转的路由
  order: 10, // 排序权重，数值越小越靠前
});
```

#### `ctx.addSettingsSection(section)`

添加设置页分区。

```typescript
ctx.addSettingsSection({
  id: 'my-settings',
  label: 'My Plugin Settings',
  component: () => import('./MySettingsPage'),
  order: 10,
});
```

#### `ctx.addContextMenuItem(item)`

添加右键上下文菜单项。

```typescript
ctx.addContextMenuItem({
  id: 'my-action',
  label: 'Do Something',
  icon: '⚡',
  where: ['instance'], // 在哪些上下文中显示，如 'instance'、'mod'、'server'
  action: (context) => {
    // context: { type: string; data: unknown }
    ctx.logger.info('执行菜单操作:', context.data);
  },
});
```

#### `ctx.addInstanceTab(tab)`

添加实例详情页的标签页。

```typescript
ctx.addInstanceTab({
  id: 'my-instance-tab',
  label: 'My Tab',
  component: () => import('./MyInstanceTab'),
  order: 10,
});
```

#### `ctx.registerTheme(theme)`

注册自定义主题。

```typescript
ctx.registerTheme({
  id: 'my-theme',
  name: 'My Custom Theme',
  mode: 'dark', // 'light' | 'dark' | 'auto'
  cssVariables: {
    '--color-bg': '#1a1a2e',
    '--color-fg': '#e0e0e0',
    '--color-accent': '#7f5af0',
  },
  fonts: [
    {
      family: 'MyFont',
      src: '/plugins/com.example.my-plugin/assets/MyFont.woff2',
      weight: 400,
      style: 'normal',
    },
  ],
});
```

参考内置 ZZZ Theme 插件一次性注册多个主题：

```typescript
ctx.registerTheme(zzzDarkContribution);
ctx.registerTheme(zzzLightContribution);
ctx.registerTheme(zzzOledContribution);
```

### 5.2 后端访问 API

#### `ctx.invoke<T>(command, args)`

调用后端 Tauri 命令。受 `invoke:<namespace>` 权限控制。

```typescript
// 调用核心命令（无命名空间前缀，需 invoke:core 权限）
const instances = await ctx.invoke<Instance[]>('list_instances');
await ctx.invoke('launch_game', { versionId: '1.20.1', instanceId: 'abc' });

// 调用命名空间命令（前缀:命令名，需 invoke:<namespace> 权限）
const results = await ctx.invoke<SearchResult[]>('marketplace:search', { query: 'jei' });
```

权限校验规则（来自 `PermissionValidator.canInvoke`）：

- 命令名**不含 `:`** → 视为核心命令，需要 `invoke:core` 权限
- 命令名**含 `:`** → 取 `:` 前的部分作为命名空间，需要 `invoke:<namespace>` 权限

若权限不足，会抛出 `Error: Permission denied: cannot invoke <command>`，并记录警告日志。

#### `ctx.http.get(url, options?)` / `ctx.http.post(url, body, options?)`

通过核心后端代理发起 HTTP 请求。受 `http:<domain>` 权限控制。

```typescript
// GET 请求
const data = await ctx.http.get('https://api.modrinth.com/v2/search', {
  params: { query: 'sodium', limit: '10' },
  headers: { 'User-Agent': 'BonNext/1.0' },
});

// POST 请求
const result = await ctx.http.post(
  'https://api.example.com/webhook',
  { event: 'plugin_loaded', timestamp: Date.now() },
  { headers: { Authorization: 'Bearer xxx' } },
);
```

权限校验规则（来自 `PermissionValidator.canHttp`）：

- 解析 URL 的 `hostname`
- 检查是否与已声明的 `http:<domain>` 完全相等，或是其子域名（`hostname === domain || hostname.endsWith('.' + domain)`）
- 例如声明 `http:modrinth.com` 可访问 `api.modrinth.com` 和 `modrinth.com`

#### `ctx.fs.readFile/writeFile/readDir/exists`

受限作用域的文件操作。受 `fs:read:<scope>` / `fs:write:<scope>` 权限控制。

```typescript
// 读取文件
const content = await ctx.fs.readFile('instances/my-instance/config.json');

// 写入文件
await ctx.fs.writeFile('config/my-plugin-settings.json', JSON.stringify({ enabled: true }));

// 判断文件是否存在
const exists = await ctx.fs.exists('instances/my-instance/options.txt');

// 列出目录（注意：当前后端实现尚未完整支持，返回空数组）
const files = await ctx.fs.readDir('instances/my-instance/mods');
```

**作用域自动检测**（来自 `PluginFileSystem.checkScope`）：

- 路径包含 `instances` 或 `.minecraft` → 作用域为 `instances`
- 路径包含 `config` → 作用域为 `config`
- 其他路径 → 作用域为 `global`

权限匹配：声明 `fs:read:instances` 可读 `instances` 作用域；声明 `fs:read:global` 可读所有作用域。写入同理。

#### `ctx.events.on(event, handler)` / `ctx.events.emit(event, data)`

事件总线，用于监听核心事件或插件间通信。

```typescript
// 监听事件，返回取消监听函数
const off = ctx.events.on('instance:launched', (data) => {
  ctx.logger.info('实例已启动:', data);
});

// 发送事件（需 events:emit 权限）
ctx.events.emit('my-plugin:ready', { version: '1.0.0' });

// 在 deactivate 中取消监听（可选，停用时事件监听器会随插件一起被清理）
// 注意：当前实现中事件监听器需手动管理，建议保存返回的取消函数
```

> **重要**：监听事件需声明 `events:listen` 权限，发送事件需声明 `events:emit` 权限。核心事件清单见 [第 7 节](#7-核心事件)。

### 5.3 存储 API

`ctx.storage` 提供插件专属的键值存储，数据持久化在后端，键名自动加 `plugin:<pluginId>:` 前缀，插件之间互不干扰。

```typescript
// 读取（返回已 JSON.parse 的值，不存在时返回 null）
const settings = await ctx.storage.get('settings');

// 写入（自动 JSON.stringify）
await ctx.storage.set('settings', { theme: 'dark', notifications: true });

// 删除
await ctx.storage.delete('settings');
```

存储的键名格式为 `plugin:<pluginId>:<key>`，例如插件 `com.example.hello` 调用 `ctx.storage.get('settings')` 实际读取的是 `plugin:com.example.hello:settings`。

### 5.4 日志 API

`ctx.logger` 提供带插件 ID 前缀的日志输出，前缀格式为 `[plugin:<pluginId>]`。

```typescript
ctx.logger.info('插件已激活'); // [plugin:com.example.hello] 插件已激活
ctx.logger.warn('配置缺失，使用默认值'); // [plugin:com.example.hello] 配置缺失...
ctx.logger.error('加载失败:', error); // [plugin:com.example.hello] 加载失败: <error>
```

日志输出到浏览器开发者工具控制台（`console.log/warn/error`），便于调试。

---

## 6. 权限系统

BonNext 插件采用 **"声明 + 审批"** 的权限模型：插件在 `manifest.json` 的 `permissions` 数组中声明所需权限，用户在激活或安装时会看到权限列表并需确认批准。

### 6.1 权限格式说明

| 权限格式             | 说明                                             | 示例                                                    |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `http:<domain>`      | 允许向指定域名（含子域名）发起 HTTP 请求         | `http:api.modrinth.com`、`http:modrinth.com`            |
| `http:*`             | 允许向任意域名发起 HTTP 请求（高风险，谨慎授予） | `http:*`                                                |
| `fs:read:<scope>`    | 允许读取指定作用域的文件                         | `fs:read:instances`、`fs:read:config`、`fs:read:global` |
| `fs:write:<scope>`   | 允许写入指定作用域的文件                         | `fs:write:instances`、`fs:write:global`                 |
| `invoke:<namespace>` | 允许调用指定命名空间的后端命令                   | `invoke:core`、`invoke:marketplace`                     |
| `events:listen`      | 允许监听事件总线                                 | `events:listen`                                         |
| `events:emit`        | 允许发送事件                                     | `events:emit`                                           |
| `storage:*`          | 允许使用持久化存储（声明性，用于审批展示）       | `storage:*`                                             |

**作用域（scope）取值**：

- `instances` — 实例目录（路径含 `instances` 或 `.minecraft`）
- `config` — 配置目录（路径含 `config`）
- `global` — 任意路径（最高权限，等同于所有作用域）

**命名空间说明**：

- 核心命令（如 `list_instances`、`launch_game`）无命名空间前缀，需要 `invoke:core` 权限
- 插件命名空间命令格式为 `<namespace>:<command>`（如 `marketplace:search`），需要 `invoke:<namespace>` 权限

**核心命令的细粒度命名空间**（推荐使用，遵循最小权限原则）：

| 命名空间                      | 覆盖命令                                                                            | 典型场景              |
| ----------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| `invoke:core:launch`          | `launch_game`、`cancel_launch`、`get_launch_state`、`pre_launch_check` 等           | 启动/取消游戏         |
| `invoke:core:instances:read`  | `list_instances`、`get_instance`、`check_instance_ready` 等                         | 读取实例信息          |
| `invoke:core:instances:write` | `create_instance`、`delete_instance`、`update_instance`、`migrate_instance` 等      | 创建/修改/删除实例    |
| `invoke:core:accounts:read`   | `list_accounts`、`get_active_account`、`get_mojang_profile` 等                      | 读取账户信息          |
| `invoke:core:accounts:write`  | `offline_login`、`start_microsoft_auth`、`refresh_auth_token`、`yggdrasil_login` 等 | 登录/切换账户         |
| `invoke:core:config:read`     | `get_config`、`get_active_shell` 等                                                 | 读取配置              |
| `invoke:core:config:write`    | `save_config`、`set_active_shell` 等                                                | 修改配置              |
| `invoke:core:content:read`    | `list_instance_mods`、`list_instance_schematics`、`check_mod_updates` 等            | 读取已安装内容        |
| `invoke:core:content:write`   | `remove_installed_mod`、`pin_mod`、`bulk_update_content` 等                         | 修改已安装内容        |
| `invoke:core:world`           | `list_instance_saves`、`list_instance_logs`、`read_log_file`、`list_world_backups`  | 读取存档/日志（只读） |
| `invoke:core:world:write`     | `backup_world`、`restore_world`、`delete_world`、`rename_world`、`import_world` 等  | 备份/恢复/删除存档    |
| `invoke:core:download`        | `pause_download`、`resume_download`、`cancel_download` 等                           | 控制下载队列          |
| `invoke:core:versions:read`   | `get_versions`、`list_installed_versions` 等                                        | 读取版本列表          |
| `invoke:core:versions:write`  | `download_version`、`install_loader`、`delete_version_cmd`                          | 下载/安装版本         |
| `invoke:core:cache`           | `cache_get`、`cache_set`、`cache_invalidate`                                        | 操作内存缓存          |
| `invoke:core:news`            | `get_minecraft_news`、`get_minecraft_article`、`open_url`                           | 读取新闻              |

**特殊命名空间**：

| 命名空间                | 说明                                                                                                          | 安全等级                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `invoke:system:plugins` | 插件管理命令（`install_plugin`、`uninstall_plugin`、`add_trusted_key`、`verify_plugin_signature_command` 等） | 🔴 极高风险。与 `core:*` 隔离，`invoke:core` 父级权限**不会**自动授予。仅信任的官方/系统插件应申请此权限。 |
| `invoke:marketplace`    | Modrinth/CurseForge/ModpackIndex 搜索与安装                                                                   | 🟡 中等风险。可触发网络请求与文件下载。                                                                    |
| `invoke:social`         | 好友列表、P2P 消息、Discord RPC 等                                                                            | 🟡 中等风险。涉及身份密钥导出。                                                                            |
| `invoke:ai`             | AI 聊天/补全/崩溃分析                                                                                         | 🟡 中等风险。可能产生 API 费用。                                                                           |
| `invoke:servers`        | 服务器 ping/收藏/`servers.dat` 读写                                                                           | 🟢 低风险。                                                                                                |
| `invoke:security`       | 安全配置/审计日志/凭据迁移/密钥管理                                                                           | 🔴 高风险。`migrate_credentials`、`save_api_key` 等敏感操作。                                              |
| `invoke:mod-tools`      | Mod 扫描/冲突检测/文件监视                                                                                    | 🟢 低风险。                                                                                                |
| `invoke:system-tools`   | 系统信息/内存调优/快速启动                                                                                    | 🟡 中等风险。`quick_start` 可触发下载+启动。                                                               |

> **父子命名空间规则**：声明 `invoke:core` 可调用所有 `core:*` 子命名空间命令（向后兼容）。声明 `invoke:core:launch` **仅**可调用 `core:launch` 命令，不可调用 `core:config` 等。`invoke:system:plugins` 与 `core:*` 完全隔离，必须显式声明。

### 6.2 权限审批流程

#### 激活已注册插件时

当用户在 **设置页 > 插件管理 > Registered** 标签下点击 "Activate" 时：

1. 系统读取该插件 `manifest.permissions`
2. 若权限列表非空，弹出 **"Plugin Permission Approval"** 模态框
3. 模态框展示插件名称、版本，以及每个权限的可读描述（如 `http:modrinth.com` → "HTTP requests to modrinth.com"）
4. 用户点击 "Approve" 后才执行激活；点击 "Cancel" 则取消

#### 安装第三方 .zip 插件时

当用户通过 "Install from .zip" 安装第三方插件时：

1. 后端解压 `.zip` 并读取 `manifest.json`，返回 `InstalledPluginInfo`（含 `permissions`）
2. 若权限列表非空，弹出权限审批模态框
3. 用户点击 "Approve" → 安装完成，显示成功 toast
4. 用户点击 "Cancel" → 后端自动调用 `uninstall_plugin` 回滚安装，并提示 "Plugin uninstalled (permissions denied)"

#### 权限不足时的运行时行为

当插件调用未声明的权限时：

- `ctx.invoke` → 抛出 `Error: Permission denied: cannot invoke <command>`，并记录 `Invoke denied (no permission)` 警告
- `ctx.http.get/post` → 抛出 `Error: Permission denied: cannot access <hostname>`，并记录警告
- `ctx.fs.readFile/writeFile/readDir` → 抛出 `Error: Permission denied: cannot read/write <scope>`，并记录警告

> **注意**：若 `manifest.json` 未声明 `permissions` 字段，`PluginManager` 会默认赋予 `invoke:core` 权限（见 `PluginManager.activate` 中的 `new PermissionValidator(plugin.manifest?.permissions ?? ['invoke:core'])`）。但建议显式声明所有所需权限，以便用户审批。

### 6.3 权限声明示例

```json
{
  "permissions": [
    "http:api.modrinth.com",
    "http:api.curseforge.com",
    "fs:read:instances",
    "fs:write:instances",
    "invoke:core",
    "invoke:marketplace",
    "events:listen",
    "events:emit",
    "storage:*"
  ]
}
```

---

## 7. 核心事件

BonNext 核心通过 `PluginProvider` 将 Tauri 后端事件和前端 store 事件桥接到插件事件总线。插件可通过 `ctx.events.on(eventName, handler)` 监听这些事件。

### 7.1 事件清单

| 事件名                     | 触发时机                                                 | payload 结构                                                                                   |
| -------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `instance:created`         | 实例创建后                                               | `{ instanceId: string; name: string }`                                                         |
| `instance:launched`        | 实例启动成功（状态变为 `running`）后                     | `{ instanceId: string; state: 'running' }`                                                     |
| `instance:exited`          | 实例正常退出（状态变为 `exited`）后                      | `{ instanceId: string; state: 'exited' }`                                                      |
| `instance:crashed`         | 实例崩溃（状态变为 `crashed`，或崩溃监视器检测到报告）后 | `{ instanceId: string; state?: 'crashed'; crashReportPath?: string }`                          |
| `download:completed`       | 版本下载或内容（mod/资源包）下载完成时                   | `{ url?: string; filename?: string \| null; slug?: string }`                                   |
| `workflow:completed`       | 工作流执行完成时                                         | `WorkflowCompleteEvent`（工作流结果数据）                                                      |
| `auth:login`               | 用户登录成功后                                           | `{ username: string; uuid: string; method?: string }`（method 可为 `offline`、`yggdrasil` 等） |
| `security:threat-detected` | 安全模块检测到威胁时                                     | 威胁详情（结构由安全模块决定）                                                                 |

### 7.2 事件来源说明

- `instance:launched` / `instance:exited` / `instance:crashed`：来自后端 `launch-state-changed` Tauri 事件，根据 `state` 字段分发
- `instance:crashed`（含 `crashReportPath`）：来自后端 `crash:detected` Tauri 事件（崩溃监视器）
- `download:completed`：来自 `download-progress`（版本下载）和 `content-download-progress`（内容下载）两个 Tauri 事件，当 `finished` 为 true 时触发
- `workflow:completed`：来自 `workflow:complete` Tauri 事件
- `instance:created` / `auth:login` / `security:threat-detected`：由前端 store（如 `instanceStore`、`authStore`、`security` API）发出 Tauri 事件，`PluginProvider` 转发

### 7.3 事件监听示例

```typescript
import { definePlugin } from '@bonnext/plugin-sdk';

export default definePlugin({
  id: 'com.example.event-listener',
  name: 'Event Listener Demo',
  version: '1.0.0',

  activate(ctx) {
    // 监听实例创建
    ctx.events.on('instance:created', (data) => {
      const { instanceId, name } = data as { instanceId: string; name: string };
      ctx.logger.info(`新实例已创建: ${name} (${instanceId})`);
    });

    // 监听实例启动，更新 Discord RPC
    ctx.events.on('instance:launched', (data) => {
      const { instanceId } = data as { instanceId: string };
      ctx.logger.info(`实例 ${instanceId} 已启动`);
      // 调用后端更新 Discord 状态
      void ctx.invoke('social:update_presence', { instanceId });
    });

    // 监听实例退出，清理 Discord RPC
    ctx.events.on('instance:exited', (data) => {
      ctx.logger.info('实例已退出，清理状态');
    });

    // 监听崩溃，触发 AI 分析
    ctx.events.on('instance:crashed', (data) => {
      const { instanceId, crashReportPath } = data as {
        instanceId: string;
        crashReportPath?: string;
      };
      ctx.logger.error(`实例 ${instanceId} 崩溃！报告: ${crashReportPath ?? '无'}`);
    });

    // 监听下载完成
    ctx.events.on('download:completed', (data) => {
      const { filename } = data as { filename?: string };
      ctx.logger.info(`下载完成: ${filename ?? '未知文件'}`);
    });

    // 监听登录
    ctx.events.on('auth:login', (data) => {
      const { username, method } = data as { username: string; method?: string };
      ctx.logger.info(`用户 ${username} 已登录 (${method ?? 'unknown'})`);
    });

    // 监听安全威胁
    ctx.events.on('security:threat-detected', (data) => {
      ctx.logger.warn('检测到安全威胁:', data);
    });

    // 监听工作流完成
    ctx.events.on('workflow:completed', (data) => {
      ctx.logger.info('工作流已完成:', data);
    });
  },
});
```

### 7.4 自定义事件

插件也可通过 `ctx.events.emit` 发送自定义事件，供其他插件监听（需声明 `events:emit` 权限）。建议使用 `<pluginId>:<event>` 的命名格式避免冲突：

```typescript
ctx.events.emit('com.example.my-plugin:ready', { version: '1.0.0' });
```

---

## 8. 打包与安装

### 8.1 插件目录结构要求

打包前，插件目录结构必须如下：

```
my-plugin/
├── manifest.json      # 必需：插件清单
├── index.js           # 必需：ES module 入口（打包后的 JS）
├── styles.css         # 可选：CSS 样式
└── assets/            # 可选：静态资源
    ├── icon.png
    └── font.woff2
```

**要求**：

- `manifest.json` 必须位于根目录，且 `id`、`name`、`version` 字段必填
- `index.js` 必须是 ES module，默认导出一个 `definePlugin(...)` 的结果
- 若使用 TypeScript 开发，需先用 Vite/esbuild/rollup 等工具打包为单个 `index.js`
- 静态资源路径在代码中建议使用相对路径或 `/plugins/<pluginId>/assets/...` 形式

### 8.2 打包为 .zip 文件

将插件目录的**内容**（而非目录本身）打包为 `.zip`：

```bash
# 进入插件目录
cd my-plugin

# 打包内容（注意：manifest.json 应在 zip 根目录，而非 my-plugin/ 子目录下）
# Windows PowerShell:
Compress-Archive -Path manifest.json, index.js, assets -DestinationPath my-plugin-1.0.0.zip

# 或使用 7-Zip:
7z a my-plugin-1.0.0.zip manifest.json index.js assets/
```

打包后的 zip 内部结构应为：

```
my-plugin-1.0.0.zip
├── manifest.json
├── index.js
└── assets/
    └── ...
```

### 8.3 通过设置页安装

1. 打开 BonNext 启动器
2. 进入 **设置 > 插件管理**（Plugin Management）
3. 切换到 **"Installed (3rd-party)"** 标签
4. 点击 **"Install from .zip"** 按钮
5. 在文件选择对话框中选择 `.zip` 文件
6. 后端解压并读取 `manifest.json`，返回插件信息
7. 若插件声明了权限，弹出 **权限审批模态框**，展示权限列表
8. 点击 **"Approve"** 完成安装，显示成功 toast
9. 若点击 "Cancel"，安装会自动回滚（卸载已解压的文件）

安装后，插件会出现在 "Installed (3rd-party)" 列表中，显示名称、版本、ID、作者和权限列表。

### 8.4 卸载方法

1. 进入 **设置 > 插件管理 > Installed (3rd-party)**
2. 找到要卸载的插件，点击 **"Uninstall"** 按钮
3. 在确认对话框中点击 "确定"（操作不可撤销）
4. 后端调用 `uninstall_plugin` 命令，从 `game_dir/plugins/<id>/` 删除目录
5. 显示卸载成功 toast

> **注意**：内置插件（builtin）无法卸载，只能激活/停用。第三方插件卸载后会从注册表和文件系统中完全移除。

---

## 9. 完整示例

### 9.1 Hello World 插件

一个注册路由和侧边栏项的最小完整插件。

**manifest.json**：

```json
{
  "id": "com.example.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "一个 Hello World 示例插件",
  "author": "Example",
  "minAppVersion": "1.0.0",
  "permissions": [],
  "contributes": {
    "routes": [{ "path": "/hello", "component": "HelloPage" }],
    "sidebar": [{ "id": "hello", "label": "Hello", "icon": "👋", "route": "/hello", "order": 100 }],
    "settings": []
  }
}
```

**index.ts**（打包为 index.js）：

```typescript
import { definePlugin } from '@bonnext/plugin-sdk';
import type { PluginContext } from '@bonnext/plugin-sdk';
import React from 'react';

// 页面组件（实际开发中建议拆分到单独文件）
function HelloPage() {
  return React.createElement(
    'div',
    { style: { padding: '32px', textAlign: 'center' } },
    React.createElement('h1', null, '👋 Hello, BonNext!'),
    React.createElement('p', null, '这是我的第一个插件页面。'),
  );
}

export default definePlugin({
  id: 'com.example.hello-world',
  name: 'Hello World',
  version: '1.0.0',
  description: '一个 Hello World 示例插件',

  activate(ctx: PluginContext) {
    // 注册路由（懒加载）
    ctx.registerRoute('/hello', async () => ({ default: HelloPage as unknown as React.ComponentType<unknown> }));

    // 添加侧边栏项
    ctx.addSidebarItem({
      id: 'hello',
      label: 'Hello',
      icon: '👋',
      route: '/hello',
      order: 100,
    });

    ctx.logger.info('Hello World 插件已激活');
  },
});
```

### 9.2 实例启动监听 + 侧边栏项插件

一个监听实例启动事件、记录启动次数、并在侧边栏添加统计页面的插件。

**manifest.json**：

```json
{
  "id": "com.example.launch-tracker",
  "name": "Launch Tracker",
  "version": "1.0.0",
  "description": "追踪实例启动次数并展示统计",
  "author": "Example",
  "minAppVersion": "1.0.0",
  "permissions": ["events:listen", "storage:*", "invoke:core"],
  "contributes": {
    "routes": [{ "path": "/launch-tracker", "component": "LaunchTrackerPage" }],
    "sidebar": [
      { "id": "launch-tracker", "label": "Launch Stats", "icon": "📊", "route": "/launch-tracker", "order": 50 }
    ],
    "settings": []
  }
}
```

**index.ts**：

```typescript
import { definePlugin } from '@bonnext/plugin-sdk';
import type { PluginContext } from '@bonnext/plugin-sdk';
import React, { useEffect, useState } from 'react';

// 统计页面组件
function LaunchTrackerPage() {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    // 通过自定义事件从插件获取数据（简化示例）
    // 实际开发中可使用 React Context 或状态管理库
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setStats(detail ?? {});
    };
    window.addEventListener('launch-tracker:stats', handler);
    // 触发一次数据请求
    window.dispatchEvent(new CustomEvent('launch-tracker:request'));
    return () => window.removeEventListener('launch-tracker:stats', handler);
  }, []);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return React.createElement(
    'div',
    { style: { padding: '32px' } },
    React.createElement('h1', null, '📊 启动统计'),
    React.createElement('p', null, `总启动次数: ${total}`),
    React.createElement(
      'ul',
      null,
      Object.entries(stats).map(([id, count]) => React.createElement('li', { key: id }, `${id}: ${count} 次`)),
    ),
  );
}

export default definePlugin({
  id: 'com.example.launch-tracker',
  name: 'Launch Tracker',
  version: '1.0.0',
  description: '追踪实例启动次数并展示统计',

  activate(ctx: PluginContext) {
    // 注册路由和侧边栏
    ctx.registerRoute('/launch-tracker', async () => ({
      default: LaunchTrackerPage as unknown as React.ComponentType<unknown>,
    }));
    ctx.addSidebarItem({
      id: 'launch-tracker',
      label: 'Launch Stats',
      icon: '📊',
      route: '/launch-tracker',
      order: 50,
    });

    // 监听实例启动事件
    ctx.events.on('instance:launched', async (data) => {
      const { instanceId } = data as { instanceId: string };
      ctx.logger.info(`实例 ${instanceId} 已启动`);

      // 从存储读取当前统计
      const current = (await ctx.storage.get('launchCounts')) as Record<string, number> | null;
      const updated = { ...(current ?? {}) };
      updated[instanceId] = (updated[instanceId] ?? 0) + 1;

      // 写回存储
      await ctx.storage.set('launchCounts', updated);
      ctx.logger.info(`累计启动次数: ${updated[instanceId]}`, updated);
    });

    // 响应页面的数据请求
    window.addEventListener('launch-tracker:request', async () => {
      const stats = (await ctx.storage.get('launchCounts')) as Record<string, number> | null;
      window.dispatchEvent(new CustomEvent('launch-tracker:stats', { detail: stats ?? {} }));
    });

    ctx.logger.info('Launch Tracker 插件已激活');
  },

  deactivate() {
    // 移除自定义事件监听器（ctx 注册的 UI 项会自动清理）
    // 注意：window 上的事件监听器需手动移除
  },
});
```

> **提示**：上述示例为了独立完整，使用了 `window` 自定义事件作为插件逻辑与 React 组件之间的简单通信桥梁。在实际开发中，推荐使用 React Context、Zustand 或事件总线等更规范的状态管理方式。

---

## 10. 调试技巧

### 10.1 使用 ctx.logger 输出日志

`ctx.logger` 是最直接的调试手段，所有输出会带 `[plugin:<pluginId>]` 前缀，便于在控制台中筛选：

```typescript
activate(ctx) {
  ctx.logger.info('插件激活，配置:', { version: '1.0.0' });
  ctx.logger.warn('某项配置缺失，使用默认值');
  ctx.logger.error('初始化失败:', new Error('xxx'));
}
```

### 10.2 查看浏览器开发者工具控制台

BonNext 基于 Tauri v2 + React，前端运行在 WebView 中。打开开发者工具：

- **Windows/Linux**：`F12` 或 `Ctrl+Shift+I`
- **macOS**：`Cmd+Option+I`

在 Console 中：

- 输入 `[plugin:` 可快速筛选出所有插件日志
- 输入完整插件 ID（如 `[plugin:com.example.hello]`）可精确定位单个插件的日志
- 查看 `console.warn` 和 `console.error` 可发现权限拒绝等运行时问题

### 10.3 常见错误排查

#### 错误：`Plugin not found: <pluginId>`

**原因**：调用 `manager.activate(pluginId)` 时，该 ID 未注册。
**解决**：检查 `manifest.json` 的 `id` 字段与 `definePlugin({ id: ... })` 中的 `id` 是否一致；确认插件已通过 `manager.register()` 注册或已通过 `.zip` 安装。

#### 错误：`Plugin requires app version >= x.y.z, but current version is a.b.c`

**原因**：`manifest.json` 的 `minAppVersion` 高于当前启动器版本。
**解决**：降低 `minAppVersion`，或升级 BonNext 启动器。版本比较采用简单的语义化版本对比（按 `.` 分段比较数字）。

#### 错误：`Missing dependencies: <depId>` 或 `Dependencies not active: <depId>`

**原因**：`manifest.json` 的 `dependencies` 中声明的插件未注册或未激活。
**解决**：先安装并激活依赖插件，再激活当前插件。`PluginManager.activateAll()` 会按注册顺序串行激活，若依赖项在当前插件之后注册，需手动调整激活顺序。

#### 错误：`Permission denied: cannot invoke <command>`

**原因**：调用了未在 `manifest.json` 中声明权限的后端命令。
**解决**：

- 核心命令（无 `:`）→ 在 `permissions` 中添加 `invoke:core`
- 命名空间命令（如 `marketplace:search`）→ 添加 `invoke:marketplace`

#### 错误：`Permission denied: cannot access <hostname>`

**原因**：HTTP 请求的目标域名未声明权限。
**解决**：在 `permissions` 中添加 `http:<domain>`。注意权限匹配规则：声明 `http:modrinth.com` 可访问 `api.modrinth.com`（子域名），但声明 `http:api.modrinth.com` **不能**访问 `modrinth.com`（父域名）。

#### 错误：`Permission denied: cannot read/write <scope>`

**原因**：文件操作的路径作用域未声明权限。
**解决**：根据路径判断作用域（含 `instances`/`.minecraft` → `instances`；含 `config` → `config`；其他 → `global`），在 `permissions` 中添加对应的 `fs:read:<scope>` 或 `fs:write:<scope>`。若需访问所有路径，使用 `fs:read:global` / `fs:write:global`。

#### 问题：插件激活后 UI 注入项不显示

**排查步骤**：

1. 确认 `activate(ctx)` 中调用了对应的 `ctx.registerXxx()` / `ctx.addXxx()` 方法
2. 确认 `activate()` 已正常返回（未抛出异常）—— 检查控制台是否有 `[PluginManager] Failed to activate plugin` 错误
3. 确认插件状态为 `active`（在设置页 > 插件管理中查看，或通过 `manager.getPlugin(id).state`）
4. 侧边栏项和设置分区按 `order` 排序，检查 `order` 值是否合理（核心项通常使用 1-10，插件建议使用 10+）

#### 问题：事件监听器不触发

**排查步骤**：

1. 确认 `manifest.json` 声明了 `events:listen` 权限
2. 确认事件名拼写正确（参考 [第 7 节](#7-核心事件) 的事件清单）
3. 确认插件已激活（`state === 'active'`）—— 事件监听器在 `activate()` 执行时注册
4. 在监听器回调中添加 `ctx.logger.info('event received:', data)` 验证是否触发

#### 问题：`ctx.fs.readDir` 返回空数组

**原因**：当前后端实现尚未提供通用列目录命令（`PluginFileSystem` 中标注为 TODO），`readDir` 暂时返回空数组并记录警告。
**解决**：暂用 `ctx.fs.exists` 配合已知路径，或通过 `ctx.invoke` 调用特定的后端命令（如 `list_instance_mods`）获取目录内容。后续版本会补全 `plugin_fs_read_dir` 命令。

### 10.4 调试内置插件

内置插件源码位于 `src/plugins/builtins/`，可直接修改源码后重新构建启动器进行调试。参考已有插件作为模板：

- **Marketplace**（`src/plugins/builtins/marketplace/index.ts`）：路由 + 侧边栏 + 事件监听的完整示例
- **Social**（`src/plugins/builtins/social/index.ts`）：事件监听 + 上下文菜单示例
- **ZZZ Theme**（`src/plugins/builtins/zzz-theme/ZZZThemePlugin.ts`）：主题注册示例
- **System Tools** / **Security** / **AI**：更多事件监听和后端调用示例

---

## 附录：SDK 导出清单

`@bonnext/plugin-sdk` 包导出以下内容（见 `src/plugin-sdk/index.ts`）：

**函数**：

- `definePlugin(def: PluginDefinition): PluginDefinition`

**类型**：

- `PluginDefinition`
- `PluginManifest`
- `PluginContext`
- `PluginState`
- `RegisteredPlugin`
- `SidebarItem`
- `SettingsSection`
- `PluginRoute`
- `ContextMenuItem`
- `InstanceTab`
- `ThemeContribution`
- `PluginHttpClient`
- `PluginFileSystem`
- `PluginEventBus`
- `PluginStorage`
- `PluginLogger`

使用方式：

```typescript
import { definePlugin } from '@bonnext/plugin-sdk';
import type { PluginContext, PluginManifest, SidebarItem } from '@bonnext/plugin-sdk';
```

---

_本文档基于 BonNext 插件系统 Phase 5 实现，最后更新：2026-06-20。如需了解架构设计细节，请参阅 `docs/superpowers/specs/2026-06-19-plugin-architecture-design.md`。_
