#![allow(dead_code)]
//! CurseForge API v1 integration.
//! Docs: https://docs.curseforge.com/

use crate::error::LauncherError;
use crate::http_client;
use crate::modrinth::{ModFile, ModHashes, ModResult};
use serde::Deserialize;

const CF_API_BASE: &str = "https://api.curseforge.com/v1";
// Default API key used by many open-source Minecraft launchers
const CF_API_KEY: &str = "$2a$10$AwfSqJ0yOoyURJZ3BkJeDOmSUk4B5BSP2A6fK0l0eX5Oq5Y3VwOZa";

fn cf_headers() -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("x-api-key", CF_API_KEY.parse().unwrap());
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
struct CfMod {
    id: u64,
    name: String,
    summary: String,
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
        follows: 0, // CF API doesn't expose follows easily
        icon_url: icon,
        client_side: "required".to_string(),
        server_side: "unsupported".to_string(),
        latest_version,
        date_created: cf.date_created,
        date_modified: cf.date_modified,
    }
}

/// Map a CF file to our ModFile.
fn map_file(f: CfFile) -> ModFile {
    let sha1 = f.hashes.iter().find(|h| h.algo == 1).map(|h| h.value.clone());
    ModFile {
        url: f.download_url.unwrap_or_default(),
        filename: f.file_name,
        size: f.file_length,
        hashes: ModHashes { sha1, sha512: None },
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
        _ => 1u8, // default: last updated
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
) -> Result<String, LauncherError> {
    crate::modrinth::download_content_file(file_url, filename, instance_id, "mod", None).await
}
