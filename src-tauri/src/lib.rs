#![allow(clippy::too_many_arguments)]
mod auth;
mod cache;
mod collections;
mod config;
mod content;
mod crash_parser;
mod download;
mod error;
mod http_client;
mod instance;
mod launch;
mod loader;
mod modrinth;
mod platform;
mod security;
mod social;
mod chat;
mod social_feed;
mod recommendation;
mod types;
mod version;
mod curseforge;
mod modpackindex;
mod commands;
mod web_api;
mod terracotta;

pub use config::AppConfig;
pub use config::SecurityConfig;
pub use error::LauncherError;
pub use instance::manager::GameInstance;
pub use security::crypto::EncryptedData;
pub use security::crypto::decrypt_data;
pub use security::crypto::encrypt_data;
pub use security::crypto::encrypt_json;
pub use security::crypto::decrypt_json;
pub use version::manifest::VersionEntry;
pub use version::manifest::VersionManifest;
pub use version::manifest::LatestVersions;
pub use web_api::WebApiServer;

use launch::state::LaunchState;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

pub struct RunningGame {
    pub state: Arc<Mutex<LaunchState>>,
    pub pid: u32,
    pub instance_id: String,
    pub started_at: std::time::Instant,
}

struct AppState {
    launch_state: Arc<Mutex<LaunchState>>,
    running_games: Arc<Mutex<HashMap<String, RunningGame>>>,
}

pub struct TerracottaState {
    pub port: tokio::sync::Mutex<Option<u16>>,
    pub child: tokio::sync::Mutex<Option<std::process::Child>>,
}

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub date: String,
    pub body: Option<String>,
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, LauncherError> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| LauncherError::Other(format!("Updater init failed: {}", e)))?;
    let update = updater.check().await.map_err(|e| LauncherError::Other(format!("Update check failed: {}", e)))?;
    match update {
        Some(update) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            date: update.date.clone().map(|d| d.to_string()).unwrap_or_default(),
            body: update.body.clone(),
        })),
        None => Ok(None),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), LauncherError> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| LauncherError::Other(format!("Updater init failed: {}", e)))?;
    let update = updater.check().await.map_err(|e| LauncherError::Other(format!("Update check failed: {}", e)))?;
    match update {
        Some(update) => {
            update.download_and_install(|_, _| {}, || {}).await.map_err(|e| LauncherError::Other(format!("Update install failed: {}", e)))?;
            Ok(())
        }
        None => Err(LauncherError::Other("No update available".to_string())),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::logger::init_logger();
    tracing::info!("BonNext launcher starting");

    if let Err(e) = platform::paths::ensure_dirs() {
        tracing::error!("Failed to create directories: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState { launch_state: Arc::new(Mutex::new(LaunchState::Idle)), running_games: Arc::new(Mutex::new(HashMap::new())) })
        .manage(download::queue::DownloadControlState::new())
        .manage(cache::ApiCache::new())
        .manage(TerracottaState { port: tokio::sync::Mutex::new(None), child: tokio::sync::Mutex::new(None) })
        .manage(crate::social::p2p::P2pState::new())
        .invoke_handler(tauri::generate_handler![
            commands::version::get_versions,
            commands::launch::get_launch_state,
            commands::launch::get_instance_launch_state,
            commands::launch::get_running_games,
            commands::launch::reset_launch_state,
            commands::launch::reset_instance_launch_state,
            commands::launch::pre_launch_check,
            commands::config::get_config,
            commands::config::save_config,
            commands::misc::find_java,
            commands::misc::find_all_java,
            commands::misc::check_java_version,
            commands::misc::check_jre_available,
            commands::misc::get_jre_sources,
            commands::misc::fetch_available_jre_versions,
            commands::misc::download_java_version,
            commands::misc::list_downloaded_jres,
            commands::auth::offline_login,
            commands::auth::start_microsoft_auth,
            commands::auth::poll_microsoft_auth,
            commands::auth::list_accounts,
            commands::auth::get_active_account,
            commands::auth::set_active_account,
            commands::auth::remove_account,
            commands::auth::refresh_auth_token,
            commands::launch::download_version,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::cancel_download,
            commands::download::is_download_paused,
            commands::launch::launch_game,
            commands::instance::get_game_dir,
            commands::instance::get_default_game_dir,
            commands::instance::list_instances,
            commands::instance::create_instance,
            commands::instance::delete_instance,
            commands::instance::update_instance,
            commands::instance::get_instance,
            commands::instance::duplicate_instance,
            commands::instance::export_instance,
            commands::instance::import_modpack,
            commands::instance::import_modpack_auto,
            commands::instance::detect_modpack_format,
            commands::instance::export_mrpack,
            commands::instance::detect_launchers,
            commands::instance::scan_launcher_instances,
            commands::instance::scan_custom_directory,
            commands::instance::migrate_instance,
            commands::instance::check_instance_ready,
            commands::instance::toggle_mod,
            commands::instance::health_check,
            commands::instance::open_folder,
            commands::instance::read_config_file,
            commands::instance::write_config_file,
            commands::instance::parse_crash_report,
            commands::instance::diagnose_crash,
            commands::instance::diagnose_instance_crash,
            commands::instance::get_loader_versions,
            commands::instance::install_loader,
            commands::modrinth::search_mods,
            commands::modrinth::get_popular_mods,
            commands::modrinth::get_mod_details,
            commands::modrinth::get_mod_versions,
            commands::modrinth::get_version_by_id,
            commands::modrinth::install_mod,
            commands::modrinth::install_content,
            commands::optimization::get_optimization_presets_cmd,
            commands::optimization::apply_optimization_preset,
            commands::search::search_content,
            commands::search::get_project_details,
            commands::search::get_trending_content,
            commands::search::get_recently_updated,
            commands::content::list_instance_mods,
            commands::content::list_instance_resourcepacks,
            commands::content::list_instance_shaders,
            commands::world::list_instance_saves,
            commands::world::list_instance_logs,
            commands::world::read_log_file,
            commands::world::get_recent_logs,
            commands::content::remove_installed_mod,
            commands::content::get_content_counts,
            commands::content::check_content_updates,
            commands::content::bulk_update_content,
            commands::content::pin_mod,
            commands::content::unpin_mod,
            commands::content::is_mod_pinned,
            commands::content::atomic_install_content,
            commands::curseforge::search_cf_mods,
            commands::curseforge::get_cf_mod,
            commands::curseforge::get_cf_project_details,
            commands::curseforge::get_cf_mod_versions,
            commands::curseforge::get_cf_featured,
            commands::curseforge::get_cf_mod_files,
            commands::curseforge::download_cf_mod,
            commands::modpackindex::search_mpi_mods,
            commands::modpackindex::search_mpi_modpacks,
            commands::modpackindex::get_mpi_mod,
            commands::modpackindex::get_mpi_modpack,
            commands::modpackindex::get_mpi_mod_modpacks,
            commands::modpackindex::get_mpi_modpack_mods,
            commands::modpackindex::get_mpi_popular_mods,
            commands::modpackindex::get_mpi_popular_modpacks,
            commands::modpackindex::get_mpi_categories,
            commands::modpackindex::get_mpi_category_mods,
            commands::collections::add_to_collection,
            commands::collections::remove_from_collection,
            commands::collections::is_in_collection,
            commands::collections::list_collection,
            commands::news::get_minecraft_news,
            commands::news::get_minecraft_article,
            commands::news::open_url,
            commands::system::quick_start,
            commands::system::select_fastest_mirror,
            commands::system::get_system_info,
            commands::system::auto_tune_memory_cmd,
            commands::system::smart_tune_memory_cmd,
            commands::misc::get_playtime_stats,
            commands::misc::record_playtime,
            commands::system::get_instance_cover_image,
            commands::system::get_last_played_instance,
            commands::instance::create_snapshot,
            commands::instance::list_snapshots,
            commands::instance::restore_snapshot,
            commands::instance::delete_snapshot,
            commands::misc::check_mod_conflicts,
            commands::server::ping_server,
            commands::misc::export_instance_config,
            commands::misc::import_instance_config,
            commands::system::get_hardware_profile,
            commands::system::get_disk_usage,
            commands::system::list_installed_versions,
            commands::system::delete_version_cmd,
            commands::system::get_dir_size_cmd,
            commands::system::get_recommended_config,
            commands::system::get_recommendations,
            commands::system::check_migration_readiness,
            commands::misc::warmup_launch,
            commands::misc::create_guest_instance,
            commands::misc::list_screenshots,
            commands::achievement::get_achievements,
            commands::achievement::unlock_achievement,
            commands::misc::set_instance_icon,
            commands::misc::get_download_schedule_config,
            commands::misc::set_download_schedule_config,
            commands::misc::get_gc_recommendations,
            commands::misc::detect_anomalies,
            commands::cli::get_battery_status,
            commands::cli::cli_launch,
            commands::network::get_web_api_status,
            commands::network::start_web_api,
            commands::network::stop_web_api,
            commands::social::list_friends,
            commands::social::add_friend,
            commands::social::remove_friend,
            commands::social::get_my_peer_id,
            commands::social::export_identity_key,
            commands::social::import_identity_key,
            commands::social::start_social_discovery,
            commands::social::stop_social_discovery,
            commands::social::scan_social_peers,
            commands::social::generate_instance_snapshot,
            commands::social::compute_coplay_diff,
            commands::chat::send_message,
            commands::chat::get_messages,
            commands::chat::mark_messages_read,
            commands::chat::get_unread_count,
            commands::network::start_lan_discovery,
            commands::network::stop_lan_discovery,
            commands::network::get_lan_worlds,
            commands::network::scan_p2p_peers,
            commands::network::send_file_p2p,
            commands::social::start_discord_rpc,
            commands::social::stop_discord_rpc,
            commands::social::update_discord_presence,
            commands::social::start_p2p_listener,
            commands::social::send_p2p_message,
            commands::social::get_peer_public_key,
            commands::misc::get_launch_profiling_data,
            commands::misc::get_frame_time_data,
            commands::misc::nlp_search_content,
            commands::misc::get_security_config,
            commands::misc::save_security_config,
            commands::misc::get_security_score,
            commands::misc::get_audit_log,
            commands::misc::get_login_history,
            commands::misc::migrate_credentials,
            commands::misc::get_encryption_status,
            commands::misc::save_api_key,
            commands::misc::delete_api_key,
            commands::misc::get_api_key_status,
            commands::misc::check_file_permissions,
            commands::misc::fix_file_permissions,
            commands::misc::validate_jvm_args,
            commands::misc::get_sandbox_availability,
            commands::terracotta::download_terracotta,
            commands::terracotta::is_terracotta_installed,
            commands::terracotta::start_terracotta,
            commands::terracotta::stop_terracotta,
            commands::terracotta::get_terracotta_state,
            commands::terracotta::terracotta_set_host,
            commands::terracotta::terracotta_set_guest,
            commands::terracotta::terracotta_set_idle,
            commands::auth::yggdrasil_login,
            commands::auth::yggdrasil_refresh_token,
            commands::auth::yggdrasil_get_profile,
            commands::auth::yggdrasil_upload_skin,
            commands::auth::yggdrasil_reset_skin,
            commands::auth::yggdrasil_select_profile,
            commands::auth::get_yggdrasil_presets,
            commands::auth::ensure_authlib_injector,
            commands::auth::set_local_skin,
            commands::auth::read_skin_file,
            commands::auth::validate_skin_file,
            commands::auth::microsoft_get_skin_profile,
            commands::auth::microsoft_upload_skin,
            commands::auth::microsoft_delete_skin,
            commands::auth::check_authlib_injector,

            check_for_updates,
            install_update,
            commands::misc::auto_select_jre,
            commands::misc::download_jre_version_cmd,
            commands::misc::list_jre_versions,
        ])
        .setup(|_app| {
            let audit_enabled = config::load_config()
                .map(|c| c.security.audit_log_enabled)
                .unwrap_or(true);
            if let Err(e) = security::audit::init_audit(audit_enabled) {
                tracing::warn!("Failed to initialize audit system: {}", e);
            }
            if config::load_config().map(|c| c.security.credential_encryption).unwrap_or(true) && security::credential_store::is_plain() {
                if let Err(e) = security::credential_store::migrate_plain_to_encrypted() {
                    tracing::warn!("Failed to migrate credentials to encrypted storage: {}", e);
                }
            }
            tauri::async_runtime::spawn(async {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                match crate::version::manifest::fetch_version_manifest().await {
                    Ok(_) => tracing::info!("Version manifest preloaded"),
                    Err(e) => tracing::warn!("Version manifest preload failed: {}", e),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
