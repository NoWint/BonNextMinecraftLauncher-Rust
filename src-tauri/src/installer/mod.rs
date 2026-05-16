use crate::error::LauncherError;
use crate::version::models::*;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Semaphore;

pub async fn download_file_with_sha1(
    client: &reqwest::Client,
    url: &str,
    target: &Path,
    expected_sha1: Option<&str>,
) -> Result<bool, LauncherError> {
    if target.exists() {
        if let Some(sha1) = expected_sha1 {
            let file_hash = compute_sha1(target)?;
            if file_hash == sha1 {
                return Ok(false);
            }
            tracing::warn!("SHA1 mismatch for {:?}, re-downloading", target);
            std::fs::remove_file(target)?;
        } else {
            return Ok(false);
        }
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let tmp_path = target.with_extension("tmp");
    let resp = client.get(url).send().await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(LauncherError::Other(format!("HTTP {} downloading {}", status, url)));
    }

    let bytes = resp.bytes().await?;
    std::fs::write(&tmp_path, &bytes)?;

    if let Some(sha1) = expected_sha1 {
        let file_hash = compute_sha1(&tmp_path)?;
        if file_hash != sha1 {
            std::fs::remove_file(&tmp_path)?;
            return Err(LauncherError::Other(format!(
                "SHA1 mismatch: expected {}, got {} for {:?}",
                sha1, file_hash, target
            )));
        }
    }

    std::fs::rename(&tmp_path, target)?;
    Ok(true)
}

fn compute_sha1(path: &Path) -> Result<String, LauncherError> {
    use sha1::Digest;
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = sha1::Sha1::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub async fn download_libraries(
    version: &VersionJson,
    game_dir: &Path,
) -> Result<(), LauncherError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;
    let libraries_dir = game_dir.join("libraries");
    let semaphore = Arc::new(Semaphore::new(10));
    let mut tasks = tokio::task::JoinSet::new();

    for lib in &version.libraries {
        if !rule_allows(&lib.rules) {
            continue;
        }

        if let Some(artifact) = &lib.downloads.artifact {
            let rel_path = match &artifact.path {
                Some(p) => p.clone(),
                None => match maven_name_to_path(&lib.name) {
                    Some(p) => p,
                    None => continue,
                },
            };
            let target = libraries_dir.join(&rel_path);
            let url = mirror_url(&artifact.url);
            let sha1 = artifact.sha1.clone();
            let client = client.clone();
            let permit = semaphore.clone().acquire_owned().await?;

            tasks.spawn(async move {
                let _permit = permit;
                download_file_with_sha1(&client, &url, &target, Some(&sha1)).await
            });
        }

        if let Some(classifier_key) = get_native_classifier(lib) {
            if let Some(native_artifact) = lib.downloads.classifiers.get(&classifier_key) {
                let rel_path = match &native_artifact.path {
                    Some(p) => p.clone(),
                    None => continue,
                };
                let target = libraries_dir.join(&rel_path);
                let url = mirror_url(&native_artifact.url);
                let sha1 = native_artifact.sha1.clone();
                let client = client.clone();
                let permit = semaphore.clone().acquire_owned().await?;

                tasks.spawn(async move {
                    let _permit = permit;
                    download_file_with_sha1(&client, &url, &target, Some(&sha1)).await
                });
            }
        }
    }

    while let Some(res) = tasks.join_next().await {
        res??;
    }

    Ok(())
}

pub async fn download_client_jar(
    version: &VersionJson,
    game_dir: &Path,
) -> Result<(), LauncherError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let downloads = version.downloads.as_ref()
        .ok_or_else(|| LauncherError::Other("No downloads in version JSON".to_string()))?;
    let client_dl = downloads.client.as_ref()
        .ok_or_else(|| LauncherError::Other("No client download info".to_string()))?;

    let version_dir = game_dir.join("versions").join(&version.id);
    std::fs::create_dir_all(&version_dir)?;
    let target = version_dir.join(format!("{}.jar", version.id));
    let url = mirror_url(&client_dl.url);

    download_file_with_sha1(&client, &url, &target, Some(&client_dl.sha1)).await?;
    Ok(())
}

pub async fn download_assets(
    version: &VersionJson,
    game_dir: &Path,
) -> Result<(), LauncherError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let asset_index_info = version.asset_index.as_ref()
        .ok_or_else(|| LauncherError::Other("No assetIndex in version JSON".to_string()))?;

    let assets_dir = game_dir.join("assets");
    let indexes_dir = assets_dir.join("indexes");
    let objects_dir = assets_dir.join("objects");
    std::fs::create_dir_all(&indexes_dir)?;
    std::fs::create_dir_all(&objects_dir)?;

    let index_path = indexes_dir.join(format!("{}.json", asset_index_info.id));
    let url = mirror_url(&asset_index_info.url);
    download_file_with_sha1(&client, &url, &index_path, Some(&asset_index_info.sha1)).await?;

    let index_json = std::fs::read_to_string(&index_path)?;
    let index_data: AssetIndexContent = serde_json::from_str(&index_json)?;

    let semaphore = Arc::new(Semaphore::new(20));
    let mut tasks = tokio::task::JoinSet::new();

    for (_name, obj) in &index_data.objects {
        let hash = obj.hash.clone();
        let prefix = hash[..2].to_string();
        let folder = objects_dir.join(&prefix);
        let file_path = folder.join(&hash);
        let client = client.clone();
        let permit = semaphore.clone().acquire_owned().await?;

        tasks.spawn(async move {
            let _permit = permit;
            if file_path.exists() {
                return Ok(());
            }
            let url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                prefix, hash
            );
            let mirrored = mirror_url(&url);
            match download_file_with_sha1(&client, &mirrored, &file_path, Some(&hash)).await {
                Ok(_) => Ok(()),
                Err(_) => download_file_with_sha1(&client, &url, &file_path, Some(&hash)).await.map(|_| ())
            }
        });
    }

    while let Some(res) = tasks.join_next().await {
        res??;
    }

    Ok(())
}

pub fn build_classpath(
    version: &VersionJson,
    game_dir: &Path,
) -> String {
    let libraries_dir = game_dir.join("libraries");
    let mut cp_parts: Vec<String> = Vec::new();

    for lib in &version.libraries {
        if !rule_allows(&lib.rules) {
            continue;
        }

        if let Some(artifact) = &lib.downloads.artifact {
            let rel_path = match &artifact.path {
                Some(p) => p.clone(),
                None => match maven_name_to_path(&lib.name) {
                    Some(p) => p,
                    None => continue,
                },
            };
            let full_path = libraries_dir.join(&rel_path);
            if let Some(s) = full_path.to_str() {
                let p = s.to_string();
                if !cp_parts.contains(&p) {
                    cp_parts.push(p);
                }
            }
        }
    }

    let client_jar = game_dir
        .join("versions")
        .join(&version.id)
        .join(format!("{}.jar", version.id));
    if let Some(s) = client_jar.to_str() {
        cp_parts.push(s.to_string());
    }

    cp_parts.join(classpath_separator())
}

pub fn extract_natives(
    version: &VersionJson,
    game_dir: &Path,
    instance_dir: &Path,
) -> Result<PathBuf, LauncherError> {
    let libraries_dir = game_dir.join("libraries");
    let natives_dir = instance_dir.join("natives");

    if natives_dir.exists() {
        std::fs::remove_dir_all(&natives_dir)?;
    }
    std::fs::create_dir_all(&natives_dir)?;

    for lib in &version.libraries {
        if !rule_allows(&lib.rules) {
            continue;
        }
        let classifier_key = match get_native_classifier(lib) {
            Some(k) => k,
            None => continue,
        };
        let native_artifact = match lib.downloads.classifiers.get(&classifier_key) {
            Some(a) => a,
            None => continue,
        };
        let rel_path = match &native_artifact.path {
            Some(p) => p.clone(),
            None => continue,
        };
        let zip_path = libraries_dir.join(&rel_path);
        if !zip_path.exists() {
            continue;
        }

        let exclude_patterns: Vec<String> = lib.extract.as_ref()
            .map(|e| e.exclude.clone())
            .unwrap_or_default();

        let bytes = std::fs::read(&zip_path)?;
        extract_zip_with_exclude(&bytes, &natives_dir, &exclude_patterns)?;
    }

    Ok(natives_dir)
}

fn extract_zip_with_exclude(
    data: &[u8],
    target_dir: &Path,
    exclude_patterns: &[String],
) -> Result<(), LauncherError> {
    let cursor = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(cursor)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = match file.enclosed_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };

        let should_exclude = exclude_patterns.iter().any(|p| name.starts_with(p.as_str()));
        if should_exclude {
            continue;
        }

        let out_path = target_dir.join(&name);

        if name.ends_with('/') {
            std::fs::create_dir_all(&out_path)?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut out_file = std::fs::File::create(&out_path)?;
        std::io::copy(&mut file, &mut out_file)?;
    }

    Ok(())
}
