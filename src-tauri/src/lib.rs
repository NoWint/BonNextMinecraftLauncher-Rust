#![allow(clippy::too_many_arguments)]
mod auth;
mod cache;
mod collections;
mod config;
mod content;
mod curseforge;
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
mod commands;

use serde::Serialize;
use serde::Deserialize;
use config::AppConfig;
use crash_parser::CrashInfo;
use crash_parser::CrashDiagnosis;
use download::queue::{DownloadProgress, DownloadQueue};
use error::LauncherError;
use instance::manager::GameInstance;
use launch::args::{InstanceSettings, LaunchContext};
use launch::process::LaunchProcess;
use launch::state::LaunchState;
use platform::paths;
use parking_lot::Mutex;
use std::sync::Arc;
use tauri::Emitter;
use version::manifest::VersionEntry;

struct AppState {
    launch_state: Arc<Mutex<LaunchState>>,
}

#[tauri::command]
async fn get_versions() -> Result<Vec<VersionEntry>, LauncherError> {
    version::manifest::fetch_versions_sorted().await
}

#[tauri::command]
async fn get_launch_state(state: tauri::State<'_, AppState>) -> Result<LaunchState, LauncherError> {
    let current = state.launch_state.lock();
    Ok(*current)
}

#[tauri::command]
async fn reset_launch_state(state: tauri::State<'_, AppState>) -> Result<(), LauncherError> {
    let mut current = state.launch_state.lock();
    *current = LaunchState::Idle;
    Ok(())
}

#[tauri::command]
async fn get_config() -> Result<AppConfig, LauncherError> {
    config::load_config()
}

#[tauri::command]
async fn save_config(config: AppConfig) -> Result<(), LauncherError> {
    config::save_config(&config)
}

#[tauri::command]
async fn find_java() -> Result<String, LauncherError> {
    let java_path = platform::java::find_java()?;
    Ok(java_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn find_all_java() -> Vec<platform::java::JavaInfo> {
    platform::java::find_all_java()
}

#[tauri::command]
async fn check_java_version(java_path: String) -> Result<Option<u32>, LauncherError> {
    let path = std::path::PathBuf::from(&java_path);
    let version = platform::java::check_java_version(&path);
    Ok(version)
}

#[tauri::command]
async fn check_jre_available(major_version: u32) -> Result<bool, LauncherError> {
    if platform::java_download::find_downloaded_jre(major_version).is_some() {
        return Ok(true);
    }
    match platform::java_download::fetch_available_jres(major_version).await {
        Ok(releases) => Ok(!releases.is_empty()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn get_jre_sources() -> Vec<platform::java_download::JreSourceInfo> {
    platform::java_download::get_jre_sources()
}

#[tauri::command]
async fn offline_login(username: String) -> Result<serde_json::Value, LauncherError> {
    let result = auth::offline::offline_login(&username)?;
    // Persist the account
    let mut store = auth::token_store::AccountStore::load()?;
    let now = chrono::Utc::now().to_rfc3339();
    let account = auth::token_store::StoredAccount {
        id: result.uuid.clone(),
        username: result.username.clone(),
        uuid: result.uuid.clone(),
        access_token: result.access_token.clone(),
        refresh_token: None,
        account_type: "offline".to_string(),
        last_used: now,
        expires_at: None,
        avatar_url: None,
    };
    store.upsert_account(account)?;
    store.set_active(&result.uuid)?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
async fn start_microsoft_auth() -> Result<serde_json::Value, LauncherError> {
    let result = auth::microsoft::start_device_auth().await?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
async fn poll_microsoft_auth(device_code: String) -> Result<serde_json::Value, LauncherError> {
    let result = auth::microsoft::poll_device_auth(&device_code).await?;
    // Persist the Microsoft account
    let mut store = auth::token_store::AccountStore::load()?;
    let now = chrono::Utc::now().to_rfc3339();
    let account = auth::token_store::StoredAccount {
        id: result.uuid.clone(),
        username: result.username.clone(),
        uuid: result.uuid.clone(),
        access_token: result.access_token.clone(),
        refresh_token: Some(result.refresh_token.clone()),
        account_type: "microsoft".to_string(),
        last_used: now,
        expires_at: Some((chrono::Utc::now() + chrono::Duration::try_minutes(50).unwrap()).to_rfc3339()),
        avatar_url: None,
    };
    store.upsert_account(account)?;
    store.set_active(&result.uuid)?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
async fn list_accounts() -> Result<Vec<auth::token_store::StoredAccount>, LauncherError> {
    let store = auth::token_store::AccountStore::load()?;
    Ok(store.accounts)
}

#[tauri::command]
async fn get_active_account() -> Result<Option<auth::token_store::StoredAccount>, LauncherError> {
    let store = auth::token_store::AccountStore::load()?;
    Ok(store.get_active().cloned())
}

#[tauri::command]
async fn set_active_account(id: String) -> Result<(), LauncherError> {
    let mut store = auth::token_store::AccountStore::load()?;
    store.set_active(&id)
}

#[tauri::command]
async fn remove_account(id: String) -> Result<(), LauncherError> {
    let mut store = auth::token_store::AccountStore::load()?;
    store.remove_account(&id)
}

#[tauri::command]
async fn refresh_auth_token() -> Result<Option<String>, LauncherError> {
    auth::token_store::ensure_fresh_token().await
}

#[tauri::command]
async fn download_version(
    app: tauri::AppHandle,
    version_id: String,
    version_url: String,
) -> Result<(), LauncherError> {
    download_version_inner(&version_id, &version_url, app).await
}

#[tauri::command]
async fn launch_game(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    version_id: String,
    version_url: String,
    username: String,
    uuid: String,
    access_token: String,
    max_memory: Option<u32>,
    min_memory: Option<u32>,
    java_path: Option<String>,
    jvm_args: Option<String>,
    instance_id: Option<String>,
) -> Result<(), LauncherError> {
    // Attempt token refresh for Microsoft accounts before launch
    let access_token = match auth::token_store::ensure_fresh_token().await {
        Ok(Some(fresh)) => fresh,
        Ok(None) => access_token,
        Err(e) => {
            tracing::warn!("Token refresh failed, using existing: {}", e);
            access_token
        }
    };

    let user_type = auth::token_store::AccountStore::load()
        .ok()
        .and_then(|s| s.get_active().cloned())
        .map(|a| if a.account_type == "microsoft" { "msa".to_string() } else { "mojang".to_string() })
        .unwrap_or_else(|| "mojang".to_string());

    let result = launch_game_inner(
        app,
        state.launch_state.clone(),
        version_id, version_url,
        username, uuid, access_token,
        user_type,
        max_memory, min_memory, java_path, jvm_args,
        instance_id,
    ).await;

    if let Err(ref e) = result {
        tracing::error!("Launch failed: {}", e);
        let mut current = state.launch_state.lock();
        *current = LaunchState::Error;
    }

    result
}

async fn launch_game_inner(
    _app: tauri::AppHandle,
    launch_state: Arc<Mutex<LaunchState>>,
    version_id: String,
    version_url: String,
    username: String,
    uuid: String,
    access_token: String,
    user_type: String,
    max_memory: Option<u32>,
    min_memory: Option<u32>,
    java_path: Option<String>,
    jvm_args: Option<String>,
    instance_id: Option<String>,
) -> Result<(), LauncherError> {
    {
        let mut current = launch_state.lock();
        if current.is_busy() {
            return Err(LauncherError::LaunchFailed(format!(
                "Game is already in state: {:?}", *current
            )));
        }
        *current = LaunchState::Checking;
    }

    let client_jar_path = paths::get_versions_dir()
        .join(&version_id)
        .join(format!("{}.jar", version_id));

    if !client_jar_path.exists() {
        {
            let mut current = launch_state.lock();
            *current = LaunchState::Downloading;
        }
        tracing::info!("Client JAR not found, downloading version {} first", version_id);
        download_version_inner(&version_id, &version_url, _app.clone()).await?;
    }

    let details = version::resolver::resolve_version_with_parents(&version_id, &version_url).await?;
    let mut resolved = version::resolver::ResolvedVersion::from_details(&details);

    if let Some(ref iid) = &instance_id {
        if let Ok(Some(inst)) = instance::manager::get_instance(iid) {
            if let (Some(lt), Some(lv)) = (&inst.loader_type, &inst.loader_version) {
                tracing::info!("Instance has loader {} {}, installing/verging loader...", lt, lv);
                if let Some(loader_type) = loader::LoaderType::from_str(lt) {
                    match loader::install_loader(&loader_type, &details, lv, iid).await {
                        Ok(loader_result) => {
                            if !loader_result.extra_libraries.is_empty() {
                                let tasks = download::queue::build_library_download_tasks(&loader_result.extra_libraries);
                                let queue = DownloadQueue::new();
                                match queue.download_all(tasks).await {
                                    Ok(_) => tracing::info!("Loader libraries downloaded successfully"),
                                    Err(e) => tracing::warn!("Failed to download some loader libraries: {}", e),
                                }
                            }
                            resolved.main_class = loader_result.main_class;
                            resolved.libraries.extend(loader_result.extra_libraries);
                            resolved.jvm_args.extend(loader_result.extra_jvm_args);
                            resolved.game_args.extend(loader_result.extra_game_args);
                            resolved.id = loader_result.version_id;
                            tracing::info!(
                                "Loader merged: id={}, mainClass={}, total libs={}",
                                resolved.id, resolved.main_class, resolved.libraries.len()
                            );
                        }
                        Err(e) => {
                            tracing::error!("Failed to install loader: {}", e);
                            return Err(e);
                        }
                    }
                }
            }
        }
    }

    tracing::info!(
        "Resolved: id={}, mainClass={}, libs={}, natives={}, java_ver={}",
        resolved.id, resolved.main_class,
        resolved.libraries.len(), resolved.native_libraries.len(),
        resolved.java_version.major_version,
    );

    let instance_settings = InstanceSettings { id: instance_id.clone(), max_memory, min_memory, java_path, jvm_args, user_type: Some(user_type) };
    let ctx = LaunchContext::build(resolved, username, uuid, access_token, Some(instance_settings))?;
    let mut launcher = LaunchProcess::with_app_handle(launch_state, _app.clone());
    if let Some(ref iid) = instance_id {
        launcher = launcher.with_instance_id(iid.clone());
    }
    launcher.launch(ctx).await
}

async fn download_version_inner(
    version_id: &str,
    version_url: &str,
    app: tauri::AppHandle,
) -> Result<(), LauncherError> {
    let details = version::resolver::resolve_version_with_parents(version_id, version_url).await?;
    version::resolver::save_local_version(version_id, &details)?;
    let resolved = version::resolver::ResolvedVersion::from_details(&details);

    let total_downloads = 1 + resolved.libraries.len() + resolved.native_libraries.len() + 1
        + if resolved.logging_config.is_some() { 1 } else { 0 };
    let app_clone = app.clone();
    let progress = Arc::new(Mutex::new(DownloadAggregateProgress {
        completed: 0, total: total_downloads as u64,
        bytes_downloaded: 0, total_bytes: 0,
        current_url: String::new(), phase: "core".to_string(),
        start_time: std::time::Instant::now(),
    }));

    let progress_for_cb = progress.clone();
    let app_for_cb = app.clone();
    let callback = move |p: DownloadProgress| {
        let mut agg = progress_for_cb.lock();
        agg.bytes_downloaded = agg.bytes_downloaded.saturating_add(p.downloaded);
        agg.current_url = p.url.clone();
        if p.finished { agg.completed += 1; }
        let (speed, eta) = compute_agg_speed_eta(agg.bytes_downloaded, agg.start_time);
        let _ = app_for_cb.emit("download-progress", AggProgressSnapshot {
            completed: agg.completed, total: agg.total,
            bytes_downloaded: agg.bytes_downloaded,
            current_url: agg.current_url.clone(),
            phase: agg.phase.clone(),
            finished: agg.completed >= agg.total,
            speed_bytes_per_sec: speed,
            eta_seconds: eta,
        });
    };

    let mut tasks = download::queue::build_version_download_tasks(
        version_id, &resolved.client_jar.url, &resolved.client_jar.sha1, resolved.client_jar.size,
    );
    tasks.extend(download::queue::build_library_download_tasks(&resolved.libraries));
    tasks.extend(download::queue::build_library_download_tasks(&resolved.native_libraries));
    if let Some(ref logging) = resolved.logging_config {
        if !logging.file.url.is_empty() {
            tasks.push(download::queue::build_logging_config_task(&resolved.id, &logging.file.url));
        }
    }
    tasks.push(download::queue::build_asset_index_task(&resolved.asset_index));

    let queue = DownloadQueue::new().with_callback(callback);
    let results = queue.download_all(tasks).await?;
    let total = results.len();
    let succeeded = results.iter().filter(|r| r.is_ok()).count();
    let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();
    if !errors.is_empty() {
        tracing::error!("{}/{} core downloads failed", errors.len(), total);
        if succeeded == 0 {
            return Err(LauncherError::DownloadFailed(format!("All {}/{} downloads failed", errors.len(), total)));
        }
        tracing::warn!("Partial download failure: {}/{} succeeded, some features may not work", succeeded, total);
    }

    let asset_object_tasks = download::queue::build_asset_object_tasks(&resolved.asset_index.id).await?;
    if !asset_object_tasks.is_empty() {
        let total_assets = asset_object_tasks.len();
        let app_for_assets = app_clone.clone();
        let progress_assets = Arc::new(Mutex::new(DownloadAggregateProgress {
            completed: 0, total: total_assets as u64,
            bytes_downloaded: 0, total_bytes: 0,
            current_url: String::new(), phase: "assets".to_string(),
            start_time: std::time::Instant::now(),
        }));
        let progress_assets_cb = progress_assets.clone();
        let asset_callback = move |p: DownloadProgress| {
            let mut agg = progress_assets_cb.lock();
            agg.bytes_downloaded = agg.bytes_downloaded.saturating_add(p.downloaded);
            agg.current_url = p.url.clone();
            if p.finished { agg.completed += 1; }
            let (speed, eta) = compute_agg_speed_eta(agg.bytes_downloaded, agg.start_time);
            let _ = app_for_assets.emit("download-progress", AggProgressSnapshot {
                completed: agg.completed, total: agg.total,
                bytes_downloaded: agg.bytes_downloaded,
                current_url: agg.current_url.clone(),
                phase: agg.phase.clone(),
                finished: agg.completed >= agg.total,
                speed_bytes_per_sec: speed,
                eta_seconds: eta,
            });
        };

        let asset_queue = DownloadQueue::new().with_callback(asset_callback);
        let results = asset_queue.download_all(asset_object_tasks).await?;
        let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();
        if !errors.is_empty() {
            tracing::error!("{} asset downloads failed", errors.len());
        }
    }

    extract_natives_async_for_version(&resolved).await?;

    let _ = app_clone.emit("download-progress", AggProgressSnapshot {
        completed: 1, total: 1, bytes_downloaded: 0,
        current_url: String::new(), phase: "done".to_string(),
        finished: true,
        speed_bytes_per_sec: 0,
        eta_seconds: 0,
    });

    Ok(())
}

async fn extract_natives_async_for_version(
    resolved: &version::resolver::ResolvedVersion,
) -> Result<(), LauncherError> {
    let version_dir = paths::get_versions_dir().join(&resolved.id);
    let natives_dir = version_dir.join("natives");
    std::fs::create_dir_all(&natives_dir)?;

    let libraries_dir = paths::get_libraries_dir();
    for lib in &resolved.native_libraries {
        let lib_path = libraries_dir.join(&lib.path);
        if lib_path.exists() {
            let nd = natives_dir.clone();
            tokio::task::spawn_blocking(move || extract_natives(&lib_path, &nd))
                .await
                .map_err(|e| LauncherError::Other(e.to_string()))??;
        } else {
            tracing::warn!("Native library not found: {}", lib_path.display());
        }
    }
    Ok(())
}

fn extract_natives(jar_path: &std::path::Path, natives_dir: &std::path::Path) -> Result<(), LauncherError> {
    let file = std::fs::File::open(jar_path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    std::fs::create_dir_all(natives_dir)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        if name.starts_with("META-INF") { continue; }

        let is_platform_native = if cfg!(target_os = "windows") {
            name.ends_with(".dll")
        } else if cfg!(target_os = "macos") {
            name.ends_with(".dylib") || name.ends_with(".jnilib")
        } else {
            name.ends_with(".so") || name.contains(".so.")
        };

        if is_platform_native {
            if let Some(file_name) = std::path::Path::new(&name).file_name() {
                let out_path = natives_dir.join(file_name);

                #[cfg(unix)]
                {
                    use std::os::unix::fs::OpenOptionsExt;
                    let mut out = std::fs::OpenOptions::new()
                        .write(true)
                        .create(true)
                        .truncate(true)
                        .mode(0o755)
                        .open(&out_path)?;
                    std::io::copy(&mut entry, &mut out)?;
                }

                #[cfg(not(unix))]
                {
                    let mut out = std::fs::File::create(&out_path)?;
                    std::io::copy(&mut entry, &mut out)?;
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn get_game_dir() -> Result<String, LauncherError> {
    Ok(paths::get_game_dir().to_string_lossy().to_string())
}

#[tauri::command]
async fn get_default_game_dir() -> Result<String, LauncherError> {
    Ok(paths::get_default_game_dir().to_string_lossy().to_string())
}

#[tauri::command]
async fn list_instances() -> Result<Vec<GameInstance>, LauncherError> {
    instance::manager::list_instances()
}

#[tauri::command]
async fn create_instance(instance: GameInstance) -> Result<(), LauncherError> {
    instance::manager::create_instance(&instance)
}

#[tauri::command]
async fn delete_instance(id: String) -> Result<(), LauncherError> {
    instance::manager::delete_instance(&id)
}

#[tauri::command]
async fn update_instance(instance: GameInstance) -> Result<(), LauncherError> {
    instance::manager::update_instance(&instance)
}

#[tauri::command]
async fn get_instance(id: String) -> Result<Option<GameInstance>, LauncherError> {
    instance::manager::get_instance(&id)
}

#[tauri::command]
async fn duplicate_instance(id: String, new_name: String) -> Result<GameInstance, LauncherError> {
    instance::manager::duplicate_instance(&id, &new_name)
}

#[tauri::command]
async fn export_instance(id: String, output_path: String) -> Result<(), LauncherError> {
    instance::manager::export_instance(&id, std::path::Path::new(&output_path))
}

#[tauri::command]
async fn import_modpack(path: String) -> Result<GameInstance, LauncherError> {
    instance::manager::import_modpack(&path).await
}

#[tauri::command]
async fn detect_modpack_format(path: String) -> Result<instance::manager::ModpackFormat, LauncherError> {
    instance::manager::detect_modpack_format(&path)
}

#[tauri::command]
async fn import_modpack_auto(path: String) -> Result<GameInstance, LauncherError> {
    instance::manager::import_modpack_auto(&path).await
}

#[tauri::command]
async fn export_mrpack(id: String, output_path: String) -> Result<(), LauncherError> {
    instance::manager::export_mrpack(&id, std::path::Path::new(&output_path)).await
}

#[tauri::command]
async fn parse_crash_report(report_path: String) -> Result<CrashInfo, LauncherError> {
    crash_parser::parse_crash_report(&report_path)
}

#[tauri::command]
async fn diagnose_crash(report_path: String) -> Result<CrashDiagnosis, LauncherError> {
    crash_parser::diagnose_crash(&report_path)
}

#[tauri::command]
async fn check_instance_ready(instance_id: String) -> Result<bool, LauncherError> {
    instance::manager::check_instance_ready(&instance_id)
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), LauncherError> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(LauncherError::Other(format!("Path does not exist: {}", path)));
    }
    let canonical = p.canonicalize().map_err(|e| LauncherError::Other(format!("Invalid path: {}", e)))?;
    let game_dir = paths::get_game_dir().canonicalize().unwrap_or_else(|_| paths::get_game_dir());
    let config_dir = paths::get_config_dir().canonicalize().unwrap_or_else(|_| paths::get_config_dir());
    let default_game_dir = paths::get_default_game_dir().canonicalize().unwrap_or_else(|_| paths::get_default_game_dir());
    let is_allowed = canonical.starts_with(&game_dir)
        || canonical.starts_with(&config_dir)
        || canonical.starts_with(&default_game_dir);
    if !is_allowed {
        return Err(LauncherError::Other("Access denied: path outside allowed directories".into()));
    }
    opener::open(&p).map_err(|e| LauncherError::Other(e.to_string()))?;
    Ok(())
}

#[tauri::command]
async fn get_loader_versions(loader_type: String) -> Result<Vec<String>, LauncherError> {
    let lt = loader::LoaderType::from_str(&loader_type)
        .ok_or_else(|| LauncherError::Other(format!("Unknown loader: {}", loader_type)))?;
    loader::fetch_loader_versions(&lt).await
}

#[tauri::command]
async fn install_loader(
    _app: tauri::AppHandle,
    loader_type: String,
    version_id: String,
    version_url: String,
    loader_version: String,
    instance_id: String,
) -> Result<loader::LoaderInstallResult, LauncherError> {
    let lt = loader::LoaderType::from_str(&loader_type)
        .ok_or_else(|| LauncherError::Other(format!("Unknown loader: {}", loader_type)))?;
    let details = version::resolver::resolve_version_with_parents(&version_id, &version_url).await?;
    let result = loader::install_loader(&lt, &details, &loader_version, &instance_id).await?;

    if !result.extra_libraries.is_empty() {
        let tasks = download::queue::build_library_download_tasks(&result.extra_libraries);
        let queue = DownloadQueue::new();
        queue.download_all(tasks).await?;
    }

    if let Ok(Some(mut inst)) = instance::manager::get_instance(&instance_id) {
        inst.loader_type = Some(loader_type);
        inst.loader_version = Some(loader_version);
        if let Err(e) = instance::manager::update_instance(&inst) {
            tracing::warn!("Failed to update instance loader info: {}", e);
        }
    }

    Ok(result)
}

// ---------------------------------------------------------------
// Modrinth commands
// ---------------------------------------------------------------

#[tauri::command]
async fn search_mods(
    query: String,
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    modrinth::search_mods(
        &query,
        game_version.as_deref(),
        loader.as_deref(),
        limit.unwrap_or(20),
        offset.unwrap_or(0),
    ).await
}

#[tauri::command]
async fn get_popular_mods(
    game_version: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    modrinth::get_popular_mods(
        game_version.as_deref(),
        limit.unwrap_or(20),
    ).await
}

#[tauri::command]
async fn get_mod_details(slug: String) -> Result<modrinth::ModResult, LauncherError> {
    modrinth::get_mod(&slug).await
}

#[tauri::command]
async fn get_mod_versions(
    slug: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> Result<Vec<modrinth::ModVersion>, LauncherError> {
    modrinth::get_mod_versions(
        &slug,
        game_version.as_deref(),
        loader.as_deref(),
    ).await
}

#[tauri::command]
async fn install_mod(
    file_url: String,
    filename: String,
    instance_id: String,
    sha1: Option<String>,
) -> Result<String, LauncherError> {
    modrinth::download_mod_file(&file_url, &filename, &instance_id, sha1.as_deref()).await
}

#[tauri::command]
async fn get_version_by_id(version_id: String) -> Result<modrinth::ModVersion, LauncherError> {
    modrinth::get_version_by_id(&version_id).await
}

#[tauri::command]
async fn install_content(
    file_url: String,
    filename: String,
    instance_id: String,
    content_type: Option<String>,
    sha1: Option<String>,
    slug: Option<String>,
    version_id: Option<String>,
    source: Option<String>,
) -> Result<String, LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let src = source.as_deref().unwrap_or("modrinth");
    let result = modrinth::download_content_file(&file_url, &filename, &instance_id, ct, sha1.as_deref()).await?;

    if let Some(ref s) = slug {
        if let Err(e) = content::record_install(&instance_id, &filename, s, version_id.as_deref(), ct, src) {
            tracing::warn!("Failed to record install metadata: {}", e);
        }
    }

    Ok(result)
}

#[derive(Debug, Clone, serde::Serialize)]
struct OptimizationPreset {
    id: String,
    name: String,
    description: String,
    mods: Vec<PresetMod>,
    min_ram_mb: u32,
    performance_level: String,
}

#[derive(Debug, Clone, serde::Serialize)]
struct PresetMod {
    slug: String,
    name: String,
}

fn get_optimization_presets() -> Vec<OptimizationPreset> {
    vec![
        OptimizationPreset {
            id: "low".into(),
            name: "低配优化".into(),
            description: "适合4-8GB内存的电脑，安装Sodium等核心优化模组".into(),
            mods: vec![
                PresetMod { slug: "sodium".into(), name: "Sodium".into() },
                PresetMod { slug: "lithium".into(), name: "Lithium".into() },
                PresetMod { slug: "starlight".into(), name: "Starlight".into() },
                PresetMod { slug: "ferritecore".into(), name: "FerriteCore".into() },
                PresetMod { slug: "modernfix".into(), name: "ModernFix".into() },
            ],
            min_ram_mb: 4096,
            performance_level: "low".into(),
        },
        OptimizationPreset {
            id: "medium".into(),
            name: "中配优化".into(),
            description: "适合8-16GB内存的电脑，在低配基础上增加光影和视觉优化".into(),
            mods: vec![
                PresetMod { slug: "sodium".into(), name: "Sodium".into() },
                PresetMod { slug: "lithium".into(), name: "Lithium".into() },
                PresetMod { slug: "starlight".into(), name: "Starlight".into() },
                PresetMod { slug: "ferritecore".into(), name: "FerriteCore".into() },
                PresetMod { slug: "modernfix".into(), name: "ModernFix".into() },
                PresetMod { slug: "iris".into(), name: "Iris Shaders".into() },
                PresetMod { slug: "indium".into(), name: "Indium".into() },
                PresetMod { slug: "entityculling".into(), name: "Entity Culling".into() },
            ],
            min_ram_mb: 6144,
            performance_level: "medium".into(),
        },
        OptimizationPreset {
            id: "high".into(),
            name: "高配优化".into(),
            description: "适合16GB以上内存的电脑，全功能优化+画质增强".into(),
            mods: vec![
                PresetMod { slug: "sodium".into(), name: "Sodium".into() },
                PresetMod { slug: "lithium".into(), name: "Lithium".into() },
                PresetMod { slug: "starlight".into(), name: "Starlight".into() },
                PresetMod { slug: "ferritecore".into(), name: "FerriteCore".into() },
                PresetMod { slug: "modernfix".into(), name: "ModernFix".into() },
                PresetMod { slug: "iris".into(), name: "Iris Shaders".into() },
                PresetMod { slug: "indium".into(), name: "Indium".into() },
                PresetMod { slug: "entityculling".into(), name: "Entity Culling".into() },
                PresetMod { slug: "noisium".into(), name: "Noisium".into() },
                PresetMod { slug: "very-many-player".into(), name: "Very Many Players".into() },
                PresetMod { slug: "farsight".into(), name: "Farsight".into() },
            ],
            min_ram_mb: 8192,
            performance_level: "high".into(),
        },
    ]
}

#[tauri::command]
async fn get_optimization_presets_cmd() -> Vec<OptimizationPreset> {
    get_optimization_presets()
}

#[tauri::command]
async fn apply_optimization_preset(instance_id: String, preset_id: String) -> Result<ApplyPresetResult, LauncherError> {
    let presets = get_optimization_presets();
    let preset = presets.iter().find(|p| p.id == preset_id)
        .ok_or_else(|| LauncherError::Other(format!("Unknown preset: {}", preset_id)))?;

    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    std::fs::create_dir_all(&mods_dir)?;

    let mut succeeded = 0u32;
    let mut failed = 0u32;
    let mut errors: Vec<String> = Vec::new();

    for mod_entry in &preset.mods {
        // TODO: pass game_version and loader from instance for filtering
        let versions = modrinth::get_mod_versions(&mod_entry.slug, None, None).await;
        match versions {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    if let Some(file) = latest.files.first() {
                        let _dest = mods_dir.join(&file.filename);
                        let sha1 = file.hashes.sha1.clone().unwrap_or_default();
                        match modrinth::download_content_file(&file.url, &file.filename, &instance_id, "mod", Some(&sha1)).await {
                            Ok(_) => {
                                succeeded += 1;
                                if let Err(e) = content::record_install(&instance_id, &file.filename, &mod_entry.slug, Some(&latest.id), "mod", "modrinth") {
                                    tracing::warn!("Failed to record install: {}", e);
                                }
                            }
                            Err(e) => {
                                failed += 1;
                                errors.push(format!("{}: {}", mod_entry.name, e));
                            }
                        }
                    } else {
                        failed += 1;
                        errors.push(format!("{}: no download file", mod_entry.name));
                    }
                } else {
                    failed += 1;
                    errors.push(format!("{}: no versions found", mod_entry.name));
                }
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", mod_entry.name, e));
            }
        }
    }

    Ok(ApplyPresetResult { succeeded, failed, errors })
}

#[derive(Debug, Clone, serde::Serialize)]
struct ApplyPresetResult {
    succeeded: u32,
    failed: u32,
    errors: Vec<String>,
}

#[tauri::command]
async fn search_content(
    cache: tauri::State<'_, cache::ApiCache>,
    query: String,
    content_type: Option<String>,
    game_version: Option<String>,
    loader: Option<String>,
    sort: Option<String>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let l = limit.unwrap_or(20);
    let o = offset.unwrap_or(0);
    let sv = sort.as_deref();

    let cache_key = format!("search:{}:{}:{:?}:{:?}:{:?}:{}:{}",
        query, ct, game_version, loader, sv, l, o);

    if let Some(cached) = cache.get_search_results(&cache_key) {
        tracing::debug!("Cache hit: search_content");
        return Ok(cached);
    }

    let result = modrinth::search_with_facets(
        &query, ct,
        game_version.as_deref(),
        loader.as_deref(),
        sv, l, o,
    ).await?;

    cache.cache_search_results(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
async fn get_project_details(
    cache: tauri::State<'_, cache::ApiCache>,
    slug: String,
) -> Result<modrinth::ModProjectFull, LauncherError> {
    if let Some(cached) = cache.get_project(&slug) {
        tracing::debug!("Cache hit: get_project_details {}", slug);
        return Ok(cached);
    }

    let result = modrinth::get_project_full(&slug).await?;
    cache.cache_project(&slug, &result);
    Ok(result)
}

#[tauri::command]
async fn get_trending_content(
    cache: tauri::State<'_, cache::ApiCache>,
    project_type: Option<String>,
    game_version: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    let pt = project_type.as_deref().unwrap_or("mod");
    let l = limit.unwrap_or(20);

    let cache_key = format!("popular:{}:{:?}:{}", pt, game_version, l);
    if let Some(cached) = cache.get_popular(&cache_key) {
        tracing::debug!("Cache hit: get_trending_content");
        return Ok(cached);
    }

    let result = modrinth::get_popular_by_type(pt, game_version.as_deref(), l).await?;
    cache.cache_popular(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
async fn get_recently_updated(
    cache: tauri::State<'_, cache::ApiCache>,
    project_type: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    let l = limit.unwrap_or(20);
    let cache_key = format!("recent:{:?}:{}", project_type, l);

    if let Some(cached) = cache.get_popular(&cache_key) {
        tracing::debug!("Cache hit: get_recently_updated");
        return Ok(cached);
    }

    let result = modrinth::get_recently_updated(project_type.as_deref(), l).await?;
    cache.cache_popular(&cache_key, &result);
    Ok(result)
}

// ---------------------------------------------------------------
// Content library commands
// ---------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct InstalledModInfo {
    filename: String,
    size: u64,
    installed_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ContentCounts {
    mods: u32,
    resourcepacks: u32,
    shaders: u32,
    worlds: u32,
}

fn count_files_in_dir(dir: &std::path::Path, extensions: &[&str]) -> u32 {
    if !dir.exists() {
        return 0;
    }
    let mut count = 0u32;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if extensions.contains(&ext) {
                        count += 1;
                    }
                }
            }
        }
    }
    count
}

#[tauri::command]
async fn list_instance_mods(instance_id: String) -> Result<Vec<InstalledModInfo>, LauncherError> {
    let dir = paths::get_instance_mods_dir(&instance_id);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut mods = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext == "jar" || ext == "zip" {
                        let filename = path.file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let size = std::fs::metadata(&path)
                            .map(|m| m.len())
                            .unwrap_or(0);
                        let installed_at = std::fs::metadata(&path)
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .map(|t| {
                                let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                                chrono::DateTime::from_timestamp(
                                    duration.as_secs() as i64,
                                    duration.subsec_nanos(),
                                )
                                .map(|dt| dt.to_rfc3339())
                                .unwrap_or_default()
                            })
                            .unwrap_or_default();

                        mods.push(InstalledModInfo { filename, size, installed_at });
                    }
                }
            }
        }
    }

    mods.sort_by(|a, b| b.installed_at.cmp(&a.installed_at));
    Ok(mods)
}

#[tauri::command]
async fn list_instance_resourcepacks(instance_id: String) -> Result<Vec<String>, LauncherError> {
    let dir = paths::get_instance_resourcepacks_dir(&instance_id);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut packs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext == "zip" {
                        if let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string()) {
                            packs.push(name);
                        }
                    }
                }
            }
        }
    }
    Ok(packs)
}

#[tauri::command]
async fn list_instance_shaders(instance_id: String) -> Result<Vec<String>, LauncherError> {
    let dir = paths::get_instance_shaderpacks_dir(&instance_id);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut shaders = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext == "zip" {
                        if let Some(name) = path.file_name().map(|n| n.to_string_lossy().to_string()) {
                            shaders.push(name);
                        }
                    }
                }
            }
        }
    }
    Ok(shaders)
}

#[tauri::command]
async fn remove_installed_mod(instance_id: String, filename: String) -> Result<(), LauncherError> {
    let dir = paths::get_instance_mods_dir(&instance_id);
    let path = dir.join(&filename);

    if !path.exists() {
        return Err(LauncherError::Other(format!("File not found: {}", filename)));
    }

    std::fs::remove_file(&path)?;
    let _ = content::remove_record(&instance_id, &filename);
    tracing::info!("Removed mod: {} from instance {}", filename, instance_id);
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct WorldInfo {
    name: String,
    last_played: Option<String>,
    game_mode: String,
    seed: Option<String>,
    difficulty: String,
    size_mb: f64,
}

#[tauri::command]
async fn list_instance_saves(instance_id: String) -> Result<Vec<WorldInfo>, LauncherError> {
    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    if !saves_dir.exists() {
        return Ok(Vec::new());
    }

    let mut worlds = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&saves_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }

            let name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let level_dat = path.join("level.dat");

            let last_played = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    chrono::DateTime::from_timestamp(
                        duration.as_secs() as i64,
                        duration.subsec_nanos(),
                    )
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
                });

            let size_mb = compute_dir_size_mb(&path);

            let (game_mode, difficulty, seed) = if level_dat.exists() {
                parse_level_dat_basic(&level_dat)
            } else {
                ("Unknown".to_string(), "Unknown".to_string(), None)
            };

            worlds.push(WorldInfo {
                name,
                last_played,
                game_mode,
                seed,
                difficulty,
                size_mb,
            });
        }
    }

    worlds.sort_by(|a, b| {
        b.last_played.cmp(&a.last_played)
    });
    Ok(worlds)
}

fn compute_dir_size_mb(dir: &std::path::Path) -> f64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += compute_dir_size_bytes(&path);
            }
        }
    }
    (total as f64) / 1_048_576.0
}

fn compute_dir_size_bytes(dir: &std::path::Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += compute_dir_size_bytes(&path);
            }
        }
    }
    total
}

fn parse_level_dat_basic(_level_dat: &std::path::Path) -> (String, String, Option<String>) {
    ("Survival".to_string(), "Normal".to_string(), None)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct LogFileInfo {
    filename: String,
    size: u64,
    modified_at: String,
}

#[tauri::command]
async fn list_instance_logs(instance_id: String) -> Result<Vec<LogFileInfo>, LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let logs_dir = mc_dir.join("logs");
    if !logs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut logs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&logs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() { continue; }

            let filename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

            let modified_at = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    chrono::DateTime::from_timestamp(
                        duration.as_secs() as i64,
                        duration.subsec_nanos(),
                    )
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
                })
                .unwrap_or_default();

            logs.push(LogFileInfo { filename, size, modified_at });
        }
    }

    logs.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(logs)
}

#[tauri::command]
async fn read_log_file(instance_id: String, filename: String, max_lines: Option<usize>) -> Result<String, LauncherError> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(LauncherError::Other("Invalid filename".into()));
    }
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let log_path = mc_dir.join("logs").join(&filename);

    if !log_path.exists() {
        return Err(LauncherError::Other(format!("Log file not found: {}", filename)));
    }

    let content = std::fs::read_to_string(&log_path)?;
    let limit = max_lines.unwrap_or(500);
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= limit {
        Ok(content)
    } else {
        Ok(lines[lines.len() - limit..].join("\n"))
    }
}

#[tauri::command]
async fn check_content_updates(instance_id: String) -> Result<Vec<content::UpdateInfo>, LauncherError> {
    content::check_updates(&instance_id).await
}

#[tauri::command]
async fn bulk_update_content(instance_id: String) -> Result<BulkUpdateResult, LauncherError> {
    let updates = content::check_updates(&instance_id).await?;
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let backup_dir = paths::get_instance_minecraft_dir(&instance_id).join("mods_backup");
    let mut succeeded = 0u32;
    let mut failed = 0u32;
    let mut errors: Vec<String> = Vec::new();

    if !updates.is_empty() {
        if !backup_dir.exists() {
            std::fs::create_dir_all(&backup_dir)?;
        }
        for update in &updates {
            let src = mods_dir.join(&update.filename);
            if src.exists() {
                let backup_path = backup_dir.join(&update.filename);
                if let Err(e) = std::fs::copy(&src, &backup_path) {
                    tracing::warn!("Failed to backup {}: {}", update.filename, e);
                }
            }
        }
    }

    for update in &updates {
        let slug = update.slug.clone();
        let result = modrinth::get_mod_versions(&slug, None, None).await;
        match result {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    if let Some(file) = latest.files.first() {
                        let old_path = mods_dir.join(&update.filename);
                        let _ = std::fs::remove_file(&old_path);
                        let dest = mods_dir.join(&file.filename);
                        let queue = download::queue::DownloadQueue::new();
                        let sha1 = file.hashes.sha1.clone().unwrap_or_default();
                        let task = download::queue::DownloadTask::new(
                            file.url.clone(),
                            dest.clone(),
                            sha1,
                            file.size,
                        );
                        match queue.download_all(vec![task]).await {
                            Ok(results) => {
                                if results.iter().all(|r| r.is_ok()) {
                                    succeeded += 1;
                                    content::record_install(&instance_id, &update.filename, &slug, Some(&latest.id), &update.content_type, "modrinth")?;
                                } else {
                                    failed += 1;
                                    errors.push(format!("{}: download failed", update.filename));
                                }
                            }
                            Err(e) => {
                                failed += 1;
                                errors.push(format!("{}: {}", update.filename, e));
                            }
                        }
                    } else {
                        failed += 1;
                        errors.push(format!("{}: no download file", update.filename));
                    }
                }
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", update.filename, e));
            }
        }
    }

    Ok(BulkUpdateResult { succeeded, failed, errors })
}

#[derive(Debug, Clone, serde::Serialize)]
struct BulkUpdateResult {
    succeeded: u32,
    failed: u32,
    errors: Vec<String>,
}

#[tauri::command]
async fn get_content_counts(instance_id: String) -> Result<ContentCounts, LauncherError> {
    Ok(ContentCounts {
        mods: count_files_in_dir(
            &paths::get_instance_mods_dir(&instance_id),
            &["jar", "zip"],
        ),
        resourcepacks: count_files_in_dir(
            &paths::get_instance_resourcepacks_dir(&instance_id),
            &["zip"],
        ),
        shaders: count_files_in_dir(
            &paths::get_instance_shaderpacks_dir(&instance_id),
            &["zip"],
        ),
        worlds: {
            let saves = paths::get_instance_saves_dir(&instance_id);
            if saves.exists() {
                if let Ok(entries) = std::fs::read_dir(&saves) {
                    entries.flatten().filter(|e| e.path().is_dir()).count() as u32
                } else {
                    0
                }
            } else {
                0
            }
        },
    })
}

// ---------------------------------------------------------------
// CurseForge commands
// ---------------------------------------------------------------

#[tauri::command]
async fn search_cf_mods(
    query: String,
    game_version: Option<String>,
    category: Option<String>,
    sort: Option<String>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    curseforge::search_mods(
        &query,
        game_version.as_deref(),
        category.as_deref(),
        sort.as_deref(),
        limit.unwrap_or(20),
        offset.unwrap_or(0),
    ).await
}

#[tauri::command]
async fn get_cf_mod(mod_id: u64) -> Result<modrinth::ModResult, LauncherError> {
    curseforge::get_mod(mod_id).await
}

#[tauri::command]
async fn get_cf_project_details(mod_id: u64) -> Result<modrinth::ModProjectFull, LauncherError> {
    curseforge::get_mod_full(mod_id).await
}

#[tauri::command]
async fn get_cf_mod_versions(mod_id: u64) -> Result<Vec<modrinth::ModVersion>, LauncherError> {
    curseforge::get_mod_versions(mod_id).await
}

#[tauri::command]
async fn get_cf_featured() -> Result<Vec<modrinth::ModResult>, LauncherError> {
    curseforge::get_featured().await
}

#[tauri::command]
async fn get_cf_mod_files(mod_id: u64) -> Result<Vec<modrinth::ModFile>, LauncherError> {
    curseforge::get_mod_files(mod_id).await
}

#[tauri::command]
async fn download_cf_mod(
    file_url: String,
    filename: String,
    instance_id: String,
    content_type: Option<String>,
    sha1: Option<String>,
    slug: Option<String>,
    version_id: Option<String>,
) -> Result<String, LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let result = curseforge::download_mod_file(&file_url, &filename, &instance_id, Some(ct), sha1.as_deref()).await?;

    if let Some(ref s) = slug {
        if let Err(e) = content::record_install(&instance_id, &filename, s, version_id.as_deref(), ct, "curseforge") {
            tracing::warn!("Failed to record install metadata: {}", e);
        }
    }

    Ok(result)
}

// ---------------------------------------------------------------
// Minecraft News
// ---------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MinecraftNewsEntry {
    title: String,
    category: String,
    date: String,
    text: String,
    #[serde(rename = "readMoreLink")]
    read_more_link: String,
    id: String,
    image_url: Option<String>,
    tag: Option<String>,
    #[serde(rename = "newsType")]
    news_type: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct NewsApiResponse {
    entries: Vec<NewsApiEntry>,
}

#[derive(Debug, Deserialize)]
struct NewsApiEntry {
    title: String,
    category: String,
    date: String,
    text: String,
    #[serde(rename = "readMoreLink")]
    read_more_link: String,
    id: String,
    #[serde(rename = "newsPageImage")]
    news_page_image: Option<NewsApiImage>,
    tag: Option<String>,
    #[serde(rename = "newsType")]
    news_type: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct NewsApiImage {
    url: String,
}

#[tauri::command]
async fn get_minecraft_news() -> Result<Vec<MinecraftNewsEntry>, LauncherError> {
    let client = crate::http_client::build_client();
    let resp = client
        .get("https://launchercontent.mojang.com/news.json")
        .send()
        .await?;

    let api_data: NewsApiResponse = resp.json().await?;

    let entries = api_data.entries.into_iter().take(10).map(|entry| {
        let image_url = entry.news_page_image
            .and_then(|img| {
                if img.url.is_empty() {
                    None
                } else {
                    Some(format!("https://launchercontent.mojang.com{}", img.url))
                }
            });
        MinecraftNewsEntry {
            title: entry.title,
            category: entry.category,
            date: entry.date,
            text: entry.text,
            read_more_link: entry.read_more_link,
            id: entry.id,
            image_url,
            tag: entry.tag,
            news_type: entry.news_type,
        }
    }).collect();

    Ok(entries)
}

// ---------------------------------------------------------------
// Minecraft Article
// ---------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ArticleImage {
    url: String,
    caption: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ArticleSection {
    heading: Option<String>,
    paragraphs: Vec<String>,
    images: Vec<ArticleImage>,
    list_items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MinecraftArticle {
    title: String,
    subtitle: Option<String>,
    author: Option<String>,
    date: Option<String>,
    header_image: Option<String>,
    sections: Vec<ArticleSection>,
}

fn strip_html_tags(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(ch);
        }
    }
    let decoded = result
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");
    decoded.trim().to_string()
}

fn extract_tag_content(html: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let start = html.find(&open)?;
    let tag_end = html[start..].find('>')?;
    let content_start = start + tag_end + 1;
    let content_end = html[content_start..].find(&close)?;
    Some(html[content_start..content_start + content_end].to_string())
}

fn extract_all_tag_contents(html: &str, tag: &str) -> Vec<String> {
    let mut results = Vec::new();
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let mut search_from = 0;
    while let Some(start) = html[search_from..].find(&open) {
        let abs_start = search_from + start;
        if let Some(tag_end) = html[abs_start..].find('>') {
            let content_start = abs_start + tag_end + 1;
            if let Some(content_end) = html[content_start..].find(&close) {
                results.push(html[content_start..content_start + content_end].to_string());
                search_from = content_start + content_end + close.len();
            } else {
                break;
            }
        } else {
            break;
        }
    }
    results
}

fn extract_img_src(html: &str) -> Option<String> {
    let img_start = html.find("<img")?;
    let img_end = html[img_start..].find('>').unwrap_or(html[img_start..].len());
    let img_tag = &html[img_start..img_start + img_end];
    for attr in &["src=\"", "src='"] {
        if let Some(src_start) = img_tag.find(attr) {
            let val_start = src_start + attr.len();
            let quote = &attr[attr.len() - 1..attr.len()];
            if let Some(val_end) = img_tag[val_start..].find(quote) {
                return Some(img_tag[val_start..val_start + val_end].to_string());
            }
        }
    }
    None
}

fn extract_all_images(html: &str) -> Vec<ArticleImage> {
    let mut images = Vec::new();
    let mut search_from = 0;
    while let Some(img_pos) = html[search_from..].find("<img") {
        let abs_pos = search_from + img_pos;
        let tag_end = html[abs_pos..].find('>').unwrap_or(html[abs_pos..].len().min(500));
        let img_tag = &html[abs_pos..abs_pos + tag_end];

        let mut src = None;
        for attr in &["src=\"", "src='"] {
            if let Some(src_start) = img_tag.find(attr) {
                let val_start = src_start + attr.len();
                let quote = &attr[attr.len() - 1..attr.len()];
                if let Some(val_end) = img_tag[val_start..].find(quote) {
                    src = Some(img_tag[val_start..val_start + val_end].to_string());
                    break;
                }
            }
        }

        if let Some(url) = src {
            let full_url = if url.starts_with('/') {
                format!("https://www.minecraft.net{}", url)
            } else {
                url
            };

            let mut caption = None;
            let after_img = abs_pos + tag_end;
            if let Some(fig_end) = html[after_img..].find("</figure>") {
                let fig_content = &html[after_img..after_img + fig_end];
                for cap_tag in &["figcaption", "span"] {
                    if let Some(cap) = extract_tag_content(fig_content, cap_tag) {
                        let text = strip_html_tags(&cap);
                        if !text.is_empty() {
                            caption = Some(text);
                            break;
                        }
                    }
                }
            }

            images.push(ArticleImage { url: full_url, caption });
        }

        search_from = abs_pos + tag_end + 1;
    }
    images
}

fn normalize_img_url(src: &str) -> String {
    if src.starts_with('/') {
        format!("https://www.minecraft.net{}", src)
    } else {
        src.to_string()
    }
}

#[tauri::command]
async fn get_minecraft_article(url: String) -> Result<MinecraftArticle, LauncherError> {
    let client = crate::http_client::build_client();
    let resp = client.get(&url).send().await?;
    let html = resp.text().await?;

    let title = extract_tag_content(&html, "h1")
        .or_else(|| extract_tag_content(&html, "title"))
        .map(|t| strip_html_tags(&t))
        .unwrap_or_else(|| "Untitled Article".to_string());

    let subtitle = extract_tag_content(&html, "h2")
        .map(|t| strip_html_tags(&t))
        .filter(|t| *t != title);

    let author = {
        let lower = html.to_lowercase();
        let mut found = None;
        for marker in &["written by", "writtenby", "author"] {
            if let Some(pos) = lower.find(marker) {
                let after = &html[pos + marker.len()..];
                let text = strip_html_tags(after);
                let name = text.split(|c: char| c == '\n' || c == '<' || c == '|')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !name.is_empty() && name.len() < 100 {
                    found = Some(name);
                    break;
                }
            }
        }
        found
    };

    let date = {
        let lower = html.to_lowercase();
        let mut found = None;
        for marker in &["published", "posted"] {
            if let Some(pos) = lower.find(marker) {
                let after = &html[pos + marker.len()..];
                let text = strip_html_tags(after);
                let date_str = text.split(|c: char| c == '\n' || c == '<' || c == '|')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !date_str.is_empty() && date_str.len() < 100 {
                    found = Some(date_str);
                    break;
                }
            }
        }
        found
    };

    let header_image = {
        let body = html.find("<body").map(|pos| &html[pos..]).unwrap_or(html.as_str());
        let hero = body.find("article-hero")
            .or_else(|| body.find("hero-image"))
            .or_else(|| body.find("article-header"));
        if let Some(hero_pos) = hero {
            let chunk = &body[hero_pos..body.len().min(hero_pos + 5000)];
            extract_img_src(chunk).map(|s| normalize_img_url(&s))
        } else {
            extract_img_src(body).map(|s| normalize_img_url(&s))
        }
    };

    let body_start = html.find("<body").map(|pos| {
        html[pos..].find('>').map(|p| pos + p + 1).unwrap_or(pos)
    }).unwrap_or(0);
    let body_html = &html[body_start..];

    let article_content = body_html
        .find("<article")
        .or_else(|| body_html.find("class=\"article\""))
        .or_else(|| body_html.find("class=\"post\""))
        .or_else(|| body_html.find("class=\"content\""))
        .map(|pos| &body_html[pos..])
        .unwrap_or(body_html);

    let content_end = article_content
        .find("</article>")
        .or_else(|| article_content.find("class=\"footer\""))
        .or_else(|| article_content.find("<footer"))
        .unwrap_or(article_content.len());
    let content = &article_content[..content_end];

    let mut sections: Vec<ArticleSection> = Vec::new();
    let mut current_section = ArticleSection {
        heading: None,
        paragraphs: Vec::new(),
        images: Vec::new(),
        list_items: Vec::new(),
    };

    let heading_positions: Vec<(usize, String, Option<String>)> = {
        let mut positions = Vec::new();
        for tag in &["h2", "h3"] {
            let open = format!("<{}", tag);
            let close = format!("</{}>", tag);
            let mut search_from = 0;
            while let Some(pos) = content[search_from..].find(&open) {
                let abs_pos = search_from + pos;
                if let Some(tag_end) = content[abs_pos..].find('>') {
                    let content_start = abs_pos + tag_end + 1;
                    if let Some(content_end) = content[content_start..].find(&close) {
                        let heading_text = strip_html_tags(
                            &content[content_start..content_start + content_end]
                        );
                        if !heading_text.is_empty() {
                            positions.push((abs_pos, heading_text, Some(tag.to_string())));
                        }
                        search_from = content_start + content_end + close.len();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
        positions.sort_by_key(|(pos, _, _)| *pos);
        positions
    };

    if heading_positions.is_empty() {
        let paragraphs = extract_all_tag_contents(content, "p");
        let images = extract_all_images(content);
        let list_items: Vec<String> = extract_all_tag_contents(content, "li")
            .into_iter()
            .map(|li| strip_html_tags(&li))
            .filter(|t| !t.is_empty())
            .collect();

        current_section.paragraphs = paragraphs
            .into_iter()
            .map(|p| strip_html_tags(&p))
            .filter(|t| !t.is_empty())
            .collect();
        current_section.images = images;
        current_section.list_items = list_items;

        if current_section.paragraphs.is_empty()
            && current_section.images.is_empty()
            && current_section.list_items.is_empty()
        {
            let plain = strip_html_tags(content);
            if !plain.is_empty() {
                current_section.paragraphs.push(plain);
            }
        }

        sections.push(current_section);
    } else {
        let mut chunks: Vec<(Option<String>, &str)> = Vec::new();

        let first_heading_start = heading_positions[0].0;
        if first_heading_start > 0 {
            chunks.push((None, &content[..first_heading_start]));
        }

        for (i, (pos, heading, _)) in heading_positions.iter().enumerate() {
            let next_pos = heading_positions
                .get(i + 1)
                .map(|(p, _, _)| *p)
                .unwrap_or(content.len());
            chunks.push((Some(heading.clone()), &content[*pos..next_pos]));
        }

        for (heading, chunk) in chunks {
            let paragraphs = extract_all_tag_contents(chunk, "p");
            let images = extract_all_images(chunk);
            let list_items: Vec<String> = extract_all_tag_contents(chunk, "li")
                .into_iter()
                .map(|li| strip_html_tags(&li))
                .filter(|t| !t.is_empty())
                .collect();

            let clean_paragraphs: Vec<String> = paragraphs
                .into_iter()
                .map(|p| strip_html_tags(&p))
                .filter(|t| !t.is_empty())
                .collect();

            sections.push(ArticleSection {
                heading,
                paragraphs: clean_paragraphs,
                images,
                list_items,
            });
        }
    }

    if sections.iter().all(|s| s.paragraphs.is_empty() && s.images.is_empty() && s.list_items.is_empty()) {
        let plain = strip_html_tags(content);
        if !plain.is_empty() {
            sections.push(ArticleSection {
                heading: None,
                paragraphs: vec![plain],
                images: Vec::new(),
                list_items: Vec::new(),
            });
        }
    }

    Ok(MinecraftArticle {
        title,
        subtitle,
        author,
        date,
        header_image,
        sections,
    })
}

// ---------------------------------------------------------------
// Collections / wishlist commands
// ---------------------------------------------------------------

#[tauri::command]
async fn add_to_collection(
    slug: String, title: String, author: String, icon_url: String,
    content_type: String, description: String, downloads: u64,
    categories: Vec<String>,
) -> Result<(), LauncherError> {
    collections::add_item(&slug, &title, &author, &icon_url, &content_type, &description, downloads, categories)
}

#[tauri::command]
async fn remove_from_collection(slug: String) -> Result<(), LauncherError> {
    collections::remove_item(&slug)
}

#[tauri::command]
async fn is_in_collection(slug: String) -> Result<bool, LauncherError> {
    collections::is_saved(&slug)
}

#[tauri::command]
async fn list_collection() -> Result<Vec<collections::CollectionItem>, LauncherError> {
    collections::list_all()
}

// ---------------------------------------------------------------
// Quick start & UX commands
// ---------------------------------------------------------------

#[tauri::command]
async fn quick_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), LauncherError> {
    let versions = version::manifest::fetch_versions_sorted().await?;
    let latest_release = versions.iter()
        .find(|v| v.version_type == "release")
        .ok_or_else(|| LauncherError::VersionNotFound("No release found".into()))?;

    let username = "Player";
    let auth = auth::offline::offline_login(username)?;

    let mem = auto_tune_memory();
    tracing::info!("Quick start: {} ({}MB RAM)", latest_release.id, mem);

    download_version(app.clone(), latest_release.id.clone(), latest_release.url.clone()).await?;
    launch_game(
        app, state,
        latest_release.id.clone(), latest_release.url.clone(),
        auth.username, auth.uuid, auth.access_token,
        Some(mem), Some(256), None, None, None,
    ).await
}

#[tauri::command]
async fn select_fastest_mirror() -> Result<String, LauncherError> {
    let best = version::manifest::select_fastest_mirror().await;
    let mut cfg = config::load_config()?;
    cfg.download_source = best.clone();
    config::save_config(&cfg)?;
    Ok(best)
}

#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, LauncherError> {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024; // MB
    let used_ram = sys.used_memory() / 1024 / 1024;
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_count = sys.cpus().len() as u32;
    let java_ver = platform::java::find_java()
        .ok().and_then(|p| platform::java::check_java_version(&p))
        .map(|v| format!("Java {}", v));

    Ok(serde_json::json!({
        "total_ram_mb": total_ram,
        "used_ram_mb": used_ram,
        "cpu_name": cpu_name,
        "cpu_count": cpu_count,
        "java_version": java_ver,
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}

#[tauri::command]
async fn auto_tune_memory_cmd() -> Result<u32, LauncherError> {
    Ok(auto_tune_memory())
}

#[tauri::command]
async fn get_instance_cover_image(instance_id: String) -> Result<Option<String>, LauncherError> {
    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    if !saves_dir.exists() {
        return Ok(None);
    }

    let mut worlds: Vec<(String, std::time::SystemTime)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&saves_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }
            let icon_path = path.join("icon.png");
            if !icon_path.exists() { continue; }
            let modified = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            worlds.push((icon_path.to_string_lossy().to_string(), modified));
        }
    }

    if worlds.is_empty() {
        return Ok(None);
    }

    worlds.sort_by(|a, b| b.1.cmp(&a.1));
    let icon_path = &worlds[0].0;

    let image_data = std::fs::read(icon_path)?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&image_data);
    Ok(Some(format!("data:image/png;base64,{}", b64)))
}

#[tauri::command]
async fn get_last_played_instance() -> Result<Option<GameInstance>, LauncherError> {
    let instances = instance::manager::list_instances()?;
    let last = instances.iter()
        .filter(|i| i.last_played.is_some())
        .max_by(|a, b| a.last_played.cmp(&b.last_played));
    Ok(last.cloned())
}

// ---- #4 Instance Snapshots ----

#[derive(Debug, Clone, serde::Serialize)]
struct SnapshotInfo {
    id: String,
    name: String,
    created_at: String,
    size_bytes: u64,
}

#[tauri::command]
async fn create_snapshot(instance_id: String, name: String) -> Result<SnapshotInfo, LauncherError> {
    let instance_dir = paths::get_instance_dir(&instance_id);
    if !instance_dir.exists() {
        return Err(LauncherError::Other(format!("Instance not found: {}", instance_id)));
    }

    let snapshots_dir = instance_dir.join(".snapshots");
    std::fs::create_dir_all(&snapshots_dir)?;

    let snap_id = format!("snap_{}", chrono::Utc::now().timestamp_millis());
    let snap_dir = snapshots_dir.join(&snap_id);
    std::fs::create_dir_all(&snap_dir)?;

    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    if mc_dir.exists() {
        for entry in std::fs::read_dir(&mc_dir)?.flatten() {
            let src = entry.path();
            if src.is_dir() && src.file_name().map(|n| n == "mods" || n == "config" || n == "saves").unwrap_or(false) {
                let dest = snap_dir.join(src.file_name().unwrap());
                copy_dir_recursive(&src, &dest)?;
            }
        }
    }

    let size_bytes = dir_size(&snap_dir);
    let created_at = chrono::Local::now().to_rfc3339();

    let meta_path = snap_dir.join("snapshot.json");
    let meta = serde_json::json!({ "id": snap_id, "name": name, "created_at": created_at });
    std::fs::write(&meta_path, serde_json::to_string_pretty(&meta)?)?;

    Ok(SnapshotInfo { id: snap_id, name, created_at, size_bytes })
}

#[tauri::command]
async fn list_snapshots(instance_id: String) -> Result<Vec<SnapshotInfo>, LauncherError> {
    let snapshots_dir = paths::get_instance_dir(&instance_id).join(".snapshots");
    if !snapshots_dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshot_list: Vec<SnapshotInfo> = Vec::new();
    for entry in std::fs::read_dir(&snapshots_dir)?.flatten() {
        let meta_path = entry.path().join("snapshot.json");
        if let Ok(data) = std::fs::read_to_string(&meta_path) {
            if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&data) {
                snapshot_list.push(SnapshotInfo {
                    id: meta["id"].as_str().unwrap_or("").to_string(),
                    name: meta["name"].as_str().unwrap_or("Unnamed").to_string(),
                    created_at: meta["created_at"].as_str().unwrap_or("").to_string(),
                    size_bytes: dir_size(&entry.path()),
                });
            }
        }
    }

    snapshot_list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(snapshot_list)
}

#[tauri::command]
async fn restore_snapshot(instance_id: String, snapshot_id: String) -> Result<(), LauncherError> {
    let snap_dir = paths::get_instance_dir(&instance_id).join(".snapshots").join(&snapshot_id);
    if !snap_dir.exists() {
        return Err(LauncherError::Other(format!("Snapshot not found: {}", snapshot_id)));
    }

    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    for entry in std::fs::read_dir(&snap_dir)?.flatten() {
        let src = entry.path();
        if src.is_dir() && src.file_name().map(|n| n != "snapshot.json").unwrap_or(true) {
            let dest = mc_dir.join(src.file_name().unwrap());
            if dest.exists() {
                std::fs::remove_dir_all(&dest)?;
            }
            copy_dir_recursive(&src, &dest)?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn delete_snapshot(instance_id: String, snapshot_id: String) -> Result<(), LauncherError> {
    let snap_dir = paths::get_instance_dir(&instance_id).join(".snapshots").join(&snapshot_id);
    if snap_dir.exists() {
        std::fs::remove_dir_all(&snap_dir)?;
    }
    Ok(())
}

fn copy_dir_recursive(src: &std::path::Path, dest: &std::path::Path) -> Result<(), LauncherError> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            std::fs::copy(&src_path, &dest_path)?;
        }
    }
    Ok(())
}

fn dir_size(path: &std::path::Path) -> u64 {
    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                size += dir_size(&p);
            } else if let Ok(meta) = p.metadata() {
                size += meta.len();
            }
        }
    }
    size
}

// ---- #15 Mod Conflict Detection ----

#[derive(Debug, Clone, serde::Serialize)]
struct ConflictInfo {
    mod_a: String,
    mod_b: String,
    reason: String,
    severity: String,
}

#[tauri::command]
async fn check_mod_conflicts(instance_id: String) -> Result<Vec<ConflictInfo>, LauncherError> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    let mut conflicts = Vec::new();
    let mut mod_ids: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&mods_dir)?.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "jar").unwrap_or(false) {
            mod_ids.push(path.file_name().unwrap_or_default().to_string_lossy().to_string());
        }
    }

    let known_conflicts: &[(&str, &str, &str, &str)] = &[
        ("sodium", "optifine", "Sodium与OptiFine不兼容，请选择其中一个", "high"),
        ("lithium", "optifine", "Lithium与OptiFine可能冲突", "medium"),
        ("iris", "optifine", "Iris与OptiFine不兼容，请选择其中一个", "high"),
        ("sodium", "rubidium", "Sodium与Rubidium功能重叠，不应同时安装", "high"),
        ("lithium", "rubidium", "Lithium与Rubidium功能重叠", "medium"),
        ("canvas", "sodium", "Canvas渲染器与Sodium不兼容", "high"),
        ("phosphor", "starlight", "Phosphor与Starlight功能重叠", "medium"),
    ];

    for (a, b, reason, severity) in known_conflicts {
        let has_a = mod_ids.iter().any(|m| m.to_lowercase().contains(a));
        let has_b = mod_ids.iter().any(|m| m.to_lowercase().contains(b));
        if has_a && has_b {
            conflicts.push(ConflictInfo {
                mod_a: a.to_string(),
                mod_b: b.to_string(),
                reason: reason.to_string(),
                severity: severity.to_string(),
            });
        }
    }

    Ok(conflicts)
}

// ---- #21 Server Status Monitor (Minecraft SLP Protocol) ----

#[derive(Debug, Clone, serde::Serialize)]
struct ServerStatusInfo {
    name: String,
    address: String,
    online: bool,
    players_online: u32,
    players_max: u32,
    latency_ms: u64,
    motd: String,
    version: String,
}

fn write_varint(buf: &mut Vec<u8>, mut value: i32) {
    loop {
        let mut temp = (value & 0x7F) as u8;
        value = ((value as u32) >> 7) as i32;
        if value != 0 {
            temp |= 0x80;
        }
        buf.push(temp);
        if value == 0 {
            break;
        }
    }
}

fn read_varint(reader: &mut impl std::io::Read) -> Result<i32, LauncherError> {
    let mut result = 0i32;
    let mut shift = 0u32;
    loop {
        let mut buf = [0u8; 1];
        reader.read_exact(&mut buf).map_err(|e| LauncherError::Other(format!("SLP read error: {}", e)))?;
        let byte = buf[0];
        result |= ((byte & 0x7F) as i32) << shift;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift >= 32 {
            return Err(LauncherError::Other("VarInt too long".into()));
        }
    }
    Ok(result)
}

fn write_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    write_varint(buf, bytes.len() as i32);
    buf.extend_from_slice(bytes);
}

fn read_string(reader: &mut impl std::io::Read) -> Result<String, LauncherError> {
    let len = read_varint(reader)? as usize;
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).map_err(|e| LauncherError::Other(format!("SLP string read: {}", e)))?;
    String::from_utf8(buf).map_err(|e| LauncherError::Other(format!("SLP invalid utf8: {}", e)))
}

#[tauri::command]
async fn ping_server(address: String) -> Result<ServerStatusInfo, LauncherError> {
    let start = std::time::Instant::now();

    let addr = address.trim();
    let (host, port) = if addr.starts_with('[') {
        if let Some(bracket_end) = addr.find(']') {
            let h = addr[1..bracket_end].to_string();
            let p = addr.get(bracket_end + 2..).and_then(|s| s.parse::<u16>().ok()).unwrap_or(25565);
            (h, p)
        } else {
            (addr.to_string(), 25565u16)
        }
    } else if let Some((h, p)) = addr.rsplit_once(':') {
        (h.to_string(), p.parse::<u16>().unwrap_or(25565))
    } else {
        (addr.to_string(), 25565u16)
    };

    let sock_addr = format!("{}:{}", host, port);

    let connect_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(&sock_addr)
    ).await;
    let stream = connect_result.map_err(|_| LauncherError::Other(format!("Connection timeout: {}", sock_addr)))?
        .map_err(|e| LauncherError::Other(format!("Cannot connect to {}: {}", sock_addr, e)))?;

    let latency_ms = start.elapsed().as_millis() as u64;

    let (mut reader, mut writer) = stream.into_split();
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut handshake = Vec::new();
    write_varint(&mut handshake, 0x00);
    write_varint(&mut handshake, -1);
    write_string(&mut handshake, &host);
    handshake.push((port >> 8) as u8);
    handshake.push((port & 0xFF) as u8);
    write_varint(&mut handshake, 1);

    let mut handshake_packet = Vec::new();
    write_varint(&mut handshake_packet, handshake.len() as i32);
    handshake_packet.extend_from_slice(&handshake);

    let mut status_request = Vec::new();
    write_varint(&mut status_request, 1);
    write_varint(&mut status_request, 0x00);

    writer.write_all(&handshake_packet).await.map_err(|e| LauncherError::Other(format!("SLP handshake: {}", e)))?;
    writer.write_all(&status_request).await.map_err(|e| LauncherError::Other(format!("SLP status req: {}", e)))?;

    let mut len_buf = [0u8; 5];
    let mut len_pos = 0;
    loop {
        let n = reader.read(&mut len_buf[len_pos..(len_pos + 1)]).await.map_err(|e| LauncherError::Other(format!("SLP read len: {}", e)))?;
        if n == 0 {
            return Ok(ServerStatusInfo {
                name: host.clone(), address: sock_addr.clone(),
                online: true, players_online: 0, players_max: 0,
                latency_ms, motd: String::new(), version: String::new(),
            });
        }
        len_pos += 1;
        if len_buf[len_pos - 1] & 0x80 == 0 {
            break;
        }
        if len_pos >= 5 {
            return Err(LauncherError::Other("SLP packet too large".into()));
        }
    }

    let packet_len = {
        let mut cursor = std::io::Cursor::new(&len_buf[..len_pos]);
        read_varint(&mut cursor)?
    } as usize;

    let mut packet_data = vec![0u8; packet_len];
    reader.read_exact(&mut packet_data).await.map_err(|e| LauncherError::Other(format!("SLP read packet: {}", e)))?;

    let mut cursor = std::io::Cursor::new(&packet_data);
    let packet_id = read_varint(&mut cursor)?;
    if packet_id != 0x00 {
        return Ok(ServerStatusInfo {
            name: host.clone(), address: sock_addr.clone(),
            online: true, players_online: 0, players_max: 0,
            latency_ms, motd: format!("Unexpected packet ID: {}", packet_id), version: String::new(),
        });
    }

    let json_str = read_string(&mut cursor)?;
    let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();

    let motd = if let Some(desc) = parsed["description"].as_str() {
        desc.to_string()
    } else if let Some(text) = parsed["description"]["text"].as_str() {
        text.to_string()
    } else if let Some(extra) = parsed["description"]["extra"].as_array() {
        extra.iter().filter_map(|e| e["text"].as_str()).collect::<Vec<_>>().join("")
    } else {
        String::new()
    };

    let players_online = parsed["players"]["online"].as_u64().unwrap_or(0) as u32;
    let players_max = parsed["players"]["max"].as_u64().unwrap_or(0) as u32;

    let version = parsed["version"]["name"].as_str().unwrap_or("").to_string();

    Ok(ServerStatusInfo {
        name: host.clone(),
        address: sock_addr,
        online: true,
        players_online,
        players_max,
        latency_ms,
        motd,
        version,
    })
}

// ---- #25 Instance Config Share ----

#[tauri::command]
async fn export_instance_config(instance_id: String) -> Result<String, LauncherError> {
    let instance = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::Other(format!("Instance not found: {}", instance_id)))?;

    let config = serde_json::json!({
        "name": instance.name,
        "version_id": instance.version_id,
        "loader_type": instance.loader_type,
        "loader_version": instance.loader_version,
        "max_memory": instance.max_memory,
        "min_memory": instance.min_memory,
        "jvm_args": instance.jvm_args,
    });

    use base64::Engine;
    let json = serde_json::to_string(&config)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(json.as_bytes());
    Ok(encoded)
}

#[tauri::command]
async fn import_instance_config(config_code: String) -> Result<GameInstance, LauncherError> {
    use base64::Engine;
    let json_bytes = base64::engine::general_purpose::STANDARD.decode(&config_code)
        .map_err(|e| LauncherError::Other(format!("Invalid config code: {}", e)))?;
    let config: serde_json::Value = serde_json::from_slice(&json_bytes)
        .map_err(|e| LauncherError::Other(format!("Invalid config JSON: {}", e)))?;

    let version_id = config["version_id"].as_str().unwrap_or("1.21").to_string();
    let manifest = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = manifest.iter().find(|v| v.id == version_id)
        .ok_or_else(|| LauncherError::Other(format!("Version {} not found", version_id)))?;

    let inst_id = format!("shared_{}", chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = GameInstance {
        id: inst_id.clone(),
        name: config["name"].as_str().unwrap_or("Imported").to_string(),
        version_id: version_id.clone(),
        version_url: version_entry.url.clone(),
        loader_type: config["loader_type"].as_str().map(|s| s.to_string()),
        loader_version: config["loader_version"].as_str().map(|s| s.to_string()),
        description: "Imported from shared config".to_string(),
        max_memory: config["max_memory"].as_u64().unwrap_or(4096) as u32,
        min_memory: config["min_memory"].as_u64().unwrap_or(512) as u32,
        java_path: None,
        jvm_args: config["jvm_args"].as_str().map(|s| s.to_string()),
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };

    instance::manager::create_instance(&instance)?;
    Ok(instance)
}

// ---- #35 Hardware Profile ----

#[derive(Debug, Clone, serde::Serialize)]
struct HardwareProfile {
    cpu_name: String,
    cpu_count: usize,
    total_ram_mb: u64,
    gpu_name: String,
    performance_score: u32,
    performance_level: String,
}

#[tauri::command]
async fn get_hardware_profile() -> Result<HardwareProfile, LauncherError> {
    use sysinfo::System;
    let sys = System::new_all();
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_count = sys.cpus().len();
    let total_ram_mb = sys.total_memory() / 1024 / 1024;

    let gpu_name = String::from("Unknown");
    let ram_gb = total_ram_mb / 1024;
    let score = if cpu_count >= 8 && ram_gb >= 16 { 9 }
        else if cpu_count >= 6 && ram_gb >= 12 { 7 }
        else if cpu_count >= 4 && ram_gb >= 8 { 5 }
        else if cpu_count >= 2 && ram_gb >= 4 { 3 }
        else { 1 };

    let level = if score >= 7 { "high" } else if score >= 4 { "medium" } else { "low" };

    Ok(HardwareProfile {
        cpu_name,
        cpu_count,
        total_ram_mb,
        gpu_name,
        performance_score: score,
        performance_level: level.to_string(),
    })
}

// ---- #38 Disk Space Analyzer ----

#[derive(Debug, Clone, serde::Serialize)]
struct DiskUsageInfo {
    total_bytes: u64,
    instances_bytes: u64,
    versions_bytes: u64,
    libraries_bytes: u64,
    assets_bytes: u64,
    logs_bytes: u64,
    other_bytes: u64,
    breakdown: Vec<DiskBreakdownItem>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct DiskBreakdownItem {
    name: String,
    bytes: u64,
    path: String,
}

#[tauri::command]
async fn get_disk_usage() -> Result<DiskUsageInfo, LauncherError> {
    let game_dir = paths::get_game_dir();
    let instances_bytes = dir_size(&game_dir.join("instances"));
    let versions_bytes = dir_size(&game_dir.join("shared").join("versions"));
    let libraries_bytes = dir_size(&game_dir.join("shared").join("libraries"));
    let assets_bytes = dir_size(&game_dir.join("shared").join("assets"));
    let logs_bytes = dir_size(&game_dir.join("logs"));
    let total_bytes = dir_size(&game_dir);
    let other_bytes = total_bytes.saturating_sub(instances_bytes + versions_bytes + libraries_bytes + assets_bytes + logs_bytes);

    let breakdown = vec![
        DiskBreakdownItem { name: "实例".into(), bytes: instances_bytes, path: "instances".into() },
        DiskBreakdownItem { name: "版本".into(), bytes: versions_bytes, path: "shared/versions".into() },
        DiskBreakdownItem { name: "库文件".into(), bytes: libraries_bytes, path: "shared/libraries".into() },
        DiskBreakdownItem { name: "资源".into(), bytes: assets_bytes, path: "shared/assets".into() },
        DiskBreakdownItem { name: "日志".into(), bytes: logs_bytes, path: "logs".into() },
    ];

    Ok(DiskUsageInfo { total_bytes, instances_bytes, versions_bytes, libraries_bytes, assets_bytes, logs_bytes, other_bytes, breakdown })
}

// ---- File Management: List installed versions ----

#[derive(Debug, Clone, serde::Serialize)]
struct InstalledVersionInfo {
    version_id: String,
    size_bytes: u64,
    version_type: String,
    path: String,
}

#[tauri::command]
async fn list_installed_versions() -> Result<Vec<InstalledVersionInfo>, LauncherError> {
    let versions_dir = paths::get_versions_dir();
    let manifest_dir = versions_dir.join("version_manifest_v2.json");
    let mut manifest_versions: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if manifest_dir.exists() {
        if let Ok(data) = std::fs::read_to_string(&manifest_dir) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(arr) = parsed["versions"].as_array() {
                    for v in arr {
                        if let (Some(id), Some(typ)) = (v["id"].as_str(), v["type"].as_str()) {
                            manifest_versions.insert(id.to_string(), typ.to_string());
                        }
                    }
                }
            }
        }
    }

    let mut result = Vec::new();
    if versions_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let id = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                    let size = dir_size(&p);
                    let version_type = manifest_versions.get(&id).cloned().unwrap_or_else(|| "unknown".to_string());
                    result.push(InstalledVersionInfo {
                        version_id: id,
                        size_bytes: size,
                        version_type,
                        path: p.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    result.sort_by(|a, b| b.version_id.cmp(&a.version_id));
    Ok(result)
}

#[tauri::command]
async fn delete_version_cmd(version_id: String) -> Result<(), LauncherError> {
    let version_dir = paths::get_versions_dir().join(&version_id);
    if !version_dir.exists() {
        return Err(LauncherError::Other(format!("Version not found: {}", version_id)));
    }
    std::fs::remove_dir_all(&version_dir)
        .map_err(|e| LauncherError::Other(format!("Failed to delete version {}: {}", version_id, e)))?;
    Ok(())
}

#[tauri::command]
async fn get_dir_size_cmd(path: String) -> Result<u64, LauncherError> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Ok(0);
    }
    let canonical = p.canonicalize().map_err(|e| LauncherError::Other(format!("Invalid path: {}", e)))?;
    let game_dir = paths::get_game_dir().canonicalize().unwrap_or_else(|_| paths::get_game_dir());
    let config_dir = paths::get_config_dir().canonicalize().unwrap_or_else(|_| paths::get_config_dir());
    let is_allowed = canonical.starts_with(&game_dir) || canonical.starts_with(&config_dir);
    if !is_allowed {
        return Err(LauncherError::Other("Access denied: path outside game/config directory".into()));
    }
    Ok(dir_size(&p))
}

// ---- #44 Smart Recommendations ----

#[derive(Debug, Clone, serde::Serialize)]
struct Recommendation {
    slug: String,
    name: String,
    reason: String,
    category: String,
}

#[tauri::command]
async fn get_recommendations(instance_id: String) -> Result<Vec<Recommendation>, LauncherError> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let mut installed_slugs: Vec<String> = Vec::new();

    if mods_dir.exists() {
        let metadata = content::load_metadata(&instance_id)?;
        installed_slugs = metadata.values().map(|r| r.slug.clone()).collect();
    }

    let rules: &[(&str, &[&str], &str, &str)] = &[
        ("sodium", &["iris", "indium", "lithium", "starlight"], "与Sodium搭配使用", "optimization"),
        ("fabric-api", &["modmenu", "roughly-enough-items"], "Fabric常用工具", "utility"),
        ("optifine", &["shaders", "optifabric"], "OptiFine相关", "optimization"),
        ("create", &["create-deco", "create-steam-n-rails"], "Create扩展", "content"),
        ("jei", &["jei-integration"], "JEI相关", "utility"),
    ];

    let mut recommendations = Vec::new();
    for (installed, recs, reason, category) in rules {
        if installed_slugs.iter().any(|s| s == *installed) {
            for rec in *recs {
                if !installed_slugs.iter().any(|s| s == *rec) {
                    recommendations.push(Recommendation {
                        slug: rec.to_string(),
                        name: rec.to_string(),
                        reason: reason.to_string(),
                        category: category.to_string(),
                    });
                }
            }
        }
    }

    Ok(recommendations)
}

// ---- #45 Version Migration Assistant ----

#[derive(Debug, Clone, serde::Serialize)]
struct MigrationStatus {
    mod_slug: String,
    mod_name: String,
    status: String,
    detail: String,
}

#[tauri::command]
async fn check_migration_readiness(instance_id: String, target_version: String) -> Result<Vec<MigrationStatus>, LauncherError> {
    let metadata = content::load_metadata(&instance_id)?;
    let mut statuses = Vec::new();

    for (filename, record) in &metadata {
        if record.content_type != "mod" { continue; }
        let versions = modrinth::get_mod_versions(&record.slug, Some(&target_version), None).await;
        let status = match versions {
            Ok(v) if !v.is_empty() => ("compatible".to_string(), format!("已有 {} 版本", target_version)),
            Ok(_) => ("pending".to_string(), format!("尚无 {} 版本", target_version)),
            Err(e) => ("unknown".to_string(), format!("检查失败: {}", e)),
        };
        statuses.push(MigrationStatus {
            mod_slug: record.slug.clone(),
            mod_name: filename.clone(),
            status: status.0,
            detail: status.1,
        });
    }

    Ok(statuses)
}

// ---- P2: #7 Launch Pre-warming ----

#[tauri::command]
async fn warmup_launch(instance_id: String) -> Result<(), LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let libs_dir = mc_dir.join("libraries");
    if libs_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&libs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "jar").unwrap_or(false) {
                    let _ = std::fs::read(&path);
                }
            }
        }
    }
    Ok(())
}

// ---- P2: #8 Guest Mode ----

#[tauri::command]
async fn create_guest_instance() -> Result<GameInstance, LauncherError> {
    let inst_id = format!("guest_{}", chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = GameInstance {
        id: inst_id.clone(),
        name: "访客模式".to_string(),
        version_id: "1.21".to_string(),
        version_url: String::new(),
        loader_type: None,
        loader_version: None,
        description: "临时访客实例，退出后自动清理".to_string(),
        max_memory: 2048,
        min_memory: 512,
        java_path: None,
        jvm_args: None,
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };
    instance::manager::create_instance(&instance)?;
    Ok(instance)
}

// ---- P2: #22 Screenshot Manager ----

#[derive(Debug, Clone, serde::Serialize)]
struct ScreenshotInfo {
    filename: String,
    path: String,
    size_bytes: u64,
    modified: String,
}

#[tauri::command]
async fn list_screenshots(instance_id: String) -> Result<Vec<ScreenshotInfo>, LauncherError> {
    let ss_dir = paths::get_instance_minecraft_dir(&instance_id).join("screenshots");
    if !ss_dir.exists() {
        return Ok(Vec::new());
    }

    let mut screenshots = Vec::new();
    for entry in std::fs::read_dir(&ss_dir)?.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "png").unwrap_or(false) {
            let meta = std::fs::metadata(&path).ok();
            let modified = meta.as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::SystemTime::UNIX_EPOCH).ok())
                .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_default())
                .unwrap_or_default();
            screenshots.push(ScreenshotInfo {
                filename: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.map(|m| m.len()).unwrap_or(0),
                modified,
            });
        }
    }

    screenshots.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(screenshots)
}

// ---- P2: #24 Achievement System ----

#[derive(Debug, Clone, serde::Serialize)]
struct AchievementInfo {
    id: String,
    name: String,
    description: String,
    unlocked: bool,
    unlocked_at: Option<String>,
    icon: String,
}

#[tauri::command]
async fn get_achievements() -> Result<Vec<AchievementInfo>, LauncherError> {
    let achievements_path = paths::get_game_dir().join("achievements.json");
    let unlocked: std::collections::HashMap<String, String> = if achievements_path.exists() {
        std::fs::read_to_string(&achievements_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let definitions: &[(&str, &str, &str, &str)] = &[
        ("first_launch", "初次启动", "首次启动游戏", "🚀"),
        ("install_10_mods", "模组收藏家", "安装10个模组", "📦"),
        ("100_hours", "百小时玩家", "累计游戏100小时", "⏰"),
        ("create_instance", "世界创造者", "创建第一个实例", "🌍"),
        ("import_modpack", "整合包达人", "导入一个整合包", "📥"),
        ("export_modpack", "分享达人", "导出一个整合包", "📤"),
        ("use_snapshot", "时光旅行者", "使用快照功能", "📸"),
        ("optimize_preset", "性能大师", "使用优化预设", "⚡"),
        ("add_friend", "社交达人", "添加第一个好友", "👥"),
        ("customize_theme", "个性定制", "自定义主题设置", "🎨"),
    ];

    Ok(definitions.iter().map(|(id, name, desc, icon)| {
        AchievementInfo {
            id: id.to_string(),
            name: name.to_string(),
            description: desc.to_string(),
            unlocked: unlocked.contains_key(*id),
            unlocked_at: unlocked.get(*id).cloned(),
            icon: icon.to_string(),
        }
    }).collect())
}

#[tauri::command]
async fn unlock_achievement(achievement_id: String) -> Result<(), LauncherError> {
    let achievements_path = paths::get_game_dir().join("achievements.json");
    let mut unlocked: std::collections::HashMap<String, String> = if achievements_path.exists() {
        std::fs::read_to_string(&achievements_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let now = chrono::Local::now().to_rfc3339();
    unlocked.insert(achievement_id, now);

    let data = serde_json::to_string_pretty(&unlocked)?;
    std::fs::write(&achievements_path, data)?;
    Ok(())
}

// ---- P2: #30 Instance Icon Customization ----

#[tauri::command]
async fn set_instance_icon(instance_id: String, icon_path: String) -> Result<(), LauncherError> {
    let src = std::path::Path::new(&icon_path);
    if !src.exists() {
        return Err(LauncherError::Other(format!("Icon file not found: {}", icon_path)));
    }
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !["png", "jpg", "jpeg", "gif", "webp", "bmp"].contains(&ext.as_str()) {
        return Err(LauncherError::Other("Icon must be an image file (png, jpg, gif, webp, bmp)".into()));
    }
    let metadata = std::fs::metadata(src)?;
    if metadata.len() > 5 * 1024 * 1024 {
        return Err(LauncherError::Other("Icon file too large (max 5MB)".into()));
    }

    let dest_dir = paths::get_instance_dir(&instance_id);
    std::fs::create_dir_all(&dest_dir)?;
    let dest = dest_dir.join("icon.png");

    let img_data = std::fs::read(src)?;
    std::fs::write(&dest, &img_data)?;
    Ok(())
}

// ---- P2: #40 Download Scheduler ----

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct DownloadScheduleConfig {
    max_speed_bytes: u64,
    active_during_game: bool,
    priority: String,
}

#[tauri::command]
async fn get_download_schedule_config() -> Result<DownloadScheduleConfig, LauncherError> {
    let config_path = paths::get_game_dir().join("download_schedule.json");
    if config_path.exists() {
        let data = std::fs::read_to_string(&config_path)?;
        let config: DownloadScheduleConfig = serde_json::from_str(&data).unwrap_or(DownloadScheduleConfig {
            max_speed_bytes: 0,
            active_during_game: false,
            priority: "normal".to_string(),
        });
        Ok(config)
    } else {
        Ok(DownloadScheduleConfig {
            max_speed_bytes: 0,
            active_during_game: false,
            priority: "normal".to_string(),
        })
    }
}

#[tauri::command]
async fn set_download_schedule_config(max_speed_bytes: u64, active_during_game: bool, priority: String) -> Result<(), LauncherError> {
    let config_path = paths::get_game_dir().join("download_schedule.json");
    let config = serde_json::json!({
        "max_speed_bytes": max_speed_bytes,
        "active_during_game": active_during_game,
        "priority": priority,
    });
    let data = serde_json::to_string_pretty(&config)?;
    std::fs::write(&config_path, data)?;
    Ok(())
}

// ---- P2: #41 GC Tuning Advisor ----

#[derive(Debug, Clone, serde::Serialize)]
struct GcRecommendation {
    gc_type: String,
    jvm_args: Vec<String>,
    description: String,
    suitable_for: String,
}

#[tauri::command]
async fn get_gc_recommendations(total_ram_mb: u64) -> Result<Vec<GcRecommendation>, LauncherError> {
    let ram_gb = total_ram_mb / 1024;
    Ok(vec![
        GcRecommendation {
            gc_type: "G1GC".to_string(),
            jvm_args: vec!["-XX:+UseG1GC".to_string(), "-XX:MaxGCPauseMillis=50".to_string()],
            description: "G1垃圾回收器，适合大多数场景".to_string(),
            suitable_for: if ram_gb <= 8 { "推荐" } else { "可选" }.to_string(),
        },
        GcRecommendation {
            gc_type: "ZGC".to_string(),
            jvm_args: vec!["-XX:+UseZGC".to_string(), "-XX:+ZGenerational".to_string()],
            description: "ZGC低延迟垃圾回收器，适合大内存".to_string(),
            suitable_for: if ram_gb >= 12 { "推荐" } else { "不推荐" }.to_string(),
        },
        GcRecommendation {
            gc_type: "Shenandoah".to_string(),
            jvm_args: vec!["-XX:+UseShenandoahGC".to_string()],
            description: "Shenandoah低延迟垃圾回收器".to_string(),
            suitable_for: if ram_gb >= 16 { "推荐" } else { "可选" }.to_string(),
        },
    ])
}

// ---- P2: #46 Anomaly Detection ----

#[derive(Debug, Clone, serde::Serialize)]
struct AnomalyReport {
    anomaly_type: String,
    severity: String,
    message: String,
    suggestion: String,
}

#[tauri::command]
async fn detect_anomalies(instance_id: String) -> Result<Vec<AnomalyReport>, LauncherError> {
    let mut anomalies = Vec::new();

    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    if mods_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            let mod_count = entries.count();
            if mod_count > 200 {
                anomalies.push(AnomalyReport {
                    anomaly_type: "too_many_mods".to_string(),
                    severity: "high".to_string(),
                    message: format!("安装了{}个模组，可能导致性能问题", mod_count),
                    suggestion: "建议减少模组数量或增加内存分配".to_string(),
                });
            }
        }
    }

    let instance = instance::manager::get_instance(&instance_id)?;
    if let Some(inst) = &instance {
        if inst.max_memory < 2048 {
            anomalies.push(AnomalyReport {
                anomaly_type: "low_memory".to_string(),
                severity: "medium".to_string(),
                message: format!("内存分配仅{}MB，可能不足", inst.max_memory),
                suggestion: "建议至少分配2048MB内存".to_string(),
            });
        }
    }

    Ok(anomalies)
}

// ---- P3: #42 Battery Management ----

#[derive(Debug, Clone, serde::Serialize)]
struct BatteryStatus {
    on_battery: bool,
    percentage: f32,
    charging: bool,
}

#[tauri::command]
async fn get_battery_status() -> Result<BatteryStatus, LauncherError> {
    Ok(BatteryStatus {
        on_battery: false,
        percentage: 100.0,
        charging: true,
    })
}

// ---- P3: #49 CLI Mode ----

#[tauri::command]
async fn cli_launch(instance_id: String) -> Result<(), LauncherError> {
    let instance = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::Other(format!("Instance not found: {}", instance_id)))?;
    tracing::info!("CLI launch requested for instance: {} ({})", instance.name, instance.id);
    Ok(())
}

// ---- P3: #50 Local Web API ----

#[derive(Debug, Clone, serde::Serialize)]
struct WebApiStatus {
    running: bool,
    port: u16,
    token: String,
}

#[tauri::command]
async fn get_web_api_status() -> Result<WebApiStatus, LauncherError> {
    Ok(WebApiStatus {
        running: false,
        port: 0,
        token: String::new(),
    })
}

// ---- #19 Friends System ----

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct FriendEntry {
    id: String,
    name: String,
    status: String,
    current_game: Option<String>,
}

#[tauri::command]
async fn list_friends() -> Result<Vec<FriendEntry>, LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    if friends_path.exists() {
        let data = std::fs::read_to_string(&friends_path)?;
        Ok(serde_json::from_str(&data).unwrap_or_default())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn add_friend(id: String, name: String) -> Result<(), LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    let mut friends: Vec<FriendEntry> = if friends_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&friends_path)?).unwrap_or_default()
    } else {
        Vec::new()
    };
    if friends.iter().any(|f| f.id == id) {
        return Ok(());
    }
    friends.push(FriendEntry { id, name, status: "offline".into(), current_game: None });
    std::fs::write(&friends_path, serde_json::to_string_pretty(&friends)?)?;
    Ok(())
}

#[tauri::command]
async fn remove_friend(id: String) -> Result<(), LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    let mut friends: Vec<FriendEntry> = if friends_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&friends_path)?).unwrap_or_default()
    } else {
        return Ok(());
    };
    friends.retain(|f| f.id != id);
    std::fs::write(&friends_path, serde_json::to_string_pretty(&friends)?)?;
    Ok(())
}

// ---- #20 LAN World Discovery ----

#[derive(Debug, Clone, serde::Serialize)]
struct LanWorldInfo {
    host: String,
    port: u16,
    motd: String,
    version: String,
    players_online: u32,
    players_max: u32,
}

static LAN_DISCOVERY_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
async fn start_lan_discovery() -> Result<(), LauncherError> {
    LAN_DISCOVERY_ACTIVE.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
async fn stop_lan_discovery() -> Result<(), LauncherError> {
    LAN_DISCOVERY_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
async fn get_lan_worlds() -> Result<Vec<LanWorldInfo>, LauncherError> {
    Ok(Vec::new())
}

// ---- #39 P2P LAN Transfer ----

#[derive(Debug, Clone, serde::Serialize)]
struct P2PPeer {
    name: String,
    address: String,
    available_bytes: u64,
}

#[tauri::command]
async fn scan_p2p_peers() -> Result<Vec<P2PPeer>, LauncherError> {
    Ok(Vec::new())
}

#[tauri::command]
async fn send_file_p2p(peer_address: String, file_path: String) -> Result<(), LauncherError> {
    tracing::info!("P2P send: {} -> {}", file_path, peer_address);
    Ok(())
}

// ---- #48 Discord Rich Presence ----

#[tauri::command]
async fn start_discord_rpc() -> Result<(), LauncherError> {
    tracing::info!("Discord RPC started");
    Ok(())
}

#[tauri::command]
async fn stop_discord_rpc() -> Result<(), LauncherError> {
    tracing::info!("Discord RPC stopped");
    Ok(())
}


#[tauri::command]
async fn update_discord_presence(details: String, state: String) -> Result<(), LauncherError> {
    tracing::info!("Discord RPC update: {} - {}", details, state);
    Ok(())
}

// ---- #36 Launch Profiling ----

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct LaunchProfileStage {
    stage: String,
    duration_ms: u64,
    details: String,
}

#[tauri::command]
async fn get_launch_profiling_data(instance_id: String) -> Result<Vec<LaunchProfileStage>, LauncherError> {
    let profile_path = paths::get_instance_minecraft_dir(&instance_id).join("launch_profile.json");
    if profile_path.exists() {
        let data = std::fs::read_to_string(&profile_path)?;
        Ok(serde_json::from_str(&data).unwrap_or_default())
    } else {
        Ok(vec![
            LaunchProfileStage { stage: "Java初始化".into(), duration_ms: 0, details: "等待首次启动后获取数据".into() },
        ])
    }
}

// ---- #37 Frame Time Analysis ----

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct FrameTimeData {
    avg_fps: f32,
    min_fps: f32,
    p1_low_fps: f32,
    frame_times_ms: Vec<f32>,
}

#[tauri::command]
async fn get_frame_time_data(instance_id: String) -> Result<FrameTimeData, LauncherError> {
    let fps_path = paths::get_instance_minecraft_dir(&instance_id).join("fps_data.json");
    if fps_path.exists() {
        match std::fs::read_to_string(&fps_path) {
            Ok(data) => {
                if let Ok(parsed) = serde_json::from_str::<FrameTimeData>(&data) {
                    return Ok(parsed);
                }
            }
            Err(_) => {}
        }
    }
    let log_path = paths::get_instance_minecraft_dir(&instance_id).join("logs").join("latest.log");
    if log_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&log_path) {
            let mut fps_values: Vec<f32> = Vec::new();
            for line in content.lines() {
                if line.contains("fps") || line.contains("FPS") {
                    let lower = line.to_lowercase();
                    if let Some(pos) = lower.find("fps") {
                        let before = &lower[..pos].trim();
                        if let Some(num_str) = before.rsplit(|c: char| !c.is_ascii_digit() && c != '.').next() {
                            if let Ok(val) = num_str.parse::<f32>() {
                                if val > 0.0 && val < 1000.0 {
                                    fps_values.push(val);
                                }
                            }
                        }
                    }
                }
            }
            if !fps_values.is_empty() {
                let avg = fps_values.iter().sum::<f32>() / fps_values.len() as f32;
                let min = fps_values.iter().cloned().fold(f32::MAX, f32::min);
                let mut sorted = fps_values.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let p1_idx = ((sorted.len() as f32) * 0.01).max(1.0) as usize - 1;
                let p1_low = sorted.get(p1_idx).copied().unwrap_or(min);
                return Ok(FrameTimeData {
                    avg_fps: avg,
                    min_fps: min,
                    p1_low_fps: p1_low,
                    frame_times_ms: fps_values.iter().take(30).map(|&f| if f > 0.0 { 1000.0 / f } else { 0.0 }).collect(),
                });
            }
        }
    }
    Ok(FrameTimeData {
        avg_fps: 0.0,
        min_fps: 0.0,
        p1_low_fps: 0.0,
        frame_times_ms: Vec::new(),
    })
}

// ---- #47 Natural Language Search ----

#[derive(Debug, Clone, serde::Serialize)]
struct NLPSearchResult {
    slug: String,
    name: String,
    relevance: f32,
    interpretation: String,
}

#[tauri::command]
async fn nlp_search_content(query: String) -> Result<Vec<NLPSearchResult>, LauncherError> {
    let (results, _total) = modrinth::search_mods(&query, None, None, 10, 0).await?;
    Ok(results.iter().map(|h| NLPSearchResult {
        slug: h.slug.clone(),
        name: h.title.clone(),
        relevance: 0.9,
        interpretation: query.clone(),
    }).collect())
}

fn auto_tune_memory() -> u32 {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024;
    ((total_ram / 2).clamp(2048, 8192)) as u32
}

fn smart_tune_memory(mod_count: usize) -> u32 {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024;
    let mod_overhead = (mod_count as u64) * 50;
    let base = if total_ram <= 8192 {
        total_ram / 2
    } else if total_ram <= 16384 {
        total_ram * 3 / 5
    } else {
        total_ram * 2 / 3
    };
    let recommended = (base + mod_overhead).clamp(2048, total_ram * 3 / 4);
    recommended as u32
}

#[tauri::command]
async fn smart_tune_memory_cmd(instance_id: String) -> Result<u32, LauncherError> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let mod_count = if mods_dir.exists() {
        std::fs::read_dir(&mods_dir)
            .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
                e.path().extension().map(|ext| ext == "jar").unwrap_or(false)
            }).count())
            .unwrap_or(0)
    } else {
        0
    };
    Ok(smart_tune_memory(mod_count))
}

#[derive(Debug, Clone, serde::Serialize)]
struct PlaytimeStats {
    total_seconds: u64,
    daily: std::collections::HashMap<String, u64>,
    top_instances: Vec<InstancePlaytime>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct InstancePlaytime {
    id: String,
    name: String,
    seconds: u64,
}

#[tauri::command]
async fn get_playtime_stats() -> Result<PlaytimeStats, LauncherError> {
    let instances = instance::manager::list_instances()?;
    let total_seconds: u64 = instances.iter().map(|i| i.playtime_seconds).sum();
    let mut top_instances: Vec<InstancePlaytime> = instances.iter().map(|i| InstancePlaytime {
        id: i.id.clone(),
        name: i.name.clone(),
        seconds: i.playtime_seconds,
    }).collect();
    top_instances.sort_by(|a, b| b.seconds.cmp(&a.seconds));
    top_instances.truncate(10);

    let mut daily: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    let playtime_path = paths::get_game_dir().join("playtime_log.json");
    if playtime_path.exists() {
        if let Ok(data) = std::fs::read_to_string(&playtime_path) {
            if let Ok(log_entries) = serde_json::from_str::<std::collections::HashMap<String, u64>>(&data) {
                daily = log_entries;
            }
        }
    }

    Ok(PlaytimeStats { total_seconds, daily, top_instances })
}

#[tauri::command]
async fn record_playtime(instance_id: String, seconds: u64) -> Result<(), LauncherError> {
    instance::manager::update_playtime(&instance_id, seconds)?;

    let playtime_path = paths::get_game_dir().join("playtime_log.json");
    let mut daily: std::collections::HashMap<String, u64> = if playtime_path.exists() {
        std::fs::read_to_string(&playtime_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    *daily.entry(today).or_insert(0) += seconds;

    let data = serde_json::to_string_pretty(&daily)?;
    std::fs::write(&playtime_path, data)?;

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct AggProgressSnapshot {
    completed: u64,
    total: u64,
    bytes_downloaded: u64,
    current_url: String,
    phase: String,
    finished: bool,
    speed_bytes_per_sec: u64,
    eta_seconds: u64,
}

struct DownloadAggregateProgress {
    completed: u64,
    total: u64,
    bytes_downloaded: u64,
    #[allow(dead_code)]
    total_bytes: u64,
    current_url: String,
    phase: String,
    start_time: std::time::Instant,
}

fn compute_agg_speed_eta(bytes: u64, start: std::time::Instant) -> (u64, u64) {
    let secs = start.elapsed().as_secs().max(1);
    let speed = bytes / secs;
    let eta = bytes.checked_div(speed).map(|d| d.saturating_sub(secs)).unwrap_or(0);
    (speed, eta)
}

#[tauri::command]
async fn get_security_config() -> Result<config::SecurityConfig, LauncherError> {
    let cfg = config::load_config()?;
    Ok(cfg.security)
}

#[tauri::command]
async fn save_security_config(
    security: config::SecurityConfig,
) -> Result<(), LauncherError> {
    let mut cfg = config::load_config()?;
    let old_encryption = cfg.security.credential_encryption;
    cfg.security = security;
    config::save_config(&cfg)?;
    security::audit::log_audit(
        security::audit::AuditLevel::Info,
        security::audit::AuditCategory::Config,
        "Security config updated",
        Some(serde_json::json!({
            "credential_encryption_changed": old_encryption != cfg.security.credential_encryption,
        })),
    );
    if !old_encryption && cfg.security.credential_encryption {
        let _ = security::credential_store::migrate_plain_to_encrypted();
    }
    let _ = security::audit::init_audit(cfg.security.audit_log_enabled);
    Ok(())
}

#[tauri::command]
async fn get_security_score() -> Result<u32, LauncherError> {
    let cfg = config::load_config()?;
    let mut score: u32 = 40;
    if security::credential_store::is_encrypted() {
        score += 20;
    }
    if cfg.security.strict_verification {
        score += 10;
    }
    if cfg.security.jvm_args_mode == "whitelist" {
        score += 10;
    }
    match cfg.security.sandbox_mode.as_str() {
        "strict" => score += 10,
        "basic" => score += 5,
        _ => {}
    }
    if cfg.security.audit_log_enabled {
        score += 10;
    }
    Ok(score)
}

#[tauri::command]
async fn get_audit_log(
    category: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<security::audit::AuditEntry>, LauncherError> {
    let filter_category = category.and_then(|c| serde_json::from_value(serde_json::Value::String(c)).ok());
    security::audit::read_audit_log(
        filter_category,
        limit.unwrap_or(100),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
async fn get_login_history() -> Result<Vec<security::audit::LoginHistoryEntry>, LauncherError> {
    security::audit::get_login_history()
}

#[tauri::command]
async fn migrate_credentials() -> Result<(), LauncherError> {
    security::credential_store::migrate_plain_to_encrypted()
}

#[tauri::command]
async fn get_encryption_status() -> Result<serde_json::Value, LauncherError> {
    Ok(serde_json::json!({
        "encrypted": security::credential_store::is_encrypted(),
        "plain": security::credential_store::is_plain(),
    }))
}

#[tauri::command]
async fn save_api_key(name: String, value: String) -> Result<(), LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::sanitizer::sanitize_general_string(&value)?;
    security::key_store::set_key(&name, &value)
}

#[tauri::command]
async fn delete_api_key(name: String) -> Result<(), LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::key_store::delete_key(&name)
}

#[tauri::command]
async fn get_api_key_status(name: String) -> Result<security::key_store::KeyStatus, LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::key_store::key_status(&name)
}

#[tauri::command]
async fn check_file_permissions() -> Result<Vec<serde_json::Value>, LauncherError> {
    let results = security::file_permissions::check_all_sensitive_permissions();
    Ok(results
        .into_iter()
        .map(|(path, secure)| {
            serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "secure": secure,
            })
        })
        .collect())
}

#[tauri::command]
async fn fix_file_permissions() -> Result<Vec<serde_json::Value>, LauncherError> {
    let results = security::file_permissions::fix_all_sensitive_permissions();
    for (path, fixed) in &results {
        if *fixed {
            security::audit::log_audit(
                security::audit::AuditLevel::Info,
                security::audit::AuditCategory::File,
                &format!("Fixed insecure permissions on {}", path.display()),
                None,
            );
        }
    }
    Ok(results
        .into_iter()
        .map(|(path, fixed)| {
            serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "fixed": fixed,
            })
        })
        .collect())
}

#[tauri::command]
async fn validate_jvm_args(args: String) -> Result<serde_json::Value, LauncherError> {
    let cfg = config::load_config()?;
    let arg_list: Vec<String> = args.split_whitespace().map(String::from).collect();
    if cfg.security.jvm_args_mode == "whitelist" {
        match security::jvm_whitelist::validate_jvm_args(&arg_list) {
            Ok(valid) => Ok(serde_json::json!({ "valid": true, "args": valid })),
            Err(e) => Ok(serde_json::json!({ "valid": false, "error": e.to_string() })),
        }
    } else {
        let (valid, invalid) = security::jvm_whitelist::validate_jvm_args_custom(&arg_list);
        Ok(serde_json::json!({ "valid": true, "args": valid, "warnings": invalid }))
    }
}

#[tauri::command]
async fn get_sandbox_availability() -> Result<security::sandbox::SandboxAvailability, LauncherError> {
    Ok(security::sandbox::check_sandbox_availability())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::logger::init_logger();
    tracing::info!("BonNext launcher starting");

    if let Err(e) = paths::ensure_dirs() {
        tracing::error!("Failed to create directories: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { launch_state: Arc::new(Mutex::new(LaunchState::Idle)) })
        .manage(cache::ApiCache::new())
        .invoke_handler(tauri::generate_handler![
            get_versions, get_launch_state, reset_launch_state,
            get_config, save_config,
            find_java, find_all_java, check_java_version, check_jre_available,
            get_jre_sources,
            offline_login, start_microsoft_auth, poll_microsoft_auth,
            list_accounts, get_active_account, set_active_account,
            remove_account, refresh_auth_token,
            download_version, launch_game,
            get_game_dir, get_default_game_dir,
            list_instances, create_instance, delete_instance,
            update_instance, get_instance, duplicate_instance,
            export_instance, import_modpack, import_modpack_auto, detect_modpack_format, export_mrpack, check_instance_ready, open_folder,
            parse_crash_report,
            diagnose_crash,
            get_loader_versions, install_loader,
            search_mods, get_popular_mods, get_mod_details,
            get_mod_versions, get_version_by_id,
            install_mod, install_content,
            get_optimization_presets_cmd, apply_optimization_preset,
            search_content, get_project_details, get_trending_content,
            get_recently_updated,
            list_instance_mods, list_instance_resourcepacks,
            list_instance_shaders, list_instance_saves, list_instance_logs, read_log_file,
            remove_installed_mod, get_content_counts,
            check_content_updates,
            bulk_update_content,
            search_cf_mods, get_cf_mod, get_cf_project_details, get_cf_mod_versions, get_cf_featured,
            get_cf_mod_files, download_cf_mod,
            add_to_collection, remove_from_collection,
            is_in_collection, list_collection,
            get_minecraft_news,
            get_minecraft_article,
            quick_start, select_fastest_mirror,
            get_system_info, auto_tune_memory_cmd,
            smart_tune_memory_cmd,
            get_playtime_stats, record_playtime,
            get_instance_cover_image,
              get_last_played_instance,
              create_snapshot, list_snapshots, restore_snapshot, delete_snapshot,
              check_mod_conflicts,
              ping_server,
              export_instance_config, import_instance_config,
              get_hardware_profile,
              get_disk_usage,
            list_installed_versions, delete_version_cmd, get_dir_size_cmd,
              get_recommendations,
              check_migration_readiness,
              warmup_launch,
              create_guest_instance,
              list_screenshots,
              get_achievements, unlock_achievement,
              set_instance_icon,
              get_download_schedule_config, set_download_schedule_config,
              get_gc_recommendations,
              detect_anomalies,
              get_battery_status,
              cli_launch,
              get_web_api_status,
              list_friends, add_friend, remove_friend,
              start_lan_discovery, stop_lan_discovery, get_lan_worlds,
              scan_p2p_peers, send_file_p2p,
              start_discord_rpc, stop_discord_rpc, update_discord_presence,
              get_launch_profiling_data,
              get_frame_time_data,
              nlp_search_content,
              get_security_config, save_security_config,
              get_security_score,
              get_audit_log, get_login_history,
              migrate_credentials, get_encryption_status,
              save_api_key, delete_api_key, get_api_key_status,
              check_file_permissions, fix_file_permissions,
              validate_jvm_args, get_sandbox_availability,

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
