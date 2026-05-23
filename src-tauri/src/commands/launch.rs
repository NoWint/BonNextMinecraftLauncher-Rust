use crate::auth;
use crate::download::queue::{DownloadProgress, DownloadQueue};
use crate::error::LauncherError;
use crate::instance;
use crate::launch::args::{InstanceSettings, LaunchContext};
use crate::launch::process::LaunchProcess;
use crate::launch::state::LaunchState;
use crate::loader;
use crate::platform::paths;
use crate::version;
use crate::AppState;
use parking_lot::Mutex;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggProgressSnapshot {
    pub completed: u64,
    pub total: u64,
    pub bytes_downloaded: u64,
    pub current_url: String,
    pub phase: String,
    pub finished: bool,
    pub speed_bytes_per_sec: u64,
    pub eta_seconds: u64,
}

pub struct DownloadAggregateProgress {
    pub completed: u64,
    pub total: u64,
    pub bytes_downloaded: u64,
    #[allow(dead_code)]
    pub total_bytes: u64,
    pub current_url: String,
    pub phase: String,
    pub start_time: std::time::Instant,
}

pub fn compute_agg_speed_eta(bytes: u64, start: std::time::Instant) -> (u64, u64) {
    let secs = start.elapsed().as_secs().max(1);
    let speed = bytes / secs;
    let eta = bytes.checked_div(speed).map(|d| d.saturating_sub(secs)).unwrap_or(0);
    (speed, eta)
}

#[tauri::command]
pub async fn get_launch_state(state: tauri::State<'_, AppState>) -> Result<LaunchState, LauncherError> {
    let current = state.launch_state.lock();
    Ok(*current)
}

#[tauri::command]
pub async fn reset_launch_state(state: tauri::State<'_, AppState>) -> Result<(), LauncherError> {
    let mut current = state.launch_state.lock();
    *current = LaunchState::Idle;
    Ok(())
}

#[tauri::command]
pub async fn download_version(
    app: tauri::AppHandle,
    version_id: String,
    version_url: String,
) -> Result<(), LauncherError> {
    download_version_inner(&version_id, &version_url, app).await
}

#[tauri::command]
pub async fn launch_game(
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
                                let tasks = crate::download::queue::build_library_download_tasks(&loader_result.extra_libraries);
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

pub async fn download_version_inner(
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

    let mut tasks = crate::download::queue::build_version_download_tasks(
        version_id, &resolved.client_jar.url, &resolved.client_jar.sha1, resolved.client_jar.size,
    );
    tasks.extend(crate::download::queue::build_library_download_tasks(&resolved.libraries));
    tasks.extend(crate::download::queue::build_library_download_tasks(&resolved.native_libraries));
    if let Some(ref logging) = resolved.logging_config {
        if !logging.file.url.is_empty() {
            tasks.push(crate::download::queue::build_logging_config_task(&resolved.id, &logging.file.url));
        }
    }
    tasks.push(crate::download::queue::build_asset_index_task(&resolved.asset_index));

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

    let asset_object_tasks = crate::download::queue::build_asset_object_tasks(&resolved.asset_index.id).await?;
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
