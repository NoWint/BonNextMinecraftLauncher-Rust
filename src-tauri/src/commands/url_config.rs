use crate::url_config;

#[tauri::command]
pub async fn get_url_config() -> Result<url_config::UrlConfigSnapshot, String> {
    url_config::get_url_config_snapshot().map_err(|e: crate::error::LauncherError| e.to_string())
}

#[tauri::command]
pub async fn set_git_proxy(enabled: bool, proxy_url: Option<String>) -> Result<(), String> {
    url_config::set_git_proxy(enabled, proxy_url).map_err(|e: crate::error::LauncherError| e.to_string())
}
