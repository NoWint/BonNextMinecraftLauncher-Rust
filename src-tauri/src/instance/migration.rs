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
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
    pub min_memory: Option<u32>,
    pub max_memory: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationIssue {
    pub issue_type: String,
    pub severity: String,
    pub description: String,
    pub auto_fixable: bool,
    pub instance_id: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationFixResult {
    pub total_issues: u32,
    pub fixed: u32,
    pub unfixed: u32,
    pub details: Vec<String>,
}

fn base_dirs() -> Option<BaseDirs> {
    BaseDirs::new()
}

fn default_minecraft_dir() -> PathBuf {
    // macOS 上官方 Minecraft 启动器目录是 ~/Library/Application Support/minecraft（不带点前缀）
    // Linux/Windows 上是 ~/.minecraft 或 %APPDATA%/.minecraft
    #[cfg(target_os = "macos")]
    {
        if let Some(bd) = base_dirs() {
            let candidate = bd.data_dir().join("minecraft");
            if candidate.exists() {
                return candidate;
            }
        }
    }
    base_dirs()
        .map(|bd| bd.data_dir().join(".minecraft"))
        .unwrap_or_else(|| PathBuf::from(".minecraft"))
}

fn default_hmcl_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let data = base_dirs()?.data_dir().to_path_buf();

    // macOS: HMCL 默认使用官方 Minecraft 目录 ~/Library/Application Support/minecraft
    // HMCL 主配置文件是 hmcl.json（Windows）或 .hmcl.json（Linux/Mac）
    #[cfg(target_os = "macos")]
    {
        let mac_mc_dir = data.join("minecraft");
        if mac_mc_dir.exists() {
            // 检查是否有 HMCL 标记文件
            if mac_mc_dir.join("hmcl.json").exists()
                || mac_mc_dir.join(".hmcl.json").exists()
                || mac_mc_dir.join("hmclversion.cfg").exists()
                || home.join(".hmcl").exists()
            {
                return Some(mac_mc_dir);
            }
        }
    }

    // 通用检测：~/.hmcl 目录（HMCL 当前目录）
    let candidate = home.join(".hmcl");
    if candidate.exists() {
        return Some(candidate);
    }

    // 通用检测：~/.minecraft 下有 hmcl.json 或 .hmcl.json
    let candidate = home.join(".minecraft");
    if candidate.join("hmcl.json").exists() || candidate.join(".hmcl.json").exists() {
        return Some(candidate);
    }

    // macOS/Linux: 检查 data_dir 下的 minecraft 或 .minecraft
    #[cfg(target_os = "macos")]
    {
        let candidate = data.join("minecraft");
        if candidate.join("hmcl.json").exists() || candidate.join(".hmcl.json").exists() {
            return Some(candidate);
        }
    }

    let candidate = data.join(".minecraft");
    if candidate.join("hmcl.json").exists() || candidate.join(".hmcl.json").exists() {
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
    ];
    for candidate in &candidates {
        if candidate.exists() && candidate.join("instances").exists() {
            return Some(candidate.clone());
        }
    }
    None
}

fn default_prism_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let data = base_dirs()?.data_dir().to_path_buf();
    let candidates = [
        data.join("PrismLauncher"),
        home.join("PrismLauncher"),
        home.join(".local/share/PrismLauncher"),
    ];
    for candidate in &candidates {
        if candidate.exists() && candidate.join("instances").exists() {
            return Some(candidate.clone());
        }
    }
    None
}

fn default_gdlauncher_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let data = base_dirs()?.data_dir().to_path_buf();
    let candidates = [
        home.join("gdlauncher"),
        home.join("GDLauncher"),
        data.join("gdlauncher"),
        home.join(".gdlauncher"),
    ];
    for candidate in &candidates {
        let instances_dir = candidate.join("instances");
        if instances_dir.exists() {
            return Some(candidate.clone());
        }
    }
    None
}

fn default_xmcl_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let data = base_dirs()?.data_dir().to_path_buf();
    let candidates = [
        home.join(".xmcl"),
        data.join("xmcl"),
        home.join("xmcl"),
    ];
    for candidate in &candidates {
        if candidate.exists() && (candidate.join("instances").exists() || candidate.join("profiles").exists()) {
            return Some(candidate.clone());
        }
    }
    None
}

fn default_pcl2_dir() -> Option<PathBuf> {
    let home = base_dirs()?.home_dir().to_path_buf();
    let candidates: Vec<PathBuf> = if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA").ok();
        let local_appdata = std::env::var("LOCALAPPDATA").ok();
        [
            appdata.as_ref().map(|p| PathBuf::from(p).join(".minecraft")),
            local_appdata.as_ref().map(|p| PathBuf::from(p).join("PCL")),
            Some(home.join("AppData").join("Roaming").join(".minecraft")),
            Some(home.join("AppData").join("Local").join("PCL")),
            Some(home.join(".minecraft")),
        ]
        .into_iter()
        .flatten()
        .collect()
    } else {
        vec![
            home.join(".minecraft"),
        ]
    };
    for candidate in &candidates {
        if candidate.join("PCL").exists()
            || candidate.join("launcher_config.json").exists()
            || candidate.join("PCL2").exists()
        {
            return Some(candidate.clone());
        }
    }
    for candidate in &candidates {
        if candidate.join("versions").exists() {
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
            launchers.push(DetectedLauncher {
                launcher_type: "multimc".to_string(),
                name: "MultiMC".to_string(),
                game_dir: mmc_dir.to_string_lossy().to_string(),
                instance_count: count,
            });
        }
    }

    if let Some(prism_dir) = default_prism_dir() {
        let count = count_multimc_instances(&prism_dir);
        if count > 0 {
            launchers.push(DetectedLauncher {
                launcher_type: "prism".to_string(),
                name: "Prism Launcher".to_string(),
                game_dir: prism_dir.to_string_lossy().to_string(),
                instance_count: count,
            });
        }
    }

    if let Some(gd_dir) = default_gdlauncher_dir() {
        let count = count_gdlauncher_instances(&gd_dir);
        if count > 0 {
            launchers.push(DetectedLauncher {
                launcher_type: "gdlauncher".to_string(),
                name: "GDLauncher".to_string(),
                game_dir: gd_dir.to_string_lossy().to_string(),
                instance_count: count,
            });
        }
    }

    if let Some(xmcl_dir) = default_xmcl_dir() {
        let count = count_xmcl_instances(&xmcl_dir);
        if count > 0 {
            launchers.push(DetectedLauncher {
                launcher_type: "xmcl".to_string(),
                name: "XMCL".to_string(),
                game_dir: xmcl_dir.to_string_lossy().to_string(),
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

fn count_gdlauncher_instances(dir: &std::path::Path) -> u32 {
    let instances_dir = dir.join("instances");
    if !instances_dir.exists() {
        return 0;
    }
    let mut count = 0u32;
    if let Ok(entries) = std::fs::read_dir(&instances_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() && entry.path().join("instance.json").exists() {
                count += 1;
            }
        }
    }
    count
}

fn count_xmcl_instances(dir: &std::path::Path) -> u32 {
    let instances_dir = dir.join("instances");
    if instances_dir.exists() {
        let mut count = 0u32;
        if let Ok(entries) = std::fs::read_dir(&instances_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() && entry.path().join("instance.json").exists() {
                    count += 1;
                }
            }
        }
        return count;
    }
    let profiles_dir = dir.join("profiles");
    if profiles_dir.exists() {
        let mut count = 0u32;
        if let Ok(entries) = std::fs::read_dir(&profiles_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() && entry.path().join("profile.json").exists() {
                    count += 1;
                }
            }
        }
        return count;
    }
    0
}

pub fn scan_launcher_instances(launcher_type: &str, game_dir: &str) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let dir = PathBuf::from(game_dir);
    if !dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Directory not found: {}", game_dir)));
    }

    match launcher_type {
        "vanilla" | "hmcl" | "pcl2" => scan_vanilla_style(&dir, launcher_type),
        "multimc" => scan_multimc_style(&dir),
        "prism" => scan_prism_style(&dir),
        "gdlauncher" => scan_gdlauncher_style(&dir),
        "xmcl" => scan_xmcl_style(&dir),
        _ => Err(LauncherError::InvalidConfig(format!("Unsupported launcher: {}", launcher_type))),
    }
}

fn scan_vanilla_style(dir: &std::path::Path, launcher_type: &str) -> Result<Vec<MigrateableInstance>, LauncherError> {
    if launcher_type == "hmcl" {
        if let Ok(hmcl_profiles) = parse_hmcl_profiles(dir) {
            if !hmcl_profiles.is_empty() {
                return Ok(hmcl_profiles);
            }
        }
    }

    if launcher_type == "pcl2" {
        if let Ok(pcl2_profiles) = parse_pcl2_profiles(dir) {
            if !pcl2_profiles.is_empty() {
                return Ok(pcl2_profiles);
            }
        }
    }

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
                java_path: None,
                jvm_args: None,
                min_memory: None,
                max_memory: None,
            });
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
    // HMCL 主配置文件：hmcl.json（Windows）或 .hmcl.json（Linux/Mac）
    let hmcl_json_path = dir.join("hmcl.json");
    let hmcl_json_alt_path = dir.join(".hmcl.json");
    let config_path = if hmcl_json_path.exists() {
        &hmcl_json_path
    } else if hmcl_json_alt_path.exists() {
        &hmcl_json_alt_path
    } else {
        return Err(LauncherError::VersionNotFound("hmcl.json not found".into()));
    };

    let data = std::fs::read_to_string(config_path)?;
    let json: serde_json::Value = serde_json::from_str(&data)?;

    let mut instances = Vec::new();

    // HMCL 配置结构：
    // - configurations: Map<String, Profile> — 每个 Profile 是一个游戏文件夹
    // - 每个 Profile 包含: gameDir, selectedMinecraftVersion, global (VersionSetting)
    // - accounts: 账户列表
    let configurations = json.get("configurations").and_then(|v| v.as_object());

    // 全局设置（从第一个 Profile 的 global 字段读取，或从顶层读取）
    let global_settings = configurations
        .and_then(|c| c.values().next())
        .and_then(|p| p.get("global"));

    let global_java = global_settings
        .and_then(|s| s.get("java"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let global_jvm_args = global_settings
        .and_then(|s| s.get("javaArgs"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let global_max_mem = global_settings
        .and_then(|s| s.get("maxMemory"))
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    let global_min_mem = global_settings
        .and_then(|s| s.get("minMemory"))
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);

    if let Some(profiles) = configurations {
        for (profile_name, profile) in profiles {
            // 每个 Profile 的 gameDir 指向一个 .minecraft 目录
            let game_dir_str = profile.get("gameDir").and_then(|v| v.as_str());
            let profile_dir = game_dir_str
                .map(PathBuf::from)
                .unwrap_or_else(|| dir.to_path_buf());

            // selectedMinecraftVersion 是当前选中的版本
            let selected_version = profile
                .get("selectedMinecraftVersion")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            // 扫描该 Profile 下的 versions 目录
            let versions_dir = profile_dir.join("versions");
            if !versions_dir.exists() {
                continue;
            }

            if let Ok(version_entries) = std::fs::read_dir(&versions_dir) {
                for v_entry in version_entries.flatten() {
                    let version_dir = v_entry.path();
                    if !version_dir.is_dir() {
                        continue;
                    }
                    let version_name = v_entry.file_name().to_string_lossy().to_string();
                    let version_json = version_dir.join(format!("{}.json", &version_name));
                    if !version_json.exists() {
                        continue;
                    }

                    let (version_id, loader_type, loader_version) =
                        parse_version_json(&version_json, &version_name);

                    // 读取 hmclversion.cfg 获取版本特定设置
                    let hmclversion_cfg = version_dir.join("hmclversion.cfg");
                    let (ver_java, ver_jvm_args, ver_max_mem, ver_min_mem) =
                        if hmclversion_cfg.exists() {
                            parse_hmclversion_cfg(&hmclversion_cfg)
                        } else {
                            (None, None, None, None)
                        };

                    // 检查 mods/saves 是否存在
                    // HMCL 版本隔离：gameDirType=1 时，游戏数据在 versions/<id>/ 下
                    // 否则在 .minecraft 根目录下
                    let game_dir_type = global_settings
                        .and_then(|s| s.get("gameDirType"))
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    let (mods_dir, saves_dir) = if game_dir_type == 1 {
                        (version_dir.join("mods"), version_dir.join("saves"))
                    } else {
                        (profile_dir.join("mods"), profile_dir.join("saves"))
                    };

                    let has_mods = mods_dir.exists()
                        && std::fs::read_dir(&mods_dir)
                            .map(|mut d| d.next().is_some())
                            .unwrap_or(false);
                    let has_saves = saves_dir.exists()
                        && std::fs::read_dir(&saves_dir)
                            .map(|mut d| d.next().is_some())
                            .unwrap_or(false);

                    // 实例名：Profile名/版本名（如果是选中版本则标记）
                    let instance_name = if version_name == selected_version {
                        format!("{} ★", version_name)
                    } else {
                        version_name
                    };

                    instances.push(MigrateableInstance {
                        name: format!("{} - {}", profile_name, instance_name),
                        version_id,
                        loader_type,
                        loader_version,
                        game_dir: profile_dir.to_string_lossy().to_string(),
                        launcher_type: "hmcl".to_string(),
                        has_mods,
                        has_saves,
                        size_mb: dir_size_mb(&version_dir),
                        java_path: ver_java.or_else(|| global_java.clone()),
                        jvm_args: ver_jvm_args.or_else(|| global_jvm_args.clone()),
                        min_memory: ver_min_mem.or(global_min_mem),
                        max_memory: ver_max_mem.or(global_max_mem),
                    });
                }
            }
        }
    }

    // 如果没有找到 configurations，回退到扫描 versions 目录
    if instances.is_empty() {
        let versions_dir = dir.join("versions");
        if versions_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&versions_dir) {
                for entry in entries.flatten() {
                    let version_dir = entry.path();
                    if !version_dir.is_dir() {
                        continue;
                    }
                    let version_name = entry.file_name().to_string_lossy().to_string();
                    let version_json = version_dir.join(format!("{}.json", &version_name));
                    if !version_json.exists() {
                        continue;
                    }

                    let (version_id, loader_type, loader_version) =
                        parse_version_json(&version_json, &version_name);

                    let mods_dir = dir.join("mods");
                    let has_mods = mods_dir.exists()
                        && std::fs::read_dir(&mods_dir)
                            .map(|mut d| d.next().is_some())
                            .unwrap_or(false);
                    let saves_dir = dir.join("saves");
                    let has_saves = saves_dir.exists()
                        && std::fs::read_dir(&saves_dir)
                            .map(|mut d| d.next().is_some())
                            .unwrap_or(false);

                    instances.push(MigrateableInstance {
                        name: version_name.clone(),
                        version_id,
                        loader_type,
                        loader_version,
                        game_dir: dir.to_string_lossy().to_string(),
                        launcher_type: "hmcl".to_string(),
                        has_mods,
                        has_saves,
                        size_mb: dir_size_mb(&version_dir),
                        java_path: global_java.clone(),
                        jvm_args: global_jvm_args.clone(),
                        min_memory: global_min_mem,
                        max_memory: global_max_mem,
                    });
                }
            }
        }
    }

    Ok(instances)
}

/// 解析 HMCL 版本配置文件 hmclversion.cfg（JSON 格式的 VersionSetting）
fn parse_hmclversion_cfg(
    path: &std::path::Path,
) -> (Option<String>, Option<String>, Option<u32>, Option<u32>) {
    let data = match std::fs::read_to_string(path) {
        Ok(d) => d,
        Err(_) => return (None, None, None, None),
    };
    let json: serde_json::Value = match serde_json::from_str(&data) {
        Ok(v) => v,
        Err(_) => return (None, None, None, None),
    };

    let java = json
        .get("java")
        .and_then(|v| v.as_str())
        .filter(|s| *s != "Auto" && !s.is_empty())
        .map(|s| s.to_string());
    let jvm_args = json
        .get("javaArgs")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let max_mem = json
        .get("maxMemory")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    let min_mem = json
        .get("minMemory")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);

    (java, jvm_args, max_mem, min_mem)
}

fn parse_pcl2_profiles(dir: &std::path::Path) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let mut instances = Vec::new();

    let config_path = dir.join("launcher_config.json");
    let mut global_java: Option<String> = None;
    let mut global_max_mem: Option<u32> = None;

    if config_path.exists() {
        if let Ok(data) = std::fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
                global_java = json.get("JavaPath")
                    .or_else(|| json.get("javaPath"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                global_max_mem = json.get("MaxMemory")
                    .or_else(|| json.get("maxMemory"))
                    .and_then(|v| v.as_u64())
                    .map(|v| v as u32);
            }
        }
    }

    let versions_dir = dir.join("versions");
    if versions_dir.exists() {
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

                instances.push(MigrateableInstance {
                    name: version_name,
                    version_id,
                    loader_type,
                    loader_version,
                    game_dir: dir.to_string_lossy().to_string(),
                    launcher_type: "pcl2".to_string(),
                    has_mods,
                    has_saves,
                    size_mb: dir_size_mb(dir),
                    java_path: global_java.clone(),
                    jvm_args: None,
                    min_memory: None,
                    max_memory: global_max_mem,
                });
            }
        }
    }

    let pcl_folders = ["PCL", "PCL2", "Plain Craft Launcher 2"];
    for folder_name in &pcl_folders {
        let pcl_dir = dir.join(folder_name);
        if !pcl_dir.exists() { continue; }
        let mc_dir = pcl_dir.join(".minecraft");
        let actual_dir = if mc_dir.exists() { &mc_dir } else { &pcl_dir };
        let versions = actual_dir.join("versions");
        if !versions.exists() { continue; }

        if let Ok(entries) = std::fs::read_dir(&versions) {
            for entry in entries.flatten() {
                let version_dir = entry.path();
                if !version_dir.is_dir() { continue; }
                let version_name = entry.file_name().to_string_lossy().to_string();
                let version_json = version_dir.join(format!("{}.json", &version_name));
                if !version_json.exists() { continue; }

                let (version_id, loader_type, loader_version) = parse_version_json(&version_json, &version_name);

                let mods_dir = actual_dir.join("mods");
                let has_mods = mods_dir.exists() && std::fs::read_dir(&mods_dir).map(|mut d| d.next().is_some()).unwrap_or(false);
                let saves_dir = actual_dir.join("saves");
                let has_saves = saves_dir.exists() && std::fs::read_dir(&saves_dir).map(|mut d| d.next().is_some()).unwrap_or(false);

                instances.push(MigrateableInstance {
                    name: version_name,
                    version_id,
                    loader_type,
                    loader_version,
                    game_dir: actual_dir.to_string_lossy().to_string(),
                    launcher_type: "pcl2".to_string(),
                    has_mods,
                    has_saves,
                    size_mb: dir_size_mb(actual_dir),
                    java_path: global_java.clone(),
                    jvm_args: None,
                    min_memory: None,
                    max_memory: global_max_mem,
                });
            }
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
                java_path: None,
                jvm_args: None,
                min_memory: None,
                max_memory: None,
            });
        }
    }

    Ok(instances)
}

fn scan_prism_style(dir: &std::path::Path) -> Result<Vec<MigrateableInstance>, LauncherError> {
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
                launcher_type: "prism".to_string(),
                has_mods,
                has_saves,
                size_mb: dir_size_mb(actual_mc),
                java_path: None,
                jvm_args: None,
                min_memory: None,
                max_memory: None,
            });
        }
    }

    Ok(instances)
}

fn scan_gdlauncher_style(dir: &std::path::Path) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let instances_dir = dir.join("instances");
    if !instances_dir.exists() {
        return Ok(Vec::new());
    }

    let mut instances = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&instances_dir) {
        for entry in entries.flatten() {
            let inst_dir = entry.path();
            if !inst_dir.is_dir() { continue; }
            let instance_json = inst_dir.join("instance.json");
            if !instance_json.exists() { continue; }

            let (name, version_id, loader_type, loader_version) = parse_gdlauncher_instance(&instance_json);
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
                launcher_type: "gdlauncher".to_string(),
                has_mods,
                has_saves,
                size_mb: dir_size_mb(actual_mc),
                java_path: None,
                jvm_args: None,
                min_memory: None,
                max_memory: None,
            });
        }
    }

    Ok(instances)
}

fn scan_xmcl_style(dir: &std::path::Path) -> Result<Vec<MigrateableInstance>, LauncherError> {
    let mut instances = Vec::new();

    let instances_dir = dir.join("instances");
    if instances_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&instances_dir) {
            for entry in entries.flatten() {
                let inst_dir = entry.path();
                if !inst_dir.is_dir() { continue; }
                let instance_json = inst_dir.join("instance.json");
                if !instance_json.exists() { continue; }

                let (name, version_id, loader_type, loader_version) = parse_xmcl_instance(&instance_json);
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
                    launcher_type: "xmcl".to_string(),
                    has_mods,
                    has_saves,
                    size_mb: dir_size_mb(actual_mc),
                    java_path: None,
                    jvm_args: None,
                    min_memory: None,
                    max_memory: None,
                });
            }
        }
    }

    let profiles_dir = dir.join("profiles");
    if profiles_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&profiles_dir) {
            for entry in entries.flatten() {
                let prof_dir = entry.path();
                if !prof_dir.is_dir() { continue; }
                let profile_json = prof_dir.join("profile.json");
                if !profile_json.exists() { continue; }

                let (name, version_id, loader_type, loader_version) = parse_xmcl_profile(&profile_json);
                let mc_dir = prof_dir.join(".minecraft");
                let actual_mc = if mc_dir.exists() { &mc_dir } else { &prof_dir };

                let mods_dir = actual_mc.join("mods");
                let has_mods = mods_dir.exists() && std::fs::read_dir(&mods_dir).map(|mut d| d.next().is_some()).unwrap_or(false);
                let saves_dir = actual_mc.join("saves");
                let has_saves = saves_dir.exists() && std::fs::read_dir(&saves_dir).map(|mut d| d.next().is_some()).unwrap_or(false);

                instances.push(MigrateableInstance {
                    name,
                    version_id,
                    loader_type,
                    loader_version,
                    game_dir: prof_dir.to_string_lossy().to_string(),
                    launcher_type: "xmcl".to_string(),
                    has_mods,
                    has_saves,
                    size_mb: dir_size_mb(actual_mc),
                    java_path: None,
                    jvm_args: None,
                    min_memory: None,
                    max_memory: None,
                });
            }
        }
    }

    Ok(instances)
}

fn parse_gdlauncher_instance(json_path: &std::path::Path) -> (String, String, Option<String>, Option<String>) {
    let data = match std::fs::read_to_string(json_path) {
        Ok(d) => d,
        Err(_) => return ("Unknown".to_string(), "1.21".to_string(), None, None),
    };
    let json: serde_json::Value = match serde_json::from_str(&data) {
        Ok(v) => v,
        Err(_) => return ("Unknown".to_string(), "1.21".to_string(), None, None),
    };

    let name = json.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let version_id = json.get("mcVersion")
        .or_else(|| json.get("minecraftVersion"))
        .and_then(|v| v.as_str())
        .unwrap_or("1.21")
        .to_string();

    let loader_type = json.get("loader")
        .and_then(|v| v.as_str())
        .and_then(|t| match t {
            "fabric" => Some("fabric".to_string()),
            "forge" => Some("forge".to_string()),
            "neoforge" => Some("neoforge".to_string()),
            "quilt" => Some("quilt".to_string()),
            _ => None,
        });

    let loader_version = json.get("loaderVersion")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    (name, version_id, loader_type, loader_version)
}

fn parse_xmcl_instance(json_path: &std::path::Path) -> (String, String, Option<String>, Option<String>) {
    let data = match std::fs::read_to_string(json_path) {
        Ok(d) => d,
        Err(_) => return ("Unknown".to_string(), "1.21".to_string(), None, None),
    };
    let json: serde_json::Value = match serde_json::from_str(&data) {
        Ok(v) => v,
        Err(_) => return ("Unknown".to_string(), "1.21".to_string(), None, None),
    };

    let name = json.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let runtime = json.get("runtime");

    let version_id = runtime
        .and_then(|r| r.get("minecraft"))
        .and_then(|v| v.as_str())
        .unwrap_or("1.21")
        .to_string();

    let runtime_obj = json.get("runtime");

    let (loader_type, loader_version) = if let Some(rt) = runtime_obj {
        if let Some(forge_ver) = rt.get("forge").and_then(|v| v.as_str()) {
            if !forge_ver.is_empty() {
                (Some("forge".to_string()), Some(forge_ver.to_string()))
            } else if let Some(fabric_ver) = rt.get("fabric").and_then(|v| v.as_str()) {
                if !fabric_ver.is_empty() {
                    (Some("fabric".to_string()), Some(fabric_ver.to_string()))
                } else if let Some(quilt_ver) = rt.get("quilt").and_then(|v| v.as_str()) {
                    if !quilt_ver.is_empty() {
                        (Some("quilt".to_string()), Some(quilt_ver.to_string()))
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            } else if let Some(quilt_ver) = rt.get("quilt").and_then(|v| v.as_str()) {
                if !quilt_ver.is_empty() {
                    (Some("quilt".to_string()), Some(quilt_ver.to_string()))
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else if let Some(fabric_ver) = rt.get("fabric").and_then(|v| v.as_str()) {
            if !fabric_ver.is_empty() {
                (Some("fabric".to_string()), Some(fabric_ver.to_string()))
            } else if let Some(quilt_ver) = rt.get("quilt").and_then(|v| v.as_str()) {
                if !quilt_ver.is_empty() {
                    (Some("quilt".to_string()), Some(quilt_ver.to_string()))
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else if let Some(quilt_ver) = rt.get("quilt").and_then(|v| v.as_str()) {
            if !quilt_ver.is_empty() {
                (Some("quilt".to_string()), Some(quilt_ver.to_string()))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    (name, version_id, loader_type, loader_version)
}

fn parse_xmcl_profile(json_path: &std::path::Path) -> (String, String, Option<String>, Option<String>) {
    parse_xmcl_instance(json_path)
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
    java_path: Option<&str>,
    jvm_args: Option<&str>,
    min_memory: Option<u32>,
    max_memory: Option<u32>,
) -> Result<GameInstance, LauncherError> {
    let source_dir = PathBuf::from(source_game_dir);
    if !source_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Source directory not found: {}", source_game_dir)));
    }

    // 关键修复：移除强制网络依赖。迁移本质上是本地文件复制操作，
    // 不应因为无法拉取 Mojang 版本清单而失败。
    // version_url 留空，后续启动时按需拉取。
    let version_url = crate::version::manifest::fetch_versions_sorted()
        .await
        .ok()
        .and_then(|manifest| {
            manifest.iter().find(|v| v.id == version_id).map(|v| v.url.clone())
        })
        .unwrap_or_default();
    if version_url.is_empty() {
        tracing::warn!("Could not resolve version URL for {} (offline or not in manifest). Instance will be created without version_url; it will be resolved on first launch.", version_id);
    }

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
        max_memory: max_memory.unwrap_or(4096),
        min_memory: min_memory.unwrap_or(512),
        java_path: java_path.map(|s| s.to_string()),
        jvm_args: jvm_args.map(|s| s.to_string()),
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

    manager::create_instance(&instance)?;

    let dest_mc_dir = paths::get_instance_minecraft_dir(&inst_id);

    // 关键修复：直接使用 source_game_dir 作为 source_mc_dir。
    // scan_launcher_instances 阶段已经解析好了正确的 game_dir（含 .minecraft 子目录处理），
    // 这里不应按 launcher_type 重新猜测路径，否则会导致路径不一致。
    let source_mc_dir = source_dir.clone();

    // 关键修复：增加 "versions" 目录复制。
    // 旧代码漏掉了 versions 目录，导致迁移后的实例缺少版本 JSON/JAR 文件，
    // 健康检查报 "Version JAR missing"，无法直接启动。
    let copy_dirs = [
        "versions", "mods", "config", "saves", "resourcepacks", "shaderpacks",
        "defaultconfigs", "kubejs", "journeymap", "worldbackup",
        "blueprints", "structures", "datapacks",
        "options.txt", "optionsof.txt", "servers.dat",
        "optionsshaders.txt", "mods_list.json",
        "logs", "crash-reports", "screenshots",
    ];
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
        let launcher_type = if dir.to_string_lossy().contains("Prism") { "prism" } else { "multimc" };
        return Ok(vec![MigrateableInstance {
            name,
            version_id,
            loader_type,
            loader_version,
            game_dir: dir.to_string_lossy().to_string(),
            launcher_type: launcher_type.to_string(),
            has_mods: actual_mc.join("mods").exists(),
            has_saves: actual_mc.join("saves").exists(),
            size_mb: dir_size_mb(actual_mc),
            java_path: None,
            jvm_args: None,
            min_memory: None,
            max_memory: None,
        }]);
    }

    if dir.join("instance.json").exists() {
        let data = std::fs::read_to_string(dir.join("instance.json")).unwrap_or_default();
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
            if json.get("runtime").is_some() {
                let (name, version_id, loader_type, loader_version) = parse_xmcl_instance(&dir.join("instance.json"));
                let mc_dir = dir.join(".minecraft");
                let actual_mc = if mc_dir.exists() { &mc_dir } else { &dir };
                return Ok(vec![MigrateableInstance {
                    name,
                    version_id,
                    loader_type,
                    loader_version,
                    game_dir: dir.to_string_lossy().to_string(),
                    launcher_type: "xmcl".to_string(),
                    has_mods: actual_mc.join("mods").exists(),
                    has_saves: actual_mc.join("saves").exists(),
                    size_mb: dir_size_mb(actual_mc),
                    java_path: None,
                    jvm_args: None,
                    min_memory: None,
                    max_memory: None,
                }]);
            }
            if json.get("loader").is_some() || json.get("mcVersion").is_some() || json.get("minecraftVersion").is_some() {
                let (name, version_id, loader_type, loader_version) = parse_gdlauncher_instance(&dir.join("instance.json"));
                let mc_dir = dir.join(".minecraft");
                let actual_mc = if mc_dir.exists() { &mc_dir } else { &dir };
                return Ok(vec![MigrateableInstance {
                    name,
                    version_id,
                    loader_type,
                    loader_version,
                    game_dir: dir.to_string_lossy().to_string(),
                    launcher_type: "gdlauncher".to_string(),
                    has_mods: actual_mc.join("mods").exists(),
                    has_saves: actual_mc.join("saves").exists(),
                    size_mb: dir_size_mb(actual_mc),
                    java_path: None,
                    jvm_args: None,
                    min_memory: None,
                    max_memory: None,
                }]);
            }
        }
    }

    // 检测 HMCL（hmcl.json 或 .hmcl.json）或 vanilla（versions 目录）
    let is_hmcl = dir.join("hmcl.json").exists() || dir.join(".hmcl.json").exists();
    if dir.join("versions").exists() || is_hmcl {
        let launcher_type = if is_hmcl { "hmcl" } else { "vanilla" };
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
            java_path: None,
            jvm_args: None,
            min_memory: None,
            max_memory: None,
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

pub fn diagnose_migration_issues(instance_id: &str) -> Result<Vec<MigrationIssue>, LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(instance_id);
    let instance_dir = paths::get_instance_dir(instance_id);
    if !instance_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Instance not found: {}", instance_id)));
    }

    let mut issues = Vec::new();

    if !mc_dir.exists() {
        let _ = std::fs::create_dir_all(&mc_dir);
        issues.push(MigrationIssue {
            issue_type: "missing_directory".to_string(),
            severity: "high".to_string(),
            description: format!(".minecraft directory was missing, created: {}", mc_dir.to_string_lossy()),
            auto_fixable: true,
            instance_id: Some(instance_id.to_string()),
            path: Some(mc_dir.to_string_lossy().to_string()),
        });
    }

    let essential_dirs = ["mods", "config", "saves"];
    for dir_name in &essential_dirs {
        let d = mc_dir.join(dir_name);
        if !d.exists() {
            let _ = std::fs::create_dir_all(&d);
            issues.push(MigrationIssue {
                issue_type: "missing_directory".to_string(),
                severity: "low".to_string(),
                description: format!("Missing {} directory, created", dir_name),
                auto_fixable: true,
                instance_id: Some(instance_id.to_string()),
                path: Some(d.to_string_lossy().to_string()),
            });
        }
    }

    if mc_dir.join("mods").exists() {
        if let Ok(entries) = std::fs::read_dir(mc_dir.join("mods")) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if name.ends_with(".jar.disabled") || name.ends_with(".jar.bak") {
                        issues.push(MigrationIssue {
                            issue_type: "disabled_mod".to_string(),
                            severity: "info".to_string(),
                            description: format!("Disabled mod found: {}", name),
                            auto_fixable: false,
                            instance_id: Some(instance_id.to_string()),
                            path: Some(path.to_string_lossy().to_string()),
                        });
                    }
                    if name.ends_with(".jar") {
                        if let Ok(meta) = path.metadata() {
                            if meta.len() == 0 {
                                issues.push(MigrationIssue {
                                    issue_type: "empty_file".to_string(),
                                    severity: "medium".to_string(),
                                    description: format!("Empty mod file: {}", name),
                                    auto_fixable: true,
                                    instance_id: Some(instance_id.to_string()),
                                    path: Some(path.to_string_lossy().to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    let instance = manager::get_instance(instance_id)?
        .ok_or_else(|| LauncherError::VersionNotFound(format!("Instance not found: {}", instance_id)))?;
    if let Some(ref java) = instance.java_path {
        if !java.is_empty() && !std::path::Path::new(java).exists() {
            issues.push(MigrationIssue {
                issue_type: "invalid_java_path".to_string(),
                severity: "high".to_string(),
                description: format!("Java path does not exist: {}", java),
                auto_fixable: true,
                instance_id: Some(instance_id.to_string()),
                path: Some(java.clone()),
            });
        }
    }

    if instance.version_id.is_empty() {
        issues.push(MigrationIssue {
            issue_type: "missing_version".to_string(),
            severity: "high".to_string(),
            description: "Instance has no version ID configured".to_string(),
            auto_fixable: false,
            instance_id: Some(instance_id.to_string()),
            path: None,
        });
    }

    let version_jar = mc_dir.join(format!("{}.jar", instance.version_id));
    if !version_jar.exists() {
        let versions_dir = mc_dir.join("versions").join(&instance.version_id);
        let alt_jar = versions_dir.join(format!("{}.jar", instance.version_id));
        if !alt_jar.exists() {
            issues.push(MigrationIssue {
                issue_type: "missing_version_jar".to_string(),
                severity: "medium".to_string(),
                description: format!("Version JAR not found: {}", instance.version_id),
                auto_fixable: false,
                instance_id: Some(instance_id.to_string()),
                path: None,
            });
        }
    }

    Ok(issues)
}

pub fn fix_migration_issues(instance_id: &str, issues: &[MigrationIssue]) -> Result<MigrationFixResult, LauncherError> {
    let mut fixed: u32 = 0;
    let mut unfixed: u32 = 0;
    let mut details = Vec::new();

    for issue in issues {
        if !issue.auto_fixable {
            unfixed += 1;
            details.push(format!("[SKIP] {}", issue.description));
            continue;
        }

        match issue.issue_type.as_str() {
            "missing_directory" => {
                if let Some(ref path) = issue.path {
                    let p = PathBuf::from(path);
                    if !p.exists() {
                        if let Err(e) = std::fs::create_dir_all(&p) {
                            unfixed += 1;
                            details.push(format!("[FAIL] Cannot create directory {}: {}", path, e));
                        } else {
                            fixed += 1;
                            details.push(format!("[FIXED] Created directory: {}", path));
                        }
                    } else {
                        fixed += 1;
                    }
                }
            }
            "empty_file" => {
                if let Some(ref path) = issue.path {
                    let p = PathBuf::from(path);
                    if p.exists() {
                        match std::fs::remove_file(&p) {
                            Ok(()) => {
                                fixed += 1;
                                details.push(format!("[FIXED] Removed empty file: {}", path));
                            }
                            Err(e) => {
                                unfixed += 1;
                                details.push(format!("[FAIL] Cannot remove file {}: {}", path, e));
                            }
                        }
                    }
                }
            }
            "invalid_java_path" => {
                if let Ok(detected) = crate::platform::java::find_java() {
                    if let Ok(Some(mut inst)) = manager::get_instance(instance_id) {
                        inst.java_path = Some(detected.to_string_lossy().to_string());
                        let _ = manager::update_instance(&inst);
                        fixed += 1;
                        details.push(format!("[FIXED] Updated Java path to: {}", detected.to_string_lossy()));
                    }
                } else {
                    unfixed += 1;
                    details.push("[FAIL] Cannot auto-detect Java installation".to_string());
                }
            }
            _ => {
                unfixed += 1;
                details.push(format!("[SKIP] Unknown issue type: {}", issue.issue_type));
            }
        }
    }

    Ok(MigrationFixResult {
        total_issues: issues.len() as u32,
        fixed,
        unfixed,
        details,
    })
}
