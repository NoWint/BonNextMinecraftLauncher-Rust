use crate::download::queue::DownloadControlState;

#[derive(serde::Serialize)]
pub struct MirrorStat {
    pub url: String,
    pub success_rate: f64,
    pub avg_latency_ms: u64,
}

#[tauri::command]
pub async fn get_mirror_stats() -> Result<Vec<MirrorStat>, crate::error::LauncherError> {
    let stats = crate::download::mirror_health::get_mirror_stats();
    Ok(stats
        .into_iter()
        .map(|(url, success_rate, avg_latency)| MirrorStat {
            url,
            success_rate,
            avg_latency_ms: avg_latency,
        })
        .collect())
}

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
