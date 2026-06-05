use std::sync::OnceLock;
use std::time::Duration;

static API_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// Short-lived API client with 15s total / 5s connect timeout for metadata requests.
static API_METADATA_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn build_client() -> &'static reqwest::Client {
    API_CLIENT.get_or_init(|| {
        build_client_with_proxy()
            .unwrap_or_else(|_| {
                reqwest::Client::builder()
                    .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
                    .timeout(Duration::from_secs(60))
                    .connect_timeout(Duration::from_secs(15))
                    .pool_max_idle_per_host(10)
                    .pool_idle_timeout(Duration::from_secs(90))
                    .tcp_keepalive(Duration::from_secs(60))
                    .build()
                    .expect("Failed to build HTTP client")
            })
    })
}

/// Returns a client with shorter timeouts (15s total, 5s connect) for API metadata
/// requests like project details and version lists. Falls back to the standard client
/// if proxy configuration fails.
pub fn build_api_client() -> &'static reqwest::Client {
    API_METADATA_CLIENT.get_or_init(|| {
        build_api_client_with_proxy()
            .unwrap_or_else(|_| {
                reqwest::Client::builder()
                    .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
                    .timeout(Duration::from_secs(15))
                    .connect_timeout(Duration::from_secs(5))
                    .pool_max_idle_per_host(10)
                    .pool_idle_timeout(Duration::from_secs(90))
                    .tcp_keepalive(Duration::from_secs(30))
                    .build()
                    .expect("Failed to build API metadata HTTP client")
            })
    })
}

pub fn build_download_client() -> &'static reqwest::Client {
    static DOWNLOAD_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    DOWNLOAD_CLIENT.get_or_init(|| {
        build_download_client_with_proxy()
            .unwrap_or_else(|_| {
                reqwest::Client::builder()
                    .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
                    .connect_timeout(Duration::from_secs(30))
                    .pool_max_idle_per_host(10)
                    .tcp_keepalive(Duration::from_secs(60))
                    .build()
                    .expect("Failed to build download HTTP client")
            })
    })
}

pub fn build_client_with_proxy() -> Result<reqwest::Client, crate::error::LauncherError> {
    let config = crate::config::load_config()?;
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(15));
    if config.security.proxy_enabled {
        if let Some(ref proxy_url) = config.security.proxy_url {
            let mut proxy = reqwest::Proxy::all(proxy_url).map_err(|e| {
                crate::error::LauncherError::InvalidConfig(format!("Invalid proxy URL: {}", e))
            })?;
            if let (Some(ref user), Some(ref pass)) =
                (config.security.proxy_username, config.security.proxy_password)
            {
                proxy = proxy.basic_auth(user, pass);
            }
            builder = builder.proxy(proxy);
        }
    }
    Ok(builder.build()?)
}

pub fn build_api_client_with_proxy() -> Result<reqwest::Client, crate::error::LauncherError> {
    let config = crate::config::load_config()?;
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(15))
        .connect_timeout(std::time::Duration::from_secs(5));
    if config.security.proxy_enabled {
        if let Some(ref proxy_url) = config.security.proxy_url {
            let mut proxy = reqwest::Proxy::all(proxy_url).map_err(|e| {
                crate::error::LauncherError::InvalidConfig(format!("Invalid proxy URL: {}", e))
            })?;
            if let (Some(ref user), Some(ref pass)) =
                (config.security.proxy_username, config.security.proxy_password)
            {
                proxy = proxy.basic_auth(user, pass);
            }
            builder = builder.proxy(proxy);
        }
    }
    Ok(builder.build()?)
}

pub async fn retry_get(url: &str, max_retries: u32) -> Result<reqwest::Response, crate::error::LauncherError> {
    retry_get_with_headers(url, max_retries, None).await
}

/// Like `retry_get_with_headers` but uses the shorter-timeout API client (15s/5s).
/// Use this for metadata requests (project details, version lists) where a fast
/// failure is preferable to a long wait.
pub async fn retry_api_get_with_headers(
    url: &str,
    max_retries: u32,
    headers: Option<reqwest::header::HeaderMap>,
) -> Result<reqwest::Response, crate::error::LauncherError> {
    let client = build_api_client();
    let mut last_err = None;
    for attempt in 0..=max_retries {
        if attempt > 0 {
            let delay = Duration::from_millis(500 * 2u64.pow(attempt - 1));
            tokio::time::sleep(delay).await;
        }
        let mut req = client.get(url);
        if let Some(ref h) = headers {
            req = req.headers(h.clone());
        }
        match req.send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    return Ok(resp);
                }
                let status = resp.status();
                if status.is_server_error() && attempt < max_retries {
                    tracing::warn!("API metadata request to {} returned {}, retrying ({}/{})", url, status, attempt + 1, max_retries);
                    last_err = Some(crate::error::LauncherError::HttpError {
                        status: status.as_u16(),
                        url: url.to_string(),
                    });
                    continue;
                }
                match resp.error_for_status() {
                    Ok(r) => return Ok(r),
                    Err(e) => return Err(e.into()),
                }
            }
            Err(e) => {
                if attempt < max_retries {
                    tracing::warn!("API metadata request to {} failed: {}, retrying ({}/{})", url, e, attempt + 1, max_retries);
                    last_err = Some(e.into());
                    continue;
                }
                return Err(e.into());
            }
        }
    }
    Err(last_err.unwrap_or_else(|| crate::error::LauncherError::NetworkUnreachable))
}

pub async fn retry_get_with_headers(
    url: &str,
    max_retries: u32,
    headers: Option<reqwest::header::HeaderMap>,
) -> Result<reqwest::Response, crate::error::LauncherError> {
    let client = build_client();
    let mut last_err = None;
    for attempt in 0..=max_retries {
        if attempt > 0 {
            let delay = Duration::from_millis(500 * 2u64.pow(attempt - 1));
            tokio::time::sleep(delay).await;
        }
        let mut req = client.get(url);
        if let Some(ref h) = headers {
            req = req.headers(h.clone());
        }
        match req.send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    return Ok(resp);
                }
                let status = resp.status();
                if status.is_server_error() && attempt < max_retries {
                    tracing::warn!("API request to {} returned {}, retrying ({}/{})", url, status, attempt + 1, max_retries);
                    last_err = Some(crate::error::LauncherError::HttpError {
                        status: status.as_u16(),
                        url: url.to_string(),
                    });
                    continue;
                }
                match resp.error_for_status() {
                    Ok(r) => return Ok(r),
                    Err(e) => return Err(e.into()),
                }
            }
            Err(e) => {
                if attempt < max_retries {
                    tracing::warn!("API request to {} failed: {}, retrying ({}/{})", url, e, attempt + 1, max_retries);
                    last_err = Some(e.into());
                    continue;
                }
                return Err(e.into());
            }
        }
    }
    Err(last_err.unwrap_or_else(|| crate::error::LauncherError::NetworkUnreachable))
}

pub async fn retry_get_with_fallback(
    url_template: &str,
    api_bases: &[&str],
    max_retries: u32,
    headers: Option<reqwest::header::HeaderMap>,
) -> Result<reqwest::Response, crate::error::LauncherError> {
    let mut last_err = None;
    for (base_idx, base) in api_bases.iter().enumerate() {
        let url = url_template.replace("{API_BASE}", base);
        if base_idx > 0 {
            tracing::info!("API fallback: trying base {} for url template", base);
        }
        match retry_get_with_headers(&url, max_retries, headers.clone()).await {
            Ok(resp) => return Ok(resp),
            Err(e) => {
                tracing::warn!(
                    "API request with base {} failed: {}, trying next source ({}/{})",
                    base, e, base_idx + 1, api_bases.len()
                );
                last_err = Some(e);
                continue;
            }
        }
    }
    Err(last_err.unwrap_or_else(|| crate::error::LauncherError::NetworkUnreachable))
}

/// Like `retry_get_with_fallback` but uses the shorter-timeout API client (15s/5s).
/// Use this for metadata requests where fast failure is preferable.
pub async fn retry_api_get_with_fallback(
    url_template: &str,
    api_bases: &[&str],
    max_retries: u32,
    headers: Option<reqwest::header::HeaderMap>,
) -> Result<reqwest::Response, crate::error::LauncherError> {
    let mut last_err = None;
    for (base_idx, base) in api_bases.iter().enumerate() {
        let url = url_template.replace("{API_BASE}", base);
        if base_idx > 0 {
            tracing::info!("API fallback: trying base {} for url template", base);
        }
        match retry_api_get_with_headers(&url, max_retries, headers.clone()).await {
            Ok(resp) => return Ok(resp),
            Err(e) => {
                tracing::warn!(
                    "API metadata request with base {} failed: {}, trying next source ({}/{})",
                    base, e, base_idx + 1, api_bases.len()
                );
                last_err = Some(e);
                continue;
            }
        }
    }
    Err(last_err.unwrap_or_else(|| crate::error::LauncherError::NetworkUnreachable))
}

pub fn build_download_client_with_proxy() -> Result<reqwest::Client, crate::error::LauncherError> {
    let config = crate::config::load_config()?;
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
        .connect_timeout(std::time::Duration::from_secs(30));
    if config.security.proxy_enabled {
        if let Some(ref proxy_url) = config.security.proxy_url {
            let mut proxy = reqwest::Proxy::all(proxy_url).map_err(|e| {
                crate::error::LauncherError::InvalidConfig(format!("Invalid proxy URL: {}", e))
            })?;
            if let (Some(ref user), Some(ref pass)) =
                (config.security.proxy_username, config.security.proxy_password)
            {
                proxy = proxy.basic_auth(user, pass);
            }
            builder = builder.proxy(proxy);
        }
    } else {
        builder = builder.no_proxy();
    }
    Ok(builder.build()?)
}
