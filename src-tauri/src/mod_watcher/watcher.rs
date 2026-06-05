use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};
use crate::error::LauncherError;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ModDirectoryChangeEvent {
    pub instance_id: String,
    pub change_type: String,
    pub file_name: String,
    pub directory: String,
}

struct WatchedInstance {
    _watcher: RecommendedWatcher,
}

pub struct ModWatcherState {
    watched: Arc<Mutex<HashMap<String, WatchedInstance>>>,
    app: AppHandle,
}

impl ModWatcherState {
    pub fn new(app: AppHandle) -> Self {
        Self {
            watched: Arc::new(Mutex::new(HashMap::new())),
            app,
        }
    }
}

pub async fn watch_instance(
    state: &ModWatcherState,
    instance_id: String,
    instance_dir: PathBuf,
) -> Result<(), LauncherError> {
    let subdirs = ["mods", "resourcepacks", "shaderpacks"];
    let mut valid_paths = Vec::new();
    for subdir in &subdirs {
        let path = instance_dir.join(subdir);
        if path.exists() {
            valid_paths.push(path);
        }
    }
    if valid_paths.is_empty() {
        return Ok(());
    }

    let app = state.app.clone();
    let iid = instance_id.clone();
    let dir_str = instance_dir.to_string_lossy().to_string();

    let mut watcher = notify::recommended_watcher(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                let change_type = match event.kind {
                    notify::EventKind::Create(_) => "added",
                    notify::EventKind::Remove(_) => "removed",
                    notify::EventKind::Modify(_) => "modified",
                    _ => return,
                };
                if let Some(path) = event.paths.first() {
                    let file_name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if ext == "jar" || ext == "zip" || ext == "disabled" {
                        let _ = app.emit("mod-directory-changed", ModDirectoryChangeEvent {
                            instance_id: iid.clone(),
                            change_type: change_type.to_string(),
                            file_name,
                            directory: dir_str.clone(),
                        });
                    }
                }
            }
        },
    ).map_err(|e| LauncherError::FileWatch(format!("Failed to create watcher: {}", e)))?;

    for path in &valid_paths {
        watcher.watch(path, RecursiveMode::NonRecursive)
            .map_err(|e| LauncherError::FileWatch(format!("Failed to watch {:?}: {}", path, e)))?;
    }

    let mut watched = state.watched.lock().await;
    watched.insert(instance_id, WatchedInstance { _watcher: watcher });
    Ok(())
}

pub async fn unwatch_instance(
    state: &ModWatcherState,
    instance_id: &str,
) -> Result<(), LauncherError> {
    let mut watched = state.watched.lock().await;
    watched.remove(instance_id);
    Ok(())
}

pub async fn unwatch_all(state: &ModWatcherState) -> Result<(), LauncherError> {
    let mut watched = state.watched.lock().await;
    watched.clear();
    Ok(())
}
