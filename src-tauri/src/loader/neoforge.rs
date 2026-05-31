use serde::Deserialize;

use crate::error::LauncherError;
use crate::loader::LoaderInstallResult;
use crate::version::resolver::{LibraryArtifact, VersionDetails};

const NEOFORGE_MAVEN_URL: &str = "https://maven.neoforged.net/releases";

#[derive(Debug, Deserialize)]
struct MavenMetadata {
    versioning: MavenVersioning,
}

#[derive(Debug, Deserialize)]
struct MavenVersioning {
    versions: MavenVersions,
}

#[derive(Debug, Deserialize)]
struct MavenVersions {
    version: Vec<String>,
}

pub async fn fetch_versions() -> Result<Vec<String>, LauncherError> {
    let client = crate::http_client::build_client();
    let url = format!(
        "{}/net/neoforged/neoforge/maven-metadata.xml",
        NEOFORGE_MAVEN_URL
    );
    let text = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let metadata: MavenMetadata = quick_xml::de::from_str(&text)
        .map_err(|e| LauncherError::InvalidConfig(e.to_string()))?;

    let versions: Vec<String> = metadata.versioning.versions.version
        .into_iter()
        .filter(|v: &String| !v.contains("installer"))
        .rev()
        .take(50)
        .collect();

    Ok(versions)
}

pub async fn install(
    minecraft_version: &VersionDetails,
    loader_version: &str,
    _instance_id: &str,
) -> Result<LoaderInstallResult, LauncherError> {
    let client = crate::http_client::build_client();

    let neoforge_version = if loader_version.contains('-') {
        loader_version.to_string()
    } else {
        format!("{}-{}", minecraft_version.id, loader_version)
    };

    let profile_url = format!(
        "{}/net/neoforged/neoforge/{}/neoforge-{}-client.json",
        NEOFORGE_MAVEN_URL, neoforge_version, neoforge_version
    );

    let profile_result = client
        .get(&profile_url)
        .send()
        .await?;

    if !profile_result.status().is_success() {
        return Err(LauncherError::HttpError {
            status: profile_result.status().as_u16(),
            url: profile_url,
        });
    }

    let profile: serde_json::Value = profile_result.json().await?;

    let main_class = profile["mainClass"]
        .as_str()
        .unwrap_or("net.minecraftforge.bootstrap.ForgeBootstrap")
        .to_string();

    let mut extra_libraries = Vec::new();

    if let Some(libs) = profile["libraries"].as_array() {
        for lib in libs {
            let name = lib["name"].as_str().unwrap_or("");
            if name.is_empty() {
                continue;
            }

            if let Some(downloads) = lib["downloads"]["artifact"].as_object() {
                let path = downloads["path"].as_str().unwrap_or("").to_string();
                let url = downloads["url"].as_str().unwrap_or("").to_string();
                let sha1 = downloads["sha1"].as_str().unwrap_or("").to_string();
                let size = downloads["size"].as_u64().unwrap_or(0);

                if !path.is_empty() {
                    extra_libraries.push(LibraryArtifact {
                        path,
                        url,
                        sha1,
                        size,
                        is_native: false,
                    });
                    continue;
                }
            }

            let is_neoforge = name.starts_with("net.neoforged");
            let base_url = if is_neoforge {
                format!("{}/", NEOFORGE_MAVEN_URL)
            } else {
                "https://libraries.minecraft.net/".to_string()
            };

            if let Some(artifact) = parse_maven_lib(name, &base_url) {
                extra_libraries.push(artifact);
            }
        }
    }

    let mut extra_game_args = Vec::new();
    if let Some(game_args) = profile["arguments"]["game"].as_array() {
        for arg in game_args {
            if let Some(s) = arg.as_str() {
                extra_game_args.push(s.to_string());
            }
        }
    }
    if extra_game_args.is_empty() {
        extra_game_args.push("--launchTarget".to_string());
        extra_game_args.push("forgeclient".to_string());
    }

    let version_id = format!("neoforge-{}-{}", neoforge_version, minecraft_version.id);

    Ok(LoaderInstallResult {
        version_id,
        main_class,
        extra_libraries,
        extra_jvm_args: vec![],
        extra_game_args,
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
