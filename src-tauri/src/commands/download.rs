use crate::download::queue::DownloadControlState;

#[tauri::command]
pub async fn pause_download(state: tauri::State<'_, DownloadControlState>) -> Result<(), crate::error::LauncherError> {
    state.pause();
    Ok(())
}

#[tauri::command]
pub async fn resume_download(state: tauri::State<'_, DownloadControlState>) -> Result<(), crate::error::LauncherError> {
    state.resume();
    Ok(())
}

#[tauri::command]
pub async fn cancel_download(state: tauri::State<'_, DownloadControlState>, url: String) -> Result<(), crate::error::LauncherError> {
    state.cancel(&url);
    Ok(())
}

#[tauri::command]
pub async fn is_download_paused(state: tauri::State<'_, DownloadControlState>) -> Result<bool, crate::error::LauncherError> {
    Ok(state.is_paused())
}
