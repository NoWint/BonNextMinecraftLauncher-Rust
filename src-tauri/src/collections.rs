#![allow(dead_code)]
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

static COLLECTION_LOCK: parking_lot::Mutex<()> = parking_lot::Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionItem {
    pub slug: String,
    pub title: String,
    pub author: String,
    pub icon_url: String,
    pub content_type: String,
    pub description: String,
    pub downloads: u64,
    pub categories: Vec<String>,
    pub added_at: String,
}

type CollectionMap = HashMap<String, CollectionItem>;

fn get_collections_path() -> PathBuf {
    crate::platform::paths::get_game_dir().join("collections.json")
}

fn load() -> Result<CollectionMap, LauncherError> {
    let path = get_collections_path();
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&data).unwrap_or_default())
}

fn save(map: &CollectionMap) -> Result<(), LauncherError> {
    let path = get_collections_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(map)?;
    std::fs::write(&path, data)?;
    Ok(())
}

pub fn add_item(
    slug: &str,
    title: &str,
    author: &str,
    icon_url: &str,
    content_type: &str,
    description: &str,
    downloads: u64,
    categories: Vec<String>,
) -> Result<(), LauncherError> {
    let _lock = COLLECTION_LOCK.lock();
    let mut map = load()?;
    map.insert(
        slug.to_string(),
        CollectionItem {
            slug: slug.to_string(),
            title: title.to_string(),
            author: author.to_string(),
            icon_url: icon_url.to_string(),
            content_type: content_type.to_string(),
            description: description.to_string(),
            downloads,
            categories,
            added_at: chrono::Utc::now().to_rfc3339(),
        },
    );
    save(&map)
}

pub fn remove_item(slug: &str) -> Result<(), LauncherError> {
    let _lock = COLLECTION_LOCK.lock();
    let mut map = load()?;
    map.remove(slug);
    save(&map)
}

pub fn is_saved(slug: &str) -> Result<bool, LauncherError> {
    let _lock = COLLECTION_LOCK.lock();
    let map = load()?;
    Ok(map.contains_key(slug))
}

pub fn list_all() -> Result<Vec<CollectionItem>, LauncherError> {
    let _lock = COLLECTION_LOCK.lock();
    let map = load()?;
    let mut items: Vec<_> = map.into_values().collect();
    items.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    Ok(items)
}
