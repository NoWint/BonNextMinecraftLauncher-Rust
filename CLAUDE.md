# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

The binary entry is `main.rs` → calls `lib.rs::run()` which registers ~100 Tauri commands and starts Tauri.

**`lib.rs`** — All `#[tauri::command]` handlers live here and in `commands/` submodules. Managed state includes `AppState { launch_state: Arc<Mutex<LaunchState>> }`, `ApiCache` (in-memory TTL cache for content API responses), and `TerracottaState` (Terracotta process management).

**Core launcher modules** (original, don't touch lightly):

- `auth/` — Microsoft OAuth 2.0 device flow + Yggdrasil external login + offline mode. Token store with auto-refresh. Client ID configurable via `BONNEXT_MS_CLIENT_ID` env var.
- `config.rs` — JSON config at `config_dir/config.json`. Defaults: 2GB max / 512MB min memory, 8 concurrent downloads. Proxy password encrypted via `security::crypto`.
- `download/` — Parallel download queue with retry, SHA1 verification, mirror failover (Official → BMCLAPI). Uses `tokio::fs` for async file operations.
- `version/` — Mojang manifest fetching, JSON parsing with parent inheritance, OS/feature rule evaluation.
- `launch/` — State machine (idle→checking→downloading→validating→launching→running/crashed/exited). Strict transition validation — `set_state()` returns `Err` on illegal transitions, `force_set_state()` for resets only. JVM arg builder, process spawner.
- `loader/` — Fabric + Forge installation via meta.fabricmc.net / maven.minecraftforge.net.
- `instance/` — Per-instance config with isolated `.minecraft` dirs. Shared libraries/assets via hard links. Modpack import/export (.mrpack, CF), launcher migration, snapshots, crash diagnosis.
- `platform/` — Java detection + auto-download, structured logging (tracing-subscriber), cross-platform path management.
- `error.rs` — Unified `LauncherError` enum (thiserror). 20+ variants including specific types for Terracotta, asset index, instance readiness. Structured JSON serialization: `{"type": "VariantName", "message": "..."}`.
- `http_client.rs` — reqwest factory. Dynamic `User-Agent: BonNext/{version} (MinecraftLauncher)`. Proxy-aware client builders integrated.

**Content platform modules** (marketplace, collections, updates):

- `modrinth.rs` — Modrinth API v2: search, popular, project details, versions, file download. Types: `ModResult`, `ModProjectFull`, `ModVersion`, `ModFile`.
- `curseforge.rs` — CurseForge API v1: search, featured, mod files, download. Maps CF responses to shared `ModResult`/`ModFile` types. Uses a default community API key.
- `cache.rs` — In-memory TTL cache for Modrinth/CF API responses. Separate maps for searches, projects, popular items. CF cache fully integrated.
- `content.rs` — Per-instance install metadata (`installed_content.json`). Tracks slug, version_id, content_type for update checking.
- `collections.rs` — User wishlist/saved items (`collections.json`). CRUD operations for saving content across sessions.

**Security modules** (`security/`):

- `crypto.rs` — AES-256-GCM encryption/decryption, HKDF key derivation. `encrypt_string()`/`decrypt_string()` helpers.
- `credential_store.rs` — Encrypted credential storage with plaintext→encrypted migration.
- `key_store.rs` — API key secure storage.
- `audit.rs` — Audit log recording and querying.
- `jvm_whitelist.rs` — JVM argument whitelist validation.
- `sanitizer.rs` — Input sanitization.
- `sandbox.rs` — Sandbox mode management.
- `file_permissions.rs` — File permission checking and fixing.

**Other modules**:

- `commands/` — IPC command layer (thin wrappers): auth, config, launch, version, instance, modrinth, curseforge, content, collections, search, optimization, system, misc, news, server, social, network, achievement, world, cli.
- `terracotta.rs` — Terracotta multiplayer proxy lifecycle management.
- `web_api.rs` — Axum-based HTTP API service with Bearer Token auth.
- `crash_parser.rs` — Minecraft crash report parsing and diagnosis.

### Frontend (React — `src/`)

**`api/`** — Modular API layer split by domain: `types.ts`, `cache.ts`, `versions.ts`, `auth.ts`, `instances.ts`, `modrinth.ts`, `curseforge.ts`, `collections.ts`, `content.ts`, `security.ts`, `system.ts`, `index.ts`. Re-exported as unified `api` object from `src/api.ts`. ~100 Tauri command wrappers with `cachedInvoke` (TTL cache + request deduplication) and `invalidateCache`.

**State management** — React Context + `useReducer` pattern in `src/stores/`:

- `authStore.tsx` — logged-in user, account list, login/logout/switchAccount
- `configStore.tsx` — app settings with save/reload
- `instanceStore.tsx` — instance CRUD
- `toastStore.tsx` — toast notification queue (auto-dismiss, max 5) + `errorToast()` helper with structured error mapping
- `themeStore.tsx` — dark/light/OLED/MD3 theme, persisted to localStorage
- `downloadStore.tsx` — download task queue with progress/speed/eta tracking for the Steam-style download panel

**Routing** — `react-router-dom` v7 `HashRouter` + `Routes` + `Route`. All pages lazy-loaded via `React.lazy()`. Current routes:

| Path                 | Page               | Description                                      |
| -------------------- | ------------------ | ------------------------------------------------ |
| `/home`              | HomePage           | Dashboard with launch panel + news               |
| `/store`             | MarketplacePage    | Marketplace hub: banner, categories, trending    |
| `/store/:type/:slug` | ContentDetailPage  | Content detail: desc, versions, gallery, deps    |
| `/instances`         | InstancesPage      | Instance list with search/filters                |
| `/instances/new`     | NewInstancePage    | Instance creation wizard                         |
| `/instances/:id`     | InstanceDetailPage | Instance overview & management                   |
| `/mods`              | MarketplacePage    | Content browser (same as store)                  |
| `/collections`       | CollectionsPage    | Saved/wishlisted items, filterable by type       |
| `/library`           | LibraryPage        | Per-instance installed content + update checking |
| `/versions`          | VersionsPage       | Version browser & downloader                     |
| `/settings`          | SettingsPage       | Java, memory, game directory, security config    |

**Component hierarchy**: `App` → `AppProviders` (composed via `composeProviders`) → `AppShell` → Sidebar + current Page + DownloadPanel. When MD3 layout is active, `MD3AppShell` replaces the ZZZ layout.

**Provider order** (composed via `composeProviders`): HashRouter → PluginProvider → ThemeBridge(ThemeProvider) → I18nProvider → AuthProvider → ConfigProvider → InstanceProvider → ToastProvider → DownloadProvider → ContextMenuProvider.

**Key UI components** (`components/ui/`):

- `ContentCard` — reusable card for any content type (list/gallery variants)
- `InstallButton` — full install flow with dependency resolution + queue integration + live progress tracking
- `CollectionButton` — heart toggle for wishlist
- `DownloadPanel` — Steam-style floating download manager with progress/speed/eta
- `InstanceSelect` — rich instance picker with version/loader badges
- `Modal` — accessible dialog with focus trap, aria-modal, focus restoration
- Plus: Button, Tabs, Badge, Tooltip, Pagination, Select, SearchPalette, Skeleton, etc.

**Styling**: CSS Modules per component (`*.module.css`) + global `styles/` with `tokens.css` (design tokens, clip-paths, animations), `themes.css` (dark/light/OLED + MD3), `ux-delight.css` (page transitions, stagger, shimmer).

**Plugin system** (`src/plugins/`):

- Core: PluginManager, PluginRegistry, PluginContext, ServiceRegistry, DependencyResolver, PluginProvider
- Built-in: ZZZ Theme Plugin (ThemeService), MD3 Theme Plugin (@material/web wrappers + MD3AppShell)
- Extension points: `ThemeExtensionPoint`, `LayoutExtensionPoint`

**Utility modules** (`src/utils/`):

- `errorMapping.ts` — Structured error type mapping with user-friendly suggestions
- `logger.ts` — Unified logging system (200-entry memory buffer, dev mode `window.__bonnext_logs`)
- `composeProviders.tsx` — Provider composition utility

**Settings page** (`src/pages/settings/`): Split into 12 section components (MemorySection, ThemeSection, etc.) composed by index.tsx.

### Data Flow

```
User Action → React Component → api/ invoke() → Tauri IPC → Rust Command
                                                                ↓
UI Update ← React State ← listen() event ← app.emit() ← Rust Background Task
```

Install flow: InstallButton fetches versions → resolves required deps in parallel → downloads each dependency + main item sequentially → each download tracked in downloadStore with live progress/speed/eta → DownloadPanel shows live progress.

### Configuration Persistence

Default game directory: `~/.local/share/bonnext/` (Linux), `~/Library/Application Support/bonnext/` (macOS), `%APPDATA%/bonnext/` (Windows). All state (config, accounts, instances, collections, install metadata) lives under this directory.

### Visual Design Constraints

- **ZZZ/Neo-Tokyo aesthetic** — dark theme, #FFE600 yellow accent, Bebas Neue headings, Inter body, DM Mono for data
- **MD3 aesthetic** (when MD3 theme active) — Material Design 3 with Roboto font, Navigation Rail, Top App Bar, @material/web components
- **Clip-path corners** — `--clip-primary/medium/small/badge/diamond` CSS variables for angled corner cuts
- **Overlays** — `.noise-overlay` (SVG noise) and `.scanline-overlay` (horizontal lines) for CRT effect
- **Sizes use `em`** — base is 16px set on `html`. Component font sizes typically 0.55em–0.9em range
- **All new UI must use CSS Modules** — no inline styles except for truly dynamic values
- **Light theme contrast** — accent color #6B5F00 meets WCAG AA (4.6:1 contrast ratio)
