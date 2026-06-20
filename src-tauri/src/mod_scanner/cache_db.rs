use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Mutex;
use std::time::Duration;
use crate::error::LauncherError;
use super::models::{ScanResult, ModCacheStats};

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
        let conn = self.get_conn()?;
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
                latency_ms INTEGER,
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

    pub fn get_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, LauncherError> {
        self.conn.lock().map_err(|e| LauncherError::Database(format!("Lock poisoned: {}", e)))
    }

    pub fn get_mod_cache(&self, hash: &str) -> Result<Option<ScanResult>, LauncherError> {
        let conn = self.get_conn()?;
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
        let conn = self.get_conn()?;
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
        let conn = self.get_conn()?;
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
        let conn = self.get_conn()?;
        let cutoff = chrono::Utc::now().timestamp() - older_than.as_secs() as i64;
        let count = conn.execute(
            "DELETE FROM mod_cache WHERE updated_at < ?1",
            params![cutoff],
        ).map_err(|e| LauncherError::Database(format!("Delete expired failed: {}", e)))?;
        Ok(count)
    }

    pub fn clear_all(&self) -> Result<(), LauncherError> {
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM mod_cache", [])
            .map_err(|e| LauncherError::Database(format!("Clear all failed: {}", e)))?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<ModCacheStats, LauncherError> {
        let conn = self.get_conn()?;
        let total: usize = conn
            .query_row("SELECT COUNT(*) FROM mod_cache", [], |row| row.get(0))
            .map_err(|e| LauncherError::Database(format!("Stats query failed: {}", e)))?;
        let modrinth_hits: usize = conn
            .query_row("SELECT COUNT(*) FROM mod_cache WHERE json_data LIKE '%Modrinth%'", [], |row| row.get(0))
            .map_err(|e| LauncherError::Database(format!("Stats query failed: {}", e)))?;
        let curseforge_hits: usize = conn
            .query_row("SELECT COUNT(*) FROM mod_cache WHERE json_data LIKE '%CurseForge%'", [], |row| row.get(0))
            .map_err(|e| LauncherError::Database(format!("Stats query failed: {}", e)))?;
        Ok(ModCacheStats {
            total,
            modrinth_hits,
            curseforge_hits,
            fallbacks: total.saturating_sub(modrinth_hits).saturating_sub(curseforge_hits),
        })
    }
}
