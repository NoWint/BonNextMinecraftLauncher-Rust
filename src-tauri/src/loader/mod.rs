use serde::{Deserialize, Serialize};

use crate::error::LauncherError;
use crate::version::resolver::VersionDetails;

pub mod fabric;
pub mod forge;

/// Supported mod loader types.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoaderType {
    Fabric,
    Forge,
}

impl LoaderType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "fabric" => Some(LoaderType::Fabric),
            "forge" => Some(LoaderType::Forge),
            _ => None,
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            LoaderType::Fabric => "fabric",
            LoaderType::Forge => "forge",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            LoaderType::Fabric => "Fabric",
            LoaderType::Forge => "Forge",
        }
    }
}

/// Result of installing a mod loader onto a Minecraft version.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderInstallResult {
    /// The loader-modified version ID (e.g., "fabric-loader-0.15.11-1.21")
    pub version_id: String,
    /// The new main class to use
    pub main_class: String,
    /// Additional libraries to download
    pub extra_libraries: Vec<crate::version::resolver::LibraryArtifact>,
    /// Additional JVM arguments
    pub extra_jvm_args: Vec<String>,
    /// Additional game arguments
    pub extra_game_args: Vec<String>,
}

/// Fetch available loader versions for a given loader type.
pub async fn fetch_loader_versions(
    loader_type: &LoaderType,
) -> Result<Vec<String>, LauncherError> {
    match loader_type {
        LoaderType::Fabric => fabric::fetch_versions().await,
        LoaderType::Forge => forge::fetch_versions().await,
    }
}

/// Install a mod loader for a specific Minecraft version.
pub async fn install_loader(
    loader_type: &LoaderType,
    minecraft_version: &VersionDetails,
    loader_version: &str,
    instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    match loader_type {
        LoaderType::Fabric => fabric::install(minecraft_version, loader_version, instance_id).await,
        LoaderType::Forge => forge::install(minecraft_version, loader_version, instance_id).await,
    }
}
