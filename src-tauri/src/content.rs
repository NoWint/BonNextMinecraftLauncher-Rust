#![allow(dead_code)]
//! Content metadata tracking for installed mods, resource packs, and shaders.
//! Stores install records as JSON so we can check for updates later.

use crate::error::LauncherError;
use crate::modrinth;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallRecord {
    pub slug: String,
    pub version_id: Option<String>,
    pub content_type: String,
    pub installed_at: String,
}

type MetadataMap = HashMap<String, InstallRecord>; // key = filename

fn get_metadata_path(instance_id: &str) -> PathBuf {
    crate::platform::paths::get_instance_minecraft_dir(instance_id)
        .join("installed_content.json")
}

/// Load the metadata map for an instance.
pub fn load_metadata(instance_id: &str) -> Result<MetadataMap, LauncherError> {
    let path = get_metadata_path(instance_id);
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)?;
    let map: MetadataMap = serde_json::from_str(&data).unwrap_or_default();
    Ok(map)
}

/// Save a metadata map for an instance.
fn save_metadata(instance_id: &str, map: &MetadataMap) -> Result<(), LauncherError> {
    let path = get_metadata_path(instance_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(map)?;
    std::fs::write(&path, data)?;
    Ok(())
}

/// Record a content install so we can check for updates later.
pub fn record_install(
    instance_id: &str,
    filename: &str,
    slug: &str,
    version_id: Option<&str>,
    content_type: &str,
) -> Result<(), LauncherError> {
    let mut map = load_metadata(instance_id)?;
    map.insert(
        filename.to_string(),
        InstallRecord {
            slug: slug.to_string(),
            version_id: version_id.map(|s| s.to_string()),
            content_type: content_type.to_string(),
            installed_at: chrono::Utc::now().to_rfc3339(),
        },
    );
    save_metadata(instance_id, &map)
}

/// Remove a record when content is uninstalled.
pub fn remove_record(instance_id: &str, filename: &str) -> Result<(), LauncherError> {
    let mut map = load_metadata(instance_id)?;
    map.remove(filename);
    save_metadata(instance_id, &map)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub filename: String,
    pub slug: String,
    pub installed_version: Option<String>,
    pub latest_version: String,
    pub content_type: String,
}

/// Check for updates to installed content.
/// For each installed item with a known slug, fetch the latest version from Modrinth
/// and compare with the installed version.
pub async fn check_updates(instance_id: &str) -> Result<Vec<UpdateInfo>, LauncherError> {
    let metadata = load_metadata(instance_id)?;
    if metadata.is_empty() {
        return Ok(Vec::new());
    }

    let mut updates = Vec::new();

    for (filename, record) in &metadata {
        // Fetch latest version for this project
        match modrinth::get_mod_versions(&record.slug, None, None).await {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    let is_update = match &record.version_id {
                        Some(installed_id) => installed_id != &latest.id,
                        None => true, // no version tracked, assume update available
                    };
                    if is_update {
                        updates.push(UpdateInfo {
                            filename: filename.clone(),
                            slug: record.slug.clone(),
                            installed_version: record.version_id.clone(),
                            latest_version: latest.version_number.clone(),
                            content_type: record.content_type.clone(),
                        });
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to check updates for {}: {}", record.slug, e);
            }
        }
    }

    Ok(updates)
}
