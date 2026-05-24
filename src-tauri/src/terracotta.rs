use crate::error::LauncherError;
use crate::http_client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use tokio::net::TcpListener;

const TERRACOTTA_VERSION: &str = "0.4.2";

pub fn get_terracotta_dir() -> PathBuf {
    crate::platform::paths::get_game_dir().join("terracotta")
}

pub fn get_terracotta_binary_path() -> PathBuf {
    let dir = get_terracotta_dir();
    #[cfg(target_os = "windows")]
    return dir.join("terracotta.exe");
    #[cfg(not(target_os = "windows"))]
    return dir.join("terracotta");
}

fn get_classifier() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "macos-arm64";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "macos-x86_64";
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "linux-x86_64";
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "linux-arm64";
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "windows-x86_64";
    #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
    return "windows-arm64";
}

pub fn is_terracotta_installed() -> bool {
    get_terracotta_binary_path().exists()
}

pub async fn download_terracotta(
    on_progress: impl Fn(u64, u64) + Send + 'static,
) -> Result<(), LauncherError> {
    let classifier = get_classifier();
    let url = format!(
        "https://github.com/burningtnt/Terracotta/releases/download/v{}/terracotta-{}-{}-pkg.tar.gz",
        TERRACOTTA_VERSION, TERRACOTTA_VERSION, classifier
    );

    let dir = get_terracotta_dir();
    fs::create_dir_all(&dir)?;

    let tar_path = dir.join("terracotta-pkg.tar.gz");

    let client = http_client::build_client();
    let resp = client.get(&url).send().await?;
    let total = resp.content_length().unwrap_or(0);

    let bytes = resp.bytes().await?;
    let downloaded = bytes.len() as u64;
    on_progress(downloaded, total.max(downloaded));

    fs::write(&tar_path, &bytes)?;

    let output = Command::new("tar")
        .arg("-xzf")
        .arg(&tar_path)
        .arg("-C")
        .arg(&dir)
        .output()?;

    if !output.status.success() {
        return Err(LauncherError::Other(format!(
            "Failed to extract terracotta: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let binary = get_terracotta_binary_path();
        if binary.exists() {
            fs::set_permissions(&binary, fs::Permissions::from_mode(0o755))?;
        }
    }

    let _ = fs::remove_file(&tar_path);

    Ok(())
}

pub async fn find_available_port() -> Result<u16, LauncherError> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    Ok(port)
}

#[allow(dead_code)]
pub struct TerracottaProcess {
    child: Child,
    pub port: u16,
}

#[allow(dead_code)]
impl TerracottaProcess {
    pub fn start(port: u16) -> Result<Self, LauncherError> {
        let binary = get_terracotta_binary_path();
        if !binary.exists() {
            return Err(LauncherError::Other(
                "Terracotta is not installed".to_string(),
            ));
        }

        let child = Command::new(&binary)
            .arg("--port")
            .arg(port.to_string())
            .spawn()?;

        Ok(Self { child, port })
    }

    pub fn stop(&mut self) -> Result<(), LauncherError> {
        self.child.kill()?;
        Ok(())
    }

    pub fn is_running(&mut self) -> bool {
        !matches!(
            self.child.try_wait(),
            Ok(Some(_)) | Err(_)
        )
    }
}

impl Drop for TerracottaProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerracottaState {
    pub state: String,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

pub async fn get_state(port: u16) -> Result<TerracottaState, LauncherError> {
    let client = http_client::build_client();
    let resp = client
        .get(&format!("http://127.0.0.1:{}/state", port))
        .send()
        .await?;
    let state: TerracottaState = resp.json().await?;
    Ok(state)
}

pub async fn set_idle(port: u16) -> Result<(), LauncherError> {
    let client = http_client::build_client();
    client
        .get(&format!("http://127.0.0.1:{}/state/ide", port))
        .send()
        .await?;
    Ok(())
}

pub async fn set_scanning(port: u16) -> Result<(), LauncherError> {
    let client = http_client::build_client();
    client
        .get(&format!("http://127.0.0.1:{}/state/scanning", port))
        .send()
        .await?;
    Ok(())
}

pub async fn set_hosting(port: u16) -> Result<(), LauncherError> {
    let client = http_client::build_client();
    client
        .get(&format!("http://127.0.0.1:{}/state/hosting", port))
        .send()
        .await?;
    Ok(())
}

pub async fn set_guesting(port: u16, room: &str) -> Result<(), LauncherError> {
    let client = http_client::build_client();
    let url = format!("http://127.0.0.1:{}/state/guesting?room={}", port, room);
    client.get(&url).send().await?;
    Ok(())
}
