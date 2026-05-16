//! Shared HTTP client factory with proper headers.

use std::time::Duration;

/// Build a reqwest Client with proper User-Agent and timeouts.
/// Mojang's CDN requires a User-Agent header; without it, requests
/// may return non-JSON error pages that cause "error decoding response body".
pub fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("BonNext/1.0 (MinecraftLauncher)")
        .timeout(Duration::from_secs(60))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to build HTTP client")
}

/// Build a reqwest Client with a longer timeout (for large downloads).
pub fn build_download_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("BonNext/1.0 (MinecraftLauncher)")
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to build download HTTP client")
}
