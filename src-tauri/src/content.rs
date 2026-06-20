#![allow(dead_code)]
use crate::error::LauncherError;
use crate::modrinth;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRecord {
    pub slug: String,
    pub version_id: Option<String>,
    pub content_type: String,
    pub installed_at: String,
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default)]
    pub pinned: bool,
}

fn default_source() -> String {
    "modrinth".to_string()
}

type MetadataMap = HashMap<String, InstallRecord>;

fn get_metadata_path(instance_id: &str) -> PathBuf {
    crate::platform::paths::get_instance_minecraft_dir(instance_id)
        .join("installed_content.json")
}

pub fn load_metadata(instance_id: &str) -> Result<MetadataMap, LauncherError> {
    let path = get_metadata_path(instance_id);
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)?;
    let map: MetadataMap = serde_json::from_str(&data).unwrap_or_default();
    Ok(map)
}

fn save_metadata(instance_id: &str, map: &MetadataMap) -> Result<(), LauncherError> {
    let path = get_metadata_path(instance_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(map)?;
    std::fs::write(&path, data)?;
    Ok(())
}

pub fn record_install(
    instance_id: &str,
    filename: &str,
    slug: &str,
    version_id: Option<&str>,
    content_type: &str,
    source: &str,
) -> Result<(), LauncherError> {
    let mut map = load_metadata(instance_id)?;
    map.insert(
        filename.to_string(),
        InstallRecord {
            slug: slug.to_string(),
            version_id: version_id.map(|s| s.to_string()),
            content_type: content_type.to_string(),
            installed_at: chrono::Utc::now().to_rfc3339(),
            source: source.to_string(),
            pinned: false,
        },
    );
    save_metadata(instance_id, &map)
}

pub fn remove_record(instance_id: &str, filename: &str) -> Result<(), LauncherError> {
    let mut map = load_metadata(instance_id)?;
    map.remove(filename);
    save_metadata(instance_id, &map)
}

pub fn pin_mod(instance_id: &str, slug: &str) -> Result<bool, LauncherError> {
    let mut map = load_metadata(instance_id)?;
    let mut found = false;
    for record in map.values_mut() {
        if record.slug == slug {
            record.pinned = true;
            found = true;
        }
    }
    if found {
        save_metadata(instance_id, &map)?;
    }
    Ok(found)
}

pub fn unpin_mod(instance_id: &str, slug: &str) -> Result<bool, LauncherError> {
    let mut map = load_metadata(instance_id)?;
    let mut found = false;
    for record in map.values_mut() {
        if record.slug == slug {
            record.pinned = false;
            found = true;
        }
    }
    if found {
        save_metadata(instance_id, &map)?;
    }
    Ok(found)
}

pub fn is_pinned(instance_id: &str, slug: &str) -> Result<bool, LauncherError> {
    let map = load_metadata(instance_id)?;
    Ok(map.values().any(|r| r.slug == slug && r.pinned))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub filename: String,
    pub slug: String,
    pub installed_version: Option<String>,
    pub latest_version: String,
    pub content_type: String,
    #[serde(default)]
    pub pinned: bool,
}

pub async fn check_updates(instance_id: &str) -> Result<Vec<UpdateInfo>, LauncherError> {
    let metadata = load_metadata(instance_id)?;
    if metadata.is_empty() {
        return Ok(Vec::new());
    }

    let futures: Vec<_> = metadata.iter().map(|(filename, record)| {
        let filename = filename.clone();
        let slug = record.slug.clone();
        let version_id = record.version_id.clone();
        let content_type = record.content_type.clone();
        let source = record.source.clone();
        let pinned = record.pinned;
        async move {
            let result = if source == "curseforge" {
                if let Ok(mod_id) = slug.parse::<u64>() {
                    crate::curseforge::get_mod_versions(mod_id).await
                } else {
                    modrinth::get_mod_versions(&slug, None, None).await
                }
            } else {
                modrinth::get_mod_versions(&slug, None, None).await
            };
            (filename, slug, version_id, content_type, pinned, result)
        }
    }).collect();

    let results = futures_util::future::join_all(futures).await;

    let mut updates = Vec::new();
    for (filename, slug, installed_version, content_type, pinned, result) in results {
        match result {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    let is_update = match &installed_version {
                        Some(installed_id) => installed_id != &latest.id,
                        None => true,
                    };
                    if is_update {
                        updates.push(UpdateInfo {
                            filename,
                            slug,
                            installed_version,
                            latest_version: latest.version_number.clone(),
                            content_type,
                            pinned,
                        });
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to check updates for {}: {}", slug, e);
            }
        }
    }

    Ok(updates)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModUpdateInfo {
    pub file_name: String,
    pub project_id: String,
    pub project_slug: Option<String>,
    pub current_hash: String,
    pub latest_hash: String,
    pub latest_version: String,
    pub latest_version_id: String,
    pub download_url: String,
}

fn compute_file_sha1(path: &std::path::Path) -> Result<String, LauncherError> {
    let data = std::fs::read(path)?;
    let mut hasher = Sha1::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

pub async fn check_mod_updates(instance_id: &str) -> Result<Vec<ModUpdateInfo>, LauncherError> {
    let metadata = load_metadata(instance_id)?;
    if metadata.is_empty() {
        return Ok(Vec::new());
    }

    let mods_dir = crate::platform::paths::get_instance_mods_dir(instance_id);

    let futures: Vec<_> = metadata.iter().map(|(filename, record)| {
        let filename = filename.clone();
        let slug = record.slug.clone();
        let source = record.source.clone();
        let local_path = mods_dir.join(&filename);
        async move {
            let current_hash = match compute_file_sha1(&local_path) {
                Ok(h) => h,
                Err(e) => {
                    tracing::warn!("Failed to compute SHA1 for {}: {}", filename, e);
                    return (filename, slug, source, None, None);
                }
            };

            let versions_result = if source == "curseforge" {
                if let Ok(mod_id) = slug.parse::<u64>() {
                    crate::curseforge::get_mod_versions(mod_id).await
                } else {
                    modrinth::get_mod_versions(&slug, None, None).await
                }
            } else {
                modrinth::get_mod_versions(&slug, None, None).await
            };

            match versions_result {
                Ok(versions) => {
                    if let Some(latest) = versions.first() {
                        if let Some(primary_file) = latest.files.first() {
                            let latest_hash = primary_file.hashes.sha1.clone().unwrap_or_default();
                            if current_hash.eq_ignore_ascii_case(&latest_hash) {
                                return (filename, slug, source, Some(current_hash), None);
                            }
                            return (filename, slug, source, Some(current_hash), Some((
                                latest.id.clone(),
                                latest.version_number.clone(),
                                primary_file.url.clone(),
                                latest_hash,
                            )));
                        }
                    }
                    (filename, slug, source, Some(current_hash), None)
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch versions for {}: {}", slug, e);
                    (filename, slug, source, Some(current_hash), None)
                }
            }
        }
    }).collect();

    let results = futures_util::future::join_all(futures).await;

    let mut updates = Vec::new();
    for (filename, slug, _source, current_hash, latest_info) in results {
        if let (Some(current_hash), Some((latest_version_id, latest_version, download_url, latest_hash))) = (current_hash, latest_info) {
            updates.push(ModUpdateInfo {
                file_name: filename,
                project_id: slug.clone(),
                project_slug: Some(slug),
                current_hash,
                latest_hash,
                latest_version,
                latest_version_id,
                download_url,
            });
        }
    }

    Ok(updates)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallSessionState {
    pub session_id: String,
    pub instance_id: String,
    pub phase: String,
    pub total_files: u32,
    pub completed_files: u32,
    pub failed: bool,
    pub error_message: Option<String>,
}

pub struct AtomicInstaller {
    instance_id: String,
    session_id: String,
    temp_dir: PathBuf,
    backup_dir: PathBuf,
    backups: Vec<(PathBuf, PathBuf)>,
}

impl AtomicInstaller {
    pub fn new(instance_id: &str, session_id: &str) -> Self {
        let mc_dir = crate::platform::paths::get_instance_minecraft_dir(instance_id);
        AtomicInstaller {
            instance_id: instance_id.to_string(),
            session_id: session_id.to_string(),
            temp_dir: mc_dir.join(".install_tmp").join(session_id),
            backup_dir: mc_dir.join(".install_tmp").join(session_id).join("_backups"),
            backups: Vec::new(),
        }
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn temp_dir(&self) -> &PathBuf {
        &self.temp_dir
    }

    pub fn prepare(&self) -> Result<(), LauncherError> {
        std::fs::create_dir_all(&self.temp_dir)?;
        std::fs::create_dir_all(&self.backup_dir)?;
        Ok(())
    }

    pub fn backup_existing(&mut self, target_path: &std::path::Path) -> Result<(), LauncherError> {
        if target_path.exists() {
            let backup_name = format!(
                "{}_{}",
                target_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string()),
                chrono::Utc::now().timestamp_millis()
            );
            let backup_path = self.backup_dir.join(&backup_name);
            std::fs::copy(target_path, &backup_path)?;
            self.backups.push((target_path.to_path_buf(), backup_path));
        }
        Ok(())
    }

    pub fn temp_path_for(&self, filename: &str) -> PathBuf {
        self.temp_dir.join(filename)
    }

    pub fn commit(self) -> Result<(), LauncherError> {
        for (target, _) in &self.backups {
            let _ = std::fs::remove_file(target);
        }

        let entries: Vec<_> = std::fs::read_dir(&self.temp_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path() != self.backup_dir)
            .collect();

        for entry in &entries {
            let src = entry.path();
            if src.is_file() && !src.starts_with(&self.backup_dir) {
                if let Some(filename) = src.file_name() {
                    let target_dir = self.determine_target_dir(&src.to_string_lossy());
                    let dest = target_dir.join(filename);
                    if let Some(parent) = dest.parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    std::fs::rename(&src, &dest).or_else(|_| {
                        std::fs::copy(&src, &dest)?;
                        std::fs::remove_file(&src)
                    })?;
                }
            }
        }

        let _ = std::fs::remove_dir_all(&self.temp_dir);
        Ok(())
    }

    pub fn rollback(self) -> Result<(), LauncherError> {
        tracing::warn!("Rolling back install session {}", self.session_id);

        for (target, backup) in &self.backups {
            if backup.exists() {
                if let Err(e) = std::fs::copy(backup, target) {
                    tracing::error!("Failed to restore backup {} -> {}: {}", backup.display(), target.display(), e);
                }
            }
        }

        let temp_entries: Vec<_> = std::fs::read_dir(&self.temp_dir)
            .ok()
            .map(|d| d.filter_map(|e| e.ok()).collect())
            .unwrap_or_default();
        for entry in temp_entries {
            if entry.path().is_file() && !entry.path().starts_with(&self.backup_dir) {
                let _ = std::fs::remove_file(entry.path());
            }
        }

        let _ = std::fs::remove_dir_all(&self.temp_dir);
        Ok(())
    }

    fn determine_target_dir(&self, _filename: &str) -> PathBuf {
        crate::platform::paths::get_instance_mods_dir(&self.instance_id)
    }

    pub fn get_state(&self, phase: &str, total_files: u32, completed_files: u32) -> InstallSessionState {
        InstallSessionState {
            session_id: self.session_id.clone(),
            instance_id: self.instance_id.clone(),
            phase: phase.to_string(),
            total_files,
            completed_files,
            failed: false,
            error_message: None,
        }
    }
}
