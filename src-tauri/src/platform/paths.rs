use crate::error::LauncherError;
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
    // 使用缓存版本避免每次调用都重新读取+解析 config.json。
    // 启动期间此函数会被调用 9+ 次，缓存可消除重复 IO。
    if let Ok(cfg) = crate::config::load_config_cached() {
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
// Reserved for per-instance native library isolation
#[allow(dead_code)]
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

/// Instance schematics directory (Litematica, WorldEdit, etc.).
pub fn get_instance_schematics_dir(instance_id: &str) -> PathBuf {
    get_instance_minecraft_dir(instance_id).join("schematics")
}

// ---------------------------------------------------------------
// Config
// ---------------------------------------------------------------

pub fn get_config_dir() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        #[cfg(target_os = "linux")]
        { base_dirs.config_dir().join("bonnext") }
        #[cfg(not(target_os = "linux"))]
        { base_dirs.data_dir().join("bonnext") }
    } else {
        PathBuf::from(".bonnext")
    }
}

pub fn get_config_path() -> PathBuf {
    get_config_dir().join("config.json")
}

#[allow(dead_code)]
pub fn get_security_dir() -> PathBuf {
    get_config_dir().join("security")
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
// Reserved for instance library sharing
#[allow(dead_code)]
pub fn hard_link_or_copy(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if dst.exists() {
        return Ok(());
    }
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    match std::fs::hard_link(src, dst) {
        Ok(()) => {
            tracing::debug!("Hard linked {} -> {}", src.display(), dst.display());
            Ok(())
        }
        Err(e) => {
            tracing::debug!(
                "Hard link failed ({}), falling back to copy: {} -> {}",
                e, src.display(), dst.display()
            );
            std::fs::copy(src, dst)?;
            Ok(())
        }
    }
}

pub fn path_to_string(path: &std::path::Path) -> Result<String, LauncherError> {
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::InvalidConfig(format!(
            "Path contains non-UTF-8 characters and cannot be used: {}",
            path.display()
        )))
}

pub fn classpath_separator() -> &'static str {
    if cfg!(target_os = "windows") { ";" } else { ":" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classpath_separator() {
        let sep = classpath_separator();
        if cfg!(target_os = "windows") {
            assert_eq!(sep, ";");
        } else {
            assert_eq!(sep, ":");
        }
    }

    #[test]
    fn test_path_to_string_valid() {
        let path = std::path::Path::new("/usr/lib/jvm/java-21");
        assert_eq!(path_to_string(path).unwrap(), "/usr/lib/jvm/java-21");
    }

    #[test]
    fn test_path_to_string_empty() {
        let path = std::path::Path::new("");
        assert_eq!(path_to_string(path).unwrap(), "");
    }

    #[test]
    fn test_get_config_dir_is_absolute() {
        let config_dir = get_config_dir();
        assert!(config_dir.is_absolute() || config_dir == PathBuf::from(".bonnext"));
    }

    #[test]
    fn test_get_default_game_dir_is_absolute() {
        let game_dir = get_default_game_dir();
        assert!(game_dir.is_absolute() || game_dir == PathBuf::from(".bonnext"));
    }

    #[test]
    fn test_hard_link_or_copy_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("source.txt");
        let dst = dir.path().join("dest.txt");
        std::fs::write(&src, b"hello").unwrap();
        hard_link_or_copy(&src, &dst).unwrap();
        assert!(dst.exists());
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), "hello");
    }

    #[test]
    fn test_hard_link_or_copy_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("source.txt");
        let dst = dir.path().join("dest.txt");
        std::fs::write(&src, b"hello").unwrap();
        hard_link_or_copy(&src, &dst).unwrap();
        hard_link_or_copy(&src, &dst).unwrap();
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), "hello");
    }
}
