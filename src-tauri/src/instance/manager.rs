use std::io::Write;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;

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
    /// 是否使用全局配置（true=全局，false=实例特定）。参考 HMCL usesGlobal。
    #[serde(default = "default_true")]
    pub uses_global_config: bool,
    /// 窗口宽度（0=使用全局默认）
    #[serde(default)]
    pub window_width: u32,
    /// 窗口高度（0=使用全局默认）
    #[serde(default)]
    pub window_height: u32,
    /// 是否全屏
    #[serde(default)]
    pub fullscreen: bool,
    /// 调试模式
    #[serde(default)]
    pub debug_mode: bool,
    /// 调试端口
    #[serde(default = "default_debug_port")]
    pub debug_port: u16,
    /// 实例图标路径（相对于实例目录或绝对路径）
    #[serde(default)]
    pub icon: Option<String>,
    /// 标签/分类
    #[serde(default)]
    pub tags: Vec<String>,
    /// 默认服务器地址（QuickPlay）
    #[serde(default)]
    pub server_address: Option<String>,
    /// 游戏目录类型："root"(共享根目录) / "version"(版本隔离) / "custom"(自定义)
    #[serde(default = "default_game_dir_type")]
    pub game_dir_type: String,
    /// 自定义游戏目录路径（game_dir_type="custom" 时使用）
    #[serde(default)]
    pub custom_game_dir: Option<String>,
    /// 启动前命令
    #[serde(default)]
    pub pre_launch_command: Option<String>,
    /// 退出后命令
    #[serde(default)]
    pub post_exit_command: Option<String>,
    /// 环境变量（KEY=VALUE 换行分隔）
    #[serde(default)]
    pub environment_variables: Option<String>,
    /// 进程优先级："low" / "below_normal" / "normal" / "above_normal" / "high"
    #[serde(default = "default_process_priority")]
    pub process_priority: String,
}

fn default_true() -> bool { true }
fn default_debug_port() -> u16 { 5005 }
fn default_game_dir_type() -> String { "version".to_string() }
fn default_process_priority() -> String { "normal".to_string() }

// Reserved for programmatic instance creation
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
            uses_global_config: true,
            window_width: 0,
            window_height: 0,
            fullscreen: false,
            debug_mode: false,
            debug_port: 5005,
            icon: None,
            tags: Vec::new(),
            server_address: None,
            game_dir_type: "version".to_string(),
            custom_game_dir: None,
            pre_launch_command: None,
            post_exit_command: None,
            environment_variables: None,
            process_priority: "normal".to_string(),
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
        return Err(LauncherError::InstanceNotReady(format!(
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
        LauncherError::InstanceNotReady(format!("Instance not found: {}", id))
    })?;
    let jar_path = paths::get_versions_dir()
        .join(&instance.version_id)
        .join(format!("{}.jar", instance.version_id));
    Ok(jar_path.exists())
}

/// Duplicate an instance with a new name.
pub fn duplicate_instance(id: &str, new_name: &str) -> Result<GameInstance, LauncherError> {
    let instances = list_instances()?;
    let original = instances.iter().find(|i| i.id == id).cloned().ok_or_else(|| {
        LauncherError::InstanceNotReady(format!("Instance not found: {}", id))
    })?;
    let new_id = format!("{}_{}", original.version_id, chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let duplicated = GameInstance {
        id: new_id.clone(),
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
        uses_global_config: original.uses_global_config,
        window_width: original.window_width,
        window_height: original.window_height,
        fullscreen: original.fullscreen,
        debug_mode: original.debug_mode,
        debug_port: original.debug_port,
        icon: original.icon.clone(),
        tags: original.tags.clone(),
        server_address: original.server_address.clone(),
        game_dir_type: original.game_dir_type.clone(),
        custom_game_dir: None,
        pre_launch_command: original.pre_launch_command.clone(),
        post_exit_command: original.post_exit_command.clone(),
        environment_variables: original.environment_variables.clone(),
        process_priority: original.process_priority.clone(),
    };
    let mut instances = instances;
    instances.push(duplicated.clone());
    save_instances(&instances)?;
    paths::ensure_instance_dirs(&duplicated.id)?;

    // 复制实例文件：mods/saves/resourcepacks/config/screenshots
    // 参考 HMCL duplicateVersion 的 copySaves 逻辑，但更全面。
    let src_dir = original.dir();
    let dst_dir = duplicated.dir();
    if src_dir.exists() {
        let minecraft_src = src_dir.join(".minecraft");
        let minecraft_dst = dst_dir.join(".minecraft");
        if minecraft_src.exists() {
            let copy_subdirs = ["mods", "saves", "resourcepacks", "shaderpacks", "config", "screenshots"];
            for subdir in &copy_subdirs {
                let src = minecraft_src.join(subdir);
                let dst = minecraft_dst.join(subdir);
                if src.exists() {
                    if let Err(e) = copy_dir_recursive(&src, &dst) {
                        tracing::warn!("Failed to copy {} during duplication: {}", subdir, e);
                    }
                }
            }
            tracing::info!("Instance {} duplicated with files to {}", id, new_id);
        }
    }

    Ok(duplicated)
}

/// 递归复制目录
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), LauncherError> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        let dst_path = dst.join(&file_name);
        if path.is_dir() {
            copy_dir_recursive(&path, &dst_path)?;
        } else {
            std::fs::copy(&path, &dst_path)?;
        }
    }
    Ok(())
}

/// Export an instance directory as a ZIP file.
pub fn export_instance(id: &str, output_path: &std::path::Path) -> Result<(), LauncherError> {
    let instance = get_instance(id)?.ok_or_else(|| {
        LauncherError::InstanceNotReady(format!("Instance not found: {}", id))
    })?;
    let instance_dir = instance.dir();
    if !instance_dir.exists() {
        return Err(LauncherError::InstanceNotReady(format!(
            "Instance directory does not exist: {}",
            instance_dir.display()
        )));
    }

    let file = std::fs::File::create(output_path)
        .map_err(|e| LauncherError::Other(format!("creating {}: {}", output_path.display(), e)))?;
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
                .map_err(|e| LauncherError::InvalidConfig(e.to_string()))?;
            let name = relative.to_string_lossy().replace('\\', "/");

            if path.is_dir() {
                zip.add_directory(&name, options)?;
                add_dir_to_zip(zip, base, &path, options)?;
            } else {
                zip.start_file(&name, options)?;
                let mut src = std::fs::File::open(&path)?;
                std::io::copy(&mut src, zip)?;
            }
        }
        Ok(())
    }

    add_dir_to_zip(&mut zip, instance_dir.parent().unwrap_or(&instance_dir), &instance_dir, options)?;
    zip.finish()?;

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
pub async fn import_modpack(path: &str, app: Option<&tauri::AppHandle>) -> Result<GameInstance, LauncherError> {
    let zip_path = std::path::Path::new(path);
    if !zip_path.exists() {
        return Err(LauncherError::VersionNotFound(format!("File not found: {}", path)));
    }

    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let mut index_json = String::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.name() == "modrinth.index.json" {
            std::io::Read::read_to_string(&mut entry, &mut index_json)?;
            break;
        }
    }

    if index_json.is_empty() {
        return Err(LauncherError::VersionNotFound("modrinth.index.json not found in .mrpack".into()));
    }

    let index: MrPackIndex = serde_json::from_str(&index_json)?;

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
        .ok_or_else(|| LauncherError::VersionNotFound(format!("Version {} not found in manifest", version_id)))?;
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
        uses_global_config: true,
        window_width: 0,
        window_height: 0,
        fullscreen: false,
        debug_mode: false,
        debug_port: 5005,
        icon: None,
        tags: Vec::new(),
        server_address: None,
        game_dir_type: "version".to_string(),
        custom_game_dir: None,
        pre_launch_command: None,
        post_exit_command: None,
        environment_variables: None,
        process_priority: "normal".to_string(),
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
        let total = download_tasks.len() as u32;
        let completed_count = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));

        // 发射下载开始事件，前端 downloadStore 创建 modpack 任务
        if let Some(app) = app {
            let _ = app.emit("modpack-import-progress", serde_json::json!({
                "stage": "downloading",
                "name": index.name,
                "total": total,
                "completed": 0,
            }));
        }

        let app_clone = app.map(|a| a.clone());
        let completed_clone = completed_count.clone();
        let modpack_name = index.name.clone();
        let queue = DownloadQueue::new().with_callback(move |progress| {
            if progress.finished {
                let c = completed_clone.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                if let Some(ref app) = app_clone {
                    let _ = app.emit("modpack-import-progress", serde_json::json!({
                        "stage": "downloading",
                        "name": modpack_name,
                        "total": total,
                        "completed": c,
                        "current_url": progress.url,
                        "error": progress.error,
                    }));
                }
            }
        });
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ModpackFormat {
    MrPack,
    CurseForge,
    Unknown,
}

#[derive(Debug, Deserialize)]
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
struct CfModLoader {
    id: String,
    primary: Option<bool>,
}

#[derive(Debug, Deserialize)]
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
        return Err(LauncherError::VersionNotFound(format!("File not found: {}", path)));
    }

    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

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

pub async fn import_curseforge_modpack(path: &str, app: Option<&tauri::AppHandle>) -> Result<GameInstance, LauncherError> {
    let zip_path = std::path::Path::new(path);
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let mut manifest_json = String::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.name() == "manifest.json" {
            std::io::Read::read_to_string(&mut entry, &mut manifest_json)?;
            break;
        }
    }

    if manifest_json.is_empty() {
        return Err(LauncherError::VersionNotFound("manifest.json not found in CurseForge modpack".into()));
    }

    let manifest: CfManifest = serde_json::from_str(&manifest_json)?;

    let version_id = manifest.minecraft.version.clone();
    let manifest2 = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = manifest2.iter().find(|v| v.id == version_id)
        .ok_or_else(|| LauncherError::VersionNotFound(format!("Version {} not found in manifest", version_id)))?;
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
        name: name.clone(),
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
        uses_global_config: true,
        window_width: 0,
        window_height: 0,
        fullscreen: false,
        debug_mode: false,
        debug_port: 5005,
        icon: None,
        tags: Vec::new(),
        server_address: None,
        game_dir_type: "version".to_string(),
        custom_game_dir: None,
        pre_launch_command: None,
        post_exit_command: None,
        environment_variables: None,
        process_priority: "normal".to_string(),
    };

    create_instance(&instance)?;

    let mc_dir = paths::get_instance_minecraft_dir(&inst_id);
    let mods_dir = paths::get_instance_mods_dir(&inst_id);
    std::fs::create_dir_all(&mods_dir)?;

    let client = crate::http_client::build_client();
    let mut downloaded: u32 = 0;
    let mut failed: u32 = 0;
    let total_cf = manifest.files.iter().filter(|f| f.required.unwrap_or(true)).count() as u32;

    // 发射下载开始事件
    if let Some(app) = app {
        let _ = app.emit("modpack-import-progress", serde_json::json!({
            "stage": "downloading",
            "name": name,
            "total": total_cf,
            "completed": 0,
        }));
    }

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
                                Ok(_) => {
                                    downloaded += 1;
                                    if let Some(app) = app {
                                        let _ = app.emit("modpack-import-progress", serde_json::json!({
                                            "stage": "downloading",
                                            "name": name,
                                            "total": total_cf,
                                            "completed": downloaded + failed,
                                            "current_file": filename,
                                        }));
                                    }
                                }
                                Err(e) => {
                                    tracing::warn!("Failed to download CF mod {}: {}", filename, e);
                                    failed += 1;
                                    if let Some(app) = app {
                                        let _ = app.emit("modpack-import-progress", serde_json::json!({
                                            "stage": "downloading",
                                            "name": name,
                                            "total": total_cf,
                                            "completed": downloaded + failed,
                                            "current_file": filename,
                                            "error": e.to_string(),
                                        }));
                                    }
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

pub async fn import_modpack_auto(path: &str, app: Option<&tauri::AppHandle>) -> Result<GameInstance, LauncherError> {
    let format = detect_modpack_format(path)?;
    match format {
        ModpackFormat::MrPack => import_modpack(path, app).await,
        ModpackFormat::CurseForge => import_curseforge_modpack(path, app).await,
        ModpackFormat::Unknown => Err(LauncherError::InvalidConfig(
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
        LauncherError::InstanceNotReady(format!("Instance not found: {}", id))
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

    let file = std::fs::File::create(output_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let mut options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    #[cfg(unix)]
    { options = options.unix_permissions(0o644); }

    zip.start_file("modrinth.index.json", options)?;
    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    zip.write_all(manifest_json.as_bytes())?;

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
                zip.start_file(&zip_name, options)?;
                let mut src = std::fs::File::open(&path)?;
                std::io::copy(&mut src, &mut zip)?;
            } else if path.is_dir() {
                add_dir_to_mrpack(&mut zip, &minecraft_dir, &path, options)?;
            }
        }
    }

    zip.finish()?;
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
            .map_err(|e| LauncherError::InvalidConfig(e.to_string()))?;
        let name = format!("overrides/{}", relative.to_string_lossy().replace('\\', "/"));
        if path.is_dir() {
            zip.add_directory(&name, options)?;
            add_dir_to_mrpack(&mut *zip, base, &path, options)?;
        } else {
            zip.start_file(&name, options)?;
            let mut src = std::fs::File::open(&path)?;
            std::io::copy(&mut src, &mut *zip)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_instance_new() {
        let inst = GameInstance::new("My World", "1.20.4", "https://example.com/1.20.4.json");
        assert_eq!(inst.name, "My World");
        assert_eq!(inst.version_id, "1.20.4");
        assert_eq!(inst.version_url, "https://example.com/1.20.4.json");
        assert!(inst.id.contains("1.20.4"));
        assert!(inst.id.contains("My_World"));
        assert!(inst.loader_type.is_none());
        assert!(inst.loader_version.is_none());
        assert_eq!(inst.max_memory, 2048);
        assert_eq!(inst.min_memory, 512);
        assert!(inst.java_path.is_none());
        assert!(inst.last_played.is_none());
        assert_eq!(inst.playtime_seconds, 0);
    }

    #[test]
    fn game_instance_id_replaces_spaces() {
        let inst = GameInstance::new("My Cool World", "1.20.4", "https://example.com");
        assert!(inst.id.contains("My_Cool_World"));
        assert!(!inst.id.contains(' '));
    }

    #[test]
    fn game_instance_serialization() {
        let inst = GameInstance::new("TestWorld", "1.20.4", "https://example.com");
        let json = serde_json::to_string(&inst).unwrap();
        let back: GameInstance = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, inst.id);
        assert_eq!(back.name, "TestWorld");
        assert_eq!(back.version_id, "1.20.4");
        assert_eq!(back.max_memory, 2048);
        assert_eq!(back.min_memory, 512);
        assert_eq!(back.playtime_seconds, 0);
    }

    #[test]
    fn game_instance_with_loader() {
        let mut inst = GameInstance::new("Fabric World", "1.20.4", "https://example.com");
        inst.loader_type = Some("fabric".to_string());
        inst.loader_version = Some("0.15.0".to_string());
        assert_eq!(inst.loader_type.as_deref(), Some("fabric"));
        assert_eq!(inst.loader_version.as_deref(), Some("0.15.0"));
    }

    #[test]
    fn game_instance_with_custom_memory() {
        let mut inst = GameInstance::new("Big World", "1.20.4", "https://example.com");
        inst.max_memory = 8192;
        inst.min_memory = 1024;
        assert_eq!(inst.max_memory, 8192);
        assert_eq!(inst.min_memory, 1024);
    }

    #[test]
    fn game_instance_with_java_path() {
        let mut inst = GameInstance::new("Test", "1.20.4", "https://example.com");
        inst.java_path = Some("/usr/bin/java".to_string());
        inst.jvm_args = Some("-XX:+UseG1GC".to_string());
        assert_eq!(inst.java_path.as_deref(), Some("/usr/bin/java"));
        assert_eq!(inst.jvm_args.as_deref(), Some("-XX:+UseG1GC"));
    }

    #[test]
    fn safe_extract_path_normal() {
        let result = safe_extract_path("mods/test.jar");
        assert!(result.is_some());
        assert_eq!(result.unwrap(), std::path::PathBuf::from("mods/test.jar"));
    }

    #[test]
    fn safe_extract_path_blocks_parent_dir() {
        let result = safe_extract_path("../../etc/passwd");
        assert!(result.is_none() || !result.unwrap().starts_with(".."));
    }

    #[test]
    fn safe_extract_path_blocks_root() {
        let result = safe_extract_path("/etc/passwd");
        assert!(result.is_none() || !result.unwrap().starts_with("/"));
    }

    #[test]
    fn safe_extract_path_empty() {
        let result = safe_extract_path("");
        assert!(result.is_none());
    }

    #[test]
    fn safe_extract_path_only_parent() {
        let result = safe_extract_path("..");
        assert!(result.is_none());
    }

    #[test]
    fn is_client_supported_none_env() {
        assert!(is_client_supported(&None));
    }

    #[test]
    fn is_client_supported_no_client_field() {
        let env = MrPackEnv { client: None, server: None };
        assert!(is_client_supported(&Some(env)));
    }

    #[test]
    fn is_client_supported_client_required() {
        let env = MrPackEnv { client: Some("required".to_string()), server: None };
        assert!(is_client_supported(&Some(env)));
    }

    #[test]
    fn is_client_supported_client_unsupported() {
        let env = MrPackEnv { client: Some("unsupported".to_string()), server: None };
        assert!(!is_client_supported(&Some(env)));
    }

    #[test]
    fn modpack_format_serialization() {
        let formats = [ModpackFormat::MrPack, ModpackFormat::CurseForge, ModpackFormat::Unknown];
        for fmt in &formats {
            let json = serde_json::to_string(fmt).unwrap();
            let back: ModpackFormat = serde_json::from_str(&json).unwrap();
            assert_eq!(fmt, &back);
        }
    }

    #[test]
    fn game_instance_playtime_default_zero() {
        let inst = GameInstance::new("Test", "1.20.4", "https://example.com");
        assert_eq!(inst.playtime_seconds, 0);
    }

    #[test]
    fn game_instance_created_at_is_rfc3339() {
        let inst = GameInstance::new("Test", "1.20.4", "https://example.com");
        assert!(chrono::DateTime::parse_from_rfc3339(&inst.created_at).is_ok());
    }
}
