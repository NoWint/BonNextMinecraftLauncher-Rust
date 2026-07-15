use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::LauncherError;

pub const CLIENT_ID: &str = match option_env!("BONNEXT_MS_CLIENT_ID") {
    Some(id) => id,
    None => "00000000402b5328",
};
/// 公开 CLIENT_ID 供 token_store::refresh_microsoft_token 复用，
/// 避免在两处分别硬编码同一遗留 client_id（此前 token_store 第 108 行
/// 重复写死了 "00000000402b5328"，与 microsoft.rs 不同步）。
const DEVICE_CODE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
const SCOPE: &str = "XboxLive.signin offline_access";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    #[serde(rename = "expires_in")]
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicrosoftAuthResult {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: String,
}

pub async fn start_device_auth() -> Result<DeviceCodeResponse, LauncherError> {
    let client = crate::http_client::build_client();
    let mut params = HashMap::new();
    params.insert("client_id", CLIENT_ID);
    params.insert("scope", SCOPE);

    let resp: DeviceCodeResponse = client
        .post(DEVICE_CODE_URL)
        .form(&params)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp)
}

pub async fn poll_device_auth(device_code: &str) -> Result<MicrosoftAuthResult, LauncherError> {
    let client = crate::http_client::build_client();
    let mut params = HashMap::new();
    params.insert("client_id", CLIENT_ID);
    params.insert("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
    params.insert("device_code", device_code);

    let max_attempts = 180u32;
    let interval_ms = 5000u64;

    for _ in 0..max_attempts {
        let mut token_params = params.clone();
        token_params.insert("client_id", CLIENT_ID);
        token_params.insert("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
        token_params.insert("device_code", device_code);

        let resp = client
            .post(TOKEN_URL)
            .form(&token_params)
            .send()
            .await?;

        let status = resp.status();
        let body: serde_json::Value = resp.json().await?;

        if status.is_success() {
            let ms_access_token = body["access_token"]
                .as_str()
                .ok_or_else(|| LauncherError::AuthFailed("Missing access_token".to_string()))?;
            let refresh_token = body["refresh_token"]
                .as_str()
                .ok_or_else(|| LauncherError::AuthFailed("Missing refresh_token in OAuth response".to_string()))?
                .to_string();

            let result = complete_auth(client, ms_access_token, &refresh_token).await?;
            let _ = crate::security::audit::record_login("microsoft", true, &result.username);
            return Ok(result);
        }

        let error = body["error"].as_str().unwrap_or("");
        match error {
            "authorization_pending" => {
                tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
                continue;
            }
            "slow_down" => {
                tokio::time::sleep(std::time::Duration::from_millis(interval_ms + 5000)).await;
                continue;
            }
            "expired_token" => {
                let _ = crate::security::audit::record_login("microsoft", false, "").ok();
                return Err(LauncherError::AuthExpired("Device code expired".to_string()));
            }
            "access_denied" => {
                let _ = crate::security::audit::record_login("microsoft", false, "").ok();
                return Err(LauncherError::AuthFailed("Access denied by user".to_string()));
            }
            _ => {
                let desc = body["error_description"].as_str().unwrap_or(error);
                let _ = crate::security::audit::record_login("microsoft", false, "").ok();
                return Err(LauncherError::AuthFailed(desc.to_string()));
            }
        }
    }

    let _ = crate::security::audit::record_login("microsoft", false, "").ok();
    Err(LauncherError::AuthFailed("Authentication timed out".to_string()))
}

async fn complete_auth(
    client: &reqwest::Client,
    ms_access_token: &str,
    refresh_token: &str,
) -> Result<MicrosoftAuthResult, LauncherError> {
    let xbl_token = auth_xbl(client, ms_access_token).await?;
    let (xsts_token, user_hash) = auth_xsts(client, &xbl_token).await?;
    let mc_token = auth_minecraft(client, &xsts_token, &user_hash).await?;
    let profile = get_mc_profile(client, &mc_token).await?;

    Ok(MicrosoftAuthResult {
        username: profile.name,
        uuid: profile.id,
        access_token: mc_token,
        refresh_token: refresh_token.to_string(),
    })
}

async fn auth_xbl(client: &reqwest::Client, ms_token: &str) -> Result<String, LauncherError> {
    #[derive(Serialize)]
    #[allow(non_snake_case)]
    struct XblRequest {
        Properties: XblProperties,
        RelyingParty: String,
        TokenType: String,
    }
    #[derive(Serialize)]
    #[allow(non_snake_case)]
    struct XblProperties {
        AuthMethod: String,
        IdToken: String,
        RelyingParty: String,
        TokenType: String,
    }

    let body = XblRequest {
        Properties: XblProperties {
            AuthMethod: "RPS".to_string(),
            IdToken: ms_token.to_string(),
            RelyingParty: "http://auth.xboxlive.com".to_string(),
            TokenType: "JWT".to_string(),
        },
        RelyingParty: "http://auth.xboxlive.com".to_string(),
        TokenType: "JWT".to_string(),
    };

    let resp: serde_json::Value = client
        .post(XBL_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    resp["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("Missing XBL token".to_string()))
}

async fn auth_xsts(
    client: &reqwest::Client,
    xbl_token: &str,
) -> Result<(String, String), LauncherError> {
    #[derive(Serialize)]
    #[allow(non_snake_case)]
    struct XstsRequest {
        Properties: XstsProperties,
        RelyingParty: String,
        TokenType: String,
    }
    #[derive(Serialize)]
    #[allow(non_snake_case)]
    struct XstsProperties {
        SandboxId: String,
        UserTokens: Vec<String>,
    }

    let body = XstsRequest {
        Properties: XstsProperties {
            SandboxId: "RETAIL".to_string(),
            UserTokens: vec![xbl_token.to_string()],
        },
        RelyingParty: "rp://api.minecraftservices.com/".to_string(),
        TokenType: "JWT".to_string(),
    };

    let resp: serde_json::Value = client
        .post(XSTS_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let token = resp["Token"]
        .as_str()
        .ok_or_else(|| LauncherError::AuthFailed("Missing XSTS token".to_string()))?;
    let user_hash = resp["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or_else(|| LauncherError::AuthFailed("Missing user hash".to_string()))?;

    Ok((token.to_string(), user_hash.to_string()))
}

async fn auth_minecraft(
    client: &reqwest::Client,
    xsts_token: &str,
    user_hash: &str,
) -> Result<String, LauncherError> {
    #[derive(Serialize)]
    #[allow(non_snake_case)]
    struct McRequest {
        identityToken: String,
    }

    let body = McRequest {
        identityToken: format!("XBL3.0 x={};{}", user_hash, xsts_token),
    };

    let resp: serde_json::Value = client
        .post(MC_LOGIN_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    resp["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("Missing MC access token".to_string()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct McProfile {
    id: String,
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McSkinInfo {
    pub id: String,
    pub state: String,
    pub url: String,
    pub variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McCapeInfo {
    pub id: String,
    pub state: String,
    pub url: String,
    pub alias: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McSkinProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<McSkinInfo>,
    pub capes: Vec<McCapeInfo>,
}

async fn get_mc_profile(
    client: &reqwest::Client,
    mc_token: &str,
) -> Result<McProfile, LauncherError> {
    let profile: McProfile = client
        .get(MC_PROFILE_URL)
        .header("Authorization", format!("Bearer {}", mc_token))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(profile)
}

pub async fn get_skin_profile(mc_token: &str) -> Result<McSkinProfile, LauncherError> {
    let client = crate::http_client::build_client();
    let profile: McSkinProfile = client
        .get(MC_PROFILE_URL)
        .header("Authorization", format!("Bearer {}", mc_token))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(profile)
}

pub async fn upload_skin(mc_token: &str, file_path: &str, variant: &str) -> Result<(), LauncherError> {
    let client = crate::http_client::build_client();
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
        .text("variant", variant.to_string())
        .part("file", part);

    client
        .post(format!("{}/skins", MC_PROFILE_URL))
        .header("Authorization", format!("Bearer {}", mc_token))
        .multipart(form)
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

pub async fn delete_skin(mc_token: &str, skin_id: &str) -> Result<(), LauncherError> {
    let client = crate::http_client::build_client();
    client
        .delete(format!("{}/skins/{}", MC_PROFILE_URL, skin_id))
        .header("Authorization", format!("Bearer {}", mc_token))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}
