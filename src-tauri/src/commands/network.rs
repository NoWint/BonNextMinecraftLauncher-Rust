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
    let service_type = "_bonnext._tcp.local.";

    let daemon = mdns_sd::ServiceDaemon::new()
        .map_err(|e| LauncherError::Other(format!("mDNS init failed: {}", e)))?;

    let receiver = daemon
        .browse(service_type)
        .map_err(|e| LauncherError::Other(format!("mDNS browse failed: {}", e)))?;

    let mut peers = Vec::new();
    let timeout = Duration::from_secs(3);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        let remaining = timeout.saturating_sub(start.elapsed());
        match receiver.recv_timeout(remaining.min(Duration::from_millis(500))) {
            Ok(event) => match event {
                mdns_sd::ServiceEvent::ServiceResolved(info) => {
                    let addr = info
                        .get_addresses()
                        .iter()
                        .next()
                        .map(|a| a.to_string())
                        .unwrap_or_default();
                    let port = info.get_port();
                    let name = info.get_fullname().to_string();
                    peers.push(P2PPeer {
                        name,
                        address: format!("{}:{}", addr, port),
                        available_bytes: 0,
                    });
                }
                _ => {}
            },
            Err(_) => break,
        }
    }

    if let Err(e) = daemon.stop_browse(service_type) {
        tracing::warn!("Failed to stop mDNS browse: {}", e);
    }

    Ok(peers)
}

#[tauri::command]
pub async fn send_file_p2p(
    peer_address: String,
    file_path: String,
) -> Result<(), LauncherError> {
    use std::io::{Read, Write};
    use std::net::TcpStream;

    let file = std::fs::File::open(&file_path).map_err(|e| LauncherError::Io(e))?;
    let file_size = file.metadata().map(|m| m.len()).unwrap_or(0);
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut stream = TcpStream::connect(&peer_address)
        .map_err(|e| LauncherError::Other(format!("Failed to connect to peer: {}", e)))?;

    let name_bytes = file_name.as_bytes();
    stream
        .write_all(&(name_bytes.len() as u64).to_le_bytes())
        .map_err(|e| LauncherError::Other(format!("Write failed: {}", e)))?;
    stream
        .write_all(name_bytes)
        .map_err(|e| LauncherError::Other(format!("Write failed: {}", e)))?;
    stream
        .write_all(&file_size.to_le_bytes())
        .map_err(|e| LauncherError::Other(format!("Write failed: {}", e)))?;

    let mut reader = std::io::BufReader::new(file);
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = reader.read(&mut buffer).map_err(|e| LauncherError::Io(e))?;
        if bytes_read == 0 {
            break;
        }
        stream
            .write_all(&buffer[..bytes_read])
            .map_err(|e| LauncherError::Other(format!("Write failed: {}", e)))?;
    }

    tracing::info!(
        "P2P send complete: {} ({} bytes) -> {}",
        file_name,
        file_size,
        peer_address
    );
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
