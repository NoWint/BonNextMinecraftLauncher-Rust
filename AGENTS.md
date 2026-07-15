# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Frontend
pnpm dev              # Vite dev server (port 1420, HMR on 1421)
pnpm build            # tsc --noEmit + vite build

# Full Tauri app
pnpm tauri dev        # Run desktop app in dev mode
pnpm tauri build      # Production build

# Rust (run from src-tauri/)
cargo check                         # Fast compile check
cargo test                          # Run tests
cargo build --manifest-path src-tauri/Cargo.toml
```

Full check (both sides): `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`

## Architecture

BonNext is a **Tauri v2 desktop app** — a cross-platform Minecraft Java Edition launcher with a ZZZ-inspired Neo-Tokyo cyberpunk aesthetic. Rust backend, React 18 + TypeScript frontend.

### Backend (Rust — `src-tauri/src/`)

The binary entry is `main.rs` → calls `lib.rs::run()` which registers all Tauri commands (~165 across ~32 `commands/*.rs` submodules) and starts Tauri.

**`lib.rs`** — Registers commands & managed state, runs startup migrations. Command handlers themselves live in `commands/` submodules (auth, instance, launch, misc, network, cache, etc.). Managed state includes `AppState { launch_state, running_games }` plus 7+ independent `tauri::State` handles (`DownloadControlState`, `ApiCache`, `PersistentCacheState`, `CrashWatcherState`, `ScanCache`, `ModCacheDb`, `SessionStore`, `TrustedKeyStore`, `ModWatcherState`).

**Core launcher modules** (original, don't touch lightly):

- `auth/` — Microsoft OAuth 2.0 device flow + offline mode. Token store with auto-refresh.
- `config.rs` — JSON config at `config_dir/config.json`. Defaults: 2GB max / 512MB min memory, 8 concurrent downloads.
- `download/` — Parallel download queue with retry, SHA1 verification, mirror failover (Official → BMCLAPI → MCBBS).
- `version/` — Mojang manifest fetching, JSON parsing with parent inheritance, OS/feature rule evaluation.
- `launch/` — State machine (idle→checking→downloading→validating→launching→running/crashed/exited). JVM arg builder, process spawner.
- `loader/` — Fabric + Forge installation via meta.fabricmc.net / maven.minecraftforge.net.
- `instance/` — Per-instance config with isolated `.minecraft` dirs. Shared libraries/assets via hard links.
- `platform/` — Java detection, structured logging (tracing-subscriber), cross-platform path management.
- `error.rs` — Unified `LauncherError` enum (thiserror). HTTP, IO, JSON, ZIP, SHA1 mismatch, and domain errors.
- `http_client.rs` — reqwest factory. Sets `User-Agent: BonNext/1.0 (MinecraftLauncher)` header.

**Content platform modules** (marketplace, collections, updates):

- `modrinth.rs` — Modrinth API v2: search, popular, project details, versions, file download. Types: `ModResult`, `ModProjectFull`, `ModVersion`, `ModFile`.
- `curseforge.rs` — CurseForge API v1: search, featured, mod files, download. Maps CF responses to shared `ModResult`/`ModFile` types. Uses a default community API key.
- `cache.rs` — In-memory TTL cache (5 min default) for Modrinth/CF API responses. Separate maps for searches, projects, popular items.
- `content.rs` — Per-instance install metadata (`installed_content.json`). Tracks slug, version_id, content_type for update checking.
- `collections.rs` — User wishlist/saved items (`collections.json`). CRUD operations for saving content across sessions.

### Frontend (React — `src/`)

**`shared/api/`** — Typed wrappers around `invoke()` for every Tauri command (200+ methods, aggregated in `index.ts` from per-domain modules: versions, auth, instances, modrinth, curseforge, collections, library, marketplace, updates, world, servers, plugins, etc.). Also provides `onDownloadProgress()` / `onContentDownloadProgress()` for real-time download events. `cache.ts` provides inflight dedupe + `twoLayerCachedInvoke` for TTL caching.

**State management** — React Context + `useReducer` pattern in `src/shared/stores/`:

- `authStore.tsx` — logged-in user, account list, login/logout/switchAccount (Microsoft / offline / yggdrasil)
- `configStore.tsx` — app settings with save/reload
- `instanceStore.tsx` — instance CRUD with cross-store cache invalidation
- `toastStore.tsx` — toast notification queue (auto-dismiss, max 5)
- `themeStore.tsx` — dark/light/OLED theme, persisted to localStorage
- `downloadStore.tsx` — download task queue for the Steam-style download panel

**Routing** — `react-router-dom` `HashRouter` (see `src/app/components/AppRoutes.tsx`). Core pages are lazy-loaded except `HomePage`/`LoginPage` (首屏必需). Plugin-injected routes are added dynamically via `usePluginRoutes()`. Current routes:

| Path                 | Page               | Description                                                         |
| -------------------- | ------------------ | ------------------------------------------------------------------- |
| `/home`              | HomePage           | Dashboard with launch panel + news                                  |
| `/store/:type/:slug` | ContentDetailPage  | Content detail: desc, versions, gallery, deps (mod/modpack/shader)  |
| `/store`             | → redirect `/mods` | Legacy entry redirect                                               |
| `/instances`         | InstancesPage      | Instance list with search/filters                                   |
| `/instances/new`     | NewInstancePage    | Instance creation wizard                                            |
| `/instances/:id`     | InstanceDetailPage | Instance overview & management (mods/saves/logs/screenshots/...)    |
| `/mods`              | MarketplacePage    | Content browser: tabs, gallery/list, pagination, Modrinth/CF toggle |
| `/collections`       | → redirect `/mods` | Legacy entry redirect                                               |
| `/library`           | LibraryPage        | Per-instance installed content + update checking                    |
| `/versions`          | VersionsPage       | Version browser & downloader                                        |
| `/settings`          | SettingsPage       | Java, memory, game directory config                                 |
| `/servers`           | (plugin)           | Server list & ping (plugin-injected)                                |

**Shell architecture** — BonNext supports multiple UI shells via `src/shells/`:

- `zzz/` — Primary shell, ZZZ/Neo-Tokyo aesthetic (default)
- `swiftui/` — Alternative macOS-styled shell
- `editor/` — Editor-style shell (work in progress)
- Shells are swappable at runtime; each has its own `AppShell`, pages, components, styles. Shared logic lives in `src/shared/` (stores, api, utils, i18n, components).

**Plugin system** — `src/plugins/` provides a sandboxed plugin runtime with PermissionValidator, semver, lifecycle hooks, extension points (sidebar/routes/i18n), and EventBus RPC. Plugins inject routes via `usePluginRoutes()` and sidebar items via `usePluginSidebarItems()`. Plugin errors are isolated by `PluginErrorBoundary`.

**Component hierarchy**: `App` → `AppProviders` (Theme, I18n, Auth, Config, Instance, Toast, Download, Plugin) → `ShellErrorBoundary` → active `Shell` (`ZZZAppShell` / `SwiftUIAppShell` / `EditorAppShell`) → Sidebar + `AppRoutes` (core + plugin routes) + DownloadPanel.

**Key UI components** (`components/ui/`):

- `ContentCard` — reusable card for any content type (list/gallery variants)
- `InstallButton` — full install flow with dependency resolution + queue integration
- `CollectionButton` — heart toggle for wishlist
- `DownloadPanel` — Steam-style floating download manager
- `InstanceSelect` — rich instance picker with version/loader badges
- Plus: Button, Modal, Tabs, Badge, Tooltip, Pagination, Select, SearchPalette, Skeleton, etc.

**Styling**: CSS Modules per component (`*.module.css`) + global `styles/` with `tokens.css` (design tokens, clip-paths, animations), `themes.css` (dark/light/OLED), `ux-delight.css` (page transitions, stagger, shimmer).

### Data Flow

```
User Action → React Component → api.ts invoke() → Tauri IPC → Rust Command
                                                                ↓
UI Update ← React State ← listen() event ← app.emit() ← Rust Background Task
```

Install flow: InstallButton fetches versions → resolves required deps in parallel → downloads each dependency + main item sequentially → each download tracked in downloadStore → DownloadPanel shows live progress.

### Configuration Persistence

Default game directory: `~/.local/share/bonnext/` (Linux), `~/Library/Application Support/bonnext/` (macOS), `%APPDATA%/bonnext/` (Windows). All state (config, accounts, instances, collections, install metadata) lives under this directory.

### Visual Design Constraints

- **ZZZ/Neo-Tokyo aesthetic** — dark theme, #FFE600 yellow accent, Bebas Neue headings, Inter body, DM Mono for data
- **Clip-path corners** — `--clip-primary/medium/small/badge/diamond` CSS variables for angled corner cuts
- **Overlays** — `.noise-overlay` (SVG noise) and `.scanline-overlay` (horizontal lines) for CRT effect
- **Sizes use `em`** — base is 16px set on `html`. Component font sizes typically 0.55em–0.9em range
- **All new UI must use CSS Modules** — no inline styles except for truly dynamic values
