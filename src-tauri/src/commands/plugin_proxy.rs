use crate::error::LauncherError;
use std::collections::HashMap;

/// Plugin HTTP proxy: GET request
#[tauri::command]
pub async fn plugin_http_get(
    url: String,
    params: Option<HashMap<String, String>>,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, LauncherError> {
    let client = crate::http_client::build_client();
    let mut req = client.get(&url);
    if let Some(p) = params {
        req = req.query(&p);
    }
    if let Some(h) = headers {
        for (k, v) in h {
            req = req.header(k, v);
        }
    }
    let resp = req.send().await?;
    let json: serde_json::Value = resp.json().await?;
    Ok(json)
}

/// Plugin HTTP proxy: POST request
#[tauri::command]
pub async fn plugin_http_post(
    url: String,
    body: serde_json::Value,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, LauncherError> {
    let client = crate::http_client::build_client();
    let mut req = client.post(&url).json(&body);
    if let Some(h) = headers {
        for (k, v) in h {
            req = req.header(k, v);
        }
    }
    let resp = req.send().await?;
    let json: serde_json::Value = resp.json().await?;
    Ok(json)
}

/// Plugin storage: get value
#[tauri::command]
pub async fn plugin_storage_get(key: String) -> Result<Option<String>, LauncherError> {
    let path = crate::platform::paths::get_game_dir().join("plugin_storage.json");
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path)?;
    let map: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    Ok(map.get(&key).cloned())
}

/// Plugin storage: set value
#[tauri::command]
pub async fn plugin_storage_set(key: String, value: String) -> Result<(), LauncherError> {
    let path = crate::platform::paths::get_game_dir().join("plugin_storage.json");
    let mut map: HashMap<String, String> = if path.exists() {
        let data = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };
    map.insert(key, value);
    let data = serde_json::to_string_pretty(&map)?;
    std::fs::write(&path, data)?;
    Ok(())
}

/// Plugin storage: delete value
#[tauri::command]
pub async fn plugin_storage_delete(key: String) -> Result<(), LauncherError> {
    let path = crate::platform::paths::get_game_dir().join("plugin_storage.json");
    if !path.exists() {
        return Ok(());
    }
    let data = std::fs::read_to_string(&path).unwrap_or_default();
    let mut map: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    map.remove(&key);
    let data = serde_json::to_string_pretty(&map)?;
    std::fs::write(&path, data)?;
    Ok(())
}
