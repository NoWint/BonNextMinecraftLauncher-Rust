use crate::error::LauncherError;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone)]
pub struct DownloadItem {
    pub url: String,
    pub path: PathBuf,
    pub sha1: String,
    pub size: u64,
}

pub struct DownloadProgress {
    pub total_files: u64,
    pub completed_files: AtomicU64,
    pub total_bytes: u64,
    pub downloaded_bytes: AtomicU64,
    pub current_file: parking_lot::Mutex<String>,
}

impl DownloadProgress {
    pub fn new(total_files: u64, total_bytes: u64) -> Self {
        Self {
            total_files,
            completed_files: AtomicU64::new(0),
            total_bytes,
            downloaded_bytes: AtomicU64::new(0),
            current_file: parking_lot::Mutex::new(String::new()),
        }
    }

    pub fn get_progress(&self) -> DownloadProgressSnapshot {
        DownloadProgressSnapshot {
            total_files: self.total_files,
            completed_files: self.completed_files.load(Ordering::SeqCst),
            total_bytes: self.total_bytes,
            downloaded_bytes: self.downloaded_bytes.load(Ordering::SeqCst),
            current_file: self.current_file.lock().clone(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgressSnapshot {
    pub total_files: u64,
    pub completed_files: u64,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub current_file: String,
}

async fn download_single(
    item: &DownloadItem,
    progress: Arc<DownloadProgress>,
) -> Result<(), LauncherError> {
    if let Some(parent) = item.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    *progress.current_file.lock() = item
        .path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let client = reqwest::Client::new();
    let mut existing_size = 0u64;

    if item.path.exists() {
        existing_size = tokio::fs::metadata(&item.path).await?.len();
    }

    let mut request = client.get(&item.url);
    if existing_size > 0 && existing_size < item.size {
        request = request.header("Range", format!("bytes={}-", existing_size));
    }

    let response = request.send().await?.error_for_status()?;

    let file = if existing_size > 0 && existing_size < item.size {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&item.path)
            .await?
    } else {
        tokio::fs::File::create(&item.path).await?
    };

    let mut file = file;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        progress
            .downloaded_bytes
            .fetch_add(chunk.len() as u64, Ordering::SeqCst);
    }

    Ok(())
}

pub async fn download_all(
    items: Vec<DownloadItem>,
    concurrency: usize,
) -> Result<Arc<DownloadProgress>, LauncherError> {
    let total_bytes: u64 = items.iter().map(|i| i.size).sum();
    let total_files = items.len() as u64;
    let progress = Arc::new(DownloadProgress::new(total_files, total_bytes));

    let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for item in items {
        let item = item.clone();
        let progress = progress.clone();
        let permit = semaphore.clone().acquire_owned().await.unwrap();

        handles.push(tokio::spawn(async move {
            let _permit = permit;
            let mut last_err = None;
            for attempt in 0u32..3 {
                match download_single(&item, progress.clone()).await {
                    Ok(()) => {
                        match super::verifier::verify_sha1(&item.path, &item.sha1) {
                            Ok(true) => {
                                progress.completed_files.fetch_add(1, Ordering::SeqCst);
                                return Ok::<_, LauncherError>(());
                            }
                            Ok(false) => {
                                let _ = std::fs::remove_file(&item.path);
                                last_err = Some(LauncherError::Sha1Mismatch(
                                    item.path
                                        .file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string(),
                                ));
                            }
                            Err(e) => {
                                last_err = Some(LauncherError::Io(e));
                            }
                        }
                    }
                    Err(e) => {
                        last_err = Some(e);
                    }
                }
                if attempt < 2 {
                    tokio::time::sleep(tokio::time::Duration::from_secs(1 << attempt)).await;
                }
            }
            Err(last_err.unwrap_or_else(|| {
                LauncherError::DownloadFailed(item.url.clone())
            }))
        }));
    }

    for handle in handles {
        handle.await.unwrap()?;
    }

    Ok(progress)
}
