use std::sync::OnceLock;
use std::time::Duration;

static API_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

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
