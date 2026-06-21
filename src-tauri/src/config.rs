use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

use crate::platform::paths;
use crate::security::crypto;

static CONFIG_CACHE: OnceLock<parking_lot::Mutex<Option<AppConfig>>> = OnceLock::new();

const PROXY_PWD_AAD: &[u8] = b"bonnext:config:proxy_password";

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
    #[serde(skip)]
    pub proxy_password: Option<String>,
    #[serde(default, rename = "proxy_password")]
    proxy_password_encrypted: Option<String>,
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
            proxy_password_encrypted: None,
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
    #[serde(default = "default_git_proxy_enabled")]
    pub git_proxy_enabled: bool,
    #[serde(default = "default_git_proxy_url")]
    pub git_proxy_url: String,
    #[serde(default)]
    pub force_memory: bool,
    #[serde(default)]
    pub force_java_path: bool,
    #[serde(default)]
    pub security: SecurityConfig,
    #[serde(default = "default_active_shell")]
    pub active_shell: String,
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
    "bmclapi".to_string()
}

fn default_max_concurrent_downloads() -> usize {
    8
}

fn default_git_proxy_enabled() -> bool {
    true
}

fn default_git_proxy_url() -> String {
    "https://gh-proxy.com".to_string()
}

fn default_active_shell() -> String {
    "zzz".to_string()
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
            git_proxy_enabled: default_git_proxy_enabled(),
            git_proxy_url: default_git_proxy_url(),
            force_memory: false,
            force_java_path: false,
            security: SecurityConfig::default(),
            active_shell: default_active_shell(),
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
    let mut config: AppConfig = serde_json::from_str(&content)?;
    if let Some(ref enc) = config.security.proxy_password_encrypted {
        match crypto::decrypt_string(enc, PROXY_PWD_AAD) {
            Ok(plain) => config.security.proxy_password = Some(plain),
            Err(e) => {
                tracing::warn!("Failed to decrypt proxy_password: {}", e);
                let _ = crate::security::audit::log_audit(
                    crate::security::audit::AuditLevel::Warn,
                    crate::security::audit::AuditCategory::Crypto,
                    &format!("Failed to decrypt proxy_password: {}", e),
                    None,
                );
                config.security.proxy_password = None;
            }
        }
    }
    Ok(config)
}

fn atomic_write(path: &std::path::Path, content: &str) -> Result<(), crate::error::LauncherError> {
    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, content)?;
    let bak_path = path.with_extension("json.bak");
    if path.exists() {
        let _ = std::fs::rename(path, &bak_path);
    }
    std::fs::rename(&tmp_path, path)?;
    Ok(())
}

pub fn save_config(config: &AppConfig) -> Result<(), crate::error::LauncherError> {
    let path = paths::get_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut config_for_save = config.clone();
    if let Some(ref plain) = config.security.proxy_password {
        let enc = crypto::encrypt_string(plain, PROXY_PWD_AAD).map_err(|e| {
            crate::error::LauncherError::ConfigError(format!("Failed to encrypt proxy_password: {}. Refusing to store password in plaintext.", e))
        })?;
        config_for_save.security.proxy_password_encrypted = Some(enc);
    } else {
        config_for_save.security.proxy_password_encrypted = None;
    }
    let content = serde_json::to_string_pretty(&config_for_save)?;
    atomic_write(&path, &content)?;
    invalidate_config_cache();
    // 用户可能更改了 java_path，清除 Java 检测缓存让下次 find_java 重新扫描。
    crate::platform::java::invalidate_java_cache();
    Ok(())
}

pub fn load_config_cached() -> Result<AppConfig, crate::error::LauncherError> {
    let cache = CONFIG_CACHE.get_or_init(|| parking_lot::Mutex::new(None));
    let guard = cache.lock();
    if let Some(ref config) = *guard {
        return Ok(config.clone());
    }
    drop(guard);
    let config = load_config()?;
    *cache.lock() = Some(config.clone());
    Ok(config)
}

pub fn invalidate_config_cache() {
    if let Some(cache) = CONFIG_CACHE.get() {
        *cache.lock() = None;
    }
}

pub async fn load_config_async() -> Result<AppConfig, crate::error::LauncherError> {
    let path = paths::get_config_path();
    if !path.exists() {
        let config = AppConfig::default();
        save_config_async(&config).await?;
        return Ok(config);
    }
    let content = match tokio::fs::read_to_string(&path).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Failed to read config: {}, trying backup", e);
            let bak_path = path.with_extension("json.bak");
            if bak_path.exists() {
                tracing::info!("Restoring config from backup");
                let bak_content = tokio::fs::read_to_string(&bak_path).await?;
                let _ = tokio::fs::copy(&bak_path, &path).await;
                bak_content
            } else {
                return Err(e.into());
            }
        }
    };
    let mut config: AppConfig = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Config parse error: {}, trying backup", e);
            let bak_path = path.with_extension("json.bak");
            if bak_path.exists() {
                tracing::info!("Restoring config from backup due to parse error");
                let bak_content = tokio::fs::read_to_string(&bak_path).await?;
                let parsed: AppConfig = serde_json::from_str(&bak_content)?;
                let _ = tokio::fs::copy(&bak_path, &path).await;
                parsed
            } else {
                tracing::warn!("No backup available, using defaults");
                let config = AppConfig::default();
                save_config_async(&config).await?;
                return Ok(config);
            }
        }
    };
    if let Some(ref enc) = config.security.proxy_password_encrypted {
        match crypto::decrypt_string(enc, PROXY_PWD_AAD) {
            Ok(plain) => config.security.proxy_password = Some(plain),
            Err(e) => {
                tracing::warn!("Failed to decrypt proxy_password: {}", e);
                let _ = crate::security::audit::log_audit(
                    crate::security::audit::AuditLevel::Warn,
                    crate::security::audit::AuditCategory::Crypto,
                    &format!("Failed to decrypt proxy_password: {}", e),
                    None,
                );
                config.security.proxy_password = None;
            }
        }
    }
    Ok(config)
}

pub async fn save_config_async(config: &AppConfig) -> Result<(), crate::error::LauncherError> {
    let path = paths::get_config_path();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let mut config_for_save = config.clone();
    if let Some(ref plain) = config.security.proxy_password {
        let enc = crypto::encrypt_string(plain, PROXY_PWD_AAD).map_err(|e| {
            crate::error::LauncherError::ConfigError(format!("Failed to encrypt proxy_password: {}. Refusing to store password in plaintext.", e))
        })?;
        config_for_save.security.proxy_password_encrypted = Some(enc);
    } else {
        config_for_save.security.proxy_password_encrypted = None;
    }
    let content = serde_json::to_string_pretty(&config_for_save)?;
    let tmp_path = path.with_extension("json.tmp");
    tokio::fs::write(&tmp_path, &content).await?;
    let bak_path = path.with_extension("json.bak");
    if path.exists() {
        let _ = tokio::fs::rename(&path, &bak_path).await;
    }
    tokio::fs::rename(&tmp_path, &path).await?;
    invalidate_config_cache();
    Ok(())
}

pub fn get_download_source_name() -> String {
    load_config_cached()
        .map(|c| c.download_source.clone())
        .unwrap_or_else(|_| default_download_source())
}

pub fn get_max_concurrent_downloads() -> usize {
    load_config_cached()
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
        assert_eq!(c.download_source, "bmclapi");
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

    #[test]
    fn security_config_defaults() {
        let s = SecurityConfig::default();
        assert!(s.credential_encryption);
        assert!(s.strict_verification);
        assert!(s.enforce_https);
        assert_eq!(s.jvm_args_mode, "whitelist");
        assert_eq!(s.sandbox_mode, "off");
        assert!(!s.proxy_enabled);
        assert!(s.proxy_url.is_none());
        assert!(s.proxy_username.is_none());
        assert!(s.proxy_password.is_none());
        assert!(s.audit_log_enabled);
        assert!(s.secure_launch_check);
    }

    #[test]
    fn security_config_json_roundtrip() {
        let s = SecurityConfig {
            credential_encryption: false,
            enforce_https: false,
            proxy_enabled: true,
            proxy_url: Some("http://proxy.example.com:8080".into()),
            proxy_username: Some("user".into()),
            ..SecurityConfig::default()
        };
        let json = serde_json::to_string(&s).unwrap();
        let parsed: SecurityConfig = serde_json::from_str(&json).unwrap();
        assert!(!parsed.credential_encryption);
        assert!(!parsed.enforce_https);
        assert!(parsed.proxy_enabled);
        assert_eq!(parsed.proxy_url.as_deref(), Some("http://proxy.example.com:8080"));
        assert_eq!(parsed.proxy_username.as_deref(), Some("user"));
    }

    #[test]
    fn proxy_password_not_in_json() {
        let c = AppConfig {
            security: SecurityConfig {
                proxy_password: Some("secret".into()),
                ..SecurityConfig::default()
            },
            ..AppConfig::default()
        };
        let json = serde_json::to_string(&c).unwrap();
        assert!(!json.contains("secret"));
    }

    #[test]
    fn default_optional_fields_are_none() {
        let c = AppConfig::default();
        assert!(c.game_dir.is_none());
        assert!(c.java_path.is_none());
        assert!(c.jvm_args.is_none());
        assert!(c.selected_instance.is_none());
    }

    #[test]
    fn partial_deserialize_uses_defaults() {
        let json = r#"{"max_memory": 4096}"#;
        let parsed: AppConfig = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.max_memory, 4096);
        assert_eq!(parsed.min_memory, 512);
        assert_eq!(parsed.download_source, "bmclapi");
        assert_eq!(parsed.max_concurrent_downloads, 8);
    }
}
