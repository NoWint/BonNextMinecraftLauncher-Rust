use std::sync::Arc;

use crate::error::LauncherError;
use crate::mod_scanner::cache_db::ModCacheDb;
use crate::platform::paths;
use crate::server_ping;
use crate::server_ping::models::{MinecraftServerInfo, ServerListEntry};
use crate::server_ping::servers_dat::{self, ServerAddress};
use serde::Serialize;

#[derive(Serialize)]
pub struct PingResult {
    pub info: MinecraftServerInfo,
    pub latency_ms: u64,
}

#[tauri::command]
pub async fn ping_server_info(
    address: String,
    port: u16,
    timeout_ms: Option<u32>,
) -> Result<PingResult, LauncherError> {
    let timeout = timeout_ms.unwrap_or(5000);
    let (info, latency) = server_ping::ping_server_cmd(address, port, timeout).await?;
    Ok(PingResult { info, latency_ms: latency })
}

#[tauri::command]
pub async fn batch_ping_servers(
    servers: Vec<(String, u16)>,
    timeout_ms: Option<u32>,
) -> Result<Vec<Option<PingResult>>, LauncherError> {
    let timeout = timeout_ms.unwrap_or(5000);
    let results = server_ping::batch_ping_servers(servers, timeout).await;
    Ok(results
        .into_iter()
        .map(|r| r.map(|(info, latency)| PingResult { info, latency_ms: latency }))
        .collect())
}

#[tauri::command]
pub async fn list_servers(
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<Vec<ServerListEntry>, LauncherError> {
    server_ping::list_servers(&db)
}

#[tauri::command]
pub async fn add_server(
    name: String,
    address: String,
    port: u16,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<i64, LauncherError> {
    server_ping::add_server(&db, &name, &address, port)
}

#[tauri::command]
pub async fn remove_server(
    id: i64,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<(), LauncherError> {
    server_ping::remove_server(&db, id)
}

#[tauri::command]
pub async fn toggle_server_favorite(
    id: i64,
    favorite: bool,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<(), LauncherError> {
    server_ping::toggle_favorite(&db, id, favorite)
}

#[tauri::command]
pub async fn update_server_ping(
    id: i64,
    result: Option<MinecraftServerInfo>,
    latency_ms: Option<i64>,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<(), LauncherError> {
    server_ping::update_server_ping(&db, id, &result, latency_ms)
}

#[tauri::command]
pub async fn read_servers_dat(
    instance_id: String,
) -> Result<Vec<ServerAddress>, LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let path = mc_dir.join("servers.dat");
    if !path.exists() {
        return Ok(Vec::new());
    }
    servers_dat::read_servers_dat(&path)
}

#[tauri::command]
pub async fn write_servers_dat(
    instance_id: String,
    servers: Vec<ServerAddress>,
) -> Result<(), LauncherError> {
    let mc_dir = paths::get_instance_minecraft_dir(&instance_id);
    let path = mc_dir.join("servers.dat");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| LauncherError::ServerPing(format!("Failed to create directory: {}", e)))?;
    }
    servers_dat::write_servers_dat(&path, &servers)
}
