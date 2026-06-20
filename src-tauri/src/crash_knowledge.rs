use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::LauncherError;
use crate::platform::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashPattern {
    pub signature: String,
    pub mod_context: Option<String>,
    pub cause: String,
    pub fix: String,
    pub source: String,
    pub confidence: f64,
    pub occurrences: u64,
}

type KnowledgeBase = Vec<CrashPattern>;

fn knowledge_base_path() -> std::path::PathBuf {
    paths::get_game_dir().join("crash_knowledge_base.json")
}

pub fn load_knowledge_base() -> Result<KnowledgeBase, LauncherError> {
    let path = knowledge_base_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path)?;
    let kb: KnowledgeBase = serde_json::from_str(&data).unwrap_or_default();
    Ok(kb)
}

pub fn save_knowledge_base(kb: &KnowledgeBase) -> Result<(), LauncherError> {
    let path = knowledge_base_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(kb)?;
    std::fs::write(&path, data)?;
    Ok(())
}

pub fn find_matching_patterns(error_type: &str) -> Vec<CrashPattern> {
    let kb = load_knowledge_base().unwrap_or_default();
    kb.into_iter()
        .filter(|p| p.signature == error_type || error_type.contains(&p.signature))
        .collect()
}

pub fn record_pattern(pattern: &CrashPattern) -> Result<(), LauncherError> {
    let mut kb = load_knowledge_base()?;

    if let Some(existing) = kb.iter_mut().find(|p| p.signature == pattern.signature && p.mod_context == pattern.mod_context) {
        existing.occurrences += 1;
        if pattern.confidence > existing.confidence {
            existing.confidence = pattern.confidence;
            existing.cause = pattern.cause.clone();
            existing.fix = pattern.fix.clone();
            existing.source = pattern.source.clone();
        }
    } else {
        kb.push(pattern.clone());
    }

    save_knowledge_base(&kb)
}

pub fn get_pattern_stats() -> Result<HashMap<String, u64>, LauncherError> {
    let kb = load_knowledge_base()?;
    let mut stats = HashMap::new();
    for pattern in &kb {
        *stats.entry(pattern.signature.clone()).or_insert(0) += pattern.occurrences;
    }
    Ok(stats)
}
