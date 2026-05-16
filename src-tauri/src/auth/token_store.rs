use crate::error::LauncherError;
use crate::platform::paths;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Persisted account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccount {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub account_type: String, // "microsoft" or "offline"
    pub last_used: String,
    pub expires_at: Option<String>,
    pub avatar_url: Option<String>,
}

/// In-memory + on-disk account store
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

    /// Add or update an account
    pub fn upsert_account(&mut self, account: StoredAccount) -> Result<(), LauncherError> {
        if let Some(existing) = self.accounts.iter_mut().find(|a| a.id == account.id) {
            *existing = account;
        } else {
            self.accounts.push(account);
        }
        self.save()
    }

    /// Remove an account by id
    pub fn remove_account(&mut self, id: &str) -> Result<(), LauncherError> {
        self.accounts.retain(|a| a.id != id);
        if self.active_account_id.as_deref() == Some(id) {
            self.active_account_id = self.accounts.first().map(|a| a.id.clone());
        }
        self.save()
    }

    /// Set the active account
    pub fn set_active(&mut self, id: &str) -> Result<(), LauncherError> {
        if self.accounts.iter().any(|a| a.id == id) {
            self.active_account_id = Some(id.to_string());
            self.save()
        } else {
            Err(LauncherError::AuthFailed("Account not found".to_string()))
        }
    }

    /// Get the currently active account
    pub fn get_active(&self) -> Option<&StoredAccount> {
        self.active_account_id
            .as_ref()
            .and_then(|id| self.accounts.iter().find(|a| &a.id == id))
    }
}

/// Refresh a Microsoft access token using the refresh token.
/// Calls the Microsoft OAuth token endpoint.
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

/// Attempt to refresh the active Microsoft account's token if needed.
/// Returns the refreshed access token if successful.
pub async fn ensure_fresh_token() -> Result<Option<String>, LauncherError> {
    let mut store = AccountStore::load()?;
    let active_id = match store.active_account_id.clone() {
        Some(id) => id,
        None => return Ok(None),
    };

    let mut account = store.accounts.iter_mut().find(|a| a.id == active_id);
    match account {
        Some(ref mut acct) if acct.account_type == "microsoft" => {
            if let Some(ref rt) = acct.refresh_token.clone() {
                match refresh_microsoft_token(rt).await {
                    Ok((new_access, new_refresh)) => {
                        acct.access_token = new_access.clone();
                        acct.refresh_token = Some(new_refresh);
                        let now = chrono::Utc::now();
                        // Tokens typically last 1 hour; mark expiry in 50 minutes to refresh early
                        acct.expires_at = Some((now + chrono::Duration::minutes(50)).to_rfc3339());
                        store.save()?;
                        return Ok(Some(new_access));
                    }
                    Err(e) => {
                        tracing::warn!("Token refresh failed: {}", e);
                        return Ok(Some(acct.access_token.clone()));
                    }
                }
            }
            Ok(Some(acct.access_token.clone()))
        }
        _ => Ok(None),
    }
}
