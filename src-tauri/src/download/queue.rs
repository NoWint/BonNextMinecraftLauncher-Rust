use crate::config;
use crate::download::source;
use crate::download::verifier;
use crate::error::LauncherError;
use crate::platform::paths;
use futures_util::StreamExt;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

const MAX_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 500;

fn compute_speed_eta(downloaded: u64, total: u64, elapsed: std::time::Duration) -> (u64, u64) {
    if downloaded == 0 || elapsed.as_millis() < 100 {
        return (0, 0);
    }
    let bytes_per_second = (downloaded as f64 / elapsed.as_secs_f64()) as u64;
    let remaining = total.saturating_sub(downloaded);
    let eta_seconds = remaining.checked_div(bytes_per_second).unwrap_or(0);
    (bytes_per_second, eta_seconds)
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub url: String,
    pub downloaded: u64,
    pub total: u64,
    pub finished: bool,
    pub error: Option<String>,
    pub bytes_per_second: u64,
    pub eta_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct DownloadTask {
    pub url: String,
    pub target_path: PathBuf,
    pub sha1: String,
    pub size: u64,
}

impl DownloadTask {
    pub fn new(url: impl Into<String>, target_path: impl Into<PathBuf>, sha1: impl Into<String>, size: u64) -> Self {
        DownloadTask {
            url: url.into(),
            target_path: target_path.into(),
            sha1: sha1.into(),
            size,
        }
    }

    pub fn is_already_valid(&self) -> bool {
        verifier::file_exists_and_valid(&self.target_path, &self.sha1, self.size, false)
    }
}

pub struct DownloadControlState {
    pub paused: Arc<std::sync::atomic::AtomicBool>,
    pub cancelled_urls: Arc<parking_lot::Mutex<HashSet<String>>>,
}

impl DownloadControlState {
    pub fn new() -> Self {
        DownloadControlState {
            paused: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            cancelled_urls: Arc::new(parking_lot::Mutex::new(HashSet::new())),
        }
    }

    pub fn pause(&self) {
        self.paused.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn resume(&self) {
        self.paused.store(false, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub fn cancel(&self, url: &str) {
        self.cancelled_urls.lock().insert(url.to_string());
    }

    pub fn clear_cancelled(&self, url: &str) {
        self.cancelled_urls.lock().remove(url);
    }
}

pub struct DownloadQueue {
    client: reqwest::Client,
    semaphore: Arc<Semaphore>,
    event_callback: Option<Arc<dyn Fn(DownloadProgress) + Send + Sync>>,
    paused: Arc<std::sync::atomic::AtomicBool>,
    cancelled_urls: Arc<parking_lot::Mutex<HashSet<String>>>,
}

impl DownloadQueue {
    pub fn new() -> Self {
        Self::with_control(DownloadControlState::new())
    }

    pub fn with_control(control: DownloadControlState) -> Self {
        let max_concurrent = config::get_max_concurrent_downloads();
        DownloadQueue {
            client: crate::http_client::build_download_client().clone(),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            event_callback: None,
            paused: control.paused,
            cancelled_urls: control.cancelled_urls,
        }
    }

    pub fn with_callback<F>(mut self, callback: F) -> Self
    where
        F: Fn(DownloadProgress) + Send + Sync + 'static,
    {
        self.event_callback = Some(Arc::new(callback));
        self
    }

    fn emit_progress(&self, progress: DownloadProgress) {
        if let Some(ref cb) = self.event_callback {
            cb(progress);
        }
    }

    pub fn pause(&self) {
        self.paused.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn resume(&self) {
        self.paused.store(false, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.paused.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub fn cancel(&self, url: &str) {
        self.cancelled_urls.lock().insert(url.to_string());
    }

    pub fn is_cancelled(&self, url: &str) -> bool {
        self.cancelled_urls.lock().contains(url)
    }

    pub fn clear_cancelled(&self, url: &str) {
        self.cancelled_urls.lock().remove(url);
    }

    async fn wait_while_paused(&self) {
        while self.paused.load(std::sync::atomic::Ordering::SeqCst) {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
    }

    pub async fn download_single(&self, task: &DownloadTask) -> Result<(), LauncherError> {
        if self.is_cancelled(&task.url) {
            return Err(LauncherError::DownloadFailed("cancelled".to_string()));
        }

        if task.is_already_valid() {
            self.emit_progress(DownloadProgress {
                url: task.url.clone(),
                downloaded: task.size,
                total: task.size,
                finished: true,
                error: None,
                bytes_per_second: 0,
                eta_seconds: 0,
            });
            return Ok(());
        }

        let fallback_urls = source::SourceManager::transform_with_fallback(&task.url);
        let mut last_error: Option<String> = None;

        for (source_name, transformed_url) in &fallback_urls {
            for attempt in 0..=MAX_RETRIES {
                self.wait_while_paused().await;

                if self.is_cancelled(&task.url) {
                    let _ = std::fs::remove_file(&task.target_path);
                    return Err(LauncherError::DownloadFailed("cancelled".to_string()));
                }

                if attempt > 0 {
                    let delay = RETRY_BASE_DELAY_MS * 2u64.pow(attempt - 1);
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                    tracing::warn!(
                        "Retrying download (attempt {}/{}): {}",
                        attempt,
                        MAX_RETRIES,
                        transformed_url
                    );
                }

                match self.do_download(transformed_url, &task.target_path, task.size).await {
                    Ok(downloaded) => {
                        if !task.sha1.is_empty() {
                            if let Err(e) = verifier::verify_file_sha1(&task.target_path, &task.sha1) {
                                tracing::error!("SHA1 verification failed: {}", e);
                                let _ = tokio::fs::remove_file(&task.target_path).await;
                                last_error = Some(e.to_string());
                                continue;
                            }
                        }

                        self.emit_progress(DownloadProgress {
                            url: task.url.clone(),
                            downloaded,
                            total: task.size,
                            finished: true,
                            error: None,
                            bytes_per_second: 0,
                            eta_seconds: 0,
                        });
                        return Ok(());
                    }
                    Err(e) => {
                        last_error = Some(e.to_string());
                        tracing::error!(
                            "Download failed via {} (attempt {}/{}): {} - {}",
                            source_name,
                            attempt + 1,
                            MAX_RETRIES + 1,
                            transformed_url,
                            e
                        );
                    }
                }
            }

            tracing::warn!("Source {} exhausted, trying next source...", source_name);
        }

        let _ = std::fs::remove_file(&task.target_path);

        Err(LauncherError::DownloadFailed(
            last_error.unwrap_or_else(|| "all sources failed".to_string()),
        ))
    }

    async fn do_download(
        &self,
        url: &str,
        target_path: &Path,
        expected_size: u64,
    ) -> Result<u64, LauncherError> {
        if let Some(parent) = target_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let mut response = self.client.get(url).send().await?;
        response = response.error_for_status()?;

        let total_size = response.content_length().unwrap_or(expected_size);

        let mut file = tokio::io::BufWriter::new(tokio::fs::File::create(target_path).await?);

        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_emit = std::time::Instant::now();
        let start_time = std::time::Instant::now();

        while let Some(chunk_result) = stream.next().await {
            self.wait_while_paused().await;

            if self.is_cancelled(url) {
                drop(file);
                let _ = tokio::fs::remove_file(target_path).await;
                return Err(LauncherError::DownloadFailed("cancelled".to_string()));
            }

            let chunk = chunk_result?;
            tokio::io::copy(&mut &chunk[..], &mut file).await?;
            downloaded += chunk.len() as u64;

            let now = std::time::Instant::now();
            if now.duration_since(last_emit).as_millis() >= 200 {
                last_emit = now;
                let elapsed = start_time.elapsed();
                let (bytes_per_second, eta_seconds) = compute_speed_eta(downloaded, total_size, elapsed);
                self.emit_progress(DownloadProgress {
                    url: url.to_string(),
                    downloaded,
                    total: total_size,
                    finished: false,
                    error: None,
                    bytes_per_second,
                    eta_seconds,
                });
            }
        }

        file.flush().await?;

        Ok(downloaded)
    }

    pub async fn download_all(
        &self,
        tasks: Vec<DownloadTask>,
    ) -> Result<Vec<Result<(), LauncherError>>, LauncherError> {
        let total = tasks.len();
        let mut results = Vec::with_capacity(total);
        let mut handles = Vec::with_capacity(total);

        for (index, task) in tasks.into_iter().enumerate() {
            let permit = self.semaphore.clone().acquire_owned().await?;
            let client = self.client.clone();
            let callback = self.event_callback.clone();
            let semaphore = self.semaphore.clone();
            let paused = self.paused.clone();
            let cancelled_urls = self.cancelled_urls.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit;
                let queue = DownloadQueue {
                    client,
                    semaphore,
                    event_callback: callback,
                    paused,
                    cancelled_urls,
                };
                let result = queue.download_single(&task).await;
                if let Some(ref cb) = queue.event_callback {
                    cb(DownloadProgress {
                        url: task.url.clone(),
                        downloaded: if result.is_ok() { task.size } else { 0 },
                        total: task.size,
                        finished: true,
                        error: result.as_ref().err().map(|e| e.to_string()),
                        bytes_per_second: 0,
                        eta_seconds: 0,
                    });
                }
                (index, result)
            });

            handles.push(handle);
        }

        for handle in handles {
            let (index, result) = handle.await?;
            while results.len() <= index {
                results.push(Err(LauncherError::Other("missing result".to_string())));
            }
            results[index] = result;
        }

        Ok(results)
    }
}

pub fn build_version_download_tasks(
    version_id: &str,
    client_url: &str,
    client_sha1: &str,
    client_size: u64,
) -> Vec<DownloadTask> {
    let versions_dir = paths::get_versions_dir();
    let version_dir = versions_dir.join(version_id);

    let mut tasks = Vec::new();

    tasks.push(DownloadTask::new(
        client_url,
        version_dir.join(format!("{}.jar", version_id)),
        client_sha1,
        client_size,
    ));

    tasks
}

pub fn build_library_download_tasks(
    libraries: &[crate::version::resolver::LibraryArtifact],
) -> Vec<DownloadTask> {
    let libraries_dir = paths::get_libraries_dir();

    libraries
        .iter()
        .map(|lib| {
            DownloadTask::new(
                &lib.url,
                libraries_dir.join(&lib.path),
                &lib.sha1,
                lib.size,
            )
        })
        .collect()
}

pub fn build_asset_index_task(
    asset_index: &crate::version::resolver::AssetIndex,
) -> DownloadTask {
    let assets_dir = paths::get_assets_dir();
    let index_dir = assets_dir.join("indexes");

    DownloadTask::new(
        &asset_index.url,
        index_dir.join(format!("{}.json", asset_index.id)),
        &asset_index.sha1,
        asset_index.size,
    )
}

pub fn build_logging_config_task(
    version_id: &str,
    url: &str,
) -> DownloadTask {
    let versions_dir = paths::get_versions_dir();
    let version_dir = versions_dir.join(version_id);
    let file_name = url.rsplit('/').next().unwrap_or("log4j.xml");
    DownloadTask::new(
        url,
        version_dir.join(file_name),
        "", // SHA1 not always known for logging config
        0,
    )
}

pub async fn build_asset_object_tasks(
    asset_index_id: &str,
) -> Result<Vec<DownloadTask>, LauncherError> {
    let assets_dir = paths::get_assets_dir();
    let index_path = assets_dir.join("indexes").join(format!("{}.json", asset_index_id));

    if !index_path.exists() {
        return Err(LauncherError::AssetIndexNotFound(format!(
            "Asset index file not found: {}",
            index_path.display()
        )));
    }

    let content = std::fs::read_to_string(&index_path)?;
    let index: serde_json::Value = serde_json::from_str(&content)?;

    let objects = index
        .get("objects")
        .and_then(|o| o.as_object())
        .ok_or_else(|| LauncherError::AssetIndexNotFound("Invalid asset index format".to_string()))?;

    let mut tasks = Vec::new();

    for (_name, value) in objects {
        if let Some(obj) = value.as_object() {
            let hash = obj
                .get("hash")
                .and_then(|h| h.as_str())
                .unwrap_or("");
            let size = obj
                .get("size")
                .and_then(|s| s.as_u64())
                .unwrap_or(0);

            if hash.is_empty() {
                continue;
            }

            let url = source::asset_download_url(hash);
            let local_path = source::asset_local_path(&assets_dir, hash);

            tasks.push(DownloadTask::new(url, local_path, hash, size));
        }
    }

    Ok(tasks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_speed_eta_zero_downloaded() {
        let (speed, eta) = compute_speed_eta(0, 1000, std::time::Duration::from_secs(1));
        assert_eq!(speed, 0);
        assert_eq!(eta, 0);
    }

    #[test]
    fn compute_speed_eta_short_elapsed() {
        let (speed, eta) = compute_speed_eta(500, 1000, std::time::Duration::from_millis(50));
        assert_eq!(speed, 0);
        assert_eq!(eta, 0);
    }

    #[test]
    fn compute_speed_eta_normal() {
        let (speed, eta) = compute_speed_eta(500, 1000, std::time::Duration::from_secs(1));
        assert_eq!(speed, 500);
        assert_eq!(eta, 1);
    }

    #[test]
    fn compute_speed_eta_complete() {
        let (speed, eta) = compute_speed_eta(1000, 1000, std::time::Duration::from_secs(2));
        assert_eq!(speed, 500);
        assert_eq!(eta, 0);
    }

    #[test]
    fn compute_speed_eta_partial() {
        let (speed, eta) = compute_speed_eta(750, 1000, std::time::Duration::from_secs(3));
        assert_eq!(speed, 250);
        assert_eq!(eta, 1);
    }

    #[test]
    fn download_task_new() {
        let task = DownloadTask::new(
            "https://example.com/file.jar",
            "/tmp/file.jar",
            "abc123",
            1024,
        );
        assert_eq!(task.url, "https://example.com/file.jar");
        assert_eq!(task.target_path, std::path::PathBuf::from("/tmp/file.jar"));
        assert_eq!(task.sha1, "abc123");
        assert_eq!(task.size, 1024);
    }

    #[test]
    fn download_progress_serializes() {
        let progress = DownloadProgress {
            url: "https://example.com/file.jar".to_string(),
            downloaded: 500,
            total: 1000,
            finished: false,
            error: None,
            bytes_per_second: 500,
            eta_seconds: 1,
        };
        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("\"url\""));
        assert!(json.contains("\"downloaded\":500"));
        assert!(json.contains("\"total\":1000"));
        assert!(json.contains("\"finished\":false"));
    }

    #[test]
    fn download_progress_with_error_serializes() {
        let progress = DownloadProgress {
            url: "https://example.com/file.jar".to_string(),
            downloaded: 0,
            total: 1000,
            finished: true,
            error: Some("connection timeout".to_string()),
            bytes_per_second: 0,
            eta_seconds: 0,
        };
        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("\"error\":[\"connection timeout\"]"));
    }

    #[test]
    fn retry_constants_sensible() {
        assert!(MAX_RETRIES >= 1, "Should have at least 1 retry");
        assert!(RETRY_BASE_DELAY_MS > 0, "Base delay should be positive");
        let delay_1 = RETRY_BASE_DELAY_MS * 2u64.pow(0);
        let delay_2 = RETRY_BASE_DELAY_MS * 2u64.pow(1);
        let delay_3 = RETRY_BASE_DELAY_MS * 2u64.pow(2);
        assert!(delay_1 < delay_2);
        assert!(delay_2 < delay_3);
    }

    #[test]
    fn download_task_is_already_valid_nonexistent() {
        let task = DownloadTask::new(
            "https://example.com/file.jar",
            "/tmp/nonexistent_test_file_12345.jar",
            "abc123",
            1024,
        );
        assert!(!task.is_already_valid());
    }

    #[test]
    fn download_task_empty_sha1_nonexistent_file() {
        let task = DownloadTask::new(
            "https://example.com/file.jar",
            "/tmp/nonexistent_test_file_12345.jar",
            "",
            0,
        );
        assert!(!task.is_already_valid());
    }
}
