use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::error::LauncherError;
use crate::platform::paths;

pub struct CrashWatcherState {
    pub watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
}

impl CrashWatcherState {
    pub fn new() -> Self {
        CrashWatcherState {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub async fn start_crash_watcher(
    app: tauri::AppHandle,
    state: &CrashWatcherState,
    instance_id: &str,
) -> Result<(), LauncherError> {
    let mut watchers = state.watchers.lock().await;
    if watchers.contains_key(instance_id) {
        return Ok(());
    }

    let instance_dir = paths::get_instance_dir(instance_id);
    let mc_dir = instance_dir.join(".minecraft");

    let dirs_to_watch: Vec<PathBuf> = vec![
        mc_dir.join("crash-reports"),
        mc_dir.join("logs"),
    ];

    let app_handle = app.clone();
    let iid = instance_id.to_string();

    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        match res {
            Ok(event) => {
                if event.kind.is_create() || event.kind.is_modify() {
                    for path in &event.paths {
                        let path_str = path.to_string_lossy().to_string();
                        if path_str.ends_with(".txt") {
                            let _ = app_handle.emit(
                                "crash:detected",
                                serde_json::json!({
                                    "instance_id": iid,
                                    "path": path_str,
                                    "kind": format!("{:?}", event.kind),
                                }),
                            );
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Crash watcher error for instance {}: {}", iid, e);
            }
        }
    })
    .map_err(|e| LauncherError::CrashWatcherError(format!("Failed to create watcher: {}", e)))?;

    for dir in &dirs_to_watch {
        if dir.exists() {
            watcher
                .watch(dir, RecursiveMode::NonRecursive)
                .map_err(|e| {
                    LauncherError::CrashWatcherError(format!(
                        "Failed to watch directory {}: {}",
                        dir.display(),
                        e
                    ))
                })?;
        }
    }

    watchers.insert(instance_id.to_string(), watcher);
    tracing::info!("Crash watcher started for instance {}", instance_id);
    Ok(())
}

pub async fn stop_crash_watcher(
    state: &CrashWatcherState,
    instance_id: &str,
) -> Result<(), LauncherError> {
    let mut watchers = state.watchers.lock().await;
    if let Some(mut watcher) = watchers.remove(instance_id) {
        watcher.unwatch(PathBuf::from(".").as_path()).ok();
        tracing::info!("Crash watcher stopped for instance {}", instance_id);
    }
    Ok(())
}
