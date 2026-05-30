use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::LauncherError;
use crate::instance::manager::{self, GameInstance};
use crate::platform::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedLauncher {
    pub launcher_type: String,
    pub name: String,
    pub game_dir: String,
    pub instance_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrateableInstance {
    pub name: String,
    pub version_id: String,
    pub loader_type: Option<String>,
    pub loader_version: Option<String>,
    pub game_dir: String,
    pub launcher_type: String,
    pub has_mods: bool,
    pub has_saves: bool,
    pub size_mb: u64,
}

fn base_dirs() -> Option<BaseDirs> {
    BaseDirs::new()
}

fn default_minecraft_dir() -> PathBuf {
    base_dirs()
        .map(|bd| bd.data_dir().join(".minecraft"))
        .unwrap_or_else(|| PathBuf::from(".minecraft"))
}

fn default_hmcl_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let candidate = home.join(".hmcl");
    if candidate.exists() {
        return Some(candidate);
    }
    let candidate = home.join(".minecraft");
    if candidate.join("hmclver.json").exists() {
        return Some(candidate);
    }
    None
}

fn default_multimc_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let data = base_dirs()?.data_dir().to_path_buf();
    let candidates = [
        home.join("MultiMC"),
        data.join("multimc"),
        home.join(".multimc"),
        data.join("PrismLauncher"),
        home.join("PrismLauncher"),
    ];
    for candidate in &candidates {
        if candidate.exists() && candidate.join("instances").exists() {
            return Some(candidate.clone());
        }
    }
    None
}

fn default_pcl2_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let candidates = [
        home.join("AppData").join("Roaming").join(".minecraft"),
        home.join(".minecraft"),
    ];
    for candidate in &candidates {
        if candidate.join("PCL").exists() || candidate.join("launcher_config.json").exists() {
            return Some(candidate.clone());
        }
    }
    None
}

pub fn detect_installed_launchers() -> Result<Vec<DetectedLauncher>, LauncherError> {
    let mut launchers = Vec::new();

    let vanilla_dir = default_minecraft_dir();
    if vanilla_dir.exists() && vanilla_dir.join("versions").exists() {
        let count = count_vanilla_versions(&vanilla_dir);
        launchers.push(DetectedLauncher {
            launcher_type: "vanilla".to_string(),
            name: "Minecraft Launcher".to_string(),
            game_dir: vanilla_dir.to_string_lossy().to_string(),
            instance_count: count,
        });
    }

    if let Some(hmcl_dir) = default_hmcl_dir() {
        let count = count_vanilla_versions(&hmcl_dir);
        if count > 0 {
            launchers.push(DetectedLauncher {
                launcher_type: "hmcl".to_string(),
                name: "HMCL".to_string(),
                game_dir: hmcl_dir.to_string_lossy().to_string(),
                instance_count: count,
            });
        }
    }

    if let Some(pcl2_dir) = default_pcl2_dir() {
        let count = count_vanilla_versions(&pcl2_dir);
        if count > 0 {
            launchers.push(DetectedLauncher {
                launcher_type: "pcl2".to_string(),
                name: "PCL2".to_string(),
                game_dir: pcl2_dir.to_string_lossy().to_string(),
                instance_count: count,
            });
        }
    }

    if let Some(mmc_dir) = default_multimc_dir() {
        let count = count_multimc_instances(&mmc_dir);
        if count > 0 {
            let name = if mmc_dir.to_string_lossy().contains("Prism") {
                "Prism Launcher"
            } else {
                "MultiMC"
            };
            launchers.push(DetectedLauncher {
                launcher_type: "multimc".to_string(),
                name: name.to_string(),
                game_dir: mmc_dir.to_string_lossy().to_string(),
                instance_count: count,
            });
        }
    }

    Ok(launchers)
}

fn count_vanilla_versions(dir: &std::path::Path) -> u32 {
    let versions_dir = dir.join("versions");
    if !versions_dir.exists() {
        return 0;
    }
    let mut count = 0u32;
    if let Ok(entries) = std::fs::read_dir(&versions_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let version_json = entry.path().join(format!("{}.json", entry.file_name().to_string_lossy()));
                if version_json.exists() {
                    count += 1;
                }
            }
        }
    }
    count
}

fn count_multimc_instances(dir: &std::path::Path) -> u32 {
    let instances_dir = dir.join("instances");
    if !instances_dir.exists() {
        return 0;
    }
    let mut count = 0u32;
    if let Ok(entries) = std::fs::read_dir(&instances_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() && entry.path().join("instance.cfg").exists() {
                count += 1;
            }
        }
    }
    count
}

pub fn scan_launcher_instances(launcher_type: &str, game_dir: &str) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let dir = PathBuf::from(game_dir);
    if !dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Directory not found: {}", game_dir)));
    }

    match launcher_type {
        "vanilla" | "hmcl" | "pcl2" => scan_vanilla_style(&dir, launcher_type),
        "multimc" => scan_multimc_style(&dir),
        _ => Err(LauncherError::InvalidConfig(format!("Unsupported launcher: {}", launcher_type))),
    }
}

fn scan_vanilla_style(dir: &std::path::Path, launcher_type: &str) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let versions_dir = dir.join("versions");
    if !versions_dir.exists() {
        return Ok(Vec::new());
    }

    let mut instances = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&versions_dir) {
        for entry in entries.flatten() {
            let version_dir = entry.path();
            if !version_dir.is_dir() { continue; }
            let version_name = entry.file_name().to_string_lossy().to_string();
            let version_json = version_dir.join(format!("{}.json", &version_name));
            if !version_json.exists() { continue; }

            let (version_id, loader_type, loader_version) = parse_version_json(&version_json, &version_name);

            let mods_dir = dir.join("mods");
            let has_mods = mods_dir.exists() && std::fs::read_dir(&mods_dir).map(|mut d| d.next().is_some()).unwrap_or(false);
            let saves_dir = dir.join("saves");
            let has_saves = saves_dir.exists() && std::fs::read_dir(&saves_dir).map(|mut d| d.next().is_some()).unwrap_or(false);

            let size_mb = dir_size_mb(dir);

            instances.push(MigrateableInstance {
                name: version_name.clone(),
                version_id,
                loader_type,
                loader_version,
                game_dir: dir.to_string_lossy().to_string(),
                launcher_type: launcher_type.to_string(),
                has_mods,
                has_saves,
                size_mb,
            });
        }
    }

    if launcher_type == "hmcl" {
        if let Ok(hmcl_profiles) = parse_hmcl_profiles(dir) {
            return Ok(hmcl_profiles);
        }
    }

    Ok(instances)
}

fn parse_version_json(path: &std::path::Path, fallback_id: &str) -> (String, Option<String>, Option<String>) {
    let data = match std::fs::read_to_string(path) {
        Ok(d) => d,
        Err(_) => return (fallback_id.to_string(), None, None),
    };
    let json: serde_json::Value = match serde_json::from_str(&data) {
        Ok(v) => v,
        Err(_) => return (fallback_id.to_string(), None, None),
    };

    let version_id = json.get("id")
        .and_then(|v| v.as_str())
        .unwrap_or(fallback_id)
        .to_string();

    let (loader_type, loader_version) = if let Some(libraries) = json.get("libraries").and_then(|v| v.as_array()) {
        let mut lt = None;
        let mut lv = None;
        for lib in libraries {
            let name = lib.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if name.contains("fabric-loader") {
                lt = Some("fabric".to_string());
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    lv = Some(parts[2].to_string());
                }
                break;
            } else if name.contains("forge") && name.contains("net.minecraftforge") {
                lt = Some("forge".to_string());
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    lv = Some(parts[2].to_string());
                }
                break;
            } else if name.contains("neoforge") {
                lt = Some("neoforge".to_string());
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    lv = Some(parts[2].to_string());
                }
                break;
            } else if name.contains("quilt-loader") {
                lt = Some("quilt".to_string());
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    lv = Some(parts[2].to_string());
                }
                break;
            }
        }
        (lt, lv)
    } else {
        (None, None)
    };

    (version_id, loader_type, loader_version)
}

fn parse_hmcl_profiles(dir: &std::path::Path) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let hmclver_path = dir.join("hmclver.json");
    if !hmclver_path.exists() {
        return Err(LauncherError::VersionNotFound("hmclver.json not found".into()));
    }

    let data = std::fs::read_to_string(&hmclver_path)?;
    let json: serde_json::Value = serde_json::from_str(&data)?;

    let mut instances = Vec::new();

    if let Some(profiles) = json.get("profiles").and_then(|v| v.as_array()) {
        for profile in profiles {
            let name = profile.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
            let version_id = profile.get("version").and_then(|v| v.as_str()).unwrap_or("1.21").to_string();
            let game_dir_str = profile.get("gameDir").and_then(|v| v.as_str());
            let profile_dir = game_dir_str.map(PathBuf::from).unwrap_or_else(|| dir.to_path_buf());

            let loader_type = profile.get("type").and_then(|v| v.as_str()).and_then(|t| {
                match t {
                    "fabric" => Some("fabric".to_string()),
                    "forge" => Some("forge".to_string()),
                    "neoforge" => Some("neoforge".to_string()),
                    "quilt" => Some("quilt".to_string()),
                    _ => None,
                }
            });

            let loader_version = profile.get("loaderVersion").and_then(|v| v.as_str()).map(|s| s.to_string());

            let mods_dir = profile_dir.join("mods");
            let has_mods = mods_dir.exists() && std::fs::read_dir(&mods_dir).map(|mut d| d.next().is_some()).unwrap_or(false);
            let saves_dir = profile_dir.join("saves");
            let has_saves = saves_dir.exists() && std::fs::read_dir(&saves_dir).map(|mut d| d.next().is_some()).unwrap_or(false);

            instances.push(MigrateableInstance {
                name,
                version_id,
                loader_type,
                loader_version,
                game_dir: profile_dir.to_string_lossy().to_string(),
                launcher_type: "hmcl".to_string(),
                has_mods,
                has_saves,
                size_mb: dir_size_mb(&profile_dir),
            });
        }
    }

    Ok(instances)
}

fn scan_multimc_style(dir: &std::path::Path) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let instances_dir = dir.join("instances");
    if !instances_dir.exists() {
        return Ok(Vec::new());
    }

    let mut instances = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&instances_dir) {
        for entry in entries.flatten() {
            let inst_dir = entry.path();
            if !inst_dir.is_dir() { continue; }
            let cfg_path = inst_dir.join("instance.cfg");
            if !cfg_path.exists() { continue; }

            let (name, version_id, loader_type, loader_version) = parse_multimc_cfg(&cfg_path);
            let mc_dir = inst_dir.join(".minecraft");
            let actual_mc = if mc_dir.exists() { &mc_dir } else { &inst_dir };

            let mods_dir = actual_mc.join("mods");
            let has_mods = mods_dir.exists() && std::fs::read_dir(&mods_dir).map(|mut d| d.next().is_some()).unwrap_or(false);
            let saves_dir = actual_mc.join("saves");
            let has_saves = saves_dir.exists() && std::fs::read_dir(&saves_dir).map(|mut d| d.next().is_some()).unwrap_or(false);

            instances.push(MigrateableInstance {
                name,
                version_id,
                loader_type,
                loader_version,
                game_dir: inst_dir.to_string_lossy().to_string(),
                launcher_type: "multimc".to_string(),
                has_mods,
                has_saves,
                size_mb: dir_size_mb(actual_mc),
            });
        }
    }

    Ok(instances)
}

fn parse_multimc_cfg(cfg_path: &std::path::Path) -> (String, String, Option<String>, Option<String>) {
    let data = match std::fs::read_to_string(cfg_path) {
        Ok(d) => d,
        Err(_) => return ("Unknown".to_string(), "1.21".to_string(), None, None),
    };

    let mut name = "Unknown".to_string();
    let mut version_id = String::new();
    let mut loader_type: Option<String> = None;
    let mut loader_version: Option<String> = None;

    for line in data.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name=") {
            name = val.to_string();
        } else if let Some(val) = line.strip_prefix("ManagedPackVersionName=") {
            version_id = val.to_string();
        } else if let Some(val) = line.strip_prefix("ManagedPackID=") {
            if !val.is_empty() && version_id.is_empty() {
                version_id = val.to_string();
            }
        }
    }

    let mmc_pack_path = cfg_path.parent().unwrap_or(cfg_path).join("mmc-pack.json");
    if mmc_pack_path.exists() {
        if let Ok(pack_data) = std::fs::read_to_string(&mmc_pack_path) {
            if let Ok(pack_json) = serde_json::from_str::<serde_json::Value>(&pack_data) {
                if let Some(components) = pack_json.get("components").and_then(|v| v.as_array()) {
                    for comp in components {
                        let uid = comp.get("uid").and_then(|v| v.as_str()).unwrap_or("");
                        let version = comp.get("version").and_then(|v| v.as_str()).unwrap_or("");
                        #[allow(clippy::collapsible_match)]
                        match uid {
                            "net.minecraft" => {
                                if version_id.is_empty() {
                                    version_id = version.to_string();
                                }
                            }
                            "net.fabricmc.fabric-loader" => {
                                loader_type = Some("fabric".to_string());
                                loader_version = Some(version.to_string());
                            }
                            "net.minecraftforge" => {
                                loader_type = Some("forge".to_string());
                                loader_version = Some(version.to_string());
                            }
                            "net.neoforged" => {
                                loader_type = Some("neoforge".to_string());
                                loader_version = Some(version.to_string());
                            }
                            "org.quiltmc.quilt-loader" => {
                                loader_type = Some("quilt".to_string());
                                loader_version = Some(version.to_string());
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    if version_id.is_empty() {
        version_id = "1.21".to_string();
    }

    (name, version_id, loader_type, loader_version)
}

pub async fn migrate_instance(
    name: &str,
    version_id: &str,
    loader_type: Option<&str>,
    loader_version: Option<&str>,
    source_game_dir: &str,
    launcher_type: &str,
) -> Result<GameInstance, LauncherError> {
    let source_dir = PathBuf::from(source_game_dir);
    if !source_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Source directory not found: {}", source_game_dir)));
    }

    let manifest = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = manifest.iter().find(|v| v.id == version_id);
    let version_url = version_entry.map(|v| v.url.clone()).unwrap_or_default();

    let inst_id = format!("migrated_{}_{}", version_id, chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = GameInstance {
        id: inst_id.clone(),
        name: name.to_string(),
        version_id: version_id.to_string(),
        version_url,
        loader_type: loader_type.map(|s| s.to_string()),
        loader_version: loader_version.map(|s| s.to_string()),
        description: format!("Migrated from {}", launcher_type),
        max_memory: 4096,
        min_memory: 512,
        java_path: None,
        jvm_args: None,
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };

    manager::create_instance(&instance)?;

    let dest_mc_dir = paths::get_instance_minecraft_dir(&inst_id);

    let source_mc_dir = if launcher_type == "multimc" {
        let mmc_mc = source_dir.join(".minecraft");
        if mmc_mc.exists() { mmc_mc } else { source_dir.clone() }
    } else {
        source_dir.clone()
    };

    let copy_dirs = ["mods", "config", "saves", "resourcepacks", "shaderpacks", "options.txt", "optionsof.txt", "servers.dat"];
    let mut copied_files: u32 = 0;
    for item in &copy_dirs {
        let src = source_mc_dir.join(item);
        if !src.exists() { continue; }
        let dst = dest_mc_dir.join(item);
        if src.is_dir() {
            if let Err(e) = copy_dir_recursive(&src, &dst) {
                tracing::warn!("Failed to copy {}: {}", item, e);
            } else {
                copied_files += count_files_in_dir(&dst);
            }
        } else {
            if let Some(parent) = dst.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if let Err(e) = std::fs::copy(&src, &dst) {
                tracing::warn!("Failed to copy {}: {}", item, e);
            } else {
                copied_files += 1;
            }
        }
    }

    tracing::info!("Migrated instance '{}' from {} ({} files copied)", name, launcher_type, copied_files);
    Ok(instance)
}

pub fn scan_custom_directory(path: &str) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let dir = PathBuf::from(path);
    if !dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Directory not found: {}", path)));
    }

    if dir.join("instance.cfg").exists() {
        let (name, version_id, loader_type, loader_version) = parse_multimc_cfg(&dir.join("instance.cfg"));
        let mc_dir = dir.join(".minecraft");
        let actual_mc = if mc_dir.exists() { &mc_dir } else { &dir };
        return Ok(vec![MigrateableInstance {
            name,
            version_id,
            loader_type,
            loader_version,
            game_dir: dir.to_string_lossy().to_string(),
            launcher_type: "multimc".to_string(),
            has_mods: actual_mc.join("mods").exists(),
            has_saves: actual_mc.join("saves").exists(),
            size_mb: dir_size_mb(actual_mc),
        }]);
    }

    if dir.join("versions").exists() || dir.join("hmclver.json").exists() {
        let launcher_type = if dir.join("hmclver.json").exists() { "hmcl" } else { "vanilla" };
        return scan_vanilla_style(&dir, launcher_type);
    }

    if dir.join("mods").exists() || dir.join("config").exists() {
        let version_id = guess_version_from_dir(&dir);
        let loader_type = detect_loader_from_mods(&dir);
        return Ok(vec![MigrateableInstance {
            name: dir.file_name().unwrap_or_default().to_string_lossy().to_string(),
            version_id,
            loader_type,
            loader_version: None,
            game_dir: dir.to_string_lossy().to_string(),
            launcher_type: "unknown".to_string(),
            has_mods: dir.join("mods").exists(),
            has_saves: dir.join("saves").exists(),
            size_mb: dir_size_mb(&dir),
        }]);
    }

    Ok(Vec::new())
}

fn guess_version_from_dir(dir: &std::path::Path) -> String {
    let versions_dir = dir.join("versions");
    if versions_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("1.") {
                    return name;
                }
            }
        }
    }
    "1.21".to_string()
}

fn detect_loader_from_mods(dir: &std::path::Path) -> Option<String> {
    let mods_dir = dir.join("mods");
    if !mods_dir.exists() { return None; }
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.contains("fabric") { return Some("fabric".to_string()); }
            if name.contains("forge") { return Some("forge".to_string()); }
            if name.contains("neoforge") { return Some("neoforge".to_string()); }
            if name.contains("quilt") { return Some("quilt".to_string()); }
        }
    }
    None
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

fn count_files_in_dir(dir: &std::path::Path) -> u32 {
    let mut count = 0u32;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                count += count_files_in_dir(&entry.path());
            } else {
                count += 1;
            }
        }
    }
    count
}

fn dir_size_mb(dir: &std::path::Path) -> u64 {
    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                size += dir_size_mb(&p);
            } else if let Ok(meta) = p.metadata() {
                size += meta.len();
            }
        }
    }
    size / (1024 * 1024)
}
