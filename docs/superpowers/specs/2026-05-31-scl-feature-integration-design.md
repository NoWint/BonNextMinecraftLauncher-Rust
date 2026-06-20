# SCL-Inspired Feature Integration Design

> Date: 2026-05-31
> Status: Draft
> Source: Swift-Craft-Launcher (SCL) code review
> Approach: Independent module pattern (方案 A)

## Overview

Integrate 10 features inspired by Swift-Craft-Launcher into BonNext, excluding AI-related content. All features follow BonNext's existing module architecture (Rust backend + React frontend via Tauri IPC).

## Architecture

### New Rust Modules

```
src-tauri/src/
  server_ping/          — Server List Ping protocol + SRV + browser
    mod.rs              — Module entry + Tauri commands
    protocol.rs         — SLP protocol (VarInt, Handshake, Status)
    srv.rs              — DNS SRV record resolution
    models.rs           — MinecraftServerInfo data structures

  mod_scanner/          — Mod smart scanning + dual-source identification
    mod.rs              — Module entry + Tauri commands
    fingerprint.rs      — CurseForge murmur hash fingerprint algorithm
    scanner.rs          — Three-tier identification (SHA1→Modrinth→CF→Fallback)
    cache_db.rs         — SQLite cache layer (hash→project detail)

  mod_watcher/          — File system monitoring
    mod.rs              — Module entry + Tauri commands
    watcher.rs          — notify crate watcher + Tauri event push

  url_config.rs         — Centralized URL management + GitHub proxy
```

### Enhanced Existing Modules

```
src-tauri/src/
  commands/world.rs     — NBT parsing enhancement
  auth/skin_server.rs   — Skin upload (multipart), cape equip/hide, skin reset
  auth/yggdrasil.rs     — Preset servers + pluggable profile parsers
  instance/migration.rs — XMCL, GDLauncher, Prism Launcher support
```

### New Frontend Pages/Components

```
src/pages/ServersPage/  — Server browser page (/servers route)
src/components/ui/
  ServerCard            — Server card with status/latency
  ServerPingBadge       — Online status / latency badge
  ModScanResult         — Mod scan result display
  SkinManager           — Skin/cape management panel (in Settings)
src/api/
  servers.ts            — Server-related API
  modScanner.ts         — Mod scanner API
```

### Shared SQLite Database

Single database file at `{data_dir}/bonnext.db` with tables:
- `mod_cache` — hash (PK), json_data (BLOB), created_at, updated_at
- `servers` — id (PK), name, address, port, is_favorite, last_ping_result, last_ping_at, icon_base64, notes
- `server_ping_history` — id (PK), server_id (FK), latency_ms, online_players, max_players, pinged_at

## Feature Specifications

---

### F1: Server Ping Protocol (SLP)

**Priority**: P0 — Batch 2

**Reference**: SCL `MinecraftServerPing.swift`

**Rust Implementation** (`server_ping/`):

- **protocol.rs**: Full Minecraft 1.7+ Server List Ping protocol
  - VarInt encode/decode (translate from SCL)
  - Handshake packet (0x00): protocol version -1, address, port, next state 1
  - Status Request packet (0x00)
  - Status Response parsing: JSON → `MinecraftServerInfo`
  - TCP connection with configurable timeout (default 5s)
  - Use `tokio::net::TcpStream` for async TCP

- **srv.rs**: DNS SRV record resolution
  - Query `_minecraft._tcp.{domain}` SRV records
  - Use `trust-dns-resolver` crate
  - Fall back to original address if SRV lookup fails
  - Return `(target_host, target_port)` tuple

- **models.rs**:
  ```rust
  struct MinecraftServerInfo {
      version: ServerVersion,        // name, protocol
      players: ServerPlayers,        // max, online, sample
      description: ServerDescription, // text, extra (rich text)
      favicon: Option<String>,       // base64 encoded icon
      modinfo: Option<ServerModInfo>, // mod list if modded
  }
  ```

- **mod.rs** Tauri commands:
  - `ping_server(address: String, port: u16, timeout_ms: u32) -> Option<MinecraftServerInfo>`
  - `resolve_srv(domain: String) -> Option<(String, u16)>`
  - `ping_server_with_srv(address: String, port: u16) -> Option<MinecraftServerInfo>` — auto-resolve SRV then ping
  - `batch_ping_servers(servers: Vec<(String, u16)>) -> Vec<Option<MinecraftServerInfo>>` — parallel ping

**Frontend** (`/servers` page):
- Server list with cards showing: icon, name, MOTD (rich text), player count, version, latency
- Add/remove/edit servers
- Favorite servers pinned to top
- Auto-refresh ping (configurable interval)
- Click to copy address
- Latency color coding: green (<50ms), yellow (<150ms), red (>150ms), gray (offline)

---

### F2: CurseForge Fingerprint Algorithm

**Priority**: P0 — Batch 1

**Reference**: SCL `CurseForgeFingerprint.swift`

**Rust Implementation** (`mod_scanner/fingerprint.rs`):

Translate SCL's murmur hash fingerprint algorithm (~130 lines):
- Strip whitespace bytes (0x09, 0x0A, 0x0D, 0x20)
- Compute normalized length (non-whitespace byte count)
- Murmur hash with seed=1, m=1540483477
- Process bytes in 4-byte chunks (little-endian)
- Final mixing: hash ^= hash >> 13; hash *= m; hash ^= hash >> 15

Public API:
```rust
pub fn curseforge_fingerprint(data: &[u8]) -> u32
pub fn curseforge_fingerprint_file(path: &Path) -> Result<u32, LauncherError>
```

---

### F3: Mod Smart Scanner (Three-Tier Identification)

**Priority**: P0 — Batch 1

**Reference**: SCL `ModScanner.swift`

**Rust Implementation** (`mod_scanner/`):

- **scanner.rs**: Three-tier identification pipeline
  1. Compute SHA1 hash of local mod file
  2. Query Modrinth `version_file/{sha1}` API → if hit, return project detail
  3. Compute CurseForge fingerprint → query CF `fingerprints/432` API → if hit, map to Modrinth-compatible format
  4. Fallback: parse filename for mod name (strip version suffix, replace underscores)

  ```rust
  pub struct ScanResult {
      pub file_name: String,
      pub file_hash: String,
      pub project_id: Option<String>,
      pub project_name: Option<String>,
      pub project_slug: Option<String>,
      pub source: ScanSource,       // Modrinth | CurseForge | Fallback
      pub project_type: String,     // mod, datapack, shader, resourcepack
      pub icon_url: Option<String>,
  }
  ```

- **cache_db.rs**: SQLite cache using `rusqlite`
  - `get_mod_cache(hash: &str) -> Option<ScanResult>`
  - `save_mod_cache(hash: &str, result: &ScanResult)`
  - `batch_save(caches: &[(String, ScanResult)])`
  - `clear_expired(older_than: Duration)` — TTL cleanup

- **mod.rs** Tauri commands:
  - `scan_mod_file(path: String) -> ScanResult`
  - `scan_mods_directory(instance_id: String) -> Vec<ScanResult>` — scan all mods in instance
  - `clear_mod_cache`
  - `get_mod_cache_stats -> (total, modrinth_hits, cf_hits, fallbacks)`

**Frontend** (enhanced LibraryPage):
- Show scanned mod info: icon, name, source badge (Modrinth/CF/Fallback)
- Click to open project detail page
- "Rescan" button per instance
- Scan progress indicator

---

### F4: Mod Directory Real-Time Watcher

**Priority**: P2 — Batch 3

**Reference**: SCL `ModDirectoryWatcherRegistry.swift`

**Rust Implementation** (`mod_watcher/`):

- Use `notify` crate for cross-platform file watching
- Watch `{instance_dir}/mods/`, `{instance_dir}/resourcepacks/`, `{instance_dir}/shaderpacks/`
- On file change events, emit Tauri events to frontend:
  - `mod-directory-changed` with payload `{ instance_id, change_type: "added"|"removed"|"modified", file_name }`
- Debounce events (500ms) to avoid rapid-fire on bulk operations
- Auto-register watchers when instance is selected, clean up on instance removal

**Frontend**:
- Listen to `mod-directory-changed` event
- Show toast notification: "New mod detected: {name}" or "Mod removed: {name}"
- Auto-refresh mod list in LibraryPage

---

### F5: Mod Update Detection Enhancement

**Priority**: P2 — Batch 3

**Reference**: SCL `ModUpdateChecker.swift`

**Enhancement to existing `check_content_updates`**:

- Compare local file SHA1 hash with latest Modrinth version's SHA1
- If hashes differ → update available
- Support batch update checking for all mods in an instance
- Return structured update info:
  ```rust
  pub struct ModUpdateInfo {
      pub file_name: String,
      pub project_id: String,
      pub current_hash: String,
      pub latest_hash: String,
      pub latest_version: String,
      pub latest_version_id: String,
      pub download_url: String,
  }
  ```

**Frontend** (enhanced LibraryPage):
- "Check for Updates" button per instance
- Show update badge on mods with available updates
- One-click update (download new version, replace old file)

---

### F6: NBT Parsing Enhancement

**Priority**: P3 — Batch 4

**Reference**: SCL `NBTParser.swift` + `WorldNBTMapper.swift`

**Enhancement to existing `commands/world.rs`**:

- Add support for 1.26+ `world_gen_settings.dat` seed reading
  - Path: `{world}/data/minecraft/world_gen_settings.dat`
  - Structure: `root.data.seed`
- Add game mode mapping (0=Survival, 1=Creative, 2=Adventure, 3=Spectator)
- Add difficulty mapping (0=Peaceful, 1=Easy, 2=Normal, 3=Hard)
- Add difficulty string mapping for newer versions ("peaceful", "easy", "normal", "hard")
- Support reading `RandomSeed` from legacy `level.dat`

**Frontend** (enhanced InstanceDetailPage save info):
- Show seed value with copy button
- Show game mode and difficulty as localized badges

---

### F7: Skin & Cape Management

**Priority**: P3 — Batch 4

**Reference**: SCL `PlayerSkinService.swift`

**Enhancement to existing `auth/skin_server.rs`**:

- **Skin Upload**: Multipart/form-data upload to `minecraftservices.com/minecraft/profile/skins`
  - Fields: `variant` (CLASSIC/SLIM), `file` (PNG)
  - Validate: 64x64 pixels, PNG format
- **Cape Equip**: PUT to `minecraftservices.com/minecraft/profile/capes/active` with `{capeId}`
- **Cape Hide**: DELETE to `minecraftservices.com/minecraft/profile/capes/active`
- **Skin Reset**: DELETE to `minecraftservices.com/minecraft/profile/skins/active`
- **Profile Fetch**: GET `minecraftservices.com/minecraft/profile` — returns skins + capes list
- Detailed HTTP error handling per status code (400/401/403/404/429)

**Frontend** (Settings page → "Skin & Appearance" section):
- Current skin preview (Canvas API 2D head render from skin texture)
- Upload skin button (file picker, classic/slim toggle)
- Cape selector dropdown (from profile capes list)
- Reset skin / hide cape buttons
- Skin model toggle (Classic / Slim)

---

### F8: Yggdrasil Preset Servers Enhancement

**Priority**: P3 — Batch 4

**Reference**: SCL `YggdrasilAuthService.swift` + `YggdrasilServerPresets.swift`

**Enhancement to existing `auth/yggdrasil.rs`**:

- **Preset server configurations**:
  - LittleSkin: baseURL=littleskin.cn, clientId=1181, OAuth2 authorization code flow
  - Mua: baseURL=skin.mualliance.ltd, clientId=34, OAuth2
  - Ely.by: baseURL=account.ely.by, OAuth2
  - Custom: user provides baseURL, clientId, clientSecret, redirectURI, scope
  - **Security note**: Client secrets for preset servers must be stored encrypted using `security/crypto.rs` (AES-256-GCM), not hardcoded. SCL uses XOR obfuscation; BonNext uses stronger encryption.

- **Pluggable profile parsers**: Each server may return different JSON formats for player profiles
  - `YggdrasilProfileParser` trait with `parse(data: &[u8]) -> Result<Vec<YggdrasilProfile>>`
  - Implementations: LittleSkinParser, MuaParser, ElyParser, GenericParser
  - Auto-detect format or use server-specific parser

- **Multi-profile selection**: When Yggdrasil returns multiple profiles, let user choose

**Frontend** (enhanced login flow):
- Yggdrasil server selector dropdown (presets + custom)
- Custom server configuration form
- Profile selection dialog when multiple profiles returned

---

### F9: Centralized URL Management (URLConfig)

**Priority**: P0 — Batch 1

**Reference**: SCL `URLConfig.swift`

**New module** (`url_config.rs`):

- Centralized enum-based URL constants:
  - `URLConfig::Authentication` — Microsoft OAuth, Xbox Live, Minecraft Services endpoints
  - `URLConfig::Modrinth` — API v2/v3 endpoints (search, project, version, tags)
  - `URLConfig::CurseForge` — API v1 endpoints (search, files, fingerprints)
  - `URLConfig::Fabric` — meta.fabricmc.net
  - `URLConfig::Quilt` — meta.quiltmc.org
  - `URLConfig::NeoForge` — launcher-meta.modrinth.com/neo
  - `URLConfig::Mojang` — version manifests, asset indexes
  - `URLConfig::AuthlibInjector` — download URL with version

- **GitHub proxy** (`apply_git_proxy`):
  - Default proxy: `https://gh-proxy.com`
  - Configurable via settings (enable/disable, custom proxy URL)
  - Auto-apply to `github.com` and `raw.githubusercontent.com` URLs
  - Skip `api.github.com` (API calls don't need proxy)
  - Persist setting in `config.json`

- **Tauri commands**:
  - `get_url_config -> UrlConfigSnapshot` — return current config for frontend
  - `set_git_proxy(enabled: bool, proxy_url: Option<String>)` — update proxy settings

**Frontend** (Settings page → new "Network" section):
- GitHub proxy toggle
- Custom proxy URL input
- "Test Connection" button

---

### F10: Launcher Instance Migration Enhancement

**Priority**: P3 — Batch 4

**Reference**: SCL `LauncherInstanceParser.swift` + parsers

**Enhancement to existing `instance/migration.rs`**:

- **New launcher support**:
  - **Prism Launcher**: Same format as MultiMC (`mmc-pack.json` + `instance.cfg`)
  - **GDLauncher**: Parse `instance.json` with `name`, `loader`, `loaderVersion`, `minecraftVersion`
  - **XMCL**: Parse XMCL's instance config format

- **Trait-based parser architecture**:
  ```rust
  trait LauncherInstanceParser {
      fn launcher_type(&self) -> &str;
      fn is_valid_instance(&self, path: &Path) -> bool;
      fn parse_instance(&self, path: &Path) -> Result<ImportInstanceInfo, LauncherError>;
  }
  ```

- **ImportInstanceInfo** (enhanced from existing `MigrateableInstance`):
  - game_name, game_version, mod_loader, mod_loader_version
  - game_icon_path, icon_download_url
  - source_game_directory
  - launcher_type

**Frontend** (enhanced NewInstancePage):
- "Import from other launcher" section
- Auto-detect installed launchers
- Show detected instances with import button
- Progress indicator during import

---

## Implementation Batches

| Batch | Features | Dependencies | Estimated Scope |
|-------|----------|-------------|-----------------|
| 1 | F9 (URLConfig) + F2 (CF Fingerprint) + F3 (Mod Scanner) | None | 3 new modules + frontend |
| 2 | F1 (Server Ping) | None (parallel with Batch 1) | 1 new module + new page |
| 3 | F4 (Mod Watcher) + F5 (Mod Update) | Batch 1 (Scanner) | 1 new module + enhancements |
| 4 | F6 (NBT) + F7 (Skin) + F8 (Yggdrasil) + F10 (Migration) | None (parallel) | 4 enhancements |

## New Dependencies

```toml
# Cargo.toml additions
rusqlite = { version = "0.31", features = ["bundled"] }  # SQLite for mod_cache + servers
trust-dns-resolver = "0.24"                               # DNS SRV resolution
notify = "6"                                               # File system watching
```

## Data Flow

```
[Frontend]                    [Tauri IPC]              [Rust Backend]
                                        
ServersPage ──ping_server()──→ server_ping::ping() ──→ TCP to MC server
            ←──ServerInfo────←

LibraryPage ──scan_mods()───→ mod_scanner::scan() ──→ SHA1 → Modrinth API
            ←──ScanResult───←                      → CF Fingerprint → CF API
                                                 → Filename fallback
                                                 → SQLite cache

Settings ──upload_skin()───→ skin_server::upload() ──→ Mojang API
         ←──success───────←

mod_watcher ──(auto)──────→ notify watcher ──→ Tauri event ──→ Frontend refresh
```

## Error Handling

All new modules follow BonNext's existing `LauncherError` enum pattern:
- Add new error variants: `ServerPing`, `ModScan`, `Fingerprint`, `FileWatch`, `SkinUpload`, `YggdrasilProfile`
- Each variant includes descriptive message + chain error source
- Frontend uses `errorMapping.ts` for user-friendly messages
