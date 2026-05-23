use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

static LAN_DISCOVERY_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanWorldInfo {
    pub host: String,
    pub port: u16,
    pub motd: String,
    pub world_type: Option<String>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct P2PPeer {
    pub name: String,
    pub address: String,
    pub available_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebApiStatus {
    pub running: bool,
    pub port: u16,
    pub token: String,
}

#[tauri::command]
pub async fn start_lan_discovery() -> Result<(), LauncherError> {
    if LAN_DISCOVERY_ACTIVE.load(Ordering::SeqCst) {
        return Ok(());
    }
    LAN_DISCOVERY_ACTIVE.store(true, Ordering::SeqCst);
    tracing::info!("LAN discovery started");
    Ok(())
}

#[tauri::command]
pub async fn stop_lan_discovery() -> Result<(), LauncherError> {
    LAN_DISCOVERY_ACTIVE.store(false, Ordering::SeqCst);
    tracing::info!("LAN discovery stopped");
    Ok(())
}

#[tauri::command]
pub async fn get_lan_worlds() -> Result<Vec<LanWorldInfo>, LauncherError> {
    if !LAN_DISCOVERY_ACTIVE.load(Ordering::SeqCst) {
        return Ok(Vec::new());
    }

    let socket = UdpSocket::bind("0.0.0.0:4445")
        .map_err(|e| LauncherError::Other(format!("Failed to bind UDP socket: {}", e)))?;
    socket
        .set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|e| LauncherError::Other(format!("Failed to set read timeout: {}", e)))?;
    socket
        .set_broadcast(true)
        .map_err(|e| LauncherError::Other(format!("Failed to set broadcast: {}", e)))?;

    let multicast_addr = Ipv4Addr::new(224, 0, 2, 60);
    if let Err(e) = socket.join_multicast_v4(&multicast_addr, &Ipv4Addr::UNSPECIFIED) {
        tracing::warn!("Failed to join multicast group (non-fatal): {}", e);
    }

    let mut worlds = Vec::new();
    let mut buf = [0u8; 4096];

    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(3) {
        match socket.recv_from(&mut buf) {
            Ok((len, addr)) => {
                let data = String::from_utf8_lossy(&buf[..len]);
                if let Some(world) = parse_lan_broadcast(&data, addr.ip().to_string()) {
                    if !worlds
                        .iter()
                        .any(|w: &LanWorldInfo| w.host == world.host && w.port == world.port)
                    {
                        worlds.push(world);
                    }
                }
            }
            Err(_) => break,
        }
    }

    if let Err(e) = socket.leave_multicast_v4(&multicast_addr, &Ipv4Addr::UNSPECIFIED) {
        tracing::warn!("Failed to leave multicast group: {}", e);
    }

    Ok(worlds)
}

fn parse_lan_broadcast(data: &str, host: String) -> Option<LanWorldInfo> {
    let parts: Vec<&str> = data.split('§').collect();
    if parts.len() >= 2 {
        let motd = parts[0].trim().to_string();
        let port: u16 = parts[1].trim().parse().ok()?;
        let world_type = parts.get(2).map(|s| s.trim().to_string());
        Some(LanWorldInfo {
            host,
            port,
            motd,
            world_type,
            players_online: None,
            players_max: None,
        })
    } else {
        None
    }
}

#[tauri::command]
pub async fn scan_p2p_peers() -> Result<Vec<P2PPeer>, LauncherError> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn send_file_p2p(
    peer_address: String,
    file_path: String,
) -> Result<(), LauncherError> {
    tracing::info!("P2P send: {} -> {}", file_path, peer_address);
    Ok(())
}

#[tauri::command]
pub async fn get_web_api_status() -> Result<WebApiStatus, LauncherError> {
    Ok(WebApiStatus {
        running: false,
        port: 0,
        token: String::new(),
    })
}
