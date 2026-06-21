use crate::crash_parser;
use crate::download::queue::DownloadQueue;
use crate::error::LauncherError;
use crate::instance;
use crate::loader;
use crate::platform;
use crate::platform::paths;
use crate::security::sanitizer;
use crate::version;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceGroup {
    pub name: String,
    pub instance_ids: Vec<String>,
    pub collapsed: bool,
}

#[tauri::command]
pub async fn get_instance_groups() -> Result<Vec<InstanceGroup>, LauncherError> {
    let config = crate::config::load_config()?;
    let game_dir = std::path::PathBuf::from(config.game_dir.unwrap_or_default());
    let groups_path = game_dir.join("instance_groups.json");

    if !groups_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&groups_path)?;
    let groups: Vec<InstanceGroup> = serde_json::from_str(&content)?;
    Ok(groups)
}

#[tauri::command]
pub async fn save_instance_groups(groups: Vec<InstanceGroup>) -> Result<(), LauncherError> {
    let config = crate::config::load_config()?;
    let game_dir = std::path::PathBuf::from(config.game_dir.unwrap_or_default());
    let groups_path = game_dir.join("instance_groups.json");

    let content = serde_json::to_string_pretty(&groups)?;
    std::fs::write(&groups_path, content)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceCheckResult {
    pub instance_id: String,
    pub is_ready: bool,
    pub has_anomalies: bool,
    pub anomaly_details: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckItem {
    pub name: String,
    pub status: String,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthCheckReport {
    pub instance_id: String,
    pub items: Vec<HealthCheckItem>,
    pub overall: String,
}

#[tauri::command]
pub async fn health_check(instance_id: String) -> Result<HealthCheckReport, LauncherError> {
    let inst = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::InstanceNotReady(instance_id.clone()))?;

    let mut items: Vec<HealthCheckItem> = Vec::new();

    let libraries_dir = paths::get_instance_libraries_dir(&instance_id);
    if libraries_dir.exists() {
        let jar_count = std::fs::read_dir(&libraries_dir)
            .map(|d| d.filter_map(|e| e.ok()).count())
            .unwrap_or(0);
        if jar_count > 0 {
            items.push(HealthCheckItem {
                name: "libraries".into(),
                status: "pass".into(),
                message: format!("{} library files present", jar_count),
                suggestion: None,
            });
        } else {
            items.push(HealthCheckItem {
                name: "libraries".into(),
                status: "warn".into(),
                message: "Library directory is empty".into(),
                suggestion: Some("Re-download the version to populate libraries".into()),
            });
        }
    } else {
        items.push(HealthCheckItem {
            name: "libraries".into(),
            status: "fail".into(),
            message: "Library directory does not exist".into(),
            suggestion: Some("Re-download the version to create library directory".into()),
        });
    }

    let java_path = inst.java_path.as_deref().unwrap_or("java");
    let java_path_buf = std::path::PathBuf::from(java_path);
    let java_ver = platform::java::check_java_version(&java_path_buf);
    let required_java = version::resolver::resolve_version_with_parents(&inst.version_id, &inst.version_url)
        .await
        .map(|v| v.java_version.major_version)
        .ok();

    match (java_ver, required_java) {
        (Some(current), Some(required)) => {
            if current >= required {
                items.push(HealthCheckItem {
                    name: "jre_compatibility".into(),
                    status: "pass".into(),
                    message: format!("Java {} meets requirement (Java {})", current, required),
                    suggestion: None,
                });
            } else {
                items.push(HealthCheckItem {
                    name: "jre_compatibility".into(),
                    status: "fail".into(),
                    message: format!("Java {} is below required Java {}", current, required),
                    suggestion: Some("Update Java or let BonNext auto-download a compatible JRE".into()),
                });
            }
        }
        (Some(current), None) => {
            items.push(HealthCheckItem {
                name: "jre_compatibility".into(),
                status: "pass".into(),
                message: format!("Java {} detected (version requirement unknown)", current),
                suggestion: None,
            });
        }
        (None, _) => {
            items.push(HealthCheckItem {
                name: "jre_compatibility".into(),
                status: "warn".into(),
                message: "Java not found at configured path".into(),
                suggestion: Some("Install Java or configure the path in Settings".into()),
            });
        }
    }

    let game_dir = paths::get_game_dir();
    let available_mb = {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        let mount = game_dir.canonicalize().unwrap_or_else(|_| game_dir.clone());
        disks
            .iter()
            .filter(|d: &&sysinfo::Disk| mount.starts_with(d.mount_point()))
            .max_by_key(|d: &&sysinfo::Disk| d.mount_point().components().count())
            .map(|d: &sysinfo::Disk| d.available_space() / 1_048_576)
            .unwrap_or(0)
    };
    let required_mb = (inst.max_memory as u64) + 512;
    if available_mb >= required_mb {
        items.push(HealthCheckItem {
            name: "disk_space".into(),
            status: "pass".into(),
            message: format!("{}MB available (need ~{}MB)", available_mb, required_mb),
            suggestion: None,
        });
    } else if available_mb > 256 {
        items.push(HealthCheckItem {
            name: "disk_space".into(),
            status: "warn".into(),
            message: format!("Only {}MB available (recommended {}MB)", available_mb, required_mb),
            suggestion: Some("Free up disk space to avoid launch issues".into()),
        });
    } else {
        items.push(HealthCheckItem {
            name: "disk_space".into(),
            status: "fail".into(),
            message: format!("Only {}MB available, game may not launch", available_mb),
            suggestion: Some("Free up disk space immediately".into()),
        });
    }

    let version_jar = paths::get_instance_versions_dir(&instance_id)
        .join(&inst.version_id)
        .join(format!("{}.jar", inst.version_id));
    if version_jar.exists() {
        items.push(HealthCheckItem {
            name: "version_jar".into(),
            status: "pass".into(),
            message: format!("Version JAR exists: {}.jar", inst.version_id),
            suggestion: None,
        });
    } else {
        let shared_jar = paths::get_versions_dir()
            .join(&inst.version_id)
            .join(format!("{}.jar", inst.version_id));
        if shared_jar.exists() {
            items.push(HealthCheckItem {
                name: "version_jar".into(),
                status: "pass".into(),
                message: format!("Version JAR exists in shared dir: {}.jar", inst.version_id),
                suggestion: None,
            });
        } else {
            items.push(HealthCheckItem {
                name: "version_jar".into(),
                status: "fail".into(),
                message: format!("Version JAR missing: {}.jar", inst.version_id),
                suggestion: Some("Re-download this version to get the client JAR".into()),
            });
        }
    }

    let has_fail = items.iter().any(|i| i.status == "fail");
    let has_warn = items.iter().any(|i| i.status == "warn");
    let overall = if has_fail { "fail" } else if has_warn { "warn" } else { "pass" };

    Ok(HealthCheckReport {
        instance_id,
        items,
        overall: overall.to_string(),
    })
}

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
pub async fn create_instance(app: tauri::AppHandle, instance: instance::manager::GameInstance) -> Result<(), LauncherError> {
    instance::manager::create_instance(&instance)?;
    crate::commands::achievement::try_unlock_achievement(&app, "create_instance");
    Ok(())
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
pub async fn import_modpack(app: tauri::AppHandle, path: String) -> Result<instance::manager::GameInstance, LauncherError> {
    let result = instance::manager::import_modpack(&path, Some(&app)).await?;
    crate::commands::achievement::try_unlock_achievement(&app, "import_modpack");
    Ok(result)
}

#[tauri::command]
pub async fn detect_modpack_format(path: String) -> Result<instance::manager::ModpackFormat, LauncherError> {
    instance::manager::detect_modpack_format(&path)
}

#[tauri::command]
pub async fn import_modpack_auto(app: tauri::AppHandle, path: String) -> Result<instance::manager::GameInstance, LauncherError> {
    let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    if file_size == 0 {
        return Err(LauncherError::InvalidConfig("Modpack file is empty".into()));
    }
    if file_size > 2 * 1024 * 1024 * 1024 {
        return Err(LauncherError::InvalidConfig("Modpack file is too large (max 2GB)".into()));
    }
    let _ = app.emit("modpack-import-progress", serde_json::json!({"stage": "detecting", "path": path}));
    let result = instance::manager::import_modpack_auto(&path, Some(&app)).await?;
    crate::commands::achievement::try_unlock_achievement(&app, "import_modpack");
    let _ = app.emit("modpack-import-progress", serde_json::json!({"stage": "completed", "instanceId": result.id}));
    Ok(result)
}

#[tauri::command]
pub async fn export_mrpack(app: tauri::AppHandle, id: String, output_path: String) -> Result<(), LauncherError> {
    instance::manager::export_mrpack(&id, std::path::Path::new(&output_path)).await?;
    crate::commands::achievement::try_unlock_achievement(&app, "export_modpack");
    Ok(())
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
pub async fn diagnose_instance_crash(instance_id: String) -> Result<crash_parser::CrashDiagnosis, LauncherError> {
    let game_dir = &crate::platform::paths::get_game_dir();
    let crash_dir = game_dir
        .join("instances")
        .join(&instance_id)
        .join(".minecraft")
        .join("crash-reports");

    if !crash_dir.exists() {
        return Ok(crash_parser::CrashDiagnosis {
            crash_info: crash_parser::CrashInfo {
                description: "No crash reports directory found".to_string(),
                suggestion: "The instance may not have crashed yet, or crash reports are in a different location".to_string(),
                severity: "low".to_string(),
                error_type: "unknown".to_string(),
            },
            additional_findings: vec![],
            auto_fix_available: false,
            auto_fix_action: None,
        });
    }

    let mut reports: Vec<_> = std::fs::read_dir(&crash_dir)
        .map_err(|e| LauncherError::Other(format!("Cannot read crash-reports dir: {}", e)))?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().starts_with("crash-"))
        .collect();

    if reports.is_empty() {
        return Ok(crash_parser::CrashDiagnosis {
            crash_info: crash_parser::CrashInfo {
                description: "No crash reports found".to_string(),
                suggestion: "The instance may not have crashed recently".to_string(),
                severity: "low".to_string(),
                error_type: "unknown".to_string(),
            },
            additional_findings: vec![],
            auto_fix_available: false,
            auto_fix_action: None,
        });
    }

    reports.sort_by_key(|e| e.file_name());
    let latest = reports.last().unwrap();
    crash_parser::diagnose_crash(&latest.path().to_string_lossy())
}

#[tauri::command]
pub async fn diagnose_crash_from_content(log_content: String) -> Result<crash_parser::CrashDiagnosis, LauncherError> {
    crate::crash_parser::diagnose_from_content(&log_content)
}

#[tauri::command]
pub async fn check_instance_ready(instance_id: String) -> Result<bool, LauncherError> {
    instance::manager::check_instance_ready(&instance_id)
}

#[tauri::command]
pub async fn batch_check_instances(instance_ids: Vec<String>) -> Result<Vec<InstanceCheckResult>, LauncherError> {
    let mut results = Vec::with_capacity(instance_ids.len());
    for id in instance_ids {
        let is_ready = instance::manager::check_instance_ready(&id).unwrap_or(false);
        results.push(InstanceCheckResult {
            instance_id: id,
            is_ready,
            has_anomalies: false,
            anomaly_details: Vec::new(),
        });
    }
    Ok(results)
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), LauncherError> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(LauncherError::VersionNotFound(format!("Path does not exist: {}", path)));
    }
    let canonical = p.canonicalize()?;
    let game_dir = paths::get_game_dir().canonicalize().unwrap_or_else(|_| paths::get_game_dir());
    let config_dir = paths::get_config_dir().canonicalize().unwrap_or_else(|_| paths::get_config_dir());
    let default_game_dir = paths::get_default_game_dir().canonicalize().unwrap_or_else(|_| paths::get_default_game_dir());
    let is_allowed = canonical.starts_with(&game_dir)
        || canonical.starts_with(&config_dir)
        || canonical.starts_with(&default_game_dir);
    if !is_allowed {
        return Err(LauncherError::SecurityValidation("Access denied: path outside allowed directories".into()));
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
        .map_err(|e| LauncherError::Other(format!("spawning process for {}: {}", p.display(), e)))?;
    Ok(())
}

#[tauri::command]
pub async fn get_loader_versions(loader_type: String) -> Result<Vec<String>, LauncherError> {
    let lt = loader::LoaderType::from_str(&loader_type)
        .ok_or_else(|| LauncherError::InvalidConfig(format!("Unknown loader: {}", loader_type)))?;
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
        .ok_or_else(|| LauncherError::InvalidConfig(format!("Unknown loader: {}", loader_type)))?;
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
pub async fn create_snapshot(app: tauri::AppHandle, instance_id: String, name: String) -> Result<SnapshotInfo, LauncherError> {
    let instance_dir = paths::get_instance_dir(&instance_id);
    if !instance_dir.exists() {
        return Err(LauncherError::InstanceNotReady(format!("Instance not found: {}", instance_id)));
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

    crate::commands::achievement::try_unlock_achievement(&app, "use_snapshot");
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
        return Err(LauncherError::InstanceNotReady(format!("Snapshot not found: {}", snapshot_id)));
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

#[tauri::command]
pub async fn toggle_mod(instance_id: String, filename: String) -> Result<bool, LauncherError> {
    let dir = paths::get_instance_mods_dir(&instance_id);
    let current_path = dir.join(&filename);

    if !current_path.exists() {
        return Err(LauncherError::Other(format!("File not found: {}", filename)));
    }

    let (src, dst, new_enabled) = if filename.ends_with(".disabled") {
        let enabled_name = &filename[..filename.len() - ".disabled".len()];
        (current_path, dir.join(enabled_name), true)
    } else {
        (current_path, dir.join(format!("{}.disabled", filename)), false)
    };

    tokio::fs::rename(&src, &dst).await?;
    tracing::info!(
        "Toggled mod: {} -> {} for instance {}",
        filename,
        if new_enabled { "enabled" } else { "disabled" },
        instance_id
    );
    Ok(new_enabled)
}

#[tauri::command]
pub async fn detect_launchers() -> Result<Vec<instance::migration::DetectedLauncher>, LauncherError> {
    instance::migration::detect_installed_launchers()
}

#[tauri::command]
pub async fn scan_launcher_instances(
    launcher_type: String,
    game_dir: String,
) -> Result<Vec<instance::migration::MigrateableInstance>, LauncherError> {
    instance::migration::scan_launcher_instances(&launcher_type, &game_dir)
}

#[tauri::command]
pub async fn scan_custom_directory(
    path: String,
) -> Result<Vec<instance::migration::MigrateableInstance>, LauncherError> {
    instance::migration::scan_custom_directory(&path)
}

#[tauri::command]
pub async fn migrate_instance(
    app: tauri::AppHandle,
    name: String,
    version_id: String,
    loader_type: Option<String>,
    loader_version: Option<String>,
    source_game_dir: String,
    launcher_type: String,
    java_path: Option<String>,
    jvm_args: Option<String>,
    min_memory: Option<u32>,
    max_memory: Option<u32>,
) -> Result<instance::manager::GameInstance, LauncherError> {
    let _ = app.emit("migration-progress", serde_json::json!({"stage": "migrating", "name": name}));
    let result = instance::migration::migrate_instance(
        &name,
        &version_id,
        loader_type.as_deref(),
        loader_version.as_deref(),
        &source_game_dir,
        &launcher_type,
        java_path.as_deref(),
        jvm_args.as_deref(),
        min_memory,
        max_memory,
    ).await?;
    crate::commands::achievement::try_unlock_achievement(&app, "import_modpack");
    let _ = app.emit("migration-progress", serde_json::json!({"stage": "completed", "instanceId": result.id}));
    Ok(result)
}

#[tauri::command]
pub async fn diagnose_migration(
    instance_id: String,
) -> Result<Vec<instance::migration::MigrationIssue>, LauncherError> {
    instance::migration::diagnose_migration_issues(&instance_id)
}

#[tauri::command]
pub async fn fix_migration_issues(
    instance_id: String,
    issues: Vec<instance::migration::MigrationIssue>,
) -> Result<instance::migration::MigrationFixResult, LauncherError> {
    instance::migration::fix_migration_issues(&instance_id, &issues)
}

#[tauri::command]
pub async fn read_config_file(instance_id: String, relative_path: String) -> Result<String, LauncherError> {
    let _ = sanitizer::sanitize_id(&instance_id)?;
    let safe_path = sanitizer::sanitize_path(&relative_path)?;

    let instance_dir = paths::get_instance_dir(&instance_id);
    if !instance_dir.exists() {
        return Err(LauncherError::InstanceNotReady(format!("Instance not found: {}", instance_id)));
    }

    let file_path = instance_dir.join(&safe_path);
    let canonical_instance = instance_dir.canonicalize().unwrap_or_else(|_| instance_dir.clone());
    let canonical_file = file_path.canonicalize().map_err(|_| {
        LauncherError::InvalidConfig(format!("File not found: {}", relative_path))
    })?;

    if !canonical_file.starts_with(&canonical_instance) {
        return Err(LauncherError::SecurityValidation("Path traversal denied".into()));
    }

    if !file_path.exists() {
        return Err(LauncherError::InvalidConfig(format!("File not found: {}", relative_path)));
    }

    let metadata = std::fs::metadata(&file_path)?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::InvalidConfig("File too large for text editing (max 10MB)".into()));
    }

    let bytes = std::fs::read(&file_path)?;
    let is_binary = bytes.iter().any(|&b| b == 0);
    if is_binary {
        return Err(LauncherError::InvalidConfig("Binary file - read-only mode".into()));
    }

    String::from_utf8(bytes).map_err(|_| LauncherError::InvalidConfig("File is not valid UTF-8".into()))
}

#[tauri::command]
pub async fn write_config_file(instance_id: String, relative_path: String, content: String) -> Result<(), LauncherError> {
    let _ = sanitizer::sanitize_id(&instance_id)?;
    let safe_path = sanitizer::sanitize_path(&relative_path)?;

    let instance_dir = paths::get_instance_dir(&instance_id);
    if !instance_dir.exists() {
        return Err(LauncherError::InstanceNotReady(format!("Instance not found: {}", instance_id)));
    }

    let file_path = instance_dir.join(&safe_path);
    let canonical_instance = instance_dir.canonicalize().unwrap_or_else(|_| instance_dir.clone());

    if file_path.exists() {
        let canonical_file = file_path.canonicalize().map_err(|_| {
            LauncherError::InvalidConfig(format!("File not found: {}", relative_path))
        })?;
        if !canonical_file.starts_with(&canonical_instance) {
            return Err(LauncherError::SecurityValidation("Path traversal denied".into()));
        }
    } else {
        let parent = file_path.parent().ok_or_else(|| {
            LauncherError::InvalidConfig("Invalid file path".into())
        })?;
        let canonical_parent = parent.canonicalize().map_err(|_| {
            LauncherError::InvalidConfig("Parent directory not found".into())
        })?;
        if !canonical_parent.starts_with(&canonical_instance) {
            return Err(LauncherError::SecurityValidation("Path traversal denied".into()));
        }
    }

    if content.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::InvalidConfig("Content too large (max 10MB)".into()));
    }

    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(&file_path, &content)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct RepairAction {
    pub action: String,
    pub description: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RepairResult {
    pub instance_id: String,
    pub actions: Vec<RepairAction>,
    pub fixed: bool,
}

#[tauri::command]
pub async fn repair_instance(
    app: tauri::AppHandle,
    instance_id: String,
    control: tauri::State<'_, crate::download::queue::DownloadControlState>,
) -> Result<RepairResult, LauncherError> {
    let inst = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::InstanceNotReady(format!("Instance not found: {}", instance_id)))?;

    let report = health_check(instance_id.clone()).await?;
    let mut actions: Vec<RepairAction> = Vec::new();
    let mut any_fix_applied = false;

    for item in &report.items {
        if item.status == "pass" {
            continue;
        }

        match item.name.as_str() {
            "version_jar" => {
                tracing::info!("Repair: re-downloading version {} for instance {}", inst.version_id, instance_id);
                match crate::commands::launch::download_version_inner(
                    &inst.version_id,
                    &inst.version_url,
                    app.clone(),
                    &control,
                ).await {
                    Ok(()) => {
                        actions.push(RepairAction {
                            action: "redownload_version".into(),
                            description: format!("Re-downloaded version {} files", inst.version_id),
                            success: true,
                            message: "Version files restored successfully".into(),
                        });
                        any_fix_applied = true;
                    }
                    Err(e) => {
                        actions.push(RepairAction {
                            action: "redownload_version".into(),
                            description: format!("Re-download version {} failed", inst.version_id),
                            success: false,
                            message: format!("{}", e),
                        });
                    }
                }
            }
            "libraries" => {
                tracing::info!("Repair: re-downloading libraries for instance {}", instance_id);
                match crate::commands::launch::download_version_inner(
                    &inst.version_id,
                    &inst.version_url,
                    app.clone(),
                    &control,
                ).await {
                    Ok(()) => {
                        actions.push(RepairAction {
                            action: "redownload_libraries".into(),
                            description: "Re-downloaded library files".into(),
                            success: true,
                            message: "Libraries restored successfully".into(),
                        });
                        any_fix_applied = true;
                    }
                    Err(e) => {
                        actions.push(RepairAction {
                            action: "redownload_libraries".into(),
                            description: "Re-download libraries failed".into(),
                            success: false,
                            message: format!("{}", e),
                        });
                    }
                }
            }
            "jre_compatibility" => {
                tracing::info!("Repair: attempting auto-download of compatible Java for instance {}", instance_id);
                let required_java = version::resolver::resolve_version_with_parents(&inst.version_id, &inst.version_url)
                    .await
                    .map(|v| v.java_version.major_version)
                    .unwrap_or(17);
                match crate::platform::java_download::download_java(required_java).await {
                    Ok(java_path) => {
                        let mut updated = inst.clone();
                        updated.java_path = Some(java_path.clone());
                        if let Err(e) = instance::manager::update_instance(&updated) {
                            actions.push(RepairAction {
                                action: "auto_download_java".into(),
                                description: "Auto-downloaded compatible Java".into(),
                                success: false,
                                message: format!("Java downloaded but failed to update instance: {}", e),
                            });
                        } else {
                            actions.push(RepairAction {
                                action: "auto_download_java".into(),
                                description: format!("Auto-downloaded Java {} to {}", required_java, java_path),
                                success: true,
                                message: "Java updated successfully".into(),
                            });
                            any_fix_applied = true;
                        }
                    }
                    Err(e) => {
                        actions.push(RepairAction {
                            action: "auto_download_java".into(),
                            description: "Auto-download Java failed".into(),
                            success: false,
                            message: format!("{}", e),
                        });
                    }
                }
            }
            "disk_space" => {
                actions.push(RepairAction {
                    action: "disk_space".into(),
                    description: "Cannot auto-fix disk space".into(),
                    success: false,
                    message: item.suggestion.clone().unwrap_or_else(|| "Free up disk space manually".into()),
                });
            }
            _ => {
                actions.push(RepairAction {
                    action: "unknown".into(),
                    description: format!("Unknown issue: {}", item.message),
                    success: false,
                    message: item.suggestion.clone().unwrap_or_default(),
                });
            }
        }
    }

    if any_fix_applied {
        if let Some(loader_type_str) = &inst.loader_type {
            if let Some(loader_version) = &inst.loader_version {
                tracing::info!("Repair: reinstalling {} {} for instance {}", loader_type_str, loader_version, instance_id);
                let lt = loader::LoaderType::from_str(loader_type_str);
                if let Some(lt) = lt {
                    let details = version::resolver::resolve_version_with_parents(&inst.version_id, &inst.version_url).await;
                    match details {
                        Ok(details) => {
                            match loader::install_loader(&lt, &details, loader_version, &instance_id).await {
                                Ok(_) => {
                                    actions.push(RepairAction {
                                        action: "reinstall_loader".into(),
                                        description: format!("Re-installed {} {}", loader_type_str, loader_version),
                                        success: true,
                                        message: "Loader re-installed successfully".into(),
                                    });
                                }
                                Err(e) => {
                                    actions.push(RepairAction {
                                        action: "reinstall_loader".into(),
                                        description: format!("Re-install {} {} failed", loader_type_str, loader_version),
                                        success: false,
                                        message: format!("{}", e),
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            actions.push(RepairAction {
                                action: "reinstall_loader".into(),
                                description: "Failed to resolve version for loader reinstall".into(),
                                success: false,
                                message: format!("{}", e),
                            });
                        }
                    }
                }
            }
        }
    }

    let fixed = actions.iter().any(|a| a.success);

    Ok(RepairResult {
        instance_id,
        actions,
        fixed,
    })
}
