use crate::error::LauncherError;
use crate::platform::paths;
use crate::social::{identity, discovery, sync};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use serde::Serialize;
use std::sync::OnceLock;
use std::sync::Mutex as StdMutex;

static DISCORD_CLIENT: std::sync::OnceLock<StdMutex<Option<DiscordIpcClient>>> = std::sync::OnceLock::new();

const DISCORD_APP_ID: &str = "1307866369206550619";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendEntry {
    pub id: String,
    pub name: String,
    pub status: String,
    pub current_game: Option<String>,
}

#[tauri::command]
pub async fn list_friends() -> Result<Vec<FriendEntry>, LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    if friends_path.exists() {
        let data = std::fs::read_to_string(&friends_path)?;
        Ok(serde_json::from_str(&data).unwrap_or_default())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub async fn add_friend(id: String, name: String) -> Result<(), LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    let mut friends: Vec<FriendEntry> = if friends_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&friends_path)?).unwrap_or_default()
    } else {
        Vec::new()
    };
    if friends.iter().any(|f| f.id == id) {
        return Ok(());
    }
    friends.push(FriendEntry { id, name, status: "offline".into(), current_game: None });
    std::fs::write(&friends_path, serde_json::to_string_pretty(&friends)?)?;
    Ok(())
}

#[tauri::command]
pub async fn remove_friend(id: String) -> Result<(), LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    let mut friends: Vec<FriendEntry> = if friends_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&friends_path)?).unwrap_or_default()
    } else {
        return Ok(());
    };
    friends.retain(|f| f.id != id);
    std::fs::write(&friends_path, serde_json::to_string_pretty(&friends)?)?;
    Ok(())
}

static IDENTITY: OnceLock<identity::Identity> = OnceLock::new();

#[tauri::command]
pub async fn get_my_peer_id() -> Result<String, LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    Ok(identity::public_key_to_id(&id.verifying_key))
}

#[tauri::command]
pub async fn export_identity_key() -> Result<String, LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    Ok(identity::export_identity(id))
}

#[tauri::command]
pub async fn import_identity_key(encoded: String) -> Result<String, LauncherError> {
    let imported = identity::import_identity(&encoded)
        .map_err(|e| LauncherError::Other(e))?;
    let peer_id = identity::public_key_to_id(&imported.verifying_key);
    let key_path = paths::get_game_dir().join("identity.key");
    std::fs::write(&key_path, &encoded)
        .map_err(|e| LauncherError::Other(format!("Failed to save key: {}", e)))?;
    Ok(peer_id)
}

#[tauri::command]
pub async fn start_social_discovery(display_name: String) -> Result<(), LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    let peer_id = identity::public_key_to_id(&id.verifying_key);
    discovery::announce(&peer_id, &display_name, 0)
        .map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn stop_social_discovery() -> Result<(), LauncherError> {
    if let Some(id) = IDENTITY.get() {
        let peer_id = identity::public_key_to_id(&id.verifying_key);
        discovery::unannounce(&peer_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn scan_social_peers() -> Result<Vec<discovery::PeerAnnouncement>, LauncherError> {
    discovery::scan_peers().map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn generate_instance_snapshot(
    instance_id: String,
    minecraft_version: String,
    loader_type: Option<String>,
    loader_version: Option<String>,
) -> Result<sync::PeerConfigSnapshot, LauncherError> {
    let instance_dir = paths::get_game_dir().join("instances").join(&instance_id).join(".minecraft");
    sync::generate_instance_snapshot(
        &instance_dir,
        &minecraft_version,
        loader_type.as_deref(),
        loader_version.as_deref(),
    ).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn compute_coplay_diff(
    local: sync::PeerConfigSnapshot,
    remote: sync::PeerConfigSnapshot,
) -> Result<sync::ConfigDiff, LauncherError> {
    Ok(sync::compute_diff(&local, &remote))
}

#[tauri::command]
pub async fn start_discord_rpc() -> Result<(), LauncherError> {
    let mut client = DiscordIpcClient::new(DISCORD_APP_ID)
        .map_err(|e| LauncherError::LaunchFailed(format!("Failed to create Discord IPC client: {}", e)))?;
    match client.connect() {
        Ok(_) => {
            let lock = DISCORD_CLIENT.get_or_init(|| StdMutex::new(None));
            let mut guard = lock.lock().unwrap();
            *guard = Some(client);
            tracing::info!("Discord RPC connected");
            Ok(())
        }
        Err(e) => {
            tracing::warn!("Discord RPC connection failed: {}", e);
            Err(LauncherError::LaunchFailed(format!("Failed to connect to Discord: {}", e)))
        }
    }
}

#[tauri::command]
pub async fn stop_discord_rpc() -> Result<(), LauncherError> {
    if let Some(client_lock) = DISCORD_CLIENT.get() {
        let mut guard = client_lock.lock().unwrap();
        if let Some(ref mut client) = *guard {
            let _ = client.close();
            *guard = None;
        }
    }
    tracing::info!("Discord RPC stopped");
    Ok(())
}

#[tauri::command]
pub async fn update_discord_presence(details: String, state: String) -> Result<(), LauncherError> {
    if let Some(client_lock) = DISCORD_CLIENT.get() {
        let mut guard = client_lock.lock().unwrap();
        if let Some(ref mut client) = *guard {
            match client.set_activity(activity::Activity::new()
                .details(&details)
                .state(&state)
                .assets(activity::Assets::new()
                    .large_image("bonnext-logo")
                    .large_text("BonNext Launcher"))
            ) {
                Ok(_) => {
                    tracing::debug!("Discord presence updated");
                    Ok(())
                }
                Err(e) => Err(LauncherError::LaunchFailed(format!("Failed to update presence: {}", e))),
            }
        } else {
            Err(LauncherError::LaunchFailed("Discord RPC not connected".to_string()))
        }
    } else {
        Err(LauncherError::LaunchFailed("Discord RPC not started".to_string()))
    }
}
