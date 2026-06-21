use crate::error::LauncherError;
use crate::platform::paths;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldInfo {
    pub name: String,
    pub last_played: Option<String>,
    pub game_mode: String,
    pub game_mode_name: Option<String>,
    pub seed: Option<i64>,
    pub difficulty: String,
    pub difficulty_name: Option<String>,
    pub size_mb: f64,
    pub spawn_x: Option<i32>,
    pub spawn_y: Option<i32>,
    pub spawn_z: Option<i32>,
    pub time_played_ticks: Option<i64>,
    pub hardcore: Option<bool>,
    pub version_name: Option<String>,
    pub level_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFileInfo {
    pub filename: String,
    pub size: u64,
    pub modified_at: String,
}

fn compute_dir_size_mb(dir: &std::path::Path) -> f64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += compute_dir_size_bytes(&path);
            }
        }
    }
    (total as f64) / 1_048_576.0
}

fn compute_dir_size_bytes(dir: &std::path::Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += compute_dir_size_bytes(&path);
            }
        }
    }
    total
}

fn try_decompress_gzip(data: &[u8]) -> Option<Vec<u8>> {
    use std::io::Read;
    let mut decoder = flate2::read::GzDecoder::new(data);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).ok()?;
    Some(decompressed)
}

fn parse_world_gen_settings_seed(data: &[u8]) -> Option<i64> {
    let cursor = std::io::Cursor::new(data);
    let nbt: fastnbt::Value = fastnbt::from_reader(cursor).ok()?;
    match &nbt {
        fastnbt::Value::Compound(root) => root.get("data").and_then(|v| match v {
            fastnbt::Value::Compound(data_map) => data_map.get("seed").and_then(|s| match s {
                fastnbt::Value::Long(l) => Some(*l),
                fastnbt::Value::String(str_val) => str_val.parse().ok(),
                _ => None,
            }),
            _ => None,
        }),
        _ => None,
    }
}

fn game_mode_name(mode: &fastnbt::Value) -> String {
    match mode {
        fastnbt::Value::Int(0) => "Survival".to_string(),
        fastnbt::Value::Int(1) => "Creative".to_string(),
        fastnbt::Value::Int(2) => "Adventure".to_string(),
        fastnbt::Value::Int(3) => "Spectator".to_string(),
        fastnbt::Value::String(s) if s == "survival" => "Survival".to_string(),
        fastnbt::Value::String(s) if s == "creative" => "Creative".to_string(),
        fastnbt::Value::String(s) if s == "adventure" => "Adventure".to_string(),
        fastnbt::Value::String(s) if s == "spectator" => "Spectator".to_string(),
        fastnbt::Value::String(s) => s.clone(),
        _ => "Unknown".to_string(),
    }
}

fn difficulty_name(diff: &fastnbt::Value) -> String {
    match diff {
        fastnbt::Value::Int(0) | fastnbt::Value::Byte(0) => "Peaceful".to_string(),
        fastnbt::Value::Int(1) | fastnbt::Value::Byte(1) => "Easy".to_string(),
        fastnbt::Value::Int(2) | fastnbt::Value::Byte(2) => "Normal".to_string(),
        fastnbt::Value::Int(3) | fastnbt::Value::Byte(3) => "Hard".to_string(),
        fastnbt::Value::String(s) if s == "peaceful" => "Peaceful".to_string(),
        fastnbt::Value::String(s) if s == "easy" => "Easy".to_string(),
        fastnbt::Value::String(s) if s == "normal" => "Normal".to_string(),
        fastnbt::Value::String(s) if s == "hard" => "Hard".to_string(),
        fastnbt::Value::String(s) => s.clone(),
        _ => "Unknown".to_string(),
    }
}

struct LevelDatInfo {
    game_mode: String,
    game_mode_name: Option<String>,
    difficulty: String,
    difficulty_name: Option<String>,
    seed: Option<i64>,
    spawn_x: Option<i32>,
    spawn_y: Option<i32>,
    spawn_z: Option<i32>,
    time_played_ticks: Option<i64>,
    hardcore: Option<bool>,
    version_name: Option<String>,
    level_name: Option<String>,
}

fn parse_level_dat_basic(level_dat: &std::path::Path) -> Option<LevelDatInfo> {
    let raw_data = match std::fs::read(level_dat) {
        Ok(data) => data,
        Err(e) => {
            tracing::warn!("Failed to read level.dat: {}", e);
            return None;
        }
    };

    let decompressed = try_decompress_gzip(&raw_data);
    let data: &[u8] = match &decompressed {
        Some(d) => d,
        None => &raw_data,
    };

    let mut cursor = std::io::Cursor::new(data);
    let nbt: fastnbt::Value = match fastnbt::from_reader(&mut cursor) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("Failed to parse level.dat NBT: {}", e);
            return None;
        }
    };

    let data_compound = match &nbt {
        fastnbt::Value::Compound(map) => match map.get("Data") {
            Some(fastnbt::Value::Compound(data)) => data,
            _ => map,
        },
        _ => {
            tracing::warn!("level.dat root is not a compound");
            return None;
        }
    };

    let game_type_val = data_compound.get("GameType").unwrap_or(&fastnbt::Value::Int(-1));
    let game_type = match game_type_val {
        fastnbt::Value::Int(gt) => match gt {
            0 => "Survival",
            1 => "Creative",
            2 => "Adventure",
            3 => "Spectator",
            _ => "Unknown",
        },
        _ => "Unknown",
    }.to_string();
    let gm_name = game_mode_name(game_type_val);

    let diff_val = data_compound.get("Difficulty").unwrap_or(&fastnbt::Value::Byte(2));
    let difficulty = match diff_val {
        fastnbt::Value::Byte(d) => match d {
            0 => "Peaceful",
            1 => "Easy",
            2 => "Normal",
            3 => "Hard",
            _ => "Unknown",
        },
        _ => "Normal",
    }.to_string();
    let diff_name = difficulty_name(diff_val);

    let seed = data_compound
        .get("RandomSeed")
        .and_then(|v| match v {
            fastnbt::Value::Long(s) => Some(*s),
            _ => None,
        });

    let spawn_x = data_compound.get("SpawnX").and_then(|v| match v { fastnbt::Value::Int(i) => Some(*i), _ => None });
    let spawn_y = data_compound.get("SpawnY").and_then(|v| match v { fastnbt::Value::Int(i) => Some(*i), _ => None });
    let spawn_z = data_compound.get("SpawnZ").and_then(|v| match v { fastnbt::Value::Int(i) => Some(*i), _ => None });
    let time_played_ticks = data_compound.get("Time").and_then(|v| match v { fastnbt::Value::Long(l) => Some(*l), _ => None });
    let hardcore = data_compound.get("hardcore").and_then(|v| match v { fastnbt::Value::Byte(b) => Some(*b != 0), _ => None });
    let version_name = data_compound.get("Version").and_then(|v| match v {
        fastnbt::Value::Compound(map) => map.get("Name").and_then(|n| match n { fastnbt::Value::String(s) => Some(s.clone()), _ => None }),
        _ => None,
    });
    let level_name = data_compound.get("LevelName").and_then(|v| match v { fastnbt::Value::String(s) => Some(s.clone()), _ => None });

    Some(LevelDatInfo {
        game_mode: game_type,
        game_mode_name: Some(gm_name),
        difficulty,
        difficulty_name: Some(diff_name),
        seed,
        spawn_x,
        spawn_y,
        spawn_z,
        time_played_ticks,
        hardcore,
        version_name,
        level_name,
    })
}

#[tauri::command]
pub async fn list_instance_saves(instance_id: String) -> Result<Vec<WorldInfo>, LauncherError> {
    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    if !saves_dir.exists() {
        return Ok(Vec::new());
    }

    let mut worlds = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&saves_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }

            let name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let level_dat = path.join("level.dat");

            let last_played = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    chrono::DateTime::from_timestamp(
                        duration.as_secs() as i64,
                        duration.subsec_nanos(),
                    )
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
                });

            let size_mb = compute_dir_size_mb(&path);

            let (game_mode, game_mode_name_val, difficulty, difficulty_name_val, seed, spawn_x, spawn_y, spawn_z, time_played_ticks, hardcore, version_name, level_name) =
                if level_dat.exists() {
                    if let Some(info) = parse_level_dat_basic(&level_dat) {
                        let seed = info.seed.or_else(|| {
                            let wgs_path = path.join("data").join("minecraft").join("world_gen_settings.dat");
                            if wgs_path.exists() {
                                std::fs::read(&wgs_path)
                                    .ok()
                                    .and_then(|data| {
                                        let decompressed = try_decompress_gzip(&data);
                                        let buf: &[u8] = decompressed.as_deref().unwrap_or(&data);
                                        parse_world_gen_settings_seed(buf)
                                    })
                            } else {
                                None
                            }
                        });
                        (info.game_mode, info.game_mode_name, info.difficulty, info.difficulty_name, seed, info.spawn_x, info.spawn_y, info.spawn_z, info.time_played_ticks, info.hardcore, info.version_name, info.level_name)
                    } else {
                        ("Unknown".to_string(), None, "Unknown".to_string(), None, None, None, None, None, None, None, None, None)
                    }
                } else {
                    ("Unknown".to_string(), None, "Unknown".to_string(), None, None, None, None, None, None, None, None, None)
                };

            worlds.push(WorldInfo {
                name,
                last_played,
                game_mode,
                game_mode_name: game_mode_name_val,
                seed,
                difficulty,
                difficulty_name: difficulty_name_val,
                size_mb,
                spawn_x,
                spawn_y,
                spawn_z,
                time_played_ticks,
                hardcore,
                version_name,
                level_name,
            });
        }
    }

    worlds.sort_by(|a, b| {
        b.last_played.cmp(&a.last_played)
    });
    Ok(worlds)
}

#[tauri::command]
pub async fn list_instance_logs(instance_id: String) -> Result<Vec<LogFileInfo>, LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let logs_dir = mc_dir.join("logs");
    if !logs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut logs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&logs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() { continue; }

            let filename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

            let modified_at = std::fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    chrono::DateTime::from_timestamp(
                        duration.as_secs() as i64,
                        duration.subsec_nanos(),
                    )
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
                })
                .unwrap_or_default();

            logs.push(LogFileInfo { filename, size, modified_at });
        }
    }

    logs.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(logs)
}

#[tauri::command]
pub async fn read_log_file(instance_id: String, filename: String, max_lines: Option<usize>) -> Result<String, LauncherError> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid filename".into()));
    }
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let log_path = mc_dir.join("logs").join(&filename);

    if !log_path.exists() {
        return Err(LauncherError::VersionNotFound(format!("Log file not found: {}", filename)));
    }

    let content = std::fs::read_to_string(&log_path)?;
    let limit = max_lines.unwrap_or(500);
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= limit {
        Ok(content)
    } else {
        Ok(lines[lines.len() - limit..].join("\n"))
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentLogLine {
    pub line: String,
    pub level: String,
}

#[tauri::command]
pub async fn get_recent_logs(instance_id: String, lines: Option<usize>) -> Result<Vec<RecentLogLine>, LauncherError> {
    let limit = lines.unwrap_or(200);
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let latest_log = mc_dir.join("logs").join("latest.log");

    if !latest_log.exists() {
        let debug_log = mc_dir.join("logs").join("debug.log");
        if debug_log.exists() {
            return read_log_tail(&debug_log, limit);
        }
        return Ok(Vec::new());
    }

    read_log_tail(&latest_log, limit)
}

fn read_log_tail(path: &std::path::Path, limit: usize) -> Result<Vec<RecentLogLine>, LauncherError> {
    let content = std::fs::read_to_string(path)?;
    let all_lines: Vec<&str> = content.lines().collect();
    let start = if all_lines.len() > limit { all_lines.len() - limit } else { 0 };
    let tail = &all_lines[start..];

    Ok(tail.iter().map(|l| {
        let level = if l.contains("ERROR") || l.contains("FATAL") || l.contains("Exception") || l.contains("SEVERE") {
            "ERROR".to_string()
        } else if l.contains("WARN") || l.contains("WARNING") {
            "WARN".to_string()
        } else if l.contains("DEBUG") || l.contains("TRACE") || l.contains("FINE") {
            "DEBUG".to_string()
        } else {
            "INFO".to_string()
        };
        RecentLogLine { line: l.to_string(), level }
    }).collect())
}

#[tauri::command]
pub async fn export_world(instance_id: String, save_name: String, output_path: String) -> Result<String, LauncherError> {
    if save_name.contains("..") || save_name.contains('/') || save_name.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid save name".into()));
    }
    if output_path.contains("..") {
        return Err(LauncherError::SecurityValidation("Invalid output path".into()));
    }

    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    let save_dir = saves_dir.join(&save_name);

    if !save_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("World not found: {}", save_name)));
    }

    let output = std::path::PathBuf::from(&output_path);
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = std::fs::File::create(&output)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    add_dir_to_zip(&save_dir, &mut zip, options, &save_name)?;

    Ok(output_path)
}

fn add_dir_to_zip(
    dir: &std::path::Path,
    zip: &mut zip::ZipWriter<std::fs::File>,
    options: zip::write::SimpleFileOptions,
    prefix: &str,
) -> Result<(), LauncherError> {
    let entries = std::fs::read_dir(dir)?;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        // 跳过 session.lock（参考 HMCL WorldBackupTask）
        if file_name == "session.lock" {
            continue;
        }
        let name = format!("{}/{}", prefix, file_name.to_string_lossy());

        if path.is_dir() {
            zip.add_directory(&name, options)?;
            add_dir_to_zip(&path, zip, options, &name)?;
        } else {
            zip.start_file(&name, options)?;
            let mut f = std::fs::File::open(&path)?;
            std::io::copy(&mut f, zip)?;
        }
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════
// 世界备份/恢复系统（参考 HMCL WorldBackupTask + WorldBackupsPage）
// ═══════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldBackupInfo {
    pub filename: String,
    pub world_name: String,
    pub created_at: String,
    pub size_mb: f64,
}

/// 获取实例的世界备份目录
fn get_backups_dir(instance_id: &str) -> std::path::PathBuf {
    paths::get_game_dir().join("backups").join(instance_id)
}

/// 备份世界为 ZIP。参考 HMCL WorldBackupTask：
/// - 备份位置：backups/<instance_id>/
/// - 命名：yyyy-MM-dd_HH-mm-ss_<worldName>.zip，重名加序号
/// - 跳过 session.lock
#[tauri::command]
pub async fn backup_world(instance_id: String, save_name: String) -> Result<String, LauncherError> {
    if save_name.contains("..") || save_name.contains('/') || save_name.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid save name".into()));
    }

    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    let save_dir = saves_dir.join(&save_name);
    if !save_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("World not found: {}", save_name)));
    }

    let backups_dir = get_backups_dir(&instance_id);
    std::fs::create_dir_all(&backups_dir)?;

    // 生成备份文件名：yyyy-MM-dd_HH-mm-ss_<worldName>.zip，重名加序号
    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let mut backup_filename = format!("{}_{}.zip", timestamp, save_name);
    let mut seq = 1;
    while backups_dir.join(&backup_filename).exists() && seq < 256 {
        backup_filename = format!("{}_{}_{}.zip", timestamp, save_name, seq);
        seq += 1;
    }

    let backup_path = backups_dir.join(&backup_filename);
    let file = std::fs::File::create(&backup_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    add_dir_to_zip(&save_dir, &mut zip, options, &save_name)?;
    zip.finish().map_err(|e| LauncherError::Other(format!("Failed to finalize backup zip: {}", e)))?;

    tracing::info!("World '{}' backed up to {}", save_name, backup_path.display());
    Ok(backup_filename)
}

/// 列出实例的所有世界备份
#[tauri::command]
pub async fn list_world_backups(instance_id: String) -> Result<Vec<WorldBackupInfo>, LauncherError> {
    let backups_dir = get_backups_dir(&instance_id);
    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    for entry in std::fs::read_dir(&backups_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("zip") {
            continue;
        }

        let filename = entry.file_name().to_string_lossy().to_string();
        // 解析文件名：yyyy-MM-dd_HH-mm-ss_<worldName>[_seq].zip
        let world_name = filename
            .strip_suffix(".zip")
            .and_then(|s| {
                // 提取时间戳后的世界名部分
                let parts: Vec<&str> = s.splitn(3, '_').collect();
                if parts.len() >= 3 {
                    let rest = parts[2];
                    // 去除可能的序号后缀 _N
                    if let Some(pos) = rest.rfind('_') {
                        if rest[pos + 1..].parse::<u32>().is_ok() {
                            return Some(&rest[..pos]);
                        }
                    }
                    Some(rest)
                } else {
                    None
                }
            })
            .unwrap_or("unknown")
            .to_string();

        let size_mb = std::fs::metadata(&path).map(|m| m.len() as f64 / 1_048_576.0).unwrap_or(0.0);

        let created_at = std::fs::metadata(&path)
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                chrono::DateTime::from_timestamp(duration.as_secs() as i64, duration.subsec_nanos())
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        backups.push(WorldBackupInfo {
            filename,
            world_name,
            created_at,
            size_mb,
        });
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

/// 从备份恢复世界
#[tauri::command]
pub async fn restore_world(instance_id: String, backup_filename: String, target_name: Option<String>) -> Result<String, LauncherError> {
    if backup_filename.contains("..") || backup_filename.contains('/') || backup_filename.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid backup filename".into()));
    }

    let backups_dir = get_backups_dir(&instance_id);
    let backup_path = backups_dir.join(&backup_filename);
    if !backup_path.exists() {
        return Err(LauncherError::VersionNotFound(format!("Backup not found: {}", backup_filename)));
    }

    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    std::fs::create_dir_all(&saves_dir)?;

    // 恢复目标名称：优先使用用户指定，否则从备份文件名提取
    let restore_name = target_name.unwrap_or_else(|| {
        backup_filename
            .strip_suffix(".zip")
            .and_then(|s| {
                let parts: Vec<&str> = s.splitn(3, '_').collect();
                if parts.len() >= 3 {
                    let rest = parts[2];
                    if let Some(pos) = rest.rfind('_') {
                        if rest[pos + 1..].parse::<u32>().is_ok() {
                            return Some(rest[..pos].to_string());
                        }
                    }
                    Some(rest.to_string())
                } else {
                    Some("restored_world".to_string())
                }
            })
            .unwrap_or_else(|| "restored_world".to_string())
    });

    let target_dir = saves_dir.join(&restore_name);
    if target_dir.exists() {
        // 目标已存在，加序号
        let mut seq = 1;
        loop {
            let candidate = saves_dir.join(format!("{}_{}", restore_name, seq));
            if !candidate.exists() {
                std::fs::create_dir_all(&candidate)?;
                extract_zip_to_dir(&backup_path, &candidate)?;
                return Ok(format!("{}_{}", restore_name, seq));
            }
            seq += 1;
            if seq > 999 {
                return Err(LauncherError::Other("Too many restored worlds with same name".into()));
            }
        }
    } else {
        std::fs::create_dir_all(&target_dir)?;
        extract_zip_to_dir(&backup_path, &target_dir)?;
        Ok(restore_name)
    }
}

/// 删除世界备份
#[tauri::command]
pub async fn delete_world_backup(instance_id: String, backup_filename: String) -> Result<(), LauncherError> {
    if backup_filename.contains("..") || backup_filename.contains('/') || backup_filename.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid backup filename".into()));
    }

    let backup_path = get_backups_dir(&instance_id).join(&backup_filename);
    if !backup_path.exists() {
        return Err(LauncherError::VersionNotFound(format!("Backup not found: {}", backup_filename)));
    }

    std::fs::remove_file(&backup_path)?;
    tracing::info!("Deleted world backup: {}", backup_filename);
    Ok(())
}

/// 从 ZIP 导入世界
#[tauri::command]
pub async fn import_world(instance_id: String, zip_path: String, world_name: Option<String>) -> Result<String, LauncherError> {
    let zip_path = std::path::PathBuf::from(&zip_path);
    if !zip_path.exists() {
        return Err(LauncherError::VersionNotFound(format!("ZIP file not found: {}", zip_path.display())));
    }

    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    std::fs::create_dir_all(&saves_dir)?;

    // 确定世界名称
    let name = world_name.unwrap_or_else(|| {
        zip_path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "imported_world".to_string())
    });

    let target_dir = saves_dir.join(&name);
    if target_dir.exists() {
        return Err(LauncherError::Other(format!("World '{}' already exists", name)));
    }

    std::fs::create_dir_all(&target_dir)?;
    extract_zip_to_dir(&zip_path, &target_dir)?;
    tracing::info!("World imported from {} as {}", zip_path.display(), name);
    Ok(name)
}

/// 删除世界
#[tauri::command]
pub async fn delete_world(instance_id: String, save_name: String) -> Result<(), LauncherError> {
    if save_name.contains("..") || save_name.contains('/') || save_name.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid save name".into()));
    }

    let save_dir = paths::get_instance_saves_dir(&instance_id).join(&save_name);
    if !save_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("World not found: {}", save_name)));
    }

    std::fs::remove_dir_all(&save_dir)?;
    tracing::info!("World deleted: {}", save_name);
    Ok(())
}

/// 重命名世界
#[tauri::command]
pub async fn rename_world(instance_id: String, old_name: String, new_name: String) -> Result<(), LauncherError> {
    if old_name.contains("..") || old_name.contains('/') || old_name.contains('\\') ||
       new_name.contains("..") || new_name.contains('/') || new_name.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid save name".into()));
    }

    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    let old_dir = saves_dir.join(&old_name);
    let new_dir = saves_dir.join(&new_name);

    if !old_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("World not found: {}", old_name)));
    }
    if new_dir.exists() {
        return Err(LauncherError::Other(format!("World '{}' already exists", new_name)));
    }

    std::fs::rename(&old_dir, &new_dir)?;
    tracing::info!("World renamed: {} -> {}", old_name, new_name);
    Ok(())
}

/// 复制世界
#[tauri::command]
pub async fn duplicate_world(instance_id: String, save_name: String, new_name: String) -> Result<(), LauncherError> {
    if save_name.contains("..") || save_name.contains('/') || save_name.contains('\\') ||
       new_name.contains("..") || new_name.contains('/') || new_name.contains('\\') {
        return Err(LauncherError::SecurityValidation("Invalid save name".into()));
    }

    let saves_dir = paths::get_instance_saves_dir(&instance_id);
    let src_dir = saves_dir.join(&save_name);
    let dst_dir = saves_dir.join(&new_name);

    if !src_dir.exists() {
        return Err(LauncherError::VersionNotFound(format!("World not found: {}", save_name)));
    }
    if dst_dir.exists() {
        return Err(LauncherError::Other(format!("World '{}' already exists", new_name)));
    }

    copy_world_dir_recursive(&src_dir, &dst_dir)?;
    tracing::info!("World duplicated: {} -> {}", save_name, new_name);
    Ok(())
}

/// 解压 ZIP 到目录
fn extract_zip_to_dir(zip_path: &std::path::Path, target_dir: &std::path::Path) -> Result<(), LauncherError> {
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Failed to open zip: {}", e)))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| LauncherError::Other(format!("Failed to read zip entry: {}", e)))?;
        let name = entry.name().to_string();

        // 跳过路径遍历攻击
        if name.contains("..") {
            continue;
        }

        // ZIP 中的路径可能包含顶层目录前缀，需要去掉
        let relative = if let Some(pos) = name.find('/') {
            &name[pos + 1..]
        } else {
            &name
        };

        if relative.is_empty() {
            continue;
        }

        let out_path = target_dir.join(relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out_file = std::fs::File::create(&out_path)?;
            std::io::copy(&mut entry, &mut out_file)?;
        }
    }
    Ok(())
}

/// 递归复制世界目录（跳过 session.lock）
fn copy_world_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), LauncherError> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_name = entry.file_name();
        if file_name == "session.lock" {
            continue;
        }
        let path = entry.path();
        let dst_path = dst.join(&file_name);
        if path.is_dir() {
            copy_world_dir_recursive(&path, &dst_path)?;
        } else {
            std::fs::copy(&path, &dst_path)?;
        }
    }
    Ok(())
}
