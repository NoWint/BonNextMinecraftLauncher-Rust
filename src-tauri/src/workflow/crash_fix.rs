use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::crash_parser;
use crate::crash_knowledge;
use crate::error::LauncherError;
use crate::workflow::steps;
use crate::workflow::{self, WorkflowEngine, WorkflowHandle, WorkflowStatus, WorkflowType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixAction {
    pub action_type: String,
    pub description: String,
    pub target: Option<String>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixPlan {
    pub instance_id: String,
    pub crash_report_path: String,
    pub diagnosis: crash_parser::CrashDiagnosis,
    pub actions: Vec<FixAction>,
    pub workflow_id: String,
}

pub async fn generate_fix_plan(
    instance_id: &str,
    crash_report_path: &str,
) -> Result<FixPlan, LauncherError> {
    let diagnosis = crash_parser::diagnose_crash(crash_report_path)?;

    let patterns = crash_knowledge::find_matching_patterns(&diagnosis.crash_info.error_type);

    let mut actions = Vec::new();

    match diagnosis.crash_info.error_type.as_str() {
        "memory" => {
            actions.push(FixAction {
                action_type: "increase_memory".to_string(),
                description: "Increase max memory allocation".to_string(),
                target: Some("max_memory".to_string()),
                value: Some("4096".to_string()),
            });
        }
        "java_version" => {
            actions.push(FixAction {
                action_type: "update_java".to_string(),
                description: "Update Java to a compatible version".to_string(),
                target: Some("java_path".to_string()),
                value: None,
            });
        }
        "mod_conflict" => {
            actions.push(FixAction {
                action_type: "remove_conflicting_mods".to_string(),
                description: "Remove conflicting mods identified in crash report".to_string(),
                target: None,
                value: None,
            });
        }
        "mod_dependency" => {
            actions.push(FixAction {
                action_type: "install_missing_deps".to_string(),
                description: "Install missing mod dependencies".to_string(),
                target: None,
                value: None,
            });
        }
        "loader_error" => {
            actions.push(FixAction {
                action_type: "reinstall_loader".to_string(),
                description: "Reinstall the mod loader".to_string(),
                target: None,
                value: None,
            });
        }
        "missing_file" | "corrupted_file" => {
            actions.push(FixAction {
                action_type: "redownload_version".to_string(),
                description: "Re-download version files".to_string(),
                target: None,
                value: None,
            });
        }
        _ => {
            actions.push(FixAction {
                action_type: "manual_fix".to_string(),
                description: diagnosis.crash_info.suggestion.clone(),
                target: None,
                value: None,
            });
        }
    }

    for pattern in patterns {
        if !actions.iter().any(|a| a.action_type == pattern.fix) {
            actions.push(FixAction {
                action_type: pattern.fix.clone(),
                description: pattern.cause.clone(),
                target: None,
                value: None,
            });
        }
    }

    let workflow_id = uuid::Uuid::new_v4().to_string();

    Ok(FixPlan {
        instance_id: instance_id.to_string(),
        crash_report_path: crash_report_path.to_string(),
        diagnosis,
        actions,
        workflow_id,
    })
}

pub async fn execute_crash_fix(
    app: tauri::AppHandle,
    engine: &WorkflowEngine,
    fix_plan: FixPlan,
) -> Result<String, LauncherError> {
    let workflow_id = fix_plan.workflow_id.clone();
    let cancel_token = tokio_util::sync::CancellationToken::new();
    engine.insert_cancel_token(&workflow_id, cancel_token.clone()).await;

    let handle = WorkflowHandle {
        id: workflow_id.clone(),
        workflow_type: WorkflowType::CrashFix,
        status: WorkflowStatus::Running,
        current_step: 0,
        total_steps: 5,
        step_name: "Starting".to_string(),
        snapshot_id: None,
        error_message: None,
        started_at: chrono::Utc::now().to_rfc3339(),
    };
    engine.register(handle).await;

    let total_steps = 5u32;
    let instance_id = fix_plan.instance_id.clone();

    macro_rules! check_cancel {
        () => {
            if engine.is_cancelled(&workflow_id).await {
                engine.fail(&workflow_id, "Cancelled by user").await?;
                workflow::emit_error(&app, &workflow_id, "Cancelled by user");
                return Err(LauncherError::WorkflowError("Cancelled by user".to_string()));
            }
        };
    }

    engine.update_step(&workflow_id, 1, "ParseCrashReport").await?;
    workflow::emit_progress(&app, &workflow_id, 1, total_steps, "ParseCrashReport");
    let diagnosis = crash_parser::diagnose_crash(&fix_plan.crash_report_path)?;
    check_cancel!();

    engine.update_step(&workflow_id, 2, "Analyze").await?;
    workflow::emit_progress(&app, &workflow_id, 2, total_steps, "Analyze");
    let _patterns = crash_knowledge::find_matching_patterns(&diagnosis.crash_info.error_type);
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

    engine.update_step(&workflow_id, 4, "ExecuteFixes").await?;
    workflow::emit_progress(&app, &workflow_id, 4, total_steps, "ExecuteFixes");
    for action in &fix_plan.actions {
        check_cancel!();

        let action_event = serde_json::json!({
            "workflow_id": workflow_id,
            "action_type": action.action_type,
            "description": action.description,
        });
        let _ = app.emit("workflow:fix_action", action_event);

        match action.action_type.as_str() {
            "increase_memory" => {
                let new_max = action.value.as_ref().and_then(|v| v.parse::<u32>().ok()).unwrap_or(4096);
                if let Err(e) = steps::apply_jvm_config_step(&instance_id, new_max, 512, None) {
                    tracing::warn!("Failed to apply memory fix: {}", e);
                }
            }
            "reinstall_loader" => {
                if let Ok(Some(inst)) = crate::instance::manager::get_instance(&instance_id) {
                    if let (Some(lt), Some(lv)) = (&inst.loader_type, &inst.loader_version) {
                        if let Err(e) = steps::install_loader_step(
                            &app, &instance_id, lt, &inst.version_id, &inst.version_url, lv,
                        )
                        .await
                        {
                            tracing::warn!("Failed to reinstall loader: {}", e);
                        }
                    }
                }
            }
            _ => {
                tracing::info!("Manual fix action required: {} - {}", action.action_type, action.description);
            }
        }
    }
    check_cancel!();

    engine.update_step(&workflow_id, 5, "VerifyFix").await?;
    workflow::emit_progress(&app, &workflow_id, 5, total_steps, "VerifyFix");
    if let Err(e) = steps::verify_instance_step(&instance_id) {
        engine.fail(&workflow_id, &e.to_string()).await?;
        workflow::emit_error(&app, &workflow_id, &e.to_string());
        return Err(e);
    }

    crash_knowledge::record_pattern(&crash_knowledge::CrashPattern {
        signature: fix_plan.diagnosis.crash_info.error_type.clone(),
        mod_context: None,
        cause: fix_plan.diagnosis.crash_info.suggestion.clone(),
        fix: fix_plan.actions.first().map(|a| a.action_type.clone()).unwrap_or_default(),
        source: "auto".to_string(),
        confidence: 0.8,
        occurrences: 1,
    })?;

    engine.complete(&workflow_id).await?;
    workflow::emit_complete(&app, &workflow_id);
    engine.remove_workflow(&workflow_id).await;

    Ok(instance_id)
}
