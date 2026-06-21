use crate::auth;
use crate::download::queue::{DownloadControlState, DownloadProgress, DownloadQueue};
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
    let games = state.running_games.lock();
    if games.is_empty() {
        return Ok(LaunchState::Idle);
    }
    let any_busy = games.values().any(|g| g.state.lock().is_busy());
    if any_busy {
        Ok(LaunchState::Running)
    } else {
        let any_crashed = games.values().any(|g| {
            let s = g.state.lock();
            matches!(*s, LaunchState::Crashed | LaunchState::Error)
        });
        if any_crashed {
            Ok(LaunchState::Crashed)
        } else {
            Ok(LaunchState::Idle)
        }
    }
}

#[tauri::command]
pub async fn get_instance_launch_state(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<LaunchState, LauncherError> {
    let games = state.running_games.lock();
    if let Some(game) = games.get(&instance_id) {
        let s = game.state.lock();
        Ok(*s)
    } else {
        Ok(LaunchState::Idle)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningGameInfo {
    pub instance_id: String,
    pub state: LaunchState,
    pub pid: u32,
    pub elapsed_secs: u64,
}

#[tauri::command]
pub async fn get_running_games(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RunningGameInfo>, LauncherError> {
    let games = state.running_games.lock();
    let mut result = Vec::new();
    for (_, game) in games.iter() {
        let s = game.state.lock();
        result.push(RunningGameInfo {
            instance_id: game.instance_id.clone(),
            state: *s,
            pid: game.pid,
            elapsed_secs: game.started_at.elapsed().as_secs(),
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn reset_launch_state(
    state: tauri::State<'_, AppState>,
    force: Option<bool>,
) -> Result<(), LauncherError> {
    let force = force.unwrap_or(false);
    let mut games = state.running_games.lock();
    games.retain(|_id, game| {
        let mut s = game.state.lock();
        let is_terminal = matches!(*s, LaunchState::Exited | LaunchState::Crashed | LaunchState::Error);
        if is_terminal || force {
            *s = LaunchState::Idle;
            false
        } else {
            true
        }
    });
    {
        let mut global = state.launch_state.lock();
        let is_terminal = matches!(*global, LaunchState::Exited | LaunchState::Crashed | LaunchState::Error);
        if is_terminal || force {
            *global = LaunchState::Idle;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn reset_instance_launch_state(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    force: Option<bool>,
) -> Result<(), LauncherError> {
    let force = force.unwrap_or(false);
    let mut games = state.running_games.lock();
    if let Some(game) = games.get(&instance_id) {
        let mut s = game.state.lock();
        let is_terminal = matches!(*s, LaunchState::Exited | LaunchState::Crashed | LaunchState::Error);
        if is_terminal || force {
            *s = LaunchState::Idle;
            drop(s);
            games.remove(&instance_id);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn download_version(
    app: tauri::AppHandle,
    version_id: String,
    version_url: String,
    control: tauri::State<'_, DownloadControlState>,
) -> Result<(), LauncherError> {
    download_version_inner(&version_id, &version_url, app, &control).await
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
    let iid = instance_id.clone().unwrap_or_else(|| format!("default_{}", uuid));

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

    let instance_launch_state: Arc<Mutex<LaunchState>> = {
        let mut games = state.running_games.lock();
        if let Some(old) = games.get(&iid) {
            let old_state = *old.state.lock();
            if old_state.is_busy() {
                return Err(LauncherError::LaunchFailed(format!(
                    "Instance {} is already in state: {:?}", iid, old_state
                )));
            }
            if matches!(old_state, LaunchState::Exited | LaunchState::Crashed | LaunchState::Error) {
                games.remove(&iid);
            }
        }
        let game = games.entry(iid.clone()).or_insert_with(|| crate::RunningGame {
            state: Arc::new(Mutex::new(LaunchState::Idle)),
            pid: 0,
            instance_id: iid.clone(),
            started_at: std::time::Instant::now(),
        });
        game.state.clone()
    };
    let running_games_ref = state.running_games.clone();

    let result = launch_game_inner(
        app,
        instance_launch_state,
        running_games_ref,
        version_id, version_url,
        username, uuid, access_token,
        user_type,
        max_memory, min_memory, java_path, jvm_args,
        instance_id,
    ).await;

    if let Err(ref e) = result {
        tracing::error!("Launch failed: {}", e);
        let games = state.running_games.lock();
        if let Some(game) = games.get(&iid) {
            let mut s = game.state.lock();
            *s = LaunchState::Error;
        }
    }

    result
}

pub(crate) async fn launch_game_inner(
    _app: tauri::AppHandle,
    launch_state: Arc<Mutex<LaunchState>>,
    running_games: Arc<Mutex<std::collections::HashMap<String, crate::RunningGame>>>,
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
        *current = LaunchState::Idle;
    }

    let client_jar_path = paths::get_versions_dir()
        .join(&version_id)
        .join(format!("{}.jar", version_id));

    let details = if !client_jar_path.exists() {
        {
            let mut current = launch_state.lock();
            if current.can_transition_to(LaunchState::Downloading) {
                tracing::info!("Launch state: {:?} -> {:?}", *current, LaunchState::Downloading);
                *current = LaunchState::Downloading;
                let _ = _app.emit("launch-state-changed", serde_json::json!({
                    "state": LaunchState::Downloading,
                    "instance_id": instance_id,
                }));
            }
        }
        tracing::info!("Client JAR not found, downloading version {} first", version_id);
        download_version_inner(&version_id, &version_url, _app.clone(), &DownloadControlState::new()).await?;
        // 下载完成后强制重置为 Idle（Downloading → Idle 是非法转换，但此处需要重置
        // 以便后续 LaunchProcess::launch 从 Idle 开始正常状态机流程）。
        {
            let mut current = launch_state.lock();
            tracing::info!("Launch state (forced): {:?} -> {:?}", *current, LaunchState::Idle);
            *current = LaunchState::Idle;
            let _ = _app.emit("launch-state-changed", serde_json::json!({
                "state": LaunchState::Idle,
                "instance_id": instance_id,
            }));
        }
        version::resolver::load_local_version(&version_id)
            .ok_or_else(|| LauncherError::VersionNotFound(format!("Version JSON for {} not found after download", version_id)))?
    } else {
        version::resolver::resolve_version_with_parents(&version_id, &version_url).await?
    };
    let mut resolved = version::resolver::ResolvedVersion::from_details(&details);
    // 保存原始版本 ID，用于文件系统路径构建。
    // 安装 Loader 后 resolved.id 会被改为 loader 版本 ID（如 fabric-loader-0.15.11-1.21），
    // 但版本文件（client JAR、log4j、natives）存储在原始版本目录下。
    let original_version_id = resolved.id.clone();

    // assets 完整性检查：client JAR 存在不代表 assets 完整。
    // 之前出现过 assets 下载中断导致 72% 文件缺失，MC 启动后因 NoSuchFileException 崩溃。
    // 启动前检查并下载缺失的 asset 文件，避免 MC 因资源缺失而崩溃。
    // 只在 client JAR 已存在（跳过完整下载流程）时检查，避免与 download_version_inner 重复。
    if client_jar_path.exists() {
        if let Err(e) = verify_and_download_assets(&_app, &resolved.asset_index).await {
            tracing::warn!("Asset verification failed: {}. Continuing launch anyway.", e);
        }
    }

    if let Some(ref iid) = &instance_id {
        if let Ok(Some(inst)) = instance::manager::get_instance(iid) {
            if let (Some(lt), Some(lv)) = (&inst.loader_type, &inst.loader_version) {
                tracing::info!("Instance has loader {} {}, installing/verging loader...", lt, lv);
                if let Some(loader_type) = loader::LoaderType::from_str(lt) {
                    // 加载器缓存：避免每次启动都从网络获取加载器元数据。
                    // 之前每次启动都调用 install_loader()，依赖网络（meta.fabricmc.net 等），
                    // 离线时加载器无法应用 → 游戏以原版模式启动 → 看不到模组。
                    // 缓存文件名包含 loader_type 和 loader_version，版本变化时自动使用新缓存。
                    let loader_cache_path = paths::get_instance_minecraft_dir(iid)
                        .join(format!("loader_cache_{}_{}.json", lt, lv));

                    let loader_result = if let Ok(cached) = std::fs::read_to_string(&loader_cache_path) {
                        match serde_json::from_str::<loader::LoaderInstallResult>(&cached) {
                            Ok(result) => {
                                tracing::info!(
                                    "Loader cache hit: {} {} -> {} (offline-ready)",
                                    lt, lv, result.version_id
                                );
                                result
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Loader cache parse failed ({}), re-installing from network...", e
                                );
                                match loader::install_loader(&loader_type, &details, lv, iid).await {
                                    Ok(result) => {
                                        if let Ok(json) = serde_json::to_string(&result) {
                                            let _ = std::fs::write(&loader_cache_path, json);
                                            tracing::info!("Loader cache saved: {}", loader_cache_path.display());
                                        }
                                        result
                                    }
                                    Err(e) => {
                                        tracing::error!("Failed to install loader: {}", e);
                                        return Err(e);
                                    }
                                }
                            }
                        }
                    } else {
                        tracing::info!("No loader cache, installing {} {} from network...", lt, lv);
                        match loader::install_loader(&loader_type, &details, lv, iid).await {
                            Ok(result) => {
                                if let Ok(json) = serde_json::to_string(&result) {
                                    let _ = std::fs::write(&loader_cache_path, json);
                                    tracing::info!("Loader cache saved: {}", loader_cache_path.display());
                                }
                                result
                            }
                            Err(e) => {
                                tracing::error!("Failed to install loader: {}", e);
                                return Err(e);
                            }
                        }
                    };

                    // 下载加载器库（DownloadQueue 会自动跳过已存在的文件）
                    if !loader_result.extra_libraries.is_empty() {
                        let tasks = crate::download::queue::build_library_download_tasks(&loader_result.extra_libraries);
                        let queue = DownloadQueue::new();
                        match queue.download_all(tasks).await {
                            Ok(_) => tracing::info!("Loader libraries verified/downloaded successfully"),
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
            }
        }
    }

    tracing::info!(
        "Resolved: id={}, mainClass={}, libs={}, natives={}, java_ver={}",
        resolved.id, resolved.main_class,
        resolved.libraries.len(), resolved.native_libraries.len(),
        resolved.java_version.major_version,
    );

    let instance_settings = InstanceSettings { id: instance_id.clone(), max_memory, min_memory, java_path, jvm_args, user_type: Some(user_type), debug_mode: None, debug_port: None };
    let ctx = LaunchContext::build(resolved, original_version_id, username, uuid, access_token, Some(instance_settings))?;
    let mut launcher = LaunchProcess::with_app_handle(launch_state, _app.clone())
        .with_running_games(running_games);
    if let Some(ref iid) = instance_id {
        launcher = launcher.with_instance_id(iid.clone());
    }
    let result = launcher.launch(ctx).await;
    if result.is_ok() {
        crate::commands::achievement::try_unlock_achievement(&_app, "first_launch");
    }
    result
}

/// 启动前检查 assets 完整性，下载缺失的 asset 文件。
///
/// 只检查文件存在性（不校验 SHA1），速度快。下载时由 DownloadQueue 自动校验 SHA1。
/// 解决问题：client JAR 存在但 assets 下载中断导致文件缺失，MC 启动后崩溃。
async fn verify_and_download_assets(
    app: &tauri::AppHandle,
    asset_index: &crate::version::resolver::AssetIndex,
) -> Result<(), LauncherError> {
    let assets_dir = paths::get_assets_dir();
    let index_path = assets_dir.join("indexes").join(format!("{}.json", asset_index.id));

    // 如果 asset index 文件不存在，先下载
    if !index_path.exists() {
        tracing::info!("Asset index {} not found, downloading...", asset_index.id);
        let index_task = crate::download::queue::build_asset_index_task(asset_index);
        let queue = DownloadQueue::new();
        queue.download_single(&index_task).await?;
    }

    // 构建 asset objects 下载任务
    let asset_object_tasks = crate::download::queue::build_asset_object_tasks(&asset_index.id).await?;
    let total_objects = asset_object_tasks.len();

    // 只检查文件存在性（不校验 SHA1），过滤出缺失的文件
    let missing_tasks: Vec<_> = asset_object_tasks.into_iter()
        .filter(|t| !t.target_path.exists())
        .collect();

    if missing_tasks.is_empty() {
        tracing::info!("Assets verification passed: all {} files present", total_objects);
        return Ok(());
    }

    tracing::info!(
        "Assets verification: {}/{} files missing, downloading...",
        missing_tasks.len(), total_objects
    );

    // 下载缺失的文件（DownloadQueue 会自动校验 SHA1）
    let total_assets = missing_tasks.len();
    let progress_assets = Arc::new(Mutex::new(DownloadAggregateProgress {
        completed: 0,
        total: total_assets as u64,
        bytes_downloaded: 0,
        total_bytes: 0,
        current_url: String::new(),
        phase: "assets".to_string(),
        start_time: std::time::Instant::now(),
    }));

    let app_for_assets = app.clone();
    let progress_assets_cb = progress_assets.clone();
    let asset_callback = move |p: DownloadProgress| {
        let mut agg = progress_assets_cb.lock();
        agg.bytes_downloaded = agg.bytes_downloaded.saturating_add(p.downloaded);
        agg.current_url = p.url.clone();
        if p.finished {
            agg.completed += 1;
        }
        let (speed, eta) = compute_agg_speed_eta(agg.bytes_downloaded, agg.start_time);
        let _ = app_for_assets.emit("download-progress", AggProgressSnapshot {
            completed: agg.completed,
            total: agg.total,
            bytes_downloaded: agg.bytes_downloaded,
            current_url: agg.current_url.clone(),
            phase: agg.phase.clone(),
            finished: agg.completed >= agg.total,
            speed_bytes_per_sec: speed,
            eta_seconds: eta,
        });
    };

    let asset_queue = DownloadQueue::new().with_callback(asset_callback);
    let results = asset_queue.download_all(missing_tasks).await?;
    let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();
    if !errors.is_empty() {
        tracing::error!("{} asset downloads failed", errors.len());
    } else {
        tracing::info!("Assets download completed: {} files", total_assets);
    }

    Ok(())
}

pub async fn download_version_inner(
    version_id: &str,
    version_url: &str,
    app: tauri::AppHandle,
    control: &DownloadControlState,
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

    let queue = DownloadQueue::with_control(DownloadControlState {
        paused: control.paused.clone(),
        cancelled_urls: control.cancelled_urls.clone(),
    }).with_callback(callback);
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

        let asset_queue = DownloadQueue::with_control(DownloadControlState {
            paused: control.paused.clone(),
            cancelled_urls: control.cancelled_urls.clone(),
        }).with_callback(asset_callback);
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
                .map_err(|e| LauncherError::TaskJoinFailed(e.to_string()))??;
        } else {
            tracing::warn!("Native library not found: {}", lib_path.display());
        }
    }
    Ok(())
}

pub fn extract_natives_public(jar_path: &std::path::Path, natives_dir: &std::path::Path) -> Result<(), LauncherError> {
    extract_natives(jar_path, natives_dir)
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

#[derive(Debug, Clone, Serialize)]
pub struct PreLaunchCheckItem {
    pub name: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PreLaunchReport {
    pub items: Vec<PreLaunchCheckItem>,
    pub can_launch: bool,
}

#[tauri::command]
pub async fn pre_launch_check(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<PreLaunchReport, LauncherError> {
    let mut items: Vec<PreLaunchCheckItem> = Vec::new();
    let mut has_fail = false;

    {
        let games = state.running_games.lock();
        if let Some(game) = games.get(&instance_id) {
            let s = game.state.lock();
            if s.is_busy() {
                items.push(PreLaunchCheckItem {
                    name: "game_already_running".into(),
                    status: "fail".into(),
                    message: format!("Game is already running (state: {:?})", *s),
                });
                has_fail = true;
            } else {
                items.push(PreLaunchCheckItem {
                    name: "game_already_running".into(),
                    status: "pass".into(),
                    message: "No game instance currently running".into(),
                });
            }
        } else {
            items.push(PreLaunchCheckItem {
                name: "game_already_running".into(),
                status: "pass".into(),
                message: "No game instance currently running".into(),
            });
        }
    }

    match std::net::TcpListener::bind("127.0.0.1:25565") {
        Ok(_) => {
            items.push(PreLaunchCheckItem {
                name: "port_availability".into(),
                status: "pass".into(),
                message: "Port 25565 is available".into(),
            });
        }
        Err(_) => {
            items.push(PreLaunchCheckItem {
                name: "port_availability".into(),
                status: "warn".into(),
                message: "Port 25565 is in use (multiplayer may not work)".into(),
            });
        }
    }

    let inst = instance::manager::get_instance(&instance_id)
        .ok()
        .flatten();

    let cfg = crate::config::load_config().unwrap_or_default();
    let max_memory_mb = inst.as_ref().map(|i| i.max_memory).unwrap_or(cfg.max_memory);

    let game_dir = paths::get_game_dir();
    let available_result = {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        disks.iter().find(|d: &&sysinfo::Disk| d.mount_point() == game_dir || game_dir.starts_with(d.mount_point()))
            .map(|d: &sysinfo::Disk| d.available_space())
            .or_else(|| disks.iter().find(|d: &&sysinfo::Disk| d.mount_point() == std::path::Path::new("/")).map(|d: &sysinfo::Disk| d.available_space()))
    };
    match available_result {
        Some(available) => {
            let available_mb = available / 1_048_576;
            let required_mb = (max_memory_mb as u64) + 512;
            if available_mb < required_mb {
                items.push(PreLaunchCheckItem {
                    name: "disk_space".into(),
                    status: "warn".into(),
                    message: format!("Low disk space: {}MB available, {}MB recommended", available_mb, required_mb),
                });
            } else {
                items.push(PreLaunchCheckItem {
                    name: "disk_space".into(),
                    status: "pass".into(),
                    message: format!("{}MB available disk space", available_mb),
                });
            }
        }
        None => {
            items.push(PreLaunchCheckItem {
                name: "disk_space".into(),
                status: "warn".into(),
                message: "Could not check disk space".into(),
            });
        }
    }

    {
        let mut sys = sysinfo::System::new();
        sys.refresh_memory();
        let available_mb = sys.available_memory() / 1024;
        if available_mb < (max_memory_mb as u64) {
            items.push(PreLaunchCheckItem {
                name: "system_memory".into(),
                status: "warn".into(),
                message: format!("Available RAM {}MB < configured {}MB", available_mb, max_memory_mb),
            });
        } else {
            items.push(PreLaunchCheckItem {
                name: "system_memory".into(),
                status: "pass".into(),
                message: format!("Available RAM: {}MB (configured: {}MB)", available_mb, max_memory_mb),
            });
        }
    }

    if let Some(ref inst) = inst {
        let java_path = inst.java_path.as_ref()
            .or(cfg.java_path.as_ref())
            .map(|p| std::path::PathBuf::from(p))
            .unwrap_or_else(|| crate::platform::java::find_java().unwrap_or_else(|_| std::path::PathBuf::from("java")));

        let current_java = crate::platform::java::check_java_version(&java_path);
        let version_id = &inst.version_id;

        let required_java: u32 = if version_id.starts_with("1.") {
            8
        } else {
            let minor: u32 = version_id.split('.').nth(1).and_then(|s| s.parse().ok()).unwrap_or(17);
            if minor >= 21 { 21 }
            else if minor >= 17 { 17 }
            else if minor >= 16 { 16 }
            else { 8 }
        };

        match current_java {
            Some(ver) => {
                if ver < required_java {
                    items.push(PreLaunchCheckItem {
                        name: "java_version".into(),
                        status: "fail".into(),
                        message: format!("Java {} found, but Java {}+ required for MC {}", ver, required_java, version_id),
                    });
                    has_fail = true;
                } else {
                    items.push(PreLaunchCheckItem {
                        name: "java_version".into(),
                        status: "pass".into(),
                        message: format!("Java {} (requires {}+)", ver, required_java),
                    });
                }
            }
            None => {
                items.push(PreLaunchCheckItem {
                    name: "java_version".into(),
                    status: "warn".into(),
                    message: "Could not detect Java version".into(),
                });
            }
        }

        let version_dir = paths::get_versions_dir().join(version_id);
        let client_jar = version_dir.join(format!("{}.jar", version_id));
        if client_jar.exists() {
            items.push(PreLaunchCheckItem {
                name: "essential_files".into(),
                status: "pass".into(),
                message: "Client JAR present".into(),
            });
        } else {
            items.push(PreLaunchCheckItem {
                name: "essential_files".into(),
                status: "fail".into(),
                message: format!("Client JAR missing: {}", client_jar.display()),
            });
            has_fail = true;
        }

        let version_json = version_dir.join(format!("{}.json", version_id));
        if !version_json.exists() {
            items.push(PreLaunchCheckItem {
                name: "version_json".into(),
                status: "warn".into(),
                message: "Version JSON missing (will be downloaded on launch)".into(),
            });
        }
    } else {
        items.push(PreLaunchCheckItem {
            name: "instance_exists".into(),
            status: "fail".into(),
            message: "Instance not found".into(),
        });
        has_fail = true;
    }

    Ok(PreLaunchReport {
        can_launch: !has_fail,
        items,
    })
}
