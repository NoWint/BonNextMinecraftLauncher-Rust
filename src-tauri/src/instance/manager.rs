use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::LauncherError;
use crate::platform::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameInstance {
    pub id: String,
    pub name: String,
    pub version_id: String,
    pub version_url: String,
    pub loader_type: Option<String>,
    pub loader_version: Option<String>,
    pub description: String,
    pub max_memory: u32,
    pub min_memory: u32,
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
    pub created_at: String,
    pub last_played: Option<String>,
    pub playtime_seconds: u64,
}

#[allow(dead_code)]
impl GameInstance {
    pub fn new(name: &str, version_id: &str, version_url: &str) -> Self {
        let id = format!("{}_{}", version_id, name.replace(' ', "_"));
        let now = chrono::Local::now().to_rfc3339();
        GameInstance {
            id,
            name: name.to_string(),
            version_id: version_id.to_string(),
            version_url: version_url.to_string(),
            loader_type: None,
            loader_version: None,
            description: String::new(),
            max_memory: 2048,
            min_memory: 512,
            java_path: None,
            jvm_args: None,
            created_at: now,
            last_played: None,
            playtime_seconds: 0,
        }
    }

    pub fn dir(&self) -> PathBuf {
        paths::get_game_dir().join("instances").join(&self.id)
    }
}

fn instances_file() -> PathBuf {
    paths::get_game_dir().join("instances").join("instances.json")
}

pub fn list_instances() -> Result<Vec<GameInstance>, LauncherError> {
    let path = instances_file();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)?;
    let instances: Vec<GameInstance> = serde_json::from_str(&content)?;
    Ok(instances)
}

pub fn save_instances(instances: &[GameInstance]) -> Result<(), LauncherError> {
    let path = instances_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(instances)?;
    std::fs::write(&path, content)?;
    Ok(())
}

pub fn create_instance(instance: &GameInstance) -> Result<(), LauncherError> {
    let mut instances = list_instances()?;
    // Check for duplicate id
    if instances.iter().any(|i| i.id == instance.id) {
        return Err(LauncherError::Other(format!(
            "Instance with id '{}' already exists",
            instance.id
        )));
    }
    instances.push(instance.clone());
    save_instances(&instances)?;
    // Create instance directory structure
    paths::ensure_instance_dirs(&instance.id)?;
    Ok(())
}

pub fn delete_instance(id: &str) -> Result<(), LauncherError> {
    let mut instances = list_instances()?;
    instances.retain(|i| i.id != id);
    save_instances(&instances)?;
    Ok(())
}

pub fn update_instance(updated: &GameInstance) -> Result<(), LauncherError> {
    let mut instances = list_instances()?;
    if let Some(idx) = instances.iter().position(|i| i.id == updated.id) {
        instances[idx] = updated.clone();
        save_instances(&instances)?;
    }
    Ok(())
}

pub fn get_instance(id: &str) -> Result<Option<GameInstance>, LauncherError> {
    let instances = list_instances()?;
    Ok(instances.into_iter().find(|i| i.id == id))
}

/// Update the playtime for an instance by adding the given seconds.
pub fn update_playtime(instance_id: &str, seconds: u64) -> Result<(), LauncherError> {
    let mut instances = list_instances()?;
    if let Some(inst) = instances.iter_mut().find(|i| i.id == instance_id) {
        inst.playtime_seconds = inst.playtime_seconds.saturating_add(seconds);
        let now = chrono::Local::now().to_rfc3339();
        inst.last_played = Some(now);
        save_instances(&instances)?;
    }
    Ok(())
}

/// Check if an instance's version JAR exists on disk (ready to launch).
pub fn check_instance_ready(id: &str) -> Result<bool, LauncherError> {
    let instance = get_instance(id)?.ok_or_else(|| {
        LauncherError::Other(format!("Instance not found: {}", id))
    })?;
    let jar_path = paths::get_versions_dir()
        .join(&instance.version_id)
        .join(format!("{}.jar", instance.version_id));
    Ok(jar_path.exists())
}

/// Duplicate an instance with a new name.
pub fn duplicate_instance(id: &str, new_name: &str) -> Result<GameInstance, LauncherError> {
    let instances = list_instances()?;
    let original = instances.iter().find(|i| i.id == id).ok_or_else(|| {
        LauncherError::Other(format!("Instance not found: {}", id))
    })?;
    let new_id = format!("{}_{}", original.version_id, chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let duplicated = GameInstance {
        id: new_id,
        name: new_name.to_string(),
        version_id: original.version_id.clone(),
        version_url: original.version_url.clone(),
        loader_type: original.loader_type.clone(),
        loader_version: original.loader_version.clone(),
        description: original.description.clone(),
        max_memory: original.max_memory,
        min_memory: original.min_memory,
        java_path: original.java_path.clone(),
        jvm_args: original.jvm_args.clone(),
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };
    let mut instances = instances;
    instances.push(duplicated.clone());
    save_instances(&instances)?;
    paths::ensure_instance_dirs(&duplicated.id)?;
    Ok(duplicated)
}

/// Export an instance directory as a ZIP file.
pub fn export_instance(id: &str, output_path: &std::path::Path) -> Result<(), LauncherError> {
    let instance = get_instance(id)?.ok_or_else(|| {
        LauncherError::Other(format!("Instance not found: {}", id))
    })?;
    let instance_dir = instance.dir();
    if !instance_dir.exists() {
        return Err(LauncherError::Other(format!(
            "Instance directory does not exist: {}",
            instance_dir.display()
        )));
    }

    let file = std::fs::File::create(output_path)
        .map_err(|e| LauncherError::Other(format!("Cannot create export file: {}", e)))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    fn add_dir_to_zip(
        zip: &mut zip::ZipWriter<std::fs::File>,
        base: &std::path::Path,
        dir: &std::path::Path,
        options: zip::write::SimpleFileOptions,
    ) -> Result<(), LauncherError> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let relative = path.strip_prefix(base)
                .map_err(|e| LauncherError::Other(e.to_string()))?;
            let name = relative.to_string_lossy().replace('\\', "/");

            if path.is_dir() {
                zip.add_directory(&name, options)
                    .map_err(|e| LauncherError::Other(format!("ZIP add dir error: {}", e)))?;
                add_dir_to_zip(zip, base, &path, options)?;
            } else {
                zip.start_file(&name, options)
                    .map_err(|e| LauncherError::Other(format!("ZIP start file error: {}", e)))?;
                let mut src = std::fs::File::open(&path)
                    .map_err(|e| LauncherError::Other(format!("Cannot open: {}: {}", path.display(), e)))?;
                std::io::copy(&mut src, zip)
                    .map_err(|e| LauncherError::Other(format!("ZIP write error: {}", e)))?;
            }
        }
        Ok(())
    }

    add_dir_to_zip(&mut zip, instance_dir.parent().unwrap_or(&instance_dir), &instance_dir, options)?;
    zip.finish().map_err(|e| LauncherError::Other(format!("ZIP finish error: {}", e)))?;

    tracing::info!("Instance '{}' exported to {}", id, output_path.display());
    Ok(())
}
