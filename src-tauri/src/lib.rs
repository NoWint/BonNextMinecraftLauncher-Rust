mod auth;
mod config;
mod download;
mod error;
mod launch;
mod platform;
mod version;

use error::LauncherError;
use launch::args::{build_launch_command, LaunchConfig};
use launch::process::launch_minecraft;
use launch::state::LaunchState;
use platform::paths;
use std::sync::Mutex;
use tauri::Emitter;
use version::manifest::VersionEntry;
use version::resolver::{fetch_version_details, ResolvedVersion};

struct AppState {
    launch_state: Mutex<LaunchState>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct AuthResultPayload {
    username: String,
    uuid: String,
}

#[derive(Debug, Clone, serde::Serialize)]
struct SavedSessionData {
    username: String,
    uuid: String,
}

#[tauri::command]
async fn get_versions() -> Result<Vec<VersionEntry>, LauncherError> {
    version::manifest::fetch_versions_sorted().await
}

#[tauri::command]
async fn start_game(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    version_id: String,
    java_path: String,
    max_memory_mb: u32,
    username: String,
    uuid: String,
) -> Result<(), LauncherError> {
    {
        let current = state.launch_state.lock().unwrap();
        if current.is_busy() {
            return Err(LauncherError::Other(
                "A launch is already in progress".to_string(),
            ));
        }
    }

    {
        let mut current = state.launch_state.lock().unwrap();
        *current = LaunchState::Checking;
    }
    let _ = app.emit("launch-state", LaunchState::Checking);

    paths::ensure_dirs().map_err(LauncherError::Io)?;

    tracing::info!(
        "Starting game: version={}, java={}",
        version_id,
        java_path
    );

    let result: Result<(), LauncherError> = async {
        let versions = version::manifest::fetch_versions_sorted().await?;
        let entry = versions
            .iter()
            .find(|v| v.id == version_id)
            .ok_or_else(|| LauncherError::VersionNotFound(version_id.clone()))?;

        let details = fetch_version_details(&entry.url).await?;
        let resolved = ResolvedVersion::from_details(&details);

        let mut download_items = Vec::new();

        let client_jar_path = paths::get_versions_dir()
            .join(&version_id)
            .join("client.jar");
        if !client_jar_path.exists()
            || !download::verifier::verify_sha1(&client_jar_path, &resolved.client_jar.sha1)
                .unwrap_or(false)
        {
            download_items.push(download::queue::DownloadItem {
                url: resolved.client_jar.url.clone(),
                path: client_jar_path,
                sha1: resolved.client_jar.sha1.clone(),
                size: resolved.client_jar.size,
            });
        }

        for lib in &resolved.libraries {
            let lib_path = paths::get_libraries_dir().join(&lib.path);
            if lib_path.exists() {
                if download::verifier::verify_sha1(&lib_path, &lib.sha1).unwrap_or(false) {
                    continue;
                }
            }
            download_items.push(download::queue::DownloadItem {
                url: lib.url.clone(),
                path: lib_path,
                sha1: lib.sha1.clone(),
                size: lib.size,
            });
        }

        if !download_items.is_empty() {
            let total_bytes: u64 = download_items.iter().map(|i| i.size).sum();
            let total_files = download_items.len() as u64;
            tracing::info!(
                "Downloading {} files ({} bytes total)",
                total_files,
                total_bytes
            );

            {
                let mut current = state.launch_state.lock().unwrap();
                *current = LaunchState::Downloading {
                    total_files,
                    completed_files: 0,
                    total_bytes,
                    downloaded_bytes: 0,
                    current_file: String::new(),
                };
            }
            let _ = app.emit(
                "launch-state",
                LaunchState::Downloading {
                    total_files,
                    completed_files: 0,
                    total_bytes,
                    downloaded_bytes: 0,
                    current_file: String::new(),
                },
            );

            download::queue::download_all(download_items, 8).await?;

            {
                let mut current = state.launch_state.lock().unwrap();
                *current = LaunchState::Validating;
            }
            let _ = app.emit("launch-state", LaunchState::Validating);
        }

        {
            let mut current = state.launch_state.lock().unwrap();
            *current = LaunchState::Launching;
        }
        let _ = app.emit("launch-state", LaunchState::Launching);

        let game_dir = paths::get_game_dir();
        let access_token = "0".to_string();

        let config = LaunchConfig {
            java_path,
            max_memory_mb,
            extra_jvm_args: Vec::new(),
            username,
            uuid,
            access_token,
            game_dir: game_dir.clone(),
        };

        let args = build_launch_command(
            &resolved,
            &config,
            &paths::get_libraries_dir(),
            &paths::get_versions_dir(),
            &paths::get_assets_dir(),
        );

        launch_minecraft(app.clone(), args).await?;

        Ok(())
    }
    .await;

    if let Err(e) = &result {
        tracing::error!("Launch failed: {}", e);
        {
            let mut current = state.launch_state.lock().unwrap();
            *current = LaunchState::Error {
                message: e.to_string(),
            };
        }
        let _ = app.emit(
            "launch-state",
            LaunchState::Error {
                message: e.to_string(),
            },
        );
    }

    result
}

#[tauri::command]
async fn get_launch_state(
    state: tauri::State<'_, AppState>,
) -> Result<LaunchState, LauncherError> {
    let current = state.launch_state.lock().unwrap();
    Ok(current.clone())
}

#[tauri::command]
async fn reset_launch_state(
    state: tauri::State<'_, AppState>,
) -> Result<(), LauncherError> {
    let mut current = state.launch_state.lock().unwrap();
    *current = LaunchState::Idle;
    Ok(())
}

#[tauri::command]
async fn microsoft_login(
    app: tauri::AppHandle,
) -> Result<AuthResultPayload, LauncherError> {
    let result = auth::microsoft::perform_full_auth().await?;

    let session = auth::session::SavedSession::from_auth_result(&result);
    let session_path = paths::get_game_dir().join("session.json");
    auth::session::save_session(&session_path, &session)?;

    let payload = AuthResultPayload {
        username: result.username.clone(),
        uuid: result.uuid.clone(),
    };

    let _ = app.emit("auth-state", &payload);
    Ok(payload)
}

#[tauri::command]
async fn check_saved_session() -> Result<Option<SavedSessionData>, LauncherError> {
    let session_path = paths::get_game_dir().join("session.json");
    let session = auth::session::load_session(&session_path)?;
    Ok(session.map(|s| SavedSessionData {
        username: s.username,
        uuid: s.uuid,
    }))
}

#[tauri::command]
async fn offline_login(username: String) -> Result<AuthResultPayload, LauncherError> {
    let uuid = uuid::Uuid::new_v4().to_string();
    let session = auth::session::SavedSession {
        refresh_token: String::new(),
        username: username.clone(),
        uuid: uuid.clone(),
        expires_at: 0,
    };
    let session_path = paths::get_game_dir().join("session.json");
    paths::ensure_dirs().ok();
    auth::session::save_session(&session_path, &session)?;
    Ok(AuthResultPayload { username, uuid })
}

#[tauri::command]
async fn logout() -> Result<(), LauncherError> {
    let session_path = paths::get_game_dir().join("session.json");
    let _ = auth::session::delete_session(&session_path);
    Ok(())
}

#[tauri::command]
async fn get_config() -> Result<config::UserConfig, LauncherError> {
    let mut config = config::load_config()?;
    platform::java::auto_detect_and_set(&mut config);
    if config.java_path != "java" {
        let _ = config::save_config(&config);
    }
    Ok(config)
}

#[tauri::command]
async fn save_config(config: config::UserConfig) -> Result<(), LauncherError> {
    config::save_config(&config)
}

#[tauri::command]
async fn auto_detect_java() -> Result<String, LauncherError> {
    match platform::java::find_java() {
        Some(path) => Ok(path),
        None => Err(LauncherError::JavaNotFound),
    }
}

#[tauri::command]
async fn download_jre() -> Result<String, LauncherError> {
    platform::java::download_jre().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::logger::init_logger();
    tracing::info!("BonNext launcher starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            launch_state: Mutex::new(LaunchState::Idle),
        })
        .invoke_handler(tauri::generate_handler![
            get_versions,
            start_game,
            get_launch_state,
            reset_launch_state,
            microsoft_login,
            check_saved_session,
            offline_login,
            logout,
            get_config,
            save_config,
            auto_detect_java,
            download_jre,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
