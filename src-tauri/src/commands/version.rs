use crate::error::LauncherError;
use crate::version::manifest::VersionEntry;

#[tauri::command]
pub async fn get_versions() -> Result<Vec<VersionEntry>, LauncherError> {
    crate::version::manifest::fetch_versions_sorted().await
}
