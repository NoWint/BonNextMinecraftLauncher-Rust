# BonNext 49 New Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 49 remaining features from the 50-feature design doc, prioritized by impact and feasibility.

**Architecture:** Each feature follows the existing Tauri v2 + React 18 + Rust pattern: backend Tauri commands in `lib.rs`, frontend API wrappers in `api.ts`, React components with CSS Modules.

**Tech Stack:** Rust (Tauri commands), TypeScript/React 18 (frontend), CSS Modules (styling)

---

## Phase 1: P0 Features (7 features)

### Task 1: #3 Crash Auto-Diagnosis
- Extend `crash_parser.rs` with rule engine
- Add `CrashDiagnosis` struct with severity, cause, fix suggestions
- Frontend: `CrashModal.tsx` component with color-coded results

### Task 2: #6 Smart Memory Tuner
- Extend `auto_tune_memory()` with mod count weighting
- Add `smart_tune_memory` command considering instance mod count
- Frontend: Settings page memory section with auto-optimize toggle

### Task 3: #12 Enhanced Modpack Import
- Extend `import_modpack()` with format detection
- Add parsers for CF ZIP, FTB, ATLauncher formats
- Frontend: Import wizard with drag-drop support

### Task 4: #14 Bulk Mod Update
- Extend `check_content_updates()` for batch operations
- Add `bulk_update_content` command with backup-before-update
- Frontend: LibraryPage update list with changelog preview

### Task 5: #16 One-Click Optimization Presets
- Add `presets.rs` with optimization preset definitions
- Add `apply_optimization_preset` command
- Frontend: Optimization tab in InstanceDetailPage

### Task 6: #23 Playtime Tracker
- Extend launch process to record precise start/end times
- Add `get_playtime_stats` command for aggregated stats
- Frontend: Playtime stats display on HomePage and dedicated page

### Task 7: #1 Smart Quick Launch (enhancement)
- Already partially implemented (instance switcher on PlayArea)
- Add `last_played_instance` to config
- Auto-select most recent instance on startup

---

## Phase 2: P1 Features (19 features)

### Task 8: #2 In-Game Overlay
- Create transparent always-on-top Tauri window
- FPS/memory monitoring via process API
- Frontend: Overlay.tsx with minimal UI

### Task 9: #4 Instance Snapshots
- Add `snapshot.rs` with CoW snapshot logic
- Commands: create_snapshot, list_snapshots, restore_snapshot
- Frontend: Snapshot tab in InstanceDetailPage

### Task 10: #5 Multi-Instance Launcher
- Refactor `AppState.launch_state` to `HashMap<instance_id, LaunchState>`
- Track multiple game processes by PID
- Frontend: Running instances indicator in sidebar

### Task 11: #9 Resource Pack Browser
- Reuse Modrinth search infrastructure with project_type=resourcepack
- Frontend: ResourcePack tab in MarketplacePage

### Task 12: #10 Shader Pack Browser
- Reuse Modrinth search with project_type=shader
- Performance tier badges
- Frontend: Shader tab in MarketplacePage

### Task 13: #13 Modpack Export
- Extend `export_mrpack()` with manifest generation
- Allow user to fill metadata (name, version, author)
- Frontend: Export modal in InstanceDetailPage

### Task 14: #15 Mod Conflict Detection
- Add `conflict.rs` with conflict database
- Scan JAR `fabric.mod.json` conflicts field
- Frontend: Conflict warning in install confirmation

### Task 15: #19 Friends System
- Add `friends.rs` with WebSocket status server
- Commands: add_friend, remove_friend, get_friends_status
- Frontend: Friends panel in sidebar

### Task 16: #20 LAN World Discovery
- Add `lan_discovery.rs` with mDNS
- Discover Minecraft LAN broadcasts
- Frontend: LAN worlds section on HomePage

### Task 17: #21 Server Status Monitor
- Add `server_status.rs` with SLP protocol
- Commands: add_server, remove_server, ping_server
- Frontend: Server cards on HomePage

### Task 18: #25 Instance Config Share
- Add `config_share.rs` with serialization
- Generate shareable config codes
- Frontend: Share button + QR code modal

### Task 19: #27 Dynamic Backgrounds
- Frontend-only: Canvas/WebGL particle effects
- Preset backgrounds (cyberpunk, starfield, matrix rain)
- Settings: Background selector with preview

### Task 20: #35 Hardware Profile
- Extend `get_system_info()` with GPU detection
- Compute performance score (1-10)
- Frontend: Hardware card in Settings

### Task 21: #38 Disk Space Analyzer
- Add `disk_analyzer.rs` with directory traversal
- Commands: get_disk_usage, cleanup_unused
- Frontend: Disk usage chart in Settings

### Task 22: #39 P2P LAN Transfer
- Add `p2p.rs` with TCP file transfer + mDNS discovery
- Commands: send_instance, receive_instance
- Frontend: Transfer notification UI

### Task 23: #43 Usage Dashboard
- Add `analytics.rs` aggregating playtime data
- Command: get_usage_stats
- Frontend: Dashboard page with charts

### Task 24: #44 Smart Mod Recommendations
- Add `recommendations.rs` with association rules
- Command: get_recommendations
- Frontend: Recommendations section in Marketplace

### Task 25: #45 Version Migration Assistant
- Add `migration.rs` analyzing mod compatibility
- Command: check_migration_readiness
- Frontend: Migration report banner + detail page

### Task 26: #48 Discord Rich Presence
- Add `discord.rs` with RPC integration
- Update presence on game launch/exit
- Frontend: Discord toggle in Settings

---

## Phase 3: P2 Features (18 features)

### Task 27: #7 Launch Pre-warming
### Task 28: #8 Guest Mode
### Task 29: #11 Datapack Manager
### Task 30: #17 World Seed Library
### Task 31: #18 Mod Translation Patches
### Task 32: #22 Screenshot Manager
### Task 33: #24 Achievement System
### Task 34: #28 Sound Themes
### Task 35: #29 Mini Mode
### Task 36: #30 Instance Icon Customization
### Task 37: #31 Font Customization
### Task 38: #33 Colorblind Mode
### Task 39: #36 Launch Profiling
### Task 40: #37 Frame Time Analysis
### Task 41: #40 Download Scheduler
### Task 42: #41 GC Tuning Advisor
### Task 43: #46 Anomaly Detection
### Task 44: #47 Natural Language Search

---

## Phase 4: P3 Features (6 features)

### Task 45: #26 Event Calendar
### Task 46: #32 Launch Animation
### Task 47: #34 Window Transparency
### Task 48: #42 Battery Management
### Task 49: #49 CLI Mode
### Task 50: #50 Local Web API

---

## Implementation Notes

- Each task follows TDD: write test → verify fail → implement → verify pass
- All new Tauri commands registered in `lib.rs` invoke_handler
- All new API methods added to `api.ts`
- All new pages/routes added to `App.tsx`
- CSS follows existing CSS Modules + tokens.css pattern
- i18n keys added for all user-facing text
