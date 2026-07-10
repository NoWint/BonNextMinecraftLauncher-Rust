use crate::error::LauncherError;
use crate::web_api::WebApiServer;
use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

static LAN_DISCOVERY_ACTIVE: AtomicBool = AtomicBool::new(false);

static WEB_API_SERVER: std::sync::OnceLock<Arc<Mutex<Option<Arc<WebApiServer>>>>> =
    std::sync::OnceLock::new();

fn web_api_state() -> &'static Arc<Mutex<Option<Arc<WebApiServer>>>> {
    WEB_API_SERVER.get_or_init(|| Arc::new(Mutex::new(None)))
}

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

    let socket = UdpSocket::bind("0.0.0.0:4445")?;
    socket
        .set_read_timeout(Some(Duration::from_millis(500)))?;
    socket
        .set_broadcast(true)?;

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
pub async fn get_web_api_status() -> Result<WebApiStatus, LauncherError> {
    let state = web_api_state().lock().await;
    match state.as_ref() {
        Some(server) => Ok(WebApiStatus {
            running: true,
            port: server.port,
            token: server.token.clone(),
        }),
        None => Ok(WebApiStatus {
            running: false,
            port: 0,
            token: String::new(),
        }),
    }
}

#[tauri::command]
pub async fn start_web_api(port: u16) -> Result<WebApiStatus, LauncherError> {
    let mut state = web_api_state().lock().await;
    if state.is_some() {
        let server = state.as_ref().unwrap();
        return Ok(WebApiStatus {
            running: true,
            port: server.port,
            token: server.token.clone(),
        });
    }
    let server = Arc::new(WebApiServer::new(port));
    let status = WebApiStatus {
        running: true,
        port: server.port,
        token: server.token.clone(),
    };
    let server_clone = Arc::clone(&server);
    *state = Some(server);
    drop(state);

    tokio::spawn(async move {
        if let Err(e) = server_clone.start().await {
            tracing::error!("Web API server error: {}", e);
            let mut s = web_api_state().lock().await;
            *s = None;
        }
    });

    tracing::info!("Web API server started on port {}", port);
    Ok(status)
}

#[tauri::command]
pub async fn stop_web_api() -> Result<(), LauncherError> {
    let mut state = web_api_state().lock().await;
    if state.is_some() {
        *state = None;
        tracing::info!("Web API server stopped");
    }
    Ok(())
}
