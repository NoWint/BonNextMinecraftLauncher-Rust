use crate::error::LauncherError;
use crate::http_client;
use base64::Engine;
use serde::{Deserialize, Serialize};

const AUTHENTICATE_PATH: &str = "/authserver/authenticate";
const REFRESH_PATH: &str = "/authserver/refresh";
const VALIDATE_PATH: &str = "/authserver/validate";
const SIGNOUT_PATH: &str = "/authserver/signout";
const PROFILE_PATH: &str = "/sessionserver/session/minecraft/profile";
const SKIN_PATH: &str = "/user/profile";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilProfile {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilAuthResult {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub client_token: String,
    pub server_url: String,
    pub available_profiles: Vec<YggdrasilProfile>,
    pub selected_profile: Option<YggdrasilProfile>,
}

#[derive(Debug, Deserialize)]
struct AuthResponse {
    access_token: String,
    client_token: String,
    available_profiles: Option<Vec<YggdrasilProfile>>,
    selected_profile: Option<YggdrasilProfile>,
}

#[derive(Debug, Deserialize)]
struct RefreshResponse {
    access_token: String,
    client_token: String,
    selected_profile: Option<YggdrasilProfile>,
}

#[derive(Debug, Serialize)]
struct AuthRequest {
    username: String,
    password: String,
    request_user: bool,
    agent: Agent,
}

#[derive(Debug, Serialize)]
struct Agent {
    name: String,
    version: u32,
}

#[derive(Debug, Serialize)]
struct RefreshRequest {
    access_token: String,
    client_token: String,
    request_user: bool,
}

#[derive(Debug, Serialize)]
struct ValidateRequest {
    access_token: String,
    client_token: String,
}

#[derive(Debug, Serialize)]
struct SignoutRequest {
    username: String,
    password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinTextureInfo {
    pub url: Option<String>,
    pub metadata: Option<SkinMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinMetadata {
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TexturesValue {
    pub timestamp: i64,
    pub profile_id: String,
    pub profile_name: String,
    pub textures: TexturesMap,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TexturesMap {
    #[serde(rename = "SKIN")]
    pub skin: Option<SkinTextureInfo>,
    #[serde(rename = "CAPE")]
    pub cape: Option<SkinTextureInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileProperty {
    pub name: String,
    pub value: String,
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilSkinProfile {
    pub id: String,
    pub name: String,
    pub properties: Vec<ProfileProperty>,
}

#[derive(Debug, Deserialize)]
struct YggdrasilError {
    error: String,
    #[serde(default)]
    error_message: String,
}

fn translate_yggdrasil_error(error: &str, message: &str) -> String {
    if !message.is_empty() {
        return message.to_string();
    }
    match error {
        "ForbiddenOperationException" => "Invalid email or password".to_string(),
        "IllegalArgumentException" => "Invalid request parameters".to_string(),
        "RateLimitedException" => "Too many login attempts, please try again later".to_string(),
        "ResourceNotFoundException" => "Authentication server not found, please check the URL".to_string(),
        _ => format!("Login failed: {}", error),
    }
}

pub async fn authenticate(
    server_url: &str,
    email: &str,
    password: &str,
) -> Result<YggdrasilAuthResult, LauncherError> {
    let url = format!("{}{}", server_url.trim_end_matches('/'), AUTHENTICATE_PATH);
    let client = http_client::build_client();
    let req = AuthRequest {
        username: email.to_string(),
        password: password.to_string(),
        request_user: true,
        agent: Agent {
            name: "Minecraft".to_string(),
            version: 1,
        },
    };
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        if let Ok(yg_err) = serde_json::from_str::<YggdrasilError>(&body) {
            return Err(LauncherError::AuthFailed(translate_yggdrasil_error(&yg_err.error, &yg_err.error_message)));
        }
        if body.contains("ForbiddenOperationException") {
            return Err(LauncherError::AuthFailed("Invalid email or password".to_string()));
        }
        return Err(LauncherError::AuthFailed(format!("Server returned {} error", status)));
    }

    let resp: AuthResponse = resp.json().await?;

    let selected = resp.selected_profile.clone();
    let (username, uuid) = match &selected {
        Some(p) => (p.name.clone(), p.id.clone()),
        None => (String::new(), String::new()),
    };

    Ok(YggdrasilAuthResult {
        username,
        uuid,
        access_token: resp.access_token,
        client_token: resp.client_token,
        server_url: server_url.to_string(),
        available_profiles: resp.available_profiles.unwrap_or_default(),
        selected_profile: selected,
    })
}

pub async fn refresh_token(
    server_url: &str,
    access_token: &str,
    client_token: &str,
) -> Result<(String, String, Option<YggdrasilProfile>), LauncherError> {
    let url = format!("{}{}", server_url.trim_end_matches('/'), REFRESH_PATH);
    let client = http_client::build_client();
    let req = RefreshRequest {
        access_token: access_token.to_string(),
        client_token: client_token.to_string(),
        request_user: true,
    };
    let resp: RefreshResponse = client
        .post(&url)
        .json(&req)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok((resp.access_token, resp.client_token, resp.selected_profile))
}

pub async fn validate_token(
    server_url: &str,
    access_token: &str,
    client_token: &str,
) -> Result<bool, LauncherError> {
    let url = format!("{}{}", server_url.trim_end_matches('/'), VALIDATE_PATH);
    let client = http_client::build_client();
    let req = ValidateRequest {
        access_token: access_token.to_string(),
        client_token: client_token.to_string(),
    };
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await?;
    Ok(resp.status().is_success())
}

pub async fn get_skin_profile(
    server_url: &str,
    uuid: &str,
    access_token: &str,
) -> Result<YggdrasilSkinProfile, LauncherError> {
    let url = format!(
        "{}{}/{}?unsigned=false",
        server_url.trim_end_matches('/'),
        PROFILE_PATH,
        uuid
    );
    let client = http_client::build_client();
    let resp: YggdrasilSkinProfile = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(resp)
}

pub fn decode_textures_value(value: &str) -> Result<TexturesValue, LauncherError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(value)
        .map_err(|e| LauncherError::Other(format!("Invalid base64 in textures: {}", e)))?;
    let textures: TexturesValue = serde_json::from_slice(&bytes)?;
    Ok(textures)
}

pub async fn upload_skin(
    server_url: &str,
    uuid: &str,
    access_token: &str,
    file_path: &str,
    model: &str,
) -> Result<(), LauncherError> {
    let url = format!(
        "{}{}/{}/skin",
        server_url.trim_end_matches('/'),
        SKIN_PATH,
        uuid
    );
    let client = http_client::build_client();
    let file_bytes = std::fs::read(file_path)?;
    let file_name = std::path::Path::new(file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "skin.png".to_string());

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("image/png")
        .map_err(|e| LauncherError::Other(format!("MIME error: {}", e)))?;

    let form = reqwest::multipart::Form::new()
        .text("model", model.to_string())
        .part("file", part);

    client
        .put(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

pub async fn reset_skin(
    server_url: &str,
    uuid: &str,
    access_token: &str,
) -> Result<(), LauncherError> {
    let url = format!(
        "{}{}/{}/skin",
        server_url.trim_end_matches('/'),
        SKIN_PATH,
        uuid
    );
    let client = http_client::build_client();
    client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

pub fn get_presets() -> Vec<(String, String)> {
    vec![
        ("LittleSkin".to_string(), "https://littleskin.cn/api/yggdrasil".to_string()),
        ("Blessing Studio".to_string(), "https://bsgchina.cn/api/yggdrasil".to_string()),
        ("自定义".to_string(), String::new()),
    ]
}
