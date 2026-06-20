use crate::error::LauncherError;
use crate::platform::paths::get_config_dir;
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: String,
    pub level: AuditLevel,
    pub category: AuditCategory,
    pub message: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuditLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuditCategory {
    Auth,
    Crypto,
    Download,
    Config,
    File,
    Launch,
    Sandbox,
}

struct AuditWriter {
    log_dir: std::path::PathBuf,
    enabled: bool,
}

impl AuditWriter {
    fn log_path(&self) -> std::path::PathBuf {
        self.log_dir.join("audit.log")
    }

    fn rotate_if_needed(&self) -> Result<(), LauncherError> {
        let log_path = self.log_path();
        if !log_path.exists() {
            return Ok(());
        }
        let size = std::fs::metadata(&log_path)
            .map(|m| m.len())
            .unwrap_or(0);
        if size < 5 * 1024 * 1024 {
            return Ok(());
        }
        for i in (1..3).rev() {
            let old = self.log_dir.join(format!("audit.log.{}", i));
            let new = self.log_dir.join(format!("audit.log.{}", i + 1));
            if old.exists() {
                let _ = std::fs::rename(&old, &new);
            }
        }
        let _ = std::fs::rename(&log_path, self.log_dir.join("audit.log.1"));
        Ok(())
    }

    fn write_entry(
        &mut self,
        level: AuditLevel,
        category: AuditCategory,
        message: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), LauncherError> {
        if !self.enabled {
            return Ok(());
        }
        self.rotate_if_needed()?;
        let entry = AuditEntry {
            timestamp: Utc::now().to_rfc3339(),
            level,
            category,
            message: message.to_string(),
            metadata,
        };
        let line = serde_json::to_string(&entry)?;
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.log_path())?;
        writeln!(file, "{}", line)?;
        Ok(())
    }
}

static AUDIT_WRITER: std::sync::OnceLock<parking_lot::Mutex<Option<AuditWriter>>> = std::sync::OnceLock::new();

pub fn init_audit(enabled: bool) -> Result<(), LauncherError> {
    let log_dir = get_config_dir().join("security");
    std::fs::create_dir_all(&log_dir)?;
    let writer = AuditWriter { log_dir, enabled };
    *AUDIT_WRITER.get_or_init(|| parking_lot::Mutex::new(None)).lock() = Some(writer);
    Ok(())
}

pub fn log_audit(
    level: AuditLevel,
    category: AuditCategory,
    message: &str,
    metadata: Option<serde_json::Value>,
) -> Result<(), LauncherError> {
    let mut guard = AUDIT_WRITER.get_or_init(|| parking_lot::Mutex::new(None)).lock();
    if let Some(ref mut writer) = *guard {
        writer.write_entry(level, category, message, metadata)?;
    }
    Ok(())
}

pub fn read_audit_log(
    filter_category: Option<AuditCategory>,
    limit: usize,
    offset: usize,
) -> Result<Vec<AuditEntry>, LauncherError> {
    let guard = AUDIT_WRITER.get_or_init(|| parking_lot::Mutex::new(None)).lock();
    let log_dir = match guard.as_ref() {
        Some(w) => w.log_dir.clone(),
        None => get_config_dir().join("security"),
    };
    drop(guard);

    let log_path = log_dir.join("audit.log");
    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&log_path)?;
    let mut entries: Vec<AuditEntry> = content
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .filter(|e: &AuditEntry| {
            filter_category
                .as_ref()
                .is_none_or(|cat| &e.category == cat)
        })
        .collect();

    entries.reverse();
    let entries = entries
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();
    Ok(entries)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginHistoryEntry {
    pub timestamp: String,
    pub auth_type: String,
    pub success: bool,
    pub username: String,
}

fn login_history_path() -> std::path::PathBuf {
    get_config_dir().join("security").join("login_history.json")
}

pub fn record_login(
    auth_type: &str,
    success: bool,
    username: &str,
) -> Result<(), LauncherError> {
    let path = login_history_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut history: Vec<LoginHistoryEntry> = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    history.push(LoginHistoryEntry {
        timestamp: Utc::now().to_rfc3339(),
        auth_type: auth_type.to_string(),
        success,
        username: username.to_string(),
    });

    if history.len() > 50 {
        let start = history.len() - 50;
        history = history.split_off(start);
    }

    let data = serde_json::to_string_pretty(&history)?;
    std::fs::write(&path, data)?;

    log_audit(
        AuditLevel::Info,
        AuditCategory::Auth,
        &format!("Login attempt: auth_type={}, success={}, username={}", auth_type, success, username),
        Some(serde_json::json!({
            "auth_type": auth_type,
            "success": success,
            "username": username,
        })),
    )?;

    Ok(())
}

pub fn get_login_history() -> Result<Vec<LoginHistoryEntry>, LauncherError> {
    let path = login_history_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut history: Vec<LoginHistoryEntry> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .unwrap_or_default();
    history.reverse();
    Ok(history)
}
