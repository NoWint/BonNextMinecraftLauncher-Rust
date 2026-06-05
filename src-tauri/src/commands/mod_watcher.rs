use tauri::State;
use crate::mod_watcher::watcher::ModWatcherState;
use crate::platform::paths;

#[tauri::command]
pub async fn watch_instance_mods(instance_id: String, state: State<'_, ModWatcherState>) -> Result<(), String> {
    let instance_dir = paths::get_instance_minecraft_dir(&instance_id);
    crate::mod_watcher::watcher::watch_instance(&state, instance_id, instance_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unwatch_instance_mods(instance_id: String, state: State<'_, ModWatcherState>) -> Result<(), String> {
    crate::mod_watcher::watcher::unwatch_instance(&state, &instance_id)
        .await
        .map_err(|e| e.to_string())
}
