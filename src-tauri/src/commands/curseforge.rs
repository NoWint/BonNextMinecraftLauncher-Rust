use crate::content;
use crate::curseforge;
use crate::error::LauncherError;
use crate::modrinth;

#[tauri::command]
pub async fn search_cf_mods(
    query: String,
    game_version: Option<String>,
    category: Option<String>,
    sort: Option<String>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    curseforge::search_mods(
        &query,
        game_version.as_deref(),
        category.as_deref(),
        sort.as_deref(),
        limit.unwrap_or(20),
        offset.unwrap_or(0),
    ).await
}

#[tauri::command]
pub async fn get_cf_mod(mod_id: u64) -> Result<modrinth::ModResult, LauncherError> {
    curseforge::get_mod(mod_id).await
}

#[tauri::command]
pub async fn get_cf_project_details(mod_id: u64) -> Result<modrinth::ModProjectFull, LauncherError> {
    curseforge::get_mod_full(mod_id).await
}

#[tauri::command]
pub async fn get_cf_mod_versions(mod_id: u64) -> Result<Vec<modrinth::ModVersion>, LauncherError> {
    curseforge::get_mod_versions(mod_id).await
}

#[tauri::command]
pub async fn get_cf_featured() -> Result<Vec<modrinth::ModResult>, LauncherError> {
    curseforge::get_featured().await
}

#[tauri::command]
pub async fn get_cf_mod_files(mod_id: u64) -> Result<Vec<modrinth::ModFile>, LauncherError> {
    curseforge::get_mod_files(mod_id).await
}

#[tauri::command]
pub async fn download_cf_mod(
    app: tauri::AppHandle,
    file_url: String,
    filename: String,
    instance_id: String,
    content_type: Option<String>,
    sha1: Option<String>,
    slug: Option<String>,
    version_id: Option<String>,
) -> Result<String, LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let result = curseforge::download_mod_file(&file_url, &filename, &instance_id, Some(ct), sha1.as_deref()).await?;

    if let Some(ref s) = slug {
        if let Err(e) = content::record_install(&instance_id, &filename, s, version_id.as_deref(), ct, "curseforge") {
            tracing::warn!("Failed to record install metadata: {}", e);
        }
    }

    if ct == "mod" {
        let mods_dir = crate::platform::paths::get_instance_mods_dir(&instance_id);
        let mod_count = if mods_dir.exists() {
            std::fs::read_dir(&mods_dir)
                .map(|d| d.filter_map(|e| e.ok()).filter(|e| {
                    e.path().extension().map(|ext| ext == "jar").unwrap_or(false)
                }).count())
                .unwrap_or(0)
        } else {
            0
        };
        if mod_count >= 10 {
            crate::commands::achievement::try_unlock_achievement(&app, "install_10_mods");
        }
    }

    Ok(result)
}
