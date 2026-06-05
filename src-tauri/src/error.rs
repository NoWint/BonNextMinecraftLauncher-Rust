use thiserror::Error;

#[derive(Error, Debug)]
#[allow(dead_code)]
pub enum LauncherError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("HTTP {status} error for {url}")]
    HttpError { status: u16, url: String },

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

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("ZIP error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Decryption error: {0}")]
    Decryption(String),

    #[error("Security validation failed: {0}")]
    SecurityValidation(String),

    #[error("Sandbox error: {0}")]
    SandboxError(String),

    #[error("Audit log error: {0}")]
    AuditLog(String),

    #[error("Terracotta is not installed")]
    TerracottaNotInstalled,

    #[error("Terracotta is not running")]
    TerracottaNotRunning,

    #[error("Asset index not found: {0}")]
    AssetIndexNotFound(String),

    #[error("Instance not ready: {0}")]
    InstanceNotReady(String),

    #[error("Task join failed: {0}")]
    TaskJoinFailed(String),

    #[error("Semaphore acquire failed: {0}")]
    SemaphoreAcquireFailed(String),

    #[error("Authentication expired: {0}")]
    AuthExpired(String),

    #[error("Rate limited, retry after {retry_after:?} seconds")]
    RateLimited { retry_after: Option<u64> },

    #[error("Network unreachable")]
    NetworkUnreachable,

    #[error("Disk full at {path}: need {required}MB, have {available}MB")]
    DiskFull { path: String, required: u64, available: u64 },

    #[error("Mod conflict: {mod_a} conflicts with {mod_b} — {reason}")]
    ModConflict { mod_a: String, mod_b: String, reason: String },

    #[error("Version incompatible: required {required}, actual {actual}")]
    VersionIncompatible { required: String, actual: String },

    #[error("Instance locked: {0}")]
    InstanceLocked(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Server connection failed: {0}")]
    ServerConnectionFailed(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Workflow error: {0}")]
    WorkflowError(String),

    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("Workflow step failed: {step} — {reason}")]
    WorkflowStepFailed { step: String, reason: String },

    #[error("Crash watcher error: {0}")]
    CrashWatcherError(String),

    #[error("Mod compatibility error: {0}")]
    ModCompatError(String),

    #[error("Modpack plan validation failed: {0}")]
    ModpackPlanValidation(String),

    #[error("Crash knowledge base error: {0}")]
    CrashKnowledgeError(String),

    #[error("Mod scan error: {0}")]
    ModScan(String),

    #[error("Fingerprint calculation error: {0}")]
    FingerprintCalculation(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("URL config error: {0}")]
    UrlConfig(String),

    #[error("Server ping error: {0}")]
    ServerPing(String),

    #[error("File watch error: {0}")]
    FileWatch(String),

    #[deprecated(note = "Use a specific variant instead of Other")]
    #[error("{0}")]
    Other(String),
}

impl LauncherError {
    pub fn error_code(&self) -> &str {
        match self {
            Self::Http(_) => "HTTP_ERROR",
            Self::HttpError { .. } => "HTTP_ERROR",
            Self::Io(_) => "IO_ERROR",
            Self::Json(_) => "JSON_ERROR",
            Self::Url(_) => "URL_ERROR",
            Self::JavaNotFound => "JAVA_NOT_FOUND",
            Self::VersionNotFound(_) => "VERSION_NOT_FOUND",
            Self::DownloadFailed(_) => "DOWNLOAD_FAILED",
            Self::Sha1Mismatch(_) => "SHA1_MISMATCH",
            Self::LaunchFailed(_) => "LAUNCH_FAILED",
            Self::GameCrashed(_) => "GAME_CRASHED",
            Self::AuthFailed(_) => "AUTH_FAILED",
            Self::DiskSpace { .. } => "DISK_SPACE",
            Self::InvalidConfig(_) => "INVALID_CONFIG",
            Self::Zip(_) => "ZIP_ERROR",
            Self::Encryption(_) => "ENCRYPTION_ERROR",
            Self::Decryption(_) => "DECRYPTION_ERROR",
            Self::SecurityValidation(_) => "SECURITY_VALIDATION",
            Self::SandboxError(_) => "SANDBOX_ERROR",
            Self::AuditLog(_) => "AUDIT_LOG_ERROR",
            Self::TerracottaNotInstalled => "TERRACOTTA_NOT_INSTALLED",
            Self::TerracottaNotRunning => "TERRACOTTA_NOT_RUNNING",
            Self::AssetIndexNotFound(_) => "ASSET_INDEX_NOT_FOUND",
            Self::InstanceNotReady(_) => "INSTANCE_NOT_READY",
            Self::TaskJoinFailed(_) => "TASK_JOIN_FAILED",
            Self::SemaphoreAcquireFailed(_) => "SEMAPHORE_ACQUIRE_FAILED",
            Self::AuthExpired(_) => "AUTH_EXPIRED",
            Self::RateLimited { .. } => "RATE_LIMITED",
            Self::NetworkUnreachable => "NETWORK_UNREACHABLE",
            Self::DiskFull { .. } => "DISK_FULL",
            Self::ModConflict { .. } => "MOD_CONFLICT",
            Self::VersionIncompatible { .. } => "VERSION_INCOMPATIBLE",
            Self::InstanceLocked(_) => "INSTANCE_LOCKED",
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::ServerConnectionFailed(_) => "SERVER_CONNECTION_FAILED",
            Self::ConfigError(_) => "CONFIG_ERROR",
            Self::WorkflowError(_) => "WORKFLOW_ERROR",
            Self::WorkflowNotFound(_) => "WORKFLOW_NOT_FOUND",
            Self::WorkflowStepFailed { .. } => "WORKFLOW_STEP_FAILED",
            Self::CrashWatcherError(_) => "CRASH_WATCHER_ERROR",
            Self::ModCompatError(_) => "MOD_COMPAT_ERROR",
            Self::ModpackPlanValidation(_) => "MODPACK_PLAN_VALIDATION",
            Self::CrashKnowledgeError(_) => "CRASH_KNOWLEDGE_ERROR",
            Self::ModScan(_) => "MOD_SCAN",
            Self::FingerprintCalculation(_) => "FINGERPRINT_CALCULATION",
            Self::Database(_) => "DATABASE",
            Self::UrlConfig(_) => "URL_CONFIG",
            Self::ServerPing(_) => "SERVER_PING",
            Self::FileWatch(_) => "FILE_WATCH",
            #[allow(deprecated)]
            Self::Other(_) => "OTHER",
        }
    }

    pub fn suggestion(&self) -> Option<&str> {
        match self {
            Self::AuthExpired(_) => Some("Please re-login to refresh your credentials"),
            Self::RateLimited { .. } => Some("Wait a moment and try again"),
            Self::NetworkUnreachable => Some("Check your internet connection"),
            Self::HttpError { .. } => Some("Check your internet connection or try switching download source in settings"),
            Self::DiskFull { .. } => Some("Free up disk space or change the game directory"),
            Self::JavaNotFound => Some("Install Java or configure the Java path in settings"),
            Self::AuthFailed(_) => Some("Please re-login"),
            Self::ModConflict { .. } => Some("Remove one of the conflicting mods"),
            Self::VersionIncompatible { .. } => Some("Update the mod or use a compatible version"),
            Self::InstanceLocked(_) => Some("Wait for the current operation to finish"),
            Self::ModScan(_) => Some("Check that the mod file is valid and not corrupted"),
            Self::FingerprintCalculation(_) => Some("Ensure the file is accessible and not locked by another process"),
            Self::Database(_) => Some("Try clearing the mod cache in settings"),
            Self::UrlConfig(_) => Some("Check your network configuration"),
            Self::ServerPing(_) => Some("Check that the server address is correct and the server is online"),
            Self::FileWatch(_) => Some("Check that the directory exists and is accessible"),
            _ => None,
        }
    }

    pub fn with_context(self, ctx: &str) -> Self {
        match self {
            Self::Io(e) => Self::Io(std::io::Error::new(e.kind(), format!("{}: {}", ctx, e))),
            other => LauncherError::LaunchFailed(format!("{}: {}", ctx, other)),
        }
    }
}

impl From<tokio::task::JoinError> for LauncherError {
    fn from(e: tokio::task::JoinError) -> Self {
        LauncherError::TaskJoinFailed(e.to_string())
    }
}

impl From<tokio::sync::AcquireError> for LauncherError {
    fn from(e: tokio::sync::AcquireError) -> Self {
        LauncherError::SemaphoreAcquireFailed(e.to_string())
    }
}

impl serde::Serialize for LauncherError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        use serde::ser::SerializeMap;
        let type_str = match self {
            LauncherError::Http(_) => "Http",
            LauncherError::HttpError { .. } => "HttpError",
            LauncherError::Io(_) => "Io",
            LauncherError::Json(_) => "Json",
            LauncherError::Url(_) => "Url",
            LauncherError::JavaNotFound => "JavaNotFound",
            LauncherError::VersionNotFound(_) => "VersionNotFound",
            LauncherError::DownloadFailed(_) => "DownloadFailed",
            LauncherError::Sha1Mismatch(_) => "Sha1Mismatch",
            LauncherError::LaunchFailed(_) => "LaunchFailed",
            LauncherError::GameCrashed(_) => "GameCrashed",
            LauncherError::AuthFailed(_) => "AuthFailed",
            LauncherError::DiskSpace { .. } => "DiskSpace",
            LauncherError::InvalidConfig(_) => "InvalidConfig",
            LauncherError::Zip(_) => "Zip",
            LauncherError::Encryption(_) => "Encryption",
            LauncherError::Decryption(_) => "Decryption",
            LauncherError::SecurityValidation(_) => "SecurityValidation",
            LauncherError::SandboxError(_) => "SandboxError",
            LauncherError::AuditLog(_) => "AuditLog",
            LauncherError::TerracottaNotInstalled => "TerracottaNotInstalled",
            LauncherError::TerracottaNotRunning => "TerracottaNotRunning",
            LauncherError::AssetIndexNotFound(_) => "AssetIndexNotFound",
            LauncherError::InstanceNotReady(_) => "InstanceNotReady",
            LauncherError::TaskJoinFailed(_) => "TaskJoinFailed",
            LauncherError::SemaphoreAcquireFailed(_) => "SemaphoreAcquireFailed",
            LauncherError::AuthExpired(_) => "AuthExpired",
            LauncherError::RateLimited { .. } => "RateLimited",
            LauncherError::NetworkUnreachable => "NetworkUnreachable",
            LauncherError::DiskFull { .. } => "DiskFull",
            LauncherError::ModConflict { .. } => "ModConflict",
            LauncherError::VersionIncompatible { .. } => "VersionIncompatible",
            LauncherError::InstanceLocked(_) => "InstanceLocked",
            LauncherError::InvalidInput(_) => "InvalidInput",
            LauncherError::ServerConnectionFailed(_) => "ServerConnectionFailed",
            LauncherError::ConfigError(_) => "ConfigError",
            LauncherError::WorkflowError(_) => "WorkflowError",
            LauncherError::WorkflowNotFound(_) => "WorkflowNotFound",
            LauncherError::WorkflowStepFailed { .. } => "WorkflowStepFailed",
            LauncherError::CrashWatcherError(_) => "CrashWatcherError",
            LauncherError::ModCompatError(_) => "ModCompatError",
            LauncherError::ModpackPlanValidation(_) => "ModpackPlanValidation",
            LauncherError::CrashKnowledgeError(_) => "CrashKnowledgeError",
            LauncherError::ModScan(_) => "ModScan",
            LauncherError::FingerprintCalculation(_) => "FingerprintCalculation",
            LauncherError::Database(_) => "Database",
            LauncherError::UrlConfig(_) => "UrlConfig",
            LauncherError::ServerPing(_) => "ServerPing",
            LauncherError::FileWatch(_) => "FileWatch",
            #[allow(deprecated)]
            LauncherError::Other(_) => "Other",
        };
        let mut map = serializer.serialize_map(Some(4))?;
        map.serialize_entry("type", type_str)?;
        map.serialize_entry("code", self.error_code())?;
        map.serialize_entry("message", &self.to_string())?;
        if let Some(s) = self.suggestion() {
            map.serialize_entry("suggestion", s)?;
        }
        map.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn serialize_error(error: &LauncherError) -> serde_json::Value {
        serde_json::to_value(error).unwrap()
    }

    #[test]
    fn error_code_all_variants() {
        assert_eq!(LauncherError::JavaNotFound.error_code(), "JAVA_NOT_FOUND");
        assert_eq!(LauncherError::VersionNotFound("1.20".into()).error_code(), "VERSION_NOT_FOUND");
        assert_eq!(LauncherError::DownloadFailed("x".into()).error_code(), "DOWNLOAD_FAILED");
        assert_eq!(LauncherError::Sha1Mismatch("f".into()).error_code(), "SHA1_MISMATCH");
        assert_eq!(LauncherError::LaunchFailed("x".into()).error_code(), "LAUNCH_FAILED");
        assert_eq!(LauncherError::GameCrashed(1).error_code(), "GAME_CRASHED");
        assert_eq!(LauncherError::AuthFailed("x".into()).error_code(), "AUTH_FAILED");
        assert_eq!(LauncherError::DiskSpace { required: 1, available: 0 }.error_code(), "DISK_SPACE");
        assert_eq!(LauncherError::InvalidConfig("x".into()).error_code(), "INVALID_CONFIG");
        assert_eq!(LauncherError::Encryption("x".into()).error_code(), "ENCRYPTION_ERROR");
        assert_eq!(LauncherError::Decryption("x".into()).error_code(), "DECRYPTION_ERROR");
        assert_eq!(LauncherError::SecurityValidation("x".into()).error_code(), "SECURITY_VALIDATION");
        assert_eq!(LauncherError::SandboxError("x".into()).error_code(), "SANDBOX_ERROR");
        assert_eq!(LauncherError::AuditLog("x".into()).error_code(), "AUDIT_LOG_ERROR");
        assert_eq!(LauncherError::TerracottaNotInstalled.error_code(), "TERRACOTTA_NOT_INSTALLED");
        assert_eq!(LauncherError::TerracottaNotRunning.error_code(), "TERRACOTTA_NOT_RUNNING");
        assert_eq!(LauncherError::AssetIndexNotFound("x".into()).error_code(), "ASSET_INDEX_NOT_FOUND");
        assert_eq!(LauncherError::InstanceNotReady("x".into()).error_code(), "INSTANCE_NOT_READY");
        assert_eq!(LauncherError::TaskJoinFailed("x".into()).error_code(), "TASK_JOIN_FAILED");
        assert_eq!(LauncherError::SemaphoreAcquireFailed("x".into()).error_code(), "SEMAPHORE_ACQUIRE_FAILED");
        assert_eq!(LauncherError::AuthExpired("x".into()).error_code(), "AUTH_EXPIRED");
        assert_eq!(LauncherError::RateLimited { retry_after: None }.error_code(), "RATE_LIMITED");
        assert_eq!(LauncherError::NetworkUnreachable.error_code(), "NETWORK_UNREACHABLE");
        assert_eq!(LauncherError::DiskFull { path: "/tmp".into(), required: 100, available: 50 }.error_code(), "DISK_FULL");
        assert_eq!(LauncherError::ModConflict { mod_a: "a".into(), mod_b: "b".into(), reason: "r".into() }.error_code(), "MOD_CONFLICT");
        assert_eq!(LauncherError::VersionIncompatible { required: "1.0".into(), actual: "2.0".into() }.error_code(), "VERSION_INCOMPATIBLE");
        assert_eq!(LauncherError::InstanceLocked("x".into()).error_code(), "INSTANCE_LOCKED");
        assert_eq!(LauncherError::InvalidInput("x".into()).error_code(), "INVALID_INPUT");
        assert_eq!(LauncherError::ServerConnectionFailed("x".into()).error_code(), "SERVER_CONNECTION_FAILED");
        assert_eq!(LauncherError::ConfigError("x".into()).error_code(), "CONFIG_ERROR");
    }

    #[test]
    fn suggestion_returns_some_for_supported_variants() {
        assert!(LauncherError::AuthExpired("x".into()).suggestion().is_some());
        assert!(LauncherError::RateLimited { retry_after: None }.suggestion().is_some());
        assert!(LauncherError::NetworkUnreachable.suggestion().is_some());
        assert!(LauncherError::DiskFull { path: "/tmp".into(), required: 100, available: 50 }.suggestion().is_some());
        assert!(LauncherError::JavaNotFound.suggestion().is_some());
        assert!(LauncherError::AuthFailed("x".into()).suggestion().is_some());
        assert!(LauncherError::ModConflict { mod_a: "a".into(), mod_b: "b".into(), reason: "r".into() }.suggestion().is_some());
        assert!(LauncherError::VersionIncompatible { required: "1.0".into(), actual: "2.0".into() }.suggestion().is_some());
        assert!(LauncherError::InstanceLocked("x".into()).suggestion().is_some());
    }

    #[test]
    fn suggestion_returns_none_for_unsupported_variants() {
        assert!(LauncherError::DownloadFailed("x".into()).suggestion().is_none());
        assert!(LauncherError::Sha1Mismatch("x".into()).suggestion().is_none());
        assert!(LauncherError::LaunchFailed("x".into()).suggestion().is_none());
        assert!(LauncherError::GameCrashed(1).suggestion().is_none());
        assert!(LauncherError::InvalidConfig("x".into()).suggestion().is_none());
        assert!(LauncherError::TerracottaNotInstalled.suggestion().is_none());
    }

    #[test]
    fn suggestion_content() {
        assert!(LauncherError::AuthExpired("x".into()).suggestion().unwrap().contains("re-login"));
        assert!(LauncherError::JavaNotFound.suggestion().unwrap().contains("Java"));
        assert!(LauncherError::NetworkUnreachable.suggestion().unwrap().contains("internet"));
        assert!(LauncherError::RateLimited { retry_after: None }.suggestion().unwrap().contains("Wait"));
    }

    #[test]
    fn serialize_has_type_code_message() {
        let json = serialize_error(&LauncherError::JavaNotFound);
        assert_eq!(json["type"], "JavaNotFound");
        assert_eq!(json["code"], "JAVA_NOT_FOUND");
        assert!(json["message"].as_str().unwrap().contains("Java not found"));
    }

    #[test]
    fn serialize_includes_suggestion_when_present() {
        let json = serialize_error(&LauncherError::JavaNotFound);
        assert!(json.get("suggestion").is_some());
        assert!(json["suggestion"].as_str().unwrap().contains("Java"));
    }

    #[test]
    fn serialize_no_suggestion_when_absent() {
        let json = serialize_error(&LauncherError::DownloadFailed("x".into()));
        assert!(json.get("suggestion").is_none());
    }

    #[test]
    fn serialize_auth_expired() {
        let json = serialize_error(&LauncherError::AuthExpired("token stale".into()));
        assert_eq!(json["type"], "AuthExpired");
        assert_eq!(json["code"], "AUTH_EXPIRED");
        assert!(json["suggestion"].as_str().unwrap().contains("re-login"));
    }

    #[test]
    fn serialize_rate_limited() {
        let json = serialize_error(&LauncherError::RateLimited { retry_after: Some(30) });
        assert_eq!(json["type"], "RateLimited");
        assert_eq!(json["code"], "RATE_LIMITED");
    }

    #[test]
    fn serialize_network_unreachable() {
        let json = serialize_error(&LauncherError::NetworkUnreachable);
        assert_eq!(json["type"], "NetworkUnreachable");
        assert_eq!(json["code"], "NETWORK_UNREACHABLE");
    }

    #[test]
    fn serialize_disk_full() {
        let json = serialize_error(&LauncherError::DiskFull { path: "/tmp".into(), required: 100, available: 50 });
        assert_eq!(json["type"], "DiskFull");
        assert_eq!(json["code"], "DISK_FULL");
        let msg = json["message"].as_str().unwrap();
        assert!(msg.contains("/tmp"));
    }

    #[test]
    fn serialize_mod_conflict() {
        let json = serialize_error(&LauncherError::ModConflict {
            mod_a: "mod_a".into(),
            mod_b: "mod_b".into(),
            reason: "incompatible".into(),
        });
        assert_eq!(json["type"], "ModConflict");
        assert_eq!(json["code"], "MOD_CONFLICT");
    }

    #[test]
    fn serialize_version_incompatible() {
        let json = serialize_error(&LauncherError::VersionIncompatible {
            required: "1.20".into(),
            actual: "1.19".into(),
        });
        assert_eq!(json["type"], "VersionIncompatible");
        assert_eq!(json["code"], "VERSION_INCOMPATIBLE");
    }

    #[test]
    fn serialize_instance_locked() {
        let json = serialize_error(&LauncherError::InstanceLocked("busy".into()));
        assert_eq!(json["type"], "InstanceLocked");
        assert_eq!(json["code"], "INSTANCE_LOCKED");
    }

    #[test]
    fn serialize_disk_space() {
        let json = serialize_error(&LauncherError::DiskSpace { required: 1024, available: 512 });
        assert_eq!(json["type"], "DiskSpace");
        assert_eq!(json["code"], "DISK_SPACE");
        let msg = json["message"].as_str().unwrap();
        assert!(msg.contains("1024"));
        assert!(msg.contains("512"));
    }

    #[test]
    fn error_display_messages() {
        assert!(LauncherError::JavaNotFound.to_string().contains("Java not found"));
        assert!(LauncherError::DownloadFailed("x".into()).to_string().contains("Download failed"));
        assert!(LauncherError::Sha1Mismatch("f".into()).to_string().contains("SHA1 verification failed"));
        assert!(LauncherError::AuthFailed("x".into()).to_string().contains("Authentication failed"));
        assert!(LauncherError::GameCrashed(1).to_string().contains("crashed"));
        assert!(LauncherError::AuthExpired("x".into()).to_string().contains("expired"));
        assert!(LauncherError::NetworkUnreachable.to_string().contains("unreachable"));
    }

    #[test]
    fn with_context_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file missing");
        let launcher_err = LauncherError::Io(io_err);
        let ctx_err = launcher_err.with_context("loading config");
        match ctx_err {
            LauncherError::Io(e) => assert!(e.to_string().contains("loading config")),
            _ => panic!("expected Io variant"),
        }
    }

    #[test]
    fn with_context_non_io() {
        let err = LauncherError::JavaNotFound;
        let ctx_err = err.with_context("startup check");
        match ctx_err {
            LauncherError::LaunchFailed(msg) => assert!(msg.contains("startup check")),
            _ => panic!("expected LaunchFailed variant"),
        }
    }
}
