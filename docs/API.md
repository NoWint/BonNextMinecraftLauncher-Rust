# BonNext API Reference

All frontend–backend communication uses Tauri's `invoke()` IPC. The typed wrappers live in `src/api.ts`.

---

## Authentication

### `offline_login(username: string) -> OfflineAuthResult`
Create an offline-mode account with a deterministic v5 UUID.

**Returns:** `{ username: string, uuid: string, access_token: string }`

### `start_microsoft_auth() -> DeviceCodeResponse`
Initiate Microsoft OAuth 2.0 device-code flow. Returns a user code and verification URI.

**Returns:** `{ user_code: string, device_code: string, verification_uri: string, expires_in: number, interval: number, message: string }`

### `poll_microsoft_auth(device_code: string) -> MicrosoftAuthResult`
Poll the Microsoft token endpoint after user completes login.

**Returns:** `{ username: string, uuid: string, access_token: string, refresh_token: string }`

### `list_accounts() -> StoredAccount[]`
List all stored accounts (both offline and Microsoft).

### `get_active_account() -> StoredAccount | null`
Get the currently active account.

### `set_active_account(id: string) -> void`
Switch the active account by ID.

### `remove_account(id: string) -> void`
Remove a stored account.

### `refresh_auth_token() -> string | null`
Refresh the current account's access token. Returns the new token or null.

---

## Configuration

### `get_config() -> AppConfig`
Load the current application configuration.

**Returns:** `{ game_dir, java_path, max_memory, min_memory, window_width, window_height, fullscreen, download_source, max_concurrent_downloads, jvm_args, selected_instance, auth_type, keep_launcher_open, show_log_on_crash, auto_update_java, java_download_source, force_memory, force_java_path, security }`

### `save_config(config: AppConfig) -> void`
Persist application configuration.

---

## Instances

### `list_instances() -> GameInstance[]`
List all Minecraft instances.

### `create_instance(instance: GameInstance) -> void`
Create a new instance.

### `delete_instance(id: string) -> void`
Delete an instance by ID.

### `update_instance(instance: GameInstance) -> void`
Update an existing instance's configuration.

### `get_instance(id: string) -> GameInstance | null`
Get a single instance by ID.

### `duplicate_instance(id: string, newName: string) -> GameInstance`
Duplicate an existing instance with a new name.

### `export_instance(id: string, outputPath: string) -> void`
Export an instance as an archive.

### `import_modpack(path: string) -> GameInstance`
Import a modpack from a file path.

### `import_modpack_auto(path: string) -> GameInstance`
Auto-detect format and import a modpack.

### `detect_modpack_format(path: string) -> string`
Detect the format of a modpack file.

### `export_mrpack(id: string, outputPath: string) -> void`
Export an instance as a `.mrpack` file.

### `check_instance_ready(instance_id: string) -> boolean`
Check if an instance is ready to launch.

### `get_instance_cover_image(instance_id: string) -> string | null`
Get the cover image path for an instance.

### `get_last_played_instance() -> GameInstance | null`
Get the most recently played instance.

### `set_instance_icon(instance_id: string, icon_path: string) -> void`
Set a custom icon for an instance.

### `create_guest_instance() -> GameInstance`
Create a temporary guest instance.

### `create_snapshot(instance_id: string, name: string) -> { id, name, created_at, size_bytes }`
Create a snapshot of an instance.

### `list_snapshots(instance_id: string) -> Array<{ id, name, created_at, size_bytes }>`
List all snapshots for an instance.

### `restore_snapshot(instance_id: string, snapshot_id: string) -> void`
Restore an instance from a snapshot.

### `delete_snapshot(instance_id: string, snapshot_id: string) -> void`
Delete a snapshot.

### `export_instance_config(instance_id: string) -> string`
Export instance config as a base64-encoded shareable code.

### `import_instance_config(config_code: string) -> GameInstance`
Import an instance from a shareable config code.

---

## Version Management

### `get_versions() -> VersionEntry[]`
Fetch the Mojang version manifest (cached for 5 minutes).

### `download_version(version_id: string, version_url: string) -> void`
Download a Minecraft version with all dependencies.

### `list_installed_versions() -> Array<{ version_id, size_bytes, version_type, path }>`
List all locally installed versions.

### `delete_version_cmd(version_id: string) -> void`
Delete a locally installed version.

### `check_migration_readiness(instance_id: string, target_version: string) -> Array<{ mod_slug, mod_name, status, detail }>`
Check if an instance's mods are compatible with a target version.

---

## Launch

### `launch_game(version_id, version_url, username, uuid, access_token, max_memory?, min_memory?, java_path?, jvm_args?, instance_id?) -> void`
Launch a Minecraft game instance.

### `get_launch_state() -> LaunchState`
Get the current launch state machine state.

**States:** `'idle' | 'checking' | 'downloading' | 'validating' | 'launching' | 'running' | 'exited' | 'crashed' | 'error'`

### `reset_launch_state() -> void`
Reset the launch state to idle.

### `warmup_launch(instance_id: string) -> void`
Pre-warm the OS file cache by reading instance libraries.

### `get_launch_profiling_data(instance_id: string) -> Array<{ stage, duration_ms, details }>`
Get launch profiling data for an instance.

### `parse_crash_report(instance_id: string) -> CrashDiagnosis`
Parse and diagnose a crash report.

### `diagnose_crash(instance_id: string) -> CrashDiagnosis`
Run crash diagnosis for an instance.

---

## Java

### `find_java() -> string`
Auto-detect Java installation path.

### `find_all_java() -> JavaInfo[]`
Find all installed Java runtimes.

**Returns:** `Array<{ path: string, version: number | null, vendor: string | null }>`

### `check_java_version(java_path: string) -> number | null`
Check the major version of a Java installation.

### `check_jre_available(major_version: number) -> boolean`
Check if a JRE of the specified major version is available for download.

### `get_jre_sources() -> JreSourceInfo[]`
Get available JRE download sources.

---

## Modrinth

### `search_mods(query, game_version?, loader?, limit?, offset?) -> [ModResult[], number]`
Search mods on Modrinth. Returns results and total count.

### `get_popular_mods(game_version?, limit?) -> ModResult[]`
Get popular mods from Modrinth.

### `get_mod_details(slug: string) -> ModResult`
Get detailed info for a Modrinth project.

### `get_mod_versions(slug: string, game_version?, loader?) -> ModVersion[]`
Get available versions for a Modrinth project.

### `get_version_by_id(version_id: string) -> ModVersion`
Get a specific Modrinth version by ID.

### `install_mod(file_url, filename, instance_id, sha1?) -> string`
Download and install a mod from Modrinth.

### `install_content(file_url, filename, instance_id, content_type?, sha1?, slug?, version_id?, source?) -> string`
Install content (mod, resource pack, shader, etc.) from Modrinth.

---

## CurseForge

### `search_cf_mods(query, game_version?, category?, sort?, limit?, offset?) -> [ModResult[], number]`
Search mods on CurseForge.

### `get_cf_mod(mod_id: number) -> ModResult`
Get a CurseForge mod by ID.

### `get_cf_project_details(mod_id: number) -> ModProjectFull`
Get detailed project info from CurseForge.

### `get_cf_mod_versions(mod_id: number) -> ModVersion[]`
Get available versions for a CurseForge project.

### `get_cf_featured() -> ModResult[]`
Get featured mods from CurseForge.

### `get_cf_mod_files(mod_id: number) -> ModFile[]`
Get downloadable files for a CurseForge mod.

### `download_cf_mod(file_url, filename, instance_id, content_type?, sha1?, slug?, version_id?) -> string`
Download and install a mod from CurseForge.

---

## Marketplace & Search

### `search_content(query, content_type?, game_version?, loader?, sort?, limit?, offset?) -> [ModResult[], number]`
Unified content search across Modrinth.

### `get_project_details(slug: string) -> ModProjectFull`
Get full project details for marketplace view.

### `get_trending_content(project_type?, game_version?, limit?) -> ModResult[]`
Get trending content.

### `get_recently_updated(project_type?, limit?) -> ModResult[]`
Get recently updated content.

### `nlp_search_content(query: string) -> Array<{ slug, name, relevance, interpretation }>`
Natural language search with synonym expansion and TF-IDF scoring.

---

## Content Library

### `list_instance_mods(instance_id: string) -> InstalledModInfo[]`
List installed mods for an instance.

### `list_instance_resourcepacks(instance_id: string) -> string[]`
List installed resource packs.

### `list_instance_shaders(instance_id: string) -> string[]`
List installed shader packs.

### `list_instance_saves(instance_id: string) -> WorldInfo[]`
List saved worlds for an instance.

### `list_instance_logs(instance_id: string) -> LogFileInfo[]`
List log files for an instance.

### `read_log_file(instance_id: string, filename: string, max_lines?) -> string`
Read a log file's contents.

### `remove_installed_mod(instance_id: string, filename: string) -> void`
Remove an installed mod.

### `get_content_counts(instance_id: string) -> ContentCounts`
Get counts of installed content by type.

### `check_content_updates(instance_id: string) -> UpdateInfo[]`
Check for available content updates.

### `bulk_update_content(instance_id: string) -> { succeeded, failed, errors }`
Update all outdated content.

---

## Collections

### `add_to_collection(slug, title, author, icon_url, content_type, description, downloads, categories) -> void`
Add an item to the user's collection/wishlist.

### `remove_from_collection(slug: string) -> void`
Remove an item from the collection.

### `is_in_collection(slug: string) -> boolean`
Check if an item is in the collection.

### `list_collection() -> CollectionItem[]`
List all items in the user's collection.

---

## Optimization

### `get_optimization_presets_cmd() -> OptimizationPreset[]`
Get available optimization presets (e.g., Sodium + Lithium + Starlight).

### `apply_optimization_preset(instance_id: string, preset_id: string) -> { succeeded, failed, errors }`
Apply an optimization preset to an instance.

### `get_gc_recommendations(total_ram_mb: number) -> Array<{ gc_type, jvm_args, description, suitable_for }>`
Get garbage collector recommendations based on available RAM.

### `detect_anomalies(instance_id: string) -> Array<{ anomaly_type, severity, message, suggestion }>`
Detect performance anomalies in an instance.

### `check_mod_conflicts(instance_id: string) -> Array<{ mod_a, mod_b, reason, severity }>`
Check for known mod conflicts.

### `get_frame_time_data(instance_id: string) -> FrameTimeData`
Analyze frame time data from game logs.

**Returns:** `{ avg_fps, min_fps, max_fps, frame_times_ms, stutter_count, analysis }`

---

## System

### `quick_start() -> void`
Run the quick start setup flow.

### `select_fastest_mirror() -> string`
Test mirror speeds and return the fastest one.

### `get_system_info() -> SystemInfo`
Get system information (RAM, CPU, OS, Java).

**Returns:** `{ total_ram_mb, used_ram_mb, cpu_name, cpu_count, java_version, os, arch }`

### `auto_tune_memory_cmd() -> number`
Auto-tune memory allocation based on system resources.

### `smart_tune_memory_cmd(instance_id: string) -> number`
Smart memory tuning for a specific instance.

### `get_hardware_profile() -> HardwareProfile`
Get detailed hardware profile with performance score.

**Returns:** `{ cpu_name, cpu_count, total_ram_mb, gpu_name, performance_score, performance_level }`

### `get_disk_usage() -> DiskUsage`
Get disk usage breakdown.

**Returns:** `{ total_bytes, instances_bytes, versions_bytes, libraries_bytes, assets_bytes, logs_bytes, other_bytes, breakdown }`

### `get_dir_size_cmd(path: string) -> number`
Get the total size of a directory.

### `get_playtime_stats() -> PlaytimeStats`
Get playtime statistics.

### `record_playtime(instance_id: string, seconds: number) -> void`
Record playtime for an instance.

### `get_battery_status() -> { on_battery, percentage, charging }`
Get current battery status.

### `open_folder(path: string) -> void`
Open a folder in the system file manager.

### `get_game_dir() -> string`
Get the current game directory path.

### `get_default_game_dir() -> string`
Get the default game directory path.

---

## Server

### `ping_server(address: string) -> ServerStatus`
Ping a Minecraft server and get its status.

**Returns:** `{ id, name, address, online, players_online, players_max, latency_ms, motd, version, favicon }`

---

## Social

### `list_friends() -> Array<{ id, name, status, current_game }>`
List all friends.

### `add_friend(id: string, name: string) -> void`
Add a friend.

### `remove_friend(id: string) -> void`
Remove a friend.

### `start_discord_rpc() -> void`
Start Discord Rich Presence integration.

### `stop_discord_rpc() -> void`
Stop Discord Rich Presence.

### `update_discord_presence(details: string, state: string) -> void`
Update the Discord presence status.

---

## Network

### `start_lan_discovery() -> void`
Start discovering Minecraft LAN worlds.

### `stop_lan_discovery() -> void`
Stop LAN discovery.

### `get_lan_worlds() -> Array<{ host, port, motd, world_type, players_online, players_max }>`
Get discovered LAN worlds.

### `scan_p2p_peers() -> Array<{ name, address, available_bytes }>`
Scan for P2P peers on the local network.

### `send_file_p2p(peer_address: string, file_path: string) -> void`
Send a file to a P2P peer.

### `get_web_api_status() -> { running, port, token }`
Get the status of the local Web API server.

### `start_web_api() -> void`
Start the local Web API server.

### `stop_web_api() -> void`
Stop the local Web API server.

---

## CLI

### `cli_launch(instance_id: string) -> void`
Launch an instance in CLI mode (headless).

---

## News

### `get_minecraft_news() -> MinecraftNewsEntry[]`
Fetch the latest Minecraft news entries.

### `get_minecraft_article(url: string) -> MinecraftArticle`
Fetch a full Minecraft news article by URL.

---

## Achievements

### `get_achievements() -> Array<{ id, name, description, unlocked, unlocked_at, icon }>`
List all achievements and their unlock status.

### `unlock_achievement(achievement_id: string) -> void`
Unlock an achievement.

---

## Screenshots

### `list_screenshots(instance_id: string) -> Array<{ filename, path, size_bytes, modified }>`
List screenshots for an instance.

---

## Download Scheduler

### `get_download_schedule_config() -> DownloadScheduleConfig`
Get download scheduler configuration.

**Returns:** `{ max_speed_bytes, active_during_game, priority }`

### `set_download_schedule_config(max_speed_bytes, active_during_game, priority) -> void`
Update download scheduler configuration.

---

## Security

### `get_security_config() -> SecurityConfig`
Get security configuration.

### `save_security_config(security: SecurityConfig) -> void`
Update security configuration.

### `get_security_score() -> number`
Get a security score (0–100) based on current settings.

### `get_audit_log(category?, limit?, offset?) -> AuditEntry[]`
Read security audit log entries.

### `get_login_history() -> LoginHistoryEntry[]`
Get login history.

### `migrate_credentials() -> void`
Migrate plain-text credentials to encrypted storage.

### `get_encryption_status() -> { encrypted, plain }`
Check credential encryption status.

### `save_api_key(name: string, value: string) -> void`
Store an API key securely.

### `delete_api_key(name: string) -> void`
Delete a stored API key.

### `get_api_key_status(name: string) -> KeyStatus`
Check if an API key is configured.

### `check_file_permissions() -> FilePermissionResult[]`
Check file permissions on sensitive files.

### `fix_file_permissions() -> FilePermissionFixResult[]`
Fix insecure file permissions.

### `validate_jvm_args(args: string) -> { valid, args?, error?, warnings? }`
Validate JVM arguments against whitelist.

### `get_sandbox_availability() -> SandboxAvailability`
Check if sandbox mode is available on this platform.

---

## Events (Frontend → Backend)

### `download-progress`
Emitted during game downloads. Listen via `api.onDownloadProgress()`.

**Payload:** `{ completed, total, bytes_downloaded, current_url, phase, finished, speed_bytes_per_sec, eta_seconds }`

### `jre-download-progress`
Emitted during JRE downloads. Listen via `api.onJreDownloadProgress()`.

**Payload:** `{ downloaded, total, version }`
