use crate::error::LauncherError;
use crate::instance::manager::{self, GameInstance};
use crate::loader;
use crate::platform::paths;
use crate::version::manifest;

pub async fn pre_flight_check(
    game_version: &str,
    estimated_size_mb: u64,
    mod_count: u32,
) -> Result<(), LauncherError> {
    let game_dir = paths::get_game_dir();
    let available_mb = {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        let mount = game_dir.canonicalize().unwrap_or_else(|_| game_dir.clone());
        disks
            .iter()
            .filter(|d| mount.starts_with(d.mount_point()))
            .max_by_key(|d| d.mount_point().components().count())
            .map(|d| d.available_space() / 1_048_576)
            .unwrap_or(0)
    };

    let required_mb = estimated_size_mb + 512;
    if available_mb < required_mb {
        return Err(LauncherError::DiskSpace {
            required: required_mb,
            available: available_mb,
        });
    }

    let versions = manifest::fetch_versions_sorted().await?;
    if !versions.iter().any(|v| v.id == game_version) {
        return Err(LauncherError::VersionNotFound(format!(
            "Game version {} not found in manifest",
            game_version
        )));
    }

    tracing::info!(
        "Pre-flight check passed: {}MB available, {} mods planned, version {} exists",
        available_mb,
        mod_count,
        game_version
    );
    Ok(())
}

pub fn create_instance_step(
    name: &str,
    version_id: &str,
    version_url: &str,
    loader_type: Option<&str>,
    loader_version: Option<&str>,
    max_memory: u32,
) -> Result<GameInstance, LauncherError> {
    let instance = GameInstance::new(name, version_id, version_url);
    let mut inst = instance;
    inst.loader_type = loader_type.map(|s| s.to_string());
    inst.loader_version = loader_version.map(|s| s.to_string());
    inst.max_memory = max_memory;
    inst.min_memory = 512;
    manager::create_instance(&inst)?;
    Ok(inst)
}

pub async fn create_snapshot_step(
    app: &tauri::AppHandle,
    instance_id: &str,
) -> Result<String, LauncherError> {
    let result = crate::commands::instance::create_snapshot(
        app.clone(),
        instance_id.to_string(),
        "pre-workflow".to_string(),
    )
    .await?;
    Ok(result.id)
}

pub async fn install_loader_step(
    app: &tauri::AppHandle,
    instance_id: &str,
    loader_type: &str,
    version_id: &str,
    version_url: &str,
    loader_version: &str,
) -> Result<loader::LoaderInstallResult, LauncherError> {
    let lt = loader::LoaderType::from_str(loader_type)
        .ok_or_else(|| LauncherError::InvalidConfig(format!("Unknown loader: {}", loader_type)))?;
    let details =
        crate::version::resolver::resolve_version_with_parents(version_id, version_url).await?;
    let result = loader::install_loader(&lt, &details, loader_version, instance_id).await?;

    if !result.extra_libraries.is_empty() {
        let tasks = crate::download::queue::build_library_download_tasks(&result.extra_libraries);
        let queue = crate::download::queue::DownloadQueue::new();
        queue.download_all(tasks).await?;
    }

    if let Ok(Some(mut inst)) = manager::get_instance(instance_id) {
        inst.loader_type = Some(loader_type.to_string());
        inst.loader_version = Some(loader_version.to_string());
        if let Err(e) = manager::update_instance(&inst) {
            tracing::warn!("Failed to update instance loader info: {}", e);
        }
    }

    crate::commands::achievement::try_unlock_achievement(app, "install_loader");
    Ok(result)
}

pub fn apply_jvm_config_step(
    instance_id: &str,
    max_memory: u32,
    min_memory: u32,
    jvm_args: Option<&str>,
) -> Result<(), LauncherError> {
    if let Ok(Some(mut inst)) = manager::get_instance(instance_id) {
        inst.max_memory = max_memory;
        inst.min_memory = min_memory;
        if let Some(args) = jvm_args {
            inst.jvm_args = Some(args.to_string());
        }
        manager::update_instance(&inst)?;
    }
    Ok(())
}

pub fn verify_instance_step(instance_id: &str) -> Result<bool, LauncherError> {
    let instance_dir = paths::get_instance_dir(instance_id);
    if !instance_dir.exists() {
        return Err(LauncherError::InstanceNotReady(format!(
            "Instance directory does not exist: {}",
            instance_dir.display()
        )));
    }
    let mc_dir = paths::get_instance_minecraft_dir(instance_id);
    if !mc_dir.exists() {
        return Err(LauncherError::InstanceNotReady(format!(
            "Instance .minecraft directory does not exist: {}",
            mc_dir.display()
        )));
    }
    Ok(true)
}
