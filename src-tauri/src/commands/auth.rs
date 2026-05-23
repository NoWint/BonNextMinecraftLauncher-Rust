use crate::auth;
use crate::error::LauncherError;

#[tauri::command]
pub async fn offline_login(username: String) -> Result<serde_json::Value, LauncherError> {
    let result = auth::offline::offline_login(&username)?;
    let mut store = auth::token_store::AccountStore::load()?;
    let now = chrono::Utc::now().to_rfc3339();
    let account = auth::token_store::StoredAccount {
        id: result.uuid.clone(),
        username: result.username.clone(),
        uuid: result.uuid.clone(),
        access_token: result.access_token.clone(),
        refresh_token: None,
        account_type: "offline".to_string(),
        last_used: now,
        expires_at: None,
        avatar_url: None,
    };
    store.upsert_account(account)?;
    store.set_active(&result.uuid)?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
pub async fn start_microsoft_auth() -> Result<serde_json::Value, LauncherError> {
    let result = auth::microsoft::start_device_auth().await?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
pub async fn poll_microsoft_auth(device_code: String) -> Result<serde_json::Value, LauncherError> {
    let result = auth::microsoft::poll_device_auth(&device_code).await?;
    let mut store = auth::token_store::AccountStore::load()?;
    let now = chrono::Utc::now().to_rfc3339();
    let account = auth::token_store::StoredAccount {
        id: result.uuid.clone(),
        username: result.username.clone(),
        uuid: result.uuid.clone(),
        access_token: result.access_token.clone(),
        refresh_token: Some(result.refresh_token.clone()),
        account_type: "microsoft".to_string(),
        last_used: now,
        expires_at: Some((chrono::Utc::now() + chrono::Duration::try_minutes(50).unwrap()).to_rfc3339()),
        avatar_url: None,
    };
    store.upsert_account(account)?;
    store.set_active(&result.uuid)?;
    Ok(serde_json::to_value(result)?)
}

#[tauri::command]
pub async fn list_accounts() -> Result<Vec<auth::token_store::StoredAccount>, LauncherError> {
    let store = auth::token_store::AccountStore::load()?;
    Ok(store.accounts)
}

#[tauri::command]
pub async fn get_active_account() -> Result<Option<auth::token_store::StoredAccount>, LauncherError> {
    let store = auth::token_store::AccountStore::load()?;
    Ok(store.get_active().cloned())
}

#[tauri::command]
pub async fn set_active_account(id: String) -> Result<(), LauncherError> {
    let mut store = auth::token_store::AccountStore::load()?;
    store.set_active(&id)
}

#[tauri::command]
pub async fn remove_account(id: String) -> Result<(), LauncherError> {
    let mut store = auth::token_store::AccountStore::load()?;
    store.remove_account(&id)
}

#[tauri::command]
pub async fn refresh_auth_token() -> Result<Option<String>, LauncherError> {
    auth::token_store::ensure_fresh_token().await
}
