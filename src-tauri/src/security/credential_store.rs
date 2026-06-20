use crate::error::LauncherError;
use crate::platform::paths::get_config_dir;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccount {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub account_type: String,
    pub last_used: String,
    pub expires_at: Option<String>,
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub yggdrasil_client_token: Option<String>,
    #[serde(default)]
    pub yggdrasil_server_url: Option<String>,
    #[serde(default)]
    pub yggdrasil_selected_profile: Option<String>,
    #[serde(default)]
    pub local_skin_path: Option<String>,
    #[serde(default)]
    pub local_skin_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccountStore {
    pub accounts: Vec<StoredAccount>,
    pub active_account_id: Option<String>,
}

pub fn enc_path() -> std::path::PathBuf {
    get_config_dir().join("accounts.json.enc")
}

pub fn plain_path() -> std::path::PathBuf {
    get_config_dir().join("accounts.json")
}

pub fn is_encrypted() -> bool {
    enc_path().exists()
}

pub fn is_plain() -> bool {
    plain_path().exists()
}

pub fn migrate_plain_to_encrypted() -> Result<(), LauncherError> {
    if !plain_path().exists() {
        return Ok(());
    }
    if enc_path().exists() {
        return Ok(());
    }

    let plain = plain_path();
    let content = std::fs::read_to_string(&plain)?;
    let store: AccountStore = serde_json::from_str(&content)?;

    let enc = enc_path();
    super::crypto::encrypt_json(&store, &enc)?;
    super::file_permissions::set_secure_permissions(&enc)?;

    std::fs::remove_file(&plain)?;

    super::audit::log_audit(
        super::audit::AuditLevel::Info,
        super::audit::AuditCategory::Crypto,
        "Migrated plain accounts.json to encrypted storage",
        None,
    )?;

    Ok(())
}

pub fn load() -> Result<AccountStore, LauncherError> {
    let enc = enc_path();
    if enc.exists() {
        let content = std::fs::read_to_string(&enc)?;
        let encrypted_data: super::crypto::EncryptedData = serde_json::from_str(&content)?;
        if let Ok(store) = super::crypto::decrypt_json::<AccountStore>(&encrypted_data, &enc) {
            return Ok(store);
        }
    }

    let plain = plain_path();
    if plain.exists() {
        let content = std::fs::read_to_string(&plain)?;
        let store: AccountStore = serde_json::from_str(&content)?;
        return Ok(store);
    }

    Ok(AccountStore::default())
}

pub fn save_encrypted(store: &AccountStore) -> Result<(), LauncherError> {
    let enc = enc_path();
    if let Some(parent) = enc.parent() {
        std::fs::create_dir_all(parent)?;
    }
    super::crypto::encrypt_json(store, &enc)?;
    super::file_permissions::set_secure_permissions(&enc)?;
    Ok(())
}

pub fn save(store: &AccountStore, use_encryption: bool) -> Result<(), LauncherError> {
    if use_encryption {
        save_encrypted(store)
    } else {
        let plain = plain_path();
        if let Some(parent) = plain.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(store)?;
        std::fs::write(&plain, content)?;
        Ok(())
    }
}

pub fn save_to_keyring(key: &str, value: &str) -> Result<(), LauncherError> {
    let entry = keyring::Entry::new("bonnext", key)
        .map_err(|e| LauncherError::ConfigError(format!("Keyring entry creation failed: {}", e)))?;
    entry.set_password(value)
        .map_err(|e| LauncherError::ConfigError(format!("Keyring save failed: {}", e)))?;
    Ok(())
}

pub fn load_from_keyring(key: &str) -> Result<Option<String>, LauncherError> {
    let entry = keyring::Entry::new("bonnext", key)
        .map_err(|e| LauncherError::ConfigError(format!("Keyring entry creation failed: {}", e)))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => {
            tracing::warn!("Keyring load failed for key '{}': {}", key, e);
            Ok(None)
        }
    }
}

pub fn delete_from_keyring(key: &str) -> Result<(), LauncherError> {
    let entry = keyring::Entry::new("bonnext", key)
        .map_err(|e| LauncherError::ConfigError(format!("Keyring entry creation failed: {}", e)))?;
    entry.delete_credential()
        .map_err(|e| LauncherError::ConfigError(format!("Keyring delete failed: {}", e)))?;
    Ok(())
}

pub fn is_keyring_available() -> bool {
    let entry = match keyring::Entry::new("bonnext", "__availability_check__") {
        Ok(e) => e,
        Err(_) => return false,
    };
    match entry.get_password() {
        Ok(_) => true,
        Err(keyring::Error::NoEntry) => true,
        Err(_) => false,
    }
}
