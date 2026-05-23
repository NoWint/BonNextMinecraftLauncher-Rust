use crate::auth;
use crate::error::LauncherError;
use crate::instance;
use crate::AppState;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BatteryStatus {
    pub on_battery: bool,
    pub percentage: f32,
    pub charging: bool,
}

#[tauri::command]
pub async fn cli_launch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<(), LauncherError> {
    let inst = instance::manager::get_instance(&instance_id)?
        .ok_or_else(|| LauncherError::Other(format!("Instance not found: {}", instance_id)))?;

    tracing::info!("CLI launch: {} ({})", inst.name, inst.id);

    let account = auth::token_store::AccountStore::load()
        .ok()
        .and_then(|s| s.get_active().cloned())
        .ok_or_else(|| LauncherError::AuthFailed("No active account".to_string()))?;

    let access_token = match auth::token_store::ensure_fresh_token().await {
        Ok(Some(fresh)) => fresh,
        Ok(None) => account.access_token.clone(),
        Err(e) => {
            tracing::warn!("Token refresh failed, using existing: {}", e);
            account.access_token.clone()
        }
    };

    let user_type = if account.account_type == "microsoft" {
        "msa"
    } else {
        "mojang"
    }
    .to_string();

    crate::commands::launch::launch_game_inner(
        app,
        state.launch_state.clone(),
        inst.version_id,
        inst.version_url,
        account.username,
        account.uuid,
        access_token,
        user_type,
        Some(inst.max_memory),
        Some(inst.min_memory),
        inst.java_path,
        inst.jvm_args,
        Some(instance_id),
    )
    .await
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
