use crate::auth::microsoft::AuthResult;
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub refresh_token: String,
    pub username: String,
    pub uuid: String,
    pub expires_at: u64,
}

impl SavedSession {
    pub fn from_auth_result(result: &AuthResult) -> Self {
        Self {
            refresh_token: result.refresh_token.clone(),
            username: result.username.clone(),
            uuid: result.uuid.clone(),
            expires_at: result.expires_at,
        }
    }
}

pub fn save_session(
    path: &PathBuf,
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
    path: &PathBuf,
) -> Result<Option<SavedSession>, LauncherError> {
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(path)?;
    let session: SavedSession = serde_json::from_str(&json)?;
    Ok(Some(session))
}

pub fn delete_session(path: &PathBuf) -> std::io::Result<()> {
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}
