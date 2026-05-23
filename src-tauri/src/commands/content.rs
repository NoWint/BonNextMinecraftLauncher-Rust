use crate::content;
use crate::error::LauncherError;
use crate::modrinth;
use crate::platform::paths;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModInfo {
    pub filename: String,
    pub size: u64,
    pub installed_at: String,
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
pub async fn bulk_update_content(instance_id: String) -> Result<BulkUpdateResult, LauncherError> {
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

    Ok(BulkUpdateResult { succeeded, failed, errors })
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
