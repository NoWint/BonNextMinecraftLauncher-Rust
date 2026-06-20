use std::sync::Arc;
use tokio::sync::Mutex;
use crate::p2p::P2PState;

#[tauri::command]
pub async fn p2p_get_status(
    state: tauri::State<'_, Arc<Mutex<P2PState>>>,
) -> Result<serde_json::Value, String> {
    let p2p = state.lock().await;
    Ok(serde_json::json!({
        "connections": p2p.connections.len(),
        "signaling_connected": p2p.signaling_connected,
        "local_port": p2p.local_port,
    }))
}

#[tauri::command]
pub async fn p2p_connect(
    state: tauri::State<'_, Arc<Mutex<P2PState>>>,
    peer_id: String,
) -> Result<String, String> {
    let mut p2p = state.lock().await;
    let peer = crate::p2p::webrtc::WebRTCPeer::new(&peer_id);
    p2p.connections.push(crate::p2p::PeerInfo {
        peer_id: peer_id.clone(),
        status: peer.status.clone(),
        latency_ms: None,
        display_name: None,
    });
    Ok(format!("Connecting to {}", peer_id))
}

#[tauri::command]
pub async fn p2p_disconnect(
    state: tauri::State<'_, Arc<Mutex<P2PState>>>,
    peer_id: String,
) -> Result<String, String> {
    let mut p2p = state.lock().await;
    p2p.connections.retain(|p| p.peer_id != peer_id);
    Ok(format!("Disconnected from {}", peer_id))
}
