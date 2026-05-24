use std::io::Write;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::LauncherError;
use crate::platform::paths;
use crate::download::queue::{DownloadQueue, DownloadTask};

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
    let instance_dir = paths::get_instance_dir(id);
    if instance_dir.exists() {
        if let Err(e) = std::fs::remove_dir_all(&instance_dir) {
            tracing::warn!("Failed to remove instance directory {}: {}", instance_dir.display(), e);
        }
    }
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
    let mut options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    #[cfg(unix)]
    { options = options.unix_permissions(0o644); }

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
#[allow(dead_code)]
struct MrPackIndexFile {
    path: String,
    #[serde(default)]
    downloads: Vec<String>,
    #[serde(default)]
    sha1: String,
    #[serde(default)]
    #[serde(rename = "fileSize")]
    file_size: u64,
    #[serde(default)]
    env: Option<MrPackEnv>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
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
    #[serde(default)]
    files: Vec<MrPackIndexFile>,
    #[serde(default)]
    dependencies: std::collections::HashMap<String, String>,
}

fn is_client_supported(env: &Option<MrPackEnv>) -> bool {
    match env {
        Some(e) => {
            match &e.client {
                Some(v) => v != "unsupported",
                None => true,
            }
        }
        None => true,
    }
}

fn safe_extract_path(relative: &str) -> Option<std::path::PathBuf> {
    let safe: std::path::PathBuf = std::path::Path::new(relative)
        .components()
        .filter(|c| !matches!(c, std::path::Component::ParentDir | std::path::Component::RootDir))
        .collect();
    if safe.as_os_str().is_empty() {
        return None;
    }
    Some(safe)
}

fn compute_sha1_streaming(path: &std::path::Path) -> Result<String, LauncherError> {
    use sha1::{Sha1, Digest};
    let mut hasher = Sha1::new();
    let mut file = std::fs::File::open(path)?;
    let mut buf = [0u8; 8192];
    loop {
        let n = std::io::Read::read(&mut file, &mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn extract_zip_overrides(
    archive: &mut zip::ZipArchive<std::fs::File>,
    prefixes: &[&str],
    dest_base: &std::path::Path,
) -> Result<u32, LauncherError> {
    let mut extracted: u32 = 0;
    for i in 0..archive.len() {
        let entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        if name.ends_with('/') { continue; }
        let relative = prefixes.iter()
            .find_map(|p| name.strip_prefix(p))
            .unwrap_or("");
        if relative.is_empty() { continue; }
        if let Some(safe_relative) = safe_extract_path(relative) {
            let dest = dest_base.join(&safe_relative);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut entry = entry;
            let mut out = std::fs::File::create(&dest)?;
            std::io::copy(&mut entry, &mut out)?;
            extracted += 1;
        }
    }
    Ok(extracted)
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

    let version_id = index.dependencies.get("minecraft")
        .cloned()
        .or(index.version_id.clone())
        .unwrap_or_else(|| "1.21".to_string());
    let loader_type = index.dependencies.keys()
        .find(|k| matches!(k.as_str(), "fabric-loader" | "forge" | "neoforge" | "quilt-loader"))
        .cloned();
    let loader_version = loader_type.as_ref()
        .and_then(|lt| index.dependencies.get(lt))
        .cloned();

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
        loader_type: loader_type.clone(),
        loader_version,
        description: index.summary.unwrap_or_default(),
        max_memory: 4096,
        min_memory: 512,
        java_path: None,
        jvm_args: None,
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };

    create_instance(&instance)?;

    let mods_dir = paths::get_instance_mods_dir(&inst_id);
    std::fs::create_dir_all(&mods_dir)?;

    let mut download_tasks: Vec<DownloadTask> = Vec::new();
    for f in &index.files {
        if !is_client_supported(&f.env) {
            tracing::debug!("Skipping server-only file: {}", f.path);
            continue;
        }
        if let Some(url) = f.downloads.first() {
            let file_name = std::path::Path::new(&f.path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| f.path.clone());
            let dest = mods_dir.join(&file_name);
            download_tasks.push(DownloadTask::new(url.clone(), dest, f.sha1.clone(), f.file_size));
        }
    }

    if !download_tasks.is_empty() {
        tracing::info!("Downloading {} mod files for modpack '{}'...", download_tasks.len(), index.name);
        let queue = DownloadQueue::new();
        let results = queue.download_all(download_tasks).await?;
        let succeeded = results.iter().filter(|r| r.is_ok()).count();
        let failed = results.len() - succeeded;
        if failed > 0 {
            tracing::warn!("{}/{} modpack mod downloads failed", failed, results.len());
        }
    }

    let mc_dir = paths::get_instance_minecraft_dir(&inst_id);
    let client_count = extract_zip_overrides(&mut archive, &["client-overrides/", "overrides/"], &mc_dir)?;
    tracing::info!("Extracted {} override files for modpack '{}'", client_count, index.name);

    tracing::info!("Modpack '{}' imported as instance '{}'", index.name, inst_id);
    Ok(instance)
}

#[derive(Debug, Clone, Serialize)]
pub enum ModpackFormat {
    MrPack,
    CurseForge,
    Unknown,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct CfManifest {
    #[serde(rename = "minecraft")]
    minecraft: CfMinecraft,
    #[serde(rename = "manifestType")]
    manifest_type: Option<String>,
    #[serde(rename = "name")]
    name: Option<String>,
    #[serde(default)]
    files: Vec<CfManifestFile>,
}

#[derive(Debug, Deserialize)]
struct CfMinecraft {
    #[serde(rename = "version")]
    version: String,
    #[serde(rename = "modLoaders")]
    mod_loaders: Vec<CfModLoader>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct CfModLoader {
    id: String,
    primary: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct CfManifestFile {
    #[serde(rename = "projectID")]
    project_id: u64,
    #[serde(rename = "fileID")]
    file_id: u64,
    required: Option<bool>,
}

pub fn detect_modpack_format(path: &str) -> Result<ModpackFormat, LauncherError> {
    let zip_path = std::path::Path::new(path);
    if !zip_path.exists() {
        return Err(LauncherError::Other(format!("File not found: {}", path)));
    }

    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Invalid ZIP: {}", e)))?;

    for i in 0..archive.len() {
        let entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        if name == "modrinth.index.json" {
            return Ok(ModpackFormat::MrPack);
        }
        if name == "manifest.json" {
            return Ok(ModpackFormat::CurseForge);
        }
    }

    Ok(ModpackFormat::Unknown)
}

pub async fn import_curseforge_modpack(path: &str) -> Result<GameInstance, LauncherError> {
    let zip_path = std::path::Path::new(path);
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Invalid ZIP: {}", e)))?;

    let mut manifest_json = String::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.name() == "manifest.json" {
            std::io::Read::read_to_string(&mut entry, &mut manifest_json)?;
            break;
        }
    }

    if manifest_json.is_empty() {
        return Err(LauncherError::Other("manifest.json not found in CurseForge modpack".into()));
    }

    let manifest: CfManifest = serde_json::from_str(&manifest_json)
        .map_err(|e| LauncherError::Other(format!("Invalid manifest.json: {}", e)))?;

    let version_id = manifest.minecraft.version.clone();
    let manifest2 = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = manifest2.iter().find(|v| v.id == version_id)
        .ok_or_else(|| LauncherError::Other(format!("Version {} not found in manifest", version_id)))?;
    let version_url = version_entry.url.clone();

    let (loader_type, loader_version) = manifest.minecraft.mod_loaders.iter()
        .find(|ml| ml.primary.unwrap_or(true))
        .or_else(|| manifest.minecraft.mod_loaders.first())
        .map(|ml| {
            let id = &ml.id;
            if let Some(dash_pos) = id.find('-') {
                let lt = id[..dash_pos].to_string();
                let lv = id[dash_pos + 1..].to_string();
                (Some(lt), Some(lv))
            } else {
                (Some(id.clone()), None)
            }
        })
        .unwrap_or((None, None));

    let name = manifest.name.unwrap_or_else(|| "CurseForge Modpack".to_string());
    let inst_id = format!("cf_{}_{}", version_id, chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = GameInstance {
        id: inst_id.clone(),
        name,
        version_id: version_id.clone(),
        version_url,
        loader_type,
        loader_version,
        description: format!("Imported from CurseForge modpack ({} files)", manifest.files.len()),
        max_memory: 4096,
        min_memory: 512,
        java_path: None,
        jvm_args: None,
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };

    create_instance(&instance)?;

    let mc_dir = paths::get_instance_minecraft_dir(&inst_id);
    let mods_dir = paths::get_instance_mods_dir(&inst_id);
    std::fs::create_dir_all(&mods_dir)?;

    let client = crate::http_client::build_client();
    let mut downloaded: u32 = 0;
    let mut failed: u32 = 0;
    for cf_file in &manifest.files {
        if !cf_file.required.unwrap_or(true) {
            tracing::debug!("Skipping optional CF file: project {} file {}", cf_file.project_id, cf_file.file_id);
            continue;
        }
        let file_url = format!(
            "https://api.curseforge.com/v1/mods/{}/files/{}",
            cf_file.project_id, cf_file.file_id
        );
        match client.get(&file_url).send().await {
            Ok(resp) => {
                match resp.json::<serde_json::Value>().await {
                    Ok(json) => {
                        if let Some(data) = json.get("data") {
                            let download_url = data.get("downloadUrl")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let filename = data.get("fileName")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown.jar")
                                .to_string();
                            let sha1_hash = data.get("hashes")
                                .and_then(|h| h.as_array())
                                .and_then(|arr| arr.iter().find(|h| h.get("algo").and_then(|a| a.as_i64()) == Some(1)))
                                .and_then(|h| h.get("value"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let file_size = data.get("fileLength")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);

                            if download_url.is_empty() {
                                tracing::warn!("CF file {} has no download URL, skipping", filename);
                                failed += 1;
                                continue;
                            }

                            let dest = mods_dir.join(&filename);
                            let task = DownloadTask::new(download_url, dest, sha1_hash, file_size);
                            let queue = DownloadQueue::new();
                            match queue.download_single(&task).await {
                                Ok(_) => downloaded += 1,
                                Err(e) => {
                                    tracing::warn!("Failed to download CF mod {}: {}", filename, e);
                                    failed += 1;
                                }
                            }
                        } else {
                            failed += 1;
                        }
                    }
                    Err(_) => failed += 1,
                }
            }
            Err(_) => failed += 1,
        }
    }
    tracing::info!("CF mod download: {} succeeded, {} failed", downloaded, failed);

    let override_count = extract_zip_overrides(&mut archive, &["overrides/"], &mc_dir)?;
    tracing::info!("Extracted {} override files for CF modpack", override_count);

    tracing::info!("CurseForge modpack imported as instance '{}'", inst_id);
    Ok(instance)
}

pub async fn import_modpack_auto(path: &str) -> Result<GameInstance, LauncherError> {
    let format = detect_modpack_format(path)?;
    match format {
        ModpackFormat::MrPack => import_modpack(path).await,
        ModpackFormat::CurseForge => import_curseforge_modpack(path).await,
        ModpackFormat::Unknown => Err(LauncherError::Other(
            "Unknown modpack format. Supported: .mrpack (Modrinth), CurseForge ZIP".into()
        )),
    }
}

// ---- .mrpack Export ----

#[derive(Debug, Serialize)]
struct MrPackExportIndex {
    #[serde(rename = "formatVersion")]
    format_version: u32,
    name: String,
    #[serde(rename = "versionId")]
    version_id: String,
    #[serde(default)]
    summary: String,
    files: Vec<MrPackExportFile>,
    dependencies: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize)]
struct MrPackExportFile {
    path: String,
    downloads: Vec<String>,
    sha1: String,
    #[serde(rename = "fileSize")]
    file_size: u64,
}

/// Export an instance as .mrpack modpack format.
pub async fn export_mrpack(id: &str, output_path: &std::path::Path) -> Result<(), LauncherError> {
    let instance = get_instance(id)?.ok_or_else(|| {
        LauncherError::Other(format!("Instance not found: {}", id))
    })?;

    let content_path = paths::get_instance_minecraft_dir(id).join("installed_content.json");
    let mods_dir = paths::get_instance_mods_dir(id);

    let mut tracked_mods: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut mod_files: Vec<MrPackExportFile> = Vec::new();

    if content_path.exists() {
        let data = std::fs::read_to_string(&content_path)?;
        if let Ok(content_map) = serde_json::from_str::<std::collections::HashMap<String, crate::content::InstallRecord>>(&data) {
            for (filename, entry) in &content_map {
                if entry.content_type != "mod" { continue; }
                let mod_path = mods_dir.join(filename);
                if !mod_path.exists() { continue; }

                let file_size = std::fs::metadata(&mod_path).map(|m| m.len()).unwrap_or(0);
                let sha1 = compute_sha1_streaming(&mod_path).unwrap_or_default();

                let downloads: Vec<String> = if entry.source == "modrinth" {
                    vec![format!(
                        "https://cdn.modrinth.com/data/{}/versions/{}/{}",
                        entry.slug,
                        entry.version_id.as_deref().unwrap_or(""),
                        filename
                    )]
                } else {
                    vec![]
                };

                tracked_mods.insert(filename.clone());
                mod_files.push(MrPackExportFile {
                    path: format!("mods/{}", filename),
                    downloads,
                    sha1,
                    file_size,
                });
            }
        }
    }

    if mods_dir.exists() {
        for entry in std::fs::read_dir(&mods_dir)? {
            let entry = entry?;
            let filename = entry.file_name().to_string_lossy().to_string();
            if tracked_mods.contains(&filename) { continue; }
            let path = entry.path();
            if !path.is_file() { continue; }
            let lower = filename.to_lowercase();
            if !lower.ends_with(".jar") && !lower.ends_with(".jar.disabled") { continue; }

            let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            let sha1 = compute_sha1_streaming(&path).unwrap_or_default();

            mod_files.push(MrPackExportFile {
                path: format!("mods/{}", filename),
                downloads: vec![],
                sha1,
                file_size,
            });
        }
    }

    let mut dependencies = std::collections::HashMap::new();
    dependencies.insert("minecraft".to_string(), instance.version_id.clone());
    if let Some(ref lt) = instance.loader_type {
        let dep_key = match lt.as_str() {
            "fabric" => "fabric-loader",
            "quilt" => "quilt-loader",
            other => other,
        };
        dependencies.insert(dep_key.to_string(), instance.loader_version.clone().unwrap_or_default());
    }

    let manifest = MrPackExportIndex {
        format_version: 1,
        name: instance.name.clone(),
        version_id: instance.version_id.clone(),
        summary: instance.description.clone(),
        files: mod_files,
        dependencies,
    };

    let file = std::fs::File::create(output_path)
        .map_err(|e| LauncherError::Other(format!("Cannot create mrpack: {}", e)))?;
    let mut zip = zip::ZipWriter::new(file);
    let mut options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    #[cfg(unix)]
    { options = options.unix_permissions(0o644); }

    zip.start_file("modrinth.index.json", options)
        .map_err(|e| LauncherError::Other(format!("ZIP write error: {}", e)))?;
    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| LauncherError::Other(format!("ZIP write error: {}", e)))?;

    let minecraft_dir = paths::get_instance_minecraft_dir(id);
    if minecraft_dir.exists() {
        let skip_dirs = ["mods", "versions", "libraries", "crash-reports", "logs", "natives", "installed_content.json", ".minecraft"];
        for entry in std::fs::read_dir(&minecraft_dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if skip_dirs.contains(&name.as_str()) { continue; }
            if path.is_file() {
                let zip_name = format!("overrides/{}", name).replace('\\', "/");
                zip.start_file(&zip_name, options)
                    .map_err(|e| LauncherError::Other(format!("ZIP write error: {}", e)))?;
                let mut src = std::fs::File::open(&path)?;
                std::io::copy(&mut src, &mut zip)
                    .map_err(|e| LauncherError::Other(format!("ZIP write error: {}", e)))?;
            } else if path.is_dir() {
                add_dir_to_mrpack(&mut zip, &minecraft_dir, &path, options)?;
            }
        }
    }

    zip.finish().map_err(|e| LauncherError::Other(format!("ZIP finish error: {}", e)))?;
    tracing::info!("Instance '{}' exported as .mrpack to {}", id, output_path.display());
    Ok(())
}

fn add_dir_to_mrpack(
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
        let name = format!("overrides/{}", relative.to_string_lossy().replace('\\', "/"));
        if path.is_dir() {
            zip.add_directory(&name, options)
                .map_err(|e| LauncherError::Other(format!("ZIP error: {}", e)))?;
            add_dir_to_mrpack(&mut *zip, base, &path, options)?;
        } else {
            zip.start_file(&name, options)
                .map_err(|e| LauncherError::Other(format!("ZIP error: {}", e)))?;
            let mut src = std::fs::File::open(&path)?;
            std::io::copy(&mut src, &mut *zip)
                .map_err(|e| LauncherError::Other(format!("ZIP error: {}", e)))?;
        }
    }
    Ok(())
}
