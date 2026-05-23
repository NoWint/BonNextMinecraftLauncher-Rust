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
    use starship_battery::{Manager, State, units::ratio::percent};

    let manager = match Manager::new() {
        Ok(m) => m,
        Err(_) => {
            return Ok(BatteryStatus {
                on_battery: false,
                percentage: 100.0,
                charging: true,
            });
        }
    };

    let mut battery_iter = match manager.batteries() {
        Ok(b) => b,
        Err(_) => {
            return Ok(BatteryStatus {
                on_battery: false,
                percentage: 100.0,
                charging: true,
            });
        }
    };

    match battery_iter.next() {
        Some(Ok(bat)) => {
            let percentage = bat.state_of_charge().get::<percent>();
            let state = bat.state();
            Ok(BatteryStatus {
                on_battery: state == State::Discharging,
                percentage,
                charging: state == State::Charging,
            })
        }
        _ => Ok(BatteryStatus {
            on_battery: false,
            percentage: 100.0,
            charging: true,
        }),
    }
}
