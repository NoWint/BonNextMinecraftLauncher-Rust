//! In-memory TTL cache for Modrinth API responses.
//! Reduces redundant API calls and avoids rate limiting.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const DEFAULT_TTL: Duration = Duration::from_secs(300); // 5 minutes

struct CacheEntry<T> {
    data: T,
    expires_at: Instant,
}

impl<T> CacheEntry<T> {
    fn new(data: T, ttl: Duration) -> Self {
        Self { data, expires_at: Instant::now() + ttl }
    }

    fn is_valid(&self) -> bool {
        Instant::now() < self.expires_at
    }
}

pub struct ApiCache {
    searches: Mutex<HashMap<String, CacheEntry<String>>>,
    projects: Mutex<HashMap<String, CacheEntry<String>>>,
    versions: Mutex<HashMap<String, CacheEntry<String>>>,
    popular: Mutex<HashMap<String, CacheEntry<String>>>,
}

impl ApiCache {
    pub fn new() -> Self {
        Self {
            searches: Mutex::new(HashMap::new()),
            projects: Mutex::new(HashMap::new()),
            versions: Mutex::new(HashMap::new()),
            popular: Mutex::new(HashMap::new()),
        }
    }

    /// Store a serialized value in a cache map.
    fn put_raw(map: &Mutex<HashMap<String, CacheEntry<String>>>, key: String, json: String, ttl: Duration) {
        if let Ok(mut guard) = map.lock() {
            guard.insert(key, CacheEntry::new(json, ttl));
        }
    }

    /// Get a value from a cache map, deserializing if still valid.
    fn get_raw<T: serde::de::DeserializeOwned>(
        map: &Mutex<HashMap<String, CacheEntry<String>>>,
        key: &str,
    ) -> Option<T> {
        let guard = map.lock().ok()?;
        let entry = guard.get(key)?;
        if !entry.is_valid() {
            return None;
        }
        serde_json::from_str(&entry.data).ok()
    }

    // -- Public helpers for each cache domain --

    pub fn cache_search_results(
        &self,
        key: &str,
        results: &(Vec<super::modrinth::ModResult>, u64),
    ) {
        if let Ok(json) = serde_json::to_string(results) {
            Self::put_raw(&self.searches, key.to_string(), json, DEFAULT_TTL);
        }
    }

    pub fn get_search_results(
        &self,
        key: &str,
    ) -> Option<(Vec<super::modrinth::ModResult>, u64)> {
        Self::get_raw(&self.searches, key)
    }

    pub fn cache_project(&self, slug: &str, project: &super::modrinth::ModProjectFull) {
        if let Ok(json) = serde_json::to_string(project) {
            Self::put_raw(&self.projects, slug.to_string(), json, DEFAULT_TTL);
        }
    }

    pub fn get_project(&self, slug: &str) -> Option<super::modrinth::ModProjectFull> {
        Self::get_raw(&self.projects, slug)
    }

    pub fn cache_versions(&self, key: &str, versions: &[super::modrinth::ModVersion]) {
        if let Ok(json) = serde_json::to_string(versions) {
            Self::put_raw(&self.versions, key.to_string(), json, Duration::from_secs(120));
        }
    }

    pub fn get_versions(&self, key: &str) -> Option<Vec<super::modrinth::ModVersion>> {
        Self::get_raw(&self.versions, key)
    }

    pub fn cache_popular(&self, key: &str, results: &[super::modrinth::ModResult]) {
        if let Ok(json) = serde_json::to_string(results) {
            Self::put_raw(&self.popular, key.to_string(), json, DEFAULT_TTL);
        }
    }

    pub fn get_popular(&self, key: &str) -> Option<Vec<super::modrinth::ModResult>> {
        Self::get_raw(&self.popular, key)
    }
}
