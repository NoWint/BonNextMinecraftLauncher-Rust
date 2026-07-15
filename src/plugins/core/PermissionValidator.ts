// src/plugins/core/PermissionValidator.ts

/**
 * Maps backend command names to their permission namespace.
 * Backend commands use flat names (e.g. `search_mods`) rather than
 * namespaced names (e.g. `marketplace:search`). This table allows
 * `invoke:marketplace` permissions to match the actual command names.
 *
 * Core commands are split into fine-grained namespaces (e.g. `core:launch`,
 * `core:config:read`) so plugins can request least-privilege access.
 *
 * Commands not listed here are rejected (fail-closed) by `canInvoke`.
 */
const COMMAND_PERMISSION_MAP: Record<string, string> = {
  // ===== marketplace (existing, kept unchanged) =====
  search_mods: 'marketplace',
  get_modrinth_project: 'marketplace',
  get_modrinth_versions: 'marketplace',
  get_modrinth_version_files: 'marketplace',
  install_modrinth_mod: 'marketplace',
  get_curseforge_featured: 'marketplace',
  search_curseforge: 'marketplace',
  get_curseforge_mod_files: 'marketplace',
  download_cf_mod: 'marketplace',
  get_collections: 'marketplace',
  add_to_collections: 'marketplace',
  remove_from_collections: 'marketplace',
  get_installed_content: 'marketplace',
  install_content: 'marketplace',
  uninstall_content: 'marketplace',
  check_content_updates: 'marketplace',
  get_modpackindex_search: 'marketplace',
  get_modpackindex_pack: 'marketplace',
  // marketplace (actual command names from lib.rs)
  get_popular_mods: 'marketplace',
  get_mod_details: 'marketplace',
  get_mod_versions: 'marketplace',
  get_version_by_id: 'marketplace',
  install_mod: 'marketplace',
  search_cf_mods: 'marketplace',
  get_cf_mod: 'marketplace',
  get_cf_project_details: 'marketplace',
  get_cf_mod_versions: 'marketplace',
  get_cf_featured: 'marketplace',
  get_cf_mod_files: 'marketplace',
  search_mpi_mods: 'marketplace',
  search_mpi_modpacks: 'marketplace',
  get_mpi_mod: 'marketplace',
  get_mpi_modpack: 'marketplace',
  get_mpi_mod_modpacks: 'marketplace',
  get_mpi_modpack_mods: 'marketplace',
  get_mpi_popular_mods: 'marketplace',
  get_mpi_popular_modpacks: 'marketplace',
  get_mpi_categories: 'marketplace',
  get_mpi_category_mods: 'marketplace',
  add_to_collection: 'marketplace',
  remove_from_collection: 'marketplace',
  is_in_collection: 'marketplace',
  list_collection: 'marketplace',

  // ===== social (existing, kept unchanged) =====
  list_friends: 'social',
  add_friend: 'social',
  remove_friend: 'social',
  get_social_feed: 'social',
  start_coplay: 'social',
  // social (actual command names from lib.rs)
  get_my_peer_id: 'social',
  export_identity_key: 'social',
  import_identity_key: 'social',
  start_social_discovery: 'social',
  stop_social_discovery: 'social',
  scan_social_peers: 'social',
  generate_instance_snapshot: 'social',
  compute_coplay_diff: 'social',
  start_discord_rpc: 'social',
  stop_discord_rpc: 'social',
  update_discord_presence: 'social',
  start_p2p_listener: 'social',
  send_p2p_message: 'social',
  get_peer_public_key: 'social',
  send_message: 'social',
  get_messages: 'social',
  mark_messages_read: 'social',
  get_unread_count: 'social',

  // ===== ai (existing, kept unchanged) =====
  ai_chat: 'ai',
  ai_complete: 'ai',
  ai_analyze_crash: 'ai',

  // ===== servers (existing, kept unchanged) =====
  ping_server: 'servers',
  list_servers: 'servers',
  add_server: 'servers',
  remove_server: 'servers',
  // servers (actual command names from lib.rs)
  ping_server_info: 'servers',
  batch_ping_servers: 'servers',
  toggle_server_favorite: 'servers',
  update_server_ping: 'servers',
  read_servers_dat: 'servers',
  write_servers_dat: 'servers',

  // ===== security (existing, kept unchanged) =====
  validate_jvm_args: 'security',
  check_file_permissions: 'security',
  get_audit_logs: 'security',
  // security (actual command names from lib.rs)
  get_security_config: 'security',
  save_security_config: 'security',
  get_security_score: 'security',
  get_audit_log: 'security',
  get_login_history: 'security',
  migrate_credentials: 'security',
  get_encryption_status: 'security',
  save_api_key: 'security',
  delete_api_key: 'security',
  get_api_key_status: 'security',
  fix_file_permissions: 'security',
  get_sandbox_availability: 'security',

  // ===== mod-tools (existing, kept unchanged) =====
  scan_mods: 'mod-tools',
  get_mod_info: 'mod-tools',
  watch_mods: 'mod-tools',
  // mod-tools (actual command names from lib.rs)
  scan_mod_file: 'mod-tools',
  scan_mods_directory: 'mod-tools',
  scan_mods_directory_concurrent: 'mod-tools',
  clear_mod_cache: 'mod-tools',
  get_mod_cache_stats: 'mod-tools',
  watch_instance_mods: 'mod-tools',
  unwatch_instance_mods: 'mod-tools',
  check_mod_conflicts: 'mod-tools',

  // ===== system-tools (existing, kept unchanged) =====
  get_system_info: 'system-tools',
  optimize_system: 'system-tools',
  // system-tools (actual command names from lib.rs)
  quick_start: 'system-tools',
  select_fastest_mirror: 'system-tools',
  auto_tune_memory_cmd: 'system-tools',
  smart_tune_memory_cmd: 'system-tools',
  get_hardware_profile: 'system-tools',
  get_disk_usage: 'system-tools',
  get_dir_size_cmd: 'system-tools',

  // ===== core:launch =====
  launch_game: 'core:launch',
  get_launch_state: 'core:launch',
  get_instance_launch_state: 'core:launch',
  get_running_games: 'core:launch',
  reset_launch_state: 'core:launch',
  reset_instance_launch_state: 'core:launch',
  cancel_launch: 'core:launch',
  pre_launch_check: 'core:launch',
  warmup_launch: 'core:launch',
  cli_launch: 'core:launch',

  // ===== core:config:read =====
  get_config: 'core:config:read',
  get_active_download_source: 'core:config:read',
  get_active_shell: 'core:config:read',
  get_url_config: 'core:config:read',
  get_download_schedule_config: 'core:config:read',

  // ===== core:config:write =====
  save_config: 'core:config:write',
  set_active_shell: 'core:config:write',
  set_git_proxy: 'core:config:write',
  set_download_schedule_config: 'core:config:write',

  // ===== core:shell =====
  scan_custom_shells: 'core:shell',
  import_custom_shell: 'core:shell',
  remove_custom_shell: 'core:shell',
  get_custom_shell_entry: 'core:shell',
  get_custom_shell_css: 'core:shell',
  save_shell_config: 'core:shell',
  load_shell_config: 'core:shell',

  // ===== core:instances:read =====
  list_instances: 'core:instances:read',
  get_instance: 'core:instances:read',
  get_game_dir: 'core:instances:read',
  get_default_game_dir: 'core:instances:read',
  check_instance_ready: 'core:instances:read',
  batch_check_instances: 'core:instances:read',
  health_check: 'core:instances:read',
  get_instance_groups: 'core:instances:read',
  get_instance_cover_image: 'core:instances:read',
  get_last_played_instance: 'core:instances:read',
  list_snapshots: 'core:instances:read',
  detect_launchers: 'core:instances:read',
  scan_launcher_instances: 'core:instances:read',
  scan_custom_directory: 'core:instances:read',
  diagnose_migration: 'core:instances:read',
  check_migration_readiness: 'core:instances:read',
  read_config_file: 'core:instances:read',

  // ===== core:instances:write =====
  create_instance: 'core:instances:write',
  delete_instance: 'core:instances:write',
  update_instance: 'core:instances:write',
  duplicate_instance: 'core:instances:write',
  export_instance: 'core:instances:write',
  import_modpack: 'core:instances:write',
  import_modpack_auto: 'core:instances:write',
  detect_modpack_format: 'core:instances:write',
  export_mrpack: 'core:instances:write',
  migrate_instance: 'core:instances:write',
  fix_migration_issues: 'core:instances:write',
  repair_instance: 'core:instances:write',
  toggle_mod: 'core:instances:write',
  open_folder: 'core:instances:write',
  write_config_file: 'core:instances:write',
  save_instance_groups: 'core:instances:write',
  create_snapshot: 'core:instances:write',
  restore_snapshot: 'core:instances:write',
  delete_snapshot: 'core:instances:write',
  create_guest_instance: 'core:instances:write',
  set_instance_icon: 'core:instances:write',
  export_instance_config: 'core:instances:write',
  import_instance_config: 'core:instances:write',

  // ===== core:versions:read =====
  get_versions: 'core:versions:read',
  list_installed_versions: 'core:versions:read',
  get_loader_versions: 'core:versions:read',

  // ===== core:versions:write =====
  download_version: 'core:versions:write',
  install_loader: 'core:versions:write',
  delete_version_cmd: 'core:versions:write',

  // ===== core:accounts:read =====
  list_accounts: 'core:accounts:read',
  get_active_account: 'core:accounts:read',
  get_mojang_profile: 'core:accounts:read',
  get_yggdrasil_presets: 'core:accounts:read',
  get_yggdrasil_server_presets: 'core:accounts:read',
  check_authlib_injector: 'core:accounts:read',
  yggdrasil_get_profile: 'core:accounts:read',
  yggdrasil_validate_token: 'core:accounts:read',
  read_skin_file: 'core:accounts:read',
  validate_skin_file: 'core:accounts:read',
  microsoft_get_skin_profile: 'core:accounts:read',

  // ===== core:accounts:write =====
  offline_login: 'core:accounts:write',
  start_microsoft_auth: 'core:accounts:write',
  poll_microsoft_auth: 'core:accounts:write',
  set_active_account: 'core:accounts:write',
  remove_account: 'core:accounts:write',
  refresh_auth_token: 'core:accounts:write',
  yggdrasil_login: 'core:accounts:write',
  login_yggdrasil: 'core:accounts:write',
  yggdrasil_refresh_token: 'core:accounts:write',
  yggdrasil_upload_skin: 'core:accounts:write',
  yggdrasil_reset_skin: 'core:accounts:write',
  yggdrasil_select_profile: 'core:accounts:write',
  test_yggdrasil_server: 'core:accounts:write',
  ensure_authlib_injector: 'core:accounts:write',
  set_local_skin: 'core:accounts:write',
  microsoft_upload_skin: 'core:accounts:write',
  microsoft_delete_skin: 'core:accounts:write',
  start_yggdrasil_oauth: 'core:accounts:write',
  complete_yggdrasil_oauth: 'core:accounts:write',
  upload_skin: 'core:accounts:write',
  reset_skin: 'core:accounts:write',
  equip_cape: 'core:accounts:write',
  hide_cape: 'core:accounts:write',
  download_authlib_injector: 'core:accounts:write',

  // ===== core:download =====
  pause_download: 'core:download',
  resume_download: 'core:download',
  cancel_download: 'core:download',
  is_download_paused: 'core:download',
  get_mirror_stats: 'core:download',

  // ===== core:content:read =====
  list_instance_mods: 'core:content:read',
  list_instance_resourcepacks: 'core:content:read',
  list_instance_shaders: 'core:content:read',
  get_content_counts: 'core:content:read',
  check_mod_updates: 'core:content:read',
  is_mod_pinned: 'core:content:read',

  // ===== core:content:write =====
  remove_installed_mod: 'core:content:write',
  bulk_update_content: 'core:content:write',
  pin_mod: 'core:content:write',
  unpin_mod: 'core:content:write',
  atomic_install_content: 'core:content:write',

  // ===== core:news =====
  get_minecraft_news: 'core:news',
  get_minecraft_article: 'core:news',
  open_url: 'core:news',

  // ===== core:world =====
  list_instance_saves: 'core:world',
  export_world: 'core:world',
  list_instance_logs: 'core:world',
  read_log_file: 'core:world',
  get_recent_logs: 'core:world',

  // ===== core:achievement =====
  get_achievements: 'core:achievement',
  unlock_achievement: 'core:achievement',
  check_achievements: 'core:achievement',

  // ===== core:optimization =====
  get_optimization_presets_cmd: 'core:optimization',
  apply_optimization_preset: 'core:optimization',
  get_gc_recommendations: 'core:optimization',
  get_recommended_config: 'core:optimization',
  get_recommendations: 'core:optimization',

  // ===== core:cache =====
  cache_get: 'core:cache',
  cache_set: 'core:cache',
  cache_invalidate: 'core:cache',
  cache_evict_expired: 'core:cache',

  // ===== core:search =====
  search_content: 'core:search',
  get_project_details: 'core:search',
  get_trending_content: 'core:search',
  get_recently_updated: 'core:search',

  // ===== core:network =====
  get_web_api_status: 'core:network',
  start_web_api: 'core:network',
  stop_web_api: 'core:network',
  start_lan_discovery: 'core:network',
  stop_lan_discovery: 'core:network',
  get_lan_worlds: 'core:network',
  scan_p2p_peers: 'core:network',
  send_file_p2p: 'core:network',
  p2p_get_status: 'core:network',
  p2p_connect: 'core:network',
  p2p_disconnect: 'core:network',

  // ===== core:terracotta =====
  download_terracotta: 'core:terracotta',
  is_terracotta_installed: 'core:terracotta',
  start_terracotta: 'core:terracotta',
  stop_terracotta: 'core:terracotta',
  get_terracotta_state: 'core:terracotta',
  terracotta_set_host: 'core:terracotta',
  terracotta_set_guest: 'core:terracotta',
  terracotta_set_idle: 'core:terracotta',

  // ===== core:workflow =====
  generate_modpack_plan: 'core:workflow',
  execute_modpack_plan: 'core:workflow',
  execute_crash_fix: 'core:workflow',
  abort_workflow: 'core:workflow',
  get_workflow_status: 'core:workflow',
  rollback_workflow: 'core:workflow',
  check_mod_compatibility: 'core:workflow',

  // ===== core:crash-watcher =====
  start_crash_watcher: 'core:crash-watcher',
  stop_crash_watcher: 'core:crash-watcher',
  parse_crash_report: 'core:crash-watcher',
  diagnose_crash: 'core:crash-watcher',
  diagnose_instance_crash: 'core:crash-watcher',
  diagnose_crash_from_content: 'core:crash-watcher',

  // ===== core:misc =====
  check_for_updates: 'core:misc',
  install_update: 'core:misc',
  find_java: 'core:misc',
  find_all_java: 'core:misc',
  check_java_version: 'core:misc',
  check_jre_available: 'core:misc',
  get_jre_sources: 'core:misc',
  fetch_available_jre_versions: 'core:misc',
  download_java_version: 'core:misc',
  list_downloaded_jres: 'core:misc',
  auto_select_jre: 'core:misc',
  download_jre_version_cmd: 'core:misc',
  list_jre_versions: 'core:misc',
  get_playtime_stats: 'core:misc',
  record_playtime: 'core:misc',
  list_screenshots: 'core:misc',
  get_launch_profiling_data: 'core:misc',
  get_frame_time_data: 'core:misc',
  nlp_search_content: 'core:misc',
  detect_anomalies: 'core:misc',
  get_battery_status: 'core:misc',
};

export class PermissionValidator {
  private httpDomains = new Set<string>();
  private fsReadScopes = new Set<string>();
  private fsWriteScopes = new Set<string>();
  private invokeNamespaces = new Set<string>();
  private _canListenEvents = false;
  private _canEmitEvents = false;

  constructor(permissions: string[]) {
    for (const perm of permissions) {
      if (perm.startsWith('http:')) {
        this.httpDomains.add(perm.slice(5));
      } else if (perm.startsWith('fs:read:')) {
        this.fsReadScopes.add(perm.slice(8));
      } else if (perm.startsWith('fs:write:')) {
        this.fsWriteScopes.add(perm.slice(9));
      } else if (perm.startsWith('invoke:')) {
        this.invokeNamespaces.add(perm.slice(7));
      } else if (perm === 'events:listen') {
        this._canListenEvents = true;
      } else if (perm === 'events:emit') {
        this._canEmitEvents = true;
      }
    }
  }

  canHttp(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      for (const domain of this.httpDomains) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  canInvoke(command: string): boolean {
    // Namespaced commands (e.g. `myplugin:doSomething`) use the prefix directly.
    if (command.includes(':')) {
      const namespace = command.split(':')[0];
      return this.invokeNamespaces.has(namespace);
    }
    // Flat backend commands are mapped to permission namespaces via the lookup table.
    const mapped = COMMAND_PERMISSION_MAP[command];
    if (mapped) {
      // Exact namespace match (e.g. `invoke:core:launch` covers `launch_game`).
      if (this.invokeNamespaces.has(mapped)) return true;
      // Parent namespace match for backward compatibility
      // (e.g. `invoke:core` covers all `core:*` mapped commands).
      const parent = mapped.split(':')[0];
      return this.invokeNamespaces.has(parent);
    }
    // Unmapped flat commands are rejected (fail-closed).
    return false;
  }

  canFsRead(scope: string): boolean {
    return this.fsReadScopes.has('global') || this.fsReadScopes.has(scope);
  }

  canFsWrite(scope: string): boolean {
    return this.fsWriteScopes.has('global') || this.fsWriteScopes.has(scope);
  }

  canListenEvents(): boolean {
    return this._canListenEvents;
  }

  canEmitEvents(): boolean {
    return this._canEmitEvents;
  }
}
