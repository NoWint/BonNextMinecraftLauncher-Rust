# 插件系统 v2 全面改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 BonNext 插件系统的全部已知缺陷，实现真正的第三方插件动态加载、后端鉴权沙箱、插件间服务互操作、运行时健壮性，并补齐 i18n/签名/错误恢复等生态能力。

**Architecture:** 分层防御（后端 token 鉴权 + 前端 iframe 沙箱 + 签名链）+ 声明式贡献消费（manifest.contributes 为唯一源）+ ServiceRegistry/ExtensionPoint 互操作 + 受控副作用追踪。改造分 5 个优先级阶段（P0-P4），每个阶段产出可独立测试的软件。

**Tech Stack:** React 18, TypeScript, Vitest, Tauri v2 (Rust), zod (schema 校验), semver (版本比较), Ed25519 (签名)

**分析文档:** `docs/plugin-system-deep-analysis.md`

---

## 文件结构总览

### 新建文件

| 文件 | 职责 | 阶段 |
|------|------|------|
| `src-tauri/src/commands/plugin_session.rs` | 插件会话 token 管理 | P0 |
| `src-tauri/src/commands/plugin_install.rs` | 签名校验安装 | P4 |
| `src/plugins/core/PluginSession.ts` | 前端 token 管理 | P0 |
| `src/plugins/core/ComponentRegistry.ts` | 组件字符串 → 懒加载函数映射 | P0 |
| `src/plugins/core/DeclarativeContributions.ts` | manifest.contributes 声明式消费 | P0 |
| `src/plugins/core/ServiceRegistry.ts` | 插件间服务注册与消费 | P2 |
| `src/plugins/core/ExtensionPoint.ts` | 声明式扩展点 | P3 |
| `src/plugins/core/RpcEventBus.ts` | 请求/响应式事件 | P3 |
| `src/plugins/core/LifecycleHooks.ts` | 生命周期钩子调度 | P3 |
| `src/plugins/core/SideEffectTracker.ts` | 受控副作用追踪 | P3 |
| `src/plugins/core/SandboxLoader.ts` | iframe 沙箱加载器 | P2 |
| `src/app/hooks/useExtensions.ts` | ExtensionPoint 消费 hook | P3 |
| `src/app/hooks/usePluginLogs.ts` | 插件日志查看 hook | P1 |
| `src/app/components/PluginLogViewer.tsx` | 插件日志查看器 | P1 |

### 修改文件

| 文件 | 改动 | 阶段 |
|------|------|------|
| `src-tauri/src/commands/plugin_proxy.rs` | 所有 plugin_* 命令加 token 参数 + 复验权限 | P0 |
| `src-tauri/src/commands/mod.rs` | 注册 plugin_session 模块 | P0 |
| `src-tauri/src/lib.rs` | 注册新命令 | P0+ |
| `src-tauri/tauri.conf.json` | CSP 加 asset 协议、assetProtocol.scope 加 plugins | P0 |
| `src/plugins/core/types.ts` | 扩展 PluginManifest、PluginContext、PluginDefinition | P0+ |
| `src/plugins/core/PluginManager.ts` | 集成 session/declarative/service/EP/hooks/side-effect | P0+ |
| `src/plugins/core/PluginContext.ts` | 加 provide/consume/contribute/hooks/受控 API | P2+ |
| `src/plugins/core/PluginLoader.ts` | 真实动态 import + 声明式贡献 | P0 |
| `src/plugins/core/PermissionValidator.ts` | 拆细 invoke:core、细粒度权限映射 | P1 |
| `src/plugins/core/PluginStorage.ts` | 改用 token + per-plugin 文件 | P1 |
| `src/plugins/core/PluginLogger.ts` | 接入 utils/logger.ts | P1 |
| `src/plugins/core/EventBus.ts` | 加 RPC 能力 | P3 |
| `src/plugins/builtins/*/manifest.json` | 所有内置插件 manifest 更新细粒度权限 + i18n | P1+ |
| `src/plugins/builtins/*/index.ts` | 移除命令式 UI 注入，改纯声明式 | P0 |
| `src/shared/i18n/en-US.ts` | 加插件贡献的 i18n key | P3 |
| `src/shared/i18n/zh-CN.ts` | 加插件贡献的 i18n key | P3 |

---

## Phase P0：安全鉴权 + 动态加载（必做，堵住最大漏洞）

### Task P0-1：后端插件会话 token 管理

**Files:**
- Create: `src-tauri/src/commands/plugin_session.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 编写 plugin_session.rs 骨架与类型**

创建 `src-tauri/src/commands/plugin_session.rs`：

```rust
use crate::error::LauncherError;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use rand::Rng;

/// 插件会话：激活时颁发，携带权限快照
#[derive(Clone, Debug)]
pub struct PluginSession {
    pub plugin_id: String,
    pub permissions: Vec<String>,
    pub http_domains: Vec<String>,
    pub fs_read_scopes: Vec<String>,
    pub fs_write_scopes: Vec<String>,
    pub invoke_namespaces: Vec<String>,
    pub can_listen_events: bool,
    pub can_emit_events: bool,
    pub created_at: std::time::Instant,
}

/// 全局会话表：token → session
pub struct SessionStore {
    sessions: Mutex<HashMap<String, PluginSession>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// 颁发新 token，返回 64 字符十六进制字符串
    pub fn create(&self, session: PluginSession) -> String {
        let token: String = (0..64)
            .map(|_| format!("{:x}", rand::thread_rng().gen_range(0..16)))
            .collect();
        self.sessions.lock().insert(token.clone(), session);
        token
    }

    /// 校验 token 并返回 session 引用
    pub fn validate(&self, token: &str) -> Result<PluginSession, LauncherError> {
        self.sessions
            .lock()
            .get(token)
            .cloned()
            .ok_or_else(|| LauncherError::Other("Invalid or expired plugin session token".to_string()))
    }

    /// 撤销 token（插件 deactivate 时调用）
    pub fn revoke(&self, token: &str) {
        self.sessions.lock().remove(token);
    }

    /// 撤销某插件的所有 token（卸载时调用）
    pub fn revoke_by_plugin(&self, plugin_id: &str) {
        let mut sessions = self.sessions.lock();
        sessions.retain(|_, session| session.plugin_id != plugin_id);
    }
}

impl PluginSession {
    pub fn can_http(&self, url: &str) -> bool {
        let Ok(parsed) = url::Url::parse(url) else {
            return false;
        };
        let hostname = parsed.host_str().unwrap_or("");
        self.http_domains.iter().any(|domain| {
            hostname == domain || hostname.ends_with(&format!(".{}", domain))
        })
    }

    pub fn can_invoke(&self, command: &str) -> bool {
        if command.contains(':') {
            let ns = command.split(':').next().unwrap_or("");
            return self.invoke_namespaces.iter().any(|n| n == ns);
        }
        // 未映射命令默认拒绝（fail-closed）
        false
    }

    pub fn can_fs_read(&self, scope: &str) -> bool {
        self.fs_read_scopes.iter().any(|s| s == "global" || s == scope)
    }

    pub fn can_fs_write(&self, scope: &str) -> bool {
        self.fs_write_scopes.iter().any(|s| s == "global" || s == scope)
    }
}
```

- [ ] **Step 2: 在 commands/mod.rs 注册模块**

修改 `src-tauri/src/commands/mod.rs`，在末尾加：

```rust
pub mod plugin_session;
```

- [ ] **Step 3: 在 lib.rs 注册 SessionStore 为 Tauri managed state**

修改 `src-tauri/src/lib.rs`，在 `run()` 函数的 builder 链中（`.manage(AppState { ... })` 附近）加：

```rust
.manage(commands::plugin_session::SessionStore::new())
```

- [ ] **Step 4: 编写 register/revoke 命令**

在 `plugin_session.rs` 末尾加：

```rust
#[tauri::command]
pub async fn plugin_register_session(
    session_store: tauri::State<'_, SessionStore>,
    plugin_id: String,
    permissions: Vec<String>,
) -> Result<String, LauncherError> {
    // 校验 plugin_id 字符集
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }

    // 解析权限字符串为结构化 session
    let mut http_domains = Vec::new();
    let mut fs_read_scopes = Vec::new();
    let mut fs_write_scopes = Vec::new();
    let mut invoke_namespaces = Vec::new();
    let mut can_listen_events = false;
    let mut can_emit_events = false;

    for perm in &permissions {
        if let Some(domain) = perm.strip_prefix("http:") {
            http_domains.push(domain.to_string());
        } else if let Some(scope) = perm.strip_prefix("fs:read:") {
            fs_read_scopes.push(scope.to_string());
        } else if let Some(scope) = perm.strip_prefix("fs:write:") {
            fs_write_scopes.push(scope.to_string());
        } else if let Some(ns) = perm.strip_prefix("invoke:") {
            invoke_namespaces.push(ns.to_string());
        } else if perm == "events:listen" {
            can_listen_events = true;
        } else if perm == "events:emit" {
            can_emit_events = true;
        }
    }

    let session = PluginSession {
        plugin_id: plugin_id.clone(),
        permissions: permissions.clone(),
        http_domains,
        fs_read_scopes,
        fs_write_scopes,
        invoke_namespaces,
        can_listen_events,
        can_emit_events,
        created_at: std::time::Instant::now(),
    };

    Ok(session_store.create(session))
}

#[tauri::command]
pub async fn plugin_revoke_session(
    session_store: tauri::State<'_, SessionStore>,
    token: String,
) -> Result<(), LauncherError> {
    session_store.revoke(&token);
    Ok(())
}
```

- [ ] **Step 5: 在 lib.rs 注册新命令**

修改 `src-tauri/src/lib.rs` 的 `generate_handler!` 宏，在 `plugin_fs_read_dir,` 后加：

```rust
commands::plugin_session::plugin_register_session,
commands::plugin_session::plugin_revoke_session,
```

- [ ] **Step 6: 在 Cargo.toml 添加依赖**

修改 `src-tauri/Cargo.toml` 的 `[dependencies]`，确保有：

```toml
rand = "0.8"
url = "2"
parking_lot = "0.12"
```

- [ ] **Step 7: 运行 cargo check 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: 无错误，输出 `Finished`

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/plugin_session.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(plugin): add backend session token management for plugin auth"
```

---

### Task P0-2：后端 plugin_* 命令加 token 鉴权

**Files:**
- Modify: `src-tauri/src/commands/plugin_proxy.rs`

- [ ] **Step 1: 修改 plugin_http_get 加 token 校验**

修改 `src-tauri/src/commands/plugin_proxy.rs` 的 `plugin_http_get`：

```rust
#[tauri::command]
pub async fn plugin_http_get(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    url: String,
    params: Option<HashMap<String, String>>,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_http(&url) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot access {}",
            session.plugin_id, url
        )));
    }
    let client = crate::http_client::build_client();
    let mut req = client.get(&url);
    if let Some(p) = params {
        req = req.query(&p);
    }
    if let Some(h) = headers {
        for (k, v) in h {
            req = req.header(k, v);
        }
    }
    let resp = req.send().await?;
    let json: serde_json::Value = resp.json().await?;
    Ok(json)
}
```

- [ ] **Step 2: 同样修改 plugin_http_post**

```rust
#[tauri::command]
pub async fn plugin_http_post(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    url: String,
    body: serde_json::Value,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_http(&url) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot access {}",
            session.plugin_id, url
        )));
    }
    let client = crate::http_client::build_client();
    let mut req = client.post(&url).json(&body);
    if let Some(h) = headers {
        for (k, v) in h {
            req = req.header(k, v);
        }
    }
    let resp = req.send().await?;
    let json: serde_json::Value = resp.json().await?;
    Ok(json)
}
```

- [ ] **Step 3: 修改 plugin_storage_get/set/delete 用 token + per-plugin 文件**

替换 `plugin_storage_get/set/delete` 三个函数：

```rust
fn plugin_storage_path(plugin_id: &str) -> Result<std::path::PathBuf, LauncherError> {
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }
    let dir = crate::platform::paths::get_game_dir().join("plugin_storage");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(format!("{}.json", plugin_id)))
}

#[tauri::command]
pub async fn plugin_storage_get(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    key: String,
) -> Result<Option<String>, LauncherError> {
    let session = session_store.validate(&token)?;
    let path = plugin_storage_path(&session.plugin_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path)?;
    let map: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    Ok(map.get(&key).cloned())
}

#[tauri::command]
pub async fn plugin_storage_set(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    key: String,
    value: String,
) -> Result<(), LauncherError> {
    let session = session_store.validate(&token)?;
    let path = plugin_storage_path(&session.plugin_id)?;

    // 10MB 大小限制
    if value.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::Other("Storage value too large (max 10MB)".to_string()));
    }

    let mut map: HashMap<String, String> = if path.exists() {
        let data = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };

    // 检查总大小
    let total_size: usize = map.values().map(|v| v.len()).sum::<usize>() + value.len();
    if total_size > 50 * 1024 * 1024 {
        return Err(LauncherError::Other("Plugin storage quota exceeded (max 50MB)".to_string()));
    }

    map.insert(key, value);
    let data = serde_json::to_string_pretty(&map)?;
    std::fs::write(&path, data)?;
    Ok(())
}

#[tauri::command]
pub async fn plugin_storage_delete(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    key: String,
) -> Result<(), LauncherError> {
    let session = session_store.validate(&token)?;
    let path = plugin_storage_path(&session.plugin_id)?;
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).unwrap_or_default();
    let mut map: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    map.remove(&key);
    let data = serde_json::to_string_pretty(&map)?;
    std::fs::write(&path, data)?;
    Ok(())
}
```

- [ ] **Step 4: 修改 plugin_fs_* 命令用 token 替代 plugin_id 参数**

修改 `plugin_fs_read`：

```rust
#[tauri::command]
pub async fn plugin_fs_read(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    scope: String,
    path: String,
) -> Result<String, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_fs_read(&scope) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot read scope {}",
            session.plugin_id, scope
        )));
    }
    let root = resolve_fs_scope_root(&scope)?;
    let full = safe_join_fs(&root, &path)?;

    if !full.exists() {
        return Err(LauncherError::InvalidConfig(format!("File not found: {}", path)));
    }
    let metadata = std::fs::metadata(&full)?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::InvalidConfig("File too large for text editing (max 10MB)".into()));
    }
    let bytes = std::fs::read(&full)?;
    let is_binary = bytes.iter().any(|&b| b == 0);
    if is_binary {
        return Err(LauncherError::InvalidConfig("Binary file - read-only mode".into()));
    }
    String::from_utf8(bytes).map_err(|_| LauncherError::InvalidConfig("File is not valid UTF-8".into()))
}
```

同样修改 `plugin_fs_write`、`plugin_fs_exists`、`plugin_fs_read_dir`，把第一个参数从 `plugin_id: String` 改为 `token: String`，开头加 `let session = session_store.validate(&token)?;`，权限校验用 `session.can_fs_read/write(&scope)`，日志里的 `plugin_id` 改用 `session.plugin_id`。

- [ ] **Step 5: 运行 cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/plugin_proxy.rs
git commit -m "feat(plugin): enforce token-based auth on all plugin_* backend commands"
```

---

### Task P0-3：前端 PluginSession 与 PluginManager 集成

**Files:**
- Create: `src/plugins/core/PluginSession.ts`
- Modify: `src/plugins/core/PluginManager.ts`
- Modify: `src/plugins/core/PluginContext.ts`
- Modify: `src/plugins/core/PluginHttpClient.ts`
- Modify: `src/plugins/core/PluginFileSystem.ts`
- Modify: `src/plugins/core/PluginStorage.ts`
- Test: `src/plugins/core/__tests__/PluginManager.test.ts`

- [ ] **Step 1: 编写 PluginSession.ts**

创建 `src/plugins/core/PluginSession.ts`：

```typescript
// src/plugins/core/PluginSession.ts
import { invoke } from '@tauri-apps/api/core';

/**
 * 前端插件会话管理：激活时向后端注册并获取 token，
 * deactivate 时撤销。token 传递给所有 plugin_* 命令做后端鉴权。
 */
export class PluginSession {
  private token: string | null = null;

  constructor(private readonly pluginId: string, private readonly permissions: string[]) {}

  /** 激活时调用：向后端注册会话，获取 token */
  async register(): Promise<void> {
    this.token = await invoke<string>('plugin_register_session', {
      pluginId: this.pluginId,
      permissions: this.permissions,
    });
  }

  /** deactivate 时调用：撤销 token */
  async revoke(): Promise<void> {
    if (this.token) {
      try {
        await invoke('plugin_revoke_session', { token: this.token });
      } catch {
        // 后端可能已不可用，忽略错误
      }
      this.token = null;
    }
  }

  /** 获取当前 token（供 PluginHttpClient/FileSystem/Storage 使用） */
  getToken(): string {
    if (!this.token) {
      throw new Error(`Plugin session not registered for ${this.pluginId}`);
    }
    return this.token;
  }

  isActive(): boolean {
    return this.token !== null;
  }
}
```

- [ ] **Step 2: 修改 PluginHttpClient 加 token 参数**

修改 `src/plugins/core/PluginHttpClient.ts`：

```typescript
// src/plugins/core/PluginHttpClient.ts
import type { PluginHttpClient } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { PermissionValidator } from './PermissionValidator';
import type { PluginSession } from './PluginSession';

export function createPluginHttpClient(
  permissions: PermissionValidator,
  logger: { warn: (msg: string, ...args: unknown[]) => void },
  session: PluginSession,
): PluginHttpClient {
  return {
    async get(url, options) {
      if (!permissions.canHttp(url)) {
        logger.warn(`HTTP GET denied (no permission): ${url}`);
        throw new Error(`Permission denied: cannot access ${url}`);
      }
      return invoke('plugin_http_get', {
        token: session.getToken(),
        url,
        params: options?.params ?? null,
        headers: options?.headers ?? null,
      });
    },

    async post(url, body, options) {
      if (!permissions.canHttp(url)) {
        logger.warn(`HTTP POST denied (no permission): ${url}`);
        throw new Error(`Permission denied: cannot access ${url}`);
      }
      return invoke('plugin_http_post', {
        token: session.getToken(),
        url,
        body,
        headers: options?.headers ?? null,
      });
    },
  };
}
```

- [ ] **Step 3: 修改 PluginFileSystem 加 token 参数**

修改 `src/plugins/core/PluginFileSystem.ts`，函数签名加 `session: PluginSession`，invoke 调用加 `token: session.getToken()`，移除 `pluginId` 参数：

```typescript
export function createPluginFileSystem(
  permissions: PermissionValidator,
  logger: { warn: (msg: string, ...args: unknown[]) => void },
  session: PluginSession,
): PluginFileSystem {
  return {
    async readFile(path) {
      const { scope, relativePath } = checkScope(path);
      if (!permissions.canFsRead(scope)) {
        logger.warn(`FS read denied (no permission): ${path}`);
        throw new Error(`Permission denied: cannot read ${scope}`);
      }
      return invoke<string>('plugin_fs_read', {
        token: session.getToken(),
        scope,
        path: relativePath,
      });
    },
    // writeFile / readDir / exists 同理，把 pluginId: '' 换成 token: session.getToken()
  };
}
```

- [ ] **Step 4: 修改 PluginStorage 加 token 参数**

修改 `src/plugins/core/PluginStorage.ts`：

```typescript
import type { PluginStorage } from './types';
import { invoke } from '@tauri-apps/api/core';
import type { PluginSession } from './PluginSession';

export function createPluginStorage(session: PluginSession): PluginStorage {
  return {
    async get(key) {
      try {
        const value = await invoke<string | null>('plugin_storage_get', {
          token: session.getToken(),
          key,
        });
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await invoke('plugin_storage_set', {
        token: session.getToken(),
        key,
        value: JSON.stringify(value),
      });
    },
    async delete(key) {
      await invoke('plugin_storage_delete', { token: session.getToken(), key });
    },
  };
}
```

- [ ] **Step 5: 修改 PluginManager.activate() 集成 session**

修改 `src/plugins/core/PluginManager.ts` 的 `activate()` 方法，在构造 context 之前创建 session：

```typescript
// 在 activate() 的 try 块内，构造 permissions 之后：
const permissions = new PermissionValidator(plugin.manifest?.permissions ?? []);
const session = new PluginSession(pluginId, plugin.manifest?.permissions ?? []);
await session.register();

const logger = createPluginLogger(pluginId);
const storage = createPluginStorage(session);
const http = createPluginHttpClient(permissions, logger, session);
const fs = createPluginFileSystem(permissions, logger, session);
```

在 `activate()` 的 catch 块和 `deactivate()` 中加 session.revoke()：

```typescript
// activate catch 块：
} catch (e) {
  await session.revoke().catch(() => {});
  // ... 原有清理逻辑
}

// deactivate() 成功后：
await session.revoke().catch(() => {});
```

需要在 PluginManager.ts 顶部 import：

```typescript
import { PluginSession } from './PluginSession';
```

- [ ] **Step 6: 运行现有测试验证不破坏**

Run: `npx vitest run src/plugins/core/__tests__/PluginManager.test.ts 2>&1 | tail -20`
Expected: 现有测试可能因 invoke mock 失败，需要更新 mock

- [ ] **Step 7: 更新 PluginManager 测试 mock invoke**

修改 `src/plugins/core/__tests__/PluginManager.test.ts`，在文件顶部加 vi.mock：

```typescript
import { vi } from 'vitest';

// Mock Tauri invoke 和 getVersion
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'plugin_register_session') return Promise.resolve('mock-token');
    if (cmd === 'plugin_revoke_session') return Promise.resolve();
    return Promise.resolve();
  }),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('1.0.0'),
}));
```

- [ ] **Step 8: 运行测试验证通过**

Run: `npx vitest run src/plugins/core/__tests__/PluginManager.test.ts 2>&1 | tail -20`
Expected: 全部通过

- [ ] **Step 9: Commit**

```bash
git add src/plugins/core/PluginSession.ts src/plugins/core/PluginHttpClient.ts src/plugins/core/PluginFileSystem.ts src/plugins/core/PluginStorage.ts src/plugins/core/PluginManager.ts src/plugins/core/__tests__/PluginManager.test.ts
git commit -m "feat(plugin): integrate frontend session token into plugin context"
```

---

### Task P0-4：声明式贡献消费（manifest.contributes）

**Files:**
- Create: `src/plugins/core/ComponentRegistry.ts`
- Create: `src/plugins/core/DeclarativeContributions.ts`
- Modify: `src/plugins/core/PluginManager.ts`
- Test: `src/plugins/core/__tests__/DeclarativeContributions.test.ts`

- [ ] **Step 1: 编写 ComponentRegistry.ts**

创建 `src/plugins/core/ComponentRegistry.ts`：

```typescript
// src/plugins/core/ComponentRegistry.ts
import type { React } from 'react';

type LazyComponent = () => Promise<{ default: React.ComponentType<unknown> }>;

/**
 * 组件字符串名 → 懒加载函数的映射表。
 * 内置组件在此静态注册，第三方组件由 PluginLoader 动态注册。
 */
export class ComponentRegistry {
  private components = new Map<string, LazyComponent>();

  register(name: string, loader: LazyComponent): void {
    if (this.components.has(name)) {
      console.warn(`[ComponentRegistry] Component "${name}" already registered, overwriting`);
    }
    this.components.set(name, loader);
  }

  resolve(name: string): LazyComponent | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  /** 注册内置组件（在应用启动时调用一次） */
  registerBuiltins(entries: Record<string, LazyComponent>): void {
    for (const [name, loader] of Object.entries(entries)) {
      this.register(name, loader);
    }
  }
}

export const componentRegistry = new ComponentRegistry();
```

- [ ] **Step 2: 编写 DeclarativeContributions.ts**

创建 `src/plugins/core/DeclarativeContributions.ts`：

```typescript
// src/plugins/core/DeclarativeContributions.ts
import type { PluginManifest, PluginContext, ThemeContribution } from './types';
import { componentRegistry } from './ComponentRegistry';

/**
 * 遍历 manifest.contributes，把声明式贡献通过 ctx 注册到 PluginManager。
 * 在 definition.activate(ctx) 之前调用，使 UI 注入与插件代码解耦。
 *
 * 组件字符串通过 ComponentRegistry 解析为懒加载函数。
 * 解析失败的贡献项跳过并告警，不阻断插件激活。
 */
export function applyDeclarativeContributions(
  manifest: PluginManifest | undefined,
  ctx: PluginContext,
): void {
  if (!manifest?.contributes) return;

  const { contributes } = manifest;

  // 路由
  for (const route of contributes.routes ?? []) {
    const loader = componentRegistry.resolve(route.component);
    if (!loader) {
      console.warn(
        `[DeclarativeContributions] Component "${route.component}" not registered for route ${route.path}`,
      );
      continue;
    }
    ctx.registerRoute(route.path, loader);
  }

  // 侧边栏
  for (const item of contributes.sidebar ?? []) {
    ctx.addSidebarItem({
      id: item.id,
      label: item.label,
      icon: item.icon,
      route: item.route,
      order: item.order,
    });
  }

  // 设置页
  for (const section of contributes.settings ?? []) {
    const loader = componentRegistry.resolve(section.component);
    if (!loader) {
      console.warn(
        `[DeclarativeContributions] Component "${section.component}" not registered for settings ${section.id}`,
      );
      continue;
    }
    ctx.addSettingsSection({
      id: section.id,
      label: section.label,
      component: loader,
      order: section.order,
    });
  }

  // 上下文菜单
  for (const item of contributes.contextMenu ?? []) {
    // 上下文菜单的 action 无法声明式表达，需要插件代码注册
    // manifest 只声明 id/label/where，action 由插件在 activate() 里通过 ctx.addContextMenuItem 补充
    console.debug(
      `[DeclarativeContributions] Context menu item "${item.id}" declared, plugin should register action in activate()`,
    );
  }

  // 实例标签页
  for (const tab of contributes.instanceTabs ?? []) {
    const loader = componentRegistry.resolve(tab.component);
    if (!loader) {
      console.warn(
        `[DeclarativeContributions] Component "${tab.component}" not registered for instance tab ${tab.id}`,
      );
      continue;
    }
    ctx.addInstanceTab({
      id: tab.id,
      label: tab.label,
      component: loader,
      order: tab.order,
    });
  }

  // 主题
  for (const theme of contributes.themes ?? []) {
    const contribution: Omit<ThemeContribution, 'pluginId'> = {
      id: theme.id,
      name: theme.name,
      cssVariables: theme.cssVariables ?? {},
      fonts: theme.fonts,
      mode: theme.mode ?? 'dark',
    };
    ctx.registerTheme(contribution);
  }
}
```

- [ ] **Step 3: 在 PluginManager.activate() 调用声明式消费**

修改 `src/plugins/core/PluginManager.ts` 的 `activate()` 方法，在 `await plugin.definition.activate(ctx);` **之前**加：

```typescript
import { applyDeclarativeContributions } from './DeclarativeContributions';

// 在 activate() 的 try 块内，构造 ctx 之后：
applyDeclarativeContributions(plugin.manifest, ctx);
await plugin.definition.activate(ctx);
```

- [ ] **Step 4: 编写 DeclarativeContributions 测试**

创建 `src/plugins/core/__tests__/DeclarativeContributions.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyDeclarativeContributions } from '../DeclarativeContributions';
import { componentRegistry } from '../ComponentRegistry';
import type { PluginManifest, PluginContext } from '../types';

function createMockCtx(): PluginContext & { _calls: string[] } {
  const calls: string[] = [];
  return {
    pluginId: 'test',
    _calls: calls,
    registerRoute: (path) => calls.push(`route:${path}`),
    addSidebarItem: (item) => calls.push(`sidebar:${item.id}`),
    addSettingsSection: (s) => calls.push(`settings:${s.id}`),
    addContextMenuItem: (i) => calls.push(`context:${i.id}`),
    addInstanceTab: (t) => calls.push(`tab:${t.id}`),
    registerTheme: (t) => calls.push(`theme:${t.id}`),
    invoke: vi.fn(),
    http: {} as never,
    fs: {} as never,
    events: {} as never,
    storage: {} as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as never;
}

describe('DeclarativeContributions', () => {
  beforeEach(() => {
    // 清空 registry
    componentRegistry['_components'].clear();
  });

  it('should register routes from manifest.contributes', () => {
    componentRegistry.register('TestPage', () => Promise.resolve({ default: () => null }));
    const ctx = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        routes: [{ path: '/test', component: 'TestPage' }],
      },
    };
    applyDeclarativeContributions(manifest, ctx as never);
    expect((ctx as never)._calls).toContain('route:/test');
  });

  it('should register sidebar items', () => {
    const ctx = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        sidebar: [{ id: 'test', label: 'Test', icon: '🧪', route: '/test', order: 1 }],
      },
    };
    applyDeclarativeContributions(manifest, ctx as never);
    expect((ctx as never)._calls).toContain('sidebar:test');
  });

  it('should skip routes with unregistered components', () => {
    const ctx = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        routes: [{ path: '/missing', component: 'MissingPage' }],
      },
    };
    applyDeclarativeContributions(manifest, ctx as never);
    expect((ctx as never)._calls).not.toContain('route:/missing');
  });

  it('should register themes with cssVariables', () => {
    const ctx = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        themes: [{
          id: 'custom',
          name: 'Custom',
          mode: 'dark',
          cssVariables: { '--accent': '#ff0000' },
        }],
      },
    };
    applyDeclarativeContributions(manifest, ctx as never);
    expect((ctx as never)._calls).toContain('theme:custom');
  });
});
```

- [ ] **Step 5: 运行测试**

Run: `npx vitest run src/plugins/core/__tests__/DeclarativeContributions.test.ts 2>&1 | tail -20`
Expected: 全部通过

- [ ] **Step 6: 注册内置组件到 ComponentRegistry**

创建 `src/plugins/builtins/_registry.ts`：

```typescript
// src/plugins/builtins/_registry.ts
// 内置组件注册到 ComponentRegistry，供 manifest.contributes 字符串引用
import { componentRegistry } from '../core/ComponentRegistry';

export function registerBuiltinComponents(): void {
  // Marketplace
  componentRegistry.register('MarketplacePage', () => import('../../shells/zzz/pages/MarketplacePage'));
  componentRegistry.register('ContentDetailPage', () => import('../../shells/zzz/pages/ContentDetailPage'));
  componentRegistry.register('CollectionsPage', () => import('../../shells/zzz/pages/CollectionsPage'));
  componentRegistry.register('LibraryPage', () => import('../../shells/zzz/pages/LibraryPage'));

  // 其他内置组件按需添加
}
```

- [ ] **Step 7: 在 PluginProvider 调用 registerBuiltinComponents**

修改 `src/plugins/core/PluginProvider.tsx` 的 `init()` 函数，在 `pluginLoader.loadBuiltinPlugins(manager)` 之前加：

```typescript
import { registerBuiltinComponents } from '../builtins/_registry';

// 在 init() 开头：
registerBuiltinComponents();
```

- [ ] **Step 8: 简化内置插件 activate()，移除命令式 UI 注入**

修改 `src/plugins/builtins/marketplace/index.ts`，移除 `ctx.registerRoute` 和 `ctx.addSidebarItem` 调用，只保留事件监听：

```typescript
export const marketplacePlugin = definePlugin({
  id: 'com.bonnext.marketplace',
  name: 'Marketplace',
  version: '1.0.0',
  description: 'Modrinth & CurseForge & ModpackIndex content browser',

  activate(ctx: PluginContext) {
    // UI 注入由 manifest.contributes 声明式处理，这里只做事件订阅
    ctx.events.on('instance:created', () => {
      ctx.logger.info('New instance created, refreshing recommendations');
    });
    ctx.logger.info('Marketplace plugin activated');
  },

  deactivate() {
    // ctx 自动清理所有注册项
  },
});
```

对其他内置插件（servers、social、ai、security、mod-tools、system-tools）做同样简化，移除 activate() 里的 UI 注入调用，保留事件订阅和日志。

- [ ] **Step 9: 运行全部插件测试**

Run: `npx vitest run src/plugins/ 2>&1 | tail -20`
Expected: 全部通过

- [ ] **Step 10: Commit**

```bash
git add src/plugins/core/ComponentRegistry.ts src/plugins/core/DeclarativeContributions.ts src/plugins/core/PluginManager.ts src/plugins/core/__tests__/DeclarativeContributions.test.ts src/plugins/builtins/_registry.ts src/plugins/builtins/*/index.ts src/plugins/core/PluginProvider.tsx
git commit -m "feat(plugin): declarative contribution consumption from manifest"
```

---

### Task P0-5：第三方插件动态加载

**Files:**
- Modify: `src/plugins/core/PluginLoader.ts`
- Modify: `src-tauri/src/commands/plugin_proxy.rs`
- Modify: `src-tauri/tauri.conf.json`
- Test: `src/plugins/core/__tests__/PluginLoader.test.ts`

- [ ] **Step 1: 后端 list_installed_plugins 返回完整 manifest + entry**

修改 `src-tauri/src/commands/plugin_proxy.rs` 的 `InstalledPluginInfo` 和 `list_installed_plugins`：

```rust
#[derive(serde::Serialize)]
pub struct InstalledPluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub permissions: Vec<String>,
    pub directory: String,
    pub contributes: Option<serde_json::Value>,  // 新增
    pub entry: Option<String>,                    // 新增：入口 JS 相对路径
}

// 在 list_installed_plugins 中读取 contributes 和 entry：
plugins.push(InstalledPluginInfo {
    id: manifest["id"].as_str().unwrap_or("unknown").to_string(),
    name: manifest["name"].as_str().unwrap_or("Unknown").to_string(),
    version: manifest["version"].as_str().unwrap_or("0.0.0").to_string(),
    description: manifest["description"].as_str().map(|s| s.to_string()),
    author: manifest["author"].as_str().map(|s| s.to_string()),
    permissions: manifest["permissions"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default(),
    directory: path.to_string_lossy().to_string(),
    contributes: manifest.get("contributes").cloned(),
    entry: manifest["entry"].as_str().map(|s| s.to_string()).or(Some("index.js".to_string())),
});
```

- [ ] **Step 2: 修改 tauri.conf.json 扩展 assetProtocol scope**

修改 `src-tauri/tauri.conf.json` 的 `assetProtocol.scope`：

```json
"assetProtocol": {
  "enable": true,
  "scope": [
    "$DATA/bonnext/shells/**/*",
    "$DATA/bonnext/plugins/**/*"
  ]
}
```

- [ ] **Step 3: 修改 PluginLoader 实现动态 import**

修改 `src/plugins/core/PluginLoader.ts`，替换 `createPlaceholderDefinition`：

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

async function loadPluginEntry(info: InstalledPluginInfo): Promise<PluginDefinition | null> {
  const entry = info.entry ?? 'index.js';
  // 把磁盘路径转成 asset:// URL
  const filePath = `${info.directory}/${entry}`;
  const url = convertFileSrc(filePath);

  try {
    // @vite-ignore 让 Vite 跳过静态分析，保留运行时 import()
    const module = await import(/* @vite-ignore */ url);
    const definition = module.default ?? module;
    if (!definition || typeof definition.activate !== 'function') {
      console.error(`[PluginLoader] Plugin "${info.id}" entry has no valid default export`);
      return null;
    }
    return definition;
  } catch (e) {
    console.error(`[PluginLoader] Failed to load plugin entry "${info.id}":`, e);
    return null;
  }
}

function createManifestFromInstalled(info: InstalledPluginInfo): PluginManifest {
  return {
    id: info.id,
    name: info.name,
    version: info.version,
    description: info.description ?? undefined,
    author: info.author ?? undefined,
    permissions: info.permissions,
    contributes: info.contributes as PluginManifest['contributes'] | undefined,
  };
}
```

修改 `loadInstalledPlugins`：

```typescript
async loadInstalledPlugins(manager: PluginManager): Promise<void> {
  let installed: InstalledPluginInfo[] = [];
  try {
    installed = await invoke<InstalledPluginInfo[]>('list_installed_plugins');
  } catch (e) {
    console.debug('[PluginLoader] No installed plugins or command unavailable:', e);
    return;
  }

  for (const info of installed) {
    if (manager.getPlugin(info.id)) continue;

    try {
      const definition = await loadPluginEntry(info);
      if (!definition) {
        // 入口加载失败，注册一个 error 状态的占位
        manager.register({
          id: info.id,
          name: info.name,
          version: info.version,
          description: info.description ?? undefined,
          activate() { throw new Error('Plugin entry failed to load'); },
        }, createManifestFromInstalled(info));
        continue;
      }
      const manifest = createManifestFromInstalled(info);
      manager.register(definition, manifest);
      console.info(`[PluginLoader] Installed plugin loaded: ${info.id}@${info.version}`);
    } catch (e) {
      console.error(`[PluginLoader] Failed to load installed plugin "${info.id}":`, e);
    }
  }
}
```

- [ ] **Step 4: 更新 InstalledPluginInfo 前端类型**

修改 `src/plugins/core/PluginLoader.ts` 顶部的 `InstalledPluginInfo` 接口：

```typescript
interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  permissions: string[];
  directory: string;
  contributes: unknown | null;  // 新增
  entry: string | null;          // 新增
}
```

- [ ] **Step 5: 运行 cargo check 验证后端**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10`
Expected: 无错误

- [ ] **Step 6: 运行前端类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/plugins/core/PluginLoader.ts src-tauri/src/commands/plugin_proxy.rs src-tauri/tauri.conf.json
git commit -m "feat(plugin): dynamic loading of third-party plugins via convertFileSrc"
```

---

## Phase P1：权限拆细 + 存储重构 + Logger 接入

### Task P1-1：拆细 invoke:core 为细粒度权限

**Files:**
- Modify: `src/plugins/core/PermissionValidator.ts`
- Modify: `src/plugins/core/__tests__/PermissionValidator.test.ts`
- Modify: `src/plugins/builtins/*/manifest.json`

- [ ] **Step 1: 扩展 COMMAND_NAMESPACE_MAP 覆盖所有命令**

修改 `src/plugins/core/PermissionValidator.ts`，把 `COMMAND_NAMESPACE_MAP` 扩展为完整命令映射，移除 `invoke:core` 兜底：

```typescript
const COMMAND_PERMISSION_MAP: Record<string, string> = {
  // marketplace
  search_mods: 'marketplace',
  get_modrinth_project: 'marketplace',
  // ... 保留原有 marketplace 映射
  // social
  list_friends: 'social',
  // ... 保留原有 social 映射
  // 新增：core 细分
  launch_game: 'core:launch',
  get_launch_state: 'core:launch',
  stop_game: 'core:launch',
  read_accounts: 'core:accounts:read',
  save_account: 'core:accounts:write',
  remove_account: 'core:accounts:write',
  get_config: 'core:config:read',
  save_config: 'core:config:write',
  get_instances: 'core:instances:read',
  create_instance: 'core:instances:write',
  delete_instance: 'core:instances:write',
  install_version: 'core:versions:write',
  // ... 其他命令按域归类
};

export class PermissionValidator {
  // ... 原有字段

  canInvoke(command: string): boolean {
    // 带冒号的命名空间命令
    if (command.includes(':')) {
      const ns = command.split(':')[0];
      return this.invokeNamespaces.has(ns);
    }
    // 扁平命令查映射表
    const mapped = COMMAND_PERMISSION_MAP[command];
    if (mapped) {
      // 支持嵌套命名空间：core:launch → 检查 invokeNamespaces 是否有 "core:launch" 或 "core"
      if (this.invokeNamespaces.has(mapped)) return true;
      // 也接受父级：invoke:core 覆盖 core:* （向后兼容）
      const parent = mapped.split(':')[0];
      return this.invokeNamespaces.has(parent);
    }
    // 未映射命令默认拒绝（fail-closed）
    return false;
  }
}
```

- [ ] **Step 2: 更新 PermissionValidator 测试**

修改 `src/plugins/core/__tests__/PermissionValidator.test.ts`，加测试：

```typescript
it('should reject unmapped commands (fail-closed)', () => {
  const v = new PermissionValidator(['invoke:marketplace']);
  expect(v.canInvoke('unknown_command')).toBe(false);
});

it('should accept nested namespace permissions', () => {
  const v = new PermissionValidator(['invoke:core:launch']);
  expect(v.canInvoke('launch_game')).toBe(true);
});

it('should accept parent namespace for child commands', () => {
  const v = new PermissionValidator(['invoke:core']);
  expect(v.canInvoke('launch_game')).toBe(true);
});
```

- [ ] **Step 3: 更新内置插件 manifest 用细粒度权限**

修改 `src/plugins/builtins/marketplace/manifest.json`，把 `"invoke:core"` 替换为具体权限：

```json
"permissions": [
  "http:modrinth.com",
  "http:curseforge.com",
  "http:modpackindex.com",
  "fs:read:instances",
  "fs:write:instances",
  "invoke:marketplace",
  "invoke:core:instances:read",
  "invoke:core:versions:read",
  "events:listen",
  "events:emit"
]
```

对其他内置插件 manifest 做同样更新，移除宽泛的 `invoke:core`，改为具体细粒度权限。

- [ ] **Step 4: 运行测试**

Run: `npx vitest run src/plugins/core/__tests__/PermissionValidator.test.ts 2>&1 | tail -20`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add src/plugins/core/PermissionValidator.ts src/plugins/core/__tests__/PermissionValidator.test.ts src/plugins/builtins/*/manifest.json
git commit -m "feat(plugin): split invoke:core into fine-grained permissions"
```

---

### Task P1-2：Logger 接入核心日志系统

**Files:**
- Modify: `src/plugins/core/PluginLogger.ts`
- Create: `src/app/hooks/usePluginLogs.ts`
- Create: `src/app/components/PluginLogViewer.tsx`

- [ ] **Step 1: 修改 PluginLogger 接入 utils/logger.ts**

修改 `src/plugins/core/PluginLogger.ts`：

```typescript
import type { PluginLogger } from './types';
import { logger } from '@/shared/utils/logger';

export function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[plugin:${pluginId}]`;
  return {
    info(message: string, ...args: unknown[]) {
      logger.info(prefix, message, ...args);
    },
    warn(message: string, ...args: unknown[]) {
      logger.warn(prefix, message, ...args);
    },
    error(message: string, ...args: unknown[]) {
      logger.error(prefix, message, ...args);
    },
  };
}
```

- [ ] **Step 2: 编写 usePluginLogs hook**

创建 `src/app/hooks/usePluginLogs.ts`：

```typescript
import { useState, useEffect, useMemo } from 'react';
import { logger } from '@/shared/utils/logger';

export interface PluginLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  pluginId?: string;
}

export function usePluginLogs(pluginId?: string) {
  const [logs, setLogs] = useState<PluginLogEntry[]>([]);

  useEffect(() => {
    // 从 logger 内存缓冲过滤插件日志
    const allLogs = logger.getBuffer();
    const filtered = pluginId
      ? allLogs.filter((l) => l.message.includes(`[plugin:${pluginId}]`))
      : allLogs.filter((l) => l.message.includes('[plugin:'));
    setLogs(filtered);

    // 订阅新日志
    const unsubscribe = logger.subscribe((entry) => {
      if (!entry.message.includes('[plugin:')) return;
      if (pluginId && !entry.message.includes(`[plugin:${pluginId}]`)) return;
      setLogs((prev) => [...prev.slice(-199), entry]);
    });

    return unsubscribe;
  }, [pluginId]);

  return logs;
}
```

注意：需要确认 `utils/logger.ts` 是否有 `getBuffer()` 和 `subscribe()` 方法，如果没有需要先添加。

- [ ] **Step 3: 检查并扩展 utils/logger.ts**

读取 `src/shared/utils/logger.ts`，如果没有 `getBuffer()` 和 `subscribe()`，添加：

```typescript
// 在 logger 对象中添加：
getBuffer(): LogEntry[] {
  return [...buffer];
},

subscribe(listener: (entry: LogEntry) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
},
```

- [ ] **Step 4: 编写 PluginLogViewer 组件**

创建 `src/app/components/PluginLogViewer.tsx`：

```typescript
import { useState } from 'react';
import { usePluginLogs } from '../hooks/usePluginLogs';
import styles from './PluginLogViewer.module.css';

export function PluginLogViewer({ pluginId }: { pluginId?: string }) {
  const logs = usePluginLogs(pluginId);
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filtered = levelFilter === 'all' ? logs : logs.filter((l) => l.level === levelFilter);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Plugin Logs {pluginId ? `(${pluginId})` : ''}</h3>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as never)}>
          <option value="all">All</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>
      <div className={styles.logList}>
        {filtered.length === 0 && <div className={styles.empty}>No logs</div>}
        {filtered.map((log, i) => (
          <div key={i} className={`${styles.logEntry} ${styles[log.level]}`}>
            <span className={styles.timestamp}>{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={styles.level}>{log.level.toUpperCase()}</span>
            <span className={styles.message}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 在 PluginManagementSection 加日志查看入口**

修改 `src/shells/zzz/pages/settings/PluginManagementSection.tsx`，在 `RegisteredPluginCard` 加 "View Logs" 按钮，点击弹出包含 `PluginLogViewer` 的 Modal。

- [ ] **Step 6: 运行类型检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/plugins/core/PluginLogger.ts src/app/hooks/usePluginLogs.ts src/app/components/PluginLogViewer.tsx src/shared/utils/logger.ts src/shells/zzz/pages/settings/PluginManagementSection.tsx
git commit -m "feat(plugin): integrate plugin logger with core logging system"
```

---

## Phase P2：ServiceRegistry + 错误恢复 + iframe 沙箱

### Task P2-1：ServiceRegistry 实现

**Files:**
- Create: `src/plugins/core/ServiceRegistry.ts`
- Modify: `src/plugins/core/types.ts`
- Modify: `src/plugins/core/PluginContext.ts`
- Modify: `src/plugins/core/PluginManager.ts`
- Test: `src/plugins/core/__tests__/ServiceRegistry.test.ts`

- [ ] **Step 1: 定义 ServiceRegistry 接口与实现**
- [ ] **Step 2: 在 PluginContext 加 provide/consume/requestService**
- [ ] **Step 3: 在 PluginManager 集成 ServiceRegistry（deactivate 时注销）**
- [ ] **Step 4: 编写测试（注册、消费、超时、deactivate 注销）**
- [ ] **Step 5: Commit**

### Task P2-2：错误恢复机制

**Files:**
- Modify: `src/plugins/core/types.ts`
- Modify: `src/plugins/core/PluginManager.ts`
- Modify: `src/shells/zzz/pages/settings/PluginManagementSection.tsx`

- [ ] **Step 1: RegisteredPlugin 加 failureCount/lastError/autoDisabled 字段**
- [ ] **Step 2: activate() 失败时递增 failureCount，>=3 时 autoDisabled=true**
- [ ] **Step 3: activateAll() 跳过 autoDisabled 插件**
- [ ] **Step 4: 设置页显示"已自动禁用"+ "重置并重试"按钮**
- [ ] **Step 5: 错误详情 Modal 显示堆栈+时间戳+失败次数**
- [ ] **Step 6: Commit**

### Task P2-3：semver 完整实现

**Files:**
- Modify: `package.json`（加 semver 依赖）
- Modify: `src/plugins/core/PluginManager.ts`

- [ ] **Step 1: pnpm add semver @types/semver**
- [ ] **Step 2: 用 semver.satisfies 替换 isVersionSatisfied**
- [ ] **Step 3: minAppVersion 语义改为版本范围（^、~、>=）**
- [ ] **Step 4: 更新测试**
- [ ] **Step 5: Commit**

### Task P2-4：iframe 沙箱（高安全级插件）

**Files:**
- Create: `src/plugins/core/SandboxLoader.ts`
- Modify: `src/plugins/core/PluginLoader.ts`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 编写 SandboxLoader，用 iframe + postMessage 隔离插件 UI**
- [ ] **Step 2: 插件 manifest 加 sandbox: true/false 标记**
- [ ] **Step 3: sandbox=true 的插件用 iframe 加载，false 的用直接 import**
- [ ] **Step 4: postMessage 协议设计（invoke/http/fs/events 代理）**
- [ ] **Step 5: CSP 严格化 iframe**
- [ ] **Step 6: Commit**

---

## Phase P3：ExtensionPoint + RPC + 生命周期钩子 + 副作用追踪 + i18n

### Task P3-1：ExtensionPoint 实现

**Files:**
- Create: `src/plugins/core/ExtensionPoint.ts`
- Create: `src/app/hooks/useExtensions.ts`
- Modify: `src/plugins/core/types.ts`
- Modify: `src/plugins/core/PluginContext.ts`

- [ ] **Step 1: 定义 ExtensionPoint<T> 接口（id + zod schema）**
- [ ] **Step 2: PluginManager 维护 Map<epId, Contribution[]>**
- [ ] **Step 3: ctx.contribute(epId, contribution) 加 zod 校验**
- [ ] **Step 4: useExtensions(epId) hook 基于 useSyncExternalStore**
- [ ] **Step 5: 核心代码声明 EP（如 home:widget、instance:tab）**
- [ ] **Step 6: Commit**

### Task P3-2：RPC 式事件

**Files:**
- Modify: `src/plugins/core/EventBus.ts`
- Modify: `src/plugins/core/types.ts`

- [ ] **Step 1: EventBus 加 handleRequest/request 方法**
- [ ] **Step 2: request 生成 correlationId，超时 reject**
- [ ] **Step 3: 命名空间强制（reqId 以 pluginId: 前缀）**
- [ ] **Step 4: 测试请求/响应、超时、多 handler**
- [ ] **Step 5: Commit**

### Task P3-3：生命周期钩子

**Files:**
- Create: `src/plugins/core/LifecycleHooks.ts`
- Modify: `src/plugins/core/types.ts`
- Modify: `src/plugins/core/PluginManager.ts`
- Modify: 核心代码各调用点（launch、install、download）

- [ ] **Step 1: 定义 PluginLifecycleHooks 接口（onAppReady/beforeInstanceLaunch/afterInstanceLaunch/beforeModInstall 等）**
- [ ] **Step 2: PluginDefinition 加 hooks? 字段**
- [ ] **Step 3: PluginManager 加 emitLifecycleHook 方法（遍历 active 插件调用 hook）**
- [ ] **Step 4: before* 钩子 async + 可拦截（任一返回 allow:false 即中止）**
- [ ] **Step 5: 在 launch/ install 流程插入钩子调用**
- [ ] **Step 6: Commit**

### Task P3-4：副作用追踪

**Files:**
- Create: `src/plugins/core/SideEffectTracker.ts`
- Modify: `src/plugins/core/PluginContext.ts`
- Modify: `src/plugins/core/PluginManager.ts`

- [ ] **Step 1: SideEffectTracker 维护 per-plugin timer/listener/node 集合**
- [ ] **Step 2: ctx.setInterval/addEventListener/mountPortal/subscribeStore 受控 API**
- [ ] **Step 3: deactivate 时遍历清理**
- [ ] **Step 4: 测试副作用自动撤销**
- [ ] **Step 5: Commit**

### Task P3-5：i18n 集成

**Files:**
- Modify: `src/plugins/core/types.ts`
- Modify: `src/plugins/core/PluginManager.ts`
- Modify: `src/shared/i18n/index.tsx`
- Modify: `src/plugins/builtins/*/manifest.json`

- [ ] **Step 1: SidebarItem.label 类型改为 string | { i18nKey: string }**
- [ ] **Step 2: manifest 加 i18n: { en: {...}, zh-CN: {...} } 字段**
- [ ] **Step 3: 插件激活时把 manifest.i18n 合并到全局 i18n（命名空间 plugin:<id>:）**
- [ ] **Step 4: usePluginSidebarItems 返回的 label 经过 i18n 解析**
- [ ] **Step 5: 更新所有内置插件 manifest 加 i18n 资源**
- [ ] **Step 6: Commit**

---

## Phase P4：签名链 + 插件市场

### Task P4-1：签名校验

**Files:**
- Create: `src-tauri/src/commands/plugin_install.rs`
- Modify: `src-tauri/src/commands/plugin_proxy.rs`
- Modify: `src-tauri/Cargo.toml`（加 ed25519-dalek 依赖）

- [ ] **Step 1: 定义签名格式（zip 内 SIGNATURE.sig = Ed25519(树哈希)）**
- [ ] **Step 2: 内置受信公钥集（编译时注入）**
- [ ] **Step 3: install_plugin 加 signature 参数，验签失败拒绝**
- [ ] **Step 4: 设置页加"管理受信公钥"UI**
- [ ] **Step 5: Commit**

### Task P4-2：插件市场（远期）

- [ ] 在线注册表 API 设计
- [ ] 搜索/浏览/安装流程
- [ ] 自动更新检查
- [ ] 版本升级路径

---

## 自检清单

### Spec 覆盖率

| 分析文档章节 | 对应 Task |
|-------------|-----------|
| 1.1 第三方插件无法运行 | P0-5 |
| 1.2 manifest.contributes 死代码 | P0-4 |
| 1.3 修复方案 A | P0-4, P0-5 |
| 2.1 前端权限校验形同虚设 | P0-1, P0-2, P0-3 |
| 2.2 后端代理不复验 | P0-2 |
| 2.3 invoke:core 兜底过宽 | P1-1 |
| 2.4 无签名校验 | P4-1 |
| 2.5 修复方案（三层防御） | P0-1~P0-3, P1-1, P2-4, P4-1 |
| 3.1 dependencies 非服务契约 | P2-1 |
| 3.2 EventBus 无请求/响应 | P3-2 |
| 3.3 生命周期钩子不全 | P3-3 |
| 3.4 修复方案 | P2-1, P3-1, P3-2, P3-3 |
| 4.1 存储模型粗糙 | P0-2（per-plugin 文件已包含） |
| 4.2 Logger 不接入 | P1-2 |
| 4.3 无热重载 | P3-4 |
| 4.4 错误恢复薄弱 | P2-2 |
| 4.5 semver 不完整 | P2-3 |
| 4.6 i18n 缺失 | P3-5 |

### 风险与缓解

1. **P0-3 测试 mock 复杂**：Tauri invoke 需要全局 mock，已在 Step 7 提供 mock 模板。
2. **P0-5 convertFileSrc 行为差异**：dev 和 prod 路径不同，需要在 dev 模式用 `http://localhost:1420` 代理，prod 用 `asset://`。建议先在 prod 模式测试。
3. **P1-1 拆细权限可能破坏现有插件**：保留 `invoke:core` 父级兼容，未映射命令 fail-closed 可能拒绝合法调用——需要在 COMMAND_PERMISSION_MAP 中补全所有命令。
4. **P2-4 iframe 沙箱与主题继承冲突**：需要显式注入 CSS 变量到 iframe。
5. **P3-3 生命周期钩子改动面大**：需要在 launch/install/download 多处插入调用点，建议最后做。

---

## 执行建议

**推荐执行顺序**：P0-1 → P0-2 → P0-3 → P0-4 → P0-5 → P1-1 → P1-2 → P2-1 → P2-2 → P2-3 → P2-4 → P3-1 → P3-2 → P3-3 → P3-4 → P3-5 → P4-1

**每个 Task 完成后**：运行 `cargo check` + `npx tsc --noEmit` + 相关 vitest，全绿后再 commit。

**阶段验收**：
- P0 完成：第三方插件能动态加载并运行，后端命令有 token 鉴权
- P1 完成：权限细粒度化，Logger 可查看
- P2 完成：插件间可服务互调，错误自动恢复，高安全插件可沙箱
- P3 完成：声明式扩展点，RPC 事件，生命周期钩子，副作用追踪，i18n
- P4 完成：签名校验，供应链安全
