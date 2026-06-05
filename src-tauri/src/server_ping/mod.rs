pub mod models;
pub mod protocol;
pub mod servers_dat;
pub mod srv;

use crate::error::LauncherError;
use crate::mod_scanner::cache_db::ModCacheDb;
use models::*;
use rusqlite::params;

pub async fn ping_server_cmd(
    address: String,
    port: u16,
    timeout_ms: u32,
) -> Result<(MinecraftServerInfo, u64), LauncherError> {
    let resolved = srv::resolve_srv(&address).await.ok().flatten();
    let (connect_addr, connect_port) = match resolved {
        Some((h, p)) => (h, p),
        None => (address.clone(), port),
    };
    // Use original address/port in handshake, resolved address/port for TCP connection
    let start = std::time::Instant::now();
    match protocol::ping_server(&connect_addr, connect_port, &address, port, timeout_ms).await {
        Ok(info) => {
            let latency = start.elapsed().as_millis() as u64;
            Ok((info, latency))
        }
        Err(_) => Err(LauncherError::ServerPing("Ping failed".to_string())),
    }
}

pub async fn batch_ping_servers(
    servers: Vec<(String, u16)>,
    timeout_ms: u32,
) -> Vec<Option<(MinecraftServerInfo, u64)>> {
    let mut results = Vec::with_capacity(servers.len());
    for (addr, port) in servers {
        let result = ping_server_cmd(addr, port, timeout_ms).await.ok();
        results.push(result);
    }
    results
}

pub fn list_servers(db: &ModCacheDb) -> Result<Vec<ServerListEntry>, LauncherError> {
    let conn = db.get_conn()?;
    let mut stmt = conn
        .prepare("SELECT id, name, address, port, is_favorite, last_ping_result, last_ping_at, latency_ms, icon_base64, notes FROM servers ORDER BY is_favorite DESC, name ASC")
        .map_err(|e| LauncherError::Database(format!("Prepare failed: {}", e)))?;
    let entries = stmt
        .query_map([], |row| {
            let ping_result_str: Option<String> = row.get(5)?;
            let ping_result: Option<MinecraftServerInfo> = ping_result_str.as_deref().and_then(|s| serde_json::from_str(s).ok());
            Ok(ServerListEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                address: row.get(2)?,
                port: row.get(3)?,
                is_favorite: row.get::<_, i32>(4)? != 0,
                last_ping_result: ping_result,
                last_ping_at: row.get(6)?,
                latency_ms: row.get(7)?,
                icon_base64: row.get(8)?,
                notes: row.get(9)?,
            })
        })
        .map_err(|e| LauncherError::Database(format!("Query failed: {}", e)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| LauncherError::Database(format!("Row mapping failed: {}", e)))?;
    Ok(entries)
}

pub fn add_server(db: &ModCacheDb, name: &str, address: &str, port: u16) -> Result<i64, LauncherError> {
    let conn = db.get_conn()?;
    conn.execute("INSERT INTO servers (name, address, port) VALUES (?1, ?2, ?3)", params![name, address, port])
        .map_err(|e| LauncherError::Database(format!("Insert server failed: {}", e)))?;
    Ok(conn.last_insert_rowid())
}

pub fn remove_server(db: &ModCacheDb, id: i64) -> Result<(), LauncherError> {
    let conn = db.get_conn()?;
    conn.execute("DELETE FROM servers WHERE id = ?1", params![id])
        .map_err(|e| LauncherError::Database(format!("Delete server failed: {}", e)))?;
    Ok(())
}

pub fn toggle_favorite(db: &ModCacheDb, id: i64, favorite: bool) -> Result<(), LauncherError> {
    let conn = db.get_conn()?;
    conn.execute("UPDATE servers SET is_favorite = ?1 WHERE id = ?2", params![favorite as i32, id])
        .map_err(|e| LauncherError::Database(format!("Toggle favorite failed: {}", e)))?;
    Ok(())
}

pub fn update_server_ping(db: &ModCacheDb, id: i64, result: &Option<MinecraftServerInfo>, latency_ms: Option<i64>) -> Result<(), LauncherError> {
    let conn = db.get_conn()?;
    let json = result.as_ref().map(|r| serde_json::to_string(r).unwrap_or_default());
    let icon = result.as_ref().and_then(|r| r.favicon.clone());
    let now = chrono::Utc::now().timestamp();
    conn.execute("UPDATE servers SET last_ping_result = ?1, last_ping_at = ?2, latency_ms = ?3, icon_base64 = ?4 WHERE id = ?5", params![json, now, latency_ms, icon, id])
        .map_err(|e| LauncherError::Database(format!("Update ping result failed: {}", e)))?;
    Ok(())
}
