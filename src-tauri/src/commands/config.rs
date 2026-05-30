use crate::config;
use crate::error::LauncherError;

#[tauri::command]
pub async fn get_config() -> Result<config::AppConfig, LauncherError> {
    config::load_config_async().await
}

#[tauri::command]
pub async fn save_config(config: config::AppConfig) -> Result<(), LauncherError> {
    config::save_config_async(&config).await
}
