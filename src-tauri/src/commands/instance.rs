use crate::crash_parser;
use crate::download::queue::DownloadQueue;
use crate::error::LauncherError;
use crate::instance;
use crate::loader;
use crate::platform::paths;
use crate::version;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SnapshotInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub async fn get_game_dir() -> Result<String, LauncherError> {
    Ok(paths::get_game_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_default_game_dir() -> Result<String, LauncherError> {
    Ok(paths::get_default_game_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_instances() -> Result<Vec<instance::manager::GameInstance>, LauncherError> {
    instance::manager::list_instances()
}

#[tauri::command]
pub async fn create_instance(instance: instance::manager::GameInstance) -> Result<(), LauncherError> {
    instance::manager::create_instance(&instance)
}

#[tauri::command]
pub async fn delete_instance(id: String) -> Result<(), LauncherError> {
    instance::manager::delete_instance(&id)
}

#[tauri::command]
pub async fn update_instance(instance: instance::manager::GameInstance) -> Result<(), LauncherError> {
    instance::manager::update_instance(&instance)
}

#[tauri::command]
pub async fn get_instance(id: String) -> Result<Option<instance::manager::GameInstance>, LauncherError> {
    instance::manager::get_instance(&id)
}

#[tauri::command]
pub async fn duplicate_instance(id: String, new_name: String) -> Result<instance::manager::GameInstance, LauncherError> {
    instance::manager::duplicate_instance(&id, &new_name)
}

#[tauri::command]
pub async fn export_instance(id: String, output_path: String) -> Result<(), LauncherError> {
    instance::manager::export_instance(&id, std::path::Path::new(&output_path))
}

#[tauri::command]
pub async fn import_modpack(path: String) -> Result<instance::manager::GameInstance, LauncherError> {
    instance::manager::import_modpack(&path).await
}

#[tauri::command]
pub async fn detect_modpack_format(path: String) -> Result<instance::manager::ModpackFormat, LauncherError> {
    instance::manager::detect_modpack_format(&path)
}

#[tauri::command]
pub async fn import_modpack_auto(path: String) -> Result<instance::manager::GameInstance, LauncherError> {
    instance::manager::import_modpack_auto(&path).await
}

#[tauri::command]
pub async fn export_mrpack(id: String, output_path: String) -> Result<(), LauncherError> {
    instance::manager::export_mrpack(&id, std::path::Path::new(&output_path)).await
}

#[tauri::command]
pub async fn parse_crash_report(report_path: String) -> Result<crash_parser::CrashInfo, LauncherError> {
    crash_parser::parse_crash_report(&report_path)
}

#[tauri::command]
pub async fn diagnose_crash(report_path: String) -> Result<crash_parser::CrashDiagnosis, LauncherError> {
    crash_parser::diagnose_crash(&report_path)
}

#[tauri::command]
pub async fn check_instance_ready(instance_id: String) -> Result<bool, LauncherError> {
    instance::manager::check_instance_ready(&instance_id)
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), LauncherError> {
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
    let cmd = if cfg!(target_os = "windows") {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    std::process::Command::new(cmd)
        .arg(&p)
        .spawn()
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn get_loader_versions(loader_type: String) -> Result<Vec<String>, LauncherError> {
    let lt = loader::LoaderType::from_str(&loader_type)
        .ok_or_else(|| LauncherError::Other(format!("Unknown loader: {}", loader_type)))?;
    loader::fetch_loader_versions(&lt).await
}

#[tauri::command]
pub async fn install_loader(
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
        let tasks = crate::download::queue::build_library_download_tasks(&result.extra_libraries);
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

#[tauri::command]
pub async fn create_snapshot(instance_id: String, name: String) -> Result<SnapshotInfo, LauncherError> {
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
pub async fn list_snapshots(instance_id: String) -> Result<Vec<SnapshotInfo>, LauncherError> {
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
pub async fn restore_snapshot(instance_id: String, snapshot_id: String) -> Result<(), LauncherError> {
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
pub async fn delete_snapshot(instance_id: String, snapshot_id: String) -> Result<(), LauncherError> {
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

pub fn dir_size(path: &std::path::Path) -> u64 {
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
