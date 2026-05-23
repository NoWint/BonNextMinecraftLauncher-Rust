use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const DEFAULT_TTL: Duration = Duration::from_secs(300);
const MAX_CACHE_SIZE: usize = 200;

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

fn evict_expired<T>(map: &mut HashMap<String, CacheEntry<T>>) {
    map.retain(|_, entry| entry.is_valid());
    if map.len() > MAX_CACHE_SIZE {
        let mut entries: Vec<_> = map.drain().collect();
        entries.sort_by_key(|(_, e)| e.expires_at);
        *map = entries.into_iter().take(MAX_CACHE_SIZE).collect();
    }
}

pub struct ApiCache {
    searches: Mutex<HashMap<String, CacheEntry<String>>>,
    projects: Mutex<HashMap<String, CacheEntry<String>>>,
    popular: Mutex<HashMap<String, CacheEntry<String>>>,
}

impl ApiCache {
    pub fn new() -> Self {
        Self {
            searches: Mutex::new(HashMap::new()),
            projects: Mutex::new(HashMap::new()),
            popular: Mutex::new(HashMap::new()),
        }
    }

    fn put_raw(map: &Mutex<HashMap<String, CacheEntry<String>>>, key: String, json: String, ttl: Duration) {
        if let Ok(mut guard) = map.lock() {
            guard.insert(key, CacheEntry::new(json, ttl));
            if guard.len() > MAX_CACHE_SIZE {
                evict_expired(&mut guard);
            }
        }
    }

    fn get_raw<T: serde::de::DeserializeOwned>(
        map: &Mutex<HashMap<String, CacheEntry<String>>>,
        key: &str,
    ) -> Option<T> {
        let mut guard = map.lock().ok()?;
        let entry = guard.get(key)?;
        if !entry.is_valid() {
            guard.remove(key);
            return None;
        }
        serde_json::from_str(&entry.data).ok()
    }

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

    pub fn cache_popular(&self, key: &str, results: &[super::modrinth::ModResult]) {
        if let Ok(json) = serde_json::to_string(results) {
            Self::put_raw(&self.popular, key.to_string(), json, DEFAULT_TTL);
        }
    }

    pub fn get_popular(&self, key: &str) -> Option<Vec<super::modrinth::ModResult>> {
        Self::get_raw(&self.popular, key)
    }
}
