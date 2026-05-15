mod error;
mod platform;
mod version;
mod download;
mod launch;

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
    download_items.push(download::queue::DownloadItem {
        url: resolved.client_jar.url.clone(),
        path: client_jar_path,
        sha1: resolved.client_jar.sha1.clone(),
        size: resolved.client_jar.size,
    });

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
        let _ = app.emit("launch-state", LaunchState::Downloading {
            total_files,
            completed_files: 0,
            total_bytes,
            downloaded_bytes: 0,
            current_file: String::new(),
        });

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

    launch_minecraft(app.clone(), args).await
}

#[tauri::command]
async fn get_launch_state(
    state: tauri::State<'_, AppState>,
) -> Result<LaunchState, LauncherError> {
    let current = state.launch_state.lock().unwrap();
    Ok(current.clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            launch_state: Mutex::new(LaunchState::Idle),
        })
        .invoke_handler(tauri::generate_handler![
            get_versions,
            start_game,
            get_launch_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
