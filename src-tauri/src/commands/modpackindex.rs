use crate::cache;
use crate::error::LauncherError;
use crate::modpackindex;
use crate::modrinth;

#[tauri::command]
pub async fn search_mpi_mods(
    cache: tauri::State<'_, cache::ApiCache>,
    query: String,
    limit: Option<u64>,
    page: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    let l = limit.unwrap_or(20);
    let p = page.unwrap_or(1);
    let cache_key = format!("mpi_mods:{}:{}:{}", query, l, p);

    if let Some(cached) = cache.get_cf_search(&cache_key) {
        return Ok(cached);
    }

    let result = modpackindex::search_mods(&query, l, p).await?;
    cache.cache_cf_search(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
pub async fn search_mpi_modpacks(
    cache: tauri::State<'_, cache::ApiCache>,
    query: String,
    limit: Option<u64>,
    page: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    let l = limit.unwrap_or(20);
    let p = page.unwrap_or(1);
    let cache_key = format!("mpi_modpacks:{}:{}:{}", query, l, p);

    if let Some(cached) = cache.get_cf_search(&cache_key) {
        return Ok(cached);
    }

    let result = modpackindex::search_modpacks(&query, l, p).await?;
    cache.cache_cf_search(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
pub async fn get_mpi_mod(
    cache: tauri::State<'_, cache::ApiCache>,
    mod_id: u64,
) -> Result<modrinth::ModProjectFull, LauncherError> {
    let cache_key = format!("mpi_mod:{}", mod_id);
    if let Some(cached) = cache.get_cf_project(&cache_key) {
        return Ok(cached);
    }
    let result = modpackindex::get_mod_full(mod_id).await?;
    cache.cache_cf_project(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
pub async fn get_mpi_modpack(
    cache: tauri::State<'_, cache::ApiCache>,
    modpack_id: u64,
) -> Result<modrinth::ModProjectFull, LauncherError> {
    let cache_key = format!("mpi_modpack:{}", modpack_id);
    if let Some(cached) = cache.get_cf_project(&cache_key) {
        return Ok(cached);
    }
    let result = modpackindex::get_modpack_full(modpack_id).await?;
    cache.cache_cf_project(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
pub async fn get_mpi_mod_modpacks(
    mod_id: u64,
    limit: Option<u64>,
    page: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    let l = limit.unwrap_or(20);
    let p = page.unwrap_or(1);
    modpackindex::get_mod_modpacks(mod_id, l, p).await
}

#[tauri::command]
pub async fn get_mpi_modpack_mods(
    modpack_id: u64,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    modpackindex::get_modpack_mods(modpack_id).await
}

#[tauri::command]
pub async fn get_mpi_popular_mods(limit: Option<u64>) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    let l = limit.unwrap_or(20);
    modpackindex::get_popular_mods(l).await
}

#[tauri::command]
pub async fn get_mpi_popular_modpacks(
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    let l = limit.unwrap_or(20);
    modpackindex::get_popular_modpacks(l).await
}

#[tauri::command]
pub async fn get_mpi_categories() -> Result<Vec<(u64, String, String)>, LauncherError> {
    modpackindex::get_categories().await
}

#[tauri::command]
pub async fn get_mpi_category_mods(
    category_id: u64,
    limit: Option<u64>,
    page: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    let l = limit.unwrap_or(20);
    let p = page.unwrap_or(1);
    modpackindex::get_category_mods(category_id, l, p).await
}
