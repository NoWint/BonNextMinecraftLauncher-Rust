pub mod webrtc;
pub mod proxy;
pub mod signaling;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerStatus {
    Connecting,
    Connected,
    Disconnected,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct PeerInfo {
    pub peer_id: String,
    pub status: PeerStatus,
    pub latency_ms: Option<u64>,
    pub display_name: Option<String>,
}

pub struct P2PState {
    pub connections: Vec<PeerInfo>,
    pub signaling_connected: bool,
    pub local_port: Option<u16>,
}

impl P2PState {
    pub fn new() -> Self {
        Self {
            connections: Vec::new(),
            signaling_connected: false,
            local_port: None,
        }
    }
}
