use serde::Deserialize;

use crate::error::LauncherError;
use crate::loader::LoaderInstallResult;
use crate::version::resolver::{LibraryArtifact, VersionDetails};

const FABRIC_META_URL: &str = "https://meta.fabricmc.net/v2";

#[derive(Debug, Deserialize)]
struct FabricLoaderVersion {
    version: String,
    // stable: bool,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct FabricGameVersion {
    version: String,
    stable: bool,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
#[allow(dead_code)]
struct FabricLoaderInfo {
    loader: FabricLoaderDetail,
    #[allow(dead_code)]
    launcherMeta: FabricLauncherMeta,
}

#[derive(Debug, Deserialize)]
// Deserialization type for Fabric API responses
#[allow(dead_code)]
struct FabricLoaderDetail {
    version: String,
    maven: String,
}

#[derive(Debug, Deserialize)]
// Deserialization type for Fabric API responses
#[allow(dead_code)]
struct FabricLauncherMeta {
    version: u32,
    #[serde(rename = "mainClass")]
    main_class: Option<serde_json::Value>,
    libraries: Option<serde_json::Value>,
}

/// Fetch available Fabric loader versions.
pub async fn fetch_versions() -> Result<Vec<String>, LauncherError> {
    let client = crate::http_client::build_client();
    let versions: Vec<FabricLoaderVersion> = client
        .get(format!("{}/versions/loader", FABRIC_META_URL))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(versions.into_iter().map(|v| v.version).collect())
}

/// Install Fabric loader for a Minecraft version.
pub async fn install(
    minecraft_version: &VersionDetails,
    loader_version: &str,
    _instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    let client = crate::http_client::build_client();

    // Fetch the Fabric loader profile from meta.fabricmc.net
    let profile_url = format!(
        "{}/versions/loader/{}/{}",
        FABRIC_META_URL, minecraft_version.id, loader_version
    );
    let profile: serde_json::Value = client
        .get(&profile_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    // Extract main class
    let main_class = profile["launcherMeta"]["mainClass"]["client"]
        .as_str()
        .unwrap_or("net.fabricmc.loader.impl.launch.knot.KnotClient")
        .to_string();

    // Collect libraries from the Fabric profile
    let mut extra_libraries = Vec::new();
    if let Some(libs) = profile["launcherMeta"]["libraries"]["client"].as_array() {
        for lib in libs {
            let name = lib["name"].as_str().unwrap_or("");
            let url = lib["url"].as_str().unwrap_or("https://maven.fabricmc.net/");
            // Parse maven coordinate: group:artifact:version
            if let Some(artifact) = parse_maven_lib(name, url) {
                extra_libraries.push(artifact);
            }
        }
    }

    // Also fetch upstream libraries from common section
    if let Some(common_libs) = profile["launcherMeta"]["libraries"]["common"].as_array() {
        for lib in common_libs {
            let name = lib["name"].as_str().unwrap_or("");
            let url = lib["url"].as_str().unwrap_or("https://maven.fabricmc.net/");
            if let Some(artifact) = parse_maven_lib(name, url) {
                // Avoid duplicates
                if !extra_libraries.iter().any(|a: &LibraryArtifact| a.path == artifact.path) {
                    extra_libraries.push(artifact);
                }
            }
        }
    }

    let version_id = format!("fabric-loader-{}-{}", loader_version, minecraft_version.id);

    Ok(LoaderInstallResult {
        version_id,
        main_class,
        extra_libraries,
        extra_jvm_args: vec![
            "-DFabricMcEmu=net.minecraft.client.main.Main".to_string(),
        ],
        extra_game_args: vec![],
    })
}

/// Parse a Maven coordinate string into a LibraryArtifact.
/// E.g., "net.fabricmc:fabric-loader:0.15.11" ->
///   path: net/fabricmc/fabric-loader/0.15.11/fabric-loader-0.15.11.jar
///   url:  {base}/net/fabricmc/fabric-loader/0.15.11/fabric-loader-0.15.11.jar
fn parse_maven_lib(name: &str, base_url: &str) -> Option<LibraryArtifact> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() > 3 { parts[3] } else { "" };

    let base = base_url.trim_end_matches('/');
    let jar_name = if classifier.is_empty() {
        format!("{}-{}.jar", artifact, version)
    } else {
        format!("{}-{}-{}.jar", artifact, version, classifier)
    };

    let path = format!("{}/{}/{}/{}", group, artifact, version, jar_name);
    let url = format!("{}/{}", base, path);

    Some(LibraryArtifact {
        path,
        sha1: String::new(), // Fabric doesn't provide SHA1 in meta endpoint
        size: 0,
        url,
        is_native: false,
    })
}
