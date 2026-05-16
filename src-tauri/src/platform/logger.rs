use crate::platform::paths;
use std::fs;
use std::sync::OnceLock;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::RollingFileAppender;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

const MAX_LOG_FILES: usize = 5;

/// Keep the guard alive for the program's lifetime so log messages
/// are not lost when the guard is dropped.
static LOG_GUARD: OnceLock<WorkerGuard> = OnceLock::new();

pub fn init_logger() {
    let log_dir = paths::get_logs_dir();
    let _ = fs::create_dir_all(&log_dir);

    let file_appender = RollingFileAppender::builder()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("launcher")
        .filename_suffix("log")
        .max_log_files(MAX_LOG_FILES)
        .build(&log_dir)
        .expect("Failed to create file appender");

    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    // Store the guard so the worker thread stays alive
    let _ = LOG_GUARD.set(guard);

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let subscriber = fmt::layer()
        .with_writer(non_blocking)
        .with_target(false)
        .with_thread_ids(false)
        .with_ansi(false);

    tracing_subscriber::registry()
        .with(subscriber.with_filter(filter))
        .init();

    tracing::info!("Logger initialized, log dir: {:?}", log_dir);
}
