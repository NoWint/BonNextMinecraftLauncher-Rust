use serde::{Deserialize, Serialize};

use crate::error::LauncherError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModRef {
    pub slug: String,
    pub version_id: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityReport {
    pub score: u32,
    pub conflicts: Vec<ConflictEntry>,
    pub missing_deps: Vec<MissingDepEntry>,
    pub warnings: Vec<WarningEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictEntry {
    pub mod_a: String,
    pub mod_b: String,
    pub reason: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingDepEntry {
    pub mod_slug: String,
    pub missing_dep: String,
    pub dep_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarningEntry {
    pub mod_slug: String,
    pub message: String,
}

struct KnownConflict {
    mod_a: &'static str,
    mod_b: &'static str,
    reason: &'static str,
    severity: &'static str,
}

const KNOWN_CONFLICTS: &[KnownConflict] = &[
    KnownConflict {
        mod_a: "sodium",
        mod_b: "optifine",
        reason: "Sodium and OptiFine are incompatible rendering engines",
        severity: "critical",
    },
    KnownConflict {
        mod_a: "lithium",
        mod_b: "optifine",
        reason: "Lithium optimizations conflict with OptiFine patches",
        severity: "high",
    },
    KnownConflict {
        mod_a: "iris",
        mod_b: "optifine",
        reason: "Iris (Sodium shader mod) conflicts with OptiFine",
        severity: "critical",
    },
    KnownConflict {
        mod_a: "sodium",
        mod_b: "optifabric",
        reason: "OptiFabric requires OptiFine which conflicts with Sodium",
        severity: "critical",
    },
    KnownConflict {
        mod_a: "rubidium",
        mod_b: "optifine",
        reason: "Rubidium (Forge Sodium port) conflicts with OptiFine",
        severity: "critical",
    },
    KnownConflict {
        mod_a: "phosphor",
        mod_b: "starlight",
        reason: "Both Phosphor and Starlight modify lighting engine",
        severity: "high",
    },
    KnownConflict {
        mod_a: "canvas-renderer",
        mod_b: "sodium",
        reason: "Canvas and Sodium are both rendering engines",
        severity: "critical",
    },
    KnownConflict {
        mod_a: "fabric-api",
        mod_b: "forge",
        reason: "Fabric API is not compatible with Forge",
        severity: "critical",
    },
];

pub async fn check_compatibility(
    mods: &[ModRef],
    game_version: &str,
    loader_type: &str,
) -> Result<CompatibilityReport, LauncherError> {
    let mut conflicts = Vec::new();
    let mut missing_deps = Vec::new();
    let mut warnings = Vec::new();

    let slugs: Vec<&str> = mods.iter().map(|m| m.slug.as_str()).collect();

    for conflict in KNOWN_CONFLICTS {
        let has_a = slugs.iter().any(|s| *s == conflict.mod_a);
        let has_b = slugs.iter().any(|s| *s == conflict.mod_b);
        if has_a && has_b {
            conflicts.push(ConflictEntry {
                mod_a: conflict.mod_a.to_string(),
                mod_b: conflict.mod_b.to_string(),
                reason: conflict.reason.to_string(),
                severity: conflict.severity.to_string(),
            });
        }
    }

    if loader_type == "forge" {
        for m in mods.iter() {
            if m.slug.contains("fabric") && m.slug != "fabric-api" {
                warnings.push(WarningEntry {
                    mod_slug: m.slug.clone(),
                    message: "This mod may be Fabric-only and incompatible with Forge".to_string(),
                });
            }
        }
    }
    if loader_type == "fabric" {
        for m in mods.iter() {
            if m.slug.contains("forge") {
                warnings.push(WarningEntry {
                    mod_slug: m.slug.clone(),
                    message: "This mod may be Forge-only and incompatible with Fabric".to_string(),
                });
            }
        }
    }

    for m in mods.iter() {
        if m.source == "modrinth" {
            let versions = crate::modrinth::get_mod_versions(&m.slug, Some(game_version), Some(loader_type)).await;
            match versions {
                Ok(v) if v.is_empty() => {
                    warnings.push(WarningEntry {
                        mod_slug: m.slug.clone(),
                        message: format!("No compatible version found for {} / {}", game_version, loader_type),
                    });
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::warn!("Failed to check versions for {}: {}", m.slug, e);
                    warnings.push(WarningEntry {
                        mod_slug: m.slug.clone(),
                        message: "Could not verify version compatibility".to_string(),
                    });
                }
            }
        }
    }

    let conflict_penalty: u32 = conflicts.iter().map(|c| match c.severity.as_str() {
        "critical" => 30,
        "high" => 20,
        "medium" => 10,
        _ => 5,
    }).sum();

    let warning_penalty: u32 = (warnings.len() as u32) * 5;
    let missing_penalty: u32 = (missing_deps.len() as u32) * 15;

    let score = 100u32.saturating_sub(conflict_penalty).saturating_sub(warning_penalty).saturating_sub(missing_penalty);

    Ok(CompatibilityReport {
        score,
        conflicts,
        missing_deps,
        warnings,
    })
}
