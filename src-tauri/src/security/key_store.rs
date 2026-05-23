use crate::error::LauncherError;
use crate::platform::paths::get_config_dir;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SecureKeyStore {
    pub keys: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct KeyStatus {
    pub name: String,
    pub configured: bool,
    pub source: String,
}

pub fn store_path() -> std::path::PathBuf {
    get_config_dir().join("security_config.json.enc")
}

pub fn load() -> Result<SecureKeyStore, LauncherError> {
    let path = store_path();
    if !path.exists() {
        return Ok(SecureKeyStore::default());
    }
    let encrypted_data: super::crypto::EncryptedData = std::fs::read_to_string(&path)
        .ok()
        .and_then(|d| serde_json::from_str(&d).ok())
        .ok_or_else(|| LauncherError::Decryption("Failed to parse encrypted key store".into()))?;
    super::crypto::decrypt_json(&encrypted_data, &path)
}

pub fn save(store: &SecureKeyStore) -> Result<(), LauncherError> {
    let path = store_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    super::crypto::encrypt_json(store, &path)?;
    super::file_permissions::set_secure_permissions(&path)?;
    Ok(())
}

pub fn get_key(name: &str) -> Result<Option<String>, LauncherError> {
    let env_name = format!("BONNEXT_{}", name.to_uppercase().replace('-', "_"));
    if let Ok(val) = std::env::var(&env_name) {
        return Ok(Some(val));
    }
    let store = load()?;
    Ok(store.keys.get(name).cloned())
}

pub fn set_key(name: &str, value: &str) -> Result<(), LauncherError> {
    let mut store = load()?;
    store.keys.insert(name.to_string(), value.to_string());
    save(&store)?;
    super::audit::log_audit(
        super::audit::AuditLevel::Info,
        super::audit::AuditCategory::Config,
        &format!("API key set: {}", name),
        Some(serde_json::json!({ "key_name": name })),
    )?;
    Ok(())
}

pub fn delete_key(name: &str) -> Result<(), LauncherError> {
    let mut store = load()?;
    store.keys.remove(name);
    save(&store)?;
    super::audit::log_audit(
        super::audit::AuditLevel::Info,
        super::audit::AuditCategory::Config,
        &format!("API key deleted: {}", name),
        Some(serde_json::json!({ "key_name": name })),
    )?;
    Ok(())
}

pub fn key_status(name: &str) -> Result<KeyStatus, LauncherError> {
    let env_name = format!("BONNEXT_{}", name.to_uppercase().replace('-', "_"));
    if std::env::var(&env_name).is_ok() {
        return Ok(KeyStatus {
            name: name.to_string(),
            configured: true,
            source: "env".to_string(),
        });
    }
    let store = load()?;
    if store.keys.contains_key(name) {
        Ok(KeyStatus {
            name: name.to_string(),
            configured: true,
            source: "store".to_string(),
        })
    } else {
        Ok(KeyStatus {
            name: name.to_string(),
            configured: false,
            source: "not_configured".to_string(),
        })
    }
}
