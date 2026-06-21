# BonNext 插件系统深度分析

> 日期：2026-06-20
> 范围：基于 `src/plugins/` 与 `src-tauri/src/commands/plugin_proxy.rs` 的代码级审查
> 目的：识别当前插件系统的原理、实现缺陷与修复方向，作为 v2 改造的依据

---

## 一、整体架构

插件系统分为**前端核心层**（`src/plugins/core/`）、**内置插件层**（`src/plugins/builtins/`）和**后端代理层**（`src-tauri/src/commands/plugin_proxy.rs`）三层。

数据流：

```
PluginProvider (React)
  └─ PluginLoader
       ├─ loadBuiltinPlugins()   ← 静态 import 内置插件
       └─ loadInstalledPlugins() ← invoke('list_installed_plugins') 读磁盘
  └─ PluginManager
       ├─ register(definition, manifest)
       ├─ activateAll() → 拓扑排序 → activate(id)
       │     └─ createPluginContext(...) → definition.activate(ctx)
       └─ subscribe() → useSyncExternalStore → UI 注入项刷新
```

## 二、核心抽象

### 1. 插件定义与清单（`types.ts`）

- `PluginDefinition`：`{ id, name, version, activate(ctx), deactivate?() }`，由 `definePlugin()` 包装（目前是恒等函数，仅做类型约束）。
- `PluginManifest`：声明 `minAppVersion`、`dependencies`、`permissions`、`contributes`（routes/sidebar/settings/contextMenu/instanceTabs/themes）。

### 2. PluginManager（`PluginManager.ts`）

- **状态机**：`registered → activating → active → deactivating → inactive`，失败转 `error`。
- **注册幂等**：`register()` 检测重复 id 直接返回。
- **激活流程**：先校验 manifest（minAppVersion + dependencies），再构造 `PermissionValidator` / `PluginLogger` / `PluginStorage` / `PluginHttpClient` / `PluginFileSystem`，最后调用 `definition.activate(ctx)`。失败时回滚已注入的 UI 项。
- **拓扑排序**：`activateAll()` 按 `manifest.dependencies` 做 Kahn 算法排序，保留原始插入顺序；检测到环时降级为原序并告警。
- **快照+订阅**：维护 `sidebarItems / routes / themes` 等可变源数组，`notify()` 时重算排序后的快照，配合 `useSyncExternalStore` 给 React 用，避免无限渲染。
- **版本比较**：`isVersionSatisfied()` 是简单的按 `.` 切片数值比较，不支持 prerelease。

### 3. PluginContext（`PluginContext.ts`）

激活时注入的 API 表面：
- **UI 注入**：`registerRoute / addSidebarItem / addSettingsSection / addContextMenuItem / addInstanceTab / registerTheme`，全部带 `pluginId` 标记便于卸载清理。
- **后端访问**：`invoke(command, args)`，经 `PermissionValidator.canInvoke()` 校验。
- **能力**：`http` / `fs` / `events` / `storage` / `logger`，每个都包了一层权限校验。

### 4. 权限模型（`PermissionValidator.ts`）

权限字符串前缀分域：
- `http:<domain>` — 域名白名单（含子域）
- `fs:read:<scope>` / `fs:write:<scope>` — scope ∈ `instances | config | global`
- `invoke:<namespace>` — 命名空间；带 `:` 的命令直接取前缀，扁平命令查 `COMMAND_NAMESPACE_MAP`，未映射的统一归到 `invoke:core`
- `events:listen` / `events:emit` — 独立开关

### 5. 后端代理（`plugin_proxy.rs`）

- `plugin_http_get/post`：用全局 reqwest client 转发，**不再做域名校验**（信任前端 PermissionValidator）。
- `plugin_storage_get/set/delete`：所有插件共用一个 `plugin_storage.json`，整文件读写。
- `plugin_fs_read/write/exists/read_dir`：按 `scope` 解析根目录，`safe_join_fs()` 拒绝 `..` 和绝对路径，再用 `canonicalize_with_ancestors()` 防符号链接逃逸，最后 `starts_with` 校验。文本文件 10MB 上限，禁二进制。
- `list_installed_plugins / install_plugin / uninstall_plugin / get_plugin_manifest`：扫描 `game_dir/plugins/<id>/manifest.json`；`install_plugin` 从 zip 中先找 manifest 确定 id，再做路径校验后解压。

### 6. 启动流程（`PluginProvider.tsx`）

两阶段加载：
1. **快路径**：`loadBuiltinPlugins()` 同步注册 + `activateAll()`，结束后立即 `setReady(true)`，让 `AppRoutes` 渲染核心路由。
2. **后台**：`loadInstalledPlugins()` 异步加载第三方插件并激活，失败不影响 ready。

同时把核心 Tauri 事件（`launch-state-changed`、`download-progress`、`content-download-progress`、`workflow:complete`、`crash:detected`、`instance:created`、`auth:login`、`security:threat-detected`、`mod:installed`）桥接到插件 `EventBus`，用 `cancelled` 标志位避免卸载后监听器泄漏。

### 7. UI 集成

- `usePluginRoutes` / `usePluginSidebarItems` / `usePluginSettingsSections` / `usePluginContextMenuItems` / `usePluginInstanceTabs` / `usePluginThemes` / `useAllPlugins`：全部基于 `useSyncExternalStore`。
- `AppRoutes.tsx`：核心路由直接定义，插件路由用 `React.lazy(route.component)` 包裹 `PluginErrorBoundary` + `Suspense`。
- `PluginManagementSection.tsx`：设置页提供"已注册/已安装"两个 Tab，安装/激活前弹权限审批 Modal，拒绝安装时回滚 uninstall。

### 8. 内置插件

`builtinPlugins` 共 10 个：zzz-theme（最先激活）、marketplace、servers、social、ai、security、mod-tools、system-tools、shell-swiftui、shell-editor。每个插件用 `definePlugin()` 写激活逻辑，配套 `manifest.json` 声明权限与贡献。

## 三、不足与潜在问题

### 严重缺陷

1. **第三方插件无法真正运行**：`PluginLoader.createPlaceholderDefinition()` 的 `activate` 是空操作，注释明确说"动态 `import()` 加载需要后续实现打包系统"。也就是说，第三方插件能装能列，但**永远不会执行任何代码**——manifest 里声明的 `contributes` 也不会被消费。

2. **manifest 的 `contributes` 字段是死代码**：实际 UI 注入完全靠 `activate(ctx)` 里命令式调用，manifest 里的 routes/sidebar/themes 声明只是文档，加载器从不读取。两套数据源容易脱节。

3. **无沙箱隔离**：插件与核心应用共享同一 JS realm，能访问 `window`、所有全局变量、其他插件的模块。恶意/有 bug 的插件可改写核心函数、窃取其他插件数据、直接 `invoke` 绕过权限（`@tauri-apps/api/core` 是公开的）。

4. **权限校验可被绕过**：
   - 前端 `PermissionValidator` 拦不住插件直接 `import { invoke } from '@tauri-apps/api/core'` 调任意命令。
   - 后端 `plugin_http_get/post` 不复验域名白名单，前端校验被绕过即裸 HTTP。
   - `invoke:core` 是兜底权限，覆盖所有未在 `COMMAND_NAMESPACE_MAP` 里的命令，授权面过大。

### 设计缺陷

5. **存储模型粗糙**：所有插件共用一个 `plugin_storage.json`，每次 get/set 都整文件读写，无锁、无并发安全、无 per-plugin 隔离文件、无大小限制。

6. **EventBus 全局无类型**：`events:listen` 是布尔权限，拿到就能听全部事件；事件名无命名空间（如 `marketplace:search`），无 schema、无重放、无背压。

7. **无插件间 API / 服务注册**：`dependencies` 仅用于激活排序，被依赖方无法向依赖方暴露服务。没有 ServiceRegistry / ExtensionPoint 抽象（CLAUDE.md 提到的 `ServiceRegistry`、`DependencyResolver`、`ThemeExtensionPoint` 实际未实现）。

8. **Logger 只是 console**：无持久化、无级别过滤、无 per-plugin 查看、不接入 `utils/logger.ts` 的 200 条内存缓冲。

9. **无热重载 / 状态恢复**：deactivate 只清 UI 注入和事件监听，插件对 DOM 的直接修改、对全局 store 的副作用无法回滚。重新激活不保证干净状态。

10. **错误恢复薄弱**：激活失败仅置 `error` 状态，无重试、无失败计数、无自动禁用、无崩溃报告。

### 生态缺失

11. **无插件市场 / 发现机制**：只能本地 .zip 安装，无在线注册表、无更新检查、无版本升级路径。

12. **无签名 / 完整性校验**：`install_plugin` 只校验 id 字符集，不验签、不校验 hash，zip 可包含任意文件。

13. **权限审批一刀切**：Modal 只能全批或全拒，不能勾选子集；批准后无法事后撤销单项权限。

14. **manifest 无 schema 校验**：后端用 `serde_json::Value` 索引字段并兜默认值，字段写错静默退化。

15. **i18n 缺失**：`SidebarItem.label`、`SettingsSection.label` 是裸字符串，不接 i18n key。

16. **内置插件不可卸载**：只能 deactivate，`unregister` 没有在 UI 暴露；用户无法真正移除内置功能。

17. **生命周期钩子不全**：只有 `activate/deactivate`，无 `onAppReady / onInstanceLaunching / beforeInstall / onSuspend` 等拦截点；事件总线是唯一交互方式，无法做拦截器/中间件。

18. **semver 不完整**：`isVersionSatisfied()` 不支持 prerelease/build metadata，`minAppVersion` 写 `1.0.0-beta` 会判错。

19. **`getThemeService()` 已废弃但仍导出**：`ZZZThemePlugin.ts` 标 `@deprecated` 返回 null，ThemeService 类仍在但不再被实例化，是历史包袱。

---

## 四、深度分析

### 方向一：动态加载与贡献机制

#### 1.1 根因：第三方插件永远跑不起来

**调用链**：`PluginProvider.tsx:47` `loadInstalledPlugins(manager)` → `PluginLoader.ts:78-103` → `createPlaceholderDefinition(info)` → `PluginLoader.ts:32-43`

```ts
function createPlaceholderDefinition(info: InstalledPluginInfo): PluginDefinition {
  return {
    id: info.id, name: info.name, version: info.version,
    description: info.description ?? undefined,
    activate() { /* no-op: dynamic plugin entry loading not yet implemented */ },
  };
}
```

**根因**：
- Tauri v2 前端是 Vite 打包的 SPA，所有 `import()` 都要在构建时被 Vite 静态分析成 chunk。运行时从磁盘读到的插件路径无法被 Vite 解析，`import('/path/to/plugin/index.js')` 在生产构建里直接报错。
- 后端 `install_plugin` 解压后只返回 `InstalledPluginInfo`（id/name/version/permissions），**没有返回入口 JS 的 URL**，前端也没有 `convertFileSrc` 把磁盘路径转成 `asset://` 协议。
- 即使能加载，也没有任何沙箱（见方向二），所以"动态加载"和"沙箱"在工程上必须一起做。

**影响面**：
- 用户在 `PluginManagementSection.tsx` 装 zip 后只能看到一条"已安装"记录，**永远不会出现该插件注册的路由/侧边栏/设置项**。
- manifest 里声明的 `contributes.routes/sidebar/themes` 全部无效。
- 内置插件能用是因为它们走 `builtins/index.ts` 的静态 `import`，被 Vite 编进 bundle，与第三方插件是两条完全不同的路径。

#### 1.2 根因：manifest.contributes 是死代码

**调用链**：`PluginLoader.loadInstalledPlugins` → `createManifestFromInstalled(info)` → `PluginLoader.ts:46-55`

```ts
function createManifestFromInstalled(info: InstalledPluginInfo): PluginManifest {
  return { id, name, version, description, author, permissions };
  // ↑ 注意：contributes 字段完全没被复制
}
```

**根因**：
- 后端 `list_installed_plugins` 只读 `id/name/version/description/author/permissions`，**不读 `contributes`**。
- 前端 `createManifestFromInstalled` 也就没 contributes 可复制。
- 即使复制了，`PluginManager.activate()` 也只把 manifest 存进 `RegisteredPlugin.manifest`，从不遍历 `manifest.contributes` 去调 `ctx.registerRoute()` 等。所有 UI 注入都靠 `definition.activate(ctx)` 命令式调用。
- 结果：内置插件的 manifest.contributes 和 activate() 各写一遍，**两套数据源没有一致性校验**。

#### 1.3 修复方案设计

**目标**：让第三方插件能真正运行，且 manifest.contributes 成为唯一声明源。

**方案 A：声明式贡献 + 声明式加载（推荐）**

1. **后端 `list_installed_plugins` 扩展**：返回完整 manifest（含 `contributes`）。`InstalledPluginInfo` 增字段 `contributes: serde_json::Value`、`entry: String`（入口 JS 相对路径）。
2. **前端 `PluginLoader` 改造**：用 `convertFileSrc()` + Tauri asset 协议把 `plugins/<id>/index.js` 转成 `http://asset.localhost/...` URL。用动态 `import(/* @vite-ignore */ url)` 加载模块。`@vite-ignore` 注释让 Vite 跳过静态分析。
3. **声明式贡献消费**：`PluginManager.activate()` 在调 `definition.activate(ctx)` **之前**，先遍历 `manifest.contributes`，把字符串组件名通过 `ComponentRegistry` 解析成懒加载函数，调 `ctx.registerRoute()` 等。
4. **组件字符串解析**：`ComponentRegistry` 内置组件静态注册，第三方组件用 `convertFileSrc` 拼 URL + `React.lazy`。
5. **CSP 调整**：`tauri.conf.json` 的 `app.security.csp` 加 `script-src 'self' asset: http://asset.localhost`。

**迁移路径**：
- 阶段 1：实现声明式消费（不动第三方加载），让内置插件纯靠 manifest 工作。
- 阶段 2：实现 `convertFileSrc` + `@vite-ignore` 动态 import。
- 阶段 3：加 CSP、签名校验、沙箱。

### 方向二：沙箱与权限模型

#### 2.1 根因：前端权限校验形同虚设

**调用链**：`PluginContext.invoke()`

```ts
async invoke<T>(command, args) {
  if (!permissions.canInvoke(command)) { throw new Error(...); }
  return invoke<T>(command, args);  // ← 直接调 @tauri-apps/api/core 的 invoke
}
```

**根因**：
- `@tauri-apps/api/core` 的 `invoke` 是公开 API，插件代码只要 `import { invoke } from '@tauri-apps/api/core'` 就能绕过 `ctx.invoke` 的包装。
- 同理，`ctx.http` 调 `plugin_http_get`，但插件也能直接 `fetch('https://evil.com')`。
- `ctx.fs` 同理，插件能直接 `invoke('plugin_fs_read', ...)`，后端只校验路径不逃逸，**不校验调用方是不是已授权插件**。

**影响面**：任何能 `import()` 进来的第三方插件，等于拿到了核心应用的全部 Tauri 命令权限。权限审批 Modal 变成纯仪式。

#### 2.2 根因：后端代理不复验权限

**根因**：后端命令不知道"是谁在调"。Tauri 命令默认无 caller identity，`plugin_http_get/post/fs_*` 都没有 `plugin_id` 参数（`plugin_fs_*` 有 `plugin_id` 但只用于日志）。即使加了 `plugin_id` 参数，前端也能伪造。

#### 2.3 根因：invoke:core 兜底过宽

**根因**：`COMMAND_NAMESPACE_MAP` 只列了 ~30 个命令，`lib.rs` 注册了 ~100 个命令。剩下 70+ 个（`launch_game`、`read_accounts`、`save_config` 等）全部归 `core`。任何声明 `invoke:core` 的插件 = 拿到全部未映射命令权限。

#### 2.4 根因：无签名校验

**根因**：zip 可包含任意文件，解压到 `plugins/<id>/`，路径只防 `..` 不防内容。没有签名文件、没有公钥校验。攻击者可以伪造一个 `com.bonnext.marketplace` 的插件覆盖内置插件目录。

#### 2.5 修复方案设计

**分层防御**：前端沙箱 + 后端鉴权 + 签名链。

**第一层：后端命令级鉴权（必做，最高优先级）**

1. **插件激活时发 token**：`PluginManager.activate()` 成功后，调新命令 `plugin_register_session`，后端生成随机 token，存 `HashMap<token, PluginSession { id, permissions, scopes }>`，返回 token 给前端。
2. **所有 plugin_* 命令加 `token` 参数**：后端用 token 查 session，复验权限。
3. **核心命令拒绝插件直调**：敏感命令改名为 `core:launch_game`，前端强制细粒度权限。
4. **`invoke:core` 拆细**：废弃兜底，改为 `invoke:core:launch`、`invoke:core:config-read` 等。未映射命令默认拒绝。

**第二层：前端沙箱**

1. **iframe 隔离插件 UI**：`<iframe src="asset://localhost/plugins/<id>/index.html" sandbox="allow-scripts">`。父子通过 `postMessage` 通信。
2. **插件 JS 模块隔离**：打包时 external 掉 `@tauri-apps/*`，运行时注入受限的 `window.__plugin_api__`。
3. **CSP 严格化**：插件 iframe 的 CSP：`script-src 'self' asset:; connect-src 'none'`。

**第三层：签名链**

1. **签名格式**：zip 内含 `SIGNATURE.sig`，对 manifest + dist 树哈希用 Ed25519 签名。
2. **公钥分发**：BonNext 内置受信公钥，用户可导入第三方公钥。
3. **安装时校验**：`install_plugin` 增 `signature` 参数，后端验签。

### 方向三：插件互操作与扩展点

#### 3.1 根因：dependencies 只是排序约束，不是服务契约

**根因**：`dependencies: ["com.bonnext.marketplace"]` 只保证 marketplace 比 dependen 先激活，但 dependent 拿不到 marketplace 的任何 API。没有"服务注册"机制。CLAUDE.md 宣称的 `ServiceRegistry / ExtensionPoint / DependencyResolver / PluginRegistry` 在代码里**完全不存在**。

#### 3.2 根因：EventBus 是唯一交互通道，且无请求/响应

**根因**：纯 fire-and-forget，emit 拿不到 handler 的返回值。无请求/响应语义、无命名空间、无 schema、无背压、无重放。

#### 3.3 根因：生命周期钩子只有 activate/deactivate

**根因**：没有 `onAppReady / onInstanceLaunching / beforeInstall` 等钩子。所有"事前拦截"场景无法实现。

#### 3.4 修复方案设计

**1. ServiceRegistry**：`ctx.provide(serviceId, service)` / `ctx.consume<T>(serviceId)` / `ctx.requestService<T>(serviceId, timeout)`。PluginManager 维护 `Map<serviceId, { pluginId, instance }>`，deactivate 时自动注销。

**2. ExtensionPoint**：核心代码声明 EP（如 `home:widget`），插件 `ctx.contribute(epId, contribution)`，宿主 `useExtensions(epId)` 消费。schema 用 zod 校验。

**3. RPC 式事件**：`ctx.events.handleRequest(reqId, handler)` / `ctx.events.request(reqId, data, timeout)`。支持请求/响应、超时、命名空间。

**4. 生命周期钩子**：`PluginDefinition` 增 `hooks?: PluginLifecycleHooks`。`before*` 钩子 async + 可拦截，`after*` 钩子 fire-and-forget。钩子有超时，失败不阻断。

### 方向四：运行时与运维缺陷

#### 4.1 根因：存储模型不可扩展

**根因**：所有插件共用一个 JSON 文件，每次 get/set 都整文件读写。无文件锁，并发写会丢数据。无大小限制。无 per-plugin 隔离（key 前缀只是约定，后端不校验 caller 身份）。

#### 4.2 根因：Logger 不接入核心日志系统

**根因**：只调 `console.log/warn/error`，不接入 `utils/logger.ts` 的 200 条内存缓冲。生产环境重启即丢。无级别过滤、无 per-plugin 查看。

#### 4.3 根因：无热重载，deactivate 不彻底

**根因**：`removePluginInjections` 只清 PluginManager 跟踪的 6 类注入 + EventBus 监听。插件在 `activate()` 里做的其他副作用（DOM 操作、全局 store 修改、定时器、全局事件监听）无法回滚。

#### 4.4 根因：错误恢复薄弱

**根因**：激活失败仅置 `error` 状态，无重试、无失败计数、无自动禁用。下次 `activateAll()` 会再次尝试，可能反复失败刷屏。

#### 4.5 根因：semver 不完整

**根因**：`isVersionSatisfied()` 不支持 prerelease/build metadata/range。`minAppVersion: "1.0.0-beta"` 被解析成 `[1, 0, 0]`。

#### 4.6 根因：i18n 缺失

**根因**：插件贡献的 label 是裸字符串，不接 i18n 系统。第三方插件无法提供多语言。

#### 4.7 修复方案设计

**1. 存储模型重构**：per-plugin 独立文件 `plugin_storage/<plugin_id>.json` + 后端 token 鉴权 + 文件大小限制 + `tokio::sync::RwLock`。迁移：首次启动检测旧 `plugin_storage.json`，按 key 前缀拆分。

**2. Logger 接入核心系统**：复用 `utils/logger.ts` 的内存缓冲。设置页加"插件日志"查看器。严重 error 自动写审计日志。

**3. 副作用追踪**：PluginContext 提供 `setInterval / addEventListener / mountPortal / subscribeStore` 等受控 API，deactivate 时自动撤销。与 iframe 沙箱互补。

**4. 错误恢复**：失败计数 + 连续 3 次自动 `autoDisabled` + 设置页"重置并重试"按钮 + 错误详情 Modal（堆栈 + 时间戳）。

**5. semver 完整实现**：引入 `semver` npm 包，`minAppVersion` 从"最小版本"改为"版本范围"。

**6. i18n 集成**：label 支持 `{ i18nKey: string }` 对象。manifest 增 `i18n: { en: {...}, zh-CN: {...} }` 字段，加载时合并到全局 i18n（命名空间 `plugin:<id>:`）。

---

## 五、优先级建议

| 优先级 | 任务 | 依赖 | 预估影响 |
|--------|------|------|----------|
| P0 | 后端 token + 命令级鉴权（方向二第一层） | 无 | 堵住最大安全漏洞 |
| P0 | 第三方插件动态加载（方向一方案 A 阶段 2） | P0 鉴权 | 让插件系统真正可用 |
| P1 | 声明式贡献消费（方向一方案 A 阶段 1） | 无 | 消除 manifest/activate 双数据源 |
| P1 | 存储重构 + Logger 接入（方向四 1+2） | 无 | 运维基础 |
| P1 | 拆 `invoke:core` 为细粒度权限（方向二第一层） | P0 鉴权 | 收窄攻击面 |
| P2 | ServiceRegistry（方向三 1） | 无 | 解锁插件组合 |
| P2 | 错误恢复 + semver（方向四 4+5） | 无 | 提升健壮性 |
| P2 | iframe 沙箱（方向二第二层） | P0 动态加载 | 强隔离 |
| P3 | ExtensionPoint（方向三 2） | P1 声明式贡献 | 替代命令式注入 |
| P3 | RPC 事件 + 生命周期钩子（方向三 3+4） | ServiceRegistry | 高级互操作 |
| P3 | 副作用追踪（方向四 3） | iframe 沙箱 | 热重载基础 |
| P3 | i18n（方向四 6） | 无 | 国际化 |
| P4 | 签名链（方向二第三层） | 插件市场 | 供应链安全 |
