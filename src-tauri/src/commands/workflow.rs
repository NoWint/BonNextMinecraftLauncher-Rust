use tauri::State;

use crate::error::LauncherError;
use crate::mod_compat::{self, CompatibilityReport, ModRef};
use crate::workflow::crash_fix::{self, FixPlan};
use crate::workflow::modpack_install::{self, ModpackPlan, ModpackPlanRequest};
use crate::workflow::{WorkflowEngine, WorkflowHandle};

pub struct WorkflowState(pub WorkflowEngine);

#[tauri::command]
pub async fn generate_modpack_plan(
    request: ModpackPlanRequest,
) -> Result<ModpackPlan, LauncherError> {
    modpack_install::generate_modpack_plan(request).await
}

#[tauri::command]
pub async fn execute_modpack_plan(
    app: tauri::AppHandle,
    engine: State<'_, WorkflowState>,
    plan: ModpackPlan,
) -> Result<String, LauncherError> {
    modpack_install::execute_modpack_plan(app, &engine.0, plan).await
}

#[tauri::command]
pub async fn execute_crash_fix(
    app: tauri::AppHandle,
    engine: State<'_, WorkflowState>,
    instance_id: String,
    fix_plan: FixPlan,
) -> Result<String, LauncherError> {
    let _ = instance_id;
    crash_fix::execute_crash_fix(app, &engine.0, fix_plan).await
}

#[tauri::command]
pub async fn abort_workflow(
    engine: State<'_, WorkflowState>,
    workflow_id: String,
) -> Result<(), LauncherError> {
    engine.0.cancel(&workflow_id).await
}

#[tauri::command]
pub async fn get_workflow_status(
    engine: State<'_, WorkflowState>,
    workflow_id: String,
) -> Result<WorkflowHandle, LauncherError> {
    engine
        .0
        .get_status(&workflow_id)
        .await?
        .ok_or(LauncherError::WorkflowNotFound(workflow_id))
}

#[tauri::command]
pub async fn rollback_workflow(
    engine: State<'_, WorkflowState>,
    workflow_id: String,
) -> Result<(), LauncherError> {
    engine.0.set_rolling_back(&workflow_id).await
}

#[tauri::command]
pub async fn check_mod_compatibility(
    mods: Vec<ModRef>,
    game_version: String,
    loader_type: Option<String>,
) -> Result<CompatibilityReport, LauncherError> {
    let loader = loader_type.as_deref().unwrap_or("fabric");
    mod_compat::check_compatibility(&mods, &game_version, loader).await
}
