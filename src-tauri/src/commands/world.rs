use crate::error::LauncherError;
use crate::platform::paths;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldInfo {
    pub name: String,
    pub last_played: Option<String>,
    pub game_mode: String,
    pub seed: Option<String>,
    pub difficulty: String,
    pub size_mb: f64,
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

fn parse_level_dat_basic(level_dat: &std::path::Path) -> (String, String, Option<String>) {
    let raw_data = match std::fs::read(level_dat) {
        Ok(data) => data,
        Err(e) => {
            tracing::warn!("Failed to read level.dat: {}", e);
            return ("Unknown".to_string(), "Unknown".to_string(), None);
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
            return ("Unknown".to_string(), "Unknown".to_string(), None);
        }
    };

    let data_compound = match &nbt {
        fastnbt::Value::Compound(map) => match map.get("Data") {
            Some(fastnbt::Value::Compound(data)) => data,
            _ => map,
        },
        _ => {
            tracing::warn!("level.dat root is not a compound");
            return ("Unknown".to_string(), "Unknown".to_string(), None);
        }
    };

    let game_type = data_compound
        .get("GameType")
        .and_then(|v| match v {
            fastnbt::Value::Int(gt) => Some(match gt {
                0 => "Survival",
                1 => "Creative",
                2 => "Adventure",
                3 => "Spectator",
                _ => "Unknown",
            }),
            _ => None,
        })
        .unwrap_or("Unknown")
        .to_string();

    let difficulty = data_compound
        .get("Difficulty")
        .and_then(|v| match v {
            fastnbt::Value::Byte(d) => Some(match d {
                0 => "Peaceful",
                1 => "Easy",
                2 => "Normal",
                3 => "Hard",
                _ => "Unknown",
            }),
            _ => None,
        })
        .unwrap_or("Normal")
        .to_string();

    let seed = data_compound
        .get("RandomSeed")
        .and_then(|v| match v {
            fastnbt::Value::Long(s) => Some(s.to_string()),
            _ => None,
        });

    (game_type, difficulty, seed)
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

            let (game_mode, difficulty, seed) = if level_dat.exists() {
                parse_level_dat_basic(&level_dat)
            } else {
                ("Unknown".to_string(), "Unknown".to_string(), None)
            };

            worlds.push(WorldInfo {
                name,
                last_played,
                game_mode,
                seed,
                difficulty,
                size_mb,
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
