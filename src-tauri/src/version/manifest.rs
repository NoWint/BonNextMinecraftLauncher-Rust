use serde::{Deserialize, Serialize};

pub const VERSION_MANIFEST_URL: &str =
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json";

pub const VERSION_MANIFEST_URL_FALLBACK: &str =
    "https://launchermeta.mojang.com/mc/game/version_manifest.json";

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
    if url.contains("launchermeta.mojang.com")
        || url.contains("launcher.mojang.com")
        || url.contains("piston-data.mojang.com")
    {
        url.replace("https://launchermeta.mojang.com/", "https://bmclapi2.bangbang93.com/")
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
    let manifest: VersionManifest = client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(manifest)
}

pub async fn fetch_version_manifest() -> Result<VersionManifest, crate::error::LauncherError> {
    match fetch_manifest_from(VERSION_MANIFEST_URL).await {
        Ok(manifest) => Ok(manifest),
        Err(e) => {
            tracing::warn!("BMCLAPI mirror failed: {}, trying Mojang fallback", e);
            fetch_manifest_from(VERSION_MANIFEST_URL_FALLBACK).await
        }
    }
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
