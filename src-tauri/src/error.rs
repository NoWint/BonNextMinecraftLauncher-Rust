use thiserror::Error;

#[derive(Error, Debug)]
pub enum LauncherError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("URL parse error: {0}")]
    Url(#[from] url::ParseError),

    #[error("Java not found")]
    JavaNotFound,

    #[error("Version not found: {0}")]
    VersionNotFound(String),

    #[error("Download failed after 3 retries: {0}")]
    DownloadFailed(String),

    #[error("SHA1 verification failed for {0}")]
    Sha1Mismatch(String),

    #[error("Launch failed: {0}")]
    LaunchFailed(String),

    #[error("Game crashed with exit code {0}")]
    GameCrashed(i32),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Not enough disk space: need {required}MB, have {available}MB")]
    DiskSpace { required: u64, available: u64 },

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for LauncherError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
