pub mod steps;
pub mod modpack_install;
pub mod crash_fix;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
    RollingBack,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowType {
    ModpackInstall,
    CrashFix,
    BatchModInstall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowHandle {
    pub id: String,
    pub workflow_type: WorkflowType,
    pub status: WorkflowStatus,
    pub current_step: u32,
    pub total_steps: u32,
    pub step_name: String,
    pub snapshot_id: Option<String>,
    pub error_message: Option<String>,
    pub started_at: String,
}

pub struct WorkflowEngine {
    active_workflows: Arc<Mutex<HashMap<String, WorkflowHandle>>>,
    cancel_tokens: Arc<Mutex<HashMap<String, tokio_util::sync::CancellationToken>>>,
}

impl WorkflowEngine {
    pub fn new() -> Self {
        WorkflowEngine {
            active_workflows: Arc::new(Mutex::new(HashMap::new())),
            cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register(&self, handle: WorkflowHandle) {
        let mut workflows = self.active_workflows.lock().await;
        workflows.insert(handle.id.clone(), handle);
    }

    pub async fn update_step(&self, workflow_id: &str, step: u32, step_name: &str) -> Result<(), crate::error::LauncherError> {
        let mut workflows = self.active_workflows.lock().await;
        if let Some(handle) = workflows.get_mut(workflow_id) {
            handle.current_step = step;
            handle.step_name = step_name.to_string();
            Ok(())
        } else {
            Err(crate::error::LauncherError::WorkflowNotFound(workflow_id.to_string()))
        }
    }

    pub async fn set_snapshot(&self, workflow_id: &str, snapshot_id: &str) -> Result<(), crate::error::LauncherError> {
        let mut workflows = self.active_workflows.lock().await;
        if let Some(handle) = workflows.get_mut(workflow_id) {
            handle.snapshot_id = Some(snapshot_id.to_string());
            Ok(())
        } else {
            Err(crate::error::LauncherError::WorkflowNotFound(workflow_id.to_string()))
        }
    }

    pub async fn complete(&self, workflow_id: &str) -> Result<(), crate::error::LauncherError> {
        let mut workflows = self.active_workflows.lock().await;
        if let Some(handle) = workflows.get_mut(workflow_id) {
            handle.status = WorkflowStatus::Completed;
            Ok(())
        } else {
            Err(crate::error::LauncherError::WorkflowNotFound(workflow_id.to_string()))
        }
    }

    pub async fn fail(&self, workflow_id: &str, error_message: &str) -> Result<(), crate::error::LauncherError> {
        let mut workflows = self.active_workflows.lock().await;
        if let Some(handle) = workflows.get_mut(workflow_id) {
            handle.status = WorkflowStatus::Failed;
            handle.error_message = Some(error_message.to_string());
            Ok(())
        } else {
            Err(crate::error::LauncherError::WorkflowNotFound(workflow_id.to_string()))
        }
    }

    pub async fn cancel(&self, workflow_id: &str) -> Result<(), crate::error::LauncherError> {
        let tokens = self.cancel_tokens.lock().await;
        if let Some(token) = tokens.get(workflow_id) {
            token.cancel();
        }
        drop(tokens);

        let mut workflows = self.active_workflows.lock().await;
        if let Some(handle) = workflows.get_mut(workflow_id) {
            handle.status = WorkflowStatus::Cancelled;
            Ok(())
        } else {
            Err(crate::error::LauncherError::WorkflowNotFound(workflow_id.to_string()))
        }
    }

    pub async fn set_rolling_back(&self, workflow_id: &str) -> Result<(), crate::error::LauncherError> {
        let mut workflows = self.active_workflows.lock().await;
        if let Some(handle) = workflows.get_mut(workflow_id) {
            handle.status = WorkflowStatus::RollingBack;
            Ok(())
        } else {
            Err(crate::error::LauncherError::WorkflowNotFound(workflow_id.to_string()))
        }
    }

    pub async fn get_status(&self, workflow_id: &str) -> Result<Option<WorkflowHandle>, crate::error::LauncherError> {
        let workflows = self.active_workflows.lock().await;
        Ok(workflows.get(workflow_id).cloned())
    }

    pub async fn is_cancelled(&self, workflow_id: &str) -> bool {
        let tokens = self.cancel_tokens.lock().await;
        tokens.get(workflow_id).map(|t| t.is_cancelled()).unwrap_or(false)
    }

    pub async fn insert_cancel_token(&self, workflow_id: &str, token: tokio_util::sync::CancellationToken) {
        let mut tokens = self.cancel_tokens.lock().await;
        tokens.insert(workflow_id.to_string(), token);
    }

    pub async fn remove_workflow(&self, workflow_id: &str) {
        let mut workflows = self.active_workflows.lock().await;
        workflows.remove(workflow_id);
        let mut tokens = self.cancel_tokens.lock().await;
        tokens.remove(workflow_id);
    }
}

pub fn emit_progress(app: &tauri::AppHandle, workflow_id: &str, step: u32, total_steps: u32, step_name: &str) {
    let _ = app.emit("workflow:progress", serde_json::json!({
        "workflow_id": workflow_id,
        "step": step,
        "total_steps": total_steps,
        "step_name": step_name,
        "progress": if total_steps > 0 { (step as f64 / total_steps as f64 * 100.0) as u64 } else { 0 },
    }));
}

pub fn emit_error(app: &tauri::AppHandle, workflow_id: &str, error_message: &str) {
    let _ = app.emit("workflow:error", serde_json::json!({
        "workflow_id": workflow_id,
        "error": error_message,
    }));
}

pub fn emit_complete(app: &tauri::AppHandle, workflow_id: &str) {
    let _ = app.emit("workflow:complete", serde_json::json!({
        "workflow_id": workflow_id,
    }));
}
