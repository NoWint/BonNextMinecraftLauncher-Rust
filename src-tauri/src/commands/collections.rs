use crate::collections;
use crate::error::LauncherError;

#[tauri::command]
pub async fn add_to_collection(
    slug: String, title: String, author: String, icon_url: String,
    content_type: String, description: String, downloads: u64,
    categories: Vec<String>,
) -> Result<(), LauncherError> {
    collections::add_item(&slug, &title, &author, &icon_url, &content_type, &description, downloads, categories)
}

#[tauri::command]
pub async fn remove_from_collection(slug: String) -> Result<(), LauncherError> {
    collections::remove_item(&slug)
}

#[tauri::command]
pub async fn is_in_collection(slug: String) -> Result<bool, LauncherError> {
    collections::is_saved(&slug)
}

#[tauri::command]
pub async fn list_collection() -> Result<Vec<collections::CollectionItem>, LauncherError> {
    collections::list_all()
}
