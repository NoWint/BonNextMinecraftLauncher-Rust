mod version;
mod installer;
mod launcher;
mod platform;
mod auth;
mod config;
mod error;

use error::LauncherError;
use platform::paths;
use version::models::*;
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_versions,
            start_game,
            get_launch_state,
            check_saved_session,
            offline_login,
            logout,
            get_config,
            save_config,
            auto_detect_java,
            download_jre,
            get_default_game_dir,
            reset_launch_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn get_versions() -> Result<Vec<VersionEntry>, LauncherError> {
    version::fetch_versions_sorted().await
}

#[derive(Debug, Clone, serde::Serialize)]
struct AuthResultPayload {
    username: String,
    uuid: String,
}

#[tauri::command]
async fn check_saved_session() -> Result<Option<AuthResultPayload>, LauncherError> {
    let session_path = paths::get_default_game_dir().join("session.json");
    match auth::session::load_session(&session_path)? {
        Some(session) => Ok(Some(AuthResultPayload {
            username: session.username,
            uuid: session.uuid,
        })),
        None => Ok(None),
    }
}

#[tauri::command]
async fn offline_login(username: String) -> Result<AuthResultPayload, LauncherError> {
    let uuid = uuid::Uuid::new_v4().to_string();
    let session = auth::session::SavedSession {
        access_token: "0".to_string(),
        refresh_token: String::new(),
        username: username.clone(),
        uuid: uuid.clone(),
        expires_at: 0,
    };
    let session_path = paths::get_default_game_dir().join("session.json");
    paths::ensure_dirs().ok();
    auth::session::save_session(&session_path, &session)?;
    Ok(AuthResultPayload { username, uuid })
}

#[tauri::command]
async fn logout() -> Result<(), LauncherError> {
    let session_path = paths::get_default_game_dir().join("session.json");
    auth::session::delete_session(&session_path)?;
    Ok(())
}

#[tauri::command]
async fn get_config() -> Result<config::UserConfig, LauncherError> {
    let mut cfg = config::load_config()?;
    platform::java::auto_detect_and_set(&mut cfg);
    config::save_config(&cfg)?;
    Ok(cfg)
}

#[tauri::command]
async fn save_config(config: config::UserConfig) -> Result<(), LauncherError> {
    config::save_config(&config)
}

#[tauri::command]
async fn auto_detect_java() -> Result<String, LauncherError> {
    platform::java::find_java().ok_or(LauncherError::JavaNotFound)
}

#[tauri::command]
async fn download_jre() -> Result<String, LauncherError> {
    platform::java::download_jre().await
}

#[tauri::command]
async fn get_default_game_dir() -> Result<String, LauncherError> {
    Ok(paths::get_default_game_dir().to_string_lossy().to_string())
}

use std::sync::Mutex;

static LAUNCH_STATE: Mutex<Option<LaunchState>> = Mutex::new(None);

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "state")]
enum LaunchState {
    Idle,
    Checking,
    Downloading { progress: f64, speed: f64 },
    Validating,
    Launching,
    Running { pid: u32 },
    Exited { code: i32 },
    Crashed { report: String },
    Error { message: String },
}

#[tauri::command]
async fn get_launch_state() -> Result<Option<LaunchState>, LauncherError> {
    let state = LAUNCH_STATE.lock().map_err(|e| LauncherError::Other(e.to_string()))?;
    Ok(state.clone())
}

#[tauri::command]
async fn reset_launch_state() -> Result<(), LauncherError> {
    let mut state = LAUNCH_STATE.lock().map_err(|e| LauncherError::Other(e.to_string()))?;
    *state = None;
    Ok(())
}

#[tauri::command]
async fn start_game(
    app: tauri::AppHandle,
    version_id: String,
    java_path: String,
    max_memory_mb: u32,
    username: String,
    uuid: String,
) -> Result<(), LauncherError> {
    {
        let state = LAUNCH_STATE.lock().map_err(|e| LauncherError::Other(e.to_string()))?;
        if matches!(*state, Some(LaunchState::Running { .. })) {
            return Err(LauncherError::LaunchFailed("Game already running".to_string()));
        }
    }

    let set_state = |s: LaunchState| {
        if let Ok(mut state) = LAUNCH_STATE.lock() {
            *state = Some(s.clone());
        }
        let _ = app.emit("launch-state", &s);
    };

    set_state(LaunchState::Checking);

    let game_dir = paths::get_game_dir();
    paths::ensure_dirs()?;

    let java = if java_path.is_empty() || java_path == "java" {
        platform::java::find_java().ok_or(LauncherError::JavaNotFound)?
    } else {
        java_path
    };
    platform::java::validate_java(&java)?;

    tracing::info!("Resolving version chain for: {}", version_id);
    let version = version::resolve_version_chain(&version_id, &game_dir).await?;

    set_state(LaunchState::Downloading { progress: 0.0, speed: 0.0 });

    tracing::info!("Downloading libraries...");
    installer::download_libraries(&version, &game_dir).await?;

    tracing::info!("Downloading client JAR...");
    installer::download_client_jar(&version, &game_dir).await?;

    tracing::info!("Downloading assets...");
    installer::download_assets(&version, &game_dir).await?;

    set_state(LaunchState::Validating);

    let instance_dir = game_dir.join("versions").join(&version.id);
    std::fs::create_dir_all(&instance_dir)?;

    tracing::info!("Extracting natives...");
    let natives_dir = installer::extract_natives(&version, &game_dir, &instance_dir)?;

    tracing::info!("Building classpath...");
    let classpath = installer::build_classpath(&version, &game_dir);

    let cfg = config::load_config().unwrap_or_default();

    tracing::info!("Building launch plan...");
    let plan = launcher::build_launch_plan(
        &version,
        &game_dir,
        &instance_dir,
        &java,
        max_memory_mb,
        &cfg.extra_jvm_args,
        &username,
        &uuid,
        "0",
        classpath,
        &natives_dir,
        cfg.window_width,
        cfg.window_height,
    )?;

    set_state(LaunchState::Launching);

    tracing::info!("Spawning Minecraft process...");
    let mut child = launcher::launch(&plan)?;

    let pid = child.id();
    set_state(LaunchState::Running { pid });

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        match status {
            Ok(exit_status) => {
                let code = exit_status.code().unwrap_or(-1);
                let state = if code == 0 {
                    LaunchState::Exited { code }
                } else {
                    let mut stderr_text = String::new();
                    if let Some(stderr) = child.stderr.take() {
                        let _ = std::io::Read::read_to_string(&mut std::io::BufReader::new(stderr), &mut stderr_text);
                    }
                    LaunchState::Crashed {
                        report: format!("Exit code: {}\n{}", code, stderr_text),
                    }
                };
                if let Ok(mut s) = LAUNCH_STATE.lock() {
                    *s = Some(state.clone());
                }
                let _ = app_clone.emit("launch-state", &state);
            }
            Err(e) => {
                let state = LaunchState::Error {
                    message: e.to_string(),
                };
                if let Ok(mut s) = LAUNCH_STATE.lock() {
                    *s = Some(state.clone());
                }
                let _ = app_clone.emit("launch-state", &state);
            }
        }
    });

    Ok(())
}
