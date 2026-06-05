use crate::config;
use crate::error::LauncherError;

#[tauri::command]
pub async fn get_config() -> Result<config::AppConfig, LauncherError> {
    config::load_config_async().await
}

#[tauri::command]
pub async fn save_config(config: config::AppConfig) -> Result<(), LauncherError> {
    let source_changed = {
        let current = config::get_download_source_name();
        current != config.download_source
    };
    config::save_config_async(&config).await?;
    if source_changed {
        crate::download::source::set_active(&config.download_source);
        tracing::info!("Download source changed to: {}", config.download_source);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_active_download_source() -> String {
    crate::download::source::active_source_name()
}

#[tauri::command]
pub async fn get_active_shell() -> Result<String, LauncherError> {
    let config = config::load_config_async().await?;
    Ok(config.active_shell)
}

#[tauri::command]
pub async fn set_active_shell(shell_id: String) -> Result<(), LauncherError> {
    let valid_shells = ["zzz", "swiftui", "fluent", "tv"];
    if !valid_shells.contains(&shell_id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Unknown shell: {}",
            shell_id
        )));
    }
    let mut config = config::load_config_async().await?;
    config.active_shell = shell_id;
    config::save_config_async(&config).await?;
    Ok(())
}
