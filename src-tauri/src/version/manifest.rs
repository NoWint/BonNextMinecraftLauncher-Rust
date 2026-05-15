use serde::{Deserialize, Serialize};

pub const VERSION_MANIFEST_URL_PRIMARY: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

pub const VERSION_MANIFEST_URL_MIRROR: &str =
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
    if url.contains("piston-meta.mojang.com")
        || url.contains("launchermeta.mojang.com")
        || url.contains("launcher.mojang.com")
        || url.contains("piston-data.mojang.com")
    {
        url.replace("https://piston-meta.mojang.com/", "https://bmclapi2.bangbang93.com/")
            .replace("https://launchermeta.mojang.com/", "https://bmclapi2.bangbang93.com/")
            .replace("https://launcher.mojang.com/", "https://bmclapi2.bangbang93.com/")
            .replace("https://piston-data.mojang.com/", "https://bmclapi2.bangbang93.com/")
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

async fn fetch_manifest_from(url: &str) -> Result<VersionManifest, crate::error::LauncherError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;
    let resp = client.get(url).send().await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(crate::error::LauncherError::Http(
            reqwest::Error::from(resp.error_for_status_ref().unwrap_err()),
        ));
    }
    let body = resp.text().await?;
    if body.is_empty() {
        return Err(crate::error::LauncherError::Other(
            "Empty response from server".to_string(),
        ));
    }
    let manifest: VersionManifest = serde_json::from_str(&body)?;
    Ok(manifest)
}

pub async fn fetch_version_manifest() -> Result<VersionManifest, crate::error::LauncherError> {
    match fetch_manifest_from(VERSION_MANIFEST_URL_PRIMARY).await {
        Ok(manifest) => {
            tracing::info!("Fetched version manifest from Mojang (primary)");
            Ok(manifest)
        }
        Err(e) => {
            tracing::warn!("Mojang primary failed: {}, trying BMCLAPI mirror", e);
            match fetch_manifest_from(VERSION_MANIFEST_URL_MIRROR).await {
                Ok(manifest) => {
                    tracing::info!("Fetched version manifest from BMCLAPI mirror");
                    Ok(manifest)
                }
                Err(e2) => {
                    tracing::error!("Both sources failed. Mojang: {}, BMCLAPI: {}", e, e2);
                    Err(e)
                }
            }
        }
    }
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
