use crate::config::load_config;
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrlConfigSnapshot {
    pub git_proxy_enabled: bool,
    pub git_proxy_url: String,
}

pub fn apply_git_proxy(url: &str) -> String {
    let config = match load_config() {
        Ok(c) => c,
        Err(_) => return url.to_string(),
    };
    if !config.git_proxy_enabled {
        return url.to_string();
    }
    let is_github_content = url.contains("github.com")
        || url.contains("raw.githubusercontent.com")
        || url.contains("github-releases.githubusercontent.com")
        || url.contains("objects.githubusercontent.com");
    let is_excluded = url.contains("api.github.com")
        || url.contains("suhang12332.github.io");
    if is_github_content && !is_excluded {
        format!("{}/{}", config.git_proxy_url.trim_end_matches('/'), url)
    } else {
        url.to_string()
    }
}

pub fn modrinth_api_url(path: &str) -> String {
    let base = "https://api.modrinth.com/v2";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn modrinth_v3_url(path: &str) -> String {
    let base = "https://api.modrinth.com/v3";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn curseforge_api_url(path: &str) -> String {
    let base = "https://api.curseforge.com/v1";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn fabric_meta_url(path: &str) -> String {
    let base = "https://meta.fabricmc.net";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn quilt_meta_url(path: &str) -> String {
    let base = "https://meta.quiltmc.org";
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub fn mojang_version_manifest_url() -> String {
    "https://piston-meta.mojang.com/mc/game/version_manifest.json".to_string()
}

pub fn authlib_injector_download_url(version: &str) -> String {
    apply_git_proxy(&format!(
        "https://github.com/yushijinhun/authlib-injector/releases/download/{}/authlib-injector-{}.jar",
        version, version
    ))
}

pub fn get_url_config_snapshot() -> Result<UrlConfigSnapshot, LauncherError> {
    let config = load_config()?;
    Ok(UrlConfigSnapshot {
        git_proxy_enabled: config.git_proxy_enabled,
        git_proxy_url: config.git_proxy_url,
    })
}

pub fn set_git_proxy(enabled: bool, proxy_url: Option<String>) -> Result<(), LauncherError> {
    let mut config = load_config()?;
    config.git_proxy_enabled = enabled;
    if let Some(url) = proxy_url {
        if !url.is_empty() {
            config.git_proxy_url = url;
        }
    }
    crate::config::save_config(&config)
}

pub fn minecraft_news_java_release(slug: &str) -> String {
    format!("https://www.minecraft.net/en-us/article/{}", slug)
}

pub fn authlib_injector_download(version: &str, jar_name: &str) -> String {
    apply_git_proxy(&format!(
        "https://github.com/yushijinhun/authlib-injector/releases/download/{}/{}",
        version, jar_name
    ))
}

pub fn curseforge_fingerprint_url() -> String {
    "https://api.curseforge.com/v1/fingerprints/432".to_string()
}

pub fn curseforge_fallback_download(file_id: u64, file_name: &str) -> String {
    let prefix = file_id / 1000;
    let suffix = file_id % 1000;
    format!(
        "https://edge.forgecdn.net/files/{}/{}/{}",
        prefix, suffix, file_name
    )
}

pub fn modrinth_loader_manifest(loader: &str) -> String {
    format!(
        "https://launcher-meta.modrinth.com/{}/v0/manifest.json",
        loader
    )
}

pub fn modrinth_version_info(version: &str) -> String {
    format!(
        "https://launcher-meta.modrinth.com/minecraft/v0/versions/{}.json",
        version
    )
}

pub fn java_runtime_arm_jre_legacy() -> String {
    "https://cdn.azul.com/zulu/bin/zulu8.56.0.21-ca-jre8.0.312-linux_aarch64.tar.gz".to_string()
}

pub fn java_runtime_intel_jre_legacy() -> String {
    "https://cdn.azul.com/zulu/bin/zulu8.56.0.21-ca-jre8.0.312-linux_x64.tar.gz".to_string()
}

pub fn ely_skin_textures(nickname: &str) -> String {
    format!("https://skinsystem.ely.by/textures/{}", nickname)
}
