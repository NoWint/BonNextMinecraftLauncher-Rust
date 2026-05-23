use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::LauncherError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineAuthResult {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
}

pub fn offline_login(username: &str) -> Result<OfflineAuthResult, LauncherError> {
    if username.trim().is_empty() {
        return Err(LauncherError::AuthFailed("Username cannot be empty".to_string()));
    }

    let namespace = uuid::Uuid::NAMESPACE_DNS;
    let offline_uuid = Uuid::new_v5(&namespace, format!("OfflinePlayer:{}", username).as_bytes());

    crate::security::audit::record_login("offline", true, username)?;

    Ok(OfflineAuthResult {
        username: username.trim().to_string(),
        uuid: offline_uuid.to_string().replace("-", ""),
        access_token: format!("offline_{}", Uuid::new_v4().simple()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_username() {
        let r = offline_login("TestPlayer").unwrap();
        assert_eq!(r.username, "TestPlayer");
        assert_eq!(r.uuid.len(), 32);
        assert!(!r.uuid.contains('-'));
        assert!(r.access_token.starts_with("offline_"));
    }

    #[test]
    fn trims_whitespace() {
        let r = offline_login("  Player  ").unwrap();
        assert_eq!(r.username, "Player");
    }

    #[test]
    fn empty_fails() {
        assert!(offline_login("").is_err());
        assert!(offline_login("   ").is_err());
    }

    #[test]
    fn deterministic_uuid() {
        let r1 = offline_login("Player1").unwrap();
        let r2 = offline_login("Player1").unwrap();
        assert_eq!(r1.uuid, r2.uuid);
    }

    #[test]
    fn different_names_different_uuids() {
        let r1 = offline_login("A").unwrap();
        let r2 = offline_login("B").unwrap();
        assert_ne!(r1.uuid, r2.uuid);
    }
}
