use crate::error::LauncherError;
use crate::platform::paths;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomShellMeta {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub entry: String,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub preview: Option<String>,
    #[serde(default)]
    pub min_app_version: Option<String>,
    pub supported_themes: Vec<String>,
    pub supported_routes: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    /// Absolute path to the shell directory on disk
    pub path: String,
}

#[tauri::command]
pub async fn scan_custom_shells() -> Result<Vec<CustomShellMeta>, LauncherError> {
    let data_dir = paths::get_game_dir();
    let shells_dir = data_dir.join("shells");

    if !shells_dir.exists() {
        return Ok(vec![]);
    }

    let mut results = Vec::new();
    let mut entries = fs::read_dir(&shells_dir).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read shells directory: {}", e),
        ))
    })?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read directory entry: {}", e),
        ))
    })? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }

        match fs::read_to_string(&manifest_path).await {
            Ok(content) => {
                let mut meta: CustomShellMeta = match serde_json::from_str(&content) {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::warn!(
                            "Invalid manifest.json in {}: {}",
                            path.display(),
                            e
                        );
                        continue;
                    }
                };

                let entry_path = path.join(&meta.entry);
                if !entry_path.exists() {
                    tracing::warn!(
                        "Entry file {} not found in {}",
                        meta.entry,
                        path.display()
                    );
                    continue;
                }

                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                if meta.id != dir_name {
                    tracing::warn!(
                        "Shell id '{}' doesn't match directory name '{}' in {}",
                        meta.id,
                        dir_name,
                        path.display()
                    );
                    continue;
                }

                meta.path = path.to_string_lossy().to_string();
                results.push(meta);
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to read manifest.json in {}: {}",
                    path.display(),
                    e
                );
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn import_custom_shell(source_path: String) -> Result<CustomShellMeta, LauncherError> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Source path does not exist: {}",
            source_path
        )));
    }

    let shell_dir = if source.extension().map_or(false, |e| e == "zip") {
        let temp_dir = std::env::temp_dir().join("bonnext-shell-import");
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir).await.map_err(|e| {
                LauncherError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to clean temp dir: {}", e),
                ))
            })?;
        }
        fs::create_dir_all(&temp_dir).await.map_err(|e| {
            LauncherError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to create temp dir: {}", e),
            ))
        })?;

        let file = std::fs::File::open(&source).map_err(|e| {
            LauncherError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to open zip: {}", e),
            ))
        })?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            LauncherError::InvalidConfig(format!("Failed to read zip: {}", e))
        })?;
        archive.extract(&temp_dir).map_err(|e| {
            LauncherError::InvalidConfig(format!("Failed to extract zip: {}", e))
        })?;

        let entries: Vec<_> = std::fs::read_dir(&temp_dir)
            .map_err(|e| {
                LauncherError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to read extracted dir: {}", e),
                ))
            })?
            .filter_map(|e| e.ok())
            .collect();

        if entries.len() == 1 && entries[0].path().is_dir() {
            entries[0].path().clone()
        } else {
            temp_dir
        }
    } else if source.is_dir() {
        source.clone()
    } else {
        return Err(LauncherError::InvalidConfig(format!(
            "Source must be a directory or zip file: {}",
            source_path
        )));
    };

    let manifest_path = shell_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err(LauncherError::InvalidConfig(
            "manifest.json not found in shell package".to_string(),
        ));
    }

    let content = fs::read_to_string(&manifest_path).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read manifest.json: {}", e),
        ))
    })?;
    let mut meta: CustomShellMeta = serde_json::from_str(&content).map_err(|e| {
        LauncherError::InvalidConfig(format!("Invalid manifest.json: {}", e))
    })?;

    let entry_path = shell_dir.join(&meta.entry);
    if !entry_path.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Entry file '{}' not found in shell package",
            meta.entry
        )));
    }

    if !meta.id.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell id must be alphanumeric with hyphens: '{}'",
            meta.id
        )));
    }

    let builtin_shells = ["zzz", "swiftui", "fluent", "tv"];
    if builtin_shells.contains(&meta.id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell id '{}' conflicts with a built-in shell",
            meta.id
        )));
    }

    let data_dir = paths::get_game_dir();
    let dest_dir = data_dir.join("shells").join(&meta.id);

    if dest_dir.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell with id '{}' already exists. Remove it first before importing.",
            meta.id
        )));
    }

    fs::create_dir_all(&dest_dir).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to create shell directory: {}", e),
        ))
    })?;

    copy_dir_recursive(&shell_dir, &dest_dir)?;

    meta.path = dest_dir.to_string_lossy().to_string();
    Ok(meta)
}

#[tauri::command]
pub async fn remove_custom_shell(id: String) -> Result<(), LauncherError> {
    let data_dir = paths::get_game_dir();
    let shell_dir = data_dir.join("shells").join(&id);

    if !shell_dir.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell directory not found: {}",
            shell_dir.display()
        )));
    }

    let builtin_shells = ["zzz", "swiftui", "fluent", "tv"];
    if builtin_shells.contains(&id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Cannot remove built-in shell: {}",
            id
        )));
    }

    fs::remove_dir_all(&shell_dir).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to remove shell directory: {}", e),
        ))
    })?;

    Ok(())
}

#[tauri::command]
pub async fn get_custom_shell_entry(id: String) -> Result<String, LauncherError> {
    let data_dir = paths::get_game_dir();
    let shell_dir = data_dir.join("shells").join(&id);

    if !shell_dir.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell directory not found: {}",
            shell_dir.display()
        )));
    }

    let manifest_path = shell_dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read manifest.json: {}", e),
        ))
    })?;
    let meta: CustomShellMeta = serde_json::from_str(&content).map_err(|e| {
        LauncherError::InvalidConfig(format!("Invalid manifest.json: {}", e))
    })?;

    let entry_path = shell_dir.join(&meta.entry);
    if !entry_path.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Entry file not found: {}",
            entry_path.display()
        )));
    }

    Ok(entry_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_custom_shell_css(id: String) -> Result<Option<String>, LauncherError> {
    let data_dir = paths::get_game_dir();
    let shell_dir = data_dir.join("shells").join(&id);

    if !shell_dir.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell directory not found: {}",
            shell_dir.display()
        )));
    }

    let manifest_path = shell_dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read manifest.json: {}", e),
        ))
    })?;
    let meta: CustomShellMeta = serde_json::from_str(&content).map_err(|e| {
        LauncherError::InvalidConfig(format!("Invalid manifest.json: {}", e))
    })?;

    if let Some(style) = &meta.style {
        let css_path = shell_dir.join(style);
        if css_path.exists() {
            return Ok(Some(css_path.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn save_shell_config(shell_id: String, config_json: String) -> Result<(), LauncherError> {
    let data_dir = paths::get_game_dir();
    let shell_dir = data_dir.join("shells").join(&shell_id);

    fs::create_dir_all(&shell_dir).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to create shell dir: {}", e),
        ))
    })?;

    let config_path = shell_dir.join("shell.json");
    fs::write(&config_path, &config_json).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to write shell config: {}", e),
        ))
    })?;

    // Also write/update manifest.json
    let manifest = serde_json::json!({
        "id": shell_id,
        "name": shell_id,
        "version": "1.0.0",
        "entry": "shell.json",
        "supported_themes": ["dark", "light"],
        "supported_routes": ["/home", "/instances", "/settings", "/versions", "/library", "/collections", "/store"],
    });
    let manifest_path = shell_dir.join("manifest.json");
    let manifest_str = serde_json::to_string_pretty(&manifest).map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to serialize manifest: {}", e),
        ))
    })?;
    fs::write(&manifest_path, &manifest_str).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to write manifest: {}", e),
        ))
    })?;

    Ok(())
}

#[tauri::command]
pub async fn load_shell_config(shell_id: String) -> Result<String, LauncherError> {
    let data_dir = paths::get_game_dir();
    let config_path = data_dir.join("shells").join(&shell_id).join("shell.json");

    if !config_path.exists() {
        return Ok("{}".to_string());
    }

    fs::read_to_string(&config_path).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read shell config: {}", e),
        ))
    })
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), LauncherError> {
    std::fs::create_dir_all(dst).map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to create directory: {}", e),
        ))
    })?;

    for entry in std::fs::read_dir(src).map_err(|e| {
        LauncherError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to read directory: {}", e),
        ))
    })? {
        let entry = entry.map_err(|e| {
            LauncherError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to read entry: {}", e),
            ))
        })?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path).map_err(|e| {
                LauncherError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to copy file: {}", e),
                ))
            })?;
        }
    }

    Ok(())
}
