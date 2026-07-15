use crate::commands::instance::dir_size;
use crate::config;
use crate::content;
use crate::download::queue::DownloadControlState;
use crate::error::LauncherError;
use crate::instance;
use crate::modrinth;
use crate::platform::paths;
use crate::version;
use crate::AppState;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct HardwareProfile {
    pub cpu_name: String,
    pub cpu_count: usize,
    pub total_ram_mb: u64,
    pub gpu_name: String,
    pub performance_score: u32,
    pub performance_level: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskUsageInfo {
    pub total_bytes: u64,
    pub instances_bytes: u64,
    pub versions_bytes: u64,
    pub libraries_bytes: u64,
    pub assets_bytes: u64,
    pub logs_bytes: u64,
    pub other_bytes: u64,
    pub breakdown: Vec<DiskBreakdownItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskBreakdownItem {
    pub name: String,
    pub bytes: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstalledVersionInfo {
    pub version_id: String,
    pub size_bytes: u64,
    pub version_type: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Recommendation {
    pub slug: String,
    pub name: String,
    pub reason: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationStatus {
    pub mod_slug: String,
    pub mod_name: String,
    pub status: String,
    pub detail: String,
}

fn auto_tune_memory() -> u32 {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024;
    ((total_ram / 2).clamp(2048, 8192)) as u32
}

#[derive(Debug, Clone, Serialize)]
pub struct RecommendedConfig {
    pub min_memory: u32,
    pub max_memory: u32,
    pub java_version: u32,
    pub download_threads: u32,
    pub use_g1gc: bool,
    pub total_ram_mb: u64,
    pub cpu_cores: usize,
}

#[tauri::command]
pub async fn get_recommended_config() -> Result<RecommendedConfig, LauncherError> {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024;
    let cpu_cores = sys.cpus().len();
    let min_memory = 512u32;
    let max_memory = ((total_ram / 2).clamp(2048, 16384)) as u32;
    Ok(RecommendedConfig {
        min_memory,
        max_memory,
        java_version: 21,
        download_threads: (cpu_cores.clamp(2, 8)) as u32,
        use_g1gc: total_ram >= 8192,
        total_ram_mb: total_ram,
        cpu_cores,
    })
}

fn smart_tune_memory(mod_count: usize) -> u32 {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024;
    let mod_overhead = (mod_count as u64) * 50;
    let base = if total_ram <= 8192 {
        total_ram / 2
    } else if total_ram <= 16384 {
        total_ram * 3 / 5
    } else {
        total_ram * 2 / 3
    };
    let recommended = (base + mod_overhead).clamp(2048, total_ram * 3 / 4);
    recommended as u32
}

#[tauri::command]
pub async fn quick_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    control: tauri::State<'_, DownloadControlState>,
) -> Result<(), LauncherError> {
    let versions = version::manifest::fetch_versions_sorted().await?;
    let latest_release = versions.iter()
        .find(|v| v.version_type == "release")
        .ok_or_else(|| LauncherError::VersionNotFound("No release found".into()))?;

    let username = "Player";
    let auth = crate::auth::offline::offline_login(username)?;

    let mem = auto_tune_memory();
    tracing::info!("Quick start: {} ({}MB RAM)", latest_release.id, mem);

    crate::commands::launch::download_version(app.clone(), latest_release.id.clone(), latest_release.url.clone(), control.clone()).await?;
    crate::commands::launch::launch_game(
        app, state, control,
        latest_release.id.clone(), latest_release.url.clone(),
        auth.username, auth.uuid, auth.access_token,
        Some(mem), Some(256), None, None, None,
    ).await
}

#[tauri::command]
pub async fn select_fastest_mirror() -> Result<String, LauncherError> {
    let best = version::manifest::select_fastest_mirror().await;
    let mut cfg = config::load_config()?;
    cfg.download_source = best.clone();
    config::save_config(&cfg)?;
    crate::download::source::set_active(&best);
    tracing::info!("Fastest mirror selected: {}", best);
    Ok(best)
}

#[tauri::command]
pub async fn get_system_info() -> Result<serde_json::Value, LauncherError> {
    use sysinfo::System;
    let sys = System::new_all();
    let total_ram = sys.total_memory() / 1024 / 1024;
    let used_ram = sys.used_memory() / 1024 / 1024;
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_count = sys.cpus().len() as u32;
    // 不在此处调用 find_java() — 它会串行 spawn 11 个子进程，
    // 导致启动卡顿。前端通过独立的 findJava() IPC 获取 Java 版本。

    Ok(serde_json::json!({
        "total_ram_mb": total_ram,
        "used_ram_mb": used_ram,
        "cpu_name": cpu_name,
        "cpu_count": cpu_count,
        "java_version": null,
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    }))
}

#[tauri::command]
pub async fn auto_tune_memory_cmd() -> Result<u32, LauncherError> {
    Ok(auto_tune_memory())
}

#[tauri::command]
pub async fn get_instance_cover_image(instance_id: String) -> Result<Option<String>, LauncherError> {
    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    if !saves_dir.exists() {
        return Ok(None);
    }

    let mut worlds: Vec<(String, std::time::SystemTime)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&saves_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }
            let icon_path = path.join("icon.png");
            if !icon_path.exists() { continue; }
            let modified = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            worlds.push((icon_path.to_string_lossy().to_string(), modified));
        }
    }

    if worlds.is_empty() {
        return Ok(None);
    }

    worlds.sort_by_key(|b| std::cmp::Reverse(b.1));
    let icon_path = &worlds[0].0;

    let image_data = std::fs::read(icon_path)?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&image_data);
    Ok(Some(format!("data:image/png;base64,{}", b64)))
}

#[tauri::command]
pub async fn get_last_played_instance() -> Result<Option<instance::manager::GameInstance>, LauncherError> {
    let instances = instance::manager::list_instances()?;
    let last = instances.iter()
        .filter(|i| i.last_played.is_some())
        .max_by(|a, b| a.last_played.cmp(&b.last_played));
    Ok(last.cloned())
}

#[tauri::command]
pub async fn get_hardware_profile() -> Result<HardwareProfile, LauncherError> {
    use sysinfo::System;
    let sys = System::new_all();
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_count = sys.cpus().len();
    let total_ram_mb = sys.total_memory() / 1024 / 1024;

    let gpu_name = {
        use sysinfo::Components;
        let components = Components::new_with_refreshed_list();
        let gpu_keywords = ["gpu", "graphics", "nvidia", "amd", "radeon", "intel"];
        components
            .iter()
            .find(|c| {
                let label = c.label().to_lowercase();
                gpu_keywords.iter().any(|kw| label.contains(kw))
            })
            .map(|c| c.label().to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    };
    let ram_gb = total_ram_mb / 1024;
    let score = if cpu_count >= 8 && ram_gb >= 16 { 9 }
        else if cpu_count >= 6 && ram_gb >= 12 { 7 }
        else if cpu_count >= 4 && ram_gb >= 8 { 5 }
        else if cpu_count >= 2 && ram_gb >= 4 { 3 }
        else { 1 };

    let level = if score >= 7 { "high" } else if score >= 4 { "medium" } else { "low" };

    Ok(HardwareProfile {
        cpu_name,
        cpu_count,
        total_ram_mb,
        gpu_name,
        performance_score: score,
        performance_level: level.to_string(),
    })
}

#[tauri::command]
pub async fn get_disk_usage() -> Result<DiskUsageInfo, LauncherError> {
    let game_dir = paths::get_game_dir();
    let instances_bytes = dir_size(&game_dir.join("instances"));
    let versions_bytes = dir_size(&game_dir.join("shared").join("versions"));
    let libraries_bytes = dir_size(&game_dir.join("shared").join("libraries"));
    let assets_bytes = dir_size(&game_dir.join("shared").join("assets"));
    let logs_bytes = dir_size(&game_dir.join("logs"));
    let total_bytes = dir_size(&game_dir);
    let other_bytes = total_bytes.saturating_sub(instances_bytes + versions_bytes + libraries_bytes + assets_bytes + logs_bytes);

    let breakdown = vec![
        DiskBreakdownItem { name: "实例".into(), bytes: instances_bytes, path: "instances".into() },
        DiskBreakdownItem { name: "版本".into(), bytes: versions_bytes, path: "shared/versions".into() },
        DiskBreakdownItem { name: "库文件".into(), bytes: libraries_bytes, path: "shared/libraries".into() },
        DiskBreakdownItem { name: "资源".into(), bytes: assets_bytes, path: "shared/assets".into() },
        DiskBreakdownItem { name: "日志".into(), bytes: logs_bytes, path: "logs".into() },
    ];

    Ok(DiskUsageInfo { total_bytes, instances_bytes, versions_bytes, libraries_bytes, assets_bytes, logs_bytes, other_bytes, breakdown })
}

#[tauri::command]
pub async fn list_installed_versions() -> Result<Vec<InstalledVersionInfo>, LauncherError> {
    let versions_dir = paths::get_versions_dir();
    let manifest_dir = versions_dir.join("version_manifest_v2.json");
    let mut manifest_versions: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if manifest_dir.exists() {
        if let Ok(data) = std::fs::read_to_string(&manifest_dir) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(arr) = parsed["versions"].as_array() {
                    for v in arr {
                        if let (Some(id), Some(typ)) = (v["id"].as_str(), v["type"].as_str()) {
                            manifest_versions.insert(id.to_string(), typ.to_string());
                        }
                    }
                }
            }
        }
    }

    let mut result = Vec::new();
    if versions_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let id = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                    let size = dir_size(&p);
                    let version_type = manifest_versions.get(&id).cloned().unwrap_or_else(|| "unknown".to_string());
                    result.push(InstalledVersionInfo {
                        version_id: id,
                        size_bytes: size,
                        version_type,
                        path: p.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    result.sort_by(|a, b| b.version_id.cmp(&a.version_id));
    Ok(result)
}

#[tauri::command]
pub async fn delete_version_cmd(version_id: String) -> Result<(), LauncherError> {
    let version_dir = paths::get_versions_dir().join(&version_id);
    if !version_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("Version not found: {}", version_id)));
    }
    std::fs::remove_dir_all(&version_dir)
        .map_err(|e| LauncherError::Other(format!("removing {}: {}", version_dir.display(), e)))?;
    Ok(())
}

#[tauri::command]
pub async fn get_dir_size_cmd(path: String) -> Result<u64, LauncherError> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Ok(0);
    }
    let canonical = p.canonicalize()?;
    let game_dir = paths::get_game_dir().canonicalize().unwrap_or_else(|_| paths::get_game_dir());
    let config_dir = paths::get_config_dir().canonicalize().unwrap_or_else(|_| paths::get_config_dir());
    let is_allowed = canonical.starts_with(&game_dir) || canonical.starts_with(&config_dir);
    if !is_allowed {
        return Err(LauncherError::SecurityValidation("Access denied: path outside game/config directory".into()));
    }
    Ok(dir_size(&p))
}

#[tauri::command]
pub async fn get_recommendations(instance_id: String) -> Result<Vec<Recommendation>, LauncherError> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let mut installed_slugs: Vec<String> = Vec::new();

    if mods_dir.exists() {
        let metadata = content::load_metadata(&instance_id)?;
        installed_slugs = metadata.values().map(|r| r.slug.clone()).collect();
    }

    let rules: &[(&str, &[&str], &str, &str)] = &[
        ("sodium", &["iris", "indium", "lithium", "starlight"], "与Sodium搭配使用", "optimization"),
        ("fabric-api", &["modmenu", "roughly-enough-items"], "Fabric常用工具", "utility"),
        ("optifine", &["shaders", "optifabric"], "OptiFine相关", "optimization"),
        ("create", &["create-deco", "create-steam-n-rails"], "Create扩展", "content"),
        ("jei", &["jei-integration"], "JEI相关", "utility"),
    ];

    let mut recommendations = Vec::new();
    for (installed, recs, reason, category) in rules {
        if installed_slugs.iter().any(|s| s == *installed) {
            for rec in *recs {
                if !installed_slugs.iter().any(|s| s == *rec) {
                    recommendations.push(Recommendation {
                        slug: rec.to_string(),
                        name: rec.to_string(),
                        reason: reason.to_string(),
                        category: category.to_string(),
                    });
                }
            }
        }
    }

    Ok(recommendations)
}

#[tauri::command]
pub async fn check_migration_readiness(instance_id: String, target_version: String) -> Result<Vec<MigrationStatus>, LauncherError> {
    let metadata = content::load_metadata(&instance_id)?;
    let mut statuses = Vec::new();

    for (filename, record) in &metadata {
        if record.content_type != "mod" { continue; }
        let versions = modrinth::get_mod_versions(&record.slug, Some(&target_version), None).await;
        let status = match versions {
            Ok(v) if !v.is_empty() => ("compatible".to_string(), format!("已有 {} 版本", target_version)),
            Ok(_) => ("pending".to_string(), format!("尚无 {} 版本", target_version)),
            Err(e) => ("unknown".to_string(), format!("检查失败: {}", e)),
        };
        statuses.push(MigrationStatus {
            mod_slug: record.slug.clone(),
            mod_name: filename.clone(),
            status: status.0,
            detail: status.1,
        });
    }

    Ok(statuses)
}

#[tauri::command]
pub async fn smart_tune_memory_cmd(instance_id: String) -> Result<u32, LauncherError> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    let mod_count = if mods_dir.exists() {
        std::fs::read_dir(&mods_dir)
            .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
                e.path().extension().map(|ext| ext == "jar").unwrap_or(false)
            }).count())
            .unwrap_or(0)
    } else {
        0
    };
    Ok(smart_tune_memory(mod_count))
}
