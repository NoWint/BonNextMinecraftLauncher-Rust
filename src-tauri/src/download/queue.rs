use crate::config;
use crate::download::source;
use crate::download::verifier;
use crate::error::LauncherError;
use crate::platform::paths;
use futures_util::StreamExt;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

const MAX_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 500;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub url: String,
    pub downloaded: u64,
    pub total: u64,
    pub finished: bool,
    pub error: Option<String>,
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
        verifier::file_exists_and_valid(&self.target_path, &self.sha1, self.size)
    }
}

pub struct DownloadQueue {
    client: reqwest::Client,
    semaphore: Arc<Semaphore>,
    event_callback: Option<Arc<dyn Fn(DownloadProgress) + Send + Sync>>,
}

impl DownloadQueue {
    pub fn new() -> Self {
        let max_concurrent = config::get_max_concurrent_downloads();
        DownloadQueue {
            client: crate::http_client::build_download_client(),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            event_callback: None,
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

    pub async fn download_single(&self, task: &DownloadTask) -> Result<(), LauncherError> {
        if task.is_already_valid() {
            self.emit_progress(DownloadProgress {
                url: task.url.clone(),
                downloaded: task.size,
                total: task.size,
                finished: true,
                error: None,
            });
            return Ok(());
        }

        let transformed_url = source::transform_url(&task.url);

        let mut last_error: Option<String> = None;

        for attempt in 0..=MAX_RETRIES {
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

            match self.do_download(&transformed_url, &task.target_path, task.size).await {
                Ok(downloaded) => {
                    if !task.sha1.is_empty() {
                        if let Err(e) = verifier::verify_file_sha1(&task.target_path, &task.sha1) {
                            tracing::error!("SHA1 verification failed: {}", e);
                            let _ = std::fs::remove_file(&task.target_path);
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
                    });
                    return Ok(());
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                    tracing::error!(
                        "Download failed (attempt {}/{}): {} - {}",
                        attempt + 1,
                        MAX_RETRIES + 1,
                        transformed_url,
                        e
                    );
                }
            }
        }

        let _ = std::fs::remove_file(&task.target_path);

        Err(LauncherError::DownloadFailed(
            last_error.unwrap_or_else(|| "unknown error".to_string()),
        ))
    }

    async fn do_download(
        &self,
        url: &str,
        target_path: &Path,
        expected_size: u64,
    ) -> Result<u64, LauncherError> {
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut response = self.client.get(url).send().await?;
        response = response.error_for_status()?;

        let total_size = response.content_length().unwrap_or(expected_size);

        let mut file = tokio::io::BufWriter::new(tokio::fs::File::create(target_path).await?);

        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_emit = std::time::Instant::now();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            tokio::io::copy(&mut &chunk[..], &mut file).await?;
            downloaded += chunk.len() as u64;

            let now = std::time::Instant::now();
            if now.duration_since(last_emit).as_millis() >= 200 {
                last_emit = now;
                self.emit_progress(DownloadProgress {
                    url: url.to_string(),
                    downloaded,
                    total: total_size,
                    finished: false,
                    error: None,
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

            let handle = tokio::spawn(async move {
                let _permit = permit;
                let queue = DownloadQueue {
                    client,
                    semaphore,
                    event_callback: callback,
                };
                let result = queue.download_single(&task).await;
                if let Some(ref cb) = queue.event_callback {
                    cb(DownloadProgress {
                        url: task.url.clone(),
                        downloaded: if result.is_ok() { task.size } else { 0 },
                        total: task.size,
                        finished: true,
                        error: result.as_ref().err().map(|e| e.to_string()),
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
        return Err(LauncherError::Other(format!(
            "Asset index file not found: {}",
            index_path.display()
        )));
    }

    let content = std::fs::read_to_string(&index_path)?;
    let index: serde_json::Value = serde_json::from_str(&content)?;

    let objects = index
        .get("objects")
        .and_then(|o| o.as_object())
        .ok_or_else(|| LauncherError::Other("Invalid asset index format".to_string()))?;

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
