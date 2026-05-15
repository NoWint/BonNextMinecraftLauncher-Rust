use serde::Deserialize;
use std::collections::HashMap;

use super::manifest::mirror_url;

#[derive(Debug, Clone, Deserialize)]
pub struct VersionDetails {
    #[serde(default)]
    pub arguments: Arguments,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    pub assets: String,
    pub downloads: Downloads,
    pub id: String,
    #[serde(rename = "javaVersion", default)]
    pub java_version: JavaVersion,
    pub libraries: Vec<Library>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minimumLauncherVersion")]
    pub minimum_launcher_version: u32,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub version_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Arguments {
    pub game: Vec<serde_json::Value>,
    pub jvm: Vec<serde_json::Value>,
}

impl Default for Arguments {
    fn default() -> Self {
        Arguments {
            game: vec![],
            jvm: vec![],
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Downloads {
    pub client: Download,
    pub server: Option<Download>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Download {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JavaVersion {
    pub component: String,
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

impl Default for JavaVersion {
    fn default() -> Self {
        JavaVersion {
            component: "jre-legacy".to_string(),
            major_version: 8,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub natives: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<LibraryArtifact>,
    pub classifiers: Option<HashMap<String, LibraryArtifact>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryArtifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: String,
}

pub struct ResolvedVersion {
    pub id: String,
    pub main_class: String,
    pub client_jar: Download,
    pub asset_index: AssetIndex,
    pub libraries: Vec<LibraryArtifact>,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
}

fn rule_allows(rules: &[Rule]) -> bool {
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in rules {
        let os_match = match &rule.os {
            Some(os) => {
                if cfg!(target_os = "windows") {
                    os.name == "windows"
                } else if cfg!(target_os = "macos") {
                    os.name == "osx" || os.name == "macos"
                } else {
                    os.name == "linux"
                }
            }
            None => true,
        };
        if rule.action == "allow" && os_match {
            allowed = true;
        } else if rule.action == "disallow" && os_match {
            allowed = false;
        }
    }
    allowed
}

fn resolve_arg_templates(
    args: &[serde_json::Value],
    _version: &VersionDetails,
) -> Vec<String> {
    let mut resolved = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => {
                resolved.push(s.clone());
            }
            serde_json::Value::Object(obj) => {
                if let Some(rules_val) = obj.get("rules") {
                    let rules: Vec<Rule> =
                        serde_json::from_value(rules_val.clone()).unwrap_or_default();
                    if !rule_allows(&rules) {
                        continue;
                    }
                }
                if let Some(value_val) = obj.get("value") {
                    match value_val {
                        serde_json::Value::String(s) => {
                            resolved.push(s.clone());
                        }
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
        let libraries: Vec<LibraryArtifact> = version
            .libraries
            .iter()
            .filter(|lib| rule_allows(&lib.rules))
            .filter_map(|lib| {
                if let Some(downloads) = &lib.downloads {
                    if let Some(classifiers) = &downloads.classifiers {
                        let native_key = if cfg!(target_os = "windows") {
                            "natives-windows"
                        } else if cfg!(target_os = "macos") {
                            "natives-osx"
                        } else {
                            "natives-linux"
                        };
                        if let Some(artifact) = classifiers.get(native_key) {
                            let mut mirrored = artifact.clone();
                            mirrored.url = mirror_url(&mirrored.url);
                            return Some(mirrored);
                        }
                    }
                    if let Some(artifact) = &downloads.artifact {
                        let mut mirrored = artifact.clone();
                        mirrored.url = mirror_url(&mirrored.url);
                        return Some(mirrored);
                    }
                }
                None
            })
            .collect();

        let jvm_args = resolve_arg_templates(&version.arguments.jvm, version);
        let game_args = resolve_arg_templates(&version.arguments.game, version);

        let mut client_jar = version.downloads.client.clone();
        client_jar.url = mirror_url(&client_jar.url);

        ResolvedVersion {
            id: version.id.clone(),
            main_class: version.main_class.clone(),
            client_jar,
            asset_index: version.asset_index.clone(),
            libraries,
            jvm_args,
            game_args,
        }
    }
}

pub async fn fetch_version_details(
    version_url: &str,
) -> Result<VersionDetails, crate::error::LauncherError> {
    let mirrored_url = mirror_url(version_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let details: VersionDetails = client
        .get(&mirrored_url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(details)
}
