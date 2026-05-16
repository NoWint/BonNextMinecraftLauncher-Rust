use directories::BaseDirs;
use std::path::PathBuf;

pub fn get_default_game_dir() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        base_dirs.data_dir().join("bonnext")
    } else {
        PathBuf::from(".bonnext")
    }
}

pub fn get_game_dir() -> PathBuf {
    if let Ok(cfg) = crate::config::load_config() {
        if let Some(ref game_dir) = cfg.game_dir {
            if !game_dir.is_empty() {
                let path = PathBuf::from(game_dir);
                if path.is_absolute() {
                    return path;
                }
            }
        }
    }
    get_default_game_dir()
}

// ---------------------------------------------------------------
// Shared directories (global, shared across instances)
// ---------------------------------------------------------------

/// Shared libraries directory — libraries are downloaded once and hard-linked
/// into instance directories to save disk space.
pub fn get_shared_libraries_dir() -> PathBuf {
    get_game_dir().join("shared").join("libraries")
}

/// Shared assets directory — global asset store (Mojang's objects/ layout).
pub fn get_shared_assets_dir() -> PathBuf {
    get_game_dir().join("shared").join("assets")
}

/// Shared versions directory — vanilla version JSONs and client JARs.
pub fn get_shared_versions_dir() -> PathBuf {
    get_game_dir().join("shared").join("versions")
}

// ---------------------------------------------------------------
// Legacy global directories (used as fallback / for vanilla launch)
// ---------------------------------------------------------------

pub fn get_versions_dir() -> PathBuf {
    get_shared_versions_dir()
}

pub fn get_libraries_dir() -> PathBuf {
    get_shared_libraries_dir()
}

pub fn get_assets_dir() -> PathBuf {
    get_shared_assets_dir()
}

pub fn get_logs_dir() -> PathBuf {
    get_game_dir().join("logs")
}

// ---------------------------------------------------------------
// Instance-specific directories
// ---------------------------------------------------------------

/// Root directory for a specific instance.
pub fn get_instance_dir(instance_id: &str) -> PathBuf {
    get_game_dir().join("instances").join(instance_id)
}

/// The instance's .minecraft directory (mods, config, saves, etc.).
pub fn get_instance_minecraft_dir(instance_id: &str) -> PathBuf {
    get_instance_dir(instance_id).join(".minecraft")
}

/// Instance-specific versions directory (for loader-modified version JSONs).
pub fn get_instance_versions_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("versions")
}

/// Instance-specific libraries directory (hard links to shared).
pub fn get_instance_libraries_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("libraries")
}

/// Instance-specific natives directory.
pub fn get_instance_natives_dir(instance_id: &str, version_id: &str) -> PathBuf {
    get_instance_versions_dir(instance_id)
        .join(version_id)
        .join("natives")
}

/// Instance mods directory.
pub fn get_instance_mods_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("mods")
}

/// Instance config directory.
pub fn get_instance_config_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("config")
}

/// Instance saves directory.
pub fn get_instance_saves_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("saves")
}

/// Instance resource packs directory.
pub fn get_instance_resourcepacks_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("resourcepacks")
}

/// Instance shader packs directory.
pub fn get_instance_shaderpacks_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("shaderpacks")
}

// ---------------------------------------------------------------
// Config
// ---------------------------------------------------------------

pub fn get_config_dir() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        base_dirs.data_dir().join("bonnext")
    } else {
        PathBuf::from(".bonnext")
    }
}

pub fn get_config_path() -> PathBuf {
    get_config_dir().join("config.json")
}

// ---------------------------------------------------------------
// Ensure all required directories exist
// ---------------------------------------------------------------

pub fn ensure_dirs() -> std::io::Result<()> {
    let dirs = [
        get_game_dir(),
        get_shared_libraries_dir(),
        get_shared_assets_dir(),
        get_shared_versions_dir(),
        get_logs_dir(),
        get_config_dir(),
    ];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}

/// Create all directories needed for a specific instance.
pub fn ensure_instance_dirs(instance_id: &str) -> std::io::Result<()> {
    let dirs = [
        get_instance_dir(instance_id),
        get_instance_minecraft_dir(instance_id),
        get_instance_versions_dir(instance_id),
        get_instance_libraries_dir(instance_id),
        get_instance_mods_dir(instance_id),
        get_instance_config_dir(instance_id),
        get_instance_saves_dir(instance_id),
        get_instance_resourcepacks_dir(instance_id),
        get_instance_shaderpacks_dir(instance_id),
    ];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}

/// Hard-link a file from source to destination, falling back to copy if
/// hard linking fails (e.g., cross-filesystem).
pub fn hard_link_or_copy(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if dst.exists() {
        return Ok(());
    }
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    match std::fs::hard_link(src, dst) {
        Ok(()) => Ok(()),
        Err(_) => {
            // Hard link failed (cross-device?), fall back to copy
            std::fs::copy(src, dst)?;
            Ok(())
        }
    }
}
