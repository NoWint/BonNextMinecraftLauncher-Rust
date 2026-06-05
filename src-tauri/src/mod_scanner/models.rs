use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanSource {
    Modrinth,
    CurseForge,
    Fallback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub file_name: String,
    pub file_hash: String,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub project_slug: Option<String>,
    pub source: ScanSource,
    pub project_type: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModCacheStats {
    pub total: usize,
    pub modrinth_hits: usize,
    pub curseforge_hits: usize,
    pub fallbacks: usize,
}
