#![allow(dead_code)]
//! CurseForge API v1 integration.
//! Docs: https://docs.curseforge.com/

use crate::error::LauncherError;
use crate::http_client;
use crate::modrinth::{ModDependency, ModFile, ModGalleryImage, ModHashes, ModProjectFull, ModResult, ModVersion};
use serde::Deserialize;

const CF_API_BASE: &str = "https://api.curseforge.com/v1";

fn get_cf_api_key() -> String {
    if let Ok(key) = std::env::var("BONNEXT_CF_API_KEY") {
        if !key.is_empty() {
            return key;
        }
    }
    if let Ok(Some(key)) = crate::security::key_store::get_key("cf_api_key") {
        if !key.is_empty() {
            return key;
        }
    }
    String::new()
}

fn cf_headers() -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    let key = get_cf_api_key();
    if !key.is_empty() {
        if let Ok(val) = key.parse() {
            headers.insert("x-api-key", val);
        }
    }
    headers.insert("Accept", "application/json".parse().unwrap());
    headers
}

// ---------------------------------------------------------------
// CurseForge API response types
// ---------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct CfResponse<T> {
    data: T,
}

#[derive(Debug, Deserialize)]
struct CfPaginated<T> {
    data: T,
    pagination: CfPagination,
}

#[derive(Debug, Deserialize)]
struct CfPagination {
    #[serde(rename = "totalCount")]
    total_count: u64,
}

#[derive(Debug, Deserialize)]
struct CfScreenshot {
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: Option<String>,
    url: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CfAuthor {
    name: String,
}

#[derive(Debug, Deserialize)]
struct CfCategory {
    id: u64,
    name: String,
    slug: String,
}

#[derive(Debug, Deserialize)]
struct CfAsset {
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct CfLinks {
    #[serde(rename = "websiteUrl")]
    website_url: Option<String>,
    #[serde(rename = "wikiUrl")]
    wiki_url: Option<String>,
    #[serde(rename = "issuesUrl")]
    issues_url: Option<String>,
    #[serde(rename = "sourceUrl")]
    source_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CfHash {
    algo: u64, // 1=sha1, 2=md5
    value: String,
}

#[derive(Debug, Deserialize)]
struct CfDependency {
    #[serde(rename = "modId")]
    mod_id: u64,
    #[serde(rename = "relationType")]
    relation_type: u64, // 3=required, 2=optional, etc.
}

#[derive(Debug, Deserialize)]
struct CfFile {
    id: u64,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "downloadUrl")]
    download_url: Option<String>,
    #[serde(rename = "fileLength")]
    file_length: u64,
    #[serde(rename = "gameVersions")]
    game_versions: Vec<String>,
    #[serde(rename = "releaseType")]
    release_type: u64, // 1=release, 2=beta, 3=alpha
    #[serde(rename = "fileDate")]
    file_date: String,
    hashes: Vec<CfHash>,
    dependencies: Vec<CfDependency>,
}

#[derive(Debug, Deserialize)]
struct CfMod {
    id: u64,
    name: String,
    summary: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    authors: Vec<CfAuthor>,
    categories: Vec<CfCategory>,
    #[serde(rename = "downloadCount")]
    download_count: f64,
    logo: Option<CfAsset>,
    links: CfLinks,
    #[serde(rename = "dateCreated")]
    date_created: String,
    #[serde(rename = "dateModified")]
    date_modified: String,
    #[serde(rename = "latestFiles")]
    latest_files: Vec<CfFile>,
    #[serde(default)]
    screenshots: Vec<CfScreenshot>,
}

/// Map a CF mod to our unified ModResult.
fn map_mod(cf: CfMod) -> ModResult {
    let author = cf.authors.first().map(|a| a.name.clone()).unwrap_or_default();
    let icon = cf.logo.map(|l| l.thumbnail_url).unwrap_or_default();
    let categories: Vec<String> = cf.categories.into_iter().map(|c| c.name).collect();
    let latest_version = cf.latest_files.first().map(|f| f.display_name.clone());

    ModResult {
        slug: cf.id.to_string(),
        title: cf.name,
        description: cf.summary,
        author,
        categories,
        downloads: cf.download_count as u64,
        follows: 0,
        icon_url: icon,
        client_side: "required".to_string(),
        server_side: "unsupported".to_string(),
        latest_version,
        date_created: cf.date_created,
        date_modified: cf.date_modified,
    }
}

fn map_mod_full(cf: CfMod) -> ModProjectFull {
    let author = cf.authors.first().map(|a| a.name.clone()).unwrap_or_default();
    let icon = cf.logo.map(|l| l.thumbnail_url).unwrap_or_default();
    let categories: Vec<String> = cf.categories.into_iter().map(|c| c.name).collect();
    let gallery: Vec<ModGalleryImage> = cf.screenshots.into_iter().map(|s| {
        ModGalleryImage {
            url: s.url,
            featured: false,
            title: s.title,
            description: s.description,
            created: String::new(),
        }
    }).collect();

    ModProjectFull {
        slug: cf.id.to_string(),
        title: cf.name,
        description: cf.summary.clone(),
        body: cf.description.unwrap_or(cf.summary),
        author,
        categories,
        downloads: cf.download_count as u64,
        follows: 0,
        icon_url: icon,
        client_side: "required".to_string(),
        server_side: "unsupported".to_string(),
        project_type: "mod".to_string(),
        gallery,
        issues_url: cf.links.issues_url,
        source_url: cf.links.source_url,
        wiki_url: cf.links.wiki_url,
        discord_url: None,
        license: None,
        date_created: cf.date_created,
        date_modified: cf.date_modified,
    }
}

/// Map a CF file to our ModFile.
fn map_file(f: CfFile) -> ModFile {
    let sha1 = f.hashes.iter().find(|h| h.algo == 1).map(|h| h.value.clone());
    ModFile {
        url: f.download_url.clone().unwrap_or_else(|| format!("cf://{}", f.id)),
        filename: f.file_name,
        size: f.file_length,
        hashes: ModHashes { sha1, sha512: None },
    }
}

fn map_file_to_version(f: CfFile) -> ModVersion {
    let sha1 = f.hashes.iter().find(|h| h.algo == 1).map(|h| h.value.clone());
    let primary_file = ModFile {
        url: f.download_url.clone().unwrap_or_else(|| format!("cf://{}", f.id)),
        filename: f.file_name.clone(),
        size: f.file_length,
        hashes: ModHashes { sha1, sha512: None },
    };

    let game_versions: Vec<String> = f.game_versions.iter()
        .filter(|v| !v.starts_with("Forge") && !v.starts_with("Fabric") && !v.starts_with("Quilt"))
        .cloned()
        .collect();

    let loaders: Vec<String> = f.game_versions.iter()
        .filter_map(|v| {
            if v.starts_with("Forge") { Some("forge".to_string()) }
            else if v.starts_with("Fabric") { Some("fabric".to_string()) }
            else if v.starts_with("Quilt") { Some("quilt".to_string()) }
            else { None }
        })
        .collect();

    let dependencies: Vec<ModDependency> = f.dependencies.iter().map(|d| {
        let dep_type = match d.relation_type {
            3 => "required",
            2 => "optional",
            4 => "incompatible",
            _ => "optional",
        };
        ModDependency {
            project_id: Some(d.mod_id.to_string()),
            dependency_type: dep_type.to_string(),
            version_id: None,
        }
    }).collect();

    ModVersion {
        id: f.id.to_string(),
        name: f.display_name.clone(),
        version_number: f.file_name.clone(),
        game_versions,
        loaders,
        files: vec![primary_file],
        dependencies,
        date_published: f.file_date,
    }
}

// ---------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------

pub async fn search_mods(
    query: &str,
    game_version: Option<&str>,
    category: Option<&str>,
    sort: Option<&str>,
    limit: u64,
    offset: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let client = http_client::build_client();
    let mut url = format!("{}/mods/search", CF_API_BASE);
    url.push_str(&format!("?searchFilter={}&gameId=432", urlencoding::encode(query)));

    if let Some(ver) = game_version {
        if !ver.is_empty() {
            url.push_str(&format!("&gameVersion={}", urlencoding::encode(ver)));
        }
    }
    if let Some(cat) = category {
        if !cat.is_empty() {
            url.push_str(&format!("&categoryId={}", cat));
        }
    }

    let sort_field = match sort.unwrap_or("popularity") {
        "downloads" => 2u8,
        "name" => 3u8,
        "updated" => 1u8,
        _ => 1u8,
    };
    url.push_str(&format!("&sortField={}&sortOrder=desc&pageSize={}&index={}",
        sort_field, limit.min(50), offset / limit.min(50)));

    tracing::debug!("CurseForge search: {}", url);

    let resp: CfPaginated<Vec<CfMod>> = client
        .get(&url)
        .headers(cf_headers())
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let total = resp.pagination.total_count;
    let results: Vec<ModResult> = resp.data.into_iter().map(map_mod).collect();
    Ok((results, total))
}

pub async fn get_mod(mod_id: u64) -> Result<ModResult, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/mods/{}", CF_API_BASE, mod_id);

    let resp: CfResponse<CfMod> = client
        .get(&url)
        .headers(cf_headers())
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(map_mod(resp.data))
}

pub async fn get_mod_full(mod_id: u64) -> Result<ModProjectFull, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/mods/{}", CF_API_BASE, mod_id);

    let resp: CfResponse<CfMod> = client
        .get(&url)
        .headers(cf_headers())
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(map_mod_full(resp.data))
}

pub async fn get_mod_versions(mod_id: u64) -> Result<Vec<ModVersion>, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/mods/{}/files", CF_API_BASE, mod_id);

    let resp: CfPaginated<Vec<CfFile>> = client
        .get(&url)
        .headers(cf_headers())
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp.data.into_iter().map(map_file_to_version).collect())
}

pub async fn get_featured() -> Result<Vec<ModResult>, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/mods/featured?gameId=432", CF_API_BASE);

    tracing::debug!("CurseForge featured: {}", url);

    let resp: CfResponse<Vec<CfMod>> = client
        .get(&url)
        .headers(cf_headers())
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp.data.into_iter().map(map_mod).collect())
}

pub async fn get_mod_files(mod_id: u64) -> Result<Vec<ModFile>, LauncherError> {
    let client = http_client::build_client();
    let url = format!("{}/mods/{}/files", CF_API_BASE, mod_id);

    let resp: CfPaginated<Vec<CfFile>> = client
        .get(&url)
        .headers(cf_headers())
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp.data.into_iter().map(map_file).collect())
}

pub async fn download_mod_file(
    file_url: &str,
    filename: &str,
    instance_id: &str,
    content_type: Option<&str>,
    sha1_hash: Option<&str>,
) -> Result<String, LauncherError> {
    let ct = content_type.unwrap_or("mod");
    crate::modrinth::download_content_file(file_url, filename, instance_id, ct, sha1_hash).await
}
