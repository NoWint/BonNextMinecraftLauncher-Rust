#![allow(dead_code)]
//! Modrinth API integration for mod browsing and downloading.
//! Uses the public Modrinth v2 API: https://docs.modrinth.com/

use crate::error::LauncherError;
use crate::http_client;
use crate::download::source;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

fn api_base() -> &'static str {
    source::modrinth_api_base()
}

fn all_api_bases() -> Vec<&'static str> {
    source::all_modrinth_bases()
}

fn deserialize_null_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

// ---------------------------------------------------------------
// Public types (serialized to frontend)
// ---------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModResult {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub categories: Vec<String>,
    pub downloads: u64,
    pub follows: u64,
    pub icon_url: String,
    pub client_side: String,
    pub server_side: String,
    pub latest_version: Option<String>,
    pub date_created: String,
    pub date_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModProjectFull {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub body: String,
    pub author: String,
    pub categories: Vec<String>,
    pub downloads: u64,
    pub follows: u64,
    pub icon_url: String,
    pub client_side: String,
    pub server_side: String,
    pub project_type: String,
    pub gallery: Vec<ModGalleryImage>,
    pub issues_url: Option<String>,
    pub source_url: Option<String>,
    pub wiki_url: Option<String>,
    pub discord_url: Option<String>,
    pub license: Option<ModLicense>,
    pub date_created: String,
    pub date_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModGalleryImage {
    pub url: String,
    pub featured: bool,
    pub title: Option<String>,
    pub description: Option<String>,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModLicense {
    pub id: String,
    pub name: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModVersion {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version_number: String,
    #[serde(default)]
    pub game_versions: Vec<String>,
    #[serde(default)]
    pub loaders: Vec<String>,
    #[serde(default)]
    pub files: Vec<ModFile>,
    #[serde(default)]
    pub dependencies: Vec<ModDependency>,
    #[serde(default)]
    pub date_published: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModFile {
    pub url: String,
    pub filename: String,
    #[serde(default)]
    pub size: u64,
    pub hashes: ModHashes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModHashes {
    pub sha1: Option<String>,
    pub sha512: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModDependency {
    pub project_id: Option<String>,
    pub dependency_type: String,
    pub version_id: Option<String>,
}

// ---------------------------------------------------------------
// Internal deserialization types (Modrinth API response shapes)
// ---------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct ModrinthSearchResponse {
    hits: Vec<ModrinthSearchHit>,
    total_hits: u64,
}

#[derive(Debug, Deserialize)]
struct ModrinthSearchHit {
    slug: String,
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    author: String,
    categories: Vec<String>,
    downloads: u64,
    follows: u64,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    icon_url: String,
    #[serde(default)]
    client_side: String,
    #[serde(default)]
    server_side: String,
    #[serde(default)]
    date_created: String,
    #[serde(default)]
    date_modified: String,
    latest_version: Option<String>,
}

impl From<ModrinthSearchHit> for ModResult {
    fn from(h: ModrinthSearchHit) -> Self {
        ModResult {
            slug: h.slug,
            title: h.title,
            description: h.description,
            author: h.author,
            categories: h.categories,
            downloads: h.downloads,
            follows: h.follows,
            icon_url: h.icon_url,
            client_side: h.client_side,
            server_side: h.server_side,
            latest_version: h.latest_version,
            date_created: h.date_created,
            date_modified: h.date_modified,
        }
    }
}

impl From<ModrinthProject> for ModResult {
    fn from(p: ModrinthProject) -> Self {
        ModResult {
            slug: p.slug,
            title: p.title,
            description: p.description,
            author: p.author,
            categories: p.categories,
            downloads: p.downloads,
            follows: p.follows,
            icon_url: p.icon_url,
            client_side: p.client_side,
            server_side: p.server_side,
            latest_version: None,
            date_created: p.date_created,
            date_modified: p.date_modified,
        }
    }
}

#[derive(Debug, Deserialize)]
struct ModrinthProject {
    slug: String,
    title: String,
    description: String,
    author: String,
    categories: Vec<String>,
    downloads: u64,
    follows: u64,
    icon_url: String,
    client_side: String,
    server_side: String,
    date_created: String,
    date_modified: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthProjectFull {
    slug: String,
    title: String,
    description: String,
    #[serde(default)]
    body: String,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    author: String,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    team: String,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    organization: String,
    #[serde(default)]
    categories: Vec<String>,
    downloads: u64,
    follows: u64,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    icon_url: String,
    #[serde(default)]
    client_side: String,
    #[serde(default)]
    server_side: String,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    project_type: String,
    #[serde(default)]
    gallery: Vec<ModrinthGalleryImage>,
    issues_url: Option<String>,
    source_url: Option<String>,
    wiki_url: Option<String>,
    discord_url: Option<String>,
    license: Option<ModrinthLicense>,
    date_created: String,
    date_modified: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthGalleryImage {
    #[serde(default, deserialize_with = "deserialize_null_string")]
    url: String,
    #[serde(default)]
    featured: bool,
    title: Option<String>,
    description: Option<String>,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    created: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthLicense {
    #[serde(default, deserialize_with = "deserialize_null_string")]
    id: String,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    name: String,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModrinthVersion {
    id: String,
    name: String,
    #[serde(default)]
    version_number: String,
    #[serde(default)]
    game_versions: Vec<String>,
    #[serde(default)]
    loaders: Vec<String>,
    #[serde(default)]
    files: Vec<ModrinthFile>,
    #[serde(default)]
    dependencies: Vec<ModrinthDependency>,
    #[serde(default)]
    date_published: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthFile {
    url: String,
    filename: String,
    #[serde(default)]
    size: u64,
    hashes: ModrinthHashes,
}

#[derive(Debug, Deserialize)]
struct ModrinthHashes {
    sha1: Option<String>,
    sha512: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModrinthDependency {
    project_id: Option<String>,
    dependency_type: String,
    version_id: Option<String>,
}

/// Search for mods on Modrinth.
pub async fn search_mods(
    query: &str,
    game_version: Option<&str>,
    loader: Option<&str>,
    limit: u64,
    offset: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let mut facets = vec![r#"["project_type:mod"]"#.to_string()];

    if let Some(ver) = game_version {
        facets.push(format!(r#"["versions:{}"]"#, ver));
    }
    if let Some(ldr) = loader {
        facets.push(format!(r#"["categories:{}"]"#, ldr));
    }

    let facets_param = format!("[{}]", facets.join(","));
    let url_template = format!(
        "{{API_BASE}}/search?query={}&facets={}&limit={}&offset={}",
        urlencoding::encode(query), facets_param, limit.min(50), offset
    );

    tracing::debug!("Modrinth search: {}", url_template);

    let bases = all_api_bases();
    let resp: ModrinthSearchResponse = http_client::retry_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await?;

    let results: Vec<ModResult> = resp.hits.into_iter().map(Into::into).collect();

    Ok((results, resp.total_hits))
}

/// Get detailed information about a specific mod.
pub async fn get_mod(slug: &str) -> Result<ModResult, LauncherError> {
    let url_template = format!("{{API_BASE}}/project/{}", slug);
    let bases = all_api_bases();

    let resp: ModrinthProject = http_client::retry_api_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await
        .map_err(|e| {
            tracing::error!("Modrinth mod JSON parse failed for {}: {}", slug, e);
            LauncherError::Http(e)
        })?;

    Ok(resp.into())
}

/// Get versions of a mod, filtered by game version and loader.
pub async fn get_mod_versions(
    slug: &str,
    game_version: Option<&str>,
    loader: Option<&str>,
) -> Result<Vec<ModVersion>, LauncherError> {
    let mut url_template = format!("{{API_BASE}}/project/{}/version", slug);

    let mut params = Vec::new();
    if let Some(ver) = game_version {
        params.push(format!("game_versions=[\"{}\"]", ver));
    }
    if let Some(ldr) = loader {
        params.push(format!("loaders=[\"{}\"]", ldr));
    }
    if !params.is_empty() {
        url_template.push('?');
        url_template.push_str(&params.join("&"));
    }

    let bases = all_api_bases();

    let resp: Vec<ModrinthVersion> = http_client::retry_api_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await
        .map_err(|e| {
            tracing::error!("Modrinth versions JSON parse failed for {}: {}", slug, e);
            LauncherError::Http(e)
        })?;

    Ok(resp
        .into_iter()
        .map(|v| ModVersion {
            id: v.id,
            name: v.name,
            version_number: v.version_number,
            game_versions: v.game_versions,
            loaders: v.loaders,
            files: v.files.into_iter().map(|f| ModFile {
                url: f.url,
                filename: f.filename,
                size: f.size,
                hashes: ModHashes { sha1: f.hashes.sha1, sha512: f.hashes.sha512 },
            }).collect(),
            dependencies: v.dependencies.into_iter().map(|d| ModDependency {
                project_id: d.project_id,
                dependency_type: d.dependency_type,
                version_id: d.version_id,
            }).collect(),
            date_published: v.date_published,
        })
        .collect())
}

/// Get popular mods for a Minecraft version.
pub async fn get_popular_mods(
    game_version: Option<&str>,
    limit: u64,
) -> Result<Vec<ModResult>, LauncherError> {
    let mut facets = vec![r#"["project_type:mod"]"#.to_string()];

    if let Some(ver) = game_version {
        facets.push(format!(r#"["versions:{}"]"#, ver));
    }

    let facets_param = format!("[{}]", facets.join(","));
    let url_template = format!(
        "{{API_BASE}}/search?facets={}&limit={}&order=desc",
        facets_param, limit.min(50)
    );

    let bases = all_api_bases();
    let resp: ModrinthSearchResponse = http_client::retry_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await?;

    Ok(resp.hits.into_iter().map(Into::into).collect())
}

/// Search with combined facets for market-style browsing.
/// Supports multi-facet queries and sort options.
pub async fn search_with_facets(
    query: &str,
    project_type: &str,
    game_version: Option<&str>,
    loader: Option<&str>,
    sort: Option<&str>,
    limit: u64,
    offset: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let mut facets = vec![format!(r#"["project_type:{}"]"#, project_type)];

    if let Some(ver) = game_version {
        if !ver.is_empty() {
            facets.push(format!(r#"["versions:{}"]"#, ver));
        }
    }
    if let Some(ldr) = loader {
        if !ldr.is_empty() {
            facets.push(format!(r#"["categories:{}"]"#, ldr));
        }
    }

    let facets_param = format!("[{}]", facets.join(","));
    let sort_order = match sort.unwrap_or("relevance") {
        "downloads" => "downloads",
        "newest" => "newest",
        "updated" => "updated",
        _ => "relevance",
    };

    let url_template = format!(
        "{{API_BASE}}/search?query={}&facets={}&limit={}&offset={}&index={}",
        urlencoding::encode(query),
        facets_param,
        limit.min(50),
        offset,
        sort_order,
    );

    tracing::debug!("Modrinth search (facets): {}", url_template);

    let bases = all_api_bases();
    let resp: ModrinthSearchResponse = http_client::retry_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await?;

    let results: Vec<ModResult> = resp.hits.into_iter().map(Into::into).collect();

    Ok((results, resp.total_hits))
}

/// Get full project details including body HTML, gallery, and license.
pub async fn get_project_full(slug: &str) -> Result<ModProjectFull, LauncherError> {
    let url_template = format!("{{API_BASE}}/project/{}", slug);
    let bases = all_api_bases();

    let resp: ModrinthProjectFull = http_client::retry_api_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await
        .map_err(|e| {
            tracing::error!("Modrinth project JSON parse failed for {}: {}", slug, e);
            LauncherError::Http(e)
        })?;

    Ok(ModProjectFull {
        slug: resp.slug,
        title: resp.title,
        description: resp.description,
        body: resp.body,
        author: if resp.author.is_empty() {
            if !resp.team.is_empty() { resp.team.clone() }
            else if !resp.organization.is_empty() { resp.organization.clone() }
            else { String::new() }
        } else { resp.author },
        categories: resp.categories,
        downloads: resp.downloads,
        follows: resp.follows,
        icon_url: resp.icon_url,
        client_side: resp.client_side,
        server_side: resp.server_side,
        project_type: resp.project_type,
        gallery: resp.gallery.into_iter().map(|g| ModGalleryImage {
            url: g.url,
            featured: g.featured,
            title: g.title,
            description: g.description,
            created: g.created,
        }).collect(),
        issues_url: resp.issues_url,
        source_url: resp.source_url,
        wiki_url: resp.wiki_url,
        discord_url: resp.discord_url,
        license: resp.license.map(|l| ModLicense {
            id: l.id,
            name: l.name,
            url: l.url,
        }),
        date_created: resp.date_created,
        date_modified: resp.date_modified,
    })
}

/// Get a single version by its ID.
pub async fn get_version_by_id(version_id: &str) -> Result<ModVersion, LauncherError> {
    let url_template = format!("{{API_BASE}}/version/{}", version_id);
    let bases = all_api_bases();

    let v: ModrinthVersion = http_client::retry_api_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await?;

    Ok(ModVersion {
        id: v.id,
        name: v.name,
        version_number: v.version_number,
        game_versions: v.game_versions,
        loaders: v.loaders,
        files: v.files.into_iter().map(|f| ModFile {
            url: f.url,
            filename: f.filename,
            size: f.size,
            hashes: ModHashes { sha1: f.hashes.sha1, sha512: f.hashes.sha512 },
        }).collect(),
        dependencies: v.dependencies.into_iter().map(|d| ModDependency {
            project_id: d.project_id,
            dependency_type: d.dependency_type,
            version_id: d.version_id,
        }).collect(),
        date_published: v.date_published,
    })
}

/// Get popular content for any project type.
pub async fn get_popular_by_type(
    project_type: &str,
    game_version: Option<&str>,
    limit: u64,
) -> Result<Vec<ModResult>, LauncherError> {
    let mut facets = vec![format!(r#"["project_type:{}"]"#, project_type)];
    if let Some(ver) = game_version {
        if !ver.is_empty() {
            facets.push(format!(r#"["versions:{}"]"#, ver));
        }
    }

    let facets_param = format!("[{}]", facets.join(","));
    let url_template = format!(
        "{{API_BASE}}/search?facets={}&limit={}&index=downloads",
        facets_param, limit.min(50)
    );

    tracing::debug!("Modrinth popular by type: {}", url_template);

    let bases = all_api_bases();
    let resp: ModrinthSearchResponse = http_client::retry_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await?;

    Ok(resp.hits.into_iter().map(Into::into).collect())
}

/// Get recently updated content, optionally filtered by project type.
pub async fn get_recently_updated(
    project_type: Option<&str>,
    limit: u64,
) -> Result<Vec<ModResult>, LauncherError> {
    let mut facets = Vec::new();
    if let Some(pt) = project_type {
        if !pt.is_empty() {
            facets.push(format!(r#"["project_type:{}"]"#, pt));
        }
    }

    let url_template = if facets.is_empty() {
        format!("{{API_BASE}}/search?limit={}&index=updated", limit.min(50))
    } else {
        let facets_param = format!("[{}]", facets.join(","));
        format!("{{API_BASE}}/search?facets={}&limit={}&index=updated", facets_param, limit.min(50))
    };

    tracing::debug!("Modrinth recently updated: {}", url_template);

    let bases = all_api_bases();
    let resp: ModrinthSearchResponse = http_client::retry_get_with_fallback(&url_template, &bases, 2, None)
        .await?
        .json()
        .await?;

    Ok(resp.hits.into_iter().map(Into::into).collect())
}

/// Download a content file to the instance's correct directory based on type.
pub async fn download_content_file(
    file_url: &str,
    filename: &str,
    instance_id: &str,
    content_type: &str,
    sha1_hash: Option<&str>,
) -> Result<String, LauncherError> {
    download_content_file_with_progress(file_url, filename, instance_id, content_type, sha1_hash, None, None).await
}

pub async fn download_content_file_with_progress(
    file_url: &str,
    filename: &str,
    instance_id: &str,
    content_type: &str,
    sha1_hash: Option<&str>,
    slug: Option<&str>,
    app: Option<&tauri::AppHandle>,
) -> Result<String, LauncherError> {
    let target_dir = match content_type {
        "resourcepack" => crate::platform::paths::get_instance_resourcepacks_dir(instance_id),
        "shader" => crate::platform::paths::get_instance_shaderpacks_dir(instance_id),
        _ => crate::platform::paths::get_instance_mods_dir(instance_id),
    };
    tokio::fs::create_dir_all(&target_dir).await?;
    let target_path = target_dir.join(filename);

    let client = http_client::build_download_client();
    let response = client.get(file_url).send().await?.error_for_status()?;

    let total_size: u64 = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = tokio::io::BufWriter::new(tokio::fs::File::create(&target_path).await?);
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    use sha1::{Digest, Sha1};

    let mut hasher = sha1_hash.map(|_| Sha1::new());
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result?;
        if let Some(ref mut h) = hasher {
            h.update(&chunk);
        }
        tokio::io::copy(&mut &chunk[..], &mut file).await?;
        downloaded += chunk.len() as u64;

        if let Some(app_handle) = app {
            let now = std::time::Instant::now();
            if now.duration_since(last_emit).as_millis() >= 200 {
                let elapsed_secs = start_time.elapsed().as_secs().max(1);
                let speed = downloaded / elapsed_secs;
                let eta = if speed > 0 && total_size > downloaded {
                    (total_size - downloaded) / speed
                } else {
                    0
                };
                let progress = if total_size > 0 {
                    ((downloaded as f64 / total_size as f64) * 100.0) as u64
                } else {
                    0
                };
                let _ = app_handle.emit(
                    "content-download-progress",
                    serde_json::json!({
                        "filename": filename,
                        "slug": slug.unwrap_or(""),
                        "bytes_downloaded": downloaded,
                        "total": total_size,
                        "speed_bytes_per_sec": speed,
                        "eta_seconds": eta,
                        "progress": progress,
                        "finished": false,
                    }),
                );
                last_emit = now;
            }
        }
    }

    file.flush().await?;

    if let Some(app_handle) = app {
        let _ = app_handle.emit(
            "content-download-progress",
            serde_json::json!({
                "filename": filename,
                "slug": slug.unwrap_or(""),
                "bytes_downloaded": downloaded,
                "total": total_size,
                "speed_bytes_per_sec": 0,
                "eta_seconds": 0,
                "progress": 100,
                "finished": true,
            }),
        );
    }

    if let (Some(expected_sha1), Some(h)) = (sha1_hash, hasher) {
        let actual = hex::encode(h.finalize());
        if !actual.eq_ignore_ascii_case(expected_sha1) {
            let _ = tokio::fs::remove_file(&target_path).await;
            return Err(LauncherError::Sha1Mismatch(format!(
                "File {} expected SHA1 {} but got {}",
                filename, expected_sha1, actual
            )));
        }
    }

    tracing::info!("Content downloaded: {} -> {}", filename, target_path.display());
    Ok(target_path.to_string_lossy().to_string())
}

/// Download a mod file to the instance's mods directory.
pub async fn download_mod_file(
    file_url: &str,
    filename: &str,
    instance_id: &str,
    sha1_hash: Option<&str>,
) -> Result<String, LauncherError> {
    download_content_file(file_url, filename, instance_id, "mod", sha1_hash).await
}
