use serde::Deserialize;
use std::collections::HashMap;

use super::manifest::mirror_url;

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct VersionDetails {
    #[serde(default)]
    pub arguments: Arguments,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
    #[serde(default = "default_assets")]
    pub assets: String,
    pub downloads: Downloads,
    pub id: String,
    #[serde(rename = "javaVersion", default)]
    pub java_version: JavaVersion,
    #[serde(default)]
    pub libraries: Vec<Library>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minimumLauncherVersion", default)]
    pub minimum_launcher_version: u32,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub time: String,
    #[serde(rename = "type")]
    pub version_type: String,
    #[serde(rename = "minecraftArguments", default)]
    pub minecraft_arguments: String,
}

fn default_assets() -> String {
    "legacy".to_string()
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize", default)]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
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
#[allow(dead_code)]
pub struct JavaVersion {
    #[serde(default = "default_java_component")]
    pub component: String,
    #[serde(rename = "majorVersion", default = "default_java_major")]
    pub major_version: u32,
}

fn default_java_component() -> String {
    "jre-legacy".to_string()
}

fn default_java_major() -> u32 {
    8
}

impl Default for JavaVersion {
    fn default() -> Self {
        JavaVersion {
            component: default_java_component(),
            major_version: default_java_major(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct Library {
    pub name: String,
    #[serde(default)]
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    #[serde(default)]
    pub natives: HashMap<String, String>,
    #[serde(default)]
    pub extract: Option<ExtractRule>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExtractRule {
    #[serde(default)]
    pub exclude: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    #[serde(default)]
    pub artifact: Option<LibraryArtifact>,
    #[serde(default)]
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
    #[serde(default)]
    pub features: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub arch: String,
}

pub struct ResolvedVersion {
    pub id: String,
    pub main_class: String,
    pub client_jar: Download,
    pub asset_index: AssetIndex,
    pub libraries: Vec<ResolvedLibrary>,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
}

pub struct ResolvedLibrary {
    pub artifact: LibraryArtifact,
    pub is_native: bool,
    pub extract_exclude: Vec<String>,
}

fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

#[allow(dead_code)]
fn os_arch() -> &'static str {
    if cfg!(target_arch = "x86") {
        "x86"
    } else {
        "x64"
    }
}

fn rule_allows(rules: &[Rule]) -> bool {
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in rules {
        let os_match = match &rule.os {
            Some(os) => {
                let name_match = os.name.is_empty() || os.name == os_name();
                let arch_match = os.arch.is_empty() || {
                    if os.arch == "x86" {
                        cfg!(target_arch = "x86")
                    } else {
                        !cfg!(target_arch = "x86")
                    }
                };
                name_match && arch_match
            }
            None => true,
        };

        let features_match = match &rule.features {
            Some(f) => {
                if f.get("is_demo_user").is_some() || f.get("has_custom_resolution").is_some() {
                    false
                } else {
                    true
                }
            }
            None => true,
        };

        let matches = os_match && features_match;

        if rule.action == "allow" && matches {
            allowed = true;
        } else if rule.action == "disallow" && matches {
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
                } else if let Some(value_val) = obj.get("values") {
                    if let serde_json::Value::Array(arr) = value_val {
                        for v in arr {
                            if let Some(s) = v.as_str() {
                                resolved.push(s.to_string());
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
    resolved
}

fn get_native_key() -> &'static str {
    if cfg!(target_os = "windows") {
        if cfg!(target_arch = "x86") {
            "natives-windows-x86"
        } else {
            "natives-windows"
        }
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "natives-macos-arm64"
        } else {
            "natives-macos"
        }
    } else {
        "natives-linux"
    }
}

impl ResolvedVersion {
    pub fn from_details(version: &VersionDetails) -> Self {
        let native_key = get_native_key();
        let mut libraries: Vec<ResolvedLibrary> = Vec::new();

        for lib in &version.libraries {
            if !rule_allows(&lib.rules) {
                continue;
            }

            let extract_exclude = lib
                .extract
                .as_ref()
                .map(|e| e.exclude.clone())
                .unwrap_or_default();

            if let Some(downloads) = &lib.downloads {
                if let Some(classifiers) = &downloads.classifiers {
                    let resolved_key = classifiers
                        .keys()
                        .find(|k| k.starts_with(native_key))
                        .or_else(|| {
                            let base_key = if cfg!(target_os = "windows") {
                                "natives-windows"
                            } else if cfg!(target_os = "macos") {
                                "natives-osx"
                            } else {
                                "natives-linux"
                            };
                            classifiers.keys().find(|k| k.starts_with(base_key))
                        });

                    if let Some(key) = resolved_key {
                        if let Some(artifact) = classifiers.get(key) {
                            let mut mirrored = artifact.clone();
                            mirrored.url = mirror_url(&mirrored.url);
                            libraries.push(ResolvedLibrary {
                                artifact: mirrored,
                                is_native: true,
                                extract_exclude: extract_exclude.clone(),
                            });
                        }
                    }
                }

                if let Some(artifact) = &downloads.artifact {
                    let mut mirrored = artifact.clone();
                    mirrored.url = mirror_url(&mirrored.url);
                    libraries.push(ResolvedLibrary {
                        artifact: mirrored,
                        is_native: false,
                        extract_exclude: Vec::new(),
                    });
                }
            }
        }

        let jvm_args = if !version.arguments.jvm.is_empty() {
            resolve_arg_templates(&version.arguments.jvm, version)
        } else {
            default_jvm_args()
        };

        let game_args = if !version.arguments.game.is_empty() {
            resolve_arg_templates(&version.arguments.game, version)
        } else if !version.minecraft_arguments.is_empty() {
            version
                .minecraft_arguments
                .split_whitespace()
                .map(String::from)
                .collect()
        } else {
            Vec::new()
        };

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

fn default_jvm_args() -> Vec<String> {
    let mut args = vec![
        "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump".to_string(),
    ];

    if cfg!(target_os = "macos") {
        args.push("-XstartOnFirstThread".to_string());
    }

    args.push("-Djava.library.path=${natives_directory}".to_string());
    args.push("-Dminecraft.launcher.brand=bonnext".to_string());
    args.push("-Dminecraft.launcher.version=0.1.0".to_string());
    args.push("-cp".to_string());
    args.push("${classpath}".to_string());

    args
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
