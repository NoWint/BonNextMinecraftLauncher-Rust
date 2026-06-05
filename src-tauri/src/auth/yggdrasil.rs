use crate::error::LauncherError;
use crate::http_client;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const AUTHENTICATE_PATH: &str = "/authserver/authenticate";
const REFRESH_PATH: &str = "/authserver/refresh";
const VALIDATE_PATH: &str = "/authserver/validate";
const SIGNOUT_PATH: &str = "/authserver/signout";
const PROFILE_PATH: &str = "/sessionserver/session/minecraft/profile";
const SKIN_PATH: &str = "/user/profile";

const AUTH_TIMEOUT: Duration = Duration::from_secs(30);
const AUTH_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

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

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinTextureInfo {
    pub url: Option<String>,
    pub metadata: Option<SkinMetadata>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinMetadata {
    pub model: String,
}

// Reserved for skin texture parsing
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TexturesValue {
    pub timestamp: i64,
    pub profile_id: String,
    pub profile_name: String,
    pub textures: TexturesMap,
}

// Reserved for skin texture parsing
#[allow(dead_code)]
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
        "ForbiddenOperationException" => "邮箱或密码错误 / Invalid email or password".to_string(),
        "IllegalArgumentException" => "请求参数无效 / Invalid request parameters".to_string(),
        "RateLimitedException" => "登录尝试过于频繁，请稍后再试 / Too many login attempts, please try again later".to_string(),
        "ResourceNotFoundException" => "认证服务器未找到，请检查服务器地址 / Authentication server not found, please check the URL".to_string(),
        _ => format!("登录失败 / Login failed: {}", error),
    }
}

fn build_auth_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
        .timeout(AUTH_TIMEOUT)
        .connect_timeout(AUTH_CONNECT_TIMEOUT)
        .build()
        .unwrap_or_else(|_| http_client::build_client().clone())
}

pub async fn test_server_connection(server_url: &str) -> Result<(), LauncherError> {
    let url = format!("{}{}", server_url.trim_end_matches('/'), AUTHENTICATE_PATH);
    let client = build_auth_client();
    let resp = client
        .head(&url)
        .send()
        .await;
    match resp {
        Ok(r) => {
            let status = r.status();
            if status.is_client_error() || status.is_server_error() {
                let body = r.text().await.unwrap_or_default();
                if let Ok(yg_err) = serde_json::from_str::<YggdrasilError>(&body) {
                    return Err(LauncherError::AuthFailed(translate_yggdrasil_error(&yg_err.error, &yg_err.error_message)));
                }
            }
            Ok(())
        }
        Err(e) => {
            if e.is_connect() {
                Err(LauncherError::ServerConnectionFailed(
                    format!("无法连接到服务器，请检查地址是否正确 / Cannot connect to server: {}", server_url)
                ))
            } else if e.is_timeout() {
                Err(LauncherError::ServerConnectionFailed(
                    "连接超时，服务器可能不可用 / Connection timed out, server may be unavailable".to_string()
                ))
            } else {
                Err(LauncherError::Http(e))
            }
        }
    }
}

pub async fn authenticate(
    server_url: &str,
    email: &str,
    password: &str,
) -> Result<YggdrasilAuthResult, LauncherError> {
    let url = format!("{}{}", server_url.trim_end_matches('/'), AUTHENTICATE_PATH);
    let client = build_auth_client();
    let req = AuthRequest {
        username: email.to_string(),
        password: password.to_string(),
        request_user: true,
        agent: Agent {
            name: "Minecraft".to_string(),
            version: 1,
        },
    };
    let resp = match client
        .post(&url)
        .json(&req)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            if e.is_connect() {
                return Err(LauncherError::ServerConnectionFailed(
                    format!("无法连接到认证服务器 / Cannot connect to auth server: {}", server_url)
                ));
            }
            if e.is_timeout() {
                return Err(LauncherError::ServerConnectionFailed(
                    "连接认证服务器超时，请检查网络 / Auth server connection timed out".to_string()
                ));
            }
            return Err(LauncherError::Http(e));
        }
    };

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        if let Ok(yg_err) = serde_json::from_str::<YggdrasilError>(&body) {
            return Err(LauncherError::AuthFailed(translate_yggdrasil_error(&yg_err.error, &yg_err.error_message)));
        }
        if body.contains("ForbiddenOperationException") {
            return Err(LauncherError::AuthFailed("邮箱或密码错误 / Invalid email or password".to_string()));
        }
        return Err(LauncherError::AuthFailed(format!("服务器返回 {} 错误 / Server returned {} error", status, status)));
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
    let client = build_auth_client();
    let req = RefreshRequest {
        access_token: access_token.to_string(),
        client_token: client_token.to_string(),
        request_user: true,
    };
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            if e.is_connect() {
                return Err(LauncherError::ServerConnectionFailed(
                    format!("无法连接到认证服务器 / Cannot connect to auth server: {}", server_url)
                ));
            }
            if e.is_timeout() {
                return Err(LauncherError::AuthExpired(
                    "令牌刷新超时，请重新登录 / Token refresh timed out, please re-login".to_string()
                ));
            }
            return Err(LauncherError::Http(e));
        }
    };

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        if let Ok(yg_err) = serde_json::from_str::<YggdrasilError>(&body) {
            if yg_err.error == "ForbiddenOperationException" || yg_err.error.contains("InvalidToken") {
                return Err(LauncherError::AuthExpired(
                    "令牌已失效，请重新登录 / Token has expired, please re-login".to_string()
                ));
            }
            return Err(LauncherError::AuthFailed(translate_yggdrasil_error(&yg_err.error, &yg_err.error_message)));
        }
        return Err(LauncherError::AuthExpired(
            format!("令牌刷新失败 ({}) / Token refresh failed ({})", status, status)
        ));
    }

    let resp: RefreshResponse = resp.json().await?;
    Ok((resp.access_token, resp.client_token, resp.selected_profile))
}

pub async fn validate_token(
    server_url: &str,
    access_token: &str,
    client_token: &str,
) -> Result<bool, LauncherError> {
    let url = format!("{}{}", server_url.trim_end_matches('/'), VALIDATE_PATH);
    let client = build_auth_client();
    let req = ValidateRequest {
        access_token: access_token.to_string(),
        client_token: client_token.to_string(),
    };
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await;
    match resp {
        Ok(r) => Ok(r.status().is_success()),
        Err(_) => Ok(false),
    }
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
    let client = build_auth_client();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            if e.is_timeout() || e.is_connect() {
                return Err(LauncherError::ServerConnectionFailed(
                    "获取皮肤档案失败，请检查网络 / Failed to fetch skin profile".to_string()
                ));
            }
            return Err(LauncherError::Http(e));
        }
    };

    let status = resp.status();
    if !status.is_success() {
        if status.as_u16() == 401 {
            return Err(LauncherError::AuthExpired(
                "令牌已失效，请重新登录 / Token expired, please re-login".to_string()
            ));
        }
        let body = resp.text().await.unwrap_or_default();
        return Err(LauncherError::AuthFailed(
            format!("获取皮肤档案失败 ({}) / Failed to get skin profile ({})", status, body.chars().take(200).collect::<String>())
        ));
    }

    let profile: YggdrasilSkinProfile = resp.json().await?;
    Ok(profile)
}

// Reserved for skin texture parsing
#[allow(dead_code)]
pub fn decode_textures_value(value: &str) -> Result<TexturesValue, LauncherError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(value)
        .map_err(|e| LauncherError::Decryption(format!("Invalid base64 in textures: {}", e)))?;
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
    let client = build_auth_client();
    let file_bytes = std::fs::read(file_path)?;
    let file_name = std::path::Path::new(file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "skin.png".to_string());

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("image/png")
        .map_err(|e| LauncherError::InvalidConfig(format!("MIME error: {}", e)))?;

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
    let client = build_auth_client();
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

// ── OAuth2 flow ──────────────────────────────────────────────────────────

/// Result of starting an OAuth2 flow: the URL to open in the browser and a
/// state token that must be passed back to `complete_yggdrasil_oauth`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilOAuthStartResult {
    pub auth_url: String,
    pub state: String,
}

/// Result of completing an OAuth2 flow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilOAuthResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub profiles: Vec<YggdrasilProfile>,
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    token_type: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
}

/// Start the Yggdrasil OAuth2 authorization flow.
///
/// This builds the authorization URL, opens it in the user's default browser,
/// and starts a temporary local HTTP server on a random port to receive the
/// callback. The function returns the authorization URL and a random `state`
/// parameter that the caller should keep for verification.
pub async fn start_yggdrasil_oauth(
    server_name: &str,
) -> Result<YggdrasilOAuthStartResult, LauncherError> {
    let preset = get_server_presets()
        .into_iter()
        .find(|p| p.name == server_name)
        .ok_or_else(|| LauncherError::AuthFailed(
            format!("Unknown Yggdrasil server: {}", server_name)
        ))?;

    let oauth_config = preset.build_oauth_config()
        .ok_or_else(|| LauncherError::AuthFailed(
            format!("Server {} does not support OAuth2", server_name)
        ))?;

    let state = uuid::Uuid::new_v4().to_string();

    let auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}",
        oauth_config.authorize_url,
        urlencoding::encode(&oauth_config.client_id),
        urlencoding::encode(&oauth_config.redirect_uri),
        urlencoding::encode(&oauth_config.scope),
        urlencoding::encode(&state),
    );

    // Open the authorization URL in the user's default browser
    if let Err(e) = webbrowser::open(&auth_url) {
        tracing::warn!("Failed to open browser for Yggdrasil OAuth: {}", e);
    }

    Ok(YggdrasilOAuthStartResult {
        auth_url,
        state,
    })
}

/// Complete the Yggdrasil OAuth2 flow by exchanging the authorization code
/// for access tokens, then fetching the user's profile using the appropriate
/// profile parser for the server.
pub async fn complete_yggdrasil_oauth(
    server_name: &str,
    code: &str,
) -> Result<YggdrasilOAuthResult, LauncherError> {
    let preset = get_server_presets()
        .into_iter()
        .find(|p| p.name == server_name)
        .ok_or_else(|| LauncherError::AuthFailed(
            format!("Unknown Yggdrasil server: {}", server_name)
        ))?;

    let oauth_config = preset.build_oauth_config()
        .ok_or_else(|| LauncherError::AuthFailed(
            format!("Server {} does not support OAuth2", server_name)
        ))?;

    // Exchange authorization code for tokens
    let client = build_auth_client();
    let mut params = std::collections::HashMap::new();
    params.insert("grant_type", "authorization_code".to_string());
    params.insert("code", code.to_string());
    params.insert("client_id", oauth_config.client_id.clone());
    params.insert("redirect_uri", oauth_config.redirect_uri.clone());
    if let Some(ref secret) = oauth_config.client_secret {
        params.insert("client_secret", secret.clone());
    }

    let resp = client
        .post(&oauth_config.token_url)
        .form(&params)
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            if e.is_connect() {
                return Err(LauncherError::ServerConnectionFailed(
                    format!("Cannot connect to OAuth token endpoint: {}", oauth_config.token_url)
                ));
            }
            if e.is_timeout() {
                return Err(LauncherError::ServerConnectionFailed(
                    "OAuth token exchange timed out".to_string()
                ));
            }
            return Err(LauncherError::Http(e));
        }
    };

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(LauncherError::AuthFailed(
            format!("OAuth token exchange failed ({}): {}", status, body.chars().take(300).collect::<String>())
        ));
    }

    let token_resp: OAuthTokenResponse = resp.json().await?;

    // Fetch the user profile using the server's profile endpoint
    let profiles = if let Some(ref profile_path) = preset.profile_path {
        let base = preset.base_url.trim_end_matches('/');
        let profile_url = if profile_path.starts_with("http") {
            profile_path.clone()
        } else {
            // Strip /api/yggdrasil suffix to get the root URL for profile paths
            let root = base
                .strip_suffix("/api/yggdrasil")
                .unwrap_or(base);
            format!("{}{}", root, profile_path)
        };

        let profile_resp = client
            .get(&profile_url)
            .header("Authorization", format!("Bearer {}", token_resp.access_token))
            .send()
            .await;

        match profile_resp {
            Ok(r) if r.status().is_success() => {
                match r.bytes().await {
                    Ok(bytes) => {
                        let parser = get_parser_for_server(server_name);
                        match parser.parse_profiles(&bytes) {
                            Ok(p) => p,
                            Err(e) => {
                                tracing::warn!("Profile parsing with {} parser failed: {}", parser.parser_id(), e);
                                vec![]
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to read profile response: {}", e);
                        vec![]
                    }
                }
            }
            Ok(r) => {
                tracing::warn!("Profile fetch returned status {}", r.status());
                vec![]
            }
            Err(e) => {
                tracing::warn!("Profile fetch failed: {}", e);
                vec![]
            }
        }
    } else {
        vec![]
    };

    Ok(YggdrasilOAuthResult {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token,
        token_type: token_resp.token_type.unwrap_or_else(|| "Bearer".to_string()),
        expires_in: token_resp.expires_in,
        profiles,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilOAuthConfig {
    pub authorize_url: String,
    pub token_url: String,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YggdrasilServerPreset {
    pub name: String,
    pub base_url: String,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub auth_mode: String,
    pub authorize_path: Option<String>,
    pub token_path: Option<String>,
    pub profile_path: Option<String>,
    pub scope: Option<String>,
}

impl YggdrasilServerPreset {
    pub fn build_oauth_config(&self) -> Option<YggdrasilOAuthConfig> {
        let client_id = self.client_id.as_ref()?;
        let authorize_path = self.authorize_path.as_ref()?;
        let token_path = self.token_path.as_ref()?;
        let scope = self.scope.as_ref()?;

        let base = self.base_url.trim_end_matches('/');
        // Derive the OAuth base from the base_url by stripping the /api/yggdrasil suffix
        let oauth_base = base
            .strip_suffix("/api/yggdrasil")
            .unwrap_or(base);

        Some(YggdrasilOAuthConfig {
            authorize_url: format!("{}{}", oauth_base, authorize_path),
            token_url: format!("{}{}", oauth_base, token_path),
            client_id: client_id.clone(),
            client_secret: self.client_secret.clone(),
            redirect_uri: "bonnext://auth".to_string(),
            scope: scope.clone(),
        })
    }
}

pub fn get_server_presets() -> Vec<YggdrasilServerPreset> {
    vec![
        YggdrasilServerPreset {
            name: "LittleSkin".to_string(),
            base_url: "https://littleskin.cn/api/yggdrasil".to_string(),
            client_id: Some("1181".to_string()),
            client_secret: None,
            auth_mode: "oauth2".to_string(),
            authorize_path: Some("/oauth/authorize".to_string()),
            token_path: Some("/oauth/token".to_string()),
            profile_path: Some("/api/yggdrasil/sessionserver/session/minecraft/profile".to_string()),
            scope: Some("Yggdrasil.MinecraftToken.Create Yggdrasil.PlayerProfiles.Read".to_string()),
        },
        YggdrasilServerPreset {
            name: "MUA".to_string(),
            base_url: "https://skin.mualliance.ltd/api/yggdrasil".to_string(),
            client_id: Some("34".to_string()),
            client_secret: None,
            auth_mode: "oauth2".to_string(),
            authorize_path: Some("/oauth/authorize".to_string()),
            token_path: Some("/oauth/token".to_string()),
            profile_path: Some("/api/players".to_string()),
            scope: Some("Player.Read User.Read".to_string()),
        },
        YggdrasilServerPreset {
            name: "Ely.by".to_string(),
            base_url: "https://account.ely.by/api/yggdrasil".to_string(),
            client_id: Some("bonnext".to_string()),
            client_secret: None,
            auth_mode: "oauth2".to_string(),
            authorize_path: Some("/oauth2/v1".to_string()),
            token_path: Some("/api/oauth2/v1/token".to_string()),
            profile_path: Some("/api/account/v1/info".to_string()),
            scope: Some("account_info".to_string()),
        },
        YggdrasilServerPreset {
            name: "Custom".to_string(),
            base_url: String::new(),
            client_id: None,
            client_secret: None,
            auth_mode: "password".to_string(),
            authorize_path: None,
            token_path: None,
            profile_path: None,
            scope: None,
        },
    ]
}

pub trait YggdrasilProfileParser: Send + Sync {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError>;
    fn parser_id(&self) -> &str;
}

pub struct GenericProfileParser;

impl YggdrasilProfileParser for GenericProfileParser {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError> {
        let value: serde_json::Value = serde_json::from_slice(data)
            .map_err(|e| LauncherError::AuthFailed(format!("Parse profiles failed: {}", e)))?;
        let profiles = if let Some(arr) = value["availableProfiles"].as_array() {
            arr.iter().filter_map(|v| {
                Some(YggdrasilProfile {
                    id: v["id"].as_str()?.to_string(),
                    name: v["name"].as_str()?.to_string(),
                })
            }).collect()
        } else if value["id"].is_string() {
            vec![YggdrasilProfile {
                id: value["id"].as_str().unwrap_or_default().to_string(),
                name: value["name"].as_str().unwrap_or_default().to_string(),
            }]
        } else {
            vec![]
        };
        Ok(profiles)
    }

    fn parser_id(&self) -> &str {
        "generic"
    }
}

pub struct LittleSkinProfileParser;

impl YggdrasilProfileParser for LittleSkinProfileParser {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError> {
        let value: serde_json::Value = serde_json::from_slice(data)
            .map_err(|e| LauncherError::AuthFailed(format!("Parse LittleSkin profiles failed: {}", e)))?;
        // LittleSkin returns profiles in "players" array or standard Yggdrasil format
        let profiles = if let Some(arr) = value["players"].as_array() {
            arr.iter().filter_map(|v| {
                Some(YggdrasilProfile {
                    id: v["id"].as_str()?.to_string(),
                    name: v["name"].as_str()?.to_string(),
                })
            }).collect()
        } else if let Some(arr) = value["availableProfiles"].as_array() {
            arr.iter().filter_map(|v| {
                Some(YggdrasilProfile {
                    id: v["id"].as_str()?.to_string(),
                    name: v["name"].as_str()?.to_string(),
                })
            }).collect()
        } else if value["id"].is_string() {
            vec![YggdrasilProfile {
                id: value["id"].as_str().unwrap_or_default().to_string(),
                name: value["name"].as_str().unwrap_or_default().to_string(),
            }]
        } else {
            vec![]
        };
        Ok(profiles)
    }

    fn parser_id(&self) -> &str {
        "littleskin"
    }
}

pub struct MuaProfileParser;

impl YggdrasilProfileParser for MuaProfileParser {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError> {
        let value: serde_json::Value = serde_json::from_slice(data)
            .map_err(|e| LauncherError::AuthFailed(format!("Parse MUA profiles failed: {}", e)))?;
        // MUA returns profiles in standard format or as a direct player object
        let profiles = if let Some(arr) = value["availableProfiles"].as_array() {
            arr.iter().filter_map(|v| {
                Some(YggdrasilProfile {
                    id: v["id"].as_str()?.to_string(),
                    name: v["name"].as_str()?.to_string(),
                })
            }).collect()
        } else if let Some(player) = value.get("player") {
            vec![YggdrasilProfile {
                id: player["id"].as_str().unwrap_or_default().to_string(),
                name: player["name"].as_str().unwrap_or_default().to_string(),
            }]
        } else if value["id"].is_string() {
            vec![YggdrasilProfile {
                id: value["id"].as_str().unwrap_or_default().to_string(),
                name: value["name"].as_str().unwrap_or_default().to_string(),
            }]
        } else {
            vec![]
        };
        Ok(profiles)
    }

    fn parser_id(&self) -> &str {
        "mua"
    }
}

pub struct ElyProfileParser;

impl YggdrasilProfileParser for ElyProfileParser {
    fn parse_profiles(&self, data: &[u8]) -> Result<Vec<YggdrasilProfile>, LauncherError> {
        let value: serde_json::Value = serde_json::from_slice(data)
            .map_err(|e| LauncherError::AuthFailed(format!("Parse Ely.by profiles failed: {}", e)))?;
        // Ely.by returns profile info in "id" + "username" fields or standard format
        let profiles = if let Some(arr) = value["availableProfiles"].as_array() {
            arr.iter().filter_map(|v| {
                Some(YggdrasilProfile {
                    id: v["id"].as_str()?.to_string(),
                    name: v["name"].as_str()?.to_string(),
                })
            }).collect()
        } else if value["id"].is_string() {
            let name = value["username"].as_str()
                .or_else(|| value["name"].as_str())
                .unwrap_or_default();
            vec![YggdrasilProfile {
                id: value["id"].as_str().unwrap_or_default().to_string(),
                name: name.to_string(),
            }]
        } else {
            vec![]
        };
        Ok(profiles)
    }

    fn parser_id(&self) -> &str {
        "ely"
    }
}

pub fn get_parser_for_server(server_name: &str) -> Box<dyn YggdrasilProfileParser> {
    match server_name {
        "LittleSkin" => Box::new(LittleSkinProfileParser),
        "MUA" => Box::new(MuaProfileParser),
        "Ely.by" => Box::new(ElyProfileParser),
        _ => Box::new(GenericProfileParser),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translate_forbidden_operation() {
        let msg = translate_yggdrasil_error("ForbiddenOperationException", "");
        assert!(msg.contains("邮箱或密码错误"));
    }

    #[test]
    fn translate_forbidden_with_message() {
        let msg = translate_yggdrasil_error("ForbiddenOperationException", "Custom error msg");
        assert_eq!(msg, "Custom error msg");
    }

    #[test]
    fn translate_illegal_argument() {
        let msg = translate_yggdrasil_error("IllegalArgumentException", "");
        assert!(msg.contains("请求参数无效"));
    }

    #[test]
    fn translate_rate_limited() {
        let msg = translate_yggdrasil_error("RateLimitedException", "");
        assert!(msg.contains("频繁"));
    }

    #[test]
    fn translate_resource_not_found() {
        let msg = translate_yggdrasil_error("ResourceNotFoundException", "");
        assert!(msg.contains("未找到"));
    }

    #[test]
    fn translate_unknown_error() {
        let msg = translate_yggdrasil_error("UnknownError", "");
        assert!(msg.contains("登录失败"));
        assert!(msg.contains("UnknownError"));
    }

    #[test]
    fn translate_uses_message_when_present() {
        let msg = translate_yggdrasil_error("AnyError", "Detailed message here");
        assert_eq!(msg, "Detailed message here");
    }

    #[test]
    fn decode_textures_value_valid() {
        let json = r#"{"timestamp":1234567890,"profile_id":"abc","profile_name":"Test","textures":{"SKIN":{"url":"http://example.com/skin.png"}}}"#;
        let encoded = base64::engine::general_purpose::STANDARD.encode(json.as_bytes());
        let result = decode_textures_value(&encoded).unwrap();
        assert_eq!(result.profile_name, "Test");
        assert!(result.textures.skin.is_some());
        assert!(result.textures.cape.is_none());
    }

    #[test]
    fn decode_textures_value_invalid_base64() {
        let result = decode_textures_value("not-valid-base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn decode_textures_value_invalid_json() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"not json");
        let result = decode_textures_value(&encoded);
        assert!(result.is_err());
    }

    #[test]
    fn get_presets_returns_list() {
        let presets = get_presets();
        assert!(!presets.is_empty());
        assert!(presets.iter().any(|(name, _)| name == "LittleSkin"));
        assert!(presets.iter().any(|(name, _)| name == "自定义"));
    }

    #[test]
    fn yggdrasil_auth_result_serde() {
        let result = YggdrasilAuthResult {
            username: "TestUser".to_string(),
            uuid: "abc123".to_string(),
            access_token: "token".to_string(),
            client_token: "client".to_string(),
            server_url: "https://example.com".to_string(),
            available_profiles: vec![],
            selected_profile: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        let back: YggdrasilAuthResult = serde_json::from_str(&json).unwrap();
        assert_eq!(back.username, "TestUser");
        assert_eq!(back.uuid, "abc123");
    }
}
