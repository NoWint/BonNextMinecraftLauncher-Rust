use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CacheEntry {
    key: String,
    value: String,
    etag: Option<String>,
    created_at: u64,
    expires_at: u64,
    access_count: u64,
}

pub struct PersistentCache {
    entries: HashMap<String, CacheEntry>,
    cache_path: PathBuf,
    dirty: bool,
}

impl PersistentCache {
    pub fn new(game_dir: &str) -> Self {
        let cache_path = PathBuf::from(game_dir).join("cache").join("http_cache.json");
        let entries = if cache_path.exists() {
            match std::fs::read_to_string(&cache_path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => HashMap::new(),
            }
        } else {
            HashMap::new()
        };
        Self {
            entries,
            cache_path,
            dirty: false,
        }
    }

    pub fn get(&mut self, key: &str) -> Option<String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(entry) = self.entries.get_mut(key) {
            if entry.expires_at > now {
                entry.access_count += 1;
                self.dirty = true;
                return Some(entry.value.clone());
            } else {
                self.entries.remove(key);
                self.dirty = true;
            }
        }
        None
    }

    pub fn set(&mut self, key: &str, value: &str, ttl_secs: u64, etag: Option<String>) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.entries.insert(
            key.to_string(),
            CacheEntry {
                key: key.to_string(),
                value: value.to_string(),
                etag,
                created_at: now,
                expires_at: now + ttl_secs,
                access_count: 0,
            },
        );
        self.dirty = true;
    }

    pub fn invalidate(&mut self, key_prefix: &str) {
        self.entries.retain(|k, _| !k.starts_with(key_prefix));
        self.dirty = true;
    }

    pub fn save(&mut self) -> Result<(), std::io::Error> {
        if self.dirty {
            if let Some(parent) = self.cache_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let content = serde_json::to_string_pretty(&self.entries)?;
            std::fs::write(&self.cache_path, content)?;
            self.dirty = false;
        }
        Ok(())
    }

    pub fn evict_expired(&mut self) -> usize {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let before = self.entries.len();
        self.entries.retain(|_, entry| entry.expires_at > now);
        let removed = before - self.entries.len();
        if removed > 0 {
            self.dirty = true;
        }
        removed
    }
}

impl Drop for PersistentCache {
    fn drop(&mut self) {
        let _ = self.save();
    }
}
