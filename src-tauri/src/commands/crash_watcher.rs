use tauri::State;

use crate::crash_watcher::{self, CrashWatcherState};
use crate::error::LauncherError;

#[tauri::command]
pub async fn start_crash_watcher(
    app: tauri::AppHandle,
    state: State<'_, CrashWatcherState>,
    instance_id: String,
) -> Result<(), LauncherError> {
    crash_watcher::start_crash_watcher(app, &state, &instance_id).await
}

#[tauri::command]
pub async fn stop_crash_watcher(
    state: State<'_, CrashWatcherState>,
    instance_id: String,
) -> Result<(), LauncherError> {
    crash_watcher::stop_crash_watcher(&state, &instance_id).await
}
