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
mod version;
mod curseforge;
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
use std::sync::Arc;

struct AppState {
    launch_state: Arc<Mutex<LaunchState>>,
}

static TERRACOTTA_PORT: Mutex<Option<u16>> = Mutex::new(None);

#[tauri::command]
async fn download_terracotta() -> Result<(), LauncherError> {
    terracotta::download_terracotta(|_, _| {}).await
}

#[tauri::command]
async fn is_terracotta_installed() -> Result<bool, LauncherError> {
    Ok(terracotta::is_terracotta_installed())
}

#[tauri::command]
async fn start_terracotta() -> Result<u16, LauncherError> {
    let existing_port = *TERRACOTTA_PORT.lock();
    if let Some(p) = existing_port {
        let client = crate::http_client::build_client();
        if client
            .get(&format!("http://127.0.0.1:{}/state", p))
            .send()
            .await
            .is_ok()
        {
            return Ok(p);
        }
    }

    let binary = terracotta::get_terracotta_binary_path();
    if !binary.exists() {
        return Err(LauncherError::Other(
            "Terracotta is not installed".to_string(),
        ));
    }

    let child = std::process::Command::new(&binary)
        .arg("--daemon")
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    let port = terracotta::discover_terracotta_port(10).await?;

    std::mem::forget(child);

    *TERRACOTTA_PORT.lock() = Some(port);
    Ok(port)
}

#[tauri::command]
async fn stop_terracotta() -> Result<(), LauncherError> {
    let port = {
        let mut p = TERRACOTTA_PORT.lock();
        p.take()
    };

    if let Some(port) = port {
        terracotta::set_idle(port).await.ok();
        #[cfg(not(target_os = "windows"))]
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("terracotta")
            .output();
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/IM", "terracotta.exe"])
            .output();
    }

    Ok(())
}

#[tauri::command]
async fn get_terracotta_state() -> Result<terracotta::TerracottaState, LauncherError> {
    let port = *TERRACOTTA_PORT.lock();
    let port = port.ok_or_else(|| LauncherError::Other("Terracotta is not running".to_string()))?;
    terracotta::get_state(port).await
}

#[tauri::command]
async fn terracotta_set_host() -> Result<(), LauncherError> {
    let port = *TERRACOTTA_PORT.lock();
    let port = port.ok_or_else(|| LauncherError::Other("Terracotta is not running".to_string()))?;
    terracotta::set_scanning(port).await?;
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    terracotta::set_hosting(port).await
}

#[tauri::command]
async fn terracotta_set_guest(room: String) -> Result<(), LauncherError> {
    let port = *TERRACOTTA_PORT.lock();
    let port = port.ok_or_else(|| LauncherError::Other("Terracotta is not running".to_string()))?;
    terracotta::set_guesting(port, &room).await
}

#[tauri::command]
async fn terracotta_set_idle() -> Result<(), LauncherError> {
    let port = *TERRACOTTA_PORT.lock();
    let port = port.ok_or_else(|| LauncherError::Other("Terracotta is not running".to_string()))?;
    terracotta::set_idle(port).await
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
        .manage(AppState { launch_state: Arc::new(Mutex::new(LaunchState::Idle)) })
        .manage(cache::ApiCache::new())
        .invoke_handler(tauri::generate_handler![
            commands::version::get_versions,
            commands::launch::get_launch_state,
            commands::launch::reset_launch_state,
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
            commands::instance::check_instance_ready,
            commands::instance::open_folder,
            commands::instance::parse_crash_report,
            commands::instance::diagnose_crash,
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
            commands::content::remove_installed_mod,
            commands::content::get_content_counts,
            commands::content::check_content_updates,
            commands::content::bulk_update_content,
            commands::curseforge::search_cf_mods,
            commands::curseforge::get_cf_mod,
            commands::curseforge::get_cf_project_details,
            commands::curseforge::get_cf_mod_versions,
            commands::curseforge::get_cf_featured,
            commands::curseforge::get_cf_mod_files,
            commands::curseforge::download_cf_mod,
            commands::collections::add_to_collection,
            commands::collections::remove_from_collection,
            commands::collections::is_in_collection,
            commands::collections::list_collection,
            commands::news::get_minecraft_news,
            commands::news::get_minecraft_article,
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
            commands::network::start_lan_discovery,
            commands::network::stop_lan_discovery,
            commands::network::get_lan_worlds,
            commands::network::scan_p2p_peers,
            commands::network::send_file_p2p,
            commands::social::start_discord_rpc,
            commands::social::stop_discord_rpc,
            commands::social::update_discord_presence,
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
            download_terracotta,
            is_terracotta_installed,
            start_terracotta,
            stop_terracotta,
            get_terracotta_state,
            terracotta_set_host,
            terracotta_set_guest,
            terracotta_set_idle,

        ])
        .setup(|_app| {
            let audit_enabled = config::load_config()
                .map(|c| c.security.audit_log_enabled)
                .unwrap_or(true);
            if let Err(e) = security::audit::init_audit(audit_enabled) {
                tracing::warn!("Failed to initialize audit system: {}", e);
            }
            if config::load_config().map(|c| c.security.credential_encryption).unwrap_or(true) {
                if security::credential_store::is_plain() {
                    if let Err(e) = security::credential_store::migrate_plain_to_encrypted() {
                        tracing::warn!("Failed to migrate credentials to encrypted storage: {}", e);
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
