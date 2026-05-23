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

fn parse_level_dat_basic(_level_dat: &std::path::Path) -> (String, String, Option<String>) {
    ("Survival".to_string(), "Normal".to_string(), None)
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
        return Err(LauncherError::Other("Invalid filename".into()));
    }
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let log_path = mc_dir.join("logs").join(&filename);

    if !log_path.exists() {
        return Err(LauncherError::Other(format!("Log file not found: {}", filename)));
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
