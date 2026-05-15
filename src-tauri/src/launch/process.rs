use crate::error::LauncherError;
use crate::launch::state::LaunchState;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;

pub async fn launch_minecraft(
    app: tauri::AppHandle,
    args: Vec<String>,
) -> Result<(), LauncherError> {
    let java_path = &args[0];
    let jvm_args = &args[1..];

    let mut child = Command::new(java_path)
        .args(jvm_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| LauncherError::LaunchFailed(format!("Failed to spawn Java: {}", e)))?;

    let pid = child.id().unwrap_or(0);
    tracing::info!("Minecraft process started with PID {}", pid);

    let _ = app.emit("launch-state", LaunchState::Running { pid });

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut stdout_reader = tokio::io::BufReader::new(stdout).lines();
    let mut stderr_reader = tokio::io::BufReader::new(stderr).lines();

    let stderr_handle = tokio::spawn(async move {
        let mut stderr_lines = Vec::new();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            stderr_lines.push(line);
        }
        stderr_lines
    });

    let stdout_handle = tokio::spawn(async move {
        while let Ok(Some(_line)) = stdout_reader.next_line().await {}
    });

    let status = child.wait().await.map_err(|e| {
        LauncherError::LaunchFailed(format!("Failed to wait for Minecraft: {}", e))
    })?;

    stdout_handle.await.ok();
    let stderr_lines = stderr_handle.await.unwrap_or_default();

    match status.code() {
        Some(0) => {
            let _ = app.emit("launch-state", LaunchState::Exited { code: 0 });
            Ok(())
        }
        Some(code) => {
            let reason = stderr_lines.join("\n");
            let _ = app.emit(
                "launch-state",
                LaunchState::Crashed {
                    code,
                    reason: reason.clone(),
                },
            );
            Err(LauncherError::GameCrashed(code))
        }
        None => {
            let _ = app.emit("launch-state", LaunchState::Exited { code: -1 });
            Ok(())
        }
    }
}
