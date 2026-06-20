# XMCL Feature Porting Design

Borrow/port features from [x-minecraft-launcher](https://github.com/Voxelum/x-minecraft-launcher) (XMCL) into BonNext. XMCL source cloned to `/Users/xiatian/Desktop/xmcl-reference` for reference.

## Feature 1: TextComponent Rendering

### Problem
- Backend `ServerDescription` already parses Minecraft rich-text (color/bold/italic/underlined/strikethrough/obfuscated) but frontend `extractDescription()` discards all styling, rendering plain text only.
- LogViewer renders plain text without Minecraft `§` color code support.

### Design

**Frontend only** — no backend changes needed.

1. `src/utils/textComponent.ts`:
   - `TextComponent` interface: `text`, `color?`, `bold?`, `italic?`, `underlined?`, `strikethrough?`, `obfuscated?`, `extra?: TextComponent[]`, `clickEvent?`, `hoverEvent?`
   - `MC_COLOR_MAP`: 16 Minecraft color names → CSS hex values (black→#000000, dark_blue→#0000AA, ... white→#FFFFFF)
   - `renderTextComponent(comp): ReactNode[]` — recursive render to styled `<span>` elements
   - `parseFormattedString(str): TextComponent` — parse `§` color codes into TextComponent tree
   - `toFormattedString(comp): string` — convert back to `§` format

2. `src/components/ui/TextComponentRenderer.tsx`:
   - Props: `component: TextComponent | string`, `className?`
   - Renders each text segment as `<span>` with inline style (color, fontWeight, fontStyle, textDecoration)
   - Obfuscated text: CSS animation cycling random characters

3. Integration points:
   - **ServersPage**: Replace `extractDescription()` with `TextComponentRenderer` for MOTD
   - **LogViewer**: Detect `§` codes in log lines, parse with `parseFormattedString`, render with `TextComponentRenderer`
   - **GameConsole**: Same treatment for game console output

### Reference
- XMCL `packages/text-component/index.ts` — full TextComponent type + render + format conversion
- XMCL `xmcl-keystone-ui/src/components/TextComponent.ts` — Vue component rendering

---

## Feature 2: Quilt / NeoForge Loader Support

### Problem
- `LoaderType` enum only has `Fabric | Forge`
- Modpack import already recognizes `neoforge` and `quilt-loader` strings but cannot install them

### Design

**Rust backend** (primary) + **frontend** (minor updates):

1. Extend `LoaderType` enum in `src-tauri/src/loader/mod.rs`:
   ```rust
   pub enum LoaderType { Fabric, Forge, Quilt, NeoForge }
   ```

2. New `src-tauri/src/loader/quilt.rs`:
   - `fetch_versions()`: `GET https://meta.quiltmc.org/v3/versions/loader` → parse loader version list
   - `fetch_versions_for_minecraft(mc_version)`: `GET https://meta.quiltmc.org/v3/versions/loader/{mc_version}` → returns `QuiltLoaderArtifact[]`
   - `install(mc_version, loader_version)`: `GET https://meta.quiltmc.org/v3/versions/loader/{mc_version}/{loader_version}/profile/json` → parse profile JSON → extract mainClass + libraries → return `LoaderInstallResult`
   - Nearly identical to Fabric (same profile API pattern), version_id format: `quilt-loader-{version}-{mc_version}`

3. New `src-tauri/src/loader/neoforge.rs`:
   - `fetch_versions()`: Parse `https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml` for available versions
   - `install(mc_version, forge_version)`: Download installer JAR from `https://maven.neoforged.net/releases/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar` → extract `install_profile.json` → reuse Forge's `unpack_forge_installer()` + `install_by_profile()` logic
   - NeoForge installer format is identical to modern Forge (1.17+)

4. Frontend updates:
   - `api/types.ts`: Update `loader_type` type to include `"quilt" | "neoforge"`
   - `NewInstancePage`: Add Quilt/NeoForge options to Loader selector
   - `InstanceDetailPage`: Add Quilt/NeoForge badges
   - `api/instances.ts`: Add `fetch_quilt_versions` / `fetch_neoforge_versions` API wrappers

### Reference
- XMCL `packages/installer/quilt.ts` + `quilt.browser.ts` — Quilt API endpoints and install flow
- XMCL `packages/installer/neoforge.ts` — NeoForge installer download + unpack (reuses Forge logic)

---

## Feature 3: NBT Parser + World Management

### Problem
- Only `list_instance_saves` exists, returning directory names
- No world metadata (seed, game mode, difficulty, playtime, size)
- No world backup/restore capability
- `fastnbt = "2"` already in Cargo.toml but unused

### Design

**Rust backend** (primary) + **frontend** (UI enhancements):

1. `src-tauri/src/world/nbt.rs` — NBT utilities:
   - `read_gzip_nbt<T: DeserializeOwned>(path: &Path) -> Result<T>` — read gzip-compressed NBT
   - `read_nbt<T: DeserializeOwned>(path: &Path) -> Result<T>` — read uncompressed NBT

2. `src-tauri/src/world/level.rs` — level.dat parsing:
   - `LevelData` struct (derive Deserialize): `LevelName`, `GameType`, `Difficulty`, `LastPlayed`, `RandomSeed`, `SpawnX/Y/Z`, `Time`, `SizeOnDisk`, `Version.Name`, `hardcore`, `initialized`, `raining`, `thundering`, `DayTime`, `allowCommands`, `GameRules`
   - `read_level_data(save_dir) -> Result<LevelData>` — read `{save_dir}/level.dat`

3. `src-tauri/src/world/server_dat.rs` — servers.dat parsing:
   - `ServerInfo` struct: `ip`, `name`, `icon`, `acceptTextures`
   - `read_server_dat(minecraft_dir) -> Result<Vec<ServerInfo>>`

4. Enhanced commands in `commands/world.rs`:
   - `get_instance_saves_detail(instance_id)` → returns `Vec<WorldInfo>` with LevelData
   - `get_world_overview(instance_id, save_name)` → full world info
   - `export_world(instance_id, save_name, output_path)` → ZIP backup
   - `import_world(instance_id, zip_path, save_name?)` → restore from ZIP

5. Frontend updates:
   - `api/types.ts`: Add `WorldInfo`, `LevelData` types
   - `InstanceDetailPage` saves tab: Show world details (seed, game mode, difficulty, last played, size)
   - Add backup/restore buttons with progress feedback

### Reference
- XMCL `packages/nbt/index.ts` — NBT serialize/deserialize (we use Rust `fastnbt` instead)
- XMCL `packages/game-data/level.ts` — LevelData struct + WorldReader
- XMCL `packages/game-data/serverDat.ts` — servers.dat read/write

---

## Feature 4: WebRTC P2P Multiplayer

### Problem
- Terracotta is an external process proxy, heavy-weight
- No direct P2P connectivity between users
- No NAT traversal (UPnP/STUN/TURN)

### Design (two phases)

**Phase 1: Rust backend core**

1. Add dependency: `str0m = "0.7"` (pure Rust WebRTC, no C deps)

2. `src-tauri/src/p2p/mod.rs` — Module entry + state:
   - `P2PState`: active connections, exposed ports, LAN broadcasts
   - `P2PConfig`: ICE servers, signaling URL

3. `src-tauri/src/p2p/webrtc.rs` — WebRTC core:
   - `PeerConnection` wrapper: create, set ICE servers, exchange SDP
   - `DataChannel` management: `metadata` protocol + `minecraft` protocol
   - Heartbeat (ping/pong every 1s with latency tracking)
   - Identity exchange (player name, UUID, skin URL)

4. `src-tauri/src/p2p/signaling.rs` — Signaling:
   - WebSocket client to signaling server
   - SDP offer/answer exchange
   - ICE candidate trickle

5. `src-tauri/src/p2p/proxy.rs` — Minecraft proxy:
   - Local TCP listener on random port
   - Forward TCP ↔ DataChannel for `minecraft` protocol
   - LAN broadcast: UDP multicast to `224.0.2.60:4445` with `[MOTD]{motd}[/MOTD][AD]{port}[/AD]`
   - LAN listener: detect local MC LAN opens, forward to remote peers

6. Commands in `commands/p2p.rs`:
   - `p2p_connect(peer_id)`, `p2p_disconnect(peer_id)`
   - `p2p_expose_port(port, protocol)`, `p2p_unexpose_port(port)`
   - `p2p_get_connections()`, `p2p_get_status()`

**Phase 2: Frontend UI**

1. `src/pages/MultiplayerPage/` — Multiplayer lobby
2. `src/components/multiplayer/` — Connection list, peer status, chat
3. Sidebar entry for multiplayer

### Reference
- XMCL `docs/protocol/p2p.md` — Complete P2P protocol specification
- XMCL `xmcl-runtime/peer/PeerService.ts` — Peer service implementation
- XMCL `packages/nat-api/` — UPnP/NAT-PMP port mapping

---

## Implementation Order

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 1 | TextComponent Rendering | Pure frontend, smallest scope, immediate visual impact (MOTD + logs) |
| 2 | Quilt/NeoForge Loader | Backend-focused, direct XMCL code reference, controlled scope |
| 3 | NBT + World Management | Backend-focused, `fastnbt` already available, enhances existing feature |
| 4 | WebRTC P2P Multiplayer | Most complex, new dependency + new module + new page, last |
