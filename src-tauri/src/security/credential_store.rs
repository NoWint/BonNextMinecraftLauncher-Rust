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
        match super::crypto::decrypt_json::<AccountStore>(
            &super::crypto::EncryptedData {
                version: String::new(),
                salt: String::new(),
                nonce: String::new(),
                ciphertext: String::new(),
            },
            &enc,
        ) {
            Ok(store) => return Ok(store),
            Err(_) => {}
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
