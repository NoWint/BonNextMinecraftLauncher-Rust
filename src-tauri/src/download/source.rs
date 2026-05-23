#![allow(dead_code)]
use crate::config;
use std::sync::RwLock;

/// A download source that can transform URLs and provide mirror endpoints.
pub trait DownloadSource: Send + Sync {
    fn name(&self) -> &'static str;
    fn version_manifest_url(&self) -> &'static str;
    fn transform_url(&self, original: &str) -> String;
}

// ---------------------------------------------------------------
// Official Mojang source
// ---------------------------------------------------------------
pub struct OfficialSource;

impl DownloadSource for OfficialSource {
    fn name(&self) -> &'static str { "official" }
    fn version_manifest_url(&self) -> &'static str {
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
    }
    fn transform_url(&self, original: &str) -> String {
        original.to_string()
    }
}

// ---------------------------------------------------------------
// BMCLAPI mirror (China)
// ---------------------------------------------------------------
pub struct BmclapiSource;

impl DownloadSource for BmclapiSource {
    fn name(&self) -> &'static str { "bmclapi" }
    fn version_manifest_url(&self) -> &'static str {
        "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json"
    }
    fn transform_url(&self, original: &str) -> String {
        if original.starts_with("https://libraries.minecraft.net/") {
            return original.replace(
                "https://libraries.minecraft.net/",
                "https://bmclapi2.bangbang93.com/libraries/",
            );
        }
        if original.starts_with("https://resources.download.minecraft.net/") {
            return original.replace(
                "https://resources.download.minecraft.net/",
                "https://bmclapi2.bangbang93.com/assets/",
            );
        }
        if original.starts_with("https://piston-meta.mojang.com/") {
            return original.replace(
                "https://piston-meta.mojang.com/",
                "https://bmclapi2.bangbang93.com/",
            );
        }
        if original.starts_with("https://launcher.mojang.com/") {
            return original.replace(
                "https://launcher.mojang.com/",
                "https://bmclapi2.bangbang93.com/",
            );
        }
        if original.starts_with("https://launchermeta.mojang.com/") {
            return original.replace(
                "https://launchermeta.mojang.com/",
                "https://bmclapi2.bangbang93.com/",
            );
        }
        original.to_string()
    }
}

// ---------------------------------------------------------------
// MCBBS mirror (China, alternative)
// ---------------------------------------------------------------
pub struct McbbsSource;

impl DownloadSource for McbbsSource {
    fn name(&self) -> &'static str { "mcbbs" }
    fn version_manifest_url(&self) -> &'static str {
        "https://download.mcbbs.net/mc/game/version_manifest_v2.json"
    }
    fn transform_url(&self, original: &str) -> String {
        if original.starts_with("https://libraries.minecraft.net/") {
            return original.replace(
                "https://libraries.minecraft.net/",
                "https://download.mcbbs.net/libraries/",
            );
        }
        if original.starts_with("https://resources.download.minecraft.net/") {
            return original.replace(
                "https://resources.download.minecraft.net/",
                "https://download.mcbbs.net/assets/",
            );
        }
        if original.starts_with("https://piston-meta.mojang.com/") {
            return original.replace(
                "https://piston-meta.mojang.com/",
                "https://download.mcbbs.net/",
            );
        }
        if original.starts_with("https://launcher.mojang.com/") {
            return original.replace(
                "https://launcher.mojang.com/",
                "https://download.mcbbs.net/",
            );
        }
        if original.starts_with("https://launchermeta.mojang.com/") {
            return original.replace(
                "https://launchermeta.mojang.com/",
                "https://download.mcbbs.net/",
            );
        }
        original.to_string()
    }
}

// ---------------------------------------------------------------
// Global source manager
// ---------------------------------------------------------------
use std::sync::OnceLock;

fn source_manager() -> &'static RwLock<SourceManager> {
    static MANAGER: OnceLock<RwLock<SourceManager>> = OnceLock::new();
    MANAGER.get_or_init(|| RwLock::new(SourceManager::new()))
}

pub struct SourceManager {
    sources: Vec<Box<dyn DownloadSource>>,
    active_index: usize,
}

impl SourceManager {
    fn new() -> Self {
        let sources: Vec<Box<dyn DownloadSource>> = vec![
            Box::new(OfficialSource),
            Box::new(BmclapiSource),
            Box::new(McbbsSource),
        ];
        let active_index = Self::resolve_active_index(&sources);
        SourceManager { sources, active_index }
    }

    fn resolve_active_index(sources: &[Box<dyn DownloadSource>]) -> usize {
        let configured = config::get_download_source_name();
        sources
            .iter()
            .position(|s| s.name() == configured)
            .unwrap_or(0)
    }

    #[allow(dead_code)]
pub fn active_source_name() -> String {
        let mgr = source_manager().read().unwrap();
        mgr.sources[mgr.active_index].name().to_string()
    }

    #[allow(dead_code)]
pub fn set_active(name: &str) {
        let mut mgr = source_manager().write().unwrap();
        if let Some(idx) = mgr.sources.iter().position(|s| s.name() == name) {
            mgr.active_index = idx;
        }
    }

    #[allow(dead_code)]
pub fn version_manifest_url() -> String {
        let mgr = source_manager().read().unwrap();
        mgr.sources[mgr.active_index].version_manifest_url().to_string()
    }

    pub fn transform_url(original: &str) -> String {
        let mgr = source_manager().read().unwrap();
        mgr.sources[mgr.active_index].transform_url(original)
    }

    /// Try all sources for a URL, returning all possible URL variants
    pub fn transform_with_fallback(original: &str) -> Vec<(String, String)> {
        let mgr = source_manager().read().unwrap();
        let mut results = Vec::new();
        results.push((
            mgr.sources[mgr.active_index].name().to_string(),
            mgr.sources[mgr.active_index].transform_url(original),
        ));
        for (i, source) in mgr.sources.iter().enumerate() {
            if i != mgr.active_index {
                results.push((
                    source.name().to_string(),
                    source.transform_url(original),
                ));
            }
        }
        results
    }
}

// Legacy-compatible functions (used by other modules)
#[allow(dead_code)]
pub fn current_source_name() -> String {
    config::get_download_source_name()
}

/// Transform file download URLs through the active mirror.
/// Version manifests and version JSONs should NOT go through this —
/// they always come from Mojang's official servers.
pub fn transform_url(original: &str) -> String {
    SourceManager::transform_url(original)
}

/// Version manifest is always fetched from Mojang official.
/// Mirrors can return broken/redirected version detail URLs.
#[allow(dead_code)]
pub fn version_manifest_url() -> String {
    OfficialSource.version_manifest_url().to_string()
}

pub fn asset_download_url(hash: &str) -> String {
    let prefix = if hash.len() >= 2 { &hash[..2] } else { "00" };
    let original = format!(
        "https://resources.download.minecraft.net/{}/{}",
        prefix, hash
    );
    transform_url(&original)
}

pub fn asset_local_path(assets_dir: &std::path::Path, hash: &str) -> std::path::PathBuf {
    let prefix = if hash.len() >= 2 { &hash[..2] } else { "00" };
    assets_dir.join("objects").join(prefix).join(hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn official_no_transform() {
        assert_eq!(
            OfficialSource.transform_url("https://piston-meta.mojang.com/v2.json"),
            "https://piston-meta.mojang.com/v2.json"
        );
    }

    #[test]
    fn bmclapi_transforms_libraries() {
        let s = BmclapiSource;
        let url = s.transform_url("https://libraries.minecraft.net/com/mojang/logging/1.0.0/logging-1.0.0.jar");
        assert!(url.contains("bmclapi2.bangbang93.com"));
        assert!(url.contains("/libraries/"));
    }

    #[test]
    fn version_manifest_url_valid() {
        for s in &[OfficialSource.version_manifest_url(), BmclapiSource.version_manifest_url()] {
            assert!(s.starts_with("https://"));
            assert!(s.contains("version_manifest"));
        }
    }

    #[test]
    fn asset_download_url_prefix() {
        let url = asset_download_url("abcdef1234567890abcdef1234567890abcdef12");
        assert!(url.contains("/ab/"));
    }

    #[test]
    fn asset_local_path_structure() {
        let p = asset_local_path(std::path::Path::new("/assets"), "ab1234");
        assert!(p.to_string_lossy().contains("/objects/"));
        assert!(p.to_string_lossy().contains("/ab/"));
    }
}
