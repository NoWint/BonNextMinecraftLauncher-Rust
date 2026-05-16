use crate::auth::microsoft::AuthResult;
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub access_token: String,
    pub refresh_token: String,
    pub username: String,
    pub uuid: String,
    pub expires_at: u64,
}

impl SavedSession {
    pub fn from_auth_result(result: &AuthResult) -> Self {
        Self {
            access_token: result.access_token.clone(),
            refresh_token: result.refresh_token.clone(),
            username: result.username.clone(),
            uuid: result.uuid.clone(),
            expires_at: result.expires_at,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        now >= self.expires_at
    }
}

pub fn save_session(
    path: &Path,
    session: &SavedSession,
) -> Result<(), LauncherError> {
    let json = serde_json::to_string_pretty(session)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, json)?;
    Ok(())
}

pub fn load_session(
    path: &Path,
) -> Result<Option<SavedSession>, LauncherError> {
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(path)?;
    let session: SavedSession = serde_json::from_str(&json)?;
    Ok(Some(session))
}

pub fn delete_session(path: &Path) -> std::io::Result<()> {
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}
