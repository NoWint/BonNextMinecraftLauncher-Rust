use crate::error::LauncherError;
use crate::platform::paths;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    #[serde(default = "default_java_path")]
    pub java_path: String,
    #[serde(default = "default_max_memory")]
    pub max_memory_mb: u32,
    #[serde(default)]
    pub extra_jvm_args: Vec<String>,
    #[serde(default = "default_window_width")]
    pub window_width: u32,
    #[serde(default = "default_window_height")]
    pub window_height: u32,
    #[serde(default)]
    pub launch_behavior: LaunchBehavior,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LaunchBehavior {
    Keep,
    Close,
    Minimize,
}

impl Default for LaunchBehavior {
    fn default() -> Self {
        LaunchBehavior::Keep
    }
}

fn default_java_path() -> String {
    "java".to_string()
}

fn default_max_memory() -> u32 {
    4096
}

fn default_window_width() -> u32 {
    854
}

fn default_window_height() -> u32 {
    480
}

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            java_path: default_java_path(),
            max_memory_mb: default_max_memory(),
            extra_jvm_args: Vec::new(),
            window_width: default_window_width(),
            window_height: default_window_height(),
            launch_behavior: LaunchBehavior::default(),
        }
    }
}

pub fn load_config() -> Result<UserConfig, LauncherError> {
    let path = paths::get_config_path();
    if !path.exists() {
        let default_config = UserConfig::default();
        save_config(&default_config)?;
        return Ok(default_config);
    }
    let json = std::fs::read_to_string(&path)?;
    let config: UserConfig = serde_json::from_str(&json)?;
    Ok(config)
}

pub fn save_config(config: &UserConfig) -> Result<(), LauncherError> {
    let path = paths::get_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(&path, json)?;
    Ok(())
}
