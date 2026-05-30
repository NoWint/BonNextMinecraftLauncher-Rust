use crate::error::LauncherError;
use crate::platform::paths;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::LazyLock;
use parking_lot::Mutex;

static STORE_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

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

impl AccountStore {
    fn path() -> std::path::PathBuf {
        paths::get_config_dir().join("accounts.json")
    }

    pub fn load() -> Result<Self, LauncherError> {
        let path = Self::path();
        if !path.exists() {
            return Ok(AccountStore::default());
        }
        let content = std::fs::read_to_string(&path)?;
        let store: AccountStore = serde_json::from_str(&content)?;
        Ok(store)
    }

    pub fn save(&self) -> Result<(), LauncherError> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    pub fn upsert_account(&mut self, account: StoredAccount) -> Result<(), LauncherError> {
        let _lock = STORE_LOCK.lock();
        let mut store = Self::load()?;
        if let Some(existing) = store.accounts.iter_mut().find(|a| a.id == account.id) {
            *existing = account;
        } else {
            store.accounts.push(account);
        }
        store.save()
    }

    pub fn remove_account(&mut self, id: &str) -> Result<(), LauncherError> {
        let _lock = STORE_LOCK.lock();
        let mut store = Self::load()?;
        store.accounts.retain(|a| a.id != id);
        if store.active_account_id.as_deref() == Some(id) {
            store.active_account_id = store.accounts.first().map(|a| a.id.clone());
        }
        store.save()
    }

    pub fn set_active(&mut self, id: &str) -> Result<(), LauncherError> {
        let _lock = STORE_LOCK.lock();
        let mut store = Self::load()?;
        if store.accounts.iter().any(|a| a.id == id) {
            store.active_account_id = Some(id.to_string());
            store.save()
        } else {
            Err(LauncherError::AuthFailed("Account not found".to_string()))
        }
    }

    pub fn get_active(&self) -> Option<&StoredAccount> {
        self.active_account_id
            .as_ref()
            .and_then(|id| self.accounts.iter().find(|a| &a.id == id))
    }
}

pub async fn refresh_microsoft_token(
    refresh_token: &str,
) -> Result<(String, String), LauncherError> {
    let client = crate::http_client::build_client();
    let mut params = HashMap::new();
    params.insert("client_id", "00000000402b5328");
    params.insert("refresh_token", refresh_token);
    params.insert("grant_type", "refresh_token");
    params.insert("scope", "XboxLive.signin offline_access");

    let resp: serde_json::Value = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&params)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let access_token = resp["access_token"]
        .as_str()
        .ok_or_else(|| LauncherError::AuthFailed("Missing access_token in refresh".to_string()))?;
    let new_refresh_token = resp["refresh_token"]
        .as_str()
        .unwrap_or(refresh_token)
        .to_string();

    Ok((access_token.to_string(), new_refresh_token))
}

pub async fn ensure_fresh_token() -> Result<Option<String>, LauncherError> {
    let refresh_token = {
        let _lock = STORE_LOCK.lock();
        let store = AccountStore::load()?;
        let active_id = match store.active_account_id {
            Some(ref id) => id.clone(),
            None => return Ok(None),
        };
        match store.accounts.iter().find(|a| a.id == active_id) {
            Some(acct) if acct.account_type == "microsoft" => {
                if acct.expires_at.as_ref().map_or(true, |exp| {
                    chrono::DateTime::parse_from_rfc3339(exp)
                        .map(|dt| {
                            let utc_dt: chrono::DateTime<chrono::Utc> = dt.into();
                            chrono::Utc::now() + chrono::Duration::minutes(10) >= utc_dt
                        })
                        .unwrap_or(true)
                }) {
                    acct.refresh_token.clone()
                } else {
                    return Ok(Some(acct.access_token.clone()));
                }
            }
            _ => return Ok(None),
        }
    };

    let rt = match refresh_token {
        Some(rt) => rt,
        None => return Ok(None),
    };

    let (new_access, new_refresh) = refresh_microsoft_token(&rt).await?;

    let _lock = STORE_LOCK.lock();
    let mut store = AccountStore::load()?;
    let active_id = store.active_account_id.clone().unwrap_or_default();
    if let Some(ref mut acct) = store.accounts.iter_mut().find(|a| a.id == active_id) {
        acct.access_token = new_access.clone();
        acct.refresh_token = Some(new_refresh);
        let now = chrono::Utc::now();
        acct.expires_at = Some((now + chrono::Duration::minutes(50)).to_rfc3339());
        store.save()?;
    }

    Ok(Some(new_access))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_account(id: &str, username: &str) -> StoredAccount {
        StoredAccount {
            id: id.to_string(),
            username: username.to_string(),
            uuid: "00000000000000000000000000000000".to_string(),
            access_token: "token".to_string(),
            refresh_token: None,
            account_type: "offline".to_string(),
            last_used: "2025-01-01T00:00:00Z".to_string(),
            expires_at: None,
            avatar_url: None,
            yggdrasil_client_token: None,
            yggdrasil_server_url: None,
            yggdrasil_selected_profile: None,
            local_skin_path: None,
            local_skin_model: None,
        }
    }

    #[test]
    fn stored_account_serialization() {
        let account = sample_account("acc1", "TestPlayer");
        let json = serde_json::to_string(&account).unwrap();
        let back: StoredAccount = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, "acc1");
        assert_eq!(back.username, "TestPlayer");
        assert_eq!(back.account_type, "offline");
    }

    #[test]
    fn account_store_default() {
        let store = AccountStore::default();
        assert!(store.accounts.is_empty());
        assert!(store.active_account_id.is_none());
    }

    #[test]
    fn account_store_serialization() {
        let mut store = AccountStore::default();
        store.accounts.push(sample_account("acc1", "Player1"));
        store.accounts.push(sample_account("acc2", "Player2"));
        store.active_account_id = Some("acc1".to_string());

        let json = serde_json::to_string(&store).unwrap();
        let back: AccountStore = serde_json::from_str(&json).unwrap();
        assert_eq!(back.accounts.len(), 2);
        assert_eq!(back.active_account_id, Some("acc1".to_string()));
    }

    #[test]
    fn get_active_returns_correct_account() {
        let mut store = AccountStore::default();
        store.accounts.push(sample_account("acc1", "Player1"));
        store.accounts.push(sample_account("acc2", "Player2"));
        store.active_account_id = Some("acc2".to_string());

        let active = store.get_active().unwrap();
        assert_eq!(active.id, "acc2");
        assert_eq!(active.username, "Player2");
    }

    #[test]
    fn get_active_returns_none_when_no_active() {
        let mut store = AccountStore::default();
        store.accounts.push(sample_account("acc1", "Player1"));
        assert!(store.get_active().is_none());
    }

    #[test]
    fn get_active_returns_none_when_empty() {
        let store = AccountStore::default();
        assert!(store.get_active().is_none());
    }

    #[test]
    fn stored_account_with_optional_fields() {
        let mut account = sample_account("acc1", "Player1");
        account.refresh_token = Some("refresh_tok".to_string());
        account.expires_at = Some("2025-12-31T23:59:59Z".to_string());
        account.avatar_url = Some("https://example.com/avatar.png".to_string());
        account.yggdrasil_client_token = Some("client_tok".to_string());
        account.yggdrasil_server_url = Some("https://littleskin.cn".to_string());

        let json = serde_json::to_string(&account).unwrap();
        let back: StoredAccount = serde_json::from_str(&json).unwrap();
        assert_eq!(back.refresh_token, Some("refresh_tok".to_string()));
        assert_eq!(back.expires_at, Some("2025-12-31T23:59:59Z".to_string()));
        assert_eq!(back.avatar_url, Some("https://example.com/avatar.png".to_string()));
        assert_eq!(back.yggdrasil_client_token, Some("client_tok".to_string()));
    }

    #[test]
    fn stored_account_missing_optional_fields_deserialize() {
        let json = r#"{"id":"acc1","username":"Player1","uuid":"abc","access_token":"tok","refresh_token":null,"account_type":"offline","last_used":"2025-01-01T00:00:00Z","expires_at":null,"avatar_url":null}"#;
        let account: StoredAccount = serde_json::from_str(json).unwrap();
        assert_eq!(account.id, "acc1");
        assert!(account.yggdrasil_client_token.is_none());
        assert!(account.yggdrasil_server_url.is_none());
        assert!(account.local_skin_path.is_none());
    }
}
