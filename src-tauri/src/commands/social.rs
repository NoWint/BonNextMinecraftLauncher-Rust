use base64::Engine as _;
use ed25519_dalek::VerifyingKey;
use crate::chat::messages::MessageStore;
use crate::error::LauncherError;
use crate::platform::paths;
use crate::social::{identity, discovery, sync, p2p};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::sync::Mutex as StdMutex;
use std::sync::Arc;
use tauri::State;

static DISCORD_CLIENT: std::sync::OnceLock<StdMutex<Option<DiscordIpcClient>>> = std::sync::OnceLock::new();

const DISCORD_APP_ID: &str = "1307866369206550619";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendEntry {
    pub id: String,
    pub name: String,
    pub status: String,
    pub current_game: Option<String>,
    pub public_key: Option<String>,
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
pub async fn add_friend(id: String, name: String, public_key: Option<String>) -> Result<(), LauncherError> {
    let friends_path = paths::get_game_dir().join("friends.json");
    let mut friends: Vec<FriendEntry> = if friends_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&friends_path)?).unwrap_or_default()
    } else {
        Vec::new()
    };
    if friends.iter().any(|f| f.id == id) {
        return Ok(());
    }
    friends.push(FriendEntry { id, name, status: "offline".into(), current_game: None, public_key });
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
pub async fn start_social_discovery(
    display_name: String,
    p2p_state: State<'_, p2p::P2pState>,
) -> Result<(), LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    let peer_id = identity::public_key_to_id(&id.verifying_key);

    // Start P2P listener if not already running
    let port = {
        let lp = p2p_state.listener_port.lock().unwrap();
        if lp.is_none() {
            drop(lp);
            let identity_arc = Arc::new(identity::Identity {
                signing_key: id.signing_key.clone(),
                verifying_key: id.verifying_key,
            });
            let msg_store = super::chat::get_store();
            let store_arc = Arc::new(MessageStore::clone_store(msg_store));
            let state_arc = Arc::new(p2p::P2pState::new());
            let port = p2p::start_listener(state_arc, identity_arc, store_arc)
                .map_err(|e| LauncherError::Other(e))?;
            let mut lp = p2p_state.listener_port.lock().unwrap();
            *lp = Some(port);
            port
        } else {
            lp.unwrap()
        }
    };

    discovery::announce(&peer_id, &display_name, port)
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
pub async fn start_p2p_listener(
    p2p_state: State<'_, p2p::P2pState>,
) -> Result<u16, LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    let identity = Arc::new(identity::Identity {
        signing_key: id.signing_key.clone(),
        verifying_key: id.verifying_key,
    });
    // Use the message store from chat module
    let msg_store = super::chat::get_store();
    let store = Arc::new(MessageStore::clone_store(msg_store));
    let state = Arc::new(p2p::P2pState::new());
    let port = p2p::start_listener(state, identity, store)
        .map_err(|e| LauncherError::Other(e))?;
    // Store port in managed state
    *p2p_state.listener_port.lock().unwrap() = Some(port);
    Ok(port)
}

#[tauri::command]
pub async fn send_p2p_message(
    peer_id: String,
    peer_address: String,
    content: String,
) -> Result<(), LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    // For now, we need the peer's verifying key. Get it from a stored friend public key.
    // For MVP: derive from stored friend data (friends can store public keys)
    // Simplified: use the peer's address only.
    let friends_path = paths::get_game_dir().join("friends.json");
    let friend_public_key = if friends_path.exists() {
        let data = std::fs::read_to_string(&friends_path)?;
        let friends: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
        friends.iter()
            .find(|f| f.get("id").and_then(|v| v.as_str()) == Some(&peer_id))
            .and_then(|f| f.get("public_key").and_then(|v| v.as_str()).map(|s| s.to_string()))
    } else {
        None
    };

    if let Some(pk_b64) = friend_public_key {
        let pk_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &pk_b64,
        ).map_err(|e| LauncherError::Other(format!("Invalid friend public key: {}", e)))?;
        let pk_arr: [u8; 32] = pk_bytes.try_into()
            .map_err(|_| LauncherError::Other("Invalid public key length".to_string()))?;
        let verifying_key = VerifyingKey::from_bytes(&pk_arr)
            .map_err(|_| LauncherError::Other("Invalid verifying key".to_string()))?;

        p2p::send_p2p_message(
            &identity::Identity {
                signing_key: id.signing_key.clone(),
                verifying_key: id.verifying_key,
            },
            &verifying_key,
            &peer_address,
            &peer_id,
            &content,
        ).map_err(|e| LauncherError::Other(e))
    } else {
        Err(LauncherError::Other(format!("Friend {} not found or missing public key. Add friend with public key first.", peer_id)))
    }
}

#[tauri::command]
pub async fn get_peer_public_key() -> Result<String, LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        id.verifying_key.as_bytes(),
    ))
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
