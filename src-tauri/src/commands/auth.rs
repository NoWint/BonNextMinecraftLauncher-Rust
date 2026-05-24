use crate::auth;
use crate::error::LauncherError;

fn normalize_file_path(path: &str) -> String {
    if path.starts_with("file://") {
        if let Ok(url) = url::Url::parse(path) {
            if let Ok(file_path) = url.to_file_path() {
                return file_path.to_string_lossy().to_string();
            }
        }
    }

    let decoded = urlencoding::decode(path)
        .unwrap_or_else(|_| path.into())
        .into_owned();

    if cfg!(target_os = "windows") {
        decoded
    } else {
        if !decoded.starts_with('/') && !decoded.starts_with('~') {
            format!("/{}", decoded)
        } else {
            decoded
        }
    }
}

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
        yggdrasil_client_token: None,
        yggdrasil_server_url: None,
        yggdrasil_selected_profile: None,
        local_skin_path: None,
        local_skin_model: None,
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
        yggdrasil_client_token: None,
        yggdrasil_server_url: None,
        yggdrasil_selected_profile: None,
        local_skin_path: None,
        local_skin_model: None,
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

#[tauri::command]
pub async fn yggdrasil_login(
    server_url: String,
    email: String,
    password: String,
) -> Result<crate::auth::yggdrasil::YggdrasilAuthResult, crate::error::LauncherError> {
    crate::security::sanitizer::sanitize_url(&server_url)?;
    crate::security::sanitizer::sanitize_general_string(&email)?;

    let result = crate::auth::yggdrasil::authenticate(&server_url, &email, &password).await?;

    if result.selected_profile.is_none() && result.available_profiles.is_empty() {
        return Err(crate::error::LauncherError::AuthFailed(
            "No game profile found on this account. Please create a character first.".to_string()
        ));
    }

    let result = if result.selected_profile.is_none() && !result.available_profiles.is_empty() {
        let profile = &result.available_profiles[0];
        crate::auth::yggdrasil::YggdrasilAuthResult {
            username: profile.name.clone(),
            uuid: profile.id.clone(),
            selected_profile: Some(profile.clone()),
            ..result
        }
    } else {
        result
    };

    let account = crate::auth::token_store::StoredAccount {
        id: result.uuid.clone(),
        username: result.username.clone(),
        uuid: result.uuid.clone(),
        access_token: result.access_token.clone(),
        refresh_token: None,
        account_type: "yggdrasil".to_string(),
        last_used: chrono::Utc::now().to_rfc3339(),
        expires_at: Some((chrono::Utc::now() + chrono::Duration::hours(24)).to_rfc3339()),
        avatar_url: None,
        yggdrasil_client_token: Some(result.client_token.clone()),
        yggdrasil_server_url: Some(result.server_url.clone()),
        yggdrasil_selected_profile: result.selected_profile.as_ref().map(|p| p.id.clone()),
        local_skin_path: None,
        local_skin_model: None,
    };

    let mut store = crate::auth::token_store::AccountStore::load()?;
    store.upsert_account(account)?;
    store.set_active(&result.uuid)?;

    crate::security::audit::record_login("yggdrasil", true, &result.username)?;

    Ok(result)
}

#[tauri::command]
pub async fn yggdrasil_refresh_token() -> Result<(), crate::error::LauncherError> {
    crate::auth::token_store::ensure_fresh_token().await?;
    Ok(())
}

#[tauri::command]
pub async fn yggdrasil_get_profile(
    uuid: String,
    server_url: String,
    access_token: String,
) -> Result<crate::auth::yggdrasil::YggdrasilSkinProfile, crate::error::LauncherError> {
    crate::security::sanitizer::sanitize_url(&server_url)?;
    crate::auth::yggdrasil::get_skin_profile(&server_url, &uuid, &access_token).await
}

#[tauri::command]
pub async fn yggdrasil_upload_skin(
    uuid: String,
    server_url: String,
    access_token: String,
    file_path: String,
    model: String,
) -> Result<(), crate::error::LauncherError> {
    crate::security::sanitizer::sanitize_url(&server_url)?;
    let normalized = normalize_file_path(&file_path);
    crate::security::sanitizer::sanitize_path(&normalized)?;
    crate::auth::yggdrasil::upload_skin(&server_url, &uuid, &access_token, &normalized, &model).await
}

#[tauri::command]
pub async fn yggdrasil_reset_skin(
    uuid: String,
    server_url: String,
    access_token: String,
) -> Result<(), crate::error::LauncherError> {
    crate::security::sanitizer::sanitize_url(&server_url)?;
    crate::auth::yggdrasil::reset_skin(&server_url, &uuid, &access_token).await
}

#[tauri::command]
pub async fn yggdrasil_select_profile(
    account_id: String,
    profile_id: String,
) -> Result<(), crate::error::LauncherError> {
    crate::security::sanitizer::sanitize_id(&account_id)?;
    crate::security::sanitizer::sanitize_id(&profile_id)?;
    let mut store = crate::auth::token_store::AccountStore::load()?;
    if let Some(acct) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        acct.yggdrasil_selected_profile = Some(profile_id);
        store.save()?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_yggdrasil_presets() -> Result<Vec<(String, String)>, crate::error::LauncherError> {
    Ok(crate::auth::yggdrasil::get_presets())
}

#[tauri::command]
pub async fn ensure_authlib_injector() -> Result<String, crate::error::LauncherError> {
    let jar_path = crate::platform::paths::get_game_dir().join("shared").join("authlib-injector.jar");
    if jar_path.exists() {
        let metadata = std::fs::metadata(&jar_path)?;
        if metadata.len() > 0 {
            return Ok(jar_path.to_string_lossy().to_string());
        }
    }
    let url = "https://authlib-injector.yushi.moe/artifact/latest/authlib-injector.jar";
    let client = crate::http_client::build_download_client();
    let resp = client.get(url).send().await?.error_for_status()?;
    let bytes = resp.bytes().await?;
    if let Some(parent) = jar_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&jar_path, &bytes)?;
    let _ = crate::security::audit::log_audit(
        crate::security::audit::AuditLevel::Info,
        crate::security::audit::AuditCategory::Download,
        "Downloaded authlib-injector.jar",
        None,
    );
    Ok(jar_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_local_skin(
    account_id: String,
    skin_path: Option<String>,
    skin_model: Option<String>,
) -> Result<(), crate::error::LauncherError> {
    crate::security::sanitizer::sanitize_id(&account_id)?;
    let normalized_path = skin_path.map(|p| normalize_file_path(&p));
    if let Some(ref p) = normalized_path {
        crate::security::sanitizer::sanitize_path(p)?;
        let path = std::path::Path::new(p);
        if !path.exists() {
            return Err(crate::error::LauncherError::Other(format!(
                "Skin file not found at: {}", p
            )));
        }
    }
    let mut store = crate::auth::token_store::AccountStore::load().map_err(|e| {
        crate::error::LauncherError::Other(format!("Failed to load account store: {}", e))
    })?;
    if let Some(acct) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        acct.local_skin_path = normalized_path;
        acct.local_skin_model = skin_model;
        store.save().map_err(|e| {
            crate::error::LauncherError::Other(format!("Failed to save account store: {}", e))
        })?;
    }
    Ok(())
}

#[tauri::command]
pub async fn read_skin_file(
    file_path: String,
) -> Result<String, crate::error::LauncherError> {
    let normalized = normalize_file_path(&file_path);
    crate::security::sanitizer::sanitize_path(&normalized)?;

    let path = std::path::Path::new(&normalized);
    if !path.exists() {
        let tried = vec![file_path.clone(), normalized.clone()];
        let cwd = std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        return Err(crate::error::LauncherError::Other(format!(
            "Skin file not found. Tried: {:?} (cwd: {})", tried, cwd
        )));
    }

    let bytes = std::fs::read(&normalized).map_err(|e| {
        crate::error::LauncherError::Other(format!("Failed to read skin file '{}': {}", normalized, e))
    })?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    ))
}
