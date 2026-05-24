use std::collections::HashMap;
use std::collections::HashSet;

use crate::config;
use crate::error::LauncherError;
use crate::instance;
use crate::modrinth;
use crate::platform::paths;
use crate::security;
use serde::Deserialize;
use serde::Serialize;
use tauri::Emitter;

const SYNONYMS: &[(&str, &[&str])] = &[
    ("shader", &["shaders", "glsl", "光影", "着色器"]),
    ("modpack", &["整合包", "modpacks", "pack", "collection"]),
    ("optimization", &["optimize", "performance", "fps", "优化", "性能", "sodium", "lithium", "starlight"]),
    ("texture", &["textures", "resourcepack", "材质", "资源包", "rp"]),
    ("map", &["地图", "world", "adventure", "冒险"]),
    ("fabric", &["fabricmc", "fabric-loader"]),
    ("forge", &["minecraftforge", "neoforge", "neo"]),
    ("pvp", &["combat", "battle", "fighting"]),
    ("survival", &["生存"]),
    ("creative", &["创造", "building", "建筑"]),
    ("redstone", &["红石", "circuit", "logic"]),
    ("food", &["食物", "cooking", "culinary"]),
    ("magic", &["魔法", "spell", "wizardry", "sorcery"]),
    ("tech", &["科技", "technology", "industrial", "machine"]),
    ("biome", &["生态", "terrain", "worldgen"]),
];

fn expand_query(query: &str) -> Vec<String> {
    let query_lower = query.to_lowercase();
    let mut expanded = vec![query_lower.clone()];

    for (key, synonyms) in SYNONYMS {
        if query_lower.contains(key) {
            for syn in *synonyms {
                if !expanded.contains(&syn.to_string()) {
                    expanded.push(syn.to_string());
                }
            }
        }
        for syn in *synonyms {
            if query_lower.contains(syn) {
                if !expanded.contains(&key.to_string()) {
                    expanded.push(key.to_string());
                }
                break;
            }
        }
    }

    expanded
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
        .filter(|s| !s.is_empty() && s.len() > 1)
        .map(|s| s.to_string())
        .collect()
}

fn compute_tf_idf(query_tokens: &[String], doc_tokens: &[String], idf: &HashMap<String, f32>) -> f32 {
    let query_set: HashSet<_> = query_tokens.iter().collect();
    let doc_freq: HashMap<&String, usize> = {
        let mut freq = HashMap::new();
        for token in doc_tokens {
            *freq.entry(token).or_insert(0) += 1;
        }
        freq
    };
    let doc_len = doc_tokens.len().max(1) as f32;

    let mut score = 0.0f32;
    for (token, &count) in &doc_freq {
        if query_set.contains(token) {
            let tf = count as f32 / doc_len;
            let idf_val = idf.get(*token).copied().unwrap_or(1.0);
            score += tf * idf_val;
        }
    }
    score
}

#[derive(Debug, Clone, Serialize)]
pub struct ConflictInfo {
    pub mod_a: String,
    pub mod_b: String,
    pub reason: String,
    pub severity: String,
}

#[tauri::command]
pub async fn check_mod_conflicts(instance_id: String) -> Result<Vec<ConflictInfo>, LauncherError> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    let mut conflicts = Vec::new();
    let mut mod_ids: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&mods_dir)?.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "jar").unwrap_or(false) {
            mod_ids.push(path.file_name().unwrap_or_default().to_string_lossy().to_string());
        }
    }

    let known_conflicts: &[(&str, &str, &str, &str)] = &[
        ("sodium", "optifine", "Sodium与OptiFine不兼容，请选择其中一个", "high"),
        ("lithium", "optifine", "Lithium与OptiFine可能冲突", "medium"),
        ("iris", "optifine", "Iris与OptiFine不兼容，请选择其中一个", "high"),
        ("sodium", "rubidium", "Sodium与Rubidium功能重叠，不应同时安装", "high"),
        ("lithium", "rubidium", "Lithium与Rubidium功能重叠", "medium"),
        ("canvas", "sodium", "Canvas渲染器与Sodium不兼容", "high"),
        ("phosphor", "starlight", "Phosphor与Starlight功能重叠", "medium"),
    ];

    for (a, b, reason, severity) in known_conflicts {
        let has_a = mod_ids.iter().any(|m| m.to_lowercase().contains(a));
        let has_b = mod_ids.iter().any(|m| m.to_lowercase().contains(b));
        if has_a && has_b {
            conflicts.push(ConflictInfo {
                mod_a: a.to_string(),
                mod_b: b.to_string(),
                reason: reason.to_string(),
                severity: severity.to_string(),
            });
        }
    }

    Ok(conflicts)
}

#[tauri::command]
pub async fn find_java() -> Result<String, LauncherError> {
    let java_path = crate::platform::java::find_java()?;
    Ok(java_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn find_all_java() -> Vec<crate::platform::java::JavaInfo> {
    crate::platform::java::find_all_java()
}

#[tauri::command]
pub async fn check_java_version(java_path: String) -> Result<Option<u32>, LauncherError> {
    let path = std::path::PathBuf::from(&java_path);
    let version = crate::platform::java::check_java_version(&path);
    Ok(version)
}

#[tauri::command]
pub async fn check_jre_available(major_version: u32) -> Result<bool, LauncherError> {
    if crate::platform::java_download::find_downloaded_jre(major_version).is_some() {
        return Ok(true);
    }
    match crate::platform::java_download::fetch_available_jres(major_version).await {
        Ok(releases) => Ok(!releases.is_empty()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn get_jre_sources() -> Vec<crate::platform::java_download::JreSourceInfo> {
    crate::platform::java_download::get_jre_sources()
}

#[tauri::command]
pub async fn fetch_available_jre_versions(major_version: u32) -> Result<Vec<crate::platform::java_download::JreRelease>, LauncherError> {
    crate::platform::java_download::fetch_available_jres(major_version).await
}

#[tauri::command]
pub async fn download_java_version(
    major_version: u32,
    source: String,
    app: tauri::AppHandle,
) -> Result<String, LauncherError> {
    let jre_source = crate::platform::java_download::JreSource::from_str(&source);
    let app_clone = app.clone();
    crate::platform::java_download::download_java_with_source(
        major_version,
        &jre_source,
        move |downloaded, total| {
            let _ = app_clone.emit("jre-download-progress", serde_json::json!({
                "downloaded": downloaded,
                "total": total,
                "version": major_version,
            }));
        },
    ).await
}

#[tauri::command]
pub async fn list_downloaded_jres() -> Vec<u32> {
    let java_dir = paths::get_game_dir().join("java");
    if !java_dir.exists() {
        return Vec::new();
    }
    let mut versions = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&java_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    if let Ok(v) = name.parse::<u32>() {
                        if crate::platform::java_download::find_downloaded_jre(v).is_some() {
                            versions.push(v);
                        }
                    }
                }
            }
        }
    }
    versions.sort();
    versions
}

#[tauri::command]
pub async fn warmup_launch(instance_id: String) -> Result<(), LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let libs_dir = mc_dir.join("libraries");
    if libs_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&libs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "jar").unwrap_or(false) {
                    let _ = std::fs::read(&path);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_guest_instance() -> Result<instance::manager::GameInstance, LauncherError> {
    let inst_id = format!("guest_{}", chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = instance::manager::GameInstance {
        id: inst_id.clone(),
        name: "访客模式".to_string(),
        version_id: "1.21".to_string(),
        version_url: String::new(),
        loader_type: None,
        loader_version: None,
        description: "临时访客实例，退出后自动清理".to_string(),
        max_memory: 2048,
        min_memory: 512,
        java_path: None,
        jvm_args: None,
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };
    instance::manager::create_instance(&instance)?;
    Ok(instance)
}

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified: String,
}

#[tauri::command]
pub async fn list_screenshots(instance_id: String) -> Result<Vec<ScreenshotInfo>, LauncherError> {
    let ss_dir = paths::get_instance_minecraft_dir(&instance_id).join("screenshots");
    if !ss_dir.exists() {
        return Ok(Vec::new());
    }

    let mut screenshots = Vec::new();
    for entry in std::fs::read_dir(&ss_dir)?.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "png").unwrap_or(false) {
            let meta = std::fs::metadata(&path).ok();
            let modified = meta.as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::SystemTime::UNIX_EPOCH).ok())
                .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_default())
                .unwrap_or_default();
            screenshots.push(ScreenshotInfo {
                filename: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.map(|m| m.len()).unwrap_or(0),
                modified,
            });
        }
    }

    screenshots.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(screenshots)
}

#[tauri::command]
pub async fn set_instance_icon(instance_id: String, icon_path: String) -> Result<(), LauncherError> {
    let src = std::path::Path::new(&icon_path);
    if !src.exists() {
        return Err(LauncherError::Other(format!("Icon file not found: {}", icon_path)));
    }
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !["png", "jpg", "jpeg", "gif", "webp", "bmp"].contains(&ext.as_str()) {
        return Err(LauncherError::Other("Icon must be an image file (png, jpg, gif, webp, bmp)".into()));
    }
    let metadata = std::fs::metadata(src)?;
    if metadata.len() > 5 * 1024 * 1024 {
        return Err(LauncherError::Other("Icon file too large (max 5MB)".into()));
    }

    let dest_dir = paths::get_instance_dir(&instance_id);
    std::fs::create_dir_all(&dest_dir)?;
    let dest = dest_dir.join("icon.png");

    let img_data = std::fs::read(src)?;
    std::fs::write(&dest, &img_data)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadScheduleConfig {
    pub max_speed_bytes: u64,
    pub active_during_game: bool,
    pub priority: String,
}

#[tauri::command]
pub async fn get_download_schedule_config() -> Result<DownloadScheduleConfig, LauncherError> {
    let config_path = paths::get_game_dir().join("download_schedule.json");
    if config_path.exists() {
        let data = std::fs::read_to_string(&config_path)?;
        let config: DownloadScheduleConfig = serde_json::from_str(&data).unwrap_or(DownloadScheduleConfig {
            max_speed_bytes: 0,
            active_during_game: false,
            priority: "normal".to_string(),
        });
        Ok(config)
    } else {
        Ok(DownloadScheduleConfig {
            max_speed_bytes: 0,
            active_during_game: false,
            priority: "normal".to_string(),
        })
    }
}

#[tauri::command]
pub async fn set_download_schedule_config(max_speed_bytes: u64, active_during_game: bool, priority: String) -> Result<(), LauncherError> {
    let config_path = paths::get_game_dir().join("download_schedule.json");
    let config = serde_json::json!({
        "max_speed_bytes": max_speed_bytes,
        "active_during_game": active_during_game,
        "priority": priority,
    });
    let data = serde_json::to_string_pretty(&config)?;
    std::fs::write(&config_path, data)?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct GcRecommendation {
    pub gc_type: String,
    pub heap_size_mb: u32,
    pub metaspace_mb: u32,
    pub jvm_args: Vec<String>,
    pub description: String,
    pub suitable_for: String,
    pub reason: String,
}

#[tauri::command]
pub async fn get_gc_recommendations(instance_id: String) -> Result<Vec<GcRecommendation>, LauncherError> {
    let hw = crate::commands::system::get_hardware_profile().await?;
    let total_ram_gb = hw.total_ram_mb as f64 / 1024.0;

    let mods_dir = crate::platform::paths::get_instance_mods_dir(&instance_id);
    let mod_count = if mods_dir.exists() {
        std::fs::read_dir(&mods_dir)
            .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
                e.path().extension().map(|ext| ext == "jar").unwrap_or(false)
            }).count())
            .unwrap_or(0)
    } else {
        0
    };

    let metaspace_mb = if mod_count > 100 {
        512
    } else if mod_count > 50 {
        384
    } else if mod_count > 20 {
        256
    } else {
        128
    };

    let g1_heap = if total_ram_gb <= 4.0 {
        1024
    } else if total_ram_gb <= 8.0 {
        2048
    } else if total_ram_gb <= 16.0 {
        4096
    } else {
        6144
    };

    let mut g1_args = vec![
        format!("-XX:+UseG1GC"),
        "-XX:MaxGCPauseMillis=50".to_string(),
        format!("-XX:MetaspaceSize={}m", metaspace_mb),
        format!("-XX:MaxMetaspaceSize={}m", metaspace_mb),
    ];
    if mod_count > 50 {
        g1_args.push("-XX:ParallelGCThreads=4".to_string());
    }

    let mut zgc_args = vec![
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:+UseZGC".to_string(),
        format!("-XX:MetaspaceSize={}m", metaspace_mb),
        format!("-XX:MaxMetaspaceSize={}m", metaspace_mb),
    ];
    if mod_count > 50 {
        zgc_args.push("-XX:ParallelGCThreads=4".to_string());
    }

    let shenandoah_heap = if total_ram_gb <= 8.0 { 2048 } else { 4096 };
    let mut shenandoah_args = vec![
        "-XX:+UseShenandoahGC".to_string(),
        format!("-XX:MetaspaceSize={}m", metaspace_mb),
        format!("-XX:MaxMetaspaceSize={}m", metaspace_mb),
    ];
    if mod_count > 50 {
        shenandoah_args.push("-XX:ParallelGCThreads=4".to_string());
    }

    let g1_reason = if total_ram_gb <= 8.0 {
        "低/中内存系统：G1GC保守堆分配".to_string()
    } else {
        "通用场景：G1GC平衡堆分配".to_string()
    };

    Ok(vec![
        GcRecommendation {
            gc_type: "G1GC".to_string(),
            heap_size_mb: g1_heap,
            metaspace_mb,
            jvm_args: g1_args,
            description: "G1垃圾回收器，适合大多数场景".to_string(),
            suitable_for: if total_ram_gb <= 8.0 { "推荐" } else { "可选" }.to_string(),
            reason: g1_reason,
        },
        GcRecommendation {
            gc_type: "ZGC".to_string(),
            heap_size_mb: if total_ram_gb >= 12.0 { 6144 } else { 4096 },
            metaspace_mb,
            jvm_args: zgc_args,
            description: "ZGC低延迟垃圾回收器，适合大内存".to_string(),
            suitable_for: if total_ram_gb >= 12.0 { "推荐" } else { "不推荐" }.to_string(),
            reason: if total_ram_gb >= 12.0 { "高内存系统：ZGC最小暂停时间".to_string() } else { "内存不足，不建议使用ZGC".to_string() },
        },
        GcRecommendation {
            gc_type: "Shenandoah".to_string(),
            heap_size_mb: shenandoah_heap,
            metaspace_mb,
            jvm_args: shenandoah_args,
            description: "Shenandoah低延迟垃圾回收器".to_string(),
            suitable_for: if total_ram_gb >= 16.0 { "推荐" } else { "可选" }.to_string(),
            reason: if total_ram_gb >= 16.0 { "高内存系统：Shenandoah低延迟".to_string() } else { "内存有限，Shenandoah可能增加开销".to_string() },
        },
    ])
}

#[derive(Debug, Clone, Serialize)]
pub struct AnomalyReport {
    pub anomaly_type: String,
    pub severity: String,
    pub message: String,
    pub suggestion: String,
}

#[tauri::command]
pub async fn detect_anomalies(instance_id: String) -> Result<Vec<AnomalyReport>, LauncherError> {
    let mut anomalies = Vec::new();

    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    if mods_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            let mod_count = entries.count();
            if mod_count > 200 {
                anomalies.push(AnomalyReport {
                    anomaly_type: "too_many_mods".to_string(),
                    severity: "high".to_string(),
                    message: format!("安装了{}个模组，可能导致性能问题", mod_count),
                    suggestion: "建议减少模组数量或增加内存分配".to_string(),
                });
            }
        }
    }

    let instance = instance::manager::get_instance(&instance_id)?;
    if let Some(inst) = &instance {
        if inst.max_memory < 2048 {
            anomalies.push(AnomalyReport {
                anomaly_type: "low_memory".to_string(),
                severity: "medium".to_string(),
                message: format!("内存分配仅{}MB，可能不足", inst.max_memory),
                suggestion: "建议至少分配2048MB内存".to_string(),
            });
        }
    }

    Ok(anomalies)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchProfileStage {
    pub stage: String,
    pub duration_ms: u64,
    pub details: String,
}

#[tauri::command]
pub async fn get_launch_profiling_data(instance_id: String) -> Result<Vec<LaunchProfileStage>, LauncherError> {
    let profile_path = paths::get_instance_minecraft_dir(&instance_id).join("launch_profile.json");
    if profile_path.exists() {
        let data = std::fs::read_to_string(&profile_path)?;
        Ok(serde_json::from_str(&data).unwrap_or_default())
    } else {
        Ok(vec![
            LaunchProfileStage { stage: "Java初始化".into(), duration_ms: 0, details: "等待首次启动后获取数据".into() },
        ])
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameTimeData {
    pub avg_fps: f32,
    pub min_fps: f32,
    pub max_fps: f32,
    pub frame_times_ms: Vec<f32>,
    pub stutter_count: u32,
    pub analysis: String,
}

#[tauri::command]
pub async fn get_frame_time_data(instance_id: String) -> Result<FrameTimeData, LauncherError> {
    let instance = crate::instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::Other(format!("Instance not found: {}", instance_id)))?;

    let game_dir = crate::platform::paths::get_instance_minecraft_dir(&instance.id);
    let log_path = game_dir.join("logs").join("latest.log");

    if !log_path.exists() {
        return Ok(FrameTimeData {
            avg_fps: 0.0,
            min_fps: 0.0,
            max_fps: 0.0,
            frame_times_ms: Vec::new(),
            stutter_count: 0,
            analysis: "No log file found. Play the game first to generate frame data.".to_string(),
        });
    }

    let content = std::fs::read_to_string(&log_path)
        .map_err(LauncherError::Io)?;

    let mut fps_values: Vec<f32> = Vec::new();
    for line in content.lines().rev().take(1000) {
        if let Some(fps) = parse_fps_from_log_line(line) {
            fps_values.push(fps);
        }
    }

    if fps_values.is_empty() {
        return Ok(FrameTimeData {
            avg_fps: 0.0,
            min_fps: 0.0,
            max_fps: 0.0,
            frame_times_ms: Vec::new(),
            stutter_count: 0,
            analysis: "No FPS data found in log. Enable FPS display in game settings.".to_string(),
        });
    }

    fps_values.reverse();

    let avg_fps = fps_values.iter().sum::<f32>() / fps_values.len() as f32;
    let min_fps = fps_values.iter().cloned().fold(f32::INFINITY, f32::min);
    let max_fps = fps_values.iter().cloned().fold(f32::NEG_INFINITY, f32::max);

    let frame_times_ms: Vec<f32> = fps_values.iter()
        .map(|&fps| if fps > 0.0 { 1000.0 / fps } else { 0.0 })
        .collect();

    let stutter_count = frame_times_ms.iter()
        .filter(|&&ft| ft > 50.0)
        .count() as u32;

    let analysis = generate_analysis(avg_fps, min_fps, stutter_count);

    Ok(FrameTimeData {
        avg_fps: (avg_fps * 10.0).round() / 10.0,
        min_fps: (min_fps * 10.0).round() / 10.0,
        max_fps: (max_fps * 10.0).round() / 10.0,
        frame_times_ms,
        stutter_count,
        analysis,
    })
}

fn parse_fps_from_log_line(line: &str) -> Option<f32> {
    let line_lower = line.to_lowercase();

    if let Some(pos) = line_lower.find("fps:") {
        let remainder = &line_lower[pos + 4..].trim_start();
        if let Some(num_str) = remainder.split(|c: char| !c.is_numeric() && c != '.').next() {
            if let Ok(fps) = num_str.parse::<f32>() {
                if fps > 0.0 && fps < 10000.0 {
                    return Some(fps);
                }
            }
        }
    }

    if let Some(pos) = line_lower.find(" fps") {
        let before = &line_lower[..pos];
        if let Some(num_str) = before.rsplit(|c: char| !c.is_numeric() && c != '.').next() {
            if let Ok(fps) = num_str.parse::<f32>() {
                if fps > 0.0 && fps < 10000.0 {
                    return Some(fps);
                }
            }
        }
    }

    None
}

fn generate_analysis(avg_fps: f32, min_fps: f32, stutter_count: u32) -> String {
    let mut parts = Vec::new();

    if avg_fps >= 60.0 {
        parts.push("Excellent performance".to_string());
    } else if avg_fps >= 45.0 {
        parts.push("Good performance with occasional dips".to_string());
    } else if avg_fps >= 30.0 {
        parts.push("Moderate performance - consider optimization".to_string());
    } else {
        parts.push("Low performance - optimization recommended".to_string());
    }

    if stutter_count > 10 {
        parts.push(format!("{} stutter events detected (>50ms frame time)", stutter_count));
        parts.push("Consider: reducing render distance, installing Sodium, or allocating more memory".to_string());
    } else if stutter_count > 0 {
        parts.push(format!("{} minor stutter events", stutter_count));
    }

    if min_fps < 30.0 {
        parts.push("Minimum FPS is very low - check for resource-intensive mods".to_string());
    }

    parts.join(". ")
}

#[derive(Debug, Clone, Serialize)]
pub struct NLPSearchResult {
    pub slug: String,
    pub name: String,
    pub relevance: f32,
    pub interpretation: String,
}

#[tauri::command]
pub async fn nlp_search_content(query: String) -> Result<Vec<NLPSearchResult>, LauncherError> {
    let expanded = expand_query(&query);
    let query_tokens = tokenize(&expanded.join(" "));

    let mut all_results = Vec::new();

    for term in &expanded {
        if let Ok((results, _total)) = modrinth::search_mods(term, None, None, 20, 0).await {
            for r in &results {
                let doc_tokens = tokenize(&format!("{} {} {}", r.title, r.description, r.slug));
                let mut idf = HashMap::new();
                for qt in &query_tokens {
                    idf.entry(qt.clone()).or_insert(2.0f32);
                }
                let relevance = compute_tf_idf(&query_tokens, &doc_tokens, &idf);

                if !all_results.iter().any(|existing: &NLPSearchResult| existing.slug == r.slug) {
                    all_results.push(NLPSearchResult {
                        slug: r.slug.clone(),
                        name: r.title.clone(),
                        relevance: relevance.clamp(0.0, 1.0),
                        interpretation: format!("Matched via: {}", term),
                    });
                }
            }
        }
    }

    all_results.sort_by(|a, b| b.relevance.partial_cmp(&a.relevance).unwrap_or(std::cmp::Ordering::Equal));
    all_results.truncate(20);

    Ok(all_results)
}

#[derive(Debug, Clone, Serialize)]
pub struct PlaytimeStats {
    pub total_seconds: u64,
    pub daily: std::collections::HashMap<String, u64>,
    pub top_instances: Vec<InstancePlaytime>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstancePlaytime {
    pub id: String,
    pub name: String,
    pub seconds: u64,
}

#[tauri::command]
pub async fn get_playtime_stats() -> Result<PlaytimeStats, LauncherError> {
    let instances = instance::manager::list_instances()?;
    let total_seconds: u64 = instances.iter().map(|i| i.playtime_seconds).sum();
    let mut top_instances: Vec<InstancePlaytime> = instances.iter().map(|i| InstancePlaytime {
        id: i.id.clone(),
        name: i.name.clone(),
        seconds: i.playtime_seconds,
    }).collect();
    top_instances.sort_by_key(|b| std::cmp::Reverse(b.seconds));
    top_instances.truncate(10);

    let mut daily: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
    let playtime_path = paths::get_game_dir().join("playtime_log.json");
    if playtime_path.exists() {
        if let Ok(data) = std::fs::read_to_string(&playtime_path) {
            if let Ok(log_entries) = serde_json::from_str::<std::collections::HashMap<String, u64>>(&data) {
                daily = log_entries;
            }
        }
    }

    Ok(PlaytimeStats { total_seconds, daily, top_instances })
}

#[tauri::command]
pub async fn record_playtime(instance_id: String, seconds: u64) -> Result<(), LauncherError> {
    instance::manager::update_playtime(&instance_id, seconds)?;

    let playtime_path = paths::get_game_dir().join("playtime_log.json");
    let mut daily: std::collections::HashMap<String, u64> = if playtime_path.exists() {
        std::fs::read_to_string(&playtime_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        std::collections::HashMap::new()
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    *daily.entry(today).or_insert(0) += seconds;

    let data = serde_json::to_string_pretty(&daily)?;
    std::fs::write(&playtime_path, data)?;

    Ok(())
}

#[tauri::command]
pub async fn export_instance_config(instance_id: String) -> Result<String, LauncherError> {
    let instance = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::Other(format!("Instance not found: {}", instance_id)))?;

    let config = serde_json::json!({
        "name": instance.name,
        "version_id": instance.version_id,
        "loader_type": instance.loader_type,
        "loader_version": instance.loader_version,
        "max_memory": instance.max_memory,
        "min_memory": instance.min_memory,
        "jvm_args": instance.jvm_args,
    });

    use base64::Engine;
    let json = serde_json::to_string(&config)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(json.as_bytes());
    Ok(encoded)
}

#[tauri::command]
pub async fn import_instance_config(config_code: String) -> Result<instance::manager::GameInstance, LauncherError> {
    use base64::Engine;
    let json_bytes = base64::engine::general_purpose::STANDARD.decode(&config_code)
        .map_err(|e| LauncherError::Other(format!("Invalid config code: {}", e)))?;
    let config: serde_json::Value = serde_json::from_slice(&json_bytes)
        .map_err(|e| LauncherError::Other(format!("Invalid config JSON: {}", e)))?;

    let version_id = config["version_id"].as_str().unwrap_or("1.21").to_string();
    let manifest = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = manifest.iter().find(|v| v.id == version_id)
        .ok_or_else(|| LauncherError::Other(format!("Version {} not found", version_id)))?;

    let inst_id = format!("shared_{}", chrono::Utc::now().timestamp_millis());
    let now = chrono::Local::now().to_rfc3339();
    let instance = instance::manager::GameInstance {
        id: inst_id.clone(),
        name: config["name"].as_str().unwrap_or("Imported").to_string(),
        version_id: version_id.clone(),
        version_url: version_entry.url.clone(),
        loader_type: config["loader_type"].as_str().map(|s| s.to_string()),
        loader_version: config["loader_version"].as_str().map(|s| s.to_string()),
        description: "Imported from shared config".to_string(),
        max_memory: config["max_memory"].as_u64().unwrap_or(4096) as u32,
        min_memory: config["min_memory"].as_u64().unwrap_or(512) as u32,
        java_path: None,
        jvm_args: config["jvm_args"].as_str().map(|s| s.to_string()),
        created_at: now,
        last_played: None,
        playtime_seconds: 0,
    };

    instance::manager::create_instance(&instance)?;
    Ok(instance)
}

#[tauri::command]
pub async fn get_security_config() -> Result<config::SecurityConfig, LauncherError> {
    let cfg = config::load_config()?;
    Ok(cfg.security)
}

#[tauri::command]
pub async fn save_security_config(
    security: config::SecurityConfig,
) -> Result<(), LauncherError> {
    let mut cfg = config::load_config()?;
    let old_encryption = cfg.security.credential_encryption;
    cfg.security = security;
    config::save_config(&cfg)?;
    let _ = security::audit::log_audit(
        security::audit::AuditLevel::Info,
        security::audit::AuditCategory::Config,
        "Security config updated",
        Some(serde_json::json!({
            "credential_encryption_changed": old_encryption != cfg.security.credential_encryption,
        })),
    );
    if !old_encryption && cfg.security.credential_encryption {
        let _ = security::credential_store::migrate_plain_to_encrypted();
    }
    let _ = security::audit::init_audit(cfg.security.audit_log_enabled);
    Ok(())
}

#[tauri::command]
pub async fn get_security_score() -> Result<u32, LauncherError> {
    let cfg = config::load_config()?;
    let mut score: u32 = 40;
    if security::credential_store::is_encrypted() {
        score += 20;
    }
    if cfg.security.strict_verification {
        score += 10;
    }
    if cfg.security.jvm_args_mode == "whitelist" {
        score += 10;
    }
    match cfg.security.sandbox_mode.as_str() {
        "strict" => score += 10,
        "basic" => score += 5,
        _ => {}
    }
    if cfg.security.audit_log_enabled {
        score += 10;
    }
    Ok(score)
}

#[tauri::command]
pub async fn get_audit_log(
    category: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<security::audit::AuditEntry>, LauncherError> {
    let filter_category = category.and_then(|c| serde_json::from_value(serde_json::Value::String(c)).ok());
    security::audit::read_audit_log(
        filter_category,
        limit.unwrap_or(100),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
pub async fn get_login_history() -> Result<Vec<security::audit::LoginHistoryEntry>, LauncherError> {
    security::audit::get_login_history()
}

#[tauri::command]
pub async fn migrate_credentials() -> Result<(), LauncherError> {
    security::credential_store::migrate_plain_to_encrypted()
}

#[tauri::command]
pub async fn get_encryption_status() -> Result<serde_json::Value, LauncherError> {
    Ok(serde_json::json!({
        "encrypted": security::credential_store::is_encrypted(),
        "plain": security::credential_store::is_plain(),
    }))
}

#[tauri::command]
pub async fn save_api_key(name: String, value: String) -> Result<(), LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::sanitizer::sanitize_general_string(&value)?;
    security::key_store::set_key(&name, &value)
}

#[tauri::command]
pub async fn delete_api_key(name: String) -> Result<(), LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::key_store::delete_key(&name)
}

#[tauri::command]
pub async fn get_api_key_status(name: String) -> Result<security::key_store::KeyStatus, LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::key_store::key_status(&name)
}

#[tauri::command]
pub async fn check_file_permissions() -> Result<Vec<serde_json::Value>, LauncherError> {
    let results = security::file_permissions::check_all_sensitive_permissions();
    Ok(results
        .into_iter()
        .map(|(path, secure)| {
            serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "secure": secure,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn fix_file_permissions() -> Result<Vec<serde_json::Value>, LauncherError> {
    let results = security::file_permissions::fix_all_sensitive_permissions();
    for (path, fixed) in &results {
        if *fixed {
            let _ = security::audit::log_audit(
                security::audit::AuditLevel::Info,
                security::audit::AuditCategory::File,
                &format!("Fixed insecure permissions on {}", path.display()),
                None,
            );
        }
    }
    Ok(results
        .into_iter()
        .map(|(path, fixed)| {
            serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "fixed": fixed,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn validate_jvm_args(args: String) -> Result<serde_json::Value, LauncherError> {
    let cfg = config::load_config()?;
    let arg_list: Vec<String> = args.split_whitespace().map(String::from).collect();
    if cfg.security.jvm_args_mode == "whitelist" {
        match security::jvm_whitelist::validate_jvm_args(&arg_list) {
            Ok(valid) => Ok(serde_json::json!({ "valid": true, "args": valid })),
            Err(e) => Ok(serde_json::json!({ "valid": false, "error": e.to_string() })),
        }
    } else {
        let (valid, invalid) = security::jvm_whitelist::validate_jvm_args_custom(&arg_list);
        Ok(serde_json::json!({ "valid": true, "args": valid, "warnings": invalid }))
    }
}

#[tauri::command]
pub async fn get_sandbox_availability() -> Result<security::sandbox::SandboxAvailability, LauncherError> {
    Ok(security::sandbox::check_sandbox_availability())
}
