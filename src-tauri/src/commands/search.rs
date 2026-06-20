use crate::cache;
use crate::error::LauncherError;
use crate::modrinth;

#[tauri::command]
pub async fn search_content(
    cache: tauri::State<'_, cache::ApiCache>,
    query: String,
    content_type: Option<String>,
    game_version: Option<String>,
    loader: Option<String>,
    sort: Option<String>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> Result<(Vec<modrinth::ModResult>, u64), LauncherError> {
    let ct = content_type.as_deref().unwrap_or("mod");
    let l = limit.unwrap_or(20);
    let o = offset.unwrap_or(0);
    let sv = sort.as_deref();

    let cache_key = format!("search:{}:{}:{:?}:{:?}:{:?}:{}:{}",
        query, ct, game_version, loader, sv, l, o);

    if let Some(cached) = cache.get_search_results(&cache_key) {
        tracing::debug!("Cache hit: search_content");
        return Ok(cached);
    }

    let mr_query = query.clone();
    let mr_ct = ct.to_string();
    let mr_gv = game_version.clone();
    let mr_loader = loader.clone();
    let mr_sort = sort.clone();
    let mr_limit = l;
    let mr_offset = o;

    let cf_query = query.clone();
    let cf_gv = game_version.clone();
    let cf_sort = sort.clone();
    let cf_limit = l;

    let mr_fut = async {
        modrinth::search_with_facets(
            &mr_query, &mr_ct,
            mr_gv.as_deref(),
            mr_loader.as_deref(),
            mr_sort.as_deref(),
            mr_limit, mr_offset,
        ).await
    };

    let cf_fut = async {
        crate::curseforge::search_mods(
            &cf_query,
            cf_gv.as_deref(),
            None,
            cf_sort.as_deref(),
            cf_limit, 0,
        ).await
    };

    let (mr_result, cf_result) = tokio::join!(mr_fut, cf_fut);

    let mut all_results = Vec::new();
    let mut total = 0u64;

    if let Ok((items, count)) = mr_result {
        total += count;
        all_results.extend(items);
    }
    if let Ok((items, count)) = cf_result {
        total += count;
        all_results.extend(items);
    }

    all_results.sort_by(|a, b| b.downloads.cmp(&a.downloads));
    all_results.truncate(l as usize);

    let result = (all_results, total);
    cache.cache_search_results(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
pub async fn get_project_details(
    cache: tauri::State<'_, cache::ApiCache>,
    slug: String,
) -> Result<modrinth::ModProjectFull, LauncherError> {
    if let Some(cached) = cache.get_project(&slug) {
        tracing::debug!("Cache hit: get_project_details {}", slug);
        return Ok(cached);
    }

    let result = modrinth::get_project_full(&slug).await?;
    cache.cache_project(&slug, &result);
    Ok(result)
}

#[tauri::command]
pub async fn get_trending_content(
    cache: tauri::State<'_, cache::ApiCache>,
    project_type: Option<String>,
    game_version: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    let pt = project_type.as_deref().unwrap_or("mod");
    let l = limit.unwrap_or(20);

    let cache_key = format!("popular:{}:{:?}:{}", pt, game_version, l);
    if let Some(cached) = cache.get_popular(&cache_key) {
        tracing::debug!("Cache hit: get_trending_content");
        return Ok(cached);
    }

    let result = modrinth::get_popular_by_type(pt, game_version.as_deref(), l).await?;
    cache.cache_popular(&cache_key, &result);
    Ok(result)
}

#[tauri::command]
pub async fn get_recently_updated(
    cache: tauri::State<'_, cache::ApiCache>,
    project_type: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<modrinth::ModResult>, LauncherError> {
    let l = limit.unwrap_or(20);
    let cache_key = format!("recent:{:?}:{}", project_type, l);

    if let Some(cached) = cache.get_popular(&cache_key) {
        tracing::debug!("Cache hit: get_recently_updated");
        return Ok(cached);
    }

    let result = modrinth::get_recently_updated(project_type.as_deref(), l).await?;
    cache.cache_popular(&cache_key, &result);
    Ok(result)
}
