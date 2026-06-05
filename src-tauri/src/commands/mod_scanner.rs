use std::sync::Arc;

use crate::mod_scanner::cache_db::ModCacheDb;
use crate::mod_scanner::models::{ModCacheStats, ScanResult};
use crate::mod_scanner::scanner::ScanCache;
use crate::platform::paths;

#[tauri::command]
pub async fn scan_mod_file(
    path: String,
    cache: tauri::State<'_, Arc<tokio::sync::Mutex<ScanCache>>>,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<ScanResult, String> {
    let file_path = std::path::PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    let mut cache = cache.lock().await;
    crate::mod_scanner::scanner::scan_file_with_db_cache(&file_path, &mut cache, &db)
        .await
        .map_err(|e: crate::error::LauncherError| e.to_string())
}

#[tauri::command]
pub async fn scan_mods_directory(
    instance_id: String,
    cache: tauri::State<'_, Arc<tokio::sync::Mutex<ScanCache>>>,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<Vec<ScanResult>, String> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    if !mods_dir.exists() {
        return Err(format!(
            "Mods directory does not exist for instance: {}",
            instance_id
        ));
    }
    let mut cache = cache.lock().await;
    crate::mod_scanner::scanner::scan_directory_with_db_cache(&mods_dir, &mut cache, &db)
        .await
        .map_err(|e: crate::error::LauncherError| e.to_string())
}

#[tauri::command]
pub async fn scan_mods_directory_concurrent(
    instance_id: String,
    max_concurrent: Option<usize>,
    cache: tauri::State<'_, Arc<tokio::sync::Mutex<ScanCache>>>,
    db: tauri::State<'_, Arc<ModCacheDb>>,
) -> Result<Vec<ScanResult>, String> {
    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    if !mods_dir.exists() {
        return Err(format!(
            "Mods directory does not exist for instance: {}",
            instance_id
        ));
    }
    let concurrency = max_concurrent.unwrap_or(4);
    let mut cache = cache.lock().await;
    crate::mod_scanner::scanner::scan_directory_concurrent(&mods_dir, &mut cache, Arc::clone(&*db), concurrency)
        .await
        .map_err(|e: crate::error::LauncherError| e.to_string())
}

#[tauri::command]
pub async fn clear_mod_cache(
    cache: tauri::State<'_, Arc<tokio::sync::Mutex<ScanCache>>>,
) -> Result<(), String> {
    let mut cache = cache.lock().await;
    cache.clear();
    Ok(())
}

#[tauri::command]
pub async fn get_mod_cache_stats(
    cache: tauri::State<'_, Arc<tokio::sync::Mutex<ScanCache>>>,
) -> Result<ModCacheStats, String> {
    let cache = cache.lock().await;
    Ok(cache.stats())
}
