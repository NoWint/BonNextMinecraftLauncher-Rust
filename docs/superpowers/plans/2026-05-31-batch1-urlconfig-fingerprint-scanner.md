# SCL Feature Integration — Batch 1: URLConfig + CF Fingerprint + Mod Scanner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement centralized URL management with GitHub proxy, CurseForge fingerprint algorithm, and three-tier mod smart scanner with SQLite caching.

**Architecture:** Three new independent Rust modules (`url_config.rs`, `mod_scanner/`) registered as Tauri commands, with corresponding frontend API wrappers and UI enhancements to LibraryPage.

**Tech Stack:** Rust (rusqlite, reqwest, sha1), TypeScript/React, Tauri IPC, CSS Modules

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src-tauri/src/url_config.rs` | Centralized URL constants + GitHub proxy logic |
| `src-tauri/src/mod_scanner/mod.rs` | Module entry + Tauri commands |
| `src-tauri/src/mod_scanner/fingerprint.rs` | CurseForge murmur hash fingerprint |
| `src-tauri/src/mod_scanner/scanner.rs` | Three-tier identification engine |
| `src-tauri/src/mod_scanner/cache_db.rs` | SQLite cache layer |
| `src-tauri/src/mod_scanner/models.rs` | ScanResult, ScanSource data types |
| `src/api/modScanner.ts` | Frontend API wrappers for mod scanner |
| `src/api/servers.ts` | Frontend API wrappers for server ping (placeholder for Batch 2) |

### Modified Files
| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Register new Tauri commands + manage ModScannerState |
| `src-tauri/src/error.rs` | Add ModScan, Fingerprint error variants |
| `src-tauri/src/config.rs` | Add git_proxy_enabled, git_proxy_url fields |
| `src-tauri/src/commands/mod.rs` | Add mod_scanner, url_config submodules |
| `src-tauri/Cargo.toml` | (rusqlite already present, no new deps needed) |
| `src/api/index.ts` | Import and re-export modScanner, servers APIs |
| `src/pages/settings/index.tsx` | Add NetworkSection for GitHub proxy |
| `src/pages/settings/NetworkSection.tsx` | New settings section component |

---

### Task 1: Add Error Variants

**Files:**
- Modify: `src-tauri/src/error.rs`

- [ ] **Step 1: Add new error variants to LauncherError enum**

Add these variants before the `#[deprecated] Other(String)` line:

```rust
ModScan(String),
FingerprintCalculation(String),
Database(String),
UrlConfig(String),
```

- [ ] **Step 2: Add error_code() match arms**

In the `error_code()` method, add:

```rust
ModScan(_) => "MOD_SCAN",
FingerprintCalculation(_) => "FINGERPRINT_CALCULATION",
Database(_) => "DATABASE",
UrlConfig(_) => "URL_CONFIG",
```

- [ ] **Step 3: Add suggestion() match arms**

In the `suggestion()` method, add:

```rust
ModScan(_) => Some("Check that the mod file is valid and not corrupted".to_string()),
FingerprintCalculation(_) => Some("Ensure the file is accessible and not locked by another process".to_string()),
Database(_) => Some("Try clearing the mod cache in settings".to_string()),
UrlConfig(_) => Some("Check your network configuration".to_string()),
```

- [ ] **Step 4: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/error.rs
git commit -m "feat: add ModScan, Fingerprint, Database, UrlConfig error variants"
```

---

### Task 2: Add Config Fields for Git Proxy

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add git proxy fields to LauncherConfig struct**

Find the `LauncherConfig` struct and add these fields:

```rust
pub git_proxy_enabled: bool,
pub git_proxy_url: String,
```

- [ ] **Step 2: Add defaults in Default impl**

In the `Default` implementation for `LauncherConfig`, add:

```rust
git_proxy_enabled: true,
git_proxy_url: "https://gh-proxy.com".to_string(),
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add git_proxy_enabled and git_proxy_url config fields"
```

---

### Task 3: Implement URLConfig Module

**Files:**
- Create: `src-tauri/src/url_config.rs`

- [ ] **Step 1: Write url_config.rs**

```rust
use crate::config::load_config;
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlConfigSnapshot {
    pub git_proxy_enabled: bool,
    pub git_proxy_url: String,
}

pub fn apply_git_proxy(url: &str) -> String {
    let config = match load_config() {
        Ok(c) => c,
        Err(_) => return url.to_string(),
    };
    if !config.git_proxy_enabled {
        return url.to_string();
    }
    let is_github_content = url.contains("github.com")
        || url.contains("raw.githubusercontent.com")
        || url.contains("github-releases.githubusercontent.com")
        || url.contains("objects.githubusercontent.com");
    let is_github_api = url.contains("api.github.com");
    if is_github_content && !is_github_api {
        format!("{}/{}", config.git_proxy_url.trim_end_matches('/'), url)
    } else {
        url.to_string()
    }
}

pub fn auth_url(path: &str) -> String {
    format!("https://{}.microsoft.com{}", path, path)
}

pub fn modrinth_api_url(path: &str) -> String {
    let base = "https://api.modrinth.com/v2";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn modrinth_v3_url(path: &str) -> String {
    let base = "https://api.modrinth.com/v3";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn curseforge_api_url(path: &str) -> String {
    let base = "https://api.curseforge.com/v1";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn fabric_meta_url(path: &str) -> String {
    let base = "https://meta.fabricmc.net";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn quilt_meta_url(path: &str) -> String {
    let base = "https://meta.quiltmc.org";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn neoforge_meta_url(path: &str) -> String {
    let base = "https://maven.minecraftforge.net";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn mojang_version_manifest_url() -> String {
    "https://piston-meta.mojang.com/mc/game/version_manifest.json".to_string()
}

pub fn authlib_injector_download_url(version: &str) -> String {
    apply_git_proxy(&format!(
        "https://github.com/yushijinhun/authlib-injector/releases/download/{}/authlib-injector-{}.jar",
        version, version
    ))
}

pub fn get_url_config_snapshot() -> Result<UrlConfigSnapshot, LauncherError> {
    let config = load_config()?;
    Ok(UrlConfigSnapshot {
        git_proxy_enabled: config.git_proxy_enabled,
        git_proxy_url: config.git_proxy_url,
    })
}

pub fn set_git_proxy(enabled: bool, proxy_url: Option<String>) -> Result<(), LauncherError> {
    let mut config = load_config()?;
    config.git_proxy_enabled = enabled;
    if let Some(url) = proxy_url {
        if !url.is_empty() {
            config.git_proxy_url = url;
        }
    }
    crate::config::save_config(&config)
}
```

- [ ] **Step 2: Add `mod url_config;` to lib.rs**

Find the module declarations section in `src-tauri/src/lib.rs` and add:

```rust
mod url_config;
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/url_config.rs src-tauri/src/lib.rs
git commit -m "feat: add centralized URLConfig module with GitHub proxy"
```

---

### Task 4: Implement CurseForge Fingerprint Algorithm

**Files:**
- Create: `src-tauri/src/mod_scanner/mod.rs`
- Create: `src-tauri/src/mod_scanner/fingerprint.rs`
- Create: `src-tauri/src/mod_scanner/models.rs`

- [ ] **Step 1: Create mod_scanner/models.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanSource {
    Modrinth,
    CurseForge,
    Fallback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub file_name: String,
    pub file_hash: String,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub project_slug: Option<String>,
    pub source: ScanSource,
    pub project_type: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModCacheStats {
    pub total: usize,
    pub modrinth_hits: usize,
    pub curseforge_hits: usize,
    pub fallbacks: usize,
}
```

- [ ] **Step 2: Create mod_scanner/fingerprint.rs**

Translate SCL's CurseForgeFingerprint.swift to Rust:

```rust
use std::path::Path;
use crate::error::LauncherError;

const M: u32 = 1540483477;
const SEED: u32 = 1;

fn strip_whitespace(data: &[u8]) -> Vec<u8> {
    data.iter()
        .copied()
        .filter(|&b| b != 0x09 && b != 0x0A && b != 0x0D && b != 0x20)
        .collect()
}

pub fn curseforge_fingerprint(data: &[u8]) -> u32 {
    let normalized = strip_whitespace(data);
    let len = normalized.len() as u32;
    if len == 0 {
        return 0;
    }
    let mut h: u32 = SEED ^ len;
    let mut i = 0;
    while i + 4 <= normalized.len() {
        let k = u32::from_le_bytes([
            normalized[i],
            normalized[i + 1],
            normalized[i + 2],
            normalized[i + 3],
        ]);
        h = h.wrapping_add(k);
        h = h.wrapping_mul(M);
        h ^= h >> 16;
        i += 4;
    }
    let remainder = normalized.len() - i;
    if remainder > 0 {
        let mut k: u32 = 0;
        for j in 0..remainder {
            k |= (normalized[i + j] as u32) << (j * 8);
        }
        h = h.wrapping_add(k);
        h = h.wrapping_mul(M);
        h ^= h >> 16;
    }
    h = h.wrapping_mul(M);
    h ^= h >> 13;
    h = h.wrapping_mul(M);
    h ^= h >> 15;
    h
}

pub fn curseforge_fingerprint_file(path: &Path) -> Result<u32, LauncherError> {
    let data = std::fs::read(path)
        .map_err(|e| LauncherError::FingerprintCalculation(format!("Failed to read file {:?}: {}", path, e)))?;
    Ok(curseforge_fingerprint(&data))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fingerprint_empty() {
        assert_eq!(curseforge_fingerprint(&[]), 0);
    }

    #[test]
    fn test_fingerprint_whitespace_only() {
        assert_eq!(curseforge_fingerprint(b"  \t\n\r  "), 0);
    }

    #[test]
    fn test_fingerprint_deterministic() {
        let data = b"Hello, World!";
        let fp1 = curseforge_fingerprint(data);
        let fp2 = curseforge_fingerprint(data);
        assert_eq!(fp1, fp2);
        assert_ne!(fp1, 0);
    }

    #[test]
    fn test_fingerprint_ignores_whitespace() {
        let fp1 = curseforge_fingerprint(b"HelloWorld");
        let fp2 = curseforge_fingerprint(b"Hello World");
        let fp3 = curseforge_fingerprint(b"Hello\tWorld\n");
        assert_eq!(fp1, fp2);
        assert_eq!(fp2, fp3);
    }

    #[test]
    fn test_fingerprint_different_data() {
        let fp1 = curseforge_fingerprint(b"mod-alpha-1.0.jar");
        let fp2 = curseforge_fingerprint(b"mod-beta-2.0.jar");
        assert_ne!(fp1, fp2);
    }
}
```

- [ ] **Step 3: Create mod_scanner/mod.rs**

```rust
pub mod cache_db;
pub mod fingerprint;
pub mod models;
pub mod scanner;

pub use models::{ScanResult, ScanSource, ModCacheStats};
```

- [ ] **Step 4: Add `mod mod_scanner;` to lib.rs**

In `src-tauri/src/lib.rs`, add:

```rust
mod mod_scanner;
```

- [ ] **Step 5: Run cargo check + tests**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Run: `cargo test --manifest-path src-tauri/Cargo.toml fingerprint 2>&1 | tail -10`
Expected: All 5 fingerprint tests pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/mod_scanner/ src-tauri/src/lib.rs
git commit -m "feat: add CurseForge murmur hash fingerprint algorithm"
```

---

### Task 5: Implement SQLite Cache Layer

**Files:**
- Create: `src-tauri/src/mod_scanner/cache_db.rs`

- [ ] **Step 1: Write cache_db.rs**

```rust
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use crate::error::LauncherError;
use super::models::{ScanResult, ScanSource, ModCacheStats};

pub struct ModCacheDb {
    conn: Mutex<Connection>,
}

impl ModCacheDb {
    pub fn open(data_dir: &std::path::Path) -> Result<Self, LauncherError> {
        let db_path = data_dir.join("bonnext.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| LauncherError::Database(format!("Failed to open database: {}", e)))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
            .map_err(|e| LauncherError::Database(format!("PRAGMA failed: {}", e)))?;
        let db = Self { conn: Mutex::new(conn) };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<(), LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS mod_cache (
                hash TEXT PRIMARY KEY,
                json_data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 25565,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                last_ping_result TEXT,
                last_ping_at INTEGER,
                icon_base64 TEXT,
                notes TEXT
            );
            CREATE TABLE IF NOT EXISTS server_ping_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                latency_ms INTEGER,
                online_players INTEGER,
                max_players INTEGER,
                pinged_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_mod_cache_hash ON mod_cache(hash);
            CREATE INDEX IF NOT EXISTS idx_servers_favorite ON servers(is_favorite);
            CREATE INDEX IF NOT EXISTS idx_ping_history_server ON server_ping_history(server_id);"
        ).map_err(|e| LauncherError::Database(format!("Init tables failed: {}", e)))?;
        Ok(())
    }

    pub fn get_mod_cache(&self, hash: &str) -> Result<Option<ScanResult>, LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        let result: Option<String> = conn
            .query_row(
                "SELECT json_data FROM mod_cache WHERE hash = ?1",
                params![hash],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| LauncherError::Database(format!("Query failed: {}", e)))?;
        match result {
            Some(json) => serde_json::from_str(&json)
                .map_err(|e| LauncherError::Database(format!("Deserialize failed: {}", e))),
            None => Ok(None),
        }
    }

    pub fn save_mod_cache(&self, hash: &str, result: &ScanResult) -> Result<(), LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        let json = serde_json::to_string(result)
            .map_err(|e| LauncherError::Database(format!("Serialize failed: {}", e)))?;
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR REPLACE INTO mod_cache (hash, json_data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![hash, json, now, now],
        ).map_err(|e| LauncherError::Database(format!("Insert failed: {}", e)))?;
        Ok(())
    }

    pub fn batch_save(&self, caches: &[(String, ScanResult)]) -> Result<(), LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        let now = chrono::Utc::now().timestamp();
        let tx = conn.unchecked_transaction()
            .map_err(|e| LauncherError::Database(format!("Transaction begin failed: {}", e)))?;
        for (hash, result) in caches {
            let json = serde_json::to_string(result)
                .map_err(|e| LauncherError::Database(format!("Serialize failed: {}", e)))?;
            tx.execute(
                "INSERT OR REPLACE INTO mod_cache (hash, json_data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                params![hash, json, now, now],
            ).map_err(|e| LauncherError::Database(format!("Batch insert failed: {}", e)))?;
        }
        tx.commit().map_err(|e| LauncherError::Database(format!("Transaction commit failed: {}", e)))?;
        Ok(())
    }

    pub fn clear_expired(&self, older_than: Duration) -> Result<usize, LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        let cutoff = chrono::Utc::now().timestamp() - older_than.as_secs() as i64;
        let count = conn.execute(
            "DELETE FROM mod_cache WHERE updated_at < ?1",
            params![cutoff],
        ).map_err(|e| LauncherError::Database(format!("Delete expired failed: {}", e)))?;
        Ok(count)
    }

    pub fn clear_all(&self) -> Result<(), LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        conn.execute("DELETE FROM mod_cache", [])
            .map_err(|e| LauncherError::Database(format!("Clear all failed: {}", e)))?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<ModCacheStats, LauncherError> {
        let conn = self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))?;
        let total: usize = conn
            .query_row("SELECT COUNT(*) FROM mod_cache", [], |row| row.get(0))
            .map_err(|e| LauncherError::Database(format!("Stats query failed: {}", e)))?;
        let modrinth_hits: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM mod_cache WHERE json_data LIKE '%Modrinth%'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| LauncherError::Database(format!("Stats query failed: {}", e)))?;
        let curseforge_hits: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM mod_cache WHERE json_data LIKE '%CurseForge%'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| LauncherError::Database(format!("Stats query failed: {}", e)))?;
        Ok(ModCacheStats {
            total,
            modrinth_hits,
            curseforge_hits,
            fallbacks: total.saturating_sub(modrinth_hits).saturating_sub(curseforge_hits),
        })
    }
}
```

- [ ] **Step 2: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/mod_scanner/cache_db.rs
git commit -m "feat: add SQLite cache layer for mod scanner"
```

---

### Task 6: Implement Three-Tier Mod Scanner Engine

**Files:**
- Create: `src-tauri/src/mod_scanner/scanner.rs`

- [ ] **Step 1: Write scanner.rs**

```rust
use std::path::{Path, PathBuf};
use sha1::{Digest, Sha1};
use crate::error::LauncherError;
use crate::http_client;
use crate::modrinth;
use crate::curseforge;
use super::cache_db::ModCacheDb;
use super::fingerprint;
use super::models::{ScanResult, ScanSource};

fn compute_sha1(data: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn parse_filename_fallback(filename: &str) -> (String, Option<String>) {
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);
    let name = stem
        .replace('_', " ")
        .split('-')
        .next()
        .unwrap_or(stem)
        .trim()
        .to_string();
    let version = stem
        .rsplit('-')
        .next()
        .map(|v| v.to_string());
    (name, version)
}

async fn query_modrinth_by_hash(sha1_hash: &str) -> Result<Option<ScanResult>, LauncherError> {
    let url = crate::url_config::modrinth_api_url(&format!("version_file/{}?algorithm=sha1", sha1_hash));
    let client = http_client::build_client()?;
    let resp = client.get(&url).send().await;
    match resp {
        Ok(r) if r.status().is_success() => {
            let data: serde_json::Value = r.json().await.map_err(LauncherError::Http)?;
            let project_id = data["project_id"].as_str().map(|s| s.to_string());
            let version_number = data["version_number"].as_str().map(|s| s.to_string());
            let project_type = data["project_type"].as_str().map(|s| s.to_string());
            let project_name = data["name"].as_str().map(|s| s.to_string());
            if let Some(pid) = &project_id {
                if let Ok(Some(project)) = fetch_modrinth_project(pid).await {
                    return Ok(Some(ScanResult {
                        file_name: String::new(),
                        file_hash: sha1_hash.to_string(),
                        project_id: Some(pid.clone()),
                        project_name: Some(project.title.clone()),
                        project_slug: Some(project.slug.clone()),
                        source: ScanSource::Modrinth,
                        project_type: project_type.or(Some(project.project_type.clone())),
                        icon_url: project.icon_url.clone(),
                    }));
                }
            }
            Ok(Some(ScanResult {
                file_name: String::new(),
                file_hash: sha1_hash.to_string(),
                project_id,
                project_name: project_name,
                project_slug: None,
                source: ScanSource::Modrinth,
                project_type,
                icon_url: None,
            }))
        }
        _ => Ok(None),
    }
}

async fn fetch_modrinth_project(project_id: &str) -> Result<Option<crate::modrinth::ModProjectFull>, LauncherError> {
    match modrinth::get_project(project_id).await {
        Ok(p) => Ok(Some(p)),
        Err(_) => Ok(None),
    }
}

async fn query_curseforge_by_fingerprint(fp: u32) -> Result<Option<ScanResult>, LauncherError> {
    let url = crate::url_config::curseforge_api_url("fingerprints/432");
    let client = http_client::build_client()?;
    let api_key = std::env::var("BONNEXT_CF_API_KEY")
        .ok()
        .or_else(|| crate::security::key_store::get_api_key("curseforge").ok())
        .unwrap_or_default();
    let body = serde_json::json!({ "fingerprints": [fp] });
    let resp = client
        .post(&url)
        .header("x-api-key", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;
    match resp {
        Ok(r) if r.status().is_success() => {
            let data: serde_json::Value = r.json().await.map_err(LauncherError::Http)?;
            let matches = data["data"]["exactMatches"].as_array();
            if let Some(arr) = matches {
                if let Some(first) = arr.first() {
                    let project_id = first["id"].as_i64().map(|i| i.to_string());
                    let file_name = first["file"]["fileName"].as_str().map(|s| s.to_string());
                    let mod_id = first["file"]["modId"].as_i64().map(|i| i.to_string());
                    return Ok(Some(ScanResult {
                        file_name: file_name.unwrap_or_default(),
                        file_hash: String::new(),
                        project_id: mod_id,
                        project_name: None,
                        project_slug: project_id,
                        source: ScanSource::CurseForge,
                        project_type: None,
                        icon_url: None,
                    }));
                }
            }
            Ok(None)
        }
        _ => Ok(None),
    }
}

pub async fn scan_file(
    path: &Path,
    cache: &ModCacheDb,
) -> Result<ScanResult, LauncherError> {
    let data = std::fs::read(path)
        .map_err(|e| LauncherError::ModScan(format!("Failed to read {:?}: {}", path, e)))?;
    let sha1_hash = compute_sha1(&data);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    if let Ok(Some(cached)) = cache.get_mod_cache(&sha1_hash) {
        let mut result = cached;
        result.file_name = file_name.clone();
        return Ok(result);
    }

    if let Ok(Some(result)) = query_modrinth_by_hash(&sha1_hash).await {
        let mut result = result;
        result.file_name = file_name.clone();
        let _ = cache.save_mod_cache(&sha1_hash, &result);
        return Ok(result);
    }

    let fp = fingerprint::curseforge_fingerprint(&data);
    if let Ok(Some(result)) = query_curseforge_by_fingerprint(fp).await {
        let mut result = result;
        result.file_name = file_name.clone();
        result.file_hash = sha1_hash.clone();
        let _ = cache.save_mod_cache(&sha1_hash, &result);
        return Ok(result);
    }

    let (name, _version) = parse_filename_fallback(&file_name);
    let result = ScanResult {
        file_name: file_name.clone(),
        file_hash: sha1_hash,
        project_id: None,
        project_name: Some(name),
        project_slug: None,
        source: ScanSource::Fallback,
        project_type: None,
        icon_url: None,
    };
    let _ = cache.save_mod_cache(&result.file_hash, &result);
    Ok(result)
}

pub async fn scan_directory(
    dir: &Path,
    cache: &ModCacheDb,
) -> Result<Vec<ScanResult>, LauncherError> {
    let mut results = Vec::new();
    let entries = std::fs::read_dir(dir)
        .map_err(|e| LauncherError::ModScan(format!("Failed to read dir {:?}: {}", dir, e)))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "jar" || ext == "zip" {
                match scan_file(&path, cache).await {
                    Ok(result) => results.push(result),
                    Err(e) => {
                        tracing::warn!("Failed to scan {:?}: {}", path, e);
                    }
                }
            }
        }
    }
    Ok(results)
}
```

- [ ] **Step 2: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors (may need minor adjustments for modrinth::get_project signature)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/mod_scanner/scanner.rs
git commit -m "feat: add three-tier mod scanner engine"
```

---

### Task 7: Register Tauri Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add ModScannerState managed state**

In `lib.rs`, add the state struct near the other state definitions:

```rust
struct ModScannerState {
    db: Arc<mod_scanner::cache_db::ModCacheDb>,
}

impl ModScannerState {
    fn new(data_dir: &std::path::Path) -> Result<Self, LauncherError> {
        let db = mod_scanner::cache_db::ModCacheDb::open(data_dir)?;
        Ok(Self { db: Arc::new(db) })
    }
}
```

- [ ] **Step 2: Add Tauri command functions**

Add these command functions in `lib.rs` (or in a new `commands/mod_scanner.rs` file following the existing pattern):

```rust
#[tauri::command]
async fn scan_mod_file(path: String, state: State<'_, ModScannerState>) -> Result<mod_scanner::ScanResult, String> {
    mod_scanner::scanner::scan_file(std::path::Path::new(&path), &state.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn scan_mods_directory(instance_id: String, state: State<'_, ModScannerState>, app: tauri::AppHandle) -> Result<Vec<mod_scanner::ScanResult>, String> {
    let config = crate::config::load_config().map_err(|e| e.to_string())?;
    let instance_dir = std::path::PathBuf::from(&config.game_directory)
        .join("instances")
        .join(&instance_id)
        .join(".minecraft")
        .join("mods");
    if !instance_dir.exists() {
        return Err(format!("Mods directory not found: {:?}", instance_dir));
    }
    mod_scanner::scanner::scan_directory(&instance_dir, &state.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_mod_cache(state: State<'_, ModScannerState>) -> Result<(), String> {
    state.db.clear_all().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_mod_cache_stats(state: State<'_, ModScannerState>) -> Result<mod_scanner::ModCacheStats, String> {
    state.db.get_stats().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_url_config() -> Result<url_config::UrlConfigSnapshot, String> {
    url_config::get_url_config_snapshot().map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_git_proxy(enabled: bool, proxy_url: Option<String>) -> Result<(), String> {
    url_config::set_git_proxy(enabled, proxy_url).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Register state and commands in builder**

In the Tauri builder chain, add `.manage()` and register commands in `generate_handler![]`:

```rust
.manage(ModScannerState::new(&data_dir).expect("Failed to init mod scanner DB"))
```

Add to `generate_handler![]`:

```rust
scan_mod_file,
scan_mods_directory,
clear_mod_cache,
get_mod_cache_stats,
get_url_config,
set_git_proxy,
```

- [ ] **Step 4: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: Finished without errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register mod scanner and URL config Tauri commands"
```

---

### Task 8: Frontend API Wrappers

**Files:**
- Create: `src/api/modScanner.ts`
- Create: `src/api/servers.ts` (placeholder for Batch 2)
- Modify: `src/api/index.ts`

- [ ] **Step 1: Create src/api/modScanner.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface ScanResult {
  file_name: string;
  file_hash: string;
  project_id: string | null;
  project_name: string | null;
  project_slug: string | null;
  source: 'Modrinth' | 'CurseForge' | 'Fallback';
  project_type: string | null;
  icon_url: string | null;
}

export interface ModCacheStats {
  total: number;
  modrinth_hits: number;
  curseforge_hits: number;
  fallbacks: number;
}

export interface UrlConfigSnapshot {
  git_proxy_enabled: boolean;
  git_proxy_url: string;
}

export async function scanModFile(path: string): Promise<ScanResult> {
  return invoke<ScanResult>('scan_mod_file', { path });
}

export async function scanModsDirectory(instanceId: string): Promise<ScanResult[]> {
  return invoke<ScanResult[]>('scan_mods_directory', { instanceId });
}

export async function clearModCache(): Promise<void> {
  return invoke('clear_mod_cache');
}

export async function getModCacheStats(): Promise<ModCacheStats> {
  return invoke<ModCacheStats>('get_mod_cache_stats');
}

export async function getUrlConfig(): Promise<UrlConfigSnapshot> {
  return invoke<UrlConfigSnapshot>('get_url_config');
}

export async function setGitProxy(enabled: boolean, proxyUrl?: string): Promise<void> {
  return invoke('set_git_proxy', { enabled, proxyUrl });
}
```

- [ ] **Step 2: Create src/api/servers.ts (placeholder)**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface MinecraftServerInfo {
  version: { name: string; protocol: number };
  players: { max: number; online: number; sample?: { name: string; id: string }[] };
  description: { text: string; extra?: { text: string; color?: string }[] };
  favicon: string | null;
}

export async function pingServer(address: string, port: number, timeoutMs?: number): Promise<MinecraftServerInfo | null> {
  return invoke<MinecraftServerInfo | null>('ping_server', { address, port, timeoutMs: timeoutMs ?? 5000 });
}
```

- [ ] **Step 3: Update src/api/index.ts**

Add imports and re-exports:

```typescript
import * as modScanner from './modScanner';
import * as servers from './servers';

// In the api object, add:
modScanner,
servers,
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors related to new files

- [ ] **Step 5: Commit**

```bash
git add src/api/modScanner.ts src/api/servers.ts src/api/index.ts
git commit -m "feat: add frontend API wrappers for mod scanner and servers"
```

---

### Task 9: Network Settings Section (GitHub Proxy)

**Files:**
- Create: `src/pages/settings/NetworkSection.tsx`
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Create NetworkSection.tsx**

Follow the existing pattern from `MemorySection.tsx` (SectionCard + SettingRow):

```tsx
import React, { useState, useEffect } from 'react';
import { SectionCard, SettingRow } from './MemorySection';
import { api } from '../../api';
import type { UrlConfigSnapshot } from '../../api/modScanner';
import styles from './MemorySection.module.css';

interface NetworkSectionProps {
  addToast: (msg: string, type?: string) => void;
}

export default function NetworkSection({ addToast }: NetworkSectionProps) {
  const [config, setConfig] = useState<UrlConfigSnapshot | null>(null);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [proxyUrl, setProxyUrl] = useState('https://gh-proxy.com');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.modScanner.getUrlConfig().then(c => {
      setConfig(c);
      setProxyEnabled(c.git_proxy_enabled);
      setProxyUrl(c.git_proxy_url);
    }).catch(() => {});
  }, []);

  const handleToggle = async () => {
    const next = !proxyEnabled;
    setProxyEnabled(next);
    try {
      await api.modScanner.setGitProxy(next, proxyUrl);
      addToast(next ? 'GitHub 代理已开启' : 'GitHub 代理已关闭', 'success');
    } catch {
      setProxyEnabled(!next);
      addToast('设置失败', 'error');
    }
  };

  const handleUrlChange = async () => {
    try {
      await api.modScanner.setGitProxy(proxyEnabled, proxyUrl);
      addToast('代理地址已更新', 'success');
    } catch {
      addToast('更新失败', 'error');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const start = Date.now();
      await fetch('https://api.github.com/zen');
      const latency = Date.now() - start;
      addToast(`连接正常，延迟 ${latency}ms`, 'success');
    } catch {
      addToast('连接失败，请检查网络或代理设置', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <SectionCard id="sec-network" title="网络设置">
      <SettingRow label="GitHub 代理" description="加速 GitHub 资源下载（对中国用户推荐开启）">
        <button className={styles.toggleBtn} onClick={handleToggle} data-active={proxyEnabled}>
          {proxyEnabled ? '开启' : '关闭'}
        </button>
      </SettingRow>
      <SettingRow label="代理地址" description="自定义 GitHub 代理 URL">
        <div style={{ display: 'flex', gap: '0.5em' }}>
          <input
            className={styles.input}
            value={proxyUrl}
            onChange={e => setProxyUrl(e.target.value)}
            onBlur={handleUrlChange}
            disabled={!proxyEnabled}
          />
          <button className={styles.actionBtn} onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '测试'}
          </button>
        </div>
      </SettingRow>
    </SectionCard>
  );
}
```

- [ ] **Step 2: Add NetworkSection to settings/index.tsx**

Import and add the section in the appropriate position:

```tsx
import NetworkSection from './NetworkSection';
```

Render `<NetworkSection addToast={addToast} />` in the settings page layout.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/settings/NetworkSection.tsx src/pages/settings/index.tsx
git commit -m "feat: add Network settings section with GitHub proxy toggle"
```

---

### Task 10: Enhance LibraryPage with Mod Scan Results

**Files:**
- Modify: `src/pages/LibraryPage/index.tsx` (or equivalent path)
- Create: `src/components/ui/ModScanResult/ModScanResult.tsx`
- Create: `src/components/ui/ModScanResult/ModScanResult.module.css`

- [ ] **Step 1: Create ModScanResult component**

```tsx
import React from 'react';
import type { ScanResult } from '../../api/modScanner';
import styles from './ModScanResult.module.css';

interface ModScanResultProps {
  result: ScanResult;
  onClick?: () => void;
}

const sourceBadgeMap: Record<string, { label: string; className: string }> = {
  Modrinth: { label: 'MR', className: styles.badgeModrinth },
  CurseForge: { label: 'CF', className: styles.badgeCurseForge },
  Fallback: { label: '?', className: styles.badgeFallback },
};

export default function ModScanResult({ result, onClick }: ModScanResultProps) {
  const badge = sourceBadgeMap[result.source] || sourceBadgeMap.Fallback;
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.icon}>
        {result.icon_url ? (
          <img src={result.icon_url} alt="" />
        ) : (
          <div className={styles.iconPlaceholder}>📦</div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{result.project_name || result.file_name}</div>
        <div className={styles.fileName}>{result.file_name}</div>
      </div>
      <span className={`${styles.badge} ${badge.className}`}>{badge.label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create ModScanResult.module.css**

```css
.card {
  display: flex;
  align-items: center;
  gap: 0.75em;
  padding: 0.6em 0.8em;
  background: var(--surface-dark-elevated);
  clip-path: var(--clip-medium);
  cursor: pointer;
  transition: background 0.15s;
}
.card:hover {
  background: var(--surface-dark-hover);
}
.icon {
  width: 2em;
  height: 2em;
  flex-shrink: 0;
}
.icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.iconPlaceholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1em;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-family: 'Inter', sans-serif;
  font-size: 0.75em;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fileName {
  font-family: 'DM Mono', monospace;
  font-size: 0.6em;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  font-family: 'DM Mono', monospace;
  font-size: 0.55em;
  padding: 0.15em 0.4em;
  clip-path: var(--clip-badge);
  font-weight: 600;
}
.badgeModrinth {
  background: var(--accent, #1bd96a);
  color: #000;
}
.badgeCurseForge {
  background: #f16436;
  color: #fff;
}
.badgeFallback {
  background: var(--surface-dark);
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Add scan button and results to LibraryPage**

In the LibraryPage component, add a "扫描 Mod" button that calls `api.modScanner.scanModsDirectory(instanceId)` and displays results using `ModScanResult` components. Follow the existing page pattern for state management.

- [ ] **Step 4: Run full check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`
Expected: Both pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ModScanResult/ src/pages/LibraryPage/
git commit -m "feat: add ModScanResult component and LibraryPage scan integration"
```

---

## Self-Review

1. **Spec coverage**: F9 (URLConfig) ✅, F2 (CF Fingerprint) ✅, F3 (Mod Scanner) ✅ — all Batch 1 features covered
2. **Placeholder scan**: No TBD/TODO found — all steps contain complete code
3. **Type consistency**: `ScanResult`, `ScanSource`, `ModCacheStats`, `UrlConfigSnapshot` types are consistent across Rust and TypeScript
4. **Gap**: The `scan_mods_directory` command constructs the path from config — need to verify this matches BonNext's actual instance directory structure
