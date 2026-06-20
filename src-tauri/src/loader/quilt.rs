use serde::Deserialize;

use crate::error::LauncherError;
use crate::loader::LoaderInstallResult;
use crate::version::resolver::{LibraryArtifact, VersionDetails};

const QUILT_META_URL: &str = "https://meta.quiltmc.org/v3";

#[derive(Debug, Deserialize)]
struct QuiltLoaderVersion {
    version: String,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
#[allow(dead_code)]
struct QuiltLoaderInfo {
    loader: QuiltLoaderDetail,
    launcherMeta: QuiltLauncherMeta,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct QuiltLoaderDetail {
    version: String,
    maven: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct QuiltLauncherMeta {
    version: u32,
    #[serde(rename = "mainClass")]
    main_class: Option<serde_json::Value>,
    libraries: Option<serde_json::Value>,
}

pub async fn fetch_versions() -> Result<Vec<String>, LauncherError> {
    let client = crate::http_client::build_client();
    let versions: Vec<QuiltLoaderVersion> = client
        .get(format!("{}/versions/loader", QUILT_META_URL))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(versions.into_iter().map(|v| v.version).collect())
}

pub async fn install(
    minecraft_version: &VersionDetails,
    loader_version: &str,
    _instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    let client = crate::http_client::build_client();

    let profile_url = format!(
        "{}/versions/loader/{}/{}",
        QUILT_META_URL, minecraft_version.id, loader_version
    );
    let profile: serde_json::Value = client
        .get(&profile_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let main_class = profile["launcherMeta"]["mainClass"]["client"]
        .as_str()
        .unwrap_or("org.quiltmc.loader.impl.launch.knot.KnotClient")
        .to_string();

    let mut extra_libraries = Vec::new();
    if let Some(libs) = profile["launcherMeta"]["libraries"]["client"].as_array() {
        for lib in libs {
            let name = lib["name"].as_str().unwrap_or("");
            let url = lib["url"].as_str().unwrap_or("https://maven.quiltmc.net/repository/release/");
            if let Some(artifact) = parse_maven_lib(name, url) {
                extra_libraries.push(artifact);
            }
        }
    }

    if let Some(common_libs) = profile["launcherMeta"]["libraries"]["common"].as_array() {
        for lib in common_libs {
            let name = lib["name"].as_str().unwrap_or("");
            let url = lib["url"].as_str().unwrap_or("https://maven.quiltmc.net/repository/release/");
            if let Some(artifact) = parse_maven_lib(name, url) {
                if !extra_libraries.iter().any(|a: &LibraryArtifact| a.path == artifact.path) {
                    extra_libraries.push(artifact);
                }
            }
        }
    }

    let version_id = format!("quilt-loader-{}-{}", loader_version, minecraft_version.id);

    Ok(LoaderInstallResult {
        version_id,
        main_class,
        extra_libraries,
        extra_jvm_args: vec![],
        extra_game_args: vec![],
    })
}

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
        sha1: String::new(),
        size: 0,
        url,
        is_native: false,
    })
}
