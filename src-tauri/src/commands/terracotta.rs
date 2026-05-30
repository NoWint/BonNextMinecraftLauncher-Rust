use crate::error::LauncherError;
use crate::terracotta;

pub struct TerracottaState {
    pub port: tokio::sync::Mutex<Option<u16>>,
    pub child: tokio::sync::Mutex<Option<std::process::Child>>,
}

#[tauri::command]
pub async fn download_terracotta() -> Result<(), LauncherError> {
    terracotta::download_terracotta(|_, _| {}).await
}

#[tauri::command]
pub async fn is_terracotta_installed() -> Result<bool, LauncherError> {
    Ok(terracotta::is_terracotta_installed())
}

#[tauri::command]
pub async fn start_terracotta(state: tauri::State<'_, TerracottaState>) -> Result<u16, LauncherError> {
    {
        let port_guard = state.port.lock().await;
        if let Some(p) = *port_guard {
            let client = crate::http_client::build_client();
            if client
                .get(format!("http://127.0.0.1:{}/state", p))
                .send()
                .await
                .is_ok()
            {
                return Ok(p);
            }
        }
    }

    let binary = terracotta::get_terracotta_binary_path();
    if !binary.exists() {
        return Err(LauncherError::TerracottaNotInstalled);
    }

    let child = std::process::Command::new(&binary)
        .arg("--daemon")
        .stderr(std::process::Stdio::piped())
        .spawn()?;

    let port = terracotta::discover_terracotta_port(10).await?;

    *state.port.lock().await = Some(port);
    *state.child.lock().await = Some(child);

    Ok(port)
}

#[tauri::command]
pub async fn stop_terracotta(state: tauri::State<'_, TerracottaState>) -> Result<(), LauncherError> {
    let port = {
        let mut p = state.port.lock().await;
        p.take()
    };

    {
        let mut child_guard = state.child.lock().await;
        if let Some(ref mut child) = *child_guard {
            let _ = child.kill();
            let _ = child.wait();
        }
        *child_guard = None;
    }

    if let Some(port) = port {
        terracotta::set_idle(port).await.ok();
        #[cfg(not(target_os = "windows"))]
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("terracotta")
            .output();
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/IM", "terracotta.exe"])
            .output();
    }

    Ok(())
}

#[tauri::command]
pub async fn get_terracotta_state(state: tauri::State<'_, TerracottaState>) -> Result<terracotta::TerracottaState, LauncherError> {
    let port_guard = state.port.lock().await;
    let port = *port_guard;
    drop(port_guard);
    let port = port.ok_or(LauncherError::TerracottaNotRunning)?;
    terracotta::get_state(port).await
}

#[tauri::command]
pub async fn terracotta_set_host(state: tauri::State<'_, TerracottaState>) -> Result<(), LauncherError> {
    let port_guard = state.port.lock().await;
    let port = *port_guard;
    drop(port_guard);
    let port = port.ok_or(LauncherError::TerracottaNotRunning)?;
    terracotta::set_scanning(port).await?;
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
    terracotta::set_hosting(port).await
}

#[tauri::command]
pub async fn terracotta_set_guest(state: tauri::State<'_, TerracottaState>, room: String) -> Result<(), LauncherError> {
    let port_guard = state.port.lock().await;
    let port = *port_guard;
    drop(port_guard);
    let port = port.ok_or(LauncherError::TerracottaNotRunning)?;
    terracotta::set_guesting(port, &room).await
}

#[tauri::command]
pub async fn terracotta_set_idle(state: tauri::State<'_, TerracottaState>) -> Result<(), LauncherError> {
    let port_guard = state.port.lock().await;
    let port = *port_guard;
    drop(port_guard);
    let port = port.ok_or(LauncherError::TerracottaNotRunning)?;
    terracotta::set_idle(port).await
}
