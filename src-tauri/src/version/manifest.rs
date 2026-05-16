use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

const MOJANG_VERSION_MANIFEST: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const BMCLAPI_VERSION_MANIFEST: &str =
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

pub fn mirror_url(url: &str) -> String {
    if url.contains("piston-data.mojang.com") || url.contains("piston-meta.mojang.com") {
        url.replace("https://piston-data.mojang.com/", "https://bmclapi2.bangbang93.com/")
            .replace("https://piston-meta.mojang.com/", "https://bmclapi2.bangbang93.com/")
    } else if url.contains("launchermeta.mojang.com") || url.contains("launcher.mojang.com") {
        url.replace("https://launchermeta.mojang.com/", "https://bmclapi2.bangbang93.com/")
            .replace("https://launcher.mojang.com/", "https://bmclapi2.bangbang93.com/")
    } else if url.contains("libraries.minecraft.net") {
        url.replace(
            "https://libraries.minecraft.net/",
            "https://bmclapi2.bangbang93.com/maven/",
        )
    } else if url.contains("resources.download.minecraft.net") {
        url.replace(
            "https://resources.download.minecraft.net/",
            "https://bmclapi2.bangbang93.com/assets/",
        )
    } else {
        url.to_string()
    }
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(15))
            .user_agent("BonNext/0.1.0")
            .https_only(true)
            .build()
            .expect("Failed to initialize HTTP client")
    })
}

async fn try_fetch_manifest(url: &str) -> Result<VersionManifest, crate::error::LauncherError> {
    tracing::info!("Trying: {}", url);
    let client = http_client();
    let resp = client.get(url).send().await.map_err(|e| {
        tracing::warn!("Request to {} failed: {}", url, e);
        e
    })?;

    let status = resp.status();
    if !status.is_success() {
        let err_msg = format!("HTTP {} from {}", status, url);
        tracing::warn!("{}", err_msg);
        return Err(crate::error::LauncherError::Other(err_msg));
    }

    let manifest: VersionManifest = resp.json().await.map_err(|e| {
        tracing::warn!("JSON parse from {} failed: {}", url, e);
        e
    })?;

    tracing::info!("OK: {} versions from {}", manifest.versions.len(), url);
    Ok(manifest)
}

fn get_cache_path() -> std::path::PathBuf {
    crate::platform::paths::get_game_dir().join("cache").join("version_manifest.json")
}

fn load_cached_manifest() -> Option<VersionManifest> {
    let path = get_cache_path();
    if !path.exists() {
        return None;
    }
    let json = std::fs::read_to_string(&path).ok()?;
    let manifest: VersionManifest = serde_json::from_str(&json).ok()?;
    tracing::info!("Loaded cached manifest ({} versions)", manifest.versions.len());
    Some(manifest)
}

fn save_cached_manifest(manifest: &VersionManifest) {
    let cache_dir = crate::platform::paths::get_game_dir().join("cache");
    if std::fs::create_dir_all(&cache_dir).is_err() {
        return;
    }
    let cache_path = cache_dir.join("version_manifest.json");
    if let Ok(json) = serde_json::to_string(manifest) {
        let _ = std::fs::write(&cache_path, json);
        tracing::debug!("Saved manifest cache");
    }
}

pub async fn fetch_version_manifest() -> Result<VersionManifest, crate::error::LauncherError> {
    let mut last_error = None;

    let sources = [BMCLAPI_VERSION_MANIFEST, MOJANG_VERSION_MANIFEST];

    for url in &sources {
        match try_fetch_manifest(url).await {
            Ok(manifest) => {
                save_cached_manifest(&manifest);
                return Ok(manifest);
            }
            Err(e) => {
                last_error = Some(e);
                continue;
            }
        }
    }

    if let Some(manifest) = load_cached_manifest() {
        tracing::warn!("All sources failed, using cached manifest");
        return Ok(manifest);
    }

    Err(last_error.unwrap_or_else(|| {
        crate::error::LauncherError::Other("无法获取版本列表，请检查网络连接".to_string())
    }))
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
