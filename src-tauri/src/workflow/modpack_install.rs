use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::error::LauncherError;
use crate::modrinth;
use crate::curseforge;
use crate::content;
use crate::workflow::steps;
use crate::workflow::{self, WorkflowEngine, WorkflowHandle, WorkflowStatus, WorkflowType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModPlan {
    pub slug: String,
    pub version_id: Option<String>,
    pub source: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModpackPlanRequest {
    pub name: String,
    pub game_version: String,
    pub loader_info: Option<LoaderInfo>,
    pub mods: Vec<ModPlan>,
    pub jvm_config: Option<JvmConfig>,
    pub estimated_size_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModpackPlan {
    pub plan_id: String,
    pub request: ModpackPlanRequest,
    pub version_url: String,
    pub computed_max_memory: u32,
    pub warnings: Vec<PlanWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderInfo {
    pub loader_type: String,
    pub loader_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JvmConfig {
    pub max_memory: Option<u32>,
    pub min_memory: Option<u32>,
    pub jvm_args: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanWarning {
    pub code: String,
    pub message: String,
}

pub async fn generate_modpack_plan(request: ModpackPlanRequest) -> Result<ModpackPlan, LauncherError> {
    steps::pre_flight_check(&request.game_version, request.estimated_size_mb, request.mods.len() as u32).await?;

    let versions = crate::version::manifest::fetch_versions_sorted().await?;
    let version_entry = versions
        .iter()
        .find(|v| v.id == request.game_version)
        .ok_or_else(|| LauncherError::VersionNotFound(request.game_version.clone()))?;
    let version_url = version_entry.url.clone();

    let mod_count = request.mods.len() as u32;
    let computed_max_memory = request
        .jvm_config
        .as_ref()
        .and_then(|c| c.max_memory)
        .unwrap_or_else(|| {
            let base: u32 = 2048;
            let per_mod: u32 = 64;
            (base + mod_count * per_mod).min(16384)
        });

    let mut warnings = Vec::new();
    if mod_count > 100 {
        warnings.push(PlanWarning {
            code: "many_mods".to_string(),
            message: format!("{} mods may cause performance issues", mod_count),
        });
    }
    if computed_max_memory > 8192 {
        warnings.push(PlanWarning {
            code: "high_memory".to_string(),
            message: format!("Allocating {}MB memory", computed_max_memory),
        });
    }

    let plan_id = uuid::Uuid::new_v4().to_string();

    Ok(ModpackPlan {
        plan_id,
        request,
        version_url,
        computed_max_memory,
        warnings,
    })
}

pub async fn execute_modpack_plan(
    app: tauri::AppHandle,
    engine: &WorkflowEngine,
    plan: ModpackPlan,
) -> Result<String, LauncherError> {
    let workflow_id = plan.plan_id.clone();
    let cancel_token = tokio_util::sync::CancellationToken::new();
    engine.insert_cancel_token(&workflow_id, cancel_token.clone()).await;

    let handle = WorkflowHandle {
        id: workflow_id.clone(),
        workflow_type: WorkflowType::ModpackInstall,
        status: WorkflowStatus::Running,
        current_step: 0,
        total_steps: 7,
        step_name: "Starting".to_string(),
        snapshot_id: None,
        error_message: None,
        started_at: chrono::Utc::now().to_rfc3339(),
    };
    engine.register(handle).await;

    let total_steps = 7u32;

    macro_rules! check_cancel {
        () => {
            if engine.is_cancelled(&workflow_id).await {
                engine.fail(&workflow_id, "Cancelled by user").await?;
                workflow::emit_error(&app, &workflow_id, "Cancelled by user");
                return Err(LauncherError::WorkflowError("Cancelled by user".to_string()));
            }
        };
    }

    engine.update_step(&workflow_id, 1, "PreFlightCheck").await?;
    workflow::emit_progress(&app, &workflow_id, 1, total_steps, "PreFlightCheck");
    if let Err(e) = steps::pre_flight_check(
        &plan.request.game_version,
        plan.request.estimated_size_mb,
        plan.request.mods.len() as u32,
    )
    .await
    {
        engine.fail(&workflow_id, &e.to_string()).await?;
        workflow::emit_error(&app, &workflow_id, &e.to_string());
        return Err(e);
    }
    check_cancel!();

    engine.update_step(&workflow_id, 2, "CreateInstance").await?;
    workflow::emit_progress(&app, &workflow_id, 2, total_steps, "CreateInstance");
    let loader_type = plan.request.loader_info.as_ref().map(|l| l.loader_type.as_str());
    let loader_version = plan.request.loader_info.as_ref().map(|l| l.loader_version.as_str());
    let instance = match steps::create_instance_step(
        &plan.request.name,
        &plan.request.game_version,
        &plan.version_url,
        loader_type,
        loader_version,
        plan.computed_max_memory,
    ) {
        Ok(inst) => inst,
        Err(e) => {
            engine.fail(&workflow_id, &e.to_string()).await?;
            workflow::emit_error(&app, &workflow_id, &e.to_string());
            return Err(e);
        }
    };
    let instance_id = instance.id.clone();
    check_cancel!();

    engine.update_step(&workflow_id, 3, "CreateSnapshot").await?;
    workflow::emit_progress(&app, &workflow_id, 3, total_steps, "CreateSnapshot");
    match steps::create_snapshot_step(&app, &instance_id).await {
        Ok(snap_id) => {
            engine.set_snapshot(&workflow_id, &snap_id).await?;
        }
        Err(e) => {
            tracing::warn!("Snapshot creation failed (non-fatal): {}", e);
        }
    }
    check_cancel!();

    if let Some(ref loader_info) = plan.request.loader_info {
        engine.update_step(&workflow_id, 4, "InstallLoader").await?;
        workflow::emit_progress(&app, &workflow_id, 4, total_steps, "InstallLoader");
        if let Err(e) = steps::install_loader_step(
            &app,
            &instance_id,
            &loader_info.loader_type,
            &plan.request.game_version,
            &plan.version_url,
            &loader_info.loader_version,
        )
        .await
        {
            engine.fail(&workflow_id, &e.to_string()).await?;
            workflow::emit_error(&app, &workflow_id, &e.to_string());
            return Err(e);
        }
    } else {
        engine.update_step(&workflow_id, 4, "InstallLoader").await?;
        workflow::emit_progress(&app, &workflow_id, 4, total_steps, "InstallLoader (skipped)");
    }
    check_cancel!();

    engine.update_step(&workflow_id, 5, "BatchInstallMods").await?;
    workflow::emit_progress(&app, &workflow_id, 5, total_steps, "BatchInstallMods");
    let total_mods = plan.request.mods.len();
    for (idx, mod_plan) in plan.request.mods.iter().enumerate() {
        check_cancel!();

        let mod_progress = serde_json::json!({
            "workflow_id": workflow_id,
            "mod_index": idx,
            "total_mods": total_mods,
            "slug": mod_plan.slug,
        });
        let _ = app.emit("workflow:mod_progress", mod_progress);

        let install_result = if mod_plan.source == "curseforge" {
            if let Ok(mod_id) = mod_plan.slug.parse::<u64>() {
                let versions = curseforge::get_mod_versions(mod_id).await.unwrap_or_default();
                if let Some(version) = versions.first() {
                    if let Some(file) = version.files.first() {
                        modrinth::download_content_file_with_progress(
                            &file.url,
                            &file.filename,
                            &instance_id,
                            &mod_plan.content_type,
                            file.hashes.sha1.as_deref(),
                            Some(&mod_plan.slug),
                            Some(&app),
                        )
                        .await
                    } else {
                        Err(LauncherError::ModCompatError(format!(
                            "No files for CF mod {}",
                            mod_plan.slug
                        )))
                    }
                } else {
                    Err(LauncherError::ModCompatError(format!(
                        "No versions for CF mod {}",
                        mod_plan.slug
                    )))
                }
            } else {
                Err(LauncherError::ModCompatError(format!(
                    "Invalid CF mod ID: {}",
                    mod_plan.slug
                )))
            }
        } else {
            let versions = modrinth::get_mod_versions(
                &mod_plan.slug,
                Some(&plan.request.game_version),
                plan.request.loader_info.as_ref().map(|l| l.loader_type.as_str()),
            )
            .await
            .unwrap_or_default();

            if let Some(version) = versions.first() {
                if let Some(file) = version.files.first() {
                    modrinth::download_content_file_with_progress(
                        &file.url,
                        &file.filename,
                        &instance_id,
                        &mod_plan.content_type,
                        file.hashes.sha1.as_deref(),
                        Some(&mod_plan.slug),
                        Some(&app),
                    )
                    .await
                } else {
                    Err(LauncherError::ModCompatError(format!(
                        "No files for mod {}",
                        mod_plan.slug
                    )))
                }
            } else {
                Err(LauncherError::ModCompatError(format!(
                    "No versions for mod {}",
                    mod_plan.slug
                )))
            }
        };

        match install_result {
            Ok(path) => {
                let filename = std::path::Path::new(&path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                if let Err(e) = content::record_install(
                    &instance_id,
                    &filename,
                    &mod_plan.slug,
                    mod_plan.version_id.as_deref(),
                    &mod_plan.content_type,
                    &mod_plan.source,
                ) {
                    tracing::warn!("Failed to record install for {}: {}", mod_plan.slug, e);
                }
            }
            Err(e) => {
                tracing::warn!("Failed to install mod {}: {}", mod_plan.slug, e);
            }
        }
    }
    check_cancel!();

    engine.update_step(&workflow_id, 6, "ApplyJvmConfig").await?;
    workflow::emit_progress(&app, &workflow_id, 6, total_steps, "ApplyJvmConfig");
    let max_mem = plan.computed_max_memory;
    let min_mem = plan.request.jvm_config.as_ref().and_then(|c| c.min_memory).unwrap_or(512);
    let jvm_args = plan.request.jvm_config.as_ref().and_then(|c| c.jvm_args.clone());
    if let Err(e) = steps::apply_jvm_config_step(&instance_id, max_mem, min_mem, jvm_args.as_deref()) {
        engine.fail(&workflow_id, &e.to_string()).await?;
        workflow::emit_error(&app, &workflow_id, &e.to_string());
        return Err(e);
    }
    check_cancel!();

    engine.update_step(&workflow_id, 7, "VerifyInstance").await?;
    workflow::emit_progress(&app, &workflow_id, 7, total_steps, "VerifyInstance");
    if let Err(e) = steps::verify_instance_step(&instance_id) {
        engine.fail(&workflow_id, &e.to_string()).await?;
        workflow::emit_error(&app, &workflow_id, &e.to_string());
        return Err(e);
    }

    engine.complete(&workflow_id).await?;
    workflow::emit_complete(&app, &workflow_id);
    engine.remove_workflow(&workflow_id).await;

    Ok(instance_id)
}
