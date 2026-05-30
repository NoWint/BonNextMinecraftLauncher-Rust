use crate::chat::messages::{Message, MessageStore};
use crate::error::LauncherError;
use crate::platform::paths;
use std::sync::OnceLock;

static MSG_STORE: OnceLock<MessageStore> = OnceLock::new();

pub fn get_store() -> &'static MessageStore {
    MSG_STORE.get_or_init(|| {
        let db_path = paths::get_game_dir().join("messages.db");
        MessageStore::new(&db_path).expect("Failed to init message store")
    })
}

#[tauri::command]
pub async fn send_message(peer_id: String, content: String) -> Result<i64, LauncherError> {
    let store = get_store();
    let msg = Message {
        id: None,
        peer_id,
        content,
        sent_by_me: true,
        timestamp: chrono::Utc::now().timestamp(),
        read: false,
        attachment: None,
    };
    store.insert(&msg).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn get_messages(peer_id: String, before: Option<i64>, limit: u32) -> Result<Vec<Message>, LauncherError> {
    let store = get_store();
    store.get_messages(&peer_id, before, limit).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn mark_messages_read(peer_id: String) -> Result<(), LauncherError> {
    let store = get_store();
    store.mark_read(&peer_id).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn get_unread_count(peer_id: String) -> Result<i64, LauncherError> {
    let store = get_store();
    store.get_unread_count(&peer_id).map_err(|e| LauncherError::Other(e))
}
