use crate::content;
use crate::error::LauncherError;
use crate::modrinth;
use crate::platform::paths;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct OptimizationPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub mods: Vec<PresetMod>,
    pub min_ram_mb: u32,
    pub performance_level: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PresetMod {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApplyPresetResult {
    pub succeeded: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}

fn get_optimization_presets() -> Vec<OptimizationPreset> {
    vec![
        OptimizationPreset {
            id: "low".into(),
            name: "低配优化".into(),
            description: "适合4-8GB内存的电脑，安装Sodium等核心优化模组".into(),
            mods: vec![
                PresetMod { slug: "sodium".into(), name: "Sodium".into() },
                PresetMod { slug: "lithium".into(), name: "Lithium".into() },
                PresetMod { slug: "starlight".into(), name: "Starlight".into() },
                PresetMod { slug: "ferritecore".into(), name: "FerriteCore".into() },
                PresetMod { slug: "modernfix".into(), name: "ModernFix".into() },
            ],
            min_ram_mb: 4096,
            performance_level: "low".into(),
        },
        OptimizationPreset {
            id: "medium".into(),
            name: "中配优化".into(),
            description: "适合8-16GB内存的电脑，在低配基础上增加光影和视觉优化".into(),
            mods: vec![
                PresetMod { slug: "sodium".into(), name: "Sodium".into() },
                PresetMod { slug: "lithium".into(), name: "Lithium".into() },
                PresetMod { slug: "starlight".into(), name: "Starlight".into() },
                PresetMod { slug: "ferritecore".into(), name: "FerriteCore".into() },
                PresetMod { slug: "modernfix".into(), name: "ModernFix".into() },
                PresetMod { slug: "iris".into(), name: "Iris Shaders".into() },
                PresetMod { slug: "indium".into(), name: "Indium".into() },
                PresetMod { slug: "entityculling".into(), name: "Entity Culling".into() },
            ],
            min_ram_mb: 6144,
            performance_level: "medium".into(),
        },
        OptimizationPreset {
            id: "high".into(),
            name: "高配优化".into(),
            description: "适合16GB以上内存的电脑，全功能优化+画质增强".into(),
            mods: vec![
                PresetMod { slug: "sodium".into(), name: "Sodium".into() },
                PresetMod { slug: "lithium".into(), name: "Lithium".into() },
                PresetMod { slug: "starlight".into(), name: "Starlight".into() },
                PresetMod { slug: "ferritecore".into(), name: "FerriteCore".into() },
                PresetMod { slug: "modernfix".into(), name: "ModernFix".into() },
                PresetMod { slug: "iris".into(), name: "Iris Shaders".into() },
                PresetMod { slug: "indium".into(), name: "Indium".into() },
                PresetMod { slug: "entityculling".into(), name: "Entity Culling".into() },
                PresetMod { slug: "noisium".into(), name: "Noisium".into() },
                PresetMod { slug: "very-many-player".into(), name: "Very Many Players".into() },
                PresetMod { slug: "farsight".into(), name: "Farsight".into() },
            ],
            min_ram_mb: 8192,
            performance_level: "high".into(),
        },
    ]
}

#[tauri::command]
pub async fn get_optimization_presets_cmd() -> Vec<OptimizationPreset> {
    get_optimization_presets()
}

#[tauri::command]
pub async fn apply_optimization_preset(instance_id: String, preset_id: String) -> Result<ApplyPresetResult, LauncherError> {
    let presets = get_optimization_presets();
    let preset = presets.iter().find(|p| p.id == preset_id)
        .ok_or_else(|| LauncherError::Other(format!("Unknown preset: {}", preset_id)))?;

    let mods_dir = paths::get_instance_mods_dir(&instance_id);
    std::fs::create_dir_all(&mods_dir)?;

    let mut succeeded = 0u32;
    let mut failed = 0u32;
    let mut errors: Vec<String> = Vec::new();

    for mod_entry in &preset.mods {
        let versions = modrinth::get_mod_versions(&mod_entry.slug, None, None).await;
        match versions {
            Ok(versions) => {
                if let Some(latest) = versions.first() {
                    if let Some(file) = latest.files.first() {
                        let _dest = mods_dir.join(&file.filename);
                        let sha1 = file.hashes.sha1.clone().unwrap_or_default();
                        match modrinth::download_content_file(&file.url, &file.filename, &instance_id, "mod", Some(&sha1)).await {
                            Ok(_) => {
                                succeeded += 1;
                                if let Err(e) = content::record_install(&instance_id, &file.filename, &mod_entry.slug, Some(&latest.id), "mod", "modrinth") {
                                    tracing::warn!("Failed to record install: {}", e);
                                }
                            }
                            Err(e) => {
                                failed += 1;
                                errors.push(format!("{}: {}", mod_entry.name, e));
                            }
                        }
                    } else {
                        failed += 1;
                        errors.push(format!("{}: no download file", mod_entry.name));
                    }
                } else {
                    failed += 1;
                    errors.push(format!("{}: no versions found", mod_entry.name));
                }
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", mod_entry.name, e));
            }
        }
    }

    Ok(ApplyPresetResult { succeeded, failed, errors })
}
