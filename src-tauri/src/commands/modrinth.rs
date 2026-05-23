use crate::content;
use crate::error::LauncherError;
use crate::modrinth;

#[tauri::command]
pub async fn search_mods(
    query: String,
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    modrinth::search_mods(
        &query,
        game_version.as_deref(),
        loader.as_deref(),
        limit.unwrap_or(20),
        offset.unwrap_or(0),
    ).await
}

#[tauri::command]
pub async fn get_popular_mods(
    game_version: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    modrinth::get_popular_mods(
        game_version.as_deref(),
        limit.unwrap_or(20),
    ).await
}

#[tauri::command]
pub async fn get_mod_details(slug: String) -> Result<modrinth::ModResult, LauncherError> {
    modrinth::get_mod(&slug).await
}

#[tauri::command]
pub async fn get_mod_versions(
    slug: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> Result<Vec<modrinth::ModVersion>, LauncherError> {
    modrinth::get_mod_versions(
        &slug,
        game_version.as_deref(),
        loader.as_deref(),
    ).await
}

#[tauri::command]
pub async fn install_mod(
    file_url: String,
    filename: String,
    instance_id: String,
    sha1: Option<String>,
) -> Result<String, LauncherError> {
    modrinth::download_mod_file(&file_url, &filename, &instance_id, sha1.as_deref()).await
}

#[tauri::command]
pub async fn get_version_by_id(version_id: String) -> Result<modrinth::ModVersion, LauncherError> {
    modrinth::get_version_by_id(&version_id).await
}

#[tauri::command]
pub async fn install_content(
    file_url: String,
    filename: String,
    instance_id: String,
    content_type: Option<String>,
    sha1: Option<String>,
    slug: Option<String>,
    version_id: Option<String>,
    source: Option<String>,
) -> Result<String, LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let src = source.as_deref().unwrap_or("modrinth");
    let result = modrinth::download_content_file(&file_url, &filename, &instance_id, ct, sha1.as_deref()).await?;

    if let Some(ref s) = slug {
        if let Err(e) = content::record_install(&instance_id, &filename, s, version_id.as_deref(), ct, src) {
            tracing::warn!("Failed to record install metadata: {}", e);
        }
    }

    Ok(result)
}
