use crate::p2p::PeerStatus;

pub struct WebRTCPeer {
    pub peer_id: String,
    pub status: PeerStatus,
}

impl WebRTCPeer {
    pub fn new(peer_id: &str) -> Self {
        Self {
            peer_id: peer_id.to_string(),
            status: PeerStatus::Connecting,
        }
    }

    pub async fn connect(&mut self) -> Result<(), crate::error::LauncherError> {
        self.status = PeerStatus::Connected;
        Ok(())
    }

    pub async fn disconnect(&mut self) -> Result<(), crate::error::LauncherError> {
        self.status = PeerStatus::Disconnected;
        Ok(())
    }
}
