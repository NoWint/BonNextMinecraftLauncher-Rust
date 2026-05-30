use crate::content;
use crate::error::LauncherError;
use crate::modrinth;
use crate::platform::paths;
use serde::Deserialize;
use serde::Serialize;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModInfo {
    pub filename: String,
    pub size: u64,
    pub installed_at: String,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentCounts {
    pub mods: u32,
    pub resourcepacks: u32,
    pub shaders: u32,
    pub worlds: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct BulkUpdateResult {
    pub succeeded: u32,
    pub failed: u32,
    pub skipped_pinned: u32,
    pub errors: Vec<String>,
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
pub async fn list_instance_mods(instance_id: String) -> Result<Vec<InstalledModInfo>, LauncherError> {
    let dir = paths::get_instance_mods_dir(&instance_id);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let metadata = content::load_metadata(&instance_id).unwrap_or_default();

    let mut mods = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let filename = path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let is_mod = filename.ends_with(".jar")
                    || filename.ends_with(".zip")
                    || filename.ends_with(".jar.disabled")
                    || filename.ends_with(".zip.disabled");

                if !is_mod {
                    continue;
                }

                let enabled = !filename.ends_with(".disabled");
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

                let pinned = metadata.get(&filename).map(|r| r.pinned).unwrap_or(false);

                mods.push(InstalledModInfo { filename, size, installed_at, pinned, enabled });
            }
        }
    }

    mods.sort_by(|a, b| b.installed_at.cmp(&a.installed_at));
    Ok(mods)
}

#[tauri::command]
pub async fn list_instance_resourcepacks(instance_id: String) -> Result<Vec<String>, LauncherError> {
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
pub async fn list_instance_shaders(instance_id: String) -> Result<Vec<String>, LauncherError> {
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
pub async fn remove_installed_mod(instance_id: String, filename: String) -> Result<(), LauncherError> {
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
pub async fn check_content_updates(instance_id: String) -> Result<Vec<content::UpdateInfo>, LauncherError> {
    content::check_updates(&instance_id).await
}

#[tauri::command]
pub async fn pin_mod(instance_id: String, slug: String) -> Result<bool, LauncherError> {
    content::pin_mod(&instance_id, &slug)
}

#[tauri::command]
pub async fn unpin_mod(instance_id: String, slug: String) -> Result<bool, LauncherError> {
    content::unpin_mod(&instance_id, &slug)
}

#[tauri::command]
pub async fn is_mod_pinned(instance_id: String, slug: String) -> Result<bool, LauncherError> {
    content::is_pinned(&instance_id, &slug)
}

#[tauri::command]
pub async fn bulk_update_content(instance_id: String) -> Result<BulkUpdateResult, LauncherError> {
    let updates = content::check_updates(&instance_id).await?;
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let backup_dir = paths::get_instance_minecraft_dir(&instance_id).join("mods_backup");
    let mut succeeded = 0u32;
    let mut failed = 0u32;
    let mut skipped_pinned = 0u32;
    let mut errors: Vec<String> = Vec::new();

    let updatable: Vec<_> = updates.into_iter().filter(|u| {
        if u.pinned {
            skipped_pinned += 1;
            tracing::info!("Skipping pinned mod: {} ({})", u.slug, u.filename);
            false
        } else {
            true
        }
    }).collect();

    if !updatable.is_empty() {
        if !backup_dir.exists() {
            std::fs::create_dir_all(&backup_dir)?;
        }
        for update in &updatable {
            let src = mods_dir.join(&update.filename);
            if src.exists() {
                let backup_path = backup_dir.join(&update.filename);
                if let Err(e) = std::fs::copy(&src, &backup_path) {
                    tracing::warn!("Failed to backup {}: {}", update.filename, e);
                }
            }
        }
    }

    for update in &updatable {
        let slug = update.slug.clone();
        let result = modrinth::get_mod_versions(&slug, None, None).await;
        match result {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    if let Some(file) = latest.files.first() {
                        let old_path = mods_dir.join(&update.filename);
                        let _ = std::fs::remove_file(&old_path);
                        let dest = mods_dir.join(&file.filename);
                        let queue = crate::download::queue::DownloadQueue::new();
                        let sha1 = file.hashes.sha1.clone().unwrap_or_default();
                        let task = crate::download::queue::DownloadTask::new(
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

    Ok(BulkUpdateResult { succeeded, failed, skipped_pinned, errors })
}

#[tauri::command]
pub async fn get_content_counts(instance_id: String) -> Result<ContentCounts, LauncherError> {
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

#[derive(Debug, Clone, Serialize)]
pub struct AtomicInstallResult {
    pub session_id: String,
    pub installed_files: Vec<String>,
    pub rolled_back: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn atomic_install_content(
    app: tauri::AppHandle,
    instance_id: String,
    files: Vec<AtomicInstallFile>,
) -> Result<AtomicInstallResult, LauncherError> {
    let session_id = format!("inst_{}", chrono::Utc::now().timestamp_millis());
    let mut installer = content::AtomicInstaller::new(&instance_id, &session_id);
    installer.prepare()?;

    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let mut installed_files: Vec<String> = Vec::new();

    for (i, file_spec) in files.iter().enumerate() {
        let target_path = mods_dir.join(&file_spec.filename);
        installer.backup_existing(&target_path)?;

        let temp_path = installer.temp_path_for(&file_spec.filename);
        let queue = crate::download::queue::DownloadQueue::new();
        let task = crate::download::queue::DownloadTask::new(
            &file_spec.url,
            &temp_path,
            file_spec.sha1.as_deref().unwrap_or(""),
            file_spec.size,
        );

        match queue.download_all(vec![task]).await {
            Ok(results) => {
                if results.iter().any(|r| r.is_err()) {
                    let err_msg = format!("Download failed for {}", file_spec.filename);
                    tracing::error!("{}", err_msg);
                    let _ = installer.rollback();
                    return Ok(AtomicInstallResult {
                        session_id,
                        installed_files,
                        rolled_back: true,
                        error: Some(err_msg),
                    });
                }
                installed_files.push(file_spec.filename.clone());
                let _ = app.emit("install-session-progress", serde_json::json!({
                    "session_id": session_id,
                    "instance_id": instance_id,
                    "phase": "downloading",
                    "total_files": files.len(),
                    "completed_files": i + 1,
                }));
            }
            Err(e) => {
                let err_msg = format!("Download error for {}: {}", file_spec.filename, e);
                tracing::error!("{}", err_msg);
                let _ = installer.rollback();
                return Ok(AtomicInstallResult {
                    session_id,
                    installed_files,
                    rolled_back: true,
                    error: Some(err_msg),
                });
            }
        }
    }

    match installer.commit() {
        Ok(()) => {
            for file_spec in &files {
                if let Some(ref slug) = file_spec.slug {
                    if let Err(e) = content::record_install(
                        &instance_id,
                        &file_spec.filename,
                        slug,
                        file_spec.version_id.as_deref(),
                        file_spec.content_type.as_deref().unwrap_or("mod"),
                        file_spec.source.as_deref().unwrap_or("modrinth"),
                    ) {
                        tracing::warn!("Failed to record install metadata: {}", e);
                    }
                }
            }
            Ok(AtomicInstallResult {
                session_id,
                installed_files,
                rolled_back: false,
                error: None,
            })
        }
        Err(e) => {
            Ok(AtomicInstallResult {
                session_id,
                installed_files,
                rolled_back: true,
                error: Some(format!("Commit failed: {}", e)),
            })
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtomicInstallFile {
    pub url: String,
    pub filename: String,
    pub sha1: Option<String>,
    pub size: u64,
    pub slug: Option<String>,
    pub version_id: Option<String>,
    pub content_type: Option<String>,
    pub source: Option<String>,
}
