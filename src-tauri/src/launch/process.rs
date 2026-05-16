use crate::error::LauncherError;
use crate::instance;
use crate::launch::args::{self, LaunchContext};
use crate::launch::state::LaunchState;
use std::io::Read;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub struct LaunchProcess {
    state: Arc<Mutex<LaunchState>>,
    app_handle: Option<tauri::AppHandle>,
    instance_id: Option<String>,
}

impl LaunchProcess {
    pub fn new(state: Arc<Mutex<LaunchState>>) -> Self {
        LaunchProcess { state, app_handle: None, instance_id: None }
    }

    pub fn with_app_handle(state: Arc<Mutex<LaunchState>>, app: tauri::AppHandle) -> Self {
        LaunchProcess { state, app_handle: Some(app), instance_id: None }
    }

    pub fn with_instance_id(mut self, id: String) -> Self {
        self.instance_id = Some(id);
        self
    }

    pub fn set_state(&self, new_state: LaunchState) -> Result<(), LauncherError> {
        let mut current = self.state.lock().unwrap();
        if !current.can_transition_to(new_state) {
            tracing::warn!("Non-standard state transition: {:?} -> {:?}", *current, new_state);
        }
        tracing::info!("Launch state: {:?} -> {:?}", *current, new_state);
        *current = new_state;
        Ok(())
    }

    pub async fn launch(&self, ctx: LaunchContext) -> Result<(), LauncherError> {
        self.set_state(LaunchState::Checking)?;

        let missing = self.check_files(&ctx);
        if !missing.is_empty() {
            tracing::warn!("Missing {} files: {:?}", missing.len(), missing.iter().take(5).collect::<Vec<_>>());
        }

        self.set_state(LaunchState::Launching)?;

        // Record launch start time for playtime tracking
        let launch_instant = std::time::Instant::now();

        let command = args::build_launch_command(&ctx)?;

        tracing::info!("Launching Minecraft with {} args", command.len());
        tracing::debug!("Command: {}", command.join(" "));

        let program = &command[0];
        let cmd_args = &command[1..];

        let mut child = std::process::Command::new(program)
            .args(cmd_args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                let _ = self.set_state(LaunchState::Error);
                LauncherError::LaunchFailed(format!("Failed to spawn process: {}", e))
            })?;

        let pid = child.id();
        tracing::info!("Game process started with PID: {}", pid);

        self.set_state(LaunchState::Running)?;

        // Drain stdout and stderr pipes continuously to prevent buffer exhaustion.
        // The OS pipe buffer is typically 64KB; if not drained, the game blocks on write().
        let child_stdout = child.stdout.take();
        let child_stderr = child.stderr.take();

        // Spawn thread to drain stdout to log + emit to frontend
        if let Some(stdout) = child_stdout {
            let app_stdout = self.app_handle.clone();
            std::thread::spawn(move || {
                let mut reader = std::io::BufReader::new(stdout);
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).trim_end().to_string();
                            tracing::info!(target: "minecraft_stdout", "{}", text);
                            if let Some(ref app) = app_stdout {
                                let _ = app.emit("game-output", serde_json::json!({
                                    "text": text, "stream": "stdout"
                                }));
                            }
                        }
                        Err(e) => {
                            tracing::warn!("stdout read error: {}", e);
                            break;
                        }
                    }
                }
            });
        }

        // Spawn thread to drain stderr to log + emit to frontend
        if let Some(stderr) = child_stderr {
            let app_stderr = self.app_handle.clone();
            std::thread::spawn(move || {
                let mut reader = std::io::BufReader::new(stderr);
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            let text = String::from_utf8_lossy(&buf[..n]).trim_end().to_string();
                            tracing::info!(target: "minecraft_stderr", "{}", text);
                            if let Some(ref app) = app_stderr {
                                let _ = app.emit("game-output", serde_json::json!({
                                    "text": text, "stream": "stderr"
                                }));
                            }
                        }
                        Err(e) => {
                            tracing::warn!("stderr read error: {}", e);
                            break;
                        }
                    }
                }
            });
        }

        // Wait for the process to exit
        let state_clone = self.state.clone();
        let instance_id_for_exit = self.instance_id.clone();
        std::thread::spawn(move || {
            let output = child.wait();
            let elapsed = launch_instant.elapsed().as_secs();
            match output {
                Ok(status) => {
                    let mut state = state_clone.lock().unwrap();
                    if status.success() {
                        tracing::info!("Game exited normally after {}s", elapsed);
                        *state = LaunchState::Exited;
                    } else {
                        let code = status.code().unwrap_or(-1);
                        tracing::error!("Game crashed with exit code: {} after {}s", code, elapsed);
                        *state = LaunchState::Crashed;
                    }
                    // Record playtime on exit or crash
                    drop(state);
                    if let Some(ref iid) = instance_id_for_exit {
                        if elapsed > 0 {
                            if let Err(e) = instance::manager::update_playtime(iid, elapsed) {
                                tracing::warn!("Failed to record playtime for {}: {}", iid, e);
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to wait for game process: {}", e);
                    let mut state = state_clone.lock().unwrap();
                    *state = LaunchState::Error;
                }
            }
        });

        Ok(())
    }

    fn check_files(&self, ctx: &LaunchContext) -> Vec<String> {
        let mut missing = Vec::new();

        let client_jar = ctx.version_dir.join(format!("{}.jar", ctx.version.id));
        if !client_jar.exists() {
            missing.push(client_jar.to_string_lossy().to_string());
        }

        let libraries_dir = paths::get_libraries_dir();
        for lib in &ctx.version.libraries {
            let lib_path = libraries_dir.join(&lib.path);
            if !lib_path.exists() {
                missing.push(lib_path.to_string_lossy().to_string());
            }
        }

        // Also check native libraries exist
        for lib in &ctx.version.native_libraries {
            let lib_path = libraries_dir.join(&lib.path);
            if !lib_path.exists() {
                missing.push(lib_path.to_string_lossy().to_string());
            }
        }

        // Check natives directory has extracted files
        if !ctx.natives_dir.exists() || ctx.natives_dir.read_dir().map(|mut d| d.next().is_none()).unwrap_or(true) {
            missing.push(format!("natives dir empty: {}", ctx.natives_dir.display()));
        }

        // Validate Java version compatibility
        if let Some(java_ver) = platform::java::check_java_version(&ctx.java_path) {
            let required = ctx.version.java_version.major_version;
            if java_ver < required {
                tracing::warn!(
                    "Java {} may be incompatible with Minecraft {} (requires Java {})",
                    java_ver, ctx.version.id, required
                );
            }
        }

        missing
    }
}

use crate::platform;
use crate::platform::paths;
