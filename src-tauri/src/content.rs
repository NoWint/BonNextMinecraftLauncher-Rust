#![allow(dead_code)]
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
    #[serde(default = "default_source")]
    pub source: String,
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
        },
    );
    save_metadata(instance_id, &map)
}

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
        async move {
            let result = if source == "curseforge" {
                if let Ok(mod_id) = slug.parse::<u64>() {
                    crate::curseforge::get_mod_versions(mod_id).await
                } else {
                    // TODO: pass game_version and loader from instance for filtering
                    modrinth::get_mod_versions(&slug, None, None).await
                }
            } else {
                // TODO: pass game_version and loader from instance for filtering
                modrinth::get_mod_versions(&slug, None, None).await
            };
            (filename, slug, version_id, content_type, result)
        }
    }).collect();

    let results = futures_util::future::join_all(futures).await;

    let mut updates = Vec::new();
    for (filename, slug, installed_version, content_type, result) in results {
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
