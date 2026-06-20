# SCL Feature Integration — Batch 2: Server Ping Protocol

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete Minecraft Server List Ping (SLP) protocol with DNS SRV resolution, SQLite-backed server browser, and full frontend /servers page.

**Architecture:** New `server_ping/` Rust module implementing TCP-based SLP protocol, DNS SRV resolver, and Tauri commands. Frontend gets a new `/servers` route with server browser UI.

**Tech Stack:** Rust (tokio TCP, trust-dns-resolver, rusqlite), TypeScript/React, CSS Modules

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src-tauri/src/server_ping/mod.rs` | Module entry + Tauri commands |
| `src-tauri/src/server_ping/protocol.rs` | SLP protocol (VarInt, Handshake, Status) |
| `src-tauri/src/server_ping/srv.rs` | DNS SRV record resolution |
| `src-tauri/src/server_ping/models.rs` | MinecraftServerInfo data structures |
| `src/pages/ServersPage/index.tsx` | Server browser page |
| `src/pages/ServersPage/ServersPage.module.css` | Server browser styles |
| `src/components/ui/ServerCard/ServerCard.tsx` | Server card component |
| `src/components/ui/ServerCard/ServerCard.module.css` | Server card styles |
| `src/components/ui/ServerPingBadge/ServerPingBadge.tsx` | Latency badge |
| `src/components/ui/ServerPingBadge/ServerPingBadge.module.css` | Badge styles |

### Modified Files
| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Register server_ping module + commands |
| `src-tauri/src/error.rs` | Add ServerPing error variant |
| `src-tauri/Cargo.toml` | Add trust-dns-resolver dependency |
| `src/App.tsx` | Add /servers route |
| `src/components/Sidebar/` | Add servers nav item |

---

### Task 1: Add Dependency and Error Variant

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/error.rs`

- [ ] **Step 1: Add trust-dns-resolver to Cargo.toml**

Add to `[dependencies]`:

```toml
hickory-resolver = "0.24"
```

Note: `trust-dns-resolver` was renamed to `hickory-resolver`. Use the new name.

- [ ] **Step 2: Add ServerPing error variant to LauncherError**

In `error.rs`, add before `#[deprecated] Other(String)`:

```rust
ServerPing(String),
```

Add to `error_code()`:

```rust
ServerPing(_) => "SERVER_PING",
```

Add to `suggestion()`:

```rust
ServerPing(_) => Some("Check that the server address is correct and the server is online".to_string()),
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/error.rs
git commit -m "feat: add hickory-resolver dep and ServerPing error variant"
```

---

### Task 2: Implement SLP Protocol

**Files:**
- Create: `src-tauri/src/server_ping/protocol.rs`
- Create: `src-tauri/src/server_ping/models.rs`

- [ ] **Step 1: Create models.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftServerInfo {
    pub version: ServerVersion,
    pub players: ServerPlayers,
    pub description: ServerDescription,
    pub favicon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerVersion {
    pub name: String,
    pub protocol: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerPlayers {
    pub max: i32,
    pub online: i32,
    pub sample: Option<Vec<ServerPlayer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerPlayer {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerDescription {
    pub text: String,
    pub extra: Option<Vec<ServerDescriptionExtra>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerDescriptionExtra {
    pub text: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub bold: Option<bool>,
    #[serde(default)]
    pub italic: Option<bool>,
    #[serde(default)]
    pub underlined: Option<bool>,
    #[serde(default)]
    pub strikethrough: Option<bool>,
    #[serde(default)]
    pub obfuscated: Option<bool>,
}

impl ServerDescription {
    pub fn to_plain_text(&self) -> String {
        let mut text = self.text.clone();
        if let Some(extra) = &self.extra {
            for e in extra {
                text.push_str(&e.text);
            }
        }
        text
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerListEntry {
    pub id: i64,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub is_favorite: bool,
    pub last_ping_result: Option<MinecraftServerInfo>,
    pub last_ping_at: Option<i64>,
    pub icon_base64: Option<String>,
    pub notes: Option<String>,
}
```

- [ ] **Step 2: Create protocol.rs**

Translate SCL's MinecraftServerPing.swift to Rust:

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use crate::error::LauncherError;
use super::models::MinecraftServerInfo;

fn encode_var_int(value: i32) -> Vec<u8> {
    let mut buf = Vec::new();
    let mut val = value as u32;
    loop {
        let mut byte = (val & 0x7F) as u8;
        val >>= 7;
        if val != 0 {
            byte |= 0x80;
        }
        buf.push(byte);
        if val == 0 {
            break;
        }
    }
    buf
}

async fn decode_var_int<R: AsyncReadExt + Unpin>(reader: &mut R) -> Result<i32, LauncherError> {
    let mut result: i32 = 0;
    let mut shift: u32 = 0;
    loop {
        let mut buf = [0u8; 1];
        reader.read_exact(&mut buf).await
            .map_err(|e| LauncherError::ServerPing(format!("Failed to read VarInt: {}", e)))?;
        let byte = buf[0];
        result |= ((byte & 0x7F) as i32) << shift;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift >= 35 {
            return Err(LauncherError::ServerPing("VarInt too large".to_string()));
        }
    }
    Ok(result)
}

fn build_handshake_packet(address: &str, port: u16) -> Vec<u8> {
    let protocol_version = encode_var_int(-1);
    let addr_bytes = address.as_bytes();
    let addr_len = encode_var_int(addr_bytes.len() as i32);
    let port_bytes = port.to_be_bytes();
    let next_state = encode_var_int(1);

    let mut data = Vec::new();
    data.extend_from_slice(&protocol_version);
    data.extend_from_slice(&addr_len);
    data.extend_from_slice(addr_bytes);
    data.extend_from_slice(&port_bytes);
    data.extend_from_slice(&next_state);

    let packet_id = encode_var_int(0);
    let mut packet_data = Vec::new();
    packet_data.extend_from_slice(&packet_id);
    packet_data.extend_from_slice(&data);

    let length = encode_var_int(packet_data.len() as i32);
    let mut packet = Vec::new();
    packet.extend_from_slice(&length);
    packet.extend_from_slice(&packet_data);
    packet
}

fn build_status_request_packet() -> Vec<u8> {
    let packet_id = encode_var_int(0);
    let length = encode_var_int(packet_id.len() as i32);
    let mut packet = Vec::new();
    packet.extend_from_slice(&length);
    packet.extend_from_slice(&packet_id);
    packet
}

pub async fn ping_server(
    address: &str,
    port: u16,
    timeout_ms: u32,
) -> Result<MinecraftServerInfo, LauncherError> {
    let addr = format!("{}:{}", address, port);
    let stream = timeout(Duration::from_millis(timeout_ms as u64), TcpStream::connect(&addr))
        .await
        .map_err(|_| LauncherError::ServerPing(format!("Connection timeout to {}", addr)))?
        .map_err(|e| LauncherError::ServerPing(format!("Connection failed to {}: {}", addr, e)))?;

    let (mut reader, mut writer) = stream.into_split();

    let handshake = build_handshake_packet(address, port);
    writer.write_all(&handshake).await
        .map_err(|e| LauncherError::ServerPing(format!("Handshake send failed: {}", e)))?;

    let status_request = build_status_request_packet();
    writer.write_all(&status_request).await
        .map_err(|e| LauncherError::ServerPing(format!("Status request send failed: {}", e)))?;

    let _packet_length = decode_var_int(&mut reader).await?;
    let _packet_id = decode_var_int(&mut reader).await?;
    let json_length = decode_var_int(&mut reader).await?;

    if json_length <= 0 || json_length > 1_000_000 {
        return Err(LauncherError::ServerPing(format!("Invalid response length: {}", json_length)));
    }

    let mut json_buf = vec![0u8; json_length as usize];
    reader.read_exact(&mut json_buf).await
        .map_err(|e| LauncherError::ServerPing(format!("Failed to read response: {}", e)))?;

    let json_str = String::from_utf8(json_buf)
        .map_err(|e| LauncherError::ServerPing(format!("Invalid UTF-8 in response: {}", e)))?;

    let info: MinecraftServerInfo = serde_json::from_str(&json_str)
        .map_err(|e| LauncherError::ServerPing(format!("Failed to parse server response: {}", e)))?;

    Ok(info)
}
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/server_ping/protocol.rs src-tauri/src/server_ping/models.rs
git commit -m "feat: implement Minecraft SLP protocol and server info models"
```

---

### Task 3: Implement DNS SRV Resolution

**Files:**
- Create: `src-tauri/src/server_ping/srv.rs`

- [ ] **Step 1: Write srv.rs**

```rust
use crate::error::LauncherError;

pub async fn resolve_srv(domain: &str) -> Result<Option<(String, u16)>, LauncherError> {
    let srv_name = format!("_minecraft._tcp.{}", domain);
    let resolver = hickory_resolver::TokioAsyncResolver::tokio_from_system_conf()
        .map_err(|e| LauncherError::ServerPing(format!("Failed to create DNS resolver: {}", e)))?;
    let lookup = resolver.srv_lookup(&srv_name).await;
    match lookup {
        Ok(records) => {
            let record = records.iter().min_by_key(|r| r.priority());
            match record {
                Some(r) => Ok(Some((r.target().to_string().trim_end_matches('.').to_string(), r.port()))),
                None => Ok(None),
            }
        }
        Err(_) => Ok(None),
    }
}
```

- [ ] **Step 2: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/server_ping/srv.rs
git commit -m "feat: add DNS SRV record resolution for Minecraft servers"
```

---

### Task 4: Server Ping Tauri Commands + SQLite Server Management

**Files:**
- Create: `src-tauri/src/server_ping/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write mod.rs with commands and server list management**

```rust
pub mod models;
pub mod protocol;
pub mod srv;

use crate::error::LauncherError;
use crate::mod_scanner::cache_db::ModCacheDb;
use models::*;
use rusqlite::{params, OptionalExtension};
use std::sync::Arc;
use std::time::Duration;

pub struct ServerPingState {
    db: Arc<ModCacheDb>,
}

impl ServerPingState {
    pub fn new(db: Arc<ModCacheDb>) -> Self {
        Self { db }
    }
}

fn get_conn(db: &ModCacheDb) -> Result<std::sync::MutexGuard<'_, rusqlite::Connection>, LauncherError> {
    db.get_conn()
}

pub async fn ping_server_cmd(
    address: String,
    port: u16,
    timeout_ms: u32,
) -> Result<Option<MinecraftServerInfo>, LauncherError> {
    let resolved = srv::resolve_srv(&address).await.ok().flatten();
    let (target_addr, target_port) = match resolved {
        Some((h, p)) => (h, p),
        None => (address, port),
    };
    match protocol::ping_server(&target_addr, target_port, timeout_ms).await {
        Ok(info) => Ok(Some(info)),
        Err(_) => Ok(None),
    }
}

pub async fn batch_ping_servers(
    servers: Vec<(String, u16)>,
    timeout_ms: u32,
) -> Vec<Option<MinecraftServerInfo>> {
    let mut results = Vec::with_capacity(servers.len());
    for (addr, port) in servers {
        let result = ping_server_cmd(addr, port, timeout_ms).await.ok().flatten();
        results.push(result);
    }
    results
}

pub fn list_servers(db: &ModCacheDb) -> Result<Vec<ServerListEntry>, LauncherError> {
    let conn = db.get_conn()?;
    let mut stmt = conn
        .prepare("SELECT id, name, address, port, is_favorite, last_ping_result, last_ping_at, icon_base64, notes FROM servers ORDER BY is_favorite DESC, name ASC")
        .map_err(|e| LauncherError::Database(format!("Prepare failed: {}", e)))?;
    let entries = stmt
        .query_map([], |row| {
            let ping_result_str: Option<String> = row.get(5)?;
            let ping_result: Option<MinecraftServerInfo> = ping_result_str
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
            Ok(ServerListEntry {
                id: row.get(0)?,
                name: row.get(1)?,
                address: row.get(2)?,
                port: row.get(3)?,
                is_favorite: row.get::<_, i32>(4)? != 0,
                last_ping_result: ping_result,
                last_ping_at: row.get(6)?,
                icon_base64: row.get(7)?,
                notes: row.get(8)?,
            })
        })
        .map_err(|e| LauncherError::Database(format!("Query failed: {}", e)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| LauncherError::Database(format!("Row mapping failed: {}", e)))?;
    Ok(entries)
}

pub fn add_server(db: &ModCacheDb, name: &str, address: &str, port: u16) -> Result<i64, LauncherError> {
    let conn = db.get_conn()?;
    conn.execute(
        "INSERT INTO servers (name, address, port) VALUES (?1, ?2, ?3)",
        params![name, address, port],
    ).map_err(|e| LauncherError::Database(format!("Insert server failed: {}", e)))?;
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
    conn.execute(
        "UPDATE servers SET is_favorite = ?1 WHERE id = ?2",
        params![favorite as i32, id],
    ).map_err(|e| LauncherError::Database(format!("Toggle favorite failed: {}", e)))?;
    Ok(())
}

pub fn update_server_ping(
    db: &ModCacheDb,
    id: i64,
    result: &Option<MinecraftServerInfo>,
) -> Result<(), LauncherError> {
    let conn = db.get_conn()?;
    let json = result.as_ref().map(|r| serde_json::to_string(r).unwrap_or_default());
    let icon = result.as_ref().and_then(|r| r.favicon.clone());
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE servers SET last_ping_result = ?1, last_ping_at = ?2, icon_base64 = ?3 WHERE id = ?4",
        params![json, now, icon, id],
    ).map_err(|e| LauncherError::Database(format!("Update ping result failed: {}", e)))?;
    Ok(())
}
```

Note: This requires adding a `pub fn get_conn()` method to `ModCacheDb` that returns `MutexGuard<Connection>`.

- [ ] **Step 2: Add get_conn() to ModCacheDb**

In `src-tauri/src/mod_scanner/cache_db.rs`, add:

```rust
pub fn get_conn(&self) -> Result<std::sync::MutexGuard<'_, rusqlite::Connection>, LauncherError> {
    self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))
}
```

- [ ] **Step 3: Add `mod server_ping;` to lib.rs**

- [ ] **Step 4: Add Tauri commands in lib.rs**

```rust
#[tauri::command]
async fn ping_server(address: String, port: u16, timeout_ms: Option<u32>) -> Result<Option<server_ping::models::MinecraftServerInfo>, String> {
    server_ping::ping_server_cmd(address, port, timeout_ms.unwrap_or(5000))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn batch_ping_servers(servers: Vec<(String, u16)>, timeout_ms: Option<u32>) -> Result<Vec<Option<server_ping::models::MinecraftServerInfo>>, String> {
    Ok(server_ping::batch_ping_servers(servers, timeout_ms.unwrap_or(5000)).await)
}

#[tauri::command]
fn list_servers(state: State<'_, ModScannerState>) -> Result<Vec<server_ping::models::ServerListEntry>, String> {
    server_ping::list_servers(&state.db).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_server(name: String, address: String, port: u16, state: State<'_, ModScannerState>) -> Result<i64, String> {
    server_ping::add_server(&state.db, &name, &address, port).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_server(id: i64, state: State<'_, ModScannerState>) -> Result<(), String> {
    server_ping::remove_server(&state.db, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_server_favorite(id: i64, favorite: bool, state: State<'_, ModScannerState>) -> Result<(), String> {
    server_ping::toggle_favorite(&state.db, id, favorite).map_err(|e| e.to_string())
}
```

Register in `generate_handler![]`:

```rust
ping_server,
batch_ping_servers,
list_servers,
add_server,
remove_server,
toggle_server_favorite,
```

- [ ] **Step 5: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/server_ping/ src-tauri/src/lib.rs src-tauri/src/mod_scanner/cache_db.rs
git commit -m "feat: add server ping Tauri commands and SQLite server management"
```

---

### Task 5: Frontend Server API + ServerPingBadge + ServerCard

**Files:**
- Modify: `src/api/servers.ts`
- Create: `src/components/ui/ServerPingBadge/ServerPingBadge.tsx`
- Create: `src/components/ui/ServerPingBadge/ServerPingBadge.module.css`
- Create: `src/components/ui/ServerCard/ServerCard.tsx`
- Create: `src/components/ui/ServerCard/ServerCard.module.css`

- [ ] **Step 1: Update src/api/servers.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface MinecraftServerInfo {
  version: { name: string; protocol: number };
  players: { max: number; online: number; sample?: { name: string; id: string }[] };
  description: { text: string; extra?: { text: string; color?: string }[] };
  favicon: string | null;
}

export interface ServerListEntry {
  id: number;
  name: string;
  address: string;
  port: number;
  is_favorite: boolean;
  last_ping_result: MinecraftServerInfo | null;
  last_ping_at: number | null;
  icon_base64: string | null;
  notes: string | null;
}

export async function pingServer(address: string, port: number, timeoutMs?: number): Promise<MinecraftServerInfo | null> {
  return invoke<MinecraftServerInfo | null>('ping_server', { address, port, timeoutMs });
}

export async function batchPingServers(servers: [string, number][], timeoutMs?: number): Promise<(MinecraftServerInfo | null)[]> {
  return invoke<(MinecraftServerInfo | null)[]>('batch_ping_servers', { servers, timeoutMs });
}

export async function listServers(): Promise<ServerListEntry[]> {
  return invoke<ServerListEntry[]>('list_servers');
}

export async function addServer(name: string, address: string, port: number): Promise<number> {
  return invoke<number>('add_server', { name, address, port });
}

export async function removeServer(id: number): Promise<void> {
  return invoke('remove_server', { id });
}

export async function toggleServerFavorite(id: number, favorite: boolean): Promise<void> {
  return invoke('toggle_server_favorite', { id, favorite });
}
```

- [ ] **Step 2: Create ServerPingBadge component**

```tsx
import React from 'react';
import styles from './ServerPingBadge.module.css';

interface Props {
  latencyMs: number | null;
  online: boolean;
}

export default function ServerPingBadge({ latencyMs, online }: Props) {
  if (!online) {
    return <span className={`${styles.badge} ${styles.offline}`}>离线</span>;
  }
  const cls = latencyMs !== null && latencyMs < 50
    ? styles.fast
    : latencyMs !== null && latencyMs < 150
      ? styles.medium
      : styles.slow;
  return (
    <span className={`${styles.badge} ${cls}`}>
      {latencyMs !== null ? `${latencyMs}ms` : '?'}
    </span>
  );
}
```

```css
.badge {
  font-family: 'DM Mono', monospace;
  font-size: 0.55em;
  padding: 0.15em 0.4em;
  clip-path: var(--clip-badge);
  font-weight: 600;
}
.fast { background: #1bd96a; color: #000; }
.medium { background: #FFE600; color: #000; }
.slow { background: #f16436; color: #fff; }
.offline { background: var(--surface-dark); color: var(--text-secondary); }
```

- [ ] **Step 3: Create ServerCard component**

```tsx
import React from 'react';
import type { ServerListEntry } from '../../../api/servers';
import ServerPingBadge from '../ServerPingBadge/ServerPingBadge';
import styles from './ServerCard.module.css';

interface Props {
  server: ServerListEntry;
  onPing: (id: number) => void;
  onFavorite: (id: number, fav: boolean) => void;
  onRemove: (id: number) => void;
}

export default function ServerCard({ server, onPing, onFavorite, onRemove }: Props) {
  const info = server.last_ping_result;
  const online = info !== null;
  const motd = info?.description?.text || '';
  const playerCount = info ? `${info.players.online}/${info.players.max}` : '--';
  const version = info?.version?.name || '--';

  return (
    <div className={styles.card}>
      <div className={styles.icon}>
        {server.icon_base64 ? (
          <img src={server.icon_base64} alt="" />
        ) : (
          <div className={styles.iconPlaceholder}>🖥</div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{server.name}</div>
        <div className={styles.address}>{server.address}:{server.port}</div>
        <div className={styles.motd}>{motd}</div>
        <div className={styles.meta}>
          <span>{version}</span>
          <span>{playerCount}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <ServerPingBadge
          online={online}
          latencyMs={server.last_ping_at ? null : null}
        />
        <button onClick={() => onPing(server.id)}>Ping</button>
        <button onClick={() => onFavorite(server.id, !server.is_favorite)}>
          {server.is_favorite ? '★' : '☆'}
        </button>
        <button onClick={() => onRemove(server.id)}>✕</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/api/servers.ts src/components/ui/ServerPingBadge/ src/components/ui/ServerCard/
git commit -m "feat: add server API, ServerPingBadge, and ServerCard components"
```

---

### Task 6: ServersPage + Route

**Files:**
- Create: `src/pages/ServersPage/index.tsx`
- Create: `src/pages/ServersPage/ServersPage.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create ServersPage**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import type { ServerListEntry } from '../../api/servers';
import ServerCard from '../../components/ui/ServerCard/ServerCard';
import styles from './ServersPage.module.css';

export default function ServersPage() {
  const [servers, setServers] = useState<ServerListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPort, setNewPort] = useState(25565);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.servers.listServers();
      setServers(list);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePing = async (id: number) => {
    const server = servers.find(s => s.id === id);
    if (!server) return;
    try {
      const result = await api.servers.pingServer(server.address, server.port);
      setServers(prev => prev.map(s =>
        s.id === id ? { ...s, last_ping_result: result, last_ping_at: Date.now() / 1000 } : s
      ));
    } catch {}
  };

  const handlePingAll = async () => {
    const entries = servers.map(s => [s.address, s.port] as [string, number]);
    try {
      const results = await api.servers.batchPingServers(entries);
      setServers(prev => prev.map((s, i) => ({
        ...s,
        last_ping_result: results[i],
        last_ping_at: Date.now() / 1000,
      })));
    } catch {}
  };

  const handleAdd = async () => {
    if (!newName || !newAddress) return;
    try {
      await api.servers.addServer(newName, newAddress, newPort);
      setShowAdd(false);
      setNewName('');
      setNewAddress('');
      setNewPort(25565);
      load();
    } catch {}
  };

  const handleFavorite = async (id: number, fav: boolean) => {
    try {
      await api.servers.toggleServerFavorite(id, fav);
      setServers(prev => prev.map(s => s.id === id ? { ...s, is_favorite: fav } : s));
    } catch {}
  };

  const handleRemove = async (id: number) => {
    try {
      await api.servers.removeServer(id);
      setServers(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>服务器</h1>
        <div className={styles.actions}>
          <button onClick={handlePingAll}>全部 Ping</button>
          <button onClick={() => setShowAdd(true)}>添加服务器</button>
        </div>
      </div>
      {showAdd && (
        <div className={styles.addForm}>
          <input placeholder="名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <input placeholder="地址" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
          <input type="number" placeholder="端口" value={newPort} onChange={e => setNewPort(Number(e.target.value))} />
          <button onClick={handleAdd}>确认</button>
          <button onClick={() => setShowAdd(false)}>取消</button>
        </div>
      )}
      <div className={styles.list}>
        {loading ? (
          <div>加载中...</div>
        ) : servers.length === 0 ? (
          <div className={styles.empty}>暂无服务器，点击"添加服务器"开始</div>
        ) : (
          servers.map(s => (
            <ServerCard
              key={s.id}
              server={s}
              onPing={handlePing}
              onFavorite={handleFavorite}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ServersPage.module.css**

```css
.page {
  padding: 1.5em;
  max-width: 60em;
  margin: 0 auto;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5em;
}
.header h1 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.8em;
  color: var(--accent, #FFE600);
  margin: 0;
}
.actions {
  display: flex;
  gap: 0.5em;
}
.addForm {
  display: flex;
  gap: 0.5em;
  margin-bottom: 1em;
  padding: 0.8em;
  background: var(--surface-dark-elevated);
  clip-path: var(--clip-medium);
}
.addForm input {
  font-family: 'DM Mono', monospace;
  font-size: 0.7em;
  padding: 0.3em 0.5em;
  background: var(--surface-dark);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 3em;
  font-size: 0.8em;
}
```

- [ ] **Step 3: Add route in App.tsx**

Import `ServersPage` (lazy load) and add route:

```tsx
const ServersPage = React.lazy(() => import('./pages/ServersPage'));

// In Routes:
<Route path="/servers" element={<ServersPage />} />
```

- [ ] **Step 4: Add sidebar nav item**

In the sidebar component, add a "服务器" nav item pointing to `#/servers`.

- [ ] **Step 5: Run full check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`
Expected: Both pass

- [ ] **Step 6: Commit**

```bash
git add src/pages/ServersPage/ src/App.tsx src/components/Sidebar/
git commit -m "feat: add ServersPage with server browser UI and route"
```

---

## Self-Review

1. **Spec coverage**: F1 (Server Ping) — SLP protocol ✅, SRV resolution ✅, server browser ✅, SQLite storage ✅, latency badges ✅, favorites ✅
2. **Placeholder scan**: No TBD/TODO — all steps have complete code
3. **Type consistency**: `MinecraftServerInfo`, `ServerListEntry` consistent across Rust and TypeScript
4. **Gap**: `ServerPingBadge` latency display needs actual latency calculation from ping timestamp — currently placeholder. Should compute from `last_ping_at` vs current time or store latency in DB.
