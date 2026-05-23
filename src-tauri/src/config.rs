use serde::{Deserialize, Serialize};

use crate::platform::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    #[serde(default = "default_credential_encryption")]
    pub credential_encryption: bool,
    #[serde(default = "default_strict_verification")]
    pub strict_verification: bool,
    #[serde(default = "default_enforce_https")]
    pub enforce_https: bool,
    #[serde(default = "default_jvm_args_mode")]
    pub jvm_args_mode: String,
    #[serde(default = "default_sandbox_mode")]
    pub sandbox_mode: String,
    #[serde(default)]
    pub proxy_enabled: bool,
    #[serde(default)]
    pub proxy_url: Option<String>,
    #[serde(default)]
    pub proxy_username: Option<String>,
    #[serde(default)]
    pub proxy_password: Option<String>,
    #[serde(default = "default_audit_log_enabled")]
    pub audit_log_enabled: bool,
    #[serde(default = "default_secure_launch_check")]
    pub secure_launch_check: bool,
}

fn default_credential_encryption() -> bool { true }
fn default_strict_verification() -> bool { true }
fn default_enforce_https() -> bool { true }
fn default_jvm_args_mode() -> String { "whitelist".to_string() }
fn default_sandbox_mode() -> String { "off".to_string() }
fn default_audit_log_enabled() -> bool { true }
fn default_secure_launch_check() -> bool { true }

impl Default for SecurityConfig {
    fn default() -> Self {
        SecurityConfig {
            credential_encryption: true,
            strict_verification: true,
            enforce_https: true,
            jvm_args_mode: "whitelist".to_string(),
            sandbox_mode: "off".to_string(),
            proxy_enabled: false,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
            audit_log_enabled: true,
            secure_launch_check: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub game_dir: Option<String>,
    #[serde(default)]
    pub java_path: Option<String>,
    #[serde(default = "default_max_memory")]
    pub max_memory: u32,
    #[serde(default = "default_min_memory")]
    pub min_memory: u32,
    #[serde(default = "default_window_width")]
    pub window_width: u32,
    #[serde(default = "default_window_height")]
    pub window_height: u32,
    #[serde(default = "default_fullscreen")]
    pub fullscreen: bool,
    #[serde(default = "default_download_source")]
    pub download_source: String,
    #[serde(default = "default_max_concurrent_downloads")]
    pub max_concurrent_downloads: usize,
    #[serde(default)]
    pub jvm_args: Option<String>,
    #[serde(default)]
    pub selected_instance: Option<String>,
    #[serde(default)]
    pub auth_type: Option<String>,
    #[serde(default)]
    pub keep_launcher_open: bool,
    #[serde(default)]
    pub show_log_on_crash: bool,
    #[serde(default)]
    pub auto_update_java: bool,
    #[serde(default)]
    pub java_download_source: String,
    #[serde(default)]
    pub force_memory: bool,
    #[serde(default)]
    pub force_java_path: bool,
    #[serde(default)]
    pub security: SecurityConfig,
}

fn default_max_memory() -> u32 {
    2048
}

fn default_min_memory() -> u32 {
    512
}

fn default_window_width() -> u32 {
    854
}

fn default_window_height() -> u32 {
    480
}

fn default_fullscreen() -> bool {
    false
}

fn default_download_source() -> String {
    "official".to_string()
}

fn default_max_concurrent_downloads() -> usize {
    8
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            game_dir: None,
            java_path: None,
            max_memory: default_max_memory(),
            min_memory: default_min_memory(),
            window_width: default_window_width(),
            window_height: default_window_height(),
            fullscreen: false,
            download_source: default_download_source(),
            max_concurrent_downloads: default_max_concurrent_downloads(),
            jvm_args: None,
            selected_instance: None,
            auth_type: Some("offline".to_string()),
            keep_launcher_open: false,
            show_log_on_crash: true,
            auto_update_java: false,
            java_download_source: "adoptium".to_string(),
            force_memory: false,
            force_java_path: false,
            security: SecurityConfig::default(),
        }
    }
}

pub fn load_config() -> Result<AppConfig, crate::error::LauncherError> {
    let path = paths::get_config_path();
    if !path.exists() {
        let config = AppConfig::default();
        save_config(&config)?;
        return Ok(config);
    }
    let content = std::fs::read_to_string(&path)?;
    let config: AppConfig = serde_json::from_str(&content)?;
    Ok(config)
}

pub fn save_config(config: &AppConfig) -> Result<(), crate::error::LauncherError> {
    let path = paths::get_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, content)?;
    Ok(())
}

pub fn get_download_source_name() -> String {
    load_config()
        .map(|c| c.download_source.clone())
        .unwrap_or_else(|_| default_download_source())
}

pub fn get_max_concurrent_downloads() -> usize {
    load_config()
        .map(|c| c.max_concurrent_downloads)
        .unwrap_or_else(|_| default_max_concurrent_downloads())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_sensible() {
        let c = AppConfig::default();
        assert_eq!(c.max_memory, 2048);
        assert_eq!(c.min_memory, 512);
        assert_eq!(c.window_width, 854);
        assert_eq!(c.window_height, 480);
        assert_eq!(c.download_source, "official");
        assert_eq!(c.max_concurrent_downloads, 8);
        assert!(!c.fullscreen);
        assert!(!c.keep_launcher_open);
        assert!(c.show_log_on_crash);
        assert!(!c.auto_update_java);
        assert!(c.security.credential_encryption);
        assert!(c.security.strict_verification);
        assert!(c.security.enforce_https);
        assert_eq!(c.security.jvm_args_mode, "whitelist");
        assert_eq!(c.security.sandbox_mode, "off");
        assert!(c.security.audit_log_enabled);
        assert!(c.security.secure_launch_check);
    }

    #[test]
    fn json_roundtrip() {
        let c = AppConfig { max_memory: 8192, download_source: "bmclapi".into(), keep_launcher_open: true, ..AppConfig::default() };
        let json = serde_json::to_string(&c).unwrap();
        let parsed: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.max_memory, 8192);
        assert_eq!(parsed.download_source, "bmclapi");
        assert!(parsed.keep_launcher_open);
    }
}
