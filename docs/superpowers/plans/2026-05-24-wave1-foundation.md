# Wave 1: 地基 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拆分 lib.rs 巨型文件、迁移前端路由、清理依赖、实现 Discord RPC/LAN 发现/GPU 检测/电池管理、建立微交互框架和统一加载态。

**Architecture:** 将 3525 行的 lib.rs 按领域拆分为 20 个 commands/ 子模块，lib.rs 只保留 run() + AppState + 命令注册（~300行）。前端从手写 hash 路由迁移到 react-router-dom。新增 Discord RPC、LAN 发现等真实实现替换占位代码。

**Tech Stack:** Rust (Tauri v2, discord-rich-presence, scraper, sysinfo), React 18, TypeScript, react-router-dom v7, CSS Modules

---

## File Structure

### 新增文件

| 文件 | 职责 |
|------|------|
| `src-tauri/src/commands/mod.rs` | 命令模块公共导出 |
| `src-tauri/src/commands/auth.rs` | 认证命令 (8个) |
| `src-tauri/src/commands/config.rs` | 配置命令 (2个) |
| `src-tauri/src/commands/instance.rs` | 实例管理命令 (14个) + SnapshotInfo + copy_dir_recursive + dir_size |
| `src-tauri/src/commands/launch.rs` | 启动/下载命令 (5个) + launch_game_inner + download_version_inner + extract_natives |
| `src-tauri/src/commands/version.rs` | 版本命令 (1个) |
| `src-tauri/src/commands/modrinth.rs` | Modrinth 命令 (7个) |
| `src-tauri/src/commands/curseforge.rs` | CurseForge 命令 (7个) |
| `src-tauri/src/commands/content.rs` | 内容库命令 (10个) + InstalledModInfo + ContentCounts + BulkUpdateResult + count_files_in_dir + compute_dir_size_mb/bytes |
| `src-tauri/src/commands/collections.rs` | 收藏命令 (4个) |
| `src-tauri/src/commands/system.rs` | 系统命令 (6个) + HardwareProfile + DiskUsageInfo + DiskBreakdownItem |
| `src-tauri/src/commands/server.rs` | 服务器命令 (1个) + ServerStatusInfo + SLP 协议实现 |
| `src-tauri/src/commands/social.rs` | Discord RPC 命令 (3个) + FriendEntry + 好友命令 (3个) |
| `src-tauri/src/commands/network.rs` | LAN 发现 (3个) + P2P (2个) + Web API (1个) + LanWorldInfo + P2PPeer + WebApiStatus |
| `src-tauri/src/commands/cli.rs` | CLI 命令 (1个) + BatteryStatus |
| `src-tauri/src/commands/news.rs` | 新闻命令 (2个) + MinecraftNewsEntry + Article 解析 structs + HTML 解析 (使用 scraper) |
| `src-tauri/src/commands/world.rs` | 世界命令 (1个) + WorldInfo + LogFileInfo |
| `src-tauri/src/commands/optimization.rs` | 优化命令 (2个) + OptimizationPreset + PresetMod + ApplyPresetResult |
| `src-tauri/src/commands/achievement.rs` | 成就命令 (2个) + AchievementInfo |
| `src-tauri/src/commands/search.rs` | 搜索/市场命令 (5个) + NLPSearchResult |
| `src-tauri/src/commands/misc.rs` | 其余散落命令 + Recommendation + MigrationStatus + ScreenshotInfo + DownloadScheduleConfig + GcRecommendation + AnomalyReport + LaunchProfileStage + FrameTimeData + PlaytimeStats + InstancePlaytime + AggProgressSnapshot + DownloadAggregateProgress |
| `src-tauri/src/nbt.rs` | NBT 解析器（Wave 1 先创建占位，Wave 2 完善） |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src-tauri/src/lib.rs` | 瘦身至 ~300行：只保留 imports + AppState + run() + 命令注册 |
| `src-tauri/Cargo.toml` | 新增 scraper, discord-rich-presence；移除 futures, opener, lazy_static；收窄 tokio features |
| `src/App.tsx` | 替换手写路由为 react-router-dom HashRouter |
| `src/styles/tokens.css` | 新增 --transition-fast/medium/slow 变量 |
| `src/components/ui/Skeleton.tsx` | 增强：赛博朋克 clip-path 切角 + 黄色 shimmer |
| `src/components/ui/Skeleton.module.css` | 新增切角骨架屏样式 |
| `src/api.ts` | 新增 Discord RPC / LAN / 电池 / 硬件相关 API 方法的类型更新 |

---

## Task 1: 创建 commands/ 模块骨架

**Files:**
- Create: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: 创建 commands 目录和 mod.rs**

```rust
pub mod auth;
pub mod config;
pub mod instance;
pub mod launch;
pub mod version;
pub mod modrinth;
pub mod curseforge;
pub mod content;
pub mod collections;
pub mod system;
pub mod server;
pub mod social;
pub mod network;
pub mod cli;
pub mod news;
pub mod world;
pub mod optimization;
pub mod achievement;
pub mod search;
pub mod misc;
```

- [ ] **Step 2: 创建所有命令模块的空文件**

Run: `cd /Users/xiatian/Desktop/BonNext && for f in auth config instance launch version modrinth curseforge content collections system server social network cli news world optimization achievement search misc; do touch src-tauri/src/commands/$f.rs; done`

- [ ] **Step 3: 在 lib.rs 顶部添加 mod commands 声明**

在 lib.rs 的 `mod` 声明区域（约第1-35行之间）添加：
```rust
mod commands;
```

- [ ] **Step 4: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: 编译通过（空模块不影响）

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/
git commit -m "refactor: create commands/ module skeleton for lib.rs split"
```

---

## Task 2: 迁移 auth 命令

**Files:**
- Create: `src-tauri/src/commands/auth.rs`
- Modify: `src-tauri/src/lib.rs` (删除 L103-180 的 auth 命令)

- [ ] **Step 1: 将 auth 命令从 lib.rs 复制到 commands/auth.rs**

从 lib.rs L103-180 提取以下命令到 `commands/auth.rs`：
- `offline_login` (L103-123)
- `start_microsoft_auth` (L125-129)
- `poll_microsoft_auth` (L131-151)
- `list_accounts` (L153-157)
- `get_active_account` (L159-163)
- `set_active_account` (L165-169)
- `remove_account` (L171-175)
- `refresh_auth_token` (L177-180)

在 `commands/auth.rs` 顶部添加必要的 imports：
```rust
use crate::auth::{self, token_store};
use crate::error::LauncherError;
use tauri::State;
use crate::AppState;
```

将所有 `pub async fn` 保持为 `pub async fn`（不需要 pub(crate)，因为 lib.rs 的 invoke_handler 需要引用它们）。

- [ ] **Step 2: 从 lib.rs 删除已迁移的 auth 命令**

删除 lib.rs 中 L103-180 的所有 auth 命令代码。

- [ ] **Step 3: 在 lib.rs 的 run() 函数中更新 invoke_handler**

将 invoke_handler 中的 auth 命令路径从 `offline_login` 改为 `commands::auth::offline_login`，依此类推。

- [ ] **Step 4: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: 编译通过

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/auth.rs src-tauri/src/lib.rs
git commit -m "refactor: extract auth commands to commands/auth.rs"
```

---

## Task 3: 迁移 config 命令

**Files:**
- Create: `src-tauri/src/commands/config.rs`
- Modify: `src-tauri/src/lib.rs` (删除 L59-67)

- [ ] **Step 1: 将 config 命令提取到 commands/config.rs**

从 lib.rs L59-67 提取：
- `get_config` (L59-62)
- `save_config` (L64-67)

imports:
```rust
use crate::config;
use tauri::State;
use crate::AppState;
```

- [ ] **Step 2: 从 lib.rs 删除已迁移代码，更新 invoke_handler**

- [ ] **Step 3: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/config.rs src-tauri/src/lib.rs
git commit -m "refactor: extract config commands to commands/config.rs"
```

---

## Task 4: 迁移 launch + version + download 命令

**Files:**
- Create: `src-tauri/src/commands/launch.rs`
- Create: `src-tauri/src/commands/version.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 将 launch 相关命令提取到 commands/launch.rs**

从 lib.rs 提取：
- `get_launch_state` (L46-50)
- `reset_launch_state` (L52-57)
- `download_version` (L182-189)
- `launch_game` (L191-239)
- `launch_game_inner` (L241-331)
- `download_version_inner` (L333-443)
- `extract_natives_async_for_version` (L445-465)
- `extract_natives` (L467-510)

imports:
```rust
use crate::launch::{self, state::LaunchState, args, process};
use crate::download;
use crate::version;
use crate::instance;
use crate::platform::{java, paths};
use crate::error::LauncherError;
use crate::AppState;
use tauri::State;
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::AppHandle;
```

- [ ] **Step 2: 将 version 命令提取到 commands/version.rs**

从 lib.rs L41-44 提取：
- `get_versions`

imports:
```rust
use crate::version::manifest;
use crate::error::LauncherError;
```

- [ ] **Step 3: 从 lib.rs 删除已迁移代码，更新 invoke_handler**

- [ ] **Step 4: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/launch.rs src-tauri/src/commands/version.rs src-tauri/src/lib.rs
git commit -m "refactor: extract launch and version commands"
```

---

## Task 5: 迁移 instance 命令

**Files:**
- Create: `src-tauri/src/commands/instance.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 将 instance 命令提取到 commands/instance.rs**

从 lib.rs 提取（行号为迁移前的大致位置，实际以代码内容为准）：
- `list_instances`, `create_instance`, `delete_instance`, `update_instance`, `get_instance`, `duplicate_instance`, `export_instance`
- `import_modpack`, `detect_modpack_format`, `import_modpack_auto`, `export_mrpack`
- `parse_crash_report`, `diagnose_crash`, `check_instance_ready`
- `SnapshotInfo` struct (L2066-2072)
- `copy_dir_recursive` (L2166-2179)
- `dir_size` (L2181-2194)
- `get_game_dir` (L512-515), `get_default_game_dir` (L517-520)
- `open_folder` (L592-610)
- `get_loader_versions` (L612-630), `install_loader` (L632-648)

imports:
```rust
use crate::instance;
use crate::loader;
use crate::crash_parser;
use crate::download;
use crate::platform::paths;
use crate::error::LauncherError;
use crate::AppState;
use tauri::State;
use serde::{Deserialize, Serialize};
```

- [ ] **Step 2: 从 lib.rs 删除已迁移代码，更新 invoke_handler**

- [ ] **Step 3: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/instance.rs src-tauri/src/lib.rs
git commit -m "refactor: extract instance commands"
```

---

## Task 6: 迁移 Modrinth + CurseForge 命令

**Files:**
- Create: `src-tauri/src/commands/modrinth.rs`
- Create: `src-tauri/src/commands/curseforge.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 将 Modrinth 命令提取到 commands/modrinth.rs**

从 lib.rs 提取：
- `search_mods`, `get_popular_mods`, `get_mod_details`, `get_mod_versions`, `install_mod`, `get_version_by_id`, `install_content`

imports:
```rust
use crate::modrinth;
use crate::cache;
use crate::content;
use crate::error::LauncherError;
use crate::AppState;
use tauri::State;
```

- [ ] **Step 2: 将 CurseForge 命令提取到 commands/curseforge.rs**

从 lib.rs 提取：
- `search_cf_mods`, `get_cf_mod`, `get_cf_project_details`, `get_cf_mod_versions`, `get_cf_featured`, `get_cf_mod_files`, `download_cf_mod`

imports:
```rust
use crate::curseforge;
use crate::cache;
use crate::error::LauncherError;
use crate::AppState;
use tauri::State;
```

- [ ] **Step 3: 从 lib.rs 删除已迁移代码，更新 invoke_handler**

- [ ] **Step 4: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/modrinth.rs src-tauri/src/commands/curseforge.rs src-tauri/src/lib.rs
git commit -m "refactor: extract modrinth and curseforge commands"
```

---

## Task 7: 迁移 content + optimization + search 命令

**Files:**
- Create: `src-tauri/src/commands/content.rs`
- Create: `src-tauri/src/commands/optimization.rs`
- Create: `src-tauri/src/commands/search.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 将 content 命令提取到 commands/content.rs**

从 lib.rs 提取：
- `InstalledModInfo`, `ContentCounts`, `BulkUpdateResult` structs
- `count_files_in_dir`, `compute_dir_size_mb`, `compute_dir_size_bytes` helpers
- `list_instance_mods`, `list_instance_resourcepacks`, `list_instance_shaders`, `remove_installed_mod`
- `check_content_updates`, `bulk_update_content`, `get_content_counts`

imports:
```rust
use crate::content;
use crate::error::LauncherError;
use crate::AppState;
use tauri::State;
use serde::{Deserialize, Serialize};
use std::path::Path;
```

- [ ] **Step 2: 将 optimization 命令提取到 commands/optimization.rs**

从 lib.rs 提取：
- `OptimizationPreset`, `PresetMod`, `ApplyPresetResult` structs
- `get_optimization_presets` helper
- `get_optimization_presets_cmd`, `apply_optimization_preset` commands

- [ ] **Step 3: 将 search/marketplace 命令提取到 commands/search.rs**

从 lib.rs 提取：
- `search_content`, `get_project_details`, `get_trending_content`, `get_recently_updated`

- [ ] **Step 4: 从 lib.rs 删除已迁移代码，更新 invoke_handler**

- [ ] **Step 5: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/content.rs src-tauri/src/commands/optimization.rs src-tauri/src/commands/search.rs src-tauri/src/lib.rs
git commit -m "refactor: extract content, optimization, and search commands"
```

---

## Task 8: 迁移 collections + news + world 命令

**Files:**
- Create: `src-tauri/src/commands/collections.rs`
- Create: `src-tauri/src/commands/news.rs`
- Create: `src-tauri/src/commands/world.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 将 collections 命令提取到 commands/collections.rs**

从 lib.rs 提取：
- `add_to_collection`, `remove_from_collection`, `is_in_collection`, `list_collection`

imports:
```rust
use crate::collections;
use crate::error::LauncherError;
use tauri::State;
use crate::AppState;
```

- [ ] **Step 2: 将 news 命令提取到 commands/news.rs**

从 lib.rs 提取：
- `MinecraftNewsEntry`, `NewsApiResponse`, `NewsApiEntry`, `NewsApiImage` structs
- `ArticleImage`, `ArticleSection`, `MinecraftArticle` structs
- `get_minecraft_news` command
- `get_minecraft_article` command
- 暂时保留手写 HTML 解析函数（`strip_html_tags` 等），Task 14 会用 scraper 替换

imports:
```rust
use crate::http_client;
use crate::error::LauncherError;
use crate::cache;
use tauri::State;
use crate::AppState;
use serde::{Deserialize, Serialize};
use reqwest::Client;
```

- [ ] **Step 3: 将 world 命令提取到 commands/world.rs**

从 lib.rs 提取：
- `WorldInfo` struct
- `LogFileInfo` struct
- `list_instance_saves`, `list_instance_logs`, `read_log_file`
- `parse_level_dat_basic` (stub)

- [ ] **Step 4: 从 lib.rs 删除已迁移代码，更新 invoke_handler**

- [ ] **Step 5: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/collections.rs src-tauri/src/commands/news.rs src-tauri/src/commands/world.rs src-tauri/src/lib.rs
git commit -m "refactor: extract collections, news, and world commands"
```

---

## Task 9: 迁移 system + server + social + network + cli + achievement + misc 命令

**Files:**
- Create: `src-tauri/src/commands/system.rs`
- Create: `src-tauri/src/commands/server.rs`
- Create: `src-tauri/src/commands/social.rs`
- Create: `src-tauri/src/commands/network.rs`
- Create: `src-tauri/src/commands/cli.rs`
- Create: `src-tauri/src/commands/achievement.rs`
- Create: `src-tauri/src/commands/misc.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 将 system 命令提取到 commands/system.rs**

从 lib.rs 提取：
- `HardwareProfile`, `DiskUsageInfo`, `DiskBreakdownItem`, `InstalledVersionInfo` structs
- `get_hardware_profile`, `get_disk_usage`, `list_installed_versions`, `delete_version_cmd`, `get_dir_size_cmd`
- `get_system_info`, `auto_tune_memory_cmd`, `smart_tune_memory_cmd`
- `auto_tune_memory`, `smart_tune_memory` helpers
- `quick_start`, `select_fastest_mirror`

- [ ] **Step 2: 将 server 命令提取到 commands/server.rs**

从 lib.rs 提取：
- `ServerStatusInfo` struct
- `write_varint`, `read_varint`, `write_string`, `read_string` SLP helpers
- `ping_server` command

- [ ] **Step 3: 将 social 命令提取到 commands/social.rs**

从 lib.rs 提取：
- `FriendEntry` struct
- `list_friends`, `add_friend`, `remove_friend`
- `start_discord_rpc`, `stop_discord_rpc`, `update_discord_presence` (当前占位实现)

- [ ] **Step 4: 将 network 命令提取到 commands/network.rs**

从 lib.rs 提取：
- `LanWorldInfo`, `P2PPeer`, `WebApiStatus` structs
- `LAN_DISCOVERY_ACTIVE` static
- `start_lan_discovery`, `stop_lan_discovery`, `get_lan_worlds`
- `scan_p2p_peers`, `send_file_p2p`
- `get_web_api_status`

- [ ] **Step 5: 将 cli 命令提取到 commands/cli.rs**

从 lib.rs 提取：
- `BatteryStatus` struct
- `get_battery_status`
- `cli_launch`

- [ ] **Step 6: 将 achievement 命令提取到 commands/achievement.rs**

从 lib.rs 提取：
- `AchievementInfo` struct
- `get_achievements`, `unlock_achievement`

- [ ] **Step 7: 将其余散落命令提取到 commands/misc.rs**

从 lib.rs 提取所有剩余命令和 struct：
- `Recommendation`, `MigrationStatus`, `ScreenshotInfo`, `DownloadScheduleConfig`, `GcRecommendation`, `AnomalyReport`, `LaunchProfileStage`, `FrameTimeData`, `PlaytimeStats`, `InstancePlaytime`, `AggProgressSnapshot`, `DownloadAggregateProgress`, `NLPSearchResult` structs
- `get_recommendations`, `check_migration_readiness`, `warmup_launch`, `create_guest_instance`, `list_screenshots`, `set_instance_icon`, `get/set_download_schedule_config`, `get_gc_recommendations`, `detect_anomalies`, `get_launch_profiling_data`, `get_frame_time_data`, `nlp_search_content`, `get_playtime_stats`, `record_playtime`, `get_instance_cover_image`, `get_last_played_instance`, `export_instance_config`, `import_instance_config`
- `compute_agg_speed_eta` helper

- [ ] **Step 8: 从 lib.rs 删除所有已迁移代码**

此时 lib.rs 应该只剩：
- imports/use 语句
- `AppState` struct (L37-39)
- `pub fn run()` 函数 (原 L3441-3525)

- [ ] **Step 9: 更新 invoke_handler 中所有命令路径**

将所有命令引用改为 `commands::module::command_name` 格式。

- [ ] **Step 10: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 11: 运行测试**

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20`

Expected: 所有现有测试通过

- [ ] **Step 12: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "refactor: complete lib.rs split into commands/ modules

lib.rs reduced from 3525 lines to ~300 lines.
All 50+ Tauri commands organized into 20 domain-specific modules."
```

---

## Task 10: 依赖清理

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 移除重叠依赖**

在 Cargo.toml 中：
- 移除 `futures`（保留 `futures-util`）
- 移除 `opener`（保留 `webbrowser`）
- 移除 `lazy_static`，在代码中替换为 `std::sync::OnceLock`

搜索代码中所有 `lazy_static!` 使用并替换：
```rust
// 之前
lazy_static! {
    static ref SOMETHING: Type = value;
}

// 之后
static SOMETHING: std::sync::OnceLock<Type> = std::sync::OnceLock::new();
// 在首次使用时初始化：SOMETHING.get_or_init(|| value)
```

- [ ] **Step 2: 收窄 tokio features**

将 `tokio = { version = "1", features = ["full"] }` 改为：
```toml
tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "io-util", "process", "sync"] }
```

- [ ] **Step 3: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

如果编译失败，根据错误信息补充缺失的 tokio feature。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/
git commit -m "chore: remove overlapping deps, narrow tokio features, replace lazy_static with OnceLock"
```

---

## Task 11: 新增 scraper 依赖 + 替换手写 HTML 解析

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/commands/news.rs`

- [ ] **Step 1: 在 Cargo.toml 添加 scraper**

```toml
scraper = "0.22"
```

- [ ] **Step 2: 重写 news.rs 中的 HTML 解析函数**

替换 `strip_html_tags`, `extract_tag_content`, `extract_all_tag_contents`, `extract_img_src`, `extract_all_images`, `normalize_img_url` 为基于 scraper 的实现：

```rust
use scraper::{Html, Selector};

fn extract_text_from_html(html: &str) -> String {
    let document = Html::parse_document(html);
    let selector = Selector::new("body").unwrap_or_else(|_| {
        Selector::new("*").unwrap()
    });
    document.select(&selector)
        .next()
        .map(|el| el.text().collect::<Vec<_>>().join(""))
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn extract_images_from_html(html: &str, base_url: &str) -> Vec<ArticleImage> {
    let document = Html::parse_document(html);
    let img_selector = Selector::new("img").unwrap();
    document.select(&img_selector)
        .filter_map(|img| {
            let src = img.value().attr("src")?;
            let alt = img.value().attr("alt").unwrap_or("").to_string();
            let url = normalize_url(src, base_url);
            Some(ArticleImage { url, alt, caption: None })
        })
        .collect()
}

fn extract_sections_from_html(html: &str) -> Vec<ArticleSection> {
    let document = Html::parse_document(html);
    let heading_selector = Selector::new("h1, h2, h3, h4, h5, h6").unwrap();
    let mut sections = Vec::new();
    for heading in document.select(&heading_selector) {
        let title = heading.text().collect::<Vec<_>>().join("").trim().to_string();
        if !title.is_empty() {
            sections.push(ArticleSection {
                title,
                content: String::new(),
                images: Vec::new(),
            });
        }
    }
    if sections.is_empty() {
        let text = extract_text_from_html(html);
        if !text.is_empty() {
            sections.push(ArticleSection {
                title: String::new(),
                content: text,
                images: extract_images_from_html(html, ""),
            });
        }
    }
    sections
}

fn normalize_url(src: &str, base_url: &str) -> String {
    if src.starts_with("http://") || src.starts_with("https://") {
        src.to_string()
    } else if src.starts_with("//") {
        format!("https:{}", src)
    } else if !base_url.is_empty() {
        format!("{}/{}", base_url.trim_end_matches('/'), src.trim_start_matches('/'))
    } else {
        src.to_string()
    }
}
```

- [ ] **Step 3: 更新 get_minecraft_article 使用新解析函数**

- [ ] **Step 4: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/commands/news.rs
git commit -m "feat: replace hand-written HTML parser with scraper crate"
```

---

## Task 12: 实现 Discord Rich Presence

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/commands/social.rs`
- Modify: `src/api.ts` (类型更新)

- [ ] **Step 1: 在 Cargo.toml 添加 discord-rich-presence**

```toml
discord-rich-presence = "0.2"
```

注意：使用 `discord-rich-presence` crate（vionya/discord-rich-presence），支持三平台。

- [ ] **Step 2: 重写 commands/social.rs 中的 Discord RPC 命令**

```rust
use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity};
use std::sync::Mutex as StdMutex;

static DISCORD_CLIENT: std::sync::OnceLock<StdMutex<Option<DiscordIpcClient>>> = std::sync::OnceLock::new();

const DISCORD_APP_ID: &str = "1307866369206550619";

#[tauri::command]
pub async fn start_discord_rpc() -> Result<String, String> {
    let client = DiscordIpcClient::new(DISCORD_APP_ID);
    match client.connect() {
        Ok(_) => {
            let _ = DISCORD_CLIENT.get_or_init(|| StdMutex::new(Some(client)));
            tracing::info!("Discord RPC connected");
            Ok("Discord RPC started".to_string())
        }
        Err(e) => {
            tracing::warn!("Discord RPC connection failed: {}", e);
            Err(format!("Failed to connect to Discord: {}", e))
        }
    }
}

#[tauri::command]
pub async fn stop_discord_rpc() -> Result<String, String> {
    if let Some(client_lock) = DISCORD_CLIENT.get() {
        let mut guard = client_lock.lock().unwrap();
        if let Some(ref mut client) = *guard {
            let _ = client.close();
            *guard = None;
        }
    }
    Ok("Discord RPC stopped".to_string())
}

#[tauri::command]
pub async fn update_discord_presence(details: String, state: String) -> Result<String, String> {
    if let Some(client_lock) = DISCORD_CLIENT.get() {
        let mut guard = client_lock.lock().unwrap();
        if let Some(ref mut client) = *guard {
            match client.set_activity(activity::Activity::new()
                .details(&details)
                .state(&state)
                .assets(activity::Assets::new()
                    .large_image("bonnext-logo")
                    .large_text("BonNext Launcher"))
            ) {
                Ok(_) => Ok("Presence updated".to_string()),
                Err(e) => Err(format!("Failed to update presence: {}", e)),
            }
        } else {
            Err("Discord RPC not connected".to_string())
        }
    } else {
        Err("Discord RPC not started".to_string())
    }
}
```

- [ ] **Step 3: 在启动流程中集成 Discord RPC 状态更新**

在 `commands/launch.rs` 的 `launch_game` 命令中，游戏启动成功后调用 Discord RPC 更新状态。

- [ ] **Step 4: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/commands/social.rs src-tauri/src/commands/launch.rs
git commit -m "feat: implement Discord Rich Presence with discord-rich-presence crate"
```

---

## Task 13: 实现 LAN 世界发现

**Files:**
- Modify: `src-tauri/src/commands/network.rs`

- [ ] **Step 1: 实现 MC LAN 广播监听**

在 `commands/network.rs` 中替换占位实现：

```rust
use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

static LAN_DISCOVERY_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanWorldInfo {
    pub host: String,
    pub port: u16,
    pub motd: String,
    pub world_type: Option<String>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
}

#[tauri::command]
pub async fn start_lan_discovery() -> Result<String, String> {
    if LAN_DISCOVERY_ACTIVE.load(Ordering::SeqCst) {
        return Ok("LAN discovery already running".to_string());
    }
    LAN_DISCOVERY_ACTIVE.store(true, Ordering::SeqCst);
    tracing::info!("LAN discovery started");
    Ok("LAN discovery started".to_string())
}

#[tauri::command]
pub async fn stop_lan_discovery() -> Result<String, String> {
    LAN_DISCOVERY_ACTIVE.store(false, Ordering::SeqCst);
    tracing::info!("LAN discovery stopped");
    Ok("LAN discovery stopped".to_string())
}

#[tauri::command]
pub async fn get_lan_worlds() -> Result<Vec<LanWorldInfo>, String> {
    if !LAN_DISCOVERY_ACTIVE.load(Ordering::SeqCst) {
        return Ok(Vec::new());
    }

    let socket = UdpSocket::bind("0.0.0.0:4445")
        .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
    socket.set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|e| format!("Failed to set timeout: {}", e))?;
    socket.set_broadcast(true)
        .map_err(|e| format!("Failed to set broadcast: {}", e))?;

    let mut worlds = Vec::new();
    let mut buf = [0u8; 4096];

    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(3) {
        match socket.recv_from(&mut buf) {
            Ok((len, addr)) => {
                let data = String::from_utf8_lossy(&buf[..len]);
                if let Some(world) = parse_lan_broadcast(&data, addr.ip().to_string()) {
                    if !worlds.iter().any(|w: &LanWorldInfo| w.host == world.host && w.port == world.port) {
                        worlds.push(world);
                    }
                }
            }
            Err(_) => break,
        }
    }

    Ok(worlds)
}

fn parse_lan_broadcast(data: &str, host: String) -> Option<LanWorldInfo> {
    let parts: Vec<&str> = data.split('§').collect();
    if parts.len() >= 2 {
        let motd = parts[0].trim().to_string();
        let port: u16 = parts[1].trim().parse().ok()?;
        let world_type = parts.get(2).map(|s| s.trim().to_string());
        Some(LanWorldInfo {
            host,
            port,
            motd,
            world_type,
            players_online: None,
            players_max: None,
        })
    } else {
        None
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/network.rs
git commit -m "feat: implement LAN world discovery via MC broadcast protocol"
```

---

## Task 14: 修复 GPU 检测 + 实现电池管理

**Files:**
- Modify: `src-tauri/src/commands/system.rs`
- Modify: `src-tauri/src/commands/cli.rs`

- [ ] **Step 1: 修复 get_hardware_profile 中的 GPU 检测**

在 `commands/system.rs` 中，替换 `gpu_name: "Unknown".to_string()` 为真实检测：

```rust
use sysinfo::System;

pub async fn get_hardware_profile() -> Result<HardwareProfile, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_name = sys.cpus().first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let cpu_count = sys.cpus().len() as u32;

    let total_ram_mb = sys.total_memory() / 1024 / 1024;

    let gpu_name = sys.components()
        .iter()
        .find(|c| c.label().to_lowercase().contains("gpu")
            || c.label().to_lowercase().contains("graphics")
            || c.label().to_lowercase().contains("nvidia")
            || c.label().to_lowercase().contains("amd")
            || c.label().to_lowercase().contains("radeon")
            || c.label().to_lowercase().contains("intel")
        )
        .map(|c| c.label().to_string())
        .unwrap_or_else(|| "Unknown GPU".to_string());

    let total_ram_gb = total_ram_mb as f64 / 1024.0;
    let performance_score = calculate_performance_score(cpu_count, total_ram_gb);
    let performance_level = match performance_score {
        s if s >= 80.0 => "high",
        s if s >= 50.0 => "medium",
        _ => "low",
    }.to_string();

    Ok(HardwareProfile {
        cpu_name,
        cpu_count,
        total_ram_mb,
        gpu_name,
        performance_score,
        performance_level,
    })
}
```

- [ ] **Step 2: 实现电池管理**

在 `commands/cli.rs` 中替换 `get_battery_status` 的硬编码返回值：

```rust
#[tauri::command]
pub async fn get_battery_status() -> Result<BatteryStatus, String> {
    use sysinfo::System;

    let mut sys = System::new_all();
    sys.refresh_all();

    let batteries = sys.batteries();
    if let Some(battery) = batteries.first() {
        Ok(BatteryStatus {
            on_battery: !battery.is_charging(),
            percentage: battery.charge() as f64,
            charging: battery.is_charging(),
        })
    } else {
        Ok(BatteryStatus {
            on_battery: false,
            percentage: 100.0,
            charging: true,
        })
    }
}
```

注意：`sysinfo` 0.33 的电池 API 可能有差异，需要查看实际 API。如果 `batteries()` 方法不存在，使用以下备选方案：

```rust
// 备选：通过 sysinfo::Components 查找电池组件
let battery_component = sys.components()
    .iter()
    .find(|c| c.label().to_lowercase().contains("bat"));
```

- [ ] **Step 3: 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/system.rs src-tauri/src/commands/cli.rs
git commit -m "feat: implement real GPU detection and battery status via sysinfo"
```

---

## Task 15: 前端路由迁移到 react-router-dom

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 重写 App.tsx 使用 react-router-dom**

替换手写路由逻辑为 HashRouter：

```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

// 在 App 组件内部，替换条件渲染为：
<HashRouter>
  <Providers>
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage navigate={navigate} page={page} />} />
        <Route path="/store" element={<StorePage navigate={navigate} page={page} />} />
        <Route path="/store/:type/:slug" element={<ContentDetailPage navigate={navigate} page={page} />} />
        <Route path="/instances" element={<InstancesPage navigate={navigate} page={page} />} />
        <Route path="/instances/new" element={<NewInstancePage navigate={navigate} page={page} />} />
        <Route path="/instances/:id" element={<InstanceDetailPage navigate={navigate} page={page} />} />
        <Route path="/mods" element={<ModsPage navigate={navigate} page={page} />} />
        <Route path="/collections" element={<CollectionsPage navigate={navigate} page={page} />} />
        <Route path="/library" element={<LibraryPage navigate={navigate} page={page} />} />
        <Route path="/versions" element={<VersionsPage navigate={navigate} page={page} />} />
        <Route path="/settings" element={<SettingsPage navigate={navigate} page={page} />} />
      </Routes>
    </AppShell>
  </Providers>
</HashRouter>
```

关键变更：
- 移除 `getPageFromHash()` 函数
- 移除 `hashchange` 事件监听
- 移除 `page` state 和 `setPage`
- 保留 `navigate` 函数但改用 `useNavigate()` hook
- 页面组件中需要路由参数的使用 `useParams()`
- 侧边栏导航使用 `<Link>` 或 `useNavigate()`

- [ ] **Step 2: 更新页面组件中的路由参数获取**

在 `ContentDetailPage` 和 `InstanceDetailPage` 中：
```tsx
import { useParams } from 'react-router-dom';

// 替换从 props 获取 ID
const { type, slug } = useParams<{ type: string; slug: string }>();
const { id } = useParams<{ id: string }>();
```

- [ ] **Step 3: 更新侧边栏导航**

在 Sidebar 组件中使用 `useLocation()` 判断当前活跃项，使用 `useNavigate()` 进行导航。

- [ ] **Step 4: 验证前端编译**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -15`

Expected: 无类型错误

- [ ] **Step 5: 验证应用运行**

Run: `pnpm tauri dev`（手动验证路由切换正常）

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/ src/components/layout/
git commit -m "refactor: migrate from hand-written hash routing to react-router-dom"
```

---

## Task 16: 微交互框架 — CSS 变量 + 交互反馈

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/ux-delight.css`

- [ ] **Step 1: 在 tokens.css 中新增过渡变量**

在现有过渡变量区域（L55-60）后添加：

```css
--transition-fast: 150ms ease;
--transition-medium: 250ms ease-out;
--transition-slow: 400ms ease-out;
```

注意：保留现有的 `--transition-fast/normal/slow`，新增的 `medium` 填补 150ms-300ms 之间的空白。

- [ ] **Step 2: 在 ux-delight.css 中增强交互反馈**

添加全局交互反馈规则：

```css
button:active:not(:disabled),
[role="button"]:active:not(:disabled) {
  transform: scale(0.97);
  transition: transform 80ms ease;
}

button:focus-visible,
[role="button"]:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

[data-hover-glow]:hover {
  box-shadow: 0 0 20px var(--color-accent-15),
              0 0 40px var(--color-accent-06);
  transition: box-shadow var(--transition-medium);
}
```

- [ ] **Step 3: 验证前端编译**

Run: `npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/styles/ux-delight.css
git commit -m "feat: add micro-interaction CSS variables and global interaction feedback"
```

---

## Task 17: 统一加载态 — 增强 Skeleton 组件

**Files:**
- Modify: `src/components/ui/Skeleton.tsx`
- Modify: `src/components/ui/Skeleton.module.css`
- Create: `src/hooks/useLoading.ts`

- [ ] **Step 1: 增强 Skeleton 组件的赛博朋克风格**

在 `Skeleton.module.css` 中替换现有样式：

```css
.skeleton {
  background: var(--color-panel-alt);
  clip-path: var(--clip-small);
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-accent-06) 40%,
    var(--color-accent-15) 50%,
    var(--color-accent-06) 60%,
    transparent 100%
  );
  animation: skeletonShimmer 1.5s ease-in-out infinite;
}

@keyframes skeletonShimmer {
  0% { transform: translateX(-200%); }
  100% { transform: translateX(200%); }
}
```

关键变更：shimmer 颜色从灰色渐变改为黄色（`--color-accent`）渐变，增加 clip-path 切角。

- [ ] **Step 2: 创建 useLoading hook**

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';

interface UseLoadingOptions {
  timeout?: number;
  onError?: (error: Error) => void;
}

interface UseLoadingReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useLoading<T = unknown>(options: UseLoadingOptions = {}): UseLoadingReturn<T> {
  const { timeout = 30000, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError(new Error('Request timed out'));
    }, timeout);

    try {
      const result = await fn();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setData(result);
      setLoading(false);
      return result;
    } catch (e) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setLoading(false);
      onError?.(err);
      return null;
    }
  }, [timeout, onError]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { data, loading, error, execute, reset };
}
```

- [ ] **Step 3: 验证前端编译**

Run: `npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Skeleton.tsx src/components/ui/Skeleton.module.css src/hooks/useLoading.ts
git commit -m "feat: enhance Skeleton with cyberpunk style, add useLoading hook"
```

---

## Task 18: 最终验证 + 全量测试

**Files:** 无新文件

- [ ] **Step 1: Rust 编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: Finished，无 error

- [ ] **Step 2: Rust 测试**

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20`

Expected: 所有测试通过

- [ ] **Step 3: 前端类型检查**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: 无错误

- [ ] **Step 4: 前端构建**

Run: `pnpm build 2>&1 | tail -10`

Expected: 构建成功

- [ ] **Step 5: 全量检查命令**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`

- [ ] **Step 6: 手动功能验证**

Run: `pnpm tauri dev`

验证清单：
- [ ] 应用正常启动
- [ ] 侧边栏导航正常切换
- [ ] 路由参数正常传递（实例详情、内容详情）
- [ ] Discord RPC 可连接/断开
- [ ] LAN 发现可启动/停止
- [ ] 硬件信息显示真实 GPU 名称
- [ ] 电池状态显示真实数据
- [ ] 骨架屏显示黄色 shimmer
- [ ] 按钮点击有缩放反馈

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: Wave 1 complete — architecture split, route migration, real implementations, micro-interactions"
```

---

## 自审检查清单

- [x] Spec 覆盖：Wave 1 所有架构/功能/视觉目标均有对应 Task
- [x] 占位符扫描：无 TBD/TODO/待定
- [x] 类型一致性：所有 struct 定义在迁移时保持原有字段名和类型
- [x] 依赖验证：discord-rich-presence 支持三平台，scraper 为成熟 crate
- [x] 编译安全：每个 Task 都有验证编译步骤
