use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::Deserialize;
use sha1::{Digest, Sha1};

use crate::error::LauncherError;
use crate::http_client;
use crate::mod_scanner::cache_db::ModCacheDb;
use crate::mod_scanner::fingerprint;
use crate::mod_scanner::models::{ModCacheStats, ScanResult, ScanSource};
use crate::url_config;

#[derive(Debug)]
pub struct ScanCache {
    by_hash: HashMap<String, ScanResult>,
}

impl ScanCache {
    pub fn new() -> Self {
        ScanCache {
            by_hash: HashMap::new(),
        }
    }

    pub fn get(&self, hash: &str) -> Option<&ScanResult> {
        self.by_hash.get(hash)
    }

    pub fn insert(&mut self, hash: String, result: ScanResult) {
        self.by_hash.insert(hash, result);
    }

    pub fn stats(&self) -> ModCacheStats {
        let mut modrinth_hits = 0;
        let mut curseforge_hits = 0;
        let mut fallbacks = 0;
        for result in self.by_hash.values() {
            match result.source {
                ScanSource::Modrinth => modrinth_hits += 1,
                ScanSource::CurseForge => curseforge_hits += 1,
                ScanSource::Fallback => fallbacks += 1,
            }
        }
        ModCacheStats {
            total: self.by_hash.len(),
            modrinth_hits,
            curseforge_hits,
            fallbacks,
        }
    }

    pub fn clear(&mut self) {
        self.by_hash.clear();
    }
}

impl Default for ScanCache {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Deserialize)]
struct ModrinthVersionFromHash {
    project_id: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthProjectFromHash {
    slug: String,
    title: String,
    #[serde(default)]
    icon_url: Option<String>,
    #[serde(default)]
    project_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CfFingerprintResponse {
    data: CfFingerprintData,
}

#[derive(Debug, Deserialize)]
struct CfFingerprintData {
    #[serde(default, rename = "exactMatches")]
    exact_matches: Vec<CfFingerprintMatch>,
}

#[derive(Debug, Deserialize)]
struct CfFingerprintMatch {
    #[serde(default)]
    file: Option<CfFingerprintFile>,
}

#[derive(Debug, Deserialize)]
struct CfFingerprintFile {
    #[serde(rename = "modId", default)]
    mod_id: u64,
}

fn compute_file_sha1(data: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn parse_mod_name_from_filename(filename: &str) -> Option<String> {
    let stem = filename.trim_end_matches(".jar").trim_end_matches(".zip");
    let name = stem
        .split('-')
        .next()
        .unwrap_or(stem)
        .trim();
    if name.is_empty() {
        None
    } else {
        let mut chars = name.chars();
        match chars.next() {
            None => None,
            Some(first) => {
                let capitalized = first.to_uppercase().collect::<String>()
                    + chars.as_str();
                Some(capitalized)
            }
        }
    }
}

fn cf_api_key() -> String {
    if let Ok(key) = std::env::var("BONNEXT_CF_API_KEY") {
        if !key.is_empty() {
            return key;
        }
    }
    if let Ok(Some(key)) = crate::security::key_store::get_key("cf_api_key") {
        if !key.is_empty() {
            return key;
        }
    }
    String::new()
}

fn build_cf_headers() -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    let key = cf_api_key();
    if !key.is_empty() {
        if let Ok(val) = key.parse() {
            headers.insert("x-api-key", val);
        }
    }
    headers.insert("Accept", "application/json".parse().unwrap());
    headers.insert("Content-Type", "application/json".parse().unwrap());
    headers
}

async fn query_modrinth_by_hash(sha1_hash: &str) -> Result<ScanResult, LauncherError> {
    let url = url_config::modrinth_api_url(&format!(
        "version_file/{}?algorithm=sha1",
        sha1_hash
    ));

    let resp = http_client::retry_get(&url, 2).await?;
    let version: ModrinthVersionFromHash = resp
        .json()
        .await
        .map_err(|e| LauncherError::ModScan(format!("Modrinth version_file parse failed: {}", e)))?;

    let project_url = url_config::modrinth_api_url(&format!("project/{}", version.project_id));
    let project_resp = http_client::retry_get(&project_url, 2).await?;
    let project: ModrinthProjectFromHash = project_resp
        .json()
        .await
        .map_err(|e| LauncherError::ModScan(format!("Modrinth project parse failed: {}", e)))?;

    Ok(ScanResult {
        file_name: String::new(),
        file_hash: sha1_hash.to_string(),
        project_id: Some(version.project_id),
        project_name: Some(project.title),
        project_slug: Some(project.slug),
        source: ScanSource::Modrinth,
        project_type: project.project_type,
        icon_url: project.icon_url,
    })
}

async fn query_curseforge_by_fingerprint(fp: u32) -> Result<ScanResult, LauncherError> {
    let url = url_config::curseforge_api_url("fingerprints/432");
    let body = serde_json::json!({ "fingerprints": [fp] });

    let client = http_client::build_client();
    let resp = client
        .post(&url)
        .headers(build_cf_headers())
        .json(&body)
        .send()
        .await
        .map_err(|e| LauncherError::ModScan(format!("CF fingerprint request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(LauncherError::ModScan(format!(
            "CF fingerprint API returned {}",
            resp.status()
        )));
    }

    let fp_resp: CfFingerprintResponse = resp
        .json()
        .await
        .map_err(|e| LauncherError::ModScan(format!("CF fingerprint parse failed: {}", e)))?;

    let match_info = fp_resp
        .data
        .exact_matches
        .into_iter()
        .next()
        .ok_or_else(|| LauncherError::ModScan("No CF fingerprint match".into()))?;

    let file = match_info
        .file
        .ok_or_else(|| LauncherError::ModScan("CF fingerprint match has no file".into()))?;

    if file.mod_id == 0 {
        return Err(LauncherError::ModScan("CF fingerprint match has modId=0".into()));
    }

    let cf_mod = crate::curseforge::get_mod(file.mod_id).await?;

    Ok(ScanResult {
        file_name: String::new(),
        file_hash: String::new(),
        project_id: Some(file.mod_id.to_string()),
        project_name: Some(cf_mod.title),
        project_slug: Some(cf_mod.slug),
        source: ScanSource::CurseForge,
        project_type: None,
        icon_url: if cf_mod.icon_url.is_empty() {
            None
        } else {
            Some(cf_mod.icon_url)
        },
    })
}

async fn scan_file_internal(file_name: &str, data: &[u8], sha1_hash: &str) -> Result<ScanResult, LauncherError> {
    if let Ok(mut result) = query_modrinth_by_hash(sha1_hash).await {
        result.file_name = file_name.to_string();
        return Ok(result);
    }

    let fp = fingerprint::curseforge_fingerprint(data);
    if fp != 0 {
        if let Ok(mut result) = query_curseforge_by_fingerprint(fp).await {
            result.file_name = file_name.to_string();
            result.file_hash = sha1_hash.to_string();
            return Ok(result);
        }
    }

    Ok(ScanResult {
        file_name: file_name.to_string(),
        file_hash: sha1_hash.to_string(),
        project_id: None,
        project_name: parse_mod_name_from_filename(file_name),
        project_slug: None,
        source: ScanSource::Fallback,
        project_type: None,
        icon_url: None,
    })
}

pub async fn scan_file(path: &Path, cache: &mut ScanCache) -> Result<ScanResult, LauncherError> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let data = std::fs::read(path).map_err(|e| {
        LauncherError::ModScan(format!("Failed to read file {:?}: {}", path, e))
    })?;

    let sha1_hash = compute_file_sha1(&data);

    if let Some(cached) = cache.get(&sha1_hash) {
        let mut result = cached.clone();
        result.file_name = file_name;
        return Ok(result);
    }

    let mut result = scan_file_internal(&file_name, &data, &sha1_hash).await?;
    let hash_for_cache = if result.file_hash.is_empty() { sha1_hash } else { result.file_hash.clone() };
    cache.insert(hash_for_cache, result.clone());
    Ok(result)
}

pub async fn scan_file_with_db_cache(
    path: &Path,
    mem_cache: &mut ScanCache,
    db: &ModCacheDb,
) -> Result<ScanResult, LauncherError> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let data = std::fs::read(path).map_err(|e| {
        LauncherError::ModScan(format!("Failed to read file {:?}: {}", path, e))
    })?;

    let sha1_hash = compute_file_sha1(&data);

    if let Some(cached) = mem_cache.get(&sha1_hash) {
        let mut result = cached.clone();
        result.file_name = file_name;
        return Ok(result);
    }

    if let Ok(Some(cached)) = db.get_mod_cache(&sha1_hash) {
        mem_cache.insert(sha1_hash.clone(), cached.clone());
        let mut result = cached;
        result.file_name = file_name;
        return Ok(result);
    }

    let mut result = scan_file_internal(&file_name, &data, &sha1_hash).await?;
    let hash_for_cache = if result.file_hash.is_empty() { sha1_hash.clone() } else { result.file_hash.clone() };
    mem_cache.insert(hash_for_cache.clone(), result.clone());
    let _ = db.save_mod_cache(&hash_for_cache, &result);
    Ok(result)
}

pub async fn scan_directory(dir: &Path, cache: &mut ScanCache) -> Result<Vec<ScanResult>, LauncherError> {
    if !dir.exists() {
        return Err(LauncherError::ModScan(format!(
            "Directory does not exist: {:?}",
            dir
        )));
    }

    let mut jar_files: Vec<PathBuf> = Vec::new();
    let entries = std::fs::read_dir(dir).map_err(|e| {
        LauncherError::ModScan(format!("Failed to read directory {:?}: {}", dir, e))
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            LauncherError::ModScan(format!("Failed to read directory entry: {}", e))
        })?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext == "jar" || ext == "zip" {
            jar_files.push(path);
        }
    }

    jar_files.sort();

    let mut results = Vec::with_capacity(jar_files.len());
    for file_path in &jar_files {
        match scan_file(file_path, cache).await {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::warn!("Failed to scan file {:?}: {}", file_path, e);
                let file_name = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                results.push(ScanResult {
                    file_name: file_name.clone(),
                    file_hash: String::new(),
                    project_id: None,
                    project_name: parse_mod_name_from_filename(&file_name),
                    project_slug: None,
                    source: ScanSource::Fallback,
                    project_type: None,
                    icon_url: None,
                });
            }
        }
    }

    Ok(results)
}

pub async fn scan_directory_concurrent(
    dir: &Path,
    mem_cache: &mut ScanCache,
    db: Arc<ModCacheDb>,
    max_concurrent: usize,
) -> Result<Vec<ScanResult>, LauncherError> {
    if !dir.exists() {
        return Err(LauncherError::ModScan(format!(
            "Directory does not exist: {:?}",
            dir
        )));
    }

    let entries: Vec<PathBuf> = std::fs::read_dir(dir)
        .map_err(|e| LauncherError::ModScan(format!("Read dir failed: {}", e)))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().and_then(|ext| ext.to_str()).map(|ext| {
                matches!(ext.to_lowercase().as_str(), "jar" | "zip" | "disabled")
            }).unwrap_or(false)
        })
        .map(|e| e.path())
        .collect();

    let semaphore = Arc::new(tokio::sync::Semaphore::new(max_concurrent));
    let original_cache = std::mem::take(mem_cache);
    let mem_cache_arc = Arc::new(tokio::sync::Mutex::new(original_cache));

    let mut handles = Vec::new();
    for path in entries {
        let sem = semaphore.clone();
        let cache = mem_cache_arc.clone();
        let db = db.clone();
        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let mut cache = cache.lock().await;
            scan_file_with_db_cache(&path, &mut cache, &db).await
        }));
    }

    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        match handle.await {
            Ok(Ok(result)) => results.push(result),
            Ok(Err(e)) => {
                tracing::warn!("Concurrent scan failed: {}", e);
            }
            Err(e) => {
                tracing::warn!("Concurrent scan task panicked: {}", e);
            }
        }
    }

    // Restore the memory cache - all tasks are done so Arc has single owner
    let mutex = Arc::try_unwrap(mem_cache_arc)
        .unwrap_or_else(|_| panic!("All scan tasks should be completed"));
    let restored = mutex.into_inner();
    *mem_cache = restored;

    Ok(results)
}

pub async fn scan_directory_with_db_cache(
    dir: &Path,
    mem_cache: &mut ScanCache,
    db: &ModCacheDb,
) -> Result<Vec<ScanResult>, LauncherError> {
    if !dir.exists() {
        return Err(LauncherError::ModScan(format!(
            "Directory does not exist: {:?}",
            dir
        )));
    }

    let mut jar_files: Vec<PathBuf> = Vec::new();
    let entries = std::fs::read_dir(dir).map_err(|e| {
        LauncherError::ModScan(format!("Failed to read directory {:?}: {}", dir, e))
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            LauncherError::ModScan(format!("Failed to read directory entry: {}", e))
        })?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext == "jar" || ext == "zip" {
            jar_files.push(path);
        }
    }

    jar_files.sort();

    let mut results = Vec::with_capacity(jar_files.len());
    for file_path in &jar_files {
        match scan_file_with_db_cache(file_path, mem_cache, db).await {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::warn!("Failed to scan file {:?}: {}", file_path, e);
                let file_name = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                results.push(ScanResult {
                    file_name: file_name.clone(),
                    file_hash: String::new(),
                    project_id: None,
                    project_name: parse_mod_name_from_filename(&file_name),
                    project_slug: None,
                    source: ScanSource::Fallback,
                    project_type: None,
                    icon_url: None,
                });
            }
        }
    }

    Ok(results)
}
