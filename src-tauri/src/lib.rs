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
mod version;

use config::AppConfig;
use crash_parser::CrashInfo;
use download::queue::{DownloadProgress, DownloadQueue};
use error::LauncherError;
use instance::manager::GameInstance;
use launch::args::{InstanceSettings, LaunchContext};
use launch::process::LaunchProcess;
use launch::state::LaunchState;
use platform::paths;
use std::sync::{Arc, Mutex};
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
    let current = state.launch_state.lock().unwrap();
    Ok(*current)
}

#[tauri::command]
async fn reset_launch_state(state: tauri::State<'_, AppState>) -> Result<(), LauncherError> {
    let mut current = state.launch_state.lock().unwrap();
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
async fn check_java_version(java_path: String) -> Result<Option<u32>, LauncherError> {
    let path = std::path::PathBuf::from(&java_path);
    let version = platform::java::check_java_version(&path);
    Ok(version)
}

#[tauri::command]
async fn check_jre_available(major_version: u32) -> Result<bool, LauncherError> {
    // Check if a compatible JRE is already downloaded
    if platform::java_download::find_downloaded_jre(major_version).is_some() {
        return Ok(true);
    }
    // Also check if we can reach Adoptium API
    match platform::java_download::fetch_available_jres(major_version).await {
        Ok(releases) => Ok(!releases.is_empty()),
        Err(_) => Ok(false),
    }
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

    // Record launch start time for playtime tracking
    let _launch_start = std::time::Instant::now();
    let _instance_id_for_playtime = instance_id.clone();

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
        let mut current = state.launch_state.lock().unwrap();
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
    _instance_id: Option<String>,
) -> Result<(), LauncherError> {
    {
        let mut current = launch_state.lock().unwrap();
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
            let mut current = launch_state.lock().unwrap();
            *current = LaunchState::Downloading;
        }
        tracing::info!("Client JAR not found, downloading version {} first", version_id);
        download_version_inner(&version_id, &version_url, _app.clone()).await?;
    }

    let details = version::resolver::resolve_version_with_parents(&version_id, &version_url).await?;
    let resolved = version::resolver::ResolvedVersion::from_details(&details);

    tracing::info!(
        "Resolved: id={}, mainClass={}, libs={}, natives={}, java_ver={}",
        resolved.id, resolved.main_class,
        resolved.libraries.len(), resolved.native_libraries.len(),
        resolved.java_version.major_version,
    );

    let instance_settings = InstanceSettings { max_memory, min_memory, java_path, jvm_args, user_type: Some(user_type) };
    let ctx = LaunchContext::build(resolved, username, uuid, access_token, Some(instance_settings))?;
    let launcher = LaunchProcess::with_app_handle(launch_state, _app.clone());
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
        let mut agg = progress_for_cb.lock().unwrap();
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
            let mut agg = progress_assets_cb.lock().unwrap();
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
            name.ends_with(".so")
        };

        if is_platform_native {
            if let Some(file_name) = std::path::Path::new(&name).file_name() {
                let out_path = natives_dir.join(file_name);
                let mut out = std::fs::File::create(&out_path)?;
                std::io::copy(&mut entry, &mut out)?;
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
async fn export_mrpack(id: String, output_path: String) -> Result<(), LauncherError> {
    instance::manager::export_mrpack(&id, std::path::Path::new(&output_path)).await
}

#[tauri::command]
async fn parse_crash_report(report_path: String) -> Result<CrashInfo, LauncherError> {
    crash_parser::parse_crash_report(&report_path)
}

#[tauri::command]
async fn check_instance_ready(instance_id: String) -> Result<bool, LauncherError> {
    instance::manager::check_instance_ready(&instance_id)
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), LauncherError> {
    let p = std::path::PathBuf::from(&path);
    if p.exists() {
        opener::open(&p).map_err(|e| LauncherError::Other(e.to_string()))?;
    }
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
) -> Result<String, LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let result = modrinth::download_content_file(&file_url, &filename, &instance_id, ct, sha1.as_deref()).await?;

    // Record install metadata for update checking
    if let Some(ref s) = slug {
        if let Err(e) = content::record_install(&instance_id, &filename, s, version_id.as_deref(), ct) {
            tracing::warn!("Failed to record install metadata: {}", e);
        }
    }

    Ok(result)
}

// ---------------------------------------------------------------
// Marketplace commands (extended Modrinth API)
// ---------------------------------------------------------------

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

#[tauri::command]
async fn check_content_updates(instance_id: String) -> Result<Vec<content::UpdateInfo>, LauncherError> {
    content::check_updates(&instance_id).await
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
) -> Result<String, LauncherError> {
    curseforge::download_mod_file(&file_url, &filename, &instance_id).await
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

fn auto_tune_memory() -> u32 {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024; // MB
    // Use 50% of system RAM, capped at 8GB, minimum 2GB
    ((total_ram / 2).clamp(2048, 8192)) as u32
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
            find_java, check_java_version, check_jre_available,
            offline_login, start_microsoft_auth, poll_microsoft_auth,
            list_accounts, get_active_account, set_active_account,
            remove_account, refresh_auth_token,
            download_version, launch_game,
            get_game_dir, get_default_game_dir,
            list_instances, create_instance, delete_instance,
            update_instance, get_instance, duplicate_instance,
            export_instance, import_modpack, export_mrpack, check_instance_ready, open_folder,
            parse_crash_report,
            get_loader_versions, install_loader,
            search_mods, get_popular_mods, get_mod_details,
            get_mod_versions, get_version_by_id,
            install_mod, install_content,
            search_content, get_project_details, get_trending_content,
            get_recently_updated,
            list_instance_mods, list_instance_resourcepacks,
            list_instance_shaders, remove_installed_mod, get_content_counts,
            check_content_updates,
            search_cf_mods, get_cf_mod, get_cf_featured,
            get_cf_mod_files, download_cf_mod,
            add_to_collection, remove_from_collection,
            is_in_collection, list_collection,
            quick_start, select_fastest_mirror,
            get_system_info, auto_tune_memory_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
