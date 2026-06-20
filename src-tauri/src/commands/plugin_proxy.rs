use crate::error::LauncherError;
use std::collections::HashMap;
use std::io::Read;

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

// ============================================================================
// Plugin Lifecycle Commands (Phase 5: Plugin Ecosystem)
// ============================================================================

/// Installed plugin info (from manifest.json)
#[derive(serde::Serialize)]
pub struct InstalledPluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub permissions: Vec<String>,
    pub directory: String,
}

/// Get the plugins directory (game_dir/plugins/)
fn plugins_dir() -> std::path::PathBuf {
    crate::platform::paths::get_game_dir().join("plugins")
}

/// List all installed third-party plugins (from game_dir/plugins/)
#[tauri::command]
pub async fn list_installed_plugins() -> Result<Vec<InstalledPluginInfo>, LauncherError> {
    let plugins_dir = plugins_dir();
    let mut plugins = Vec::new();

    if !plugins_dir.exists() {
        return Ok(plugins);
    }

    let entries = std::fs::read_dir(&plugins_dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        match std::fs::read_to_string(&manifest_path) {
            Ok(content) => {
                if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                    plugins.push(InstalledPluginInfo {
                        id: manifest["id"].as_str().unwrap_or("unknown").to_string(),
                        name: manifest["name"].as_str().unwrap_or("Unknown").to_string(),
                        version: manifest["version"].as_str().unwrap_or("0.0.0").to_string(),
                        description: manifest["description"].as_str().map(|s| s.to_string()),
                        author: manifest["author"].as_str().map(|s| s.to_string()),
                        permissions: manifest["permissions"]
                            .as_array()
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        directory: path.to_string_lossy().to_string(),
                    });
                }
            }
            Err(_) => continue,
        }
    }

    Ok(plugins)
}

/// Install a plugin from a .zip file path.
/// Extracts to game_dir/plugins/<plugin_id>/
#[tauri::command]
pub async fn install_plugin(zip_path: String) -> Result<InstalledPluginInfo, LauncherError> {
    let plugins_dir = plugins_dir();
    std::fs::create_dir_all(&plugins_dir)?;

    // Open the zip file
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| LauncherError::Other(format!("Failed to open zip file: {}", e)))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Invalid zip file: {}", e)))?;

    // First pass: read manifest.json to determine plugin ID
    let mut manifest: Option<serde_json::Value> = None;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| LauncherError::Other(format!("Zip read error: {}", e)))?;
        let name = entry.name().to_string();
        // Look for manifest.json at root or in a subdirectory
        if name.ends_with("manifest.json") && name.matches('/').count() <= 1 {
            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| LauncherError::Other(format!("Failed to read manifest: {}", e)))?;
            if let Ok(m) = serde_json::from_str::<serde_json::Value>(&content) {
                manifest = Some(m);
                break;
            }
        }
    }

    let manifest = manifest.ok_or_else(|| LauncherError::Other("Plugin manifest.json not found in zip".to_string()))?;
    let plugin_id = manifest["id"].as_str().ok_or_else(|| LauncherError::Other("Plugin manifest missing 'id' field".to_string()))?;

    // Validate plugin ID (alphanumeric + dots + dashes only)
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err(LauncherError::Other("Invalid plugin ID: only alphanumeric, dots, and dashes allowed".to_string()));
    }

    let plugin_dir = plugins_dir.join(plugin_id);
    // Remove existing plugin if present
    if plugin_dir.exists() {
        std::fs::remove_dir_all(&plugin_dir).map_err(|e| LauncherError::Other(format!("Failed to remove old plugin: {}", e)))?;
    }
    std::fs::create_dir_all(&plugin_dir)?;

    // Second pass: extract all files
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| LauncherError::Other(format!("Zip read error: {}", e)))?;
        let entry_name = entry.name().to_string();

        // Skip directories (they'll be created when extracting files)
        if entry_name.ends_with('/') {
            continue;
        }

        // Determine the target path. Strip leading directory if present (e.g., my-plugin/index.js → index.js)
        let parts: Vec<&str> = entry_name.split('/').collect();
        let relative_path = if parts.len() > 1 {
            // If the first segment looks like a top-level folder (e.g., plugin name), strip it
            parts[1..].join("/")
        } else {
            entry_name.clone()
        };
        let relative_path = if relative_path.is_empty() {
            entry_name.clone()
        } else {
            relative_path
        };

        let target_path = plugin_dir.join(&relative_path);
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| LauncherError::Other(format!("Failed to create directory: {}", e)))?;
        }

        let mut file_content = Vec::new();
        entry.read_to_end(&mut file_content).map_err(|e| LauncherError::Other(format!("Failed to read file: {}", e)))?;
        std::fs::write(&target_path, &file_content).map_err(|e| LauncherError::Other(format!("Failed to write file: {}", e)))?;
    }

    tracing::info!("Plugin '{}' installed to {}", plugin_id, plugin_dir.display());

    Ok(InstalledPluginInfo {
        id: plugin_id.to_string(),
        name: manifest["name"].as_str().unwrap_or("Unknown").to_string(),
        version: manifest["version"].as_str().unwrap_or("0.0.0").to_string(),
        description: manifest["description"].as_str().map(|s| s.to_string()),
        author: manifest["author"].as_str().map(|s| s.to_string()),
        permissions: manifest["permissions"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default(),
        directory: plugin_dir.to_string_lossy().to_string(),
    })
}

/// Uninstall a plugin by ID (removes game_dir/plugins/<id>/)
#[tauri::command]
pub async fn uninstall_plugin(plugin_id: String) -> Result<(), LauncherError> {
    // Validate plugin ID
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }

    let plugin_dir = plugins_dir().join(&plugin_id);
    if !plugin_dir.exists() {
        return Err(LauncherError::Other(format!("Plugin '{}' not found", plugin_id)));
    }

    std::fs::remove_dir_all(&plugin_dir).map_err(|e| LauncherError::Other(format!("Failed to remove plugin: {}", e)))?;
    tracing::info!("Plugin '{}' uninstalled", plugin_id);
    Ok(())
}

/// Read a plugin's manifest.json
#[tauri::command]
pub async fn get_plugin_manifest(plugin_id: String) -> Result<serde_json::Value, LauncherError> {
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }

    let manifest_path = plugins_dir().join(&plugin_id).join("manifest.json");
    if !manifest_path.exists() {
        return Err(LauncherError::Other(format!("Plugin '{}' manifest not found", plugin_id)));
    }

    let content = std::fs::read_to_string(&manifest_path)?;
    let manifest: serde_json::Value = serde_json::from_str(&content)?;
    Ok(manifest)
}

