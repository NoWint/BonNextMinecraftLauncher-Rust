use crate::error::LauncherError;
use std::collections::HashMap;
use std::io::Read;

/// Plugin HTTP proxy: GET request
#[tauri::command]
pub async fn plugin_http_get(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    url: String,
    params: Option<HashMap<String, String>>,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_http(&url) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot access {}",
            session.plugin_id, url
        )));
    }
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
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    url: String,
    body: serde_json::Value,
    headers: Option<HashMap<String, String>>,
) -> Result<serde_json::Value, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_http(&url) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot access {}",
            session.plugin_id, url
        )));
    }
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

/// Resolve the per-plugin storage file path. Validates the plugin ID
/// character set to prevent path traversal. Returns
/// `game_dir/plugin_storage/<plugin_id>.json`.
fn plugin_storage_path(plugin_id: &str) -> Result<std::path::PathBuf, LauncherError> {
    if !plugin_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '.' || c == '-')
    {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }
    let dir = crate::platform::paths::get_game_dir().join("plugin_storage");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(format!("{}.json", plugin_id)))
}

/// Plugin storage: get value
#[tauri::command]
pub async fn plugin_storage_get(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    key: String,
) -> Result<Option<String>, LauncherError> {
    let session = session_store.validate(&token)?;
    let path = plugin_storage_path(&session.plugin_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path)?;
    let map: HashMap<String, String> = serde_json::from_str(&data).unwrap_or_default();
    Ok(map.get(&key).cloned())
}

/// Plugin storage: set value
#[tauri::command]
pub async fn plugin_storage_set(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    key: String,
    value: String,
) -> Result<(), LauncherError> {
    let session = session_store.validate(&token)?;
    let path = plugin_storage_path(&session.plugin_id)?;

    if value.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::Other(
            "Storage value too large (max 10MB)".to_string(),
        ));
    }

    let mut map: HashMap<String, String> = if path.exists() {
        let data = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let total_size: usize = map.values().map(|v| v.len()).sum::<usize>() + value.len();
    if total_size > 50 * 1024 * 1024 {
        return Err(LauncherError::Other(
            "Plugin storage quota exceeded (max 50MB)".to_string(),
        ));
    }

    map.insert(key, value);
    let data = serde_json::to_string_pretty(&map)?;
    std::fs::write(&path, data)?;
    Ok(())
}

/// Plugin storage: delete value
#[tauri::command]
pub async fn plugin_storage_delete(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    key: String,
) -> Result<(), LauncherError> {
    let session = session_store.validate(&token)?;
    let path = plugin_storage_path(&session.plugin_id)?;
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
    pub contributes: Option<serde_json::Value>,
    pub entry: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<bool>,
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
                        contributes: manifest.get("contributes").cloned(),
                        entry: manifest["entry"]
                            .as_str()
                            .map(|s| s.to_string())
                            .or(Some("index.js".to_string())),
                        sandbox: manifest.get("sandbox").and_then(|v| v.as_bool()),
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
///
/// If the zip contains SIGNATURE.sig and SIGNATURE.pubkey, the signature is
/// verified against the trusted key set. Installation is rejected if the
/// signature is invalid or the key is untrusted. Unsigned plugins (no
/// SIGNATURE.sig) are allowed but logged as a warning.
#[tauri::command]
pub async fn install_plugin(
    key_store: tauri::State<'_, crate::commands::plugin_install::TrustedKeyStore>,
    zip_path: String,
) -> Result<InstalledPluginInfo, LauncherError> {
    let plugins_dir = plugins_dir();
    std::fs::create_dir_all(&plugins_dir)?;

    // Open the zip file for signature verification first
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| LauncherError::Other(format!("Failed to open zip file: {}", e)))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Invalid zip file: {}", e)))?;

    // Verify signature if present
    let verification = crate::commands::plugin_install::verify_plugin_signature(&mut archive, &key_store)?;
    match &verification {
        crate::commands::plugin_install::SignatureVerificationResult::Valid { key_id, key_label } => {
            tracing::info!("Plugin signature verified: key={} ({})", key_id, key_label);
        }
        crate::commands::plugin_install::SignatureVerificationResult::Invalid { reason } => {
            return Err(LauncherError::Other(format!(
                "Plugin signature verification failed: {}. Installation rejected.",
                reason
            )));
        }
        crate::commands::plugin_install::SignatureVerificationResult::Untrusted { public_key } => {
            return Err(LauncherError::Other(format!(
                "Plugin signed by untrusted public key: {}. Add this key to trusted keys first, or remove SIGNATURE.sig/SIGNATURE.pubkey from the zip for unsigned installation.",
                public_key
            )));
        }
        crate::commands::plugin_install::SignatureVerificationResult::Unsigned => {
            tracing::warn!("Installing unsigned plugin (no SIGNATURE.sig found in zip)");
        }
    }

    // Re-open the zip for extraction (the archive cursor was advanced during verification)
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| LauncherError::Other(format!("Failed to re-open zip file: {}", e)))?;
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
        contributes: manifest.get("contributes").cloned(),
        entry: manifest["entry"]
            .as_str()
            .map(|s| s.to_string())
            .or(Some("index.js".to_string())),
        sandbox: manifest.get("sandbox").and_then(|v| v.as_bool()),
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

// ============================================================================
// Plugin Filesystem Commands (Phase 5: Plugin Ecosystem)
// ============================================================================

/// Validate plugin ID for filesystem commands. Empty is allowed (the frontend
/// may not always have a plugin_id available). Non-empty IDs must be
/// alphanumeric + dots + dashes.
fn validate_plugin_id_fs(plugin_id: &str) -> Result<(), LauncherError> {
    if plugin_id.is_empty() {
        return Ok(());
    }
    if plugin_id.len() > 256 {
        return Err(LauncherError::Other("Plugin ID too long".to_string()));
    }
    if !plugin_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '.' || c == '-')
    {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }
    Ok(())
}

/// Resolve the root directory for a given filesystem scope.
/// - `instances` → game_dir/instances
/// - `config`    → config_dir
/// - `global`    → game_dir
fn resolve_fs_scope_root(scope: &str) -> Result<std::path::PathBuf, LauncherError> {
    match scope {
        "instances" => Ok(crate::platform::paths::get_game_dir().join("instances")),
        "config" => Ok(crate::platform::paths::get_config_dir()),
        "global" => Ok(crate::platform::paths::get_game_dir()),
        _ => Err(LauncherError::Other(format!(
            "Unknown filesystem scope: {}",
            scope
        ))),
    }
}

/// Canonicalize `path`. If it doesn't exist, walk up to the nearest existing
/// ancestor, canonicalize that (following symlinks), and re-append the
/// non-existent tail components. This catches symlink escapes in both the
/// read (existing file) and write (non-existent file) cases.
fn canonicalize_with_ancestors(
    path: &std::path::Path,
) -> Result<std::path::PathBuf, LauncherError> {
    if let Ok(c) = path.canonicalize() {
        return Ok(c);
    }
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    let mut current = path;
    loop {
        match current.parent() {
            Some(parent) => {
                if let Some(name) = current.file_name() {
                    tail.push(name.to_os_string());
                }
                current = parent;
                if current.exists() {
                    break;
                }
            }
            None => {
                return Err(LauncherError::Other(
                    "Path escapes allowed directory".to_string(),
                ));
            }
        }
    }
    let canonical = current.canonicalize().map_err(|_| {
        LauncherError::Other("Path escapes allowed directory".to_string())
    })?;
    let mut result = canonical;
    for name in tail.iter().rev() {
        result.push(name);
    }
    Ok(result)
}

/// Join `relative_path` onto the scope `root` and verify the canonical result
/// stays within `root`. Rejects `..` components, absolute paths, and symlink
/// escapes. Returns the canonicalized full path on success.
fn safe_join_fs(
    root: &std::path::Path,
    relative_path: &str,
) -> Result<std::path::PathBuf, LauncherError> {
    if relative_path.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "Path contains null bytes".into(),
        ));
    }
    if relative_path.len() > 4096 {
        return Err(LauncherError::SecurityValidation(
            "Path exceeds maximum length of 4096".into(),
        ));
    }
    let p = std::path::Path::new(relative_path);
    // Primary traversal defense: reject `..` and absolute paths.
    for component in p.components() {
        match component {
            std::path::Component::ParentDir | std::path::Component::RootDir => {
                return Err(LauncherError::Other(
                    "Path escapes allowed directory".to_string(),
                ));
            }
            _ => {}
        }
    }

    let full = root.join(p);

    // Secondary defense: canonicalize and verify containment. If the root
    // itself doesn't exist, no file under it can exist either, so the `..`
    // check above is sufficient — return the joined path directly.
    let canonical_root = match root.canonicalize() {
        Ok(c) => c,
        Err(_) => return Ok(full),
    };

    let canonical_full = canonicalize_with_ancestors(&full)?;

    if !canonical_full.starts_with(&canonical_root) {
        return Err(LauncherError::Other(
            "Path escapes allowed directory".to_string(),
        ));
    }
    Ok(canonical_full)
}

/// Plugin filesystem: read a text file (UTF-8, max 10MB, no binary).
#[tauri::command]
pub async fn plugin_fs_read(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    scope: String,
    path: String,
) -> Result<String, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_fs_read(&scope) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot read scope {}",
            session.plugin_id, scope
        )));
    }
    let root = resolve_fs_scope_root(&scope)?;
    let full = safe_join_fs(&root, &path)?;

    if !full.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "File not found: {}",
            path
        )));
    }
    let metadata = std::fs::metadata(&full)?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::InvalidConfig(
            "File too large for text editing (max 10MB)".into(),
        ));
    }
    let bytes = std::fs::read(&full)?;
    let is_binary = bytes.iter().any(|&b| b == 0);
    if is_binary {
        return Err(LauncherError::InvalidConfig(
            "Binary file - read-only mode".into(),
        ));
    }
    String::from_utf8(bytes)
        .map_err(|_| LauncherError::InvalidConfig("File is not valid UTF-8".into()))
}

/// Plugin filesystem: write a text file (max 10MB). Creates parent dirs.
#[tauri::command]
pub async fn plugin_fs_write(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    scope: String,
    path: String,
    content: String,
) -> Result<(), LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_fs_write(&scope) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot write scope {}",
            session.plugin_id, scope
        )));
    }
    let root = resolve_fs_scope_root(&scope)?;
    let full = safe_join_fs(&root, &path)?;

    if content.len() > 10 * 1024 * 1024 {
        return Err(LauncherError::InvalidConfig(
            "Content too large (max 10MB)".into(),
        ));
    }
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&full, &content)?;
    tracing::debug!(
        "plugin_fs_write: plugin_id={}, scope={}, path={}",
        session.plugin_id,
        scope,
        path
    );
    Ok(())
}

/// Plugin filesystem: check if a file or directory exists.
#[tauri::command]
pub async fn plugin_fs_exists(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    scope: String,
    path: String,
) -> Result<bool, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_fs_read(&scope) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot read scope {}",
            session.plugin_id, scope
        )));
    }
    let root = resolve_fs_scope_root(&scope)?;
    let full = safe_join_fs(&root, &path)?;
    Ok(full.exists())
}

/// Plugin filesystem: list directory entries (sorted file/folder names).
/// Returns an empty vector if the directory does not exist.
#[tauri::command]
pub async fn plugin_fs_read_dir(
    session_store: tauri::State<'_, crate::commands::plugin_session::SessionStore>,
    token: String,
    scope: String,
    path: String,
) -> Result<Vec<String>, LauncherError> {
    let session = session_store.validate(&token)?;
    if !session.can_fs_read(&scope) {
        return Err(LauncherError::Other(format!(
            "Permission denied: plugin {} cannot read scope {}",
            session.plugin_id, scope
        )));
    }
    let root = resolve_fs_scope_root(&scope)?;
    let full = safe_join_fs(&root, &path)?;

    if !full.exists() {
        return Ok(Vec::new());
    }
    if !full.is_dir() {
        return Err(LauncherError::InvalidConfig(format!(
            "Not a directory: {}",
            path
        )));
    }

    let entries = std::fs::read_dir(&full)?;
    let mut names: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        if let Some(name) = entry.file_name().to_str() {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

