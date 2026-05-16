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

# Rust
cargo check           # Fast compile check
cargo test            # Run tests
cargo build --manifest-path src-tauri/Cargo.toml
```

Full check (both sides): `cd src-tauri && cargo check 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`

## Architecture

BonNext is a **Tauri v2 desktop app** — a cross-platform Minecraft Java Edition launcher. Rust backend, React 18 + TypeScript frontend.

### Backend (Rust — `src-tauri/src/`)

The binary entry is `main.rs` → calls `lib.rs::run()` which registers all commands and starts Tauri.

**`lib.rs`** — All `#[tauri::command]` handlers are defined here (versions, config, auth, download, launch, instances, loaders). Shared state: `AppState` holding `Arc<Mutex<LaunchState>>`.

**Auth** (`auth/`): Microsoft OAuth 2.0 device flow (`microsoft.rs`) + offline mode (`offline.rs`). Account persistence via `token_store.rs` with per-session token refresh.

**Config** (`config.rs`): JSON config file at `config_dir/config.json`. Defaults: 2GB max memory, 512MB min, official download source, 8 concurrent downloads.

**Download** (`download/`): Parallel download queue with retry, SHA1 verification (`verifier.rs`), progress events emitted to frontend, and mirror source selection (`source.rs`).

**Version** (`version/`): Fetches Mojang version manifest, JSON metadata parsing with parent inheritance via `resolver.rs`. `rules.rs` handles OS/feature rule evaluation for conditional libraries.

**Launch** (`launch/`): State machine (`state.rs`: idle → checking → downloading → validating → launching → running/crashed/exited). `args.rs` builds JVM args and `process.rs` spawns the Minecraft process with native library extraction.

**Loader** (`loader/`): Mod loader support for Fabric and Forge — fetches loader versions and patches the version JSON with loader libraries and main class changes.

**Instance** (`instance/`): Per-instance configuration with separate `.minecraft` directories. Instances stored in `instances/instances.json`. Uses shared library/asset directories with hard links to save disk space.

**Platform** (`platform/`): Cross-platform Java detection, structured logging (file + stdout with tracing-subscriber), and path management. Path hierarchy: shared `libraries/`, `assets/`, `versions/` + per-instance `.minecraft/` with mods, config, saves, etc.

**`error.rs`**: Unified `LauncherError` enum using `thiserror` — maps HTTP, IO, JSON, ZIP, and domain errors. All variants serialize as strings for Tauri's IPC.

**`http_client.rs`**: HTTP client factory. Sets `User-Agent: BonNext/1.0 (MinecraftLauncher)` header (required by Mojang CDN) and sensible timeouts.

### Frontend (React — `src/`)

**`api.ts`**: Typed wrappers around `invoke()` for every Tauri command. Also provides `onDownloadProgress` which wraps `listen('download-progress', ...)` for real-time download events from the backend.

**State management**: React Context + `useReducer` pattern in `src/stores/`:
- `authStore.tsx` — `AuthProvider` / `useAuth()`: logged-in user, account list, login/logout/switchAccount
- `configStore.tsx` — `ConfigProvider` / `useConfig()`: app settings with save/reload
- `instanceStore.tsx` — `InstanceProvider` / `useInstance()`: instance CRUD

**Routing**: Hash-based manual routing in `App.tsx` (no React Router). `getPageFromHash()` parses `window.location.hash` to determine the active page. Pages: `#/home`, `#/instances`, `#/instances/new`, `#/versions`, `#/settings`.

**Component hierarchy**: `App` → Providers (Auth, Config, Instance) → `AppShell` → Sidebar + current Page. `components/layout/` (Sidebar, Decorations) and `components/ui/` (Button, Inputs, Modal, Tabs, Breadcrumb, Pagination, Status).

**Styling**: CSS Modules per component (`*.module.css`) + global `styles/global.css` and `styles/tokens.css` for design tokens.

### Data Flow

Frontend API call → `invoke()` → Tauri IPC → Rust command handler → result returned. For async progress (downloads), Rust emits events via `app.emit("download-progress", ...)` → frontend listens via `listen()`.

### Configuration Persistence

Default game directory: `~/.local/share/bonnext/` (Linux), `~/Library/Application Support/bonnext/` (macOS), `%APPDATA%/bonnext/` (Windows). All state (config, accounts, instances) lives under this directory.
