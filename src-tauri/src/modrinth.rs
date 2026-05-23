#![allow(dead_code)]
//! Modrinth API integration for mod browsing and downloading.
//! Uses the public Modrinth v2 API: https://docs.modrinth.com/

use crate::error::LauncherError;
use crate::http_client;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

const MODRINTH_API_BASE: &str = "https://api.modrinth.com/v2";

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
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
pub struct ModVersion {
    pub id: String,
    pub name: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModFile>,
    pub dependencies: Vec<ModDependency>,
    pub date_published: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ModFile {
    pub url: String,
    pub filename: String,
    pub size: u64,
    pub hashes: ModHashes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModHashes {
    pub sha1: Option<String>,
    pub sha512: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
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
    author: String,
    categories: Vec<String>,
    downloads: u64,
    follows: u64,
    #[serde(default, deserialize_with = "deserialize_null_string")]
    icon_url: String,
    client_side: String,
    server_side: String,
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
    url: String,
    featured: bool,
    title: Option<String>,
    description: Option<String>,
    created: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthLicense {
    id: String,
    name: String,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModrinthVersion {
    id: String,
    name: String,
    version_number: String,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    files: Vec<ModrinthFile>,
    dependencies: Vec<ModrinthDependency>,
    date_published: String,
}

#[derive(Debug, Deserialize)]
struct ModrinthFile {
    url: String,
    filename: String,
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
    let client = http_client::build_client();
    let base = format!("{}/search", MODRINTH_API_BASE);
    let mut facets = vec![r#"["project_type:mod"]"#.to_string()];

    if let Some(ver) = game_version {
        facets.push(format!(r#"["versions:{}"]"#, ver));
    }
    if let Some(ldr) = loader {
        facets.push(format!(r#"["categories:{}"]"#, ldr));
    }

    let facets_param = format!("[{}]", facets.join(","));
    let url = format!(
        "{}?query={}&facets={}&limit={}&offset={}",
        base, urlencoding::encode(query), facets_param, limit.min(50), offset
    );

    tracing::debug!("Modrinth search: {}", url);

    let resp: ModrinthSearchResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let results: Vec<ModResult> = resp.hits.into_iter().map(Into::into).collect();

    Ok((results, resp.total_hits))
}

/// Get detailed information about a specific mod.
pub async fn get_mod(slug: &str) -> Result<ModResult, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/project/{}", MODRINTH_API_BASE, slug);

    let resp: ModrinthProject = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp.into())
}

/// Get versions of a mod, filtered by game version and loader.
pub async fn get_mod_versions(
    slug: &str,
    game_version: Option<&str>,
    loader: Option<&str>,
) -> Result<Vec<ModVersion>, LauncherError> {
    let client = http_client::build_client();
    let mut url = format!("{}/project/{}/version", MODRINTH_API_BASE, slug);

    let mut params = Vec::new();
    if let Some(ver) = game_version {
        params.push(format!("game_versions=[\"{}\"]", ver));
    }
    if let Some(ldr) = loader {
        params.push(format!("loaders=[\"{}\"]", ldr));
    }
    if !params.is_empty() {
        url.push('?');
        url.push_str(&params.join("&"));
    }

    let resp: Vec<ModrinthVersion> = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

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
    let client = http_client::build_client();
    let base = format!("{}/search", MODRINTH_API_BASE);
    let mut facets = vec![r#"["project_type:mod"]"#.to_string()];

    if let Some(ver) = game_version {
        facets.push(format!(r#"["versions:{}"]"#, ver));
    }

    let facets_param = format!("[{}]", facets.join(","));
    let url = format!(
        "{}?facets={}&limit={}&order=desc",
        base, facets_param, limit.min(50)
    );

    let resp: ModrinthSearchResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
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
    let client = http_client::build_client();
    let base = format!("{}/search", MODRINTH_API_BASE);

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

    let url = format!(
        "{}?query={}&facets={}&limit={}&offset={}&index={}",
        base,
        urlencoding::encode(query),
        facets_param,
        limit.min(50),
        offset,
        sort_order,
    );

    tracing::debug!("Modrinth search (facets): {}", url);

    let resp: ModrinthSearchResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let results: Vec<ModResult> = resp.hits.into_iter().map(Into::into).collect();

    Ok((results, resp.total_hits))
}

/// Get full project details including body HTML, gallery, and license.
pub async fn get_project_full(slug: &str) -> Result<ModProjectFull, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/project/{}", MODRINTH_API_BASE, slug);

    let resp: ModrinthProjectFull = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(ModProjectFull {
        slug: resp.slug,
        title: resp.title,
        description: resp.description,
        body: resp.body,
        author: resp.author,
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
    let client = http_client::build_client();
    let url = format!("{}/version/{}", MODRINTH_API_BASE, version_id);

    let v: ModrinthVersion = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
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
    let client = http_client::build_client();
    let base = format!("{}/search", MODRINTH_API_BASE);

    let mut facets = vec![format!(r#"["project_type:{}"]"#, project_type)];
    if let Some(ver) = game_version {
        if !ver.is_empty() {
            facets.push(format!(r#"["versions:{}"]"#, ver));
        }
    }

    let facets_param = format!("[{}]", facets.join(","));
    let url = format!(
        "{}?facets={}&limit={}&index=downloads",
        base, facets_param, limit.min(50)
    );

    tracing::debug!("Modrinth popular by type: {}", url);

    let resp: ModrinthSearchResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp.hits.into_iter().map(Into::into).collect())
}

/// Get recently updated content, optionally filtered by project type.
pub async fn get_recently_updated(
    project_type: Option<&str>,
    limit: u64,
) -> Result<Vec<ModResult>, LauncherError> {
    let client = http_client::build_client();
    let base = format!("{}/search", MODRINTH_API_BASE);

    let mut facets = Vec::new();
    if let Some(pt) = project_type {
        if !pt.is_empty() {
            facets.push(format!(r#"["project_type:{}"]"#, pt));
        }
    }

    let url = if facets.is_empty() {
        format!("{}?limit={}&index=updated", base, limit.min(50))
    } else {
        let facets_param = format!("[{}]", facets.join(","));
        format!("{}?facets={}&limit={}&index=updated", base, facets_param, limit.min(50))
    };

    tracing::debug!("Modrinth recently updated: {}", url);

    let resp: ModrinthSearchResponse = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?
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
    let target_dir = match content_type {
        "resourcepack" => crate::platform::paths::get_instance_resourcepacks_dir(instance_id),
        "shader" => crate::platform::paths::get_instance_shaderpacks_dir(instance_id),
        _ => crate::platform::paths::get_instance_mods_dir(instance_id),
    };
    tokio::fs::create_dir_all(&target_dir).await?;
    let target_path = target_dir.join(filename);

    let client = http_client::build_download_client();
    let response = client.get(file_url).send().await?.error_for_status()?;

    if let Some(parent) = target_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = tokio::io::BufWriter::new(tokio::fs::File::create(&target_path).await?);
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    use sha1::{Digest, Sha1};

    let mut hasher = sha1_hash.map(|_| Sha1::new());
    let mut _downloaded: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result?;
        if let Some(ref mut h) = hasher {
            h.update(&chunk);
        }
        tokio::io::copy(&mut &chunk[..], &mut file).await?;
        _downloaded += chunk.len() as u64;
    }

    file.flush().await?;

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
