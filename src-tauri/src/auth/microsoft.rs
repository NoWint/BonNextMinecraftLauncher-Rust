use crate::error::LauncherError;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use url::Url;

const CLIENT_ID: &str = "00000000402b5328";
const REDIRECT_PORT: u16 = 36789;
const REDIRECT_URI: &str = "http://localhost:36789/callback";
const OAUTH_AUTHORIZE_URL: &str = "https://login.live.com/oauth20_authorize.srf";
const OAUTH_TOKEN_URL: &str = "https://login.live.com/oauth20_token.srf";
const XBOX_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_AUTH_URL: &str =
    "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub access_token: String,
    pub refresh_token: String,
    pub username: String,
    pub uuid: String,
    pub expires_at: u64,
}

fn start_callback_server() -> Result<TcpListener, LauncherError> {
    TcpListener::bind(format!("127.0.0.1:{}", REDIRECT_PORT)).map_err(|e| {
        LauncherError::AuthFailed(format!("Failed to bind callback server: {}", e))
    })
}

fn get_auth_code(listener: TcpListener) -> Result<String, LauncherError> {
    listener.set_nonblocking(false).map_err(|e| {
        LauncherError::AuthFailed(format!("Failed to set blocking: {}", e))
    })?;

    let (mut stream, _) = listener.accept().map_err(|e| {
        LauncherError::AuthFailed(format!("Failed to accept callback: {}", e))
    })?;

    let mut reader = BufReader::new(&mut stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| LauncherError::AuthFailed(e.to_string()))?;

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err(LauncherError::AuthFailed(
            "Invalid callback request".to_string(),
        ));
    }

    let path = parts[1];
    let url = Url::parse(&format!("http://localhost{}", path))
        .map_err(|e| LauncherError::AuthFailed(e.to_string()))?;

    let error = url.query_pairs().find(|(key, _)| key == "error");
    if let Some((_, desc)) = error {
        let desc_val = url
            .query_pairs()
            .find(|(key, _)| key == "error_description")
            .map(|(_, v)| v.to_string())
            .unwrap_or_default();
        return Err(LauncherError::AuthFailed(format!("{}: {}", desc, desc_val)));
    }

    let code = url
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, val)| val.to_string())
        .ok_or_else(|| {
            LauncherError::AuthFailed("No auth code in callback".to_string())
        })?;

    let response = if code.is_empty() {
        "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>登录失败</h1><p>未收到授权码。请重试。</p></body></html>"
    } else {
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>登录成功!</h1><p>您可以关闭此页面并返回启动器。</p></body></html>"
    };

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    if code.is_empty() {
        return Err(LauncherError::AuthFailed(
            "Empty auth code in callback".to_string(),
        ));
    }

    Ok(code)
}

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

async fn exchange_code_for_token(
    code: &str,
) -> Result<OAuthTokenResponse, LauncherError> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("code", code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", REDIRECT_URI),
    ];

    let response = client
        .post(OAUTH_TOKEN_URL)
        .form(&params)
        .send()
        .await?
        .error_for_status()?;

    let token: OAuthTokenResponse = response.json().await?;
    Ok(token)
}

async fn xbox_live_auth(access_token: &str) -> Result<String, LauncherError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", access_token),
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT",
    });

    let response: serde_json::Value = client
        .post(XBOX_AUTH_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    response["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No Xbox Live token".to_string()))
}

async fn xsts_auth(xbl_token: &str) -> Result<(String, String), LauncherError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token],
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT",
    });

    let response: serde_json::Value = client
        .post(XSTS_AUTH_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let token = response["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No XSTS token".to_string()))?;

    let uhs = response["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| LauncherError::AuthFailed("No XSTS UHS".to_string()))?;

    Ok((token, uhs))
}

async fn minecraft_auth(uhs: &str, xsts_token: &str) -> Result<String, LauncherError> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token),
    });

    let response: serde_json::Value = client
        .post(MC_AUTH_URL)
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    response["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            LauncherError::AuthFailed("No Minecraft token".to_string())
        })
}

async fn get_minecraft_profile(
    mc_token: &str,
) -> Result<(String, String), LauncherError> {
    let client = reqwest::Client::new();
    let response: serde_json::Value = client
        .get(MC_PROFILE_URL)
        .header("Authorization", format!("Bearer {}", mc_token))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let username = response["name"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            LauncherError::AuthFailed("No username in profile".to_string())
        })?;

    let uuid = response["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| {
            LauncherError::AuthFailed("No UUID in profile".to_string())
        })?;

    Ok((username, uuid))
}

pub async fn perform_full_auth() -> Result<AuthResult, LauncherError> {
    let auth_url = format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&scope=XboxLive.signin%20offline_access",
        OAUTH_AUTHORIZE_URL, CLIENT_ID, REDIRECT_URI
    );

    let listener = start_callback_server()?;
    webbrowser::open(&auth_url)
        .map_err(|e| LauncherError::AuthFailed(format!("Failed to open browser: {}", e)))?;

    let code = get_auth_code(listener)?;
    let token_response = exchange_code_for_token(&code).await?;
    let xbl_token = xbox_live_auth(&token_response.access_token).await?;
    let (xsts_token, uhs) = xsts_auth(&xbl_token).await?;
    let mc_token = minecraft_auth(&uhs, &xsts_token).await?;
    let (username, uuid) = get_minecraft_profile(&mc_token).await?;

    Ok(AuthResult {
        access_token: mc_token,
        refresh_token: token_response.refresh_token,
        username,
        uuid,
        expires_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            + token_response.expires_in,
    })
}
