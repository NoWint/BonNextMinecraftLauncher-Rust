use crate::config;
use crate::error::LauncherError;
use crate::instance;
use crate::launch::args::{self, LaunchContext};
use crate::launch::state::LaunchState;
use crate::platform;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::Mutex;
use tauri::Emitter;

pub struct LaunchProcess {
    state: Arc<Mutex<LaunchState>>,
    app_handle: Option<tauri::AppHandle>,
    instance_id: Option<String>,
    running_games: Option<Arc<Mutex<std::collections::HashMap<String, crate::RunningGame>>>>,
}

impl LaunchProcess {
    pub fn new(state: Arc<Mutex<LaunchState>>) -> Self {
        LaunchProcess { state, app_handle: None, instance_id: None, running_games: None }
    }

    pub fn with_app_handle(state: Arc<Mutex<LaunchState>>, app: tauri::AppHandle) -> Self {
        LaunchProcess { state, app_handle: Some(app), instance_id: None, running_games: None }
    }

    pub fn with_instance_id(mut self, id: String) -> Self {
        self.instance_id = Some(id);
        self
    }

    pub fn with_running_games(mut self, games: Arc<Mutex<std::collections::HashMap<String, crate::RunningGame>>>) -> Self {
        self.running_games = Some(games);
        self
    }

    pub fn set_state(&self, new_state: LaunchState) -> Result<(), LauncherError> {
        let mut current = self.state.lock();
        if !current.can_transition_to(new_state) {
            return Err(LauncherError::LaunchFailed(format!(
                "Invalid state transition: {:?} -> {:?}", *current, new_state
            )));
        }
        tracing::info!("Launch state: {:?} -> {:?}", *current, new_state);
        *current = new_state.clone();
        drop(current);
        if let Some(ref app) = self.app_handle {
            let _ = app.emit("launch-state-changed", serde_json::json!({
                "state": new_state,
                "instance_id": self.instance_id,
            }));
        }
        Ok(())
    }

    pub fn force_set_state(&self, new_state: LaunchState) {
        let mut current = self.state.lock();
        tracing::info!("Launch state (forced): {:?} -> {:?}", *current, new_state);
        *current = new_state.clone();
        drop(current);
        if let Some(ref app) = self.app_handle {
            let _ = app.emit("launch-state-changed", serde_json::json!({
                "state": new_state,
                "instance_id": self.instance_id,
            }));
        }
    }

    pub async fn launch(&self, mut ctx: LaunchContext) -> Result<(), LauncherError> {
        let launch_start = std::time::Instant::now();
        let mut profile_stages: Vec<ProfileStage> = Vec::new();

        self.set_state(LaunchState::Checking)?;

        let check_start = std::time::Instant::now();
        let missing = self.check_files(&ctx);
        profile_stages.push(ProfileStage {
            stage: "File Check".into(),
            duration_ms: check_start.elapsed().as_millis() as u64,
            details: if missing.is_empty() { "All files present".into() } else { format!("{} files missing", missing.len()) },
        });

        if !missing.is_empty() {
            tracing::warn!("Missing {} files, auto-downloading...", missing.len());
            let dl_start = std::time::Instant::now();
            self.set_state(LaunchState::Downloading)?;
            self.download_missing(&ctx, &missing).await?;
            self.set_state(LaunchState::Checking)?;
            profile_stages.push(ProfileStage {
                stage: "Auto Repair".into(),
                duration_ms: dl_start.elapsed().as_millis() as u64,
                details: format!("{} files repaired", missing.len()),
            });
        }

        // Auto-download JRE if system Java is missing or too old
        let required_java = ctx.version.java_version.major_version;
        let current_java_ver = platform::java::check_java_version(&ctx.java_path);
        let need_jre = current_java_ver.is_none_or(|v| v < required_java);

        if need_jre {
            tracing::info!(
                "Java {} required, current: {:?}. Checking for downloaded JRE...",
                required_java, current_java_ver
            );

            let jre_start = std::time::Instant::now();
            // First check if we already downloaded a compatible JRE
            if let Some(cached_java) = platform::java_download::find_downloaded_jre(required_java) {
                tracing::info!("Using cached JRE: {}", cached_java.display());
                ctx.java_path = cached_java;
                profile_stages.push(ProfileStage {
                    stage: "JRE (cached)".into(),
                    duration_ms: jre_start.elapsed().as_millis() as u64,
                    details: format!("Java {}", required_java),
                });
            } else {
                let cfg = config::load_config().unwrap_or_default();
                let source = platform::java_download::JreSource::from_str(&cfg.java_download_source);
                tracing::info!("Downloading JRE {} from {}...", required_java, source.as_str());
                let app = self.app_handle.clone();
                let java_path = platform::java_download::download_java_with_source(
                    required_java,
                    &source,
                    move |downloaded, total| {
                        if let Some(ref app) = app {
                            let _ = app.emit("jre-download-progress", serde_json::json!({
                                "downloaded": downloaded,
                                "total": total,
                                "version": required_java,
                            }));
                        }
                    },
                ).await?;
                ctx.java_path = PathBuf::from(java_path);
                profile_stages.push(ProfileStage {
                    stage: "JRE Download".into(),
                    duration_ms: jre_start.elapsed().as_millis() as u64,
                    details: format!("Java {}", required_java),
                });
            }
            tracing::info!("Using Java: {}", ctx.java_path.display());
        }

        self.set_state(LaunchState::Launching)?;

        let launch_instant = std::time::Instant::now();

        let active_account = crate::auth::token_store::AccountStore::load().ok().and_then(|s| s.get_active().cloned());
        if let Some(ref acct) = active_account {
            let jar_path = crate::platform::paths::get_game_dir().join("shared").join("authlib-injector.jar");
            let needs_authlib = match acct.account_type.as_str() {
                "yggdrasil" => acct.yggdrasil_server_url.is_some(),
                "offline" | "microsoft" => acct.local_skin_path.is_some(),
                _ => false,
            };
            if needs_authlib && !jar_path.exists() {
                tracing::info!("authlib-injector.jar not found, auto-downloading...");
                let url = "https://authlib-injector.yushi.moe/artifact/latest/authlib-injector.jar";
                match crate::http_client::build_download_client().get(url).send().await {
                    Ok(resp) => {
                        if let Ok(bytes) = resp.bytes().await {
                            if bytes.len() > 4 && &bytes[0..4] == b"PK\x03\x04" {
                                if let Some(parent) = jar_path.parent() {
                                    let _ = std::fs::create_dir_all(parent);
                                }
                                match std::fs::write(&jar_path, &bytes) {
                                    Ok(_) => tracing::info!("authlib-injector.jar auto-downloaded successfully ({} bytes)", bytes.len()),
                                    Err(e) => tracing::warn!("Failed to write authlib-injector.jar: {}", e),
                                }
                            } else {
                                tracing::warn!("Downloaded authlib-injector.jar is not a valid JAR (got {} bytes, not ZIP format), skipping", bytes.len());
                            }
                        }
                    }
                    Err(e) => tracing::warn!("Failed to download authlib-injector.jar: {}", e),
                }
            }
        }

        let args_start = std::time::Instant::now();
        let command = args::build_launch_command(&ctx).await?;
        profile_stages.push(ProfileStage {
            stage: "Build Args".into(),
            duration_ms: args_start.elapsed().as_millis() as u64,
            details: format!("{} JVM args", command.len()),
        });

        tracing::info!("Launching Minecraft with {} args", command.len());
        tracing::info!("Java: {}", &command[0]);
        tracing::info!("Full command: {}", command.join(" "));

        let program = &command[0];
        let cmd_args = &command[1..];

        let spawn_start = std::time::Instant::now();
        let mut child = std::process::Command::new(program)
            .args(cmd_args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                self.force_set_state(LaunchState::Error);
                LauncherError::LaunchFailed(format!("Failed to spawn process: {}", e))
            })?;
        profile_stages.push(ProfileStage {
            stage: "Process Spawn".into(),
            duration_ms: spawn_start.elapsed().as_millis() as u64,
            details: format!("PID {}", child.id()),
        });

        let pid = child.id();
        tracing::info!("Game process started with PID: {}", pid);

        if let Some(ref games) = self.running_games {
            if let Some(ref iid) = self.instance_id {
                let mut g = games.lock();
                if let Some(entry) = g.get_mut(iid) {
                    entry.pid = pid;
                    entry.started_at = std::time::Instant::now();
                }
            }
        }

        self.set_state(LaunchState::Running)?;

        // Drain stdout and stderr pipes continuously to prevent buffer exhaustion.
        // The OS pipe buffer is typically 64KB; if not drained, the game blocks on write().
        // 保留 JoinHandle，进程退出后 join，确保状态切换前所有 stdout/stderr 落盘
        // （此前丢弃 handle，崩溃时末尾日志可能丢失，影响诊断）。
        let child_stdout = child.stdout.take();
        let child_stderr = child.stderr.take();

        let stdout_handle = child_stdout.map(|stdout| {
            let app_stdout = self.app_handle.clone();
            std::thread::spawn(move || {
                let mut reader = std::io::BufReader::new(stdout);
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).trim_end().to_string();
                            tracing::info!(target: "minecraft_stdout", "{}", text);
                            if let Some(ref app) = app_stdout {
                                let _ = app.emit("game-output", serde_json::json!({
                                    "text": text, "stream": "stdout"
                                }));
                                if let Some(chat) = parse_chat_message(&text) {
                                    let _ = app.emit("chat-message", chat);
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
            })
        });

        let stderr_handle = child_stderr.map(|stderr| {
            let app_stderr = self.app_handle.clone();
            std::thread::spawn(move || {
                let mut reader = std::io::BufReader::new(stderr);
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).trim_end().to_string();
                            tracing::error!(target: "minecraft_stderr", "{}", text);
                            if let Some(ref app) = app_stderr {
                                let _ = app.emit("game-output", serde_json::json!({
                                    "text": text, "stream": "stderr"
                                }));
                            }
                        }
                        Err(_) => break,
                    }
                }
            })
        });

        // Wait for the process to exit
        let state_clone = self.state.clone();
        let instance_id_for_exit = self.instance_id.clone();
        let running_games_for_exit = self.running_games.clone();
        let profile_stages_clone = profile_stages.clone();
        let launch_start_clone = launch_start;
        let app_handle_for_exit = self.app_handle.clone();
        std::thread::spawn(move || {
            // 先 join drain 线程：进程退出后管道 EOF，drain 线程 read 返回 0 自然退出。
            // join 保证状态切换时 stdout/stderr 已全部读取，崩溃末尾日志不丢。
            if let Some(h) = stdout_handle { let _ = h.join(); }
            if let Some(h) = stderr_handle { let _ = h.join(); }

            let output = child.wait();
            let elapsed = launch_instant.elapsed().as_secs();

            // 读取 cancel 标记：cancel_launch 在 kill 前置位，故 wait 返回时已可见。
            // 注意必须在持有 games 锁时 load（返回 bool，Copy），不能返回 &RunningGame
            // 否则引用逃逸出 MutexGuard 生命周期。
            let was_cancelled = running_games_for_exit.as_ref()
                .and_then(|games| {
                    let g = games.lock();
                    instance_id_for_exit.as_ref().and_then(|iid| {
                        g.get(iid).map(|e| e.cancelled.load(std::sync::atomic::Ordering::SeqCst))
                    })
                })
                .unwrap_or(false);

            match output {
                Ok(status) => {
                    let new_state = if was_cancelled {
                        tracing::info!("Game was cancelled by user after {}s", elapsed);
                        LaunchState::Idle
                    } else if status.success() {
                        tracing::info!("Game exited normally after {}s", elapsed);
                        LaunchState::Exited
                    } else {
                        let code = status.code().unwrap_or(-1);
                        tracing::error!("Game crashed with exit code: {} after {}s", code, elapsed);
                        LaunchState::Crashed
                    };
                    // 关键修复：使用 force_set_state 模式（直接修改 + 发射事件），
                    // 确保前端能实时收到崩溃/退出通知，而非依赖 2 秒轮询。
                    {
                        let mut state = state_clone.lock();
                        tracing::info!("Launch state (forced): {:?} -> {:?}", *state, new_state);
                        *state = new_state.clone();
                    }
                    if let Some(ref app) = app_handle_for_exit {
                        let _ = app.emit("launch-state-changed", serde_json::json!({
                            "state": new_state,
                            "instance_id": instance_id_for_exit,
                        }));
                    }
                    if let Some(ref iid) = instance_id_for_exit {
                        if elapsed > 0 && !was_cancelled {
                            if let Err(e) = instance::manager::update_playtime(iid, elapsed) {
                                tracing::warn!("Failed to record playtime for {}: {}", iid, e);
                            }
                        }
                        let total_duration = launch_start_clone.elapsed().as_millis() as u64;
                        let mut final_stages = profile_stages_clone;
                        final_stages.push(ProfileStage {
                            stage: "Total Launch".into(),
                            duration_ms: total_duration,
                            details: format!("{}s session", elapsed),
                        });
                        let profile_path = paths::get_instance_minecraft_dir(iid).join("launch_profile.json");
                        if let Ok(json) = serde_json::to_string_pretty(&final_stages) {
                            let _ = std::fs::write(&profile_path, json);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to wait for game process: {}", e);
                    let mut state = state_clone.lock();
                    *state = LaunchState::Error;
                    drop(state);
                }
            }
            // 无条件停止皮肤服务器：此前仅 Ok 分支停止，Err 分支
            // （wait 失败）会泄漏 axum 监听任务，下次启动端口冲突。
            crate::auth::skin_server::stop_skin_server();
            if let Some(ref games) = running_games_for_exit {
                if let Some(ref iid) = instance_id_for_exit {
                    let mut g = games.lock();
                    if let Some(entry) = g.get_mut(iid) {
                        let s = entry.state.lock();
                        // Idle 也算终态（cancel 路径），需清理 pid。
                        if matches!(*s, LaunchState::Exited | LaunchState::Crashed | LaunchState::Error | LaunchState::Idle) {
                            drop(s);
                            entry.pid = 0;
                            tracing::info!("Instance {} marked as terminated, waiting for reset", iid);
                        }
                    }
                }
            }
        });

        Ok(())
    }

    fn check_files(&self, ctx: &LaunchContext) -> Vec<String> {
        let mut missing = Vec::new();

        // 关键修复：client JAR 文件名是原始版本 ID（如 1.21.jar），
        // 而非 loader 版本 ID（如 fabric-loader-0.15.11-1.21）。
        // 版本文件存储在原始版本目录下，使用 loader 版本 ID 会导致文件找不到 → 误判缺失 → 重新下载 → 启动失败。
        let client_jar = ctx.version_dir.join(format!("{}.jar", ctx.original_version_id));
        if !client_jar.exists() {
            missing.push(client_jar.to_string_lossy().to_string());
        }

        let libraries_dir = paths::get_libraries_dir();
        for lib in &ctx.version.libraries {
            let lib_path = libraries_dir.join(&lib.path);
            if !lib_path.exists() {
                missing.push(lib_path.to_string_lossy().to_string());
            }
        }

        for lib in &ctx.version.native_libraries {
            let lib_path = libraries_dir.join(&lib.path);
            if !lib_path.exists() {
                missing.push(lib_path.to_string_lossy().to_string());
            }
        }

        if !ctx.natives_dir.exists() || ctx.natives_dir.read_dir().map(|mut d| d.next().is_none()).unwrap_or(true) {
            missing.push(format!("natives dir empty: {}", ctx.natives_dir.display()));
        }

        if let Some(java_ver) = platform::java::check_java_version(&ctx.java_path) {
            let required = ctx.version.java_version.major_version;
            if java_ver < required {
                tracing::warn!(
                    "Java {} may be incompatible with Minecraft {} (requires Java {})",
                    java_ver, ctx.version.id, required
                );
            }
        }

        missing
    }

    async fn download_missing(&self, ctx: &LaunchContext, missing: &[String]) -> Result<(), LauncherError> {
        let libraries_dir = paths::get_libraries_dir();
        let mut tasks: Vec<crate::download::queue::DownloadTask> = Vec::new();
        let mut need_natives_extract = false;

        for path_str in missing {
            let path = std::path::Path::new(path_str);
            if path_str.starts_with("natives dir empty") {
                let natives_dir = ctx.natives_dir.clone();
                tokio::task::spawn_blocking(move || {
                    let _ = std::fs::create_dir_all(&natives_dir);
                }).await.map_err(|e| LauncherError::TaskJoinFailed(e.to_string()))?;
                for lib in &ctx.version.native_libraries {
                    let lib_path = libraries_dir.join(&lib.path);
                    if lib_path.exists() {
                        need_natives_extract = true;
                    } else {
                        tasks.push(crate::download::queue::DownloadTask::new(
                            &lib.url, libraries_dir.join(&lib.path), &lib.sha1, lib.size,
                        ));
                    }
                }
                continue;
            }

            let lib_artifact = ctx.version.libraries.iter()
                .chain(ctx.version.native_libraries.iter())
                .find(|lib| libraries_dir.join(&lib.path) == path);

            if let Some(artifact) = lib_artifact {
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                tasks.push(crate::download::queue::DownloadTask::new(
                    &artifact.url, path, &artifact.sha1, artifact.size,
                ));
            } else if path.extension().map_or(false, |e| e == "jar") {
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                tasks.push(crate::download::queue::DownloadTask::new(
                    &ctx.version.client_jar.url, path, &ctx.version.client_jar.sha1, ctx.version.client_jar.size,
                ));
            }
        }

        if !tasks.is_empty() {
            tracing::info!("Downloading {} missing files...", tasks.len());
            let queue = crate::download::queue::DownloadQueue::new();
            let results = queue.download_all(tasks).await?;
            let errors: Vec<_> = results.into_iter().filter_map(|r| r.err()).collect();
            if !errors.is_empty() {
                tracing::error!("{} files failed to download", errors.len());
                return Err(LauncherError::DownloadFailed(
                    format!("Failed to download {}/{} missing files", errors.len(), errors.len())
                ));
            }
        }

        if need_natives_extract {
            let natives_dir = ctx.natives_dir.clone();
            let native_libs: Vec<_> = ctx.version.native_libraries.iter()
                .map(|lib| (libraries_dir.join(&lib.path), natives_dir.clone()))
                .collect();
            tokio::task::spawn_blocking(move || {
                for (lib_path, nd) in &native_libs {
                    if lib_path.exists() {
                        if let Err(e) = crate::commands::launch::extract_natives_public(lib_path, nd) {
                            tracing::warn!("Failed to extract natives from {}: {}", lib_path.display(), e);
                        }
                    }
                }
            }).await.map_err(|e| LauncherError::TaskJoinFailed(e.to_string()))?;
        }

        Ok(())
    }
}

use crate::platform::paths;

#[derive(Debug, Clone, serde::Serialize)]
struct ProfileStage {
    stage: String,
    duration_ms: u64,
    details: String,
}

#[derive(Debug, Clone, serde::Serialize)]
struct ChatMessage {
    player: String,
    message: String,
    timestamp: i64,
}

fn parse_chat_message(line: &str) -> Option<ChatMessage> {
    let patterns: &[&str] = &[
        "[Chat] ",
        "[Async Chat Thread",
        "[Server thread/INFO]: <",
        "[Server thread/INFO]: [",
    ];

    let trimmed = line.trim();

    for pattern in patterns {
        if let Some(idx) = trimmed.find(pattern) {
            let after = &trimmed[idx + pattern.len()..];

            if pattern.ends_with("<") {
                if let Some(gt) = after.find('>') {
                    let player = after[..gt].to_string();
                    let message = after.get(gt + 2..).unwrap_or("").to_string();
                    if !player.is_empty() {
                        return Some(ChatMessage {
                            player,
                            message,
                            timestamp: chrono::Utc::now().timestamp_millis(),
                        });
                    }
                }
            } else if *pattern == "[Chat] " {
                if let Some(gt) = after.find('>') {
                    if after.starts_with('<') {
                        let player = after[1..gt].to_string();
                        let message = after.get(gt + 2..).unwrap_or("").to_string();
                        if !player.is_empty() {
                            return Some(ChatMessage {
                                player,
                                message,
                                timestamp: chrono::Utc::now().timestamp_millis(),
                            });
                        }
                    }
                }
                let colon_msg = after.trim();
                if !colon_msg.is_empty() && !colon_msg.starts_with('[') {
                    return Some(ChatMessage {
                        player: String::new(),
                        message: colon_msg.to_string(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    });
                }
            } else if *pattern == "[Server thread/INFO]: [" {
                if let Some(bracket_end) = after.find(']') {
                    let player = after[..bracket_end].to_string();
                    let message = after.get(bracket_end + 2..).unwrap_or("").trim_start_matches(':').trim().to_string();
                    if !player.is_empty() {
                        return Some(ChatMessage {
                            player,
                            message,
                            timestamp: chrono::Utc::now().timestamp_millis(),
                        });
                    }
                }
            } else {
                let colon_msg = after.trim();
                if !colon_msg.is_empty() {
                    return Some(ChatMessage {
                        player: String::new(),
                        message: colon_msg.to_string(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    });
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::launch::state::LaunchState;

    fn make_process(initial: LaunchState) -> LaunchProcess {
        LaunchProcess::new(Arc::new(Mutex::new(initial)))
    }

    #[test]
    fn set_state_valid_idle_to_checking() {
        let lp = make_process(LaunchState::Idle);
        assert!(lp.set_state(LaunchState::Checking).is_ok());
    }

    #[test]
    fn set_state_valid_checking_to_downloading() {
        let lp = make_process(LaunchState::Checking);
        assert!(lp.set_state(LaunchState::Downloading).is_ok());
    }

    #[test]
    fn set_state_valid_checking_to_launching() {
        let lp = make_process(LaunchState::Checking);
        assert!(lp.set_state(LaunchState::Launching).is_ok());
    }

    #[test]
    fn set_state_valid_downloading_to_validating() {
        let lp = make_process(LaunchState::Downloading);
        assert!(lp.set_state(LaunchState::Validating).is_ok());
    }

    #[test]
    fn set_state_valid_validating_to_launching() {
        let lp = make_process(LaunchState::Validating);
        assert!(lp.set_state(LaunchState::Launching).is_ok());
    }

    #[test]
    fn set_state_valid_launching_to_running() {
        let lp = make_process(LaunchState::Launching);
        assert!(lp.set_state(LaunchState::Running).is_ok());
    }

    #[test]
    fn set_state_valid_running_to_exited() {
        let lp = make_process(LaunchState::Running);
        assert!(lp.set_state(LaunchState::Exited).is_ok());
    }

    #[test]
    fn set_state_valid_running_to_crashed() {
        let lp = make_process(LaunchState::Running);
        assert!(lp.set_state(LaunchState::Crashed).is_ok());
    }

    #[test]
    fn set_state_valid_error_to_idle() {
        let lp = make_process(LaunchState::Error);
        assert!(lp.set_state(LaunchState::Idle).is_ok());
    }

    #[test]
    fn set_state_valid_exited_to_idle() {
        let lp = make_process(LaunchState::Exited);
        assert!(lp.set_state(LaunchState::Idle).is_ok());
    }

    #[test]
    fn set_state_valid_crashed_to_idle() {
        let lp = make_process(LaunchState::Crashed);
        assert!(lp.set_state(LaunchState::Idle).is_ok());
    }

    #[test]
    fn set_state_invalid_running_to_checking() {
        let lp = make_process(LaunchState::Running);
        assert!(lp.set_state(LaunchState::Checking).is_err());
    }

    #[test]
    fn set_state_invalid_idle_to_running() {
        let lp = make_process(LaunchState::Idle);
        assert!(lp.set_state(LaunchState::Running).is_err());
    }

    #[test]
    fn set_state_invalid_idle_to_downloading() {
        let lp = make_process(LaunchState::Idle);
        assert!(lp.set_state(LaunchState::Downloading).is_err());
    }

    #[test]
    fn set_state_invalid_exited_to_launching() {
        let lp = make_process(LaunchState::Exited);
        assert!(lp.set_state(LaunchState::Launching).is_err());
    }

    #[test]
    fn set_state_invalid_checking_to_running() {
        let lp = make_process(LaunchState::Checking);
        assert!(lp.set_state(LaunchState::Running).is_err());
    }

    #[test]
    fn set_state_invalid_downloading_to_running() {
        let lp = make_process(LaunchState::Downloading);
        assert!(lp.set_state(LaunchState::Running).is_err());
    }

    #[test]
    fn force_set_state_allows_any_transition() {
        let lp = make_process(LaunchState::Running);
        lp.force_set_state(LaunchState::Checking);
        assert_eq!(*lp.state.lock(), LaunchState::Checking);
    }

    #[test]
    fn force_set_state_idle_to_error() {
        let lp = make_process(LaunchState::Idle);
        lp.force_set_state(LaunchState::Error);
        assert_eq!(*lp.state.lock(), LaunchState::Error);
    }

    #[test]
    fn force_set_state_error_to_running() {
        let lp = make_process(LaunchState::Error);
        lp.force_set_state(LaunchState::Running);
        assert_eq!(*lp.state.lock(), LaunchState::Running);
    }

    #[test]
    fn set_state_updates_internal_state() {
        let lp = make_process(LaunchState::Idle);
        lp.set_state(LaunchState::Checking).unwrap();
        assert_eq!(*lp.state.lock(), LaunchState::Checking);
    }

    #[test]
    fn set_state_does_not_update_on_invalid() {
        let lp = make_process(LaunchState::Idle);
        let _ = lp.set_state(LaunchState::Running);
        assert_eq!(*lp.state.lock(), LaunchState::Idle);
    }

    #[test]
    fn sequential_valid_transitions() {
        let lp = make_process(LaunchState::Idle);
        lp.set_state(LaunchState::Checking).unwrap();
        lp.set_state(LaunchState::Downloading).unwrap();
        lp.set_state(LaunchState::Checking).unwrap();
        lp.set_state(LaunchState::Launching).unwrap();
        lp.set_state(LaunchState::Running).unwrap();
        lp.set_state(LaunchState::Exited).unwrap();
        assert_eq!(*lp.state.lock(), LaunchState::Exited);
    }
}
