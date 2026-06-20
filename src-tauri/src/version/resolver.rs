use crate::error::LauncherError;
use crate::platform::paths;
use crate::version::rules::{evaluate_rules, RuleContext};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VersionDetails {
    #[serde(default)]
    pub arguments: Arguments,
    #[serde(rename = "assetIndex", default)]
    pub asset_index: Option<AssetIndex>,
    pub assets: Option<String>,
    #[serde(default)]
    pub compliance_level: u32,
    pub downloads: Option<Downloads>,
    pub id: String,
    #[serde(rename = "javaVersion", default)]
    pub java_version: JavaVersion,
    pub libraries: Option<Vec<Library>>,
    #[serde(rename = "mainClass", default)]
    pub main_class: Option<String>,
    #[serde(rename = "minimumLauncherVersion")]
    pub minimum_launcher_version: u32,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub version_type: String,
    #[serde(rename = "inheritsFrom", default)]
    pub inherits_from: Option<String>,
    #[serde(rename = "minecraftArguments", default)]
    pub minecraft_arguments: Option<String>,
    #[serde(rename = "logging", default)]
    pub logging_client: Option<LoggingClient>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoggingClient {
    pub client: LoggingClientData,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoggingClientData {
    pub argument: String,
    #[serde(rename = "file")]
    pub file: LoggingFile,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoggingFile {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

impl VersionDetails {
    fn merge_with_parent(self, parent: &VersionDetails) -> Self {
        let mut merged = self;

        if merged.main_class.is_none() {
            merged.main_class = parent.main_class.clone();
        }
        if merged.minecraft_arguments.is_none() {
            merged.minecraft_arguments = parent.minecraft_arguments.clone();
        }
        if merged.downloads.is_none() {
            merged.downloads = parent.downloads.clone();
        }
        if merged.asset_index.is_none() {
            merged.asset_index = parent.asset_index.clone();
        }
        if merged.assets.is_none() {
            merged.assets = parent.assets.clone();
        }
        if merged.logging_client.is_none() {
            merged.logging_client = parent.logging_client.clone();
        }
        if merged.compliance_level == 0 {
            merged.compliance_level = parent.compliance_level;
        }
        if merged.java_version.major_version == 0 {
            merged.java_version = parent.java_version.clone();
        }

        let mut libraries = merged.libraries.unwrap_or_default();
        if let Some(ref parent_libs) = parent.libraries {
            for plib in parent_libs {
                let already_exists = libraries.iter().any(|l| l.name == plib.name);
                if !already_exists {
                    libraries.push(plib.clone());
                }
            }
        }
        merged.libraries = if libraries.is_empty() {
            None
        } else {
            Some(libraries)
        };

        if merged.arguments.jvm.is_empty() && !parent.arguments.jvm.is_empty() {
            merged.arguments.jvm = parent.arguments.jvm.clone();
        }
        if merged.arguments.game.is_empty() && !parent.arguments.game.is_empty() {
            merged.arguments.game = parent.arguments.game.clone();
        }

        merged
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[derive(Default)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}


#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Downloads {
    pub client: Download,
    #[serde(rename = "client_mappings", default)]
    pub client_mappings: Option<Download>,
    pub server: Option<Download>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Download {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

impl Default for JavaVersion {
    fn default() -> Self {
        JavaVersion { component: "jre-legacy".to_string(), major_version: 8 }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<crate::version::rules::Rule>,
    #[serde(default)]
    pub natives: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LibraryDownloads {
    pub artifact: Option<LibraryArtifact>,
    pub classifiers: Option<HashMap<String, LibraryArtifact>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LibraryArtifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
    /// Whether this artifact is a native library (needs extraction, not classpath)
    #[serde(default)]
    pub is_native: bool,
}

pub struct ResolvedVersion {
    pub id: String,
    pub version_type: String,
    pub main_class: String,
    pub client_jar: Download,
    pub asset_index: AssetIndex,
    pub libraries: Vec<LibraryArtifact>,
    pub native_libraries: Vec<LibraryArtifact>,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
    pub logging_config: Option<LoggingConfig>,
    pub java_version: JavaVersion,
}

#[derive(Debug, Clone)]
pub struct LoggingConfig {
    /// The logging argument template (e.g. "-Dlog4j.configurationFile=${path}")
    pub argument: String,
    /// Download info for the logging config file
    pub file: LoggingFile,
}

fn resolve_arg_templates(args: &[serde_json::Value], ctx: &RuleContext) -> Vec<String> {
    let mut resolved = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => {
                resolved.push(s.clone());
            }
            serde_json::Value::Object(obj) => {
                if let Some(rules_val) = obj.get("rules") {
                    let rules: Vec<crate::version::rules::Rule> =
                        serde_json::from_value(rules_val.clone()).unwrap_or_default();
                    if !evaluate_rules(&rules, ctx) {
                        continue;
                    }
                }
                if let Some(value_val) = obj.get("value") {
                    match value_val {
                        serde_json::Value::String(s) => resolved.push(s.clone()),
                        serde_json::Value::Array(arr) => {
                            for v in arr {
                                if let Some(s) = v.as_str() {
                                    resolved.push(s.to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    resolved
}

impl ResolvedVersion {
    pub fn from_details(version: &VersionDetails) -> Self {
        let ctx = RuleContext::current();

        let mut libraries: Vec<LibraryArtifact> = Vec::new();
        let mut native_libraries: Vec<LibraryArtifact> = Vec::new();

        if let Some(libs) = &version.libraries {
            for lib in libs.iter() {
                if !evaluate_rules(&lib.rules, &ctx) {
                    continue;
                }
                if let Some(downloads) = &lib.downloads {
                    let has_natives = !lib.natives.is_empty();
                    if has_natives {
                        if let Some(classifiers) = &downloads.classifiers {
                            let native_classifier = match () {
                                _ if cfg!(target_os = "windows") =>
                                    lib.natives.get("windows")
                                        .or_else(|| lib.natives.get("natives-windows"))
                                        .or_else(|| {
                                            if cfg!(target_arch = "aarch64") { lib.natives.get("natives-windows-arm64") } else { None }
                                        })
                                        .cloned()
                                        .unwrap_or_else(|| "natives-windows".to_string()),
                                _ if cfg!(target_os = "macos") =>
                                    lib.natives.get("osx")
                                        .or_else(|| lib.natives.get("macos"))
                                        .or_else(|| {
                                            if cfg!(target_arch = "aarch64") { lib.natives.get("natives-macos-arm64") } else { None }
                                        })
                                        .cloned()
                                        .unwrap_or_else(|| "natives-macos".to_string()),
                                _ =>
                                    lib.natives.get("linux")
                                        .or_else(|| lib.natives.get("natives-linux"))
                                        .or_else(|| {
                                            if cfg!(target_arch = "aarch64") { lib.natives.get("natives-linux-arm64") } else { None }
                                        })
                                        .or_else(|| {
                                            if cfg!(target_arch = "arm") { lib.natives.get("natives-linux-arm32") } else { None }
                                        })
                                        .cloned()
                                        .unwrap_or_else(|| "natives-linux".to_string()),
                            };
                            if let Some(artifact) = classifiers.get(&native_classifier) {
                                let mut na = artifact.clone();
                                na.is_native = true;
                                native_libraries.push(na);
                            }
                        }
                        // Also add main artifact if present (some native libs need it on classpath)
                        if let Some(artifact) = &downloads.artifact {
                            let mut a = artifact.clone();
                            a.is_native = false;
                            libraries.push(a);
                        }
                    } else {
                        if let Some(artifact) = &downloads.artifact {
                            let mut a = artifact.clone();
                            a.is_native = false;
                            libraries.push(a);
                        }
                    }
                }
            }
        }

        let logging_config = version.logging_client.as_ref().map(|lc| {
            LoggingConfig {
                argument: lc.client.argument.clone(),
                file: lc.client.file.clone(),
            }
        });

        let jvm_args = resolve_arg_templates(&version.arguments.jvm, &ctx);
        let game_args = if !version.arguments.game.is_empty() {
            resolve_arg_templates(&version.arguments.game, &ctx)
        } else if let Some(ref args_str) = version.minecraft_arguments {
            args_str.split_whitespace().map(String::from).collect()
        } else {
            Vec::new()
        };

        let client_jar = version
            .downloads
            .as_ref()
            .map(|d| d.client.clone())
            .unwrap_or_else(|| Download {
                sha1: String::new(),
                size: 0,
                url: String::new(),
            });

        let asset_index = version
            .asset_index
            .clone()
            .unwrap_or_else(|| AssetIndex {
                id: String::new(),
                sha1: String::new(),
                size: 0,
                total_size: 0,
                url: String::new(),
            });

        ResolvedVersion {
            id: version.id.clone(),
            version_type: version.version_type.clone(),
            main_class: version.main_class.clone().unwrap_or_else(|| "net.minecraft.client.main.Main".to_string()),
            client_jar,
            asset_index,
            libraries,
            native_libraries,
            jvm_args,
            game_args,
            logging_config,
            java_version: version.java_version.clone(),
        }
    }
}

pub fn local_version_json_path(version_id: &str) -> std::path::PathBuf {
    paths::get_versions_dir().join(version_id).join(format!("{}.json", version_id))
}

pub fn load_local_version(version_id: &str) -> Option<VersionDetails> {
    let path = local_version_json_path(version_id);
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn save_local_version(version_id: &str, details: &VersionDetails) -> Result<(), LauncherError> {
    let path = local_version_json_path(version_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(details)?;
    std::fs::write(&path, content)?;
    Ok(())
}

pub async fn fetch_version_details(version_url: &str) -> Result<VersionDetails, LauncherError> {
    tracing::info!("Fetching version details from: {}", version_url);
    let client = crate::http_client::build_client();
    let resp = client
        .get(version_url)
        .send()
        .await?;
    let status = resp.status();
    if !status.is_success() {
        tracing::error!("Version details HTTP {} for: {}", status, version_url);
        return Err(LauncherError::Other(
            format!("HTTP {} for version details: {}", status, version_url)
        ));
    }
    let details: VersionDetails = resp.json().await.map_err(|e| {
        tracing::error!("Version details deserialize error for {}: {}", version_url, e);
        LauncherError::Other(format!("parsing version details from {}: {}", version_url, e))
    })?;
    tracing::info!("Version details OK: id={}, type={}", details.id, details.version_type);
    Ok(details)
}

pub async fn resolve_version_with_parents(
    version_id: &str,
    version_url: &str,
) -> Result<VersionDetails, LauncherError> {
    let mut details = get_version_details(version_id, version_url).await?;

    let mut visited = std::collections::HashSet::new();
    visited.insert(details.id.clone());

    while let Some(ref parent_id) = details.inherits_from.clone() {
        if visited.contains(parent_id) {
            tracing::warn!("Circular inheritance detected at {}", parent_id);
            break;
        }
        visited.insert(parent_id.clone());

        let parent = if let Some(cached) = load_local_version(parent_id) {
            cached
        } else {
            let manifest = super::manifest::fetch_versions_sorted().await
                .map_err(|e| LauncherError::Other(format!("Failed to fetch version manifest for parent {}: {}", parent_id, e)))?;
            let parent_entry = manifest
                .iter()
                .find(|v| v.id == *parent_id)
                .ok_or_else(|| LauncherError::VersionNotFound(format!("Parent version {} not found in manifest", parent_id)))?;

            let parent_details = fetch_version_details(&parent_entry.url).await?;
            save_local_version(parent_id, &parent_details)?;
            parent_details
        };

        details = details.merge_with_parent(&parent);
    }

    Ok(details)
}

pub async fn get_version_details(
    version_id: &str,
    version_url: &str,
) -> Result<VersionDetails, LauncherError> {
    if let Some(details) = load_local_version(version_id) {
        tracing::info!("Using cached version JSON for {}", version_id);
        return Ok(details);
    }
    tracing::info!("Fetching version JSON for {} from remote", version_id);
    let details = fetch_version_details(version_url).await?;
    save_local_version(version_id, &details)?;
    Ok(details)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_version() {
        let json = r#"{
            "id": "1.21", "type": "release",
            "time": "2024-06-13T12:00:00+00:00",
            "releaseTime": "2024-06-13T12:00:00+00:00",
            "minimumLauncherVersion": 21
        }"#;
        let v: VersionDetails = serde_json::from_str(json).unwrap();
        assert_eq!(v.id, "1.21");
    }

    #[test]
    fn parse_version_with_logging() {
        let json = r#"{
            "id": "1.20", "type": "release",
            "time": "2023-06-12T12:00:00+00:00",
            "releaseTime": "2023-06-12T12:00:00+00:00",
            "minimumLauncherVersion": 21,
            "logging": {
                "client": {
                    "argument": "-Dlog4j.configurationFile=${path}",
                    "file": { "id": "x", "sha1": "abc", "size": 1, "url": "http://x" }
                }
            }
        }"#;
        let v: VersionDetails = serde_json::from_str(json).unwrap();
        assert!(v.logging_client.is_some());
    }

    #[test]
    fn parse_real_mojang_version() {
        // Skip in CI — curl may not be available. Download the file first:
        // curl -s 'https://piston-meta.mojang.com/v1/packages/ab0bcda5c7dc67dc153dad3a95270bfccb73fd6e/26.1.2.json' -o /tmp/test_ver.json
        let json = match std::fs::read_to_string("/tmp/test_ver.json") {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: /tmp/test_ver.json not found. Download it first.");
                return;
            }
        };
        let v: VersionDetails = serde_json::from_str(&json)
            .expect("FAILED to parse real Mojang version JSON");
        assert_eq!(v.id, "26.1.2");
        assert!(v.libraries.is_some());
        assert!(v.downloads.is_some());
    }
}
