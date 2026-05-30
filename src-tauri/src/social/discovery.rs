use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Serialize, Deserialize};
use std::sync::OnceLock;

static MDNS_DAEMON: OnceLock<ServiceDaemon> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerAnnouncement {
    pub peer_id: String,
    pub display_name: String,
    pub port: u16,
}

const SERVICE_TYPE: &str = "_bonnext-social._udp.local.";

fn get_daemon() -> &'static ServiceDaemon {
    MDNS_DAEMON.get_or_init(|| {
        ServiceDaemon::new().expect("Failed to create mDNS daemon")
    })
}

pub fn announce(peer_id: &str, display_name: &str, port: u16) -> Result<(), String> {
    let daemon = get_daemon();
    let properties = [
        ("peer_id", peer_id.to_string()),
        ("display_name", display_name.to_string()),
    ];
    let properties_ref: Vec<(&str, &str)> = properties.iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        peer_id,
        &format!("{}.local.", peer_id),
        "",
        port,
        &properties_ref[..],
    ).map_err(|e| format!("Failed to create service info: {}", e))?;
    daemon.register(service_info)
        .map_err(|e| format!("Failed to register mDNS service: {}", e))?;
    tracing::info!("mDNS announcement started for {} (port {})", peer_id, port);
    Ok(())
}

pub fn unannounce(peer_id: &str) {
    let daemon = get_daemon();
    let service_name = format!("{}.{}", peer_id, SERVICE_TYPE);
    if let Err(e) = daemon.unregister(&service_name) {
        tracing::warn!("Failed to unregister mDNS service: {}", e);
    }
}

pub fn scan_peers() -> Result<Vec<PeerAnnouncement>, String> {
    let daemon = get_daemon();
    let receiver = daemon.browse(SERVICE_TYPE)
        .map_err(|e| format!("mDNS browse failed: {}", e))?;
    let mut peers = Vec::new();
    let timeout = std::time::Duration::from_secs(3);
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        let remaining = timeout.saturating_sub(start.elapsed());
        match receiver.recv_timeout(remaining.min(std::time::Duration::from_millis(500))) {
            Ok(event) => {
                if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                    let peer_id = info.get_property_val_str("peer_id").unwrap_or_default().to_string();
                    let display_name = info.get_property_val_str("display_name").unwrap_or_default().to_string();
                    if !peer_id.is_empty() && !peers.iter().any(|p: &PeerAnnouncement| p.peer_id == peer_id) {
                        peers.push(PeerAnnouncement { peer_id, display_name, port: info.get_port() });
                    }
                }
            }
            Err(_) => break,
        }
    }
    if let Err(e) = daemon.stop_browse(SERVICE_TYPE) {
        tracing::warn!("Failed to stop mDNS browse: {}", e);
    }
    Ok(peers)
}
