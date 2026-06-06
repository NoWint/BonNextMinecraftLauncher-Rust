//! ModpackIndex API v1 integration.
//! Docs: https://www.modpackindex.com/api/v1
//! A third-party CurseForge mirror with inverse modpack lookups.

use crate::error::LauncherError;
use crate::http_client;
use crate::modrinth::{ModProjectFull, ModResult};
use serde::Deserialize;

const MPI_BASE: &str = "https://www.modpackindex.com/api/v1";

// ---------------------------------------------------------------
// MPI response wrappers
// ---------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct MpiResponse<T> {
    data: T,
    // links, meta are present but not needed for mapping
}

#[derive(Debug, Deserialize)]
struct MpiLinks {
    first: Option<String>,
    last: Option<String>,
    prev: Option<String>,
    next: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MpiMeta {
    total: Option<u64>,
    per_page: Option<String>,
    current_page: Option<u64>,
    last_page: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct MpiPagination {
    #[serde(default)]
    links: Option<MpiLinks>,
    #[serde(default)]
    meta: Option<MpiMeta>,
}

/// Wrapper when data is a paginated array. Treat meta as optional (some endpoints omit it).
#[derive(Debug, Deserialize)]
struct MpiSearchResponse<T> {
    data: T,
    links: Option<MpiLinks>,
    meta: Option<MpiMeta>,
}

// ---------------------------------------------------------------
// MPI entity types
// ---------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct MpiAuthor {
    pub id: u64,
    pub name: String,
    pub slug: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MpiCategory {
    pub id: u64,
    pub name: String,
    pub slug: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MpiLauncher {
    pub id: u64,
    pub name: String,
    pub slug: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MpiMcVersion {
    pub id: u64,
    pub name: String,
    pub slug: Option<String>,
}

/// Bare mod/modpack in list responses (fewer fields).
#[derive(Debug, Deserialize)]
pub struct MpiProjectShort {
    pub id: u64,
    pub name: String,
    pub slug: String,
    pub summary: Option<String>,
    pub download_count: Option<u64>,
    pub thumbnail_url: Option<String>,
    pub primary_language: Option<String>,
    pub popularity_rank: Option<u64>,
    pub latest_release_date: Option<String>,
    pub last_modified: Option<String>,
    pub last_updated: Option<String>,
}

/// Full mod/modpack entity with relations.
#[derive(Debug, Deserialize)]
pub struct MpiProjectFull {
    pub id: u64,
    pub name: String,
    pub slug: String,
    pub summary: Option<String>,
    pub download_count: Option<u64>,
    pub thumbnail_url: Option<String>,
    pub primary_language: Option<String>,
    pub popularity_rank: Option<u64>,
    pub latest_release_date: Option<String>,
    pub last_modified: Option<String>,
    pub last_updated: Option<String>,
    #[serde(default)]
    pub categories: Vec<MpiCategory>,
    #[serde(default)]
    pub authors: Vec<MpiAuthor>,
    #[serde(default)]
    pub launchers: Vec<MpiLauncher>,
    #[serde(default)]
    pub minecraft_versions: Vec<MpiMcVersion>,
}

// ---------------------------------------------------------------
// Mappers: MPI → shared types
// ---------------------------------------------------------------

fn map_short(short: &MpiProjectShort, project_type: &str) -> ModResult {
    ModResult {
        slug: short.slug.clone(),
        title: short.name.clone(),
        description: short.summary.clone().unwrap_or_default(),
        author: String::new(), // list endpoints don't include author
        categories: Vec::new(), // list endpoints don't include categories
        downloads: short.download_count.unwrap_or(0),
        follows: 0,
        icon_url: short.thumbnail_url.clone().unwrap_or_default(),
        client_side: String::new(),
        server_side: String::new(),
        project_type: project_type.to_string(),
        latest_version: short.latest_release_date.clone(),
        date_created: short.last_modified.clone().unwrap_or_default(),
        date_modified: short.last_updated.clone().unwrap_or_default(),
    }
}

fn map_full(full: &MpiProjectFull, project_type: &str) -> ModProjectFull {
    ModProjectFull {
        slug: full.slug.clone(),
        title: full.name.clone(),
        description: full.summary.clone().unwrap_or_default(),
        body: String::new(),
        author: full
            .authors
            .first()
            .map(|a| a.name.clone())
            .unwrap_or_default(),
        categories: full
            .categories
            .iter()
            .map(|c| c.name.clone())
            .collect(),
        downloads: full.download_count.unwrap_or(0),
        follows: 0,
        icon_url: full.thumbnail_url.clone().unwrap_or_default(),
        client_side: String::new(),
        server_side: String::new(),
        project_type: project_type.to_string(),
        gallery: Vec::new(),
        issues_url: None,
        source_url: None,
        wiki_url: None,
        discord_url: None,
        license: None,
        date_created: full.last_modified.clone().unwrap_or_default(),
        date_modified: full.last_updated.clone().unwrap_or_default(),
    }
}

// ---------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------

fn mpi_headers() -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Accept", "application/json".parse().unwrap());
    headers
}

/// Build a full URL with query params. limit/offset/page handled per endpoint.
async fn mpi_get<T: serde::de::DeserializeOwned>(url: &str) -> Result<T, LauncherError> {
    let client = http_client::build_client();
    let resp = client
        .get(url)
        .headers(mpi_headers())
        .send()
        .await
        .map_err(|e| LauncherError::Other(format!("MPI request failed: {}", e)))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(LauncherError::Other(format!(
            "MPI returned {} for {}",
            status, url
        )));
    }
    let body = resp
        .text()
        .await
        .map_err(|e| LauncherError::Other(format!("MPI read failed: {}", e)))?;
    serde_json::from_str::<T>(&body).map_err(|e| {
        LauncherError::Other(format!(
            "MPI deserialize failed: {} — body preview: {}",
            e,
            &body[..body.len().min(300)]
        ))
    })
}

// ---------------------------------------------------------------
// Public API — Mods
// ---------------------------------------------------------------

pub async fn search_mods(
    query: &str,
    limit: u64,
    page: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let url = format!("{}/mods?name={}&limit={}&page={}", MPI_BASE, urlencoding::encode(query), limit, page);
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    let total = resp.meta.and_then(|m| m.total).unwrap_or(0);
    let results: Vec<ModResult> = resp
        .data
        .iter()
        .map(|s| map_short(s, "mod"))
        .collect();
    Ok((results, total))
}

pub async fn get_mod(mod_id: u64) -> Result<ModProjectFull, LauncherError> {
    get_mod_full(mod_id).await
}

pub async fn get_mod_full(mod_id: u64) -> Result<ModProjectFull, LauncherError> {
    let url = format!("{}/mod/{}", MPI_BASE, mod_id);
    let resp = mpi_get::<MpiResponse<MpiProjectFull>>(&url).await?;
    Ok(map_full(&resp.data, "mod"))
}

pub async fn get_mod_modpacks(
    mod_id: u64,
    limit: u64,
    page: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let url = format!(
        "{}/mod/{}/modpacks?limit={}&page={}",
        MPI_BASE, mod_id, limit, page
    );
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    let total = resp.meta.and_then(|m| m.total).unwrap_or(0);
    let results: Vec<ModResult> = resp
        .data
        .iter()
        .map(|s| map_short(s, "modpack"))
        .collect();
    Ok((results, total))
}

// ---------------------------------------------------------------
// Public API — Modpacks
// ---------------------------------------------------------------

pub async fn search_modpacks(
    query: &str,
    limit: u64,
    page: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let url = format!(
        "{}/modpacks?name={}&limit={}&page={}",
        MPI_BASE, urlencoding::encode(query), limit, page
    );
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    let total = resp.meta.and_then(|m| m.total).unwrap_or(0);
    let results: Vec<ModResult> = resp
        .data
        .iter()
        .map(|s| map_short(s, "modpack"))
        .collect();
    Ok((results, total))
}

pub async fn get_modpack_full(modpack_id: u64) -> Result<ModProjectFull, LauncherError> {
    let url = format!("{}/modpack/{}", MPI_BASE, modpack_id);
    let resp = mpi_get::<MpiResponse<MpiProjectFull>>(&url).await?;
    Ok(map_full(&resp.data, "modpack"))
}

pub async fn get_modpack_mods(modpack_id: u64) -> Result<Vec<ModResult>, LauncherError> {
    let url = format!("{}/modpack/{}/mods", MPI_BASE, modpack_id);
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    Ok(resp.data.iter().map(|s| map_short(s, "mod")).collect())
}

// ---------------------------------------------------------------
// Public API — Discovery (popular/featured)
// ---------------------------------------------------------------

/// Get popular mods (first page sorted by popularity_rank)
pub async fn get_popular_mods(limit: u64) -> Result<Vec<ModResult>, LauncherError> {
    let url = format!("{}/mods?limit={}&page=1", MPI_BASE, limit);
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    Ok(resp.data.iter().map(|s| map_short(s, "mod")).collect())
}

/// Get popular modpacks (first page)
pub async fn get_popular_modpacks(limit: u64) -> Result<Vec<ModResult>, LauncherError> {
    let url = format!("{}/modpacks?limit={}&page=1", MPI_BASE, limit);
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    Ok(resp.data.iter().map(|s| map_short(s, "modpack")).collect())
}

// ---------------------------------------------------------------
// Public API — Categories
// ---------------------------------------------------------------

pub async fn get_categories() -> Result<Vec<(u64, String, String)>, LauncherError> {
    let url = format!("{}/categories?limit=100&page=1", MPI_BASE);
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiCategory>>>(&url).await?;
    Ok(resp
        .data
        .iter()
        .map(|c| (c.id, c.name.clone(), c.slug.clone().unwrap_or_default()))
        .collect())
}

pub async fn get_category_mods(
    category_id: u64,
    limit: u64,
    page: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let url = format!(
        "{}/category/{}/mods?limit={}&page={}",
        MPI_BASE, category_id, limit, page
    );
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    let total = resp.meta.and_then(|m| m.total).unwrap_or(0);
    let results: Vec<ModResult> = resp.data.iter().map(|s| map_short(s, "mod")).collect();
    Ok((results, total))
}

pub async fn get_category_modpacks(
    category_id: u64,
    limit: u64,
    page: u64,
) -> Result<(Vec<ModResult>, u64), LauncherError> {
    let url = format!(
        "{}/category/{}/modpacks?limit={}&page={}",
        MPI_BASE, category_id, limit, page
    );
    let resp = mpi_get::<MpiSearchResponse<Vec<MpiProjectShort>>>(&url).await?;
    let total = resp.meta.and_then(|m| m.total).unwrap_or(0);
    let results: Vec<ModResult> = resp
        .data
        .iter()
        .map(|s| map_short(s, "modpack"))
        .collect();
    Ok((results, total))
}

// ---------------------------------------------------------------
// Public API — MC Versions
// ---------------------------------------------------------------

pub async fn get_minecraft_versions() -> Result<Vec<(u64, String)>, LauncherError> {
    let url = format!("{}/minecraft/versions", MPI_BASE);
    #[derive(Debug, Deserialize)]
    struct McVersionResp {
        data: Vec<MpiMcVersion>,
    }
    let resp = mpi_get::<McVersionResp>(&url).await?;
    Ok(resp.data.iter().map(|v| (v.id, v.name.clone())).collect())
}
