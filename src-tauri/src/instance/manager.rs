use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::LauncherError;
use crate::platform::paths;
use crate::download::queue::{DownloadQueue, DownloadTask};
use crate::http_client;

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

// ---- .mrpack Import ----

#[derive(Debug, Deserialize)]
struct MrPackIndexFile {
    path: String,
    #[serde(default)]
    downloads: Vec<String>,
    #[serde(default)]
    sha1: String,
    #[serde(rename = "fileSize")]
    file_size: u64,
    #[serde(default)]
    env: Option<MrPackEnv>,
}

#[derive(Debug, Deserialize)]
struct MrPackEnv {
    client: Option<String>,
    server: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MrPackIndex {
    name: String,
    #[serde(rename = "versionId")]
    version_id: Option<String>,
    summary: Option<String>,
    files: Vec<MrPackIndexFile>,
}

/// Import a .mrpack modpack. Returns the created GameInstance.
pub async fn import_modpack(path: &str) -> Result<GameInstance, LauncherError> {
    let zip_path = std::path::Path::new(path);
    if !zip_path.exists() {
        return Err(LauncherError::Other(format!("File not found: {}", path)));
    }

    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Invalid .mrpack ZIP: {}", e)))?;

    // Parse modrinth.index.json
    let mut index_json = String::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.name() == "modrinth.index.json" {
            std::io::Read::read_to_string(&mut entry, &mut index_json)?;
            break;
        }
    }

    if index_json.is_empty() {
        return Err(LauncherError::Other("modrinth.index.json not found in .mrpack".into()));
    }

    let index: MrPackIndex = serde_json::from_str(&index_json)
        .map_err(|e| LauncherError::Other(format!("Invalid modrinth.index.json: {}", e)))?;

    let version_id = index.version_id.clone().unwrap_or_else(|| "1.21".to_string());
    let manifest = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = manifest.iter().find(|v| v.id == version_id)
        .ok_or_else(|| LauncherError::Other(format!("Version {} not found in manifest", version_id)))?;
    let version_url = version_entry.url.clone();

    let inst_id = format!("mrpack_{}_{}", version_id, chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = GameInstance {
        id: inst_id.clone(),
        name: index.name.clone(),
        version_id: version_id.clone(),
        version_url,
        loader_type: None,
        loader_version: None,
        description: index.summary.unwrap_or_default(),
        max_memory: 4096,
        min_memory: 512,
        java_path: None,
        jvm_args: None,
        created_at: now.clone(),
        last_played: None,
        playtime_seconds: 0,
    };

    create_instance(&instance)?;

    // Download mod files
    let mods_dir = paths::get_instance_mods_dir(&inst_id);
    std::fs::create_dir_all(&mods_dir)?;

    let mut download_tasks: Vec<DownloadTask> = Vec::new();
    for f in &index.files {
        if let Some(url) = f.downloads.first() {
            let dest = mods_dir.join(&f.path);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            download_tasks.push(DownloadTask::new(url.clone(), dest, f.sha1.clone(), f.file_size));
        }
    }

    if !download_tasks.is_empty() {
        let queue = DownloadQueue::new();
        let results = queue.download_all(download_tasks).await?;
        let succeeded = results.iter().filter(|r| r.is_ok()).count();
        let failed = results.len() - succeeded;
        if failed > 0 {
            tracing::warn!("{}/{} modpack mod downloads failed", failed, results.len());
        }
    }

    // Extract overrides
    for i in 0..archive.len() {
        let entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        if name.starts_with("overrides/") && !name.ends_with('/') {
            let relative = name.strip_prefix("overrides/").unwrap_or(&name);
            let dest = paths::get_instance_minecraft_dir(&inst_id).join(relative);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut entry = entry; // re-borrow
            let mut out = std::fs::File::create(&dest)?;
            std::io::copy(&mut entry, &mut out)?;
        }
    }

    tracing::info!("Modpack '{}' imported as instance '{}'", index.name, inst_id);
    Ok(instance)
}
