# AI 智能核心增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement AI-powered modpack generation, autonomous agent execution, and enhanced crash analysis for BonNext launcher.

**Architecture:** Hybrid architecture — frontend AI Agent orchestrates query operations (search, get versions), backend Workflow Engine executes write operations (install, create instance, fix crash) with progress events, rollback, and error recovery.

**Tech Stack:** Rust (Tauri v2, tokio, notify, serde), TypeScript/React 18, OpenAI-compatible API

---

## File Structure

### New Rust files

| File | Responsibility |
|------|---------------|
| `src-tauri/src/workflow/mod.rs` | WorkflowEngine, WorkflowHandle, WorkflowStep trait, WorkflowStatus, WorkflowType |
| `src-tauri/src/workflow/steps.rs` | PreFlightCheck, CreateSnapshot, CreateInstance, InstallLoader, BatchInstallMods, ApplyJvmConfig, VerifyInstance |
| `src-tauri/src/workflow/modpack_install.rs` | ModpackInstallWorkflow — assembles steps, runs them sequentially |
| `src-tauri/src/workflow/crash_fix.rs` | CrashFixWorkflow — parse crash, analyze, snapshot, fix, verify |
| `src-tauri/src/crash_watcher.rs` | CrashWatcher — file system watcher for crash reports and logs |
| `src-tauri/src/mod_compat.rs` | ModCompatChecker — version/loader/dependency/conflict checking |
| `src-tauri/src/crash_knowledge.rs` | CrashKnowledgeBase — pattern storage, matching, recording |
| `src-tauri/src/commands/workflow.rs` | Tauri command wrappers for workflow operations |
| `src-tauri/src/commands/crash_watcher.rs` | Tauri command wrappers for crash watcher |

### New frontend files

| File | Responsibility |
|------|---------------|
| `src/components/ai/ModpackPreview.tsx` | Structured preview of ModpackPlan before installation |
| `src/components/ai/ModpackPreview.module.css` | Styles for ModpackPreview |
| `src/components/ai/WorkflowProgress.tsx` | Workflow step progress with abort/retry/rollback |
| `src/components/ai/WorkflowProgress.module.css` | Styles for WorkflowProgress |
| `src/components/ai/CrashAnalysisPanel.tsx` | Crash detection notification with one-click fix |
| `src/components/ai/CrashAnalysisPanel.module.css` | Styles for CrashAnalysisPanel |
| `src/api/workflow.ts` | Tauri IPC wrappers for workflow commands |
| `src/api/modpack.ts` | Tauri IPC wrappers for modpack plan commands |

### Modified files

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `notify`, `tokio-util` dependencies |
| `src-tauri/src/lib.rs` | Add `mod workflow; mod crash_watcher; mod mod_compat; mod crash_knowledge;` and register new commands |
| `src-tauri/src/commands/mod.rs` | Add `pub mod workflow; pub mod crash_watcher;` |
| `src-tauri/src/error.rs` | Add `WorkflowError`, `CrashWatcherError`, `ModCompatError` variants |
| `src/ai/commands.ts` | Add 4 new tools: `generate_modpack_plan`, `execute_modpack_plan`, `check_mod_conflicts`, `analyze_and_fix_crash`; update `buildSystemPrompt()` |
| `src/ai/types.ts` | Add `ModpackPlan`, `ModpackPlanRequest`, `CompatibilityReport`, `WorkflowStatusInfo`, `FixPlan` types |
| `src/stores/aiAssistantStore.tsx` | Increase max rounds to 10, add workflow event listeners, add modpack plan state |
| `src/api/index.ts` | Re-export workflow and modpack API modules |
| `src/api/types.ts` | Add shared types for workflow events |

---

## Task 1: Add Rust dependencies and error variants

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/error.rs`

- [ ] **Step 1: Add dependencies to Cargo.toml**

Add after the `rusqlite` line in `src-tauri/Cargo.toml`:

```toml
notify = { version = "7", features = ["macos_kqueue"] }
tokio-util = { version = "0.7", features = ["rt"] }
```

Note: `uuid` is already present in Cargo.toml.

- [ ] **Step 2: Add error variants to error.rs**

Add these variants to `LauncherError` enum in `src-tauri/src/error.rs`, before the `Other` variant:

```rust
    #[error("Workflow error: {0}")]
    WorkflowError(String),

    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("Workflow step failed: {step} — {reason}")]
    WorkflowStepFailed { step: String, reason: String },

    #[error("Crash watcher error: {0}")]
    CrashWatcherError(String),

    #[error("Mod compatibility error: {0}")]
    ModCompatError(String),

    #[error("Modpack plan validation failed: {0}")]
    ModpackPlanValidation(String),

    #[error("Crash knowledge base error: {0}")]
    CrashKnowledgeError(String),
```

Add corresponding `error_code()` and `Serialize` match arms:

```rust
            Self::WorkflowError(_) => "WORKFLOW_ERROR",
            Self::WorkflowNotFound(_) => "WORKFLOW_NOT_FOUND",
            Self::WorkflowStepFailed { .. } => "WORKFLOW_STEP_FAILED",
            Self::CrashWatcherError(_) => "CRASH_WATCHER_ERROR",
            Self::ModCompatError(_) => "MOD_COMPAT_ERROR",
            Self::ModpackPlanValidation(_) => "MODPACK_PLAN_VALIDATION",
            Self::CrashKnowledgeError(_) => "CRASH_KNOWLEDGE_ERROR",
```

In the `Serialize` impl, add:

```rust
            LauncherError::WorkflowError(_) => "WorkflowError",
            LauncherError::WorkflowNotFound(_) => "WorkflowNotFound",
            LauncherError::WorkflowStepFailed { .. } => "WorkflowStepFailed",
            LauncherError::CrashWatcherError(_) => "CrashWatcherError",
            LauncherError::ModCompatError(_) => "ModCompatError",
            LauncherError::ModpackPlanValidation(_) => "ModpackPlanValidation",
            LauncherError::CrashKnowledgeError(_) => "CrashKnowledgeError",
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/error.rs
git commit -m "feat: add workflow/crash-watcher dependencies and error variants"
```

---

## Task 2: Workflow Engine core

**Files:**
- Create: `src-tauri/src/workflow/mod.rs`
- Create: `src-tauri/src/workflow/steps.rs`

- [ ] **Step 1: Create workflow/mod.rs with core types and engine**

Create `src-tauri/src/workflow/mod.rs`:

```rust
pub mod steps;
pub mod modpack_install;
pub mod crash_fix;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use parking_lot::Mutex;
use serde::Serialize;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::error::LauncherError;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStatus {
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
    RollingBack,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowType {
    ModpackInstall,
    CrashFix,
    BatchModInstall,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkflowHandle {
    pub id: String,
    pub workflow_type: WorkflowType,
    pub status: WorkflowStatus,
    pub current_step: usize,
    pub total_steps: usize,
    pub step_name: String,
    pub snapshot_id: Option<String>,
    pub error_message: Option<String>,
    pub started_at: u64,
}

pub struct WorkflowEngine {
    active_workflows: Arc<Mutex<HashMap<String, WorkflowHandle>>>,
    cancel_tokens: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl WorkflowEngine {
    pub fn new() -> Self {
        WorkflowEngine {
            active_workflows: Arc::new(Mutex::new(HashMap::new())),
            cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register(&self, id: &str, workflow_type: WorkflowType, total_steps: usize) -> CancellationToken {
        let handle = WorkflowHandle {
            id: id.to_string(),
            workflow_type,
            status: WorkflowStatus::Running,
            current_step: 0,
            total_steps,
            step_name: String::new(),
            snapshot_id: None,
            error_message: None,
            started_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };
        self.active_workflows.lock().insert(id.to_string(), handle);
        let token = CancellationToken::new();
        self.cancel_tokens.lock().insert(id.to_string(), token.clone());
        token
    }

    pub fn update_step(&self, id: &str, step: usize, step_name: &str) {
        if let Some(h) = self.active_workflows.lock().get_mut(id) {
            h.current_step = step;
            h.step_name = step_name.to_string();
        }
    }

    pub fn set_snapshot(&self, id: &str, snapshot_id: &str) {
        if let Some(h) = self.active_workflows.lock().get_mut(id) {
            h.snapshot_id = Some(snapshot_id.to_string());
        }
    }

    pub fn complete(&self, id: &str) {
        if let Some(h) = self.active_workflows.lock().get_mut(id) {
            h.status = WorkflowStatus::Completed;
            h.current_step = h.total_steps;
        }
        self.cancel_tokens.lock().remove(id);
    }

    pub fn fail(&self, id: &str, error: &str) {
        if let Some(h) = self.active_workflows.lock().get_mut(id) {
            h.status = WorkflowStatus::Failed;
            h.error_message = Some(error.to_string());
        }
        self.cancel_tokens.lock().remove(id);
    }

    pub fn cancel(&self, id: &str) -> Result<(), LauncherError> {
        if let Some(token) = self.cancel_tokens.lock().get(id) {
            token.cancel();
        }
        if let Some(h) = self.active_workflows.lock().get_mut(id) {
            h.status = WorkflowStatus::Cancelled;
        }
        self.cancel_tokens.lock().remove(id);
        Ok(())
    }

    pub fn set_rolling_back(&self, id: &str) {
        if let Some(h) = self.active_workflows.lock().get_mut(id) {
            h.status = WorkflowStatus::RollingBack;
            h.step_name = "rolling_back".to_string();
        }
    }

    pub fn get_status(&self, id: &str) -> Result<WorkflowHandle, LauncherError> {
        self.active_workflows
            .lock()
            .get(id)
            .cloned()
            .ok_or_else(|| LauncherError::WorkflowNotFound(id.to_string()))
    }

    pub fn is_cancelled(&self, id: &str) -> bool {
        self.cancel_tokens
            .lock()
            .get(id)
            .map(|t| t.is_cancelled())
            .unwrap_or(true)
    }
}

fn emit_progress(app: &AppHandle, workflow_id: &str, step: usize, total: usize, step_name: &str, detail: Option<&str>) {
    let payload = serde_json::json!({
        "workflow_id": workflow_id,
        "step": step,
        "total_steps": total,
        "step_name": step_name,
        "detail": detail,
    });
    let _ = app.emit("workflow:progress", payload);
}

fn emit_error(app: &AppHandle, workflow_id: &str, step: &str, error: &str, recoverable: bool) {
    let payload = serde_json::json!({
        "workflow_id": workflow_id,
        "step": step,
        "error": error,
        "recoverable": recoverable,
    });
    let _ = app.emit("workflow:error", payload);
}

fn emit_complete(app: &AppHandle, workflow_id: &str, instance_id: Option<&str>) {
    let payload = serde_json::json!({
        "workflow_id": workflow_id,
        "result": "success",
        "instance_id": instance_id,
    });
    let _ = app.emit("workflow:complete", payload);
}
```

- [ ] **Step 2: Create workflow/steps.rs with reusable step implementations**

Create `src-tauri/src/workflow/steps.rs`:

```rust
use std::path::Path;

use tauri::AppHandle;

use crate::error::LauncherError;
use crate::instance::manager;
use crate::platform::paths;

pub fn pre_flight_check(
    game_version: &str,
    estimated_size_mb: u64,
    mod_count: usize,
) -> Result<(), LauncherError> {
    let game_dir = paths::get_game_dir();
    let available = fs_available_mb(&game_dir)?;
    let required = (estimated_size_mb as f64 * 1.5) as u64;
    if available < required {
        return Err(LauncherError::DiskSpace {
            required,
            available,
        });
    }

    let versions = crate::version::manifest::fetch_version_manifest()
        .map_err(|e| LauncherError::Other(format!("Version manifest fetch failed: {}", e)))?;
    let found = versions.versions.iter().any(|v| v.id == game_version);
    if !found {
        return Err(LauncherError::VersionNotFound(game_version.to_string()));
    }

    Ok(())
}

pub fn create_instance_step(
    name: &str,
    version_id: &str,
    version_url: &str,
    loader_type: Option<&str>,
    loader_version: Option<&str>,
    max_memory: u32,
) -> Result<manager::GameInstance, LauncherError> {
    let mut instance = manager::GameInstance::new(name, version_id, version_url);
    instance.loader_type = loader_type.map(|s| s.to_string());
    instance.loader_version = loader_version.map(|s| s.to_string());
    instance.max_memory = max_memory;
    instance.min_memory = 512;
    manager::create_instance(&instance)?;
    let instances = manager::list_instances()?;
    let created = instances.into_iter().find(|i| i.name == name);
    created.ok_or_else(|| LauncherError::Other("Instance creation succeeded but instance not found".to_string()))
}

pub fn create_snapshot_step(instance_id: &str) -> Result<String, LauncherError> {
    let snapshot_id = crate::commands::instance::create_snapshot(instance_id)?;
    Ok(snapshot_id)
}

pub fn install_loader_step(
    app: &AppHandle,
    instance_id: &str,
    loader_type: &str,
    version_id: &str,
    version_url: &str,
    loader_version: &str,
) -> Result<(), LauncherError> {
    crate::loader::install_loader(app, loader_type, version_id, version_url, loader_version, instance_id)
}

pub fn apply_jvm_config_step(
    instance_id: &str,
    max_memory: u32,
    min_memory: u32,
    jvm_args: Option<&str>,
) -> Result<(), LauncherError> {
    let mut instances = manager::list_instances()?;
    let instance = instances.iter_mut().find(|i| i.id == instance_id)
        .ok_or_else(|| LauncherError::Other(format!("Instance {} not found", instance_id)))?;
    instance.max_memory = max_memory;
    instance.min_memory = min_memory;
    if let Some(args) = jvm_args {
        instance.jvm_args = Some(args.to_string());
    }
    manager::save_instances(&instances)
}

pub fn verify_instance_step(instance_id: &str) -> Result<(), LauncherError> {
    let instances = manager::list_instances()?;
    let instance = instances.iter().find(|i| i.id == instance_id)
        .ok_or_else(|| LauncherError::InstanceNotReady(format!("Instance {} not found", instance_id)))?;
    let instance_dir = instance.dir();
    if !instance_dir.exists() {
        return Err(LauncherError::InstanceNotReady("Instance directory missing".to_string()));
    }
    Ok(())
}

fn fs_available_mb(path: &Path) -> Result<u64, LauncherError> {
    let available = fs4::free_space(path)
        .map_err(|e| LauncherError::Other(format!("Disk space check failed: {}", e)))?;
    Ok(available / (1024 * 1024))
}
```

Note: `fs4` is not yet in Cargo.toml. We'll add it in the next step or use an alternative. For now, we can use `sysinfo` which is already a dependency. Let me adjust:

Replace the `fs_available_mb` function with:

```rust
fn fs_available_mb(path: &Path) -> Result<u64, LauncherError> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let target = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let mut best_match: Option<&sysinfo::Disk> = None;
    let mut best_len = 0u64;
    for disk in &disks {
        let mount = disk.mount_point();
        if target.starts_with(mount) {
            let len = mount.to_string_lossy().len() as u64;
            if len > best_len {
                best_len = len;
                best_match = Some(disk);
            }
        }
    }
    match best_match {
        Some(disk) => Ok(disk.available_space() / (1024 * 1024)),
        None => Ok(u64::MAX),
    }
}
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: May have warnings about unused imports but no errors. Fix any compilation errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/workflow/
git commit -m "feat: add workflow engine core with types and reusable steps"
```

---

## Task 3: ModpackInstallWorkflow

**Files:**
- Create: `src-tauri/src/workflow/modpack_install.rs`

- [ ] **Step 1: Create ModpackInstallWorkflow**

Create `src-tauri/src/workflow/modpack_install.rs`:

```rust
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::LauncherError;
use super::steps;
use super::WorkflowEngine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModPlan {
    pub slug: String,
    pub name: String,
    pub version_id: String,
    pub source: String,
    pub category: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModpackPlanRequest {
    pub theme: String,
    pub game_version: String,
    pub loader_type: String,
    pub mods: Vec<ModPlan>,
    pub jvm_args: Option<String>,
    pub max_memory_mb: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModpackPlan {
    pub plan_id: String,
    pub theme: String,
    pub game_version: String,
    pub loader: LoaderInfo,
    pub mods: Vec<ModPlan>,
    pub jvm_config: JvmConfig,
    pub estimated_size_mb: u64,
    pub warnings: Vec<PlanWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderInfo {
    pub loader_type: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JvmConfig {
    pub max_memory_mb: u32,
    pub min_memory_mb: u32,
    pub jvm_args: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanWarning {
    pub warning_type: String,
    pub message: String,
}

pub fn generate_modpack_plan(request: ModpackPlanRequest) -> Result<ModpackPlan, LauncherError> {
    steps::pre_flight_check(&request.game_version, 500, request.mods.len())?;

    let max_memory = request.max_memory_mb.unwrap_or_else(|| {
        2048 + ((request.mods.len() as u32 / 10) * 256)
    });

    let loader_version = match request.loader_type.as_str() {
        "fabric" => "0.15.11",
        "forge" => "49.0.26",
        "neoforge" => "21.0.143",
        _ => "latest",
    };

    let plan_id = uuid::Uuid::new_v4().to_string();

    let warnings = Vec::new();

    Ok(ModpackPlan {
        plan_id,
        theme: request.theme,
        game_version: request.game_version,
        loader: LoaderInfo {
            loader_type: request.loader_type,
            version: loader_version.to_string(),
        },
        mods: request.mods,
        jvm_config: JvmConfig {
            max_memory_mb: max_memory,
            min_memory_mb: 512,
            jvm_args: request.jvm_args.unwrap_or_default(),
        },
        estimated_size_mb: 500,
        warnings,
    })
}

pub async fn execute_modpack_plan(
    app: AppHandle,
    engine: &WorkflowEngine,
    plan: &ModpackPlan,
) -> Result<String, LauncherError> {
    let workflow_id = plan.plan_id.clone();
    let total_steps = 7usize;
    let cancel_token = engine.register(&workflow_id, super::WorkflowType::ModpackInstall, total_steps);

    let instance_name = format!("AI: {}", plan.theme);
    let instance_id = format!("{}_{}", plan.game_version, plan.theme.replace(' ', "_"));

    // Step 1: PreFlightCheck
    engine.update_step(&workflow_id, 1, "pre_flight_check");
    super::emit_progress(&app, &workflow_id, 1, total_steps, "pre_flight_check", None);
    if let Err(e) = steps::pre_flight_check(&plan.game_version, plan.estimated_size_mb, plan.mods.len()) {
        engine.fail(&workflow_id, &e.to_string());
        super::emit_error(&app, &workflow_id, "pre_flight_check", &e.to_string(), false);
        return Err(e);
    }

    // Step 2: CreateSnapshot (skip for new instance)
    engine.update_step(&workflow_id, 2, "create_snapshot");
    super::emit_progress(&app, &workflow_id, 2, total_steps, "create_snapshot", None);

    // Step 3: CreateInstance
    engine.update_step(&workflow_id, 3, "create_instance");
    super::emit_progress(&app, &workflow_id, 3, total_steps, "create_instance", None);
    let version_url = {
        let manifest = crate::version::manifest::fetch_version_manifest()
            .map_err(|e| LauncherError::Other(format!("Version manifest fetch failed: {}", e)))?;
        manifest.versions.iter()
            .find(|v| v.id == plan.game_version)
            .map(|v| v.url.clone())
            .ok_or_else(|| LauncherError::VersionNotFound(plan.game_version.clone()))?
    };

    let instance = match steps::create_instance_step(
        &instance_name,
        &plan.game_version,
        &version_url,
        Some(&plan.loader.loader_type),
        Some(&plan.loader.version),
        plan.jvm_config.max_memory_mb,
    ) {
        Ok(inst) => inst,
        Err(e) => {
            engine.fail(&workflow_id, &e.to_string());
            super::emit_error(&app, &workflow_id, "create_instance", &e.to_string(), true);
            return Err(e);
        }
    };
    let real_instance_id = instance.id.clone();

    if cancel_token.is_cancelled() {
        engine.cancel(&workflow_id)?;
        return Ok(workflow_id);
    }

    // Step 4: InstallLoader
    engine.update_step(&workflow_id, 4, "install_loader");
    super::emit_progress(&app, &workflow_id, 4, total_steps, "install_loader", None);
    if let Err(e) = steps::install_loader_step(
        &app,
        &real_instance_id,
        &plan.loader.loader_type,
        &plan.game_version,
        &version_url,
        &plan.loader.version,
    ) {
        engine.fail(&workflow_id, &e.to_string());
        super::emit_error(&app, &workflow_id, "install_loader", &e.to_string(), true);
        return Err(e);
    }

    if cancel_token.is_cancelled() {
        engine.cancel(&workflow_id)?;
        return Ok(workflow_id);
    }

    // Step 5: BatchInstallMods
    engine.update_step(&workflow_id, 5, "batch_install_mods");
    super::emit_progress(&app, &workflow_id, 5, total_steps, "batch_install_mods", None);
    for (i, mod_plan) in plan.mods.iter().enumerate() {
        if cancel_token.is_cancelled() {
            engine.cancel(&workflow_id)?;
            return Ok(workflow_id);
        }
        let detail = format!("Installing {} ({}/{})", mod_plan.name, i + 1, plan.mods.len());
        super::emit_progress(&app, &workflow_id, 5, total_steps, "batch_install_mods", Some(&detail));

        let install_result = match mod_plan.source.as_str() {
            "curseforge" => {
                let project_id: i64 = mod_plan.slug.parse().unwrap_or(0);
                let files = crate::curseforge::get_cf_mod_files(project_id)?;
                let file = files.into_iter().next();
                match file {
                    Some(f) => crate::content::install_content(
                        &f.url,
                        &f.filename,
                        &real_instance_id,
                        "mod",
                        f.hashes.get("sha1").map(|s| s.as_str()),
                        &mod_plan.slug,
                        Some(&mod_plan.version_id),
                    ),
                    None => Err(LauncherError::Other(format!("No files found for CF mod {}", mod_plan.slug))),
                }
            }
            _ => {
                let versions = crate::modrinth::get_mod_versions(&mod_plan.slug)?;
                let target = versions.iter().find(|v| v.id == mod_plan.version_id)
                    .or_else(|| versions.first());
                match target {
                    Some(ver) => {
                        let primary = ver.files.first();
                        match primary {
                            Some(f) => crate::content::install_content(
                                &f.url,
                                &f.filename,
                                &real_instance_id,
                                "mod",
                                f.hashes.get("sha1").map(|s| s.as_str()),
                                &mod_plan.slug,
                                Some(&ver.id),
                            ),
                            None => Err(LauncherError::Other(format!("No file for mod {}", mod_plan.slug))),
                        }
                    }
                    None => Err(LauncherError::Other(format!("No version found for mod {}", mod_plan.slug))),
                }
            }
        };
        if let Err(e) = install_result {
            if mod_plan.required {
                engine.fail(&workflow_id, &e.to_string());
                super::emit_error(&app, &workflow_id, "batch_install_mods", &e.to_string(), true);
                return Err(e);
            }
        }
    }

    // Step 6: ApplyJvmConfig
    engine.update_step(&workflow_id, 6, "apply_jvm_config");
    super::emit_progress(&app, &workflow_id, 6, total_steps, "apply_jvm_config", None);
    if let Err(e) = steps::apply_jvm_config_step(
        &real_instance_id,
        plan.jvm_config.max_memory_mb,
        plan.jvm_config.min_memory_mb,
        Some(&plan.jvm_config.jvm_args),
    ) {
        engine.fail(&workflow_id, &e.to_string());
        super::emit_error(&app, &workflow_id, "apply_jvm_config", &e.to_string(), true);
        return Err(e);
    }

    // Step 7: VerifyInstance
    engine.update_step(&workflow_id, 7, "verify_instance");
    super::emit_progress(&app, &workflow_id, 7, total_steps, "verify_instance", None);
    if let Err(e) = steps::verify_instance_step(&real_instance_id) {
        engine.fail(&workflow_id, &e.to_string());
        super::emit_error(&app, &workflow_id, "verify_instance", &e.to_string(), false);
        return Err(e);
    }

    engine.complete(&workflow_id);
    super::emit_complete(&app, &workflow_id, Some(&real_instance_id));
    Ok(workflow_id)
}
```

- [ ] **Step 2: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: May need adjustments for API mismatches. Fix any compilation errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/workflow/modpack_install.rs
git commit -m "feat: add ModpackInstallWorkflow with 7-step execution"
```

---

## Task 4: CrashFixWorkflow and CrashKnowledgeBase

**Files:**
- Create: `src-tauri/src/workflow/crash_fix.rs`
- Create: `src-tauri/src/crash_knowledge.rs`

- [ ] **Step 1: Create crash_knowledge.rs**

Create `src-tauri/src/crash_knowledge.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::LauncherError;
use crate::platform::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashPattern {
    pub signature: String,
    pub mod_context: Vec<String>,
    pub cause: String,
    pub fix: String,
    pub source: String,
    pub confidence: f64,
    pub occurrences: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct KnowledgeBase {
    patterns: Vec<CrashPattern>,
}

fn kb_path() -> PathBuf {
    paths::get_game_dir().join("crash_knowledge_base.json")
}

pub fn load_knowledge_base() -> Vec<CrashPattern> {
    let path = kb_path();
    if !path.exists() {
        return Vec::new();
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    let kb: KnowledgeBase = serde_json::from_str(&content).unwrap_or(KnowledgeBase { patterns: Vec::new() });
    kb.patterns
}

pub fn save_knowledge_base(patterns: &[CrashPattern]) -> Result<(), LauncherError> {
    let path = kb_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let kb = KnowledgeBase { patterns: patterns.to_vec() };
    let content = serde_json::to_string_pretty(&kb)?;
    std::fs::write(&path, content)?;
    Ok(())
}

pub fn find_matching_patterns(error_type: &str, mod_list: &[String]) -> Vec<CrashPattern> {
    let patterns = load_knowledge_base();
    let mut matches: Vec<CrashPattern> = patterns.into_iter()
        .filter(|p| {
            if !p.signature.contains(error_type) && !error_type.contains(&p.signature) {
                return false;
            }
            let context_overlap = p.mod_context.iter()
                .any(|m| mod_list.iter().any(|lm| lm.to_lowercase().contains(&m.to_lowercase())));
            context_overlap || p.mod_context.is_empty()
        })
        .map(|mut p| {
            if p.signature == error_type {
                p.confidence = (p.confidence * 1.2).min(1.0);
            }
            p
        })
        .collect();
    matches.sort_by(|a, b| {
        (b.occurrences as f64 * b.confidence)
            .partial_cmp(&(a.occurrences as f64 * a.confidence))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    matches
}

pub fn record_pattern(signature: &str, mod_context: &[String], cause: &str, fix: &str) -> Result<(), LauncherError> {
    let mut patterns = load_knowledge_base();
    let existing = patterns.iter_mut().find(|p| {
        p.signature == signature && p.mod_context.len() == mod_context.len()
            && p.mod_context.iter().zip(mod_context.iter()).all(|(a, b)| a == b)
    });
    if let Some(p) = existing {
        p.occurrences += 1;
        p.confidence = (p.confidence + 0.01).min(1.0);
    } else {
        patterns.push(CrashPattern {
            signature: signature.to_string(),
            mod_context: mod_context.to_vec(),
            cause: cause.to_string(),
            fix: fix.to_string(),
            source: "local".to_string(),
            confidence: 0.5,
            occurrences: 1,
        });
    }
    save_knowledge_base(&patterns)
}
```

- [ ] **Step 2: Create workflow/crash_fix.rs**

Create `src-tauri/src/workflow/crash_fix.rs`:

```rust
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::error::LauncherError;
use crate::crash_parser;
use crate::crash_knowledge;
use super::steps;
use super::WorkflowEngine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixAction {
    pub action_type: String,
    pub description: String,
    pub target: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixPlan {
    pub instance_id: String,
    pub crash_report_path: String,
    pub diagnosis: crash_parser::CrashDiagnosis,
    pub fix_actions: Vec<FixAction>,
    pub knowledge_base_matches: Vec<crash_knowledge::CrashPattern>,
}

pub fn generate_fix_plan(
    instance_id: &str,
    crash_report_path: &str,
) -> Result<FixPlan, LauncherError> {
    let content = std::fs::read_to_string(crash_report_path)?;
    let diagnosis = crash_parser::diagnose_crash(&content);

    let mod_list: Vec<String> = diagnosis.additional_findings.iter()
        .filter(|f| f.category == "mod")
        .map(|f| f.finding.clone())
        .collect();

    let kb_matches = crash_knowledge::find_matching_patterns(
        &diagnosis.crash_info.error_type,
        &mod_list,
    );

    let mut fix_actions = Vec::new();

    match diagnosis.crash_info.error_type.as_str() {
        "memory" => {
            fix_actions.push(FixAction {
                action_type: "increase_memory".to_string(),
                description: "增加内存分配".to_string(),
                target: instance_id.to_string(),
                value: "4096".to_string(),
            });
        }
        "java_version" => {
            fix_actions.push(FixAction {
                action_type: "check_java".to_string(),
                description: "检查并更新 Java 版本".to_string(),
                target: instance_id.to_string(),
                value: "".to_string(),
            });
        }
        "mod_conflict" => {
            for finding in &diagnosis.additional_findings {
                if finding.category == "mod_conflict" {
                    fix_actions.push(FixAction {
                        action_type: "remove_mod".to_string(),
                        description: format!("移除冲突 Mod: {}", finding.finding),
                        target: finding.finding.clone(),
                        value: "".to_string(),
                    });
                }
            }
        }
        _ => {}
    }

    for pattern in &kb_matches {
        if pattern.confidence >= 0.8 {
            fix_actions.push(FixAction {
                action_type: "apply_kb_fix".to_string(),
                description: format!("知识库修复: {}", pattern.fix),
                target: pattern.fix.clone(),
                value: pattern.signature.clone(),
            });
        }
    }

    Ok(FixPlan {
        instance_id: instance_id.to_string(),
        crash_report_path: crash_report_path.to_string(),
        diagnosis,
        fix_actions,
        knowledge_base_matches: kb_matches,
    })
}

pub async fn execute_crash_fix(
    app: AppHandle,
    engine: &WorkflowEngine,
    fix_plan: &FixPlan,
) -> Result<String, LauncherError> {
    let workflow_id = uuid::Uuid::new_v4().to_string();
    let total_steps = 5usize;
    let _cancel_token = engine.register(&workflow_id, super::WorkflowType::CrashFix, total_steps);

    // Step 1: ParseCrashReport
    engine.update_step(&workflow_id, 1, "parse_crash_report");
    super::emit_progress(&app, &workflow_id, 1, total_steps, "parse_crash_report", None);

    // Step 2: Analyze (already done in generate_fix_plan)
    engine.update_step(&workflow_id, 2, "analyze_crash");
    super::emit_progress(&app, &workflow_id, 2, total_steps, "analyze_crash", None);

    // Step 3: CreateSnapshot
    engine.update_step(&workflow_id, 3, "create_snapshot");
    super::emit_progress(&app, &workflow_id, 3, total_steps, "create_snapshot", None);
    if let Ok(snapshot_id) = steps::create_snapshot_step(&fix_plan.instance_id) {
        engine.set_snapshot(&workflow_id, &snapshot_id);
    }

    // Step 4: ExecuteFixes
    engine.update_step(&workflow_id, 4, "execute_fixes");
    super::emit_progress(&app, &workflow_id, 4, total_steps, "execute_fixes", None);
    for action in &fix_plan.fix_actions {
        let detail = &action.description;
        super::emit_progress(&app, &workflow_id, 4, total_steps, "execute_fixes", Some(detail));
        match action.action_type.as_str() {
            "increase_memory" => {
                let new_max: u32 = action.value.parse().unwrap_or(4096);
                steps::apply_jvm_config_step(&fix_plan.instance_id, new_max, 512, None)?;
            }
            "remove_mod" => {
                let mods_dir = {
                    let instances = crate::instance::manager::list_instances()?;
                    let inst = instances.iter().find(|i| i.id == fix_plan.instance_id);
                    match inst {
                        Some(i) => i.dir().join(".minecraft").join("mods"),
                        None => continue,
                    }
                };
                if mods_dir.exists() {
                    for entry in std::fs::read_dir(&mods_dir)? {
                        let entry = entry?;
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.to_lowercase().contains(&action.target.to_lowercase()) {
                            std::fs::remove_file(entry.path())?;
                            break;
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Record to knowledge base
    let error_type = &fix_plan.diagnosis.crash_info.error_type;
    let mod_list: Vec<String> = fix_plan.diagnosis.additional_findings.iter()
        .filter(|f| f.category == "mod")
        .map(|f| f.finding.clone())
        .collect();
    let _ = crash_knowledge::record_pattern(
        error_type,
        &mod_list,
        &fix_plan.diagnosis.crash_info.description,
        &fix_plan.diagnosis.crash_info.suggestion,
    );

    // Step 5: VerifyFix
    engine.update_step(&workflow_id, 5, "verify_fix");
    super::emit_progress(&app, &workflow_id, 5, total_steps, "verify_fix", None);
    steps::verify_instance_step(&fix_plan.instance_id)?;

    engine.complete(&workflow_id);
    super::emit_complete(&app, &workflow_id, Some(&fix_plan.instance_id));
    Ok(workflow_id)
}
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: May need adjustments for API mismatches. Fix any compilation errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/workflow/crash_fix.rs src-tauri/src/crash_knowledge.rs
git commit -m "feat: add CrashFixWorkflow and CrashKnowledgeBase"
```

---

## Task 5: CrashWatcher and ModCompatChecker

**Files:**
- Create: `src-tauri/src/crash_watcher.rs`
- Create: `src-tauri/src/mod_compat.rs`

- [ ] **Step 1: Create crash_watcher.rs**

Create `src-tauri/src/crash_watcher.rs`:

```rust
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use tauri::AppHandle;

use crate::error::LauncherError;
use crate::instance::manager;

pub struct CrashWatcherState {
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
}

impl CrashWatcherState {
    pub fn new() -> Self {
        CrashWatcherState {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub fn start_crash_watcher(
    app: AppHandle,
    state: &CrashWatcherState,
    instance_id: &str,
) -> Result<(), LauncherError> {
    let instances = manager::list_instances()?;
    let instance = instances.iter().find(|i| i.id == instance_id)
        .ok_or_else(|| LauncherError::Other(format!("Instance {} not found", instance_id)))?;

    let crash_dir = instance.dir().join(".minecraft").join("crash-reports");
    let logs_dir = instance.dir().join(".minecraft").join("logs");

    if !crash_dir.exists() {
        std::fs::create_dir_all(&crash_dir)?;
    }

    let instance_id_clone = instance_id.to_string();
    let app_clone = app.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    if matches!(event.kind, EventKind::Create(_)) {
                        for path in &event.paths {
                            let path_str = path.to_string_lossy();
                            if path_str.ends_with(".txt") && path_str.contains("crash-report") {
                                let payload = serde_json::json!({
                                    "instance_id": instance_id_clone,
                                    "crash_report_path": path_str,
                                    "severity": "fatal",
                                    "timestamp": chrono::Local::now().to_rfc3339(),
                                });
                                let _ = app_clone.emit("crash:detected", payload);
                            }
                        }
                    }
                }
                Err(_) => {}
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(2)),
    ).map_err(|e| LauncherError::CrashWatcherError(e.to_string()))?;

    watcher.watch(&crash_dir, RecursiveMode::NonRecursive)
        .map_err(|e| LauncherError::CrashWatcherError(e.to_string()))?;

    if logs_dir.exists() {
        let _ = watcher.watch(&logs_dir, RecursiveMode::NonRecursive);
    }

    state.watchers.lock().insert(instance_id.to_string(), watcher);
    Ok(())
}

pub fn stop_crash_watcher(
    state: &CrashWatcherState,
    instance_id: &str,
) -> Result<(), LauncherError> {
    state.watchers.lock().remove(instance_id);
    Ok(())
}
```

- [ ] **Step 2: Create mod_compat.rs**

Create `src-tauri/src/mod_compat.rs`:

```rust
use serde::Serialize;

use crate::error::LauncherError;

#[derive(Debug, Clone, Serialize)]
pub struct CompatibilityReport {
    pub conflicts: Vec<ConflictEntry>,
    pub missing_deps: Vec<MissingDepEntry>,
    pub warnings: Vec<WarningEntry>,
    pub score: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConflictEntry {
    pub mod_a: String,
    pub mod_b: String,
    pub reason: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MissingDepEntry {
    pub mod_slug: String,
    pub required_by: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WarningEntry {
    pub mod_slug: String,
    pub issue: String,
}

pub fn check_compatibility(
    mods: &[ModRef],
    game_version: &str,
    loader_type: Option<&str>,
) -> Result<CompatibilityReport, LauncherError> {
    let mut conflicts = Vec::new();
    let mut missing_deps = Vec::new();
    let mut warnings = Vec::new();

    let known_conflicts = get_known_conflicts();

    for (i, mod_a) in mods.iter().enumerate() {
        for mod_b in mods.iter().skip(i + 1) {
            for conflict in &known_conflicts {
                let matches = (conflict.0 == mod_a.slug && conflict.1 == mod_b.slug)
                    || (conflict.0 == mod_b.slug && conflict.1 == mod_a.slug);
                if matches {
                    conflicts.push(ConflictEntry {
                        mod_a: mod_a.slug.clone(),
                        mod_b: mod_b.slug.clone(),
                        reason: conflict.2.to_string(),
                        severity: conflict.3.to_string(),
                    });
                }
            }
        }

        if let Some(source) = mod_a.source.as_deref() {
            if source == "modrinth" {
                if let Ok(versions) = crate::modrinth::get_mod_versions(&mod_a.slug) {
                    let compatible = versions.iter().any(|v| {
                        v.game_versions.iter().any(|gv| gv == game_version)
                            && (loader_type.is_none() || v.loaders.iter().any(|l| Some(l.as_str()) == loader_type))
                    });
                    if !compatible {
                        warnings.push(WarningEntry {
                            mod_slug: mod_a.slug.clone(),
                            issue: format!("可能不支持 {} / {}", game_version, loader_type.unwrap_or("unknown")),
                        });
                    }
                }
            }
        }
    }

    let conflict_count = conflicts.len() as u32;
    let warning_count = warnings.len() as u32;
    let score = 100u32.saturating_sub(conflict_count * 25).saturating_sub(warning_count * 5);

    Ok(CompatibilityReport {
        conflicts,
        missing_deps,
        warnings,
        score,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModRef {
    pub slug: String,
    pub version_id: String,
    pub source: Option<String>,
}

fn get_known_conflicts() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        ("sodium", "optifine", "Sodium 和 OptiFine 不兼容，请使用 Sodium 替代 OptiFine", "error"),
        ("lithium", "optifine", "Lithium 和 OptiFine 不兼容", "error"),
        ("rubidium", "optifine", "Rubidium 和 OptiFine 不兼容", "error"),
        ("embeddium", "optifine", "Embeddium 和 OptiFine 不兼容，请使用 Embeddium 替代 OptiFine", "error"),
        ("create", "flywheel", "Create 需要 Flywheel，版本必须匹配", "warning"),
        ("sodium", "indium", "Indium 是 Sodium 的依赖，建议同时安装", "warning"),
    ]
}
```

- [ ] **Step 3: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: May need adjustments. Fix any compilation errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/crash_watcher.rs src-tauri/src/mod_compat.rs
git commit -m "feat: add CrashWatcher and ModCompatChecker"
```

---

## Task 6: Tauri command wrappers and module registration

**Files:**
- Create: `src-tauri/src/commands/workflow.rs`
- Create: `src-tauri/src/commands/crash_watcher.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create commands/workflow.rs**

Create `src-tauri/src/commands/workflow.rs`:

```rust
use tauri::State;

use crate::error::LauncherError;
use crate::workflow::modpack_install::{self, ModpackPlan, ModpackPlanRequest};
use crate::workflow::crash_fix::{self, FixPlan};
use crate::workflow::WorkflowEngine;
use crate::mod_compat::{self, ModRef, CompatibilityReport};
use crate::crash_watcher::CrashWatcherState;

pub struct WorkflowState(pub WorkflowEngine);

#[tauri::command]
pub async fn generate_modpack_plan(
    request: ModpackPlanRequest,
) -> Result<ModpackPlan, LauncherError> {
    modpack_install::generate_modpack_plan(request)
}

#[tauri::command]
pub async fn execute_modpack_plan(
    app: tauri::AppHandle,
    engine: State<'_, WorkflowState>,
    plan: ModpackPlan,
) -> Result<String, LauncherError> {
    modpack_install::execute_modpack_plan(app, &engine.0, &plan).await
}

#[tauri::command]
pub async fn execute_crash_fix(
    app: tauri::AppHandle,
    engine: State<'_, WorkflowState>,
    instance_id: String,
    fix_plan: FixPlan,
) -> Result<String, LauncherError> {
    crash_fix::execute_crash_fix(app, &engine.0, &fix_plan).await
}

#[tauri::command]
pub async fn abort_workflow(
    engine: State<'_, WorkflowState>,
    workflow_id: String,
) -> Result<(), LauncherError> {
    engine.0.cancel(&workflow_id)
}

#[tauri::command]
pub async fn get_workflow_status(
    engine: State<'_, WorkflowState>,
    workflow_id: String,
) -> Result<crate::workflow::WorkflowHandle, LauncherError> {
    engine.0.get_status(&workflow_id)
}

#[tauri::command]
pub async fn rollback_workflow(
    engine: State<'_, WorkflowState>,
    workflow_id: String,
) -> Result<(), LauncherError> {
    let handle = engine.0.get_status(&workflow_id)?;
    if let Some(snapshot_id) = &handle.snapshot_id {
        crate::commands::instance::restore_snapshot(&handle.id, snapshot_id)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn check_mod_compatibility(
    mods: Vec<ModRef>,
    game_version: String,
    loader_type: Option<String>,
) -> Result<CompatibilityReport, LauncherError> {
    mod_compat::check_compatibility(&mods, &game_version, loader_type.as_deref())
}
```

- [ ] **Step 2: Create commands/crash_watcher.rs**

Create `src-tauri/src/commands/crash_watcher.rs`:

```rust
use tauri::State;

use crate::error::LauncherError;
use crate::crash_watcher::{self, CrashWatcherState};

#[tauri::command]
pub async fn start_crash_watcher(
    app: tauri::AppHandle,
    state: State<'_, CrashWatcherState>,
    instance_id: String,
) -> Result<(), LauncherError> {
    crash_watcher::start_crash_watcher(app, &state, &instance_id)
}

#[tauri::command]
pub async fn stop_crash_watcher(
    state: State<'_, CrashWatcherState>,
    instance_id: String,
) -> Result<(), LauncherError> {
    crash_watcher::stop_crash_watcher(&state, &instance_id)
}
```

- [ ] **Step 3: Update commands/mod.rs**

Add to `src-tauri/src/commands/mod.rs`:

```rust
pub mod workflow;
pub mod crash_watcher;
```

- [ ] **Step 4: Update lib.rs — add modules and register commands**

Add module declarations after existing ones in `src-tauri/src/lib.rs`:

```rust
mod workflow;
mod crash_watcher;
mod mod_compat;
mod crash_knowledge;
```

Add `.manage()` calls in the `run()` function after existing `.manage()` calls:

```rust
.manage(commands::workflow::WorkflowState(WorkflowEngine::new()))
.manage(CrashWatcherState::new())
```

Add command registrations to `invoke_handler`:

```rust
commands::workflow::generate_modpack_plan,
commands::workflow::execute_modpack_plan,
commands::workflow::execute_crash_fix,
commands::workflow::abort_workflow,
commands::workflow::get_workflow_status,
commands::workflow::rollback_workflow,
commands::workflow::check_mod_compatibility,
commands::crash_watcher::start_crash_watcher,
commands::crash_watcher::stop_crash_watcher,
```

- [ ] **Step 5: Run cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: `Finished` with no errors. Fix any compilation errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/workflow.rs src-tauri/src/commands/crash_watcher.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: register workflow and crash watcher Tauri commands"
```

---

## Task 7: Frontend API layer for workflow

**Files:**
- Create: `src/api/workflow.ts`
- Create: `src/api/modpack.ts`
- Modify: `src/api/index.ts`
- Modify: `src/api/types.ts`

- [ ] **Step 1: Add types to api/types.ts**

Add these types at the end of `src/api/types.ts`:

```typescript
export interface ModpackPlan {
  plan_id: string;
  theme: string;
  game_version: string;
  loader: { loader_type: string; version: string };
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_config: { max_memory_mb: number; min_memory_mb: number; jvm_args: string };
  estimated_size_mb: number;
  warnings: Array<{ warning_type: string; message: string }>;
}

export interface ModpackPlanRequest {
  theme: string;
  game_version: string;
  loader_type: string;
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_args?: string;
  max_memory_mb?: number;
}

export interface WorkflowHandle {
  id: string;
  workflow_type: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'rolling_back';
  current_step: number;
  total_steps: number;
  step_name: string;
  snapshot_id: string | null;
  error_message: string | null;
  started_at: number;
}

export interface CompatibilityReport {
  conflicts: Array<{ mod_a: string; mod_b: string; reason: string; severity: string }>;
  missing_deps: Array<{ mod_slug: string; required_by: string }>;
  warnings: Array<{ mod_slug: string; issue: string }>;
  score: number;
}

export interface FixPlan {
  instance_id: string;
  crash_report_path: string;
  diagnosis: CrashDiagnosis;
  fix_actions: Array<{ action_type: string; description: string; target: string; value: string }>;
  knowledge_base_matches: Array<{
    signature: string;
    mod_context: string[];
    cause: string;
    fix: string;
    source: string;
    confidence: number;
    occurrences: number;
  }>;
}

export interface WorkflowProgressEvent {
  workflow_id: string;
  step: number;
  total_steps: number;
  step_name: string;
  detail?: string;
}

export interface WorkflowErrorEvent {
  workflow_id: string;
  step: string;
  error: string;
  recoverable: boolean;
}

export interface WorkflowCompleteEvent {
  workflow_id: string;
  result: string;
  instance_id?: string;
}

export interface CrashDetectedEvent {
  instance_id: string;
  crash_report_path: string;
  severity: 'fatal' | 'warning';
  timestamp: string;
}
```

- [ ] **Step 2: Create api/workflow.ts**

Create `src/api/workflow.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  ModpackPlan,
  ModpackPlanRequest,
  WorkflowHandle,
  FixPlan,
  WorkflowProgressEvent,
  WorkflowErrorEvent,
  WorkflowCompleteEvent,
  CrashDetectedEvent,
} from './types';

export const workflowApi = {
  generateModpackPlan: (request: ModpackPlanRequest) =>
    invoke<ModpackPlan>('generate_modpack_plan', { request }),

  executeModpackPlan: (plan: ModpackPlan) =>
    invoke<string>('execute_modpack_plan', { plan }),

  executeCrashFix: (instanceId: string, fixPlan: FixPlan) =>
    invoke<string>('execute_crash_fix', { instanceId, fixPlan }),

  abortWorkflow: (workflowId: string) =>
    invoke<void>('abort_workflow', { workflowId }),

  getWorkflowStatus: (workflowId: string) =>
    invoke<WorkflowHandle>('get_workflow_status', { workflowId }),

  rollbackWorkflow: (workflowId: string) =>
    invoke<void>('rollback_workflow', { workflowId }),

  startCrashWatcher: (instanceId: string) =>
    invoke<void>('start_crash_watcher', { instanceId }),

  stopCrashWatcher: (instanceId: string) =>
    invoke<void>('stop_crash_watcher', { instanceId }),

  onWorkflowProgress: (handler: (event: WorkflowProgressEvent) => void) =>
    listen<WorkflowProgressEvent>('workflow:progress', (e) => handler(e.payload)),

  onWorkflowError: (handler: (event: WorkflowErrorEvent) => void) =>
    listen<WorkflowErrorEvent>('workflow:error', (e) => handler(e.payload)),

  onWorkflowComplete: (handler: (event: WorkflowCompleteEvent) => void) =>
    listen<WorkflowCompleteEvent>('workflow:complete', (e) => handler(e.payload)),

  onCrashDetected: (handler: (event: CrashDetectedEvent) => void) =>
    listen<CrashDetectedEvent>('crash:detected', (e) => handler(e.payload)),
};
```

- [ ] **Step 3: Create api/modpack.ts**

Create `src/api/modpack.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { CompatibilityReport } from './types';

export interface ModRef {
  slug: string;
  version_id: string;
  source?: string;
}

export const modpackApi = {
  checkModCompatibility: (mods: ModRef[], gameVersion: string, loaderType?: string) =>
    invoke<CompatibilityReport>('check_mod_compatibility', { mods, gameVersion, loaderType }),
};
```

- [ ] **Step 4: Update api/index.ts**

Add imports and re-exports in `src/api/index.ts`:

```typescript
import { workflowApi } from './workflow';
import { modpackApi } from './modpack';
```

Add to the `api` object:

```typescript
  workflow: workflowApi,
  modpack: modpackApi,
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No new type errors related to the added files.

- [ ] **Step 6: Commit**

```bash
git add src/api/workflow.ts src/api/modpack.ts src/api/types.ts src/api/index.ts
git commit -m "feat: add frontend API layer for workflow and modpack"
```

---

## Task 8: Enhance AI tools and system prompt

**Files:**
- Modify: `src/ai/commands.ts`
- Modify: `src/ai/types.ts`

- [ ] **Step 1: Add new types to ai/types.ts**

Add to `src/ai/types.ts`:

```typescript
export interface ModpackPlan {
  plan_id: string;
  theme: string;
  game_version: string;
  loader: { loader_type: string; version: string };
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_config: { max_memory_mb: number; min_memory_mb: number; jvm_args: string };
  estimated_size_mb: number;
  warnings: Array<{ warning_type: string; message: string }>;
}

export interface CompatibilityReport {
  conflicts: Array<{ mod_a: string; mod_b: string; reason: string; severity: string }>;
  missing_deps: Array<{ mod_slug: string; required_by: string }>;
  warnings: Array<{ mod_slug: string; issue: string }>;
  score: number;
}
```

- [ ] **Step 2: Add 4 new tools to commands.ts**

Add these entries to the `commandRegistry` object in `src/ai/commands.ts`, after the `apply_fix` entry:

```typescript
  generate_modpack_plan: {
    name: 'generate_modpack_plan',
    description:
      'Generate a modpack installation plan from a theme, game version, loader type, and mod list. Validates the plan on the backend and returns a ModpackPlan with plan_id. Call this AFTER searching for mods and checking compatibility.',
    riskLevel: 'low',
    paramDefs: {
      theme: { type: 'string', description: 'Modpack theme (e.g. "farming", "magic adventure")', required: true },
      game_version: { type: 'string', description: 'Minecraft version (e.g. "1.20.1")', required: true },
      loader_type: {
        type: 'string',
        description: 'Mod loader type',
        required: true,
        enum: ['fabric', 'forge', 'neoforge'],
      },
      mods: {
        type: 'string',
        description:
          'JSON array of mods: [{"slug":"...","name":"...","version_id":"...","source":"modrinth|curseforge","category":"core|automation|decoration|optimization|library","required":true}]',
        required: true,
      },
      jvm_args: { type: 'string', description: 'Recommended JVM arguments (optional)' },
      max_memory_mb: { type: 'number', description: 'Max memory in MB (optional, auto-calculated if omitted)' },
    },
    execute: async (params) => {
      try {
        const theme = String(params.theme || '');
        const gameVersion = String(params.game_version || '');
        const loaderType = String(params.loader_type || '');
        const modsRaw = String(params.mods || '[]');
        if (!theme || !gameVersion || !loaderType)
          return { success: false, error: 'theme, game_version, and loader_type are required' };

        let mods;
        try {
          mods = JSON.parse(modsRaw);
        } catch {
          return { success: false, error: 'mods must be a valid JSON array' };
        }

        const request = {
          theme,
          game_version: gameVersion,
          loader_type: loaderType,
          mods,
          jvm_args: params.jvm_args ? String(params.jvm_args) : undefined,
          max_memory_mb: params.max_memory_mb ? Number(params.max_memory_mb) : undefined,
        };

        const plan = await (await import('../api/workflow')).workflowApi.generateModpackPlan(request);
        return {
          success: true,
          data: plan,
          message: `Modpack plan "${theme}" generated with ${plan.mods.length} mods. Plan ID: ${plan.plan_id}. Call execute_modpack_plan with plan_id to install.`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Plan generation failed' };
      }
    },
  },

  execute_modpack_plan: {
    name: 'execute_modpack_plan',
    description:
      'Execute a previously generated modpack installation plan. Triggers a backend workflow that creates the instance, installs the loader, downloads all mods, and verifies. Returns a workflow_id for progress tracking.',
    riskLevel: 'high',
    paramDefs: {
      plan: {
        type: 'string',
        description: 'The full ModpackPlan JSON object returned by generate_modpack_plan',
        required: true,
      },
    },
    execute: async (params) => {
      try {
        const planRaw = String(params.plan || '');
        let plan;
        try {
          plan = JSON.parse(planRaw);
        } catch {
          return { success: false, error: 'plan must be a valid JSON ModpackPlan object' };
        }
        const workflowId = await (await import('../api/workflow')).workflowApi.executeModpackPlan(plan);
        return {
          success: true,
          data: { workflow_id: workflowId },
          message: `Modpack installation started. Workflow ID: ${workflowId}. Progress will be shown in the download panel.`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Plan execution failed' };
      }
    },
  },

  check_mod_conflicts: {
    name: 'check_mod_conflicts',
    description:
      'Check compatibility between a set of mods for a specific game version and loader. Returns conflicts, missing dependencies, and warnings with a compatibility score (0-100).',
    riskLevel: 'low',
    paramDefs: {
      mods: {
        type: 'string',
        description:
          'JSON array of mod references: [{"slug":"...","version_id":"...","source":"modrinth|curseforge"}]',
        required: true,
      },
      game_version: { type: 'string', description: 'Target Minecraft version', required: true },
      loader_type: { type: 'string', description: 'Target loader type', enum: ['fabric', 'forge', 'neoforge'] },
    },
    execute: async (params) => {
      try {
        const modsRaw = String(params.mods || '[]');
        const gameVersion = String(params.game_version || '');
        if (!gameVersion) return { success: false, error: 'game_version is required' };

        let mods;
        try {
          mods = JSON.parse(modsRaw);
        } catch {
          return { success: false, error: 'mods must be a valid JSON array' };
        }

        const report = await (await import('../api/modpack')).modpackApi.checkModCompatibility(
          mods,
          gameVersion,
          params.loader_type ? String(params.loader_type) : undefined,
        );
        return {
          success: true,
          data: report,
          message: `Compatibility score: ${report.score}/100. ${report.conflicts.length} conflicts, ${report.warnings.length} warnings.`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Compatibility check failed' };
      }
    },
  },

  analyze_and_fix_crash: {
    name: 'analyze_and_fix_crash',
    description:
      'Analyze a crash report for an instance and generate a fix plan. If auto_fix is true, automatically executes the fix via a backend workflow. Returns diagnosis, fix actions, and knowledge base matches.',
    riskLevel: 'high',
    paramDefs: {
      instance_id: { type: 'string', description: 'Instance ID that crashed', required: true },
      crash_report_path: {
        type: 'string',
        description: 'Path to the crash report file (from crash:detected event or analyze_crash)',
        required: true,
      },
      auto_fix: { type: 'boolean', description: 'Whether to automatically execute the fix (default: false)' },
    },
    execute: async (params) => {
      try {
        const instanceId = String(params.instance_id || '');
        const crashReportPath = String(params.crash_report_path || '');
        const autoFix = params.auto_fix === true;
        if (!instanceId || !crashReportPath)
          return { success: false, error: 'instance_id and crash_report_path are required' };

        const diagnosis = await crashApi.diagnoseInstanceCrash(instanceId);

        if (!autoFix) {
          return {
            success: true,
            data: diagnosis,
            message: `Crash analyzed: ${diagnosis.crash_info?.description || 'Unknown'}. Set auto_fix=true to execute the fix automatically.`,
          };
        }

        const fixPlan = {
          instance_id: instanceId,
          crash_report_path: crashReportPath,
          diagnosis,
          fix_actions: [],
          knowledge_base_matches: [],
        };
        const workflowId = await (await import('../api/workflow')).workflowApi.executeCrashFix(
          instanceId,
          fixPlan as never,
        );
        return {
          success: true,
          data: { workflow_id: workflowId, diagnosis },
          message: `Crash fix workflow started. Workflow ID: ${workflowId}`,
        };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Crash fix failed' };
      }
    },
  },
```

- [ ] **Step 3: Update buildSystemPrompt() in commands.ts**

Replace the existing `buildSystemPrompt()` function with:

```typescript
export function buildSystemPrompt(): string {
  return `You are BonNext AI Assistant, a Minecraft launcher agent. Your job is to complete multi-step tasks autonomously by calling tools one after another until the task is DONE.

IMPORTANT: After each tool result comes back, you MUST call the NEXT tool in the workflow. Do NOT just describe the result — continue executing. Keep going until the full task is complete, then summarize.

MODPACK GENERATION WORKFLOW (for requests like "I want X pack", "make me a Y modpack", "我想玩养老种田", etc.):
Step 1: Call search_versions(type="release") to find the latest Minecraft version.
Step 2: Call search_mods with 2-4 relevant search queries based on the user's theme. Use different keywords each time.
Step 3: For each good mod found, note its slug, name, version_id, and source.
Step 4: Call check_mod_conflicts with the selected mods to verify compatibility.
Step 5: Call generate_modpack_plan with the complete mod list, game version, and loader type.
Step 6: Call execute_modpack_plan with the returned plan to start installation.
Step 7: Summarize what was built.

IMPORTANT MODPACK RULES:
- Always include optimization mods (Sodium, Lithium for Fabric; Embeddium for Forge/NeoForge)
- Always include at least one minimap mod (JourneyMap, Xaero's) unless the theme is hardcore survival
- Prefer Fabric loader for modpacks (more mod compatibility)
- Prefer stable releases over beta/alpha versions
- Include required dependencies even if not explicitly requested
- For the mods parameter in generate_modpack_plan, pass a JSON array string

SETUP WORKFLOW (for "install Fabric/Forge X.Y.Z"):
Step 1: Call search_versions to find the requested version.
Step 2: Call create_instance with the version and loader type.
Step 3: Call install_loader for the instance.
Step 4: Call search_mods for essential mods (e.g. "Fabric API", "Sodium").
Step 5: Call install_mod for the essentials.
Step 6: Summarize.

CRASH WORKFLOW:
Step 1: Call analyze_crash with the instance ID. Do NOT ask for file paths.
Step 2: If auto-fix is available, call analyze_and_fix_crash with auto_fix=true.
Step 3: Summarize the fix applied.

CRITICAL RULES:
- NEVER stop after just one tool call. Continue until the workflow is complete.
- After search_mods returns results, continue to the next step (check conflicts or generate plan).
- After create_instance returns the new instance ID, use it for subsequent install calls.
- Always use the instance ID from create_instance, not an empty string.
- Be concise. Don't describe what you "will" do — just call the tools.`;
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No new type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ai/commands.ts src/ai/types.ts
git commit -m "feat: add 4 new AI tools and enhanced modpack generation system prompt"
```

---

## Task 9: Enhance aiAssistantStore for workflow events

**Files:**
- Modify: `src/stores/aiAssistantStore.tsx`

- [ ] **Step 1: Add workflow event listeners and increase max rounds**

In `src/stores/aiAssistantStore.tsx`, make these changes:

1. Add imports at the top:

```typescript
import { workflowApi } from '../api/workflow';
import type { WorkflowProgressEvent, WorkflowErrorEvent, WorkflowCompleteEvent, CrashDetectedEvent } from '../api/types';
```

2. Add workflow state to the `AIAssistantState` interface:

```typescript
interface AIAssistantState {
  messages: ChatMessageType[];
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  config: AIConfig;
  tasks: Record<string, Task>;
  activeWorkflows: Record<string, { id: string; step: number; totalSteps: number; stepName: string }>;
  crashAlert: { instanceId: string; crashReportPath: string; severity: string } | null;
}
```

3. Add action types:

```typescript
type AIAssistantAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessageType }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<ChatMessageType> }
  | { type: 'SET_OPEN'; isOpen: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_CONFIG'; config: AIConfig }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'UPDATE_WORKFLOW'; payload: { id: string; step: number; totalSteps: number; stepName: string } }
  | { type: 'REMOVE_WORKFLOW'; id: string }
  | { type: 'SET_CRASH_ALERT'; payload: { instanceId: string; crashReportPath: string; severity: string } | null };
```

4. Add reducer cases:

```typescript
    case 'UPDATE_WORKFLOW':
      return {
        ...state,
        activeWorkflows: {
          ...state.activeWorkflows,
          [action.payload.id]: action.payload,
        },
      };
    case 'REMOVE_WORKFLOW': {
      const { [action.id]: _, ...rest } = state.activeWorkflows;
      return { ...state, activeWorkflows: rest };
    }
    case 'SET_CRASH_ALERT':
      return { ...state, crashAlert: action.payload };
```

5. Update `initialState`:

```typescript
const initialState: AIAssistantState = {
  messages: [],
  isOpen: false,
  isLoading: false,
  error: '',
  config: loadStoredConfig(),
  tasks: {},
  activeWorkflows: {},
  crashAlert: null,
};
```

6. Change `maxRounds = 5` to `maxRounds = 10` in the `sendMessage` function.

7. Add workflow event listener effect after the existing `taskQueue.subscribe` effect:

```typescript
  React.useEffect(() => {
    const unlisteners: Array<() => void> = [];

    (async () => {
      const u1 = await workflowApi.onWorkflowProgress((e: WorkflowProgressEvent) => {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          payload: { id: e.workflow_id, step: e.step, totalSteps: e.total_steps, stepName: e.step_name },
        });
      });
      unlisteners.push(u1);

      const u2 = await workflowApi.onWorkflowComplete((e: WorkflowCompleteEvent) => {
        dispatch({ type: 'REMOVE_WORKFLOW', id: e.workflow_id });
        dispatch({
          type: 'ADD_MESSAGE',
          message: {
            id: nextMessageId(),
            role: 'assistant',
            content: e.result === 'success'
              ? `✅ 整合包安装完成！${e.instance_id ? `实例 ID: ${e.instance_id}` : ''}`
              : '⚠️ 工作流已完成但结果异常',
            commands: [],
            timestamp: Date.now(),
          },
        });
      });
      unlisteners.push(u2);

      const u3 = await workflowApi.onWorkflowError((e: WorkflowErrorEvent) => {
        dispatch({
          type: 'ADD_MESSAGE',
          message: {
            id: nextMessageId(),
            role: 'assistant',
            content: `❌ 工作流出错 (${e.step}): ${e.error}${e.recoverable ? ' — 可以重试' : ''}`,
            commands: [],
            timestamp: Date.now(),
          },
        });
      });
      unlisteners.push(u3);

      const u4 = await workflowApi.onCrashDetected((e: CrashDetectedEvent) => {
        dispatch({
          type: 'SET_CRASH_ALERT',
          payload: { instanceId: e.instance_id, crashReportPath: e.crash_report_path, severity: e.severity },
        });
      });
      unlisteners.push(u4);
    })();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);
```

8. Add `dismissCrashAlert` and `abortWorkflow` to the context value:

```typescript
  const dismissCrashAlert = useCallback(() => {
    dispatch({ type: 'SET_CRASH_ALERT', payload: null });
  }, []);

  const abortWorkflow = useCallback(async (workflowId: string) => {
    try {
      await workflowApi.abortWorkflow(workflowId);
      dispatch({ type: 'REMOVE_WORKFLOW', id: workflowId });
    } catch {
      // ignore
    }
  }, []);
```

9. Update `AIAssistantContext` type and `contextValue` to include the new functions.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/aiAssistantStore.tsx
git commit -m "feat: add workflow event listeners and crash alert to AI assistant store"
```

---

## Task 10: ModpackPreview component

**Files:**
- Create: `src/components/ai/ModpackPreview.tsx`
- Create: `src/components/ai/ModpackPreview.module.css`

- [ ] **Step 1: Create ModpackPreview.module.css**

Create `src/components/ai/ModpackPreview.module.css` following the existing ZZZ cyberpunk aesthetic (yellow accent #FFE600, dark background, clip-path corners):

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.panel {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--accent, #FFE600);
  clip-path: var(--clip-medium, polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)));
  padding: 1.5em;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  color: var(--text-primary, #e0e0e0);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1em;
  padding-bottom: 0.75em;
  border-bottom: 1px solid rgba(255, 230, 0, 0.2);
}

.title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.4em;
  color: var(--accent, #FFE600);
  margin: 0;
}

.closeBtn {
  background: none;
  border: none;
  color: var(--text-secondary, #888);
  cursor: pointer;
  font-size: 1.2em;
  padding: 0.25em;
}

.closeBtn:hover {
  color: var(--accent, #FFE600);
}

.infoGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5em 1em;
  margin-bottom: 1em;
  font-size: 0.8em;
}

.infoLabel {
  color: var(--text-secondary, #888);
}

.infoValue {
  color: var(--text-primary, #e0e0e0);
  font-family: 'DM Mono', monospace;
}

.sectionTitle {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1em;
  color: var(--accent, #FFE600);
  margin: 1em 0 0.5em;
}

.modList {
  list-style: none;
  padding: 0;
  margin: 0;
}

.modItem {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.4em 0.6em;
  margin-bottom: 0.25em;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  font-size: 0.75em;
}

.modCategory {
  font-size: 0.7em;
  padding: 0.15em 0.4em;
  border-radius: 3px;
  background: rgba(255, 230, 0, 0.15);
  color: var(--accent, #FFE600);
  text-transform: uppercase;
  font-family: 'DM Mono', monospace;
}

.modCategory.optimization {
  background: rgba(0, 200, 83, 0.15);
  color: #00c853;
}

.modCategory.library {
  background: rgba(66, 165, 245, 0.15);
  color: #42a5f5;
}

.modName {
  flex: 1;
}

.modRequired {
  font-size: 0.7em;
  color: var(--text-secondary, #888);
}

.warning {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 0.75em;
  margin: 0.5em 0;
  background: rgba(255, 152, 0, 0.1);
  border-left: 3px solid #ff9800;
  font-size: 0.75em;
  color: #ff9800;
}

.actions {
  display: flex;
  gap: 0.75em;
  margin-top: 1.5em;
  justify-content: flex-end;
}

.installBtn {
  padding: 0.6em 1.5em;
  background: var(--accent, #FFE600);
  color: #000;
  border: none;
  clip-path: var(--clip-small, polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)));
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.9em;
  cursor: pointer;
  letter-spacing: 0.05em;
}

.installBtn:hover {
  filter: brightness(1.1);
}

.cancelBtn {
  padding: 0.6em 1.5em;
  background: transparent;
  color: var(--text-secondary, #888);
  border: 1px solid var(--text-secondary, #888);
  clip-path: var(--clip-small, polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)));
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.9em;
  cursor: pointer;
}
```

- [ ] **Step 2: Create ModpackPreview.tsx**

Create `src/components/ai/ModpackPreview.tsx`:

```tsx
import React from 'react';
import type { ModpackPlan } from '../../ai/types';
import styles from './ModpackPreview.module.css';

interface ModpackPreviewProps {
  plan: ModpackPlan;
  onInstall: (plan: ModpackPlan) => void;
  onCancel: () => void;
}

export const ModpackPreview: React.FC<ModpackPreviewProps> = ({ plan, onInstall, onCancel }) => {
  const categoryClass = (cat: string) => {
    if (cat === 'optimization') return styles.modCategoryOptimization;
    if (cat === 'library') return styles.modCategoryLibrary;
    return styles.modCategory;
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>🎮 {plan.theme}</h2>
          <button className={styles.closeBtn} onClick={onCancel}>✕</button>
        </div>

        <div className={styles.infoGrid}>
          <span className={styles.infoLabel}>Minecraft</span>
          <span className={styles.infoValue}>{plan.game_version}</span>
          <span className={styles.infoLabel}>Loader</span>
          <span className={styles.infoValue}>{plan.loader.loader_type} {plan.loader.version}</span>
          <span className={styles.infoLabel}>Mods</span>
          <span className={styles.infoValue}>{plan.mods.length}</span>
          <span className={styles.infoLabel}>Est. Size</span>
          <span className={styles.infoValue}>~{plan.estimated_size_mb}MB</span>
          <span className={styles.infoLabel}>Memory</span>
          <span className={styles.infoValue}>{plan.jvm_config.max_memory_mb}MB</span>
        </div>

        <h3 className={styles.sectionTitle}>📦 Mod List</h3>
        <ul className={styles.modList}>
          {plan.mods.map((mod) => (
            <li key={mod.slug} className={styles.modItem}>
              <span className={`${styles.modCategory} ${categoryClass(mod.category)}`}>
                {mod.category}
              </span>
              <span className={styles.modName}>{mod.name}</span>
              {mod.required && <span className={styles.modRequired}>required</span>}
            </li>
          ))}
        </ul>

        {plan.warnings.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>⚠️ Warnings</h3>
            {plan.warnings.map((w, i) => (
              <div key={i} className={styles.warning}>{w.message}</div>
            ))}
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.installBtn} onClick={() => onInstall(plan)}>
            Install {plan.mods.length} Mods
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ai/ModpackPreview.tsx src/components/ai/ModpackPreview.module.css
git commit -m "feat: add ModpackPreview component for structured plan display"
```

---

## Task 11: WorkflowProgress and CrashAnalysisPanel components

**Files:**
- Create: `src/components/ai/WorkflowProgress.tsx`
- Create: `src/components/ai/WorkflowProgress.module.css`
- Create: `src/components/ai/CrashAnalysisPanel.tsx`
- Create: `src/components/ai/CrashAnalysisPanel.module.css`

- [ ] **Step 1: Create WorkflowProgress component**

Create `src/components/ai/WorkflowProgress.module.css`:

```css
.container {
  padding: 0.75em;
  background: rgba(255, 230, 0, 0.05);
  border: 1px solid rgba(255, 230, 0, 0.2);
  clip-path: var(--clip-small);
  margin: 0.5em 0;
}

.stepInfo {
  display: flex;
  justify-content: space-between;
  font-size: 0.75em;
  margin-bottom: 0.5em;
}

.stepLabel {
  color: var(--accent, #FFE600);
  font-family: 'DM Mono', monospace;
}

.stepCount {
  color: var(--text-secondary, #888);
  font-family: 'DM Mono', monospace;
}

.progressBar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5em;
}

.progressFill {
  height: 100%;
  background: var(--accent, #FFE600);
  transition: width 0.3s ease;
}

.detail {
  font-size: 0.7em;
  color: var(--text-secondary, #888);
  margin-bottom: 0.5em;
}

.actions {
  display: flex;
  gap: 0.5em;
}

.abortBtn {
  padding: 0.3em 0.8em;
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
  font-size: 0.7em;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
}

.retryBtn {
  padding: 0.3em 0.8em;
  background: rgba(255, 230, 0, 0.1);
  color: var(--accent, #FFE600);
  border: 1px solid rgba(255, 230, 0, 0.3);
  font-size: 0.7em;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
}
```

Create `src/components/ai/WorkflowProgress.tsx`:

```tsx
import React from 'react';
import styles from './WorkflowProgress.module.css';

interface WorkflowProgressProps {
  workflowId: string;
  step: number;
  totalSteps: number;
  stepName: string;
  detail?: string;
  status: string;
  onAbort: (workflowId: string) => void;
  onRetry: (workflowId: string) => void;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  workflowId,
  step,
  totalSteps,
  stepName,
  detail,
  status,
  onAbort,
  onRetry,
}) => {
  const progress = totalSteps > 0 ? (step / totalSteps) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.stepInfo}>
        <span className={styles.stepLabel}>{stepName.replace(/_/g, ' ')}</span>
        <span className={styles.stepCount}>{step}/{totalSteps}</span>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
      <div className={styles.actions}>
        {status === 'running' && (
          <button className={styles.abortBtn} onClick={() => onAbort(workflowId)}>Abort</button>
        )}
        {status === 'failed' && (
          <button className={styles.retryBtn} onClick={() => onRetry(workflowId)}>Retry</button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create CrashAnalysisPanel component**

Create `src/components/ai/CrashAnalysisPanel.module.css`:

```css
.container {
  position: fixed;
  bottom: 1em;
  right: 1em;
  width: 380px;
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid #f44336;
  clip-path: var(--clip-medium);
  padding: 1em;
  z-index: 999;
  color: var(--text-primary, #e0e0e0);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75em;
}

.title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1em;
  color: #f44336;
  margin: 0;
}

.closeBtn {
  background: none;
  border: none;
  color: var(--text-secondary, #888);
  cursor: pointer;
  font-size: 1em;
}

.summary {
  font-size: 0.75em;
  margin-bottom: 0.75em;
  line-height: 1.5;
}

.fixBtn {
  width: 100%;
  padding: 0.6em;
  background: #f44336;
  color: #fff;
  border: none;
  clip-path: var(--clip-small);
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.85em;
  cursor: pointer;
  letter-spacing: 0.05em;
  margin-bottom: 0.5em;
}

.fixBtn:hover {
  filter: brightness(1.15);
}

.dismissBtn {
  width: 100%;
  padding: 0.4em;
  background: transparent;
  color: var(--text-secondary, #888);
  border: 1px solid var(--text-secondary, #888);
  clip-path: var(--clip-small);
  font-size: 0.75em;
  cursor: pointer;
}
```

Create `src/components/ai/CrashAnalysisPanel.tsx`:

```tsx
import React from 'react';
import styles from './CrashAnalysisPanel.module.css';

interface CrashAnalysisPanelProps {
  instanceId: string;
  crashReportPath: string;
  severity: string;
  onFix: (instanceId: string, crashReportPath: string) => void;
  onDismiss: () => void;
}

export const CrashAnalysisPanel: React.FC<CrashAnalysisPanelProps> = ({
  instanceId,
  crashReportPath,
  severity,
  onFix,
  onDismiss,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>⚠️ Crash Detected</h3>
        <button className={styles.closeBtn} onClick={onDismiss}>✕</button>
      </div>
      <div className={styles.summary}>
        Instance <strong>{instanceId}</strong> has crashed.
        <br />
        Severity: <strong>{severity}</strong>
        <br />
        AI can analyze the crash report and suggest a fix.
      </div>
      <button className={styles.fixBtn} onClick={() => onFix(instanceId, crashReportPath)}>
        One-Click Fix
      </button>
      <button className={styles.dismissBtn} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
};
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ai/WorkflowProgress.tsx src/components/ai/WorkflowProgress.module.css src/components/ai/CrashAnalysisPanel.tsx src/components/ai/CrashAnalysisPanel.module.css
git commit -m "feat: add WorkflowProgress and CrashAnalysisPanel components"
```

---

## Task 12: Integrate components into ChatPanel

**Files:**
- Modify: `src/components/ai/ChatPanel.tsx`

- [ ] **Step 1: Add imports and integration**

In `src/components/ai/ChatPanel.tsx`, add imports:

```typescript
import { ModpackPreview } from './ModpackPreview';
import { WorkflowProgress } from './WorkflowProgress';
import { CrashAnalysisPanel } from './CrashAnalysisPanel';
import { workflowApi } from '../../api/workflow';
import type { ModpackPlan } from '../../ai/types';
```

Add state for modpack preview and crash alert handling:

```typescript
  const [pendingPlan, setPendingPlan] = React.useState<ModpackPlan | null>(null);
```

Add workflow progress rendering inside the chat panel, after the message list:

```tsx
      {Object.entries(state.activeWorkflows).map(([id, wf]) => (
        <WorkflowProgress
          key={id}
          workflowId={id}
          step={wf.step}
          totalSteps={wf.totalSteps}
          stepName={wf.stepName}
          status="running"
          onAbort={(wid) => workflowApi.abortWorkflow(wid)}
          onRetry={() => {}}
        />
      ))}
```

Add ModpackPreview rendering:

```tsx
      {pendingPlan && (
        <ModpackPreview
          plan={pendingPlan}
          onInstall={async (plan) => {
            try {
              await workflowApi.executeModpackPlan(plan);
            } catch {
              // error handled by event listener
            }
            setPendingPlan(null);
          }}
          onCancel={() => setPendingPlan(null)}
        />
      )}
```

Add CrashAnalysisPanel rendering:

```tsx
      {state.crashAlert && (
        <CrashAnalysisPanel
          instanceId={state.crashAlert.instanceId}
          crashReportPath={state.crashAlert.crashReportPath}
          severity={state.crashAlert.severity}
          onFix={(instanceId, crashReportPath) => {
            sendMessage(`Analyze and fix the crash for instance ${instanceId}. The crash report is at ${crashReportPath}. Apply the fix automatically.`);
            dismissCrashAlert();
          }}
          onDismiss={dismissCrashAlert}
        />
      )}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No new type errors. May need to adjust based on actual ChatPanel structure.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/ChatPanel.tsx
git commit -m "feat: integrate ModpackPreview, WorkflowProgress, and CrashAnalysisPanel into ChatPanel"
```

---

## Task 13: Full build verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run Rust check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: `Finished` with no errors

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -15`

Expected: No type errors

- [ ] **Step 3: Run full check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`

Expected: Both pass without errors

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from AI intelligence core integration"
```
