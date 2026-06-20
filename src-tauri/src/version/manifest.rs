use serde::{Deserialize, Serialize};

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
    let url = crate::download::source::version_manifest_url();
    let client = crate::http_client::build_client();
    let manifest: VersionManifest = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(manifest)
}

/// Auto-select the fastest mirror by pinging all sources.
/// Returns the name of the fastest source.
pub async fn select_fastest_mirror() -> String {
    let candidates = vec![
        ("official", "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"),
        ("bmclapi", "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json"),
    ];
    let client = crate::http_client::build_client();
    let mut best = ("official".to_string(), u64::MAX);
    for (name, url) in &candidates {
        let start = std::time::Instant::now();
        if client.head(*url).send().await.is_ok() {
            let elapsed = start.elapsed().as_millis() as u64;
            tracing::info!("Mirror {}: {}ms", name, elapsed);
            if elapsed < best.1 { best = (name.to_string(), elapsed); }
        }
    }
    best.0
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, crate::error::LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}
