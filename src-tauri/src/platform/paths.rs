use directories::BaseDirs;
use std::path::PathBuf;

use crate::config;

pub fn get_default_game_dir() -> PathBuf {
    if let Some(base_dirs) = BaseDirs::new() {
        base_dirs.data_dir().join("bonnext")
    } else {
        PathBuf::from(".bonnext")
    }
}

pub fn get_game_dir() -> PathBuf {
    if let Ok(cfg) = config::load_config() {
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

pub fn get_versions_dir() -> PathBuf {
    get_game_dir().join("versions")
}

pub fn get_libraries_dir() -> PathBuf {
    get_game_dir().join("libraries")
}

pub fn get_assets_dir() -> PathBuf {
    get_game_dir().join("assets")
}

pub fn get_logs_dir() -> PathBuf {
    get_game_dir().join("logs")
}

pub fn get_config_path() -> PathBuf {
    get_default_game_dir().join("config.json")
}

pub fn ensure_dirs() -> std::io::Result<()> {
    let dirs = [
        get_game_dir(),
        get_versions_dir(),
        get_libraries_dir(),
        get_assets_dir(),
        get_logs_dir(),
    ];
    for dir in &dirs {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}
