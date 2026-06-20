use parking_lot::Mutex;
use std::sync::Arc;

use crate::error::LauncherError;
use crate::persistent_cache::PersistentCache;

pub struct PersistentCacheState(pub Arc<Mutex<PersistentCache>>);

#[tauri::command]
pub async fn cache_get(key: String, state: tauri::State<'_, PersistentCacheState>) -> Result<Option<String>, LauncherError> {
    let mut cache = state.0.lock();
    Ok(cache.get(&key))
}

#[tauri::command]
pub async fn cache_set(key: String, value: String, ttl_secs: u64, state: tauri::State<'_, PersistentCacheState>) -> Result<(), LauncherError> {
    let mut cache = state.0.lock();
    cache.set(&key, &value, ttl_secs, None);
    cache.save()?;
    Ok(())
}

#[tauri::command]
pub async fn cache_invalidate(key_prefix: String, state: tauri::State<'_, PersistentCacheState>) -> Result<(), LauncherError> {
    let mut cache = state.0.lock();
    cache.invalidate(&key_prefix);
    cache.save()?;
    Ok(())
}

#[tauri::command]
pub async fn cache_evict_expired(state: tauri::State<'_, PersistentCacheState>) -> Result<usize, LauncherError> {
    let mut cache = state.0.lock();
    let removed = cache.evict_expired();
    cache.save()?;
    Ok(removed)
}
