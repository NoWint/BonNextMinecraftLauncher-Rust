use crate::error::LauncherError;
use crate::instance;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BatteryStatus {
    pub on_battery: bool,
    pub percentage: f32,
    pub charging: bool,
}

#[tauri::command]
pub async fn cli_launch(instance_id: String) -> Result<(), LauncherError> {
    let instance = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::Other(format!("Instance not found: {}", instance_id)))?;
    tracing::info!("CLI launch requested for instance: {} ({})", instance.name, instance.id);
    Ok(())
}

#[tauri::command]
pub async fn get_battery_status() -> Result<BatteryStatus, LauncherError> {
    Ok(BatteryStatus {
        on_battery: false,
        percentage: 100.0,
        charging: true,
    })
}
