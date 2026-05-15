use serde::{Deserialize, Serialize};

pub const VERSION_MANIFEST_URL: &str =
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

pub async fn fetch_version_manifest() -> Result<VersionManifest, crate::error::LauncherError> {
    let client = reqwest::Client::new();
    let manifest: VersionManifest = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(manifest)
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
