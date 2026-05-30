use crate::platform::paths;
use std::fs;
use std::sync::OnceLock;
use tracing_appender::non_blocking::{NonBlocking, WorkerGuard};
use tracing_appender::rolling::RollingFileAppender;
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

const MAX_LOG_FILES: usize = 5;
const SENSITIVE_KEYS: &[&str] = &[
    "token", "password", "secret", "api_key", "apikey", "access_token",
    "refresh_token", "auth", "credential", "private_key",
];

static LOG_GUARD: OnceLock<WorkerGuard> = OnceLock::new();

fn redact_sensitive_values(input: &str) -> String {
    let mut result = input.to_string();
    for key in SENSITIVE_KEYS {
        let patterns = [
            format!("{}=", key),
            format!("{}: ", key),
            format!("{}=\"", key),
            format!("{}='", key),
        ];
        for pattern in patterns {
            if let Some(start) = result.find(&pattern) {
                let value_start = start + pattern.len();
                let value_end = result[value_start..]
                    .find(|c: char| c == ' ' || c == ',' || c == ')' || c == '}' || c == '"' || c == '\n')
                    .map(|i| value_start + i)
                    .unwrap_or(result.len());
                if value_end > value_start {
                    result.replace_range(value_start..value_end, "***REDACTED***");
                }
            }
        }
    }
    result
}

struct RedactingWriter<W> {
    inner: W,
}

impl<W: std::io::Write> std::io::Write for RedactingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let input = String::from_utf8_lossy(buf);
        let redacted = redact_sensitive_values(&input);
        self.inner.write(redacted.as_bytes())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

impl<'a> MakeWriter<'a> for RedactingWriter<NonBlocking> {
    type Writer = RedactingWriter<<NonBlocking as MakeWriter<'a>>::Writer>;

    fn make_writer(&'a self) -> Self::Writer {
        RedactingWriter {
            inner: self.inner.make_writer(),
        }
    }
}

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
    let _ = LOG_GUARD.set(guard);

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let redacting_file_writer = RedactingWriter { inner: non_blocking };

    let file_layer = fmt::layer()
        .with_writer(redacting_file_writer)
        .with_target(false)
        .with_thread_ids(false)
        .with_ansi(false);

    let stdout_layer = fmt::layer()
        .with_writer(std::io::stdout)
        .with_target(false)
        .with_thread_ids(false)
        .with_ansi(true);

    tracing_subscriber::registry()
        .with(file_layer.with_filter(filter.clone()))
        .with(stdout_layer.with_filter(filter))
        .init();

    tracing::info!("Logger initialized, log dir: {:?}", log_dir);
}
