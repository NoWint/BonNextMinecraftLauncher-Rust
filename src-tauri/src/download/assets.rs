use crate::error::LauncherError;
use crate::platform::paths;
use crate::version::manifest::mirror_url;
use crate::version::resolver::AssetIndex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AssetIndexFile {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

pub async fn download_assets(
    asset_index: &AssetIndex,
) -> Result<(), LauncherError> {
    let index_path = paths::get_assets_dir()
        .join("indexes")
        .join(format!("{}.json", asset_index.id));

    let index_data = if index_path.exists() {
        let json = tokio::fs::read_to_string(&index_path).await?;
        let parsed: AssetIndexFile = serde_json::from_str(&json)?;
        if verify_asset_index(&parsed, &asset_index.sha1) {
            parsed
        } else {
            fetch_asset_index(asset_index, &index_path).await?
        }
    } else {
        fetch_asset_index(asset_index, &index_path).await?
    };

    let mut download_items = Vec::new();

    for (_name, obj) in &index_data.objects {
        let hash_prefix = &obj.hash[0..2];
        let asset_path = paths::get_assets_dir()
            .join("objects")
            .join(hash_prefix)
            .join(&obj.hash);

        if asset_path.exists() {
            if super::verifier::verify_sha1(&asset_path, &obj.hash).unwrap_or(false) {
                continue;
            }
        }

        let url = mirror_url(&format!(
            "https://resources.download.minecraft.net/{}/{}",
            hash_prefix, obj.hash
        ));

        download_items.push(super::queue::DownloadItem {
            url,
            path: asset_path,
            sha1: obj.hash.clone(),
            size: obj.size,
        });
    }

    if !download_items.is_empty() {
        tracing::info!("Downloading {} asset files", download_items.len());
        super::queue::download_all(download_items, 16).await?;
    }

    Ok(())
}

async fn fetch_asset_index(
    asset_index: &AssetIndex,
    save_path: &PathBuf,
) -> Result<AssetIndexFile, LauncherError> {
    let url = mirror_url(&asset_index.url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let data: AssetIndexFile = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    if let Some(parent) = save_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let json = serde_json::to_string_pretty(&data)?;
    tokio::fs::write(save_path, json).await?;

    Ok(data)
}

fn verify_asset_index(data: &AssetIndexFile, expected_sha1: &str) -> bool {
    let json = serde_json::to_string(data).unwrap_or_default();
    use sha1::{Digest, Sha1};
    let mut hasher = Sha1::new();
    hasher.update(json.as_bytes());
    let result = hex::encode(hasher.finalize());
    result.eq_ignore_ascii_case(expected_sha1)
}
