pub mod models;

use crate::error::LauncherError;
use models::*;

const VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const VERSION_MANIFEST_MIRROR: &str =
    "https://bmclapi2.bangbang93.com/mc/game/version_v2.json";

pub async fn fetch_version_manifest() -> Result<VersionManifest, LauncherError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    match fetch_manifest_from(&client, VERSION_MANIFEST_URL).await {
        Ok(m) => {
            tracing::info!("Fetched version manifest from Mojang");
            Ok(m)
        }
        Err(e) => {
            tracing::warn!("Mojang failed: {}, trying BMCLAPI mirror", e);
            match fetch_manifest_from(&client, VERSION_MANIFEST_MIRROR).await {
                Ok(m) => {
                    tracing::info!("Fetched version manifest from BMCLAPI");
                    Ok(m)
                }
                Err(e2) => {
                    tracing::error!("Both sources failed. Mojang: {}, BMCLAPI: {}", e, e2);
                    Err(e)
                }
            }
        }
    }
}

async fn fetch_manifest_from(
    client: &reqwest::Client,
    url: &str,
) -> Result<VersionManifest, LauncherError> {
    let resp = client.get(url).send().await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(LauncherError::Other(format!("HTTP {} from {}", status, url)));
    }
    let body = resp.text().await?;
    if body.is_empty() {
        return Err(LauncherError::Other("Empty response".to_string()));
    }
    let manifest: VersionManifest = serde_json::from_str(&body)?;
    Ok(manifest)
}

pub async fn fetch_versions_sorted() -> Result<Vec<VersionEntry>, LauncherError> {
    let manifest = fetch_version_manifest().await?;
    let mut versions = manifest.versions;
    versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
    Ok(versions)
}

pub async fn fetch_version_json(version_url: &str) -> Result<VersionJson, LauncherError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let mirrored_url = mirror_url(version_url);
    tracing::info!("Fetching version JSON from: {}", mirrored_url);

    match fetch_json_from(&client, &mirrored_url).await {
        Ok(v) => Ok(v),
        Err(e) => {
            tracing::warn!("Mirror failed: {}, trying original URL", e);
            fetch_json_from(&client, version_url).await
        }
    }
}

async fn fetch_json_from(
    client: &reqwest::Client,
    url: &str,
) -> Result<VersionJson, LauncherError> {
    let resp = client.get(url).send().await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(LauncherError::Other(format!("HTTP {} from {}", status, url)));
    }
    let body = resp.text().await?;
    if body.is_empty() {
        return Err(LauncherError::Other("Empty response".to_string()));
    }
    let version: VersionJson = serde_json::from_str(&body)?;
    Ok(version)
}

pub async fn resolve_version_chain(
    version_id: &str,
    game_dir: &std::path::Path,
) -> Result<VersionJson, LauncherError> {
    let versions_dir = game_dir.join("versions");
    std::fs::create_dir_all(&versions_dir)?;

    let mut chain: Vec<VersionJson> = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    let mut current_id = version_id.to_string();

    loop {
        if seen.contains(&current_id) {
            return Err(LauncherError::Other("Version inheritance cycle detected".to_string()));
        }
        seen.push(current_id.clone());

        let version_json_path = versions_dir.join(&current_id).join(format!("{}.json", current_id));
        let version = if version_json_path.exists() {
            let json = std::fs::read_to_string(&version_json_path)?;
            serde_json::from_str::<VersionJson>(&json)?
        } else {
            let manifest = fetch_version_manifest().await?;
            let entry = manifest.versions.iter().find(|v| v.id == current_id)
                .ok_or_else(|| LauncherError::Other(format!("Version {} not found", current_id)))?;
            let v = fetch_version_json(&entry.url).await?;
            let dir = versions_dir.join(&current_id);
            std::fs::create_dir_all(&dir)?;
            std::fs::write(&version_json_path, serde_json::to_string_pretty(&v)?)?;
            v
        };

        match version.inherits_from.clone() {
            Some(parent) => {
                chain.push(version);
                current_id = parent;
            }
            None => {
                chain.push(version);
                break;
            }
        }
    }

    let mut merged = chain.last().cloned().ok_or_else(|| LauncherError::Other("Empty version chain".to_string()))?;
    for child in chain.iter().rev().skip(1) {
        merged = merge_versions(merged, child.clone());
    }

    Ok(merged)
}

fn merge_versions(base: VersionJson, child: VersionJson) -> VersionJson {
    let mut merged = base;

    if !child.main_class.is_empty() {
        merged.main_class = child.main_class;
    }
    if !child.minecraft_arguments.is_empty() {
        merged.minecraft_arguments = child.minecraft_arguments;
    }

    merged.arguments.game.extend(child.arguments.game.clone());
    merged.arguments.jvm.extend(child.arguments.jvm.clone());

    let base_lib_names: Vec<String> = merged.libraries.iter().map(|l| lib_key(&l.name)).collect();
    for lib in child.libraries {
        let key = lib_key(&lib.name);
        if let Some(pos) = base_lib_names.iter().position(|k| k == &key) {
            merged.libraries[pos] = lib;
        } else {
            merged.libraries.push(lib);
        }
    }

    if child.asset_index.is_some() {
        merged.asset_index = child.asset_index;
    }
    if !child.assets.is_empty() {
        merged.assets = child.assets;
    }
    if child.downloads.is_some() {
        merged.downloads = child.downloads;
    }

    merged
}

fn lib_key(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() >= 2 {
        format!("{}:{}", parts[0], parts[1])
    } else {
        name.to_string()
    }
}
