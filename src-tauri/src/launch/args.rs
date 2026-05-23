use crate::config;
use crate::error::LauncherError;
use crate::platform::java;
use crate::platform::paths;
use crate::version::resolver::ResolvedVersion;
use std::collections::HashMap;
use std::path::PathBuf;

pub struct LaunchContext {
    pub version: ResolvedVersion,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub game_dir: PathBuf,
    pub assets_dir: PathBuf,
    pub version_dir: PathBuf,
    pub natives_dir: PathBuf,
    pub java_path: PathBuf,
    pub min_memory: u32,
    pub max_memory: u32,
    pub window_width: u32,
    pub window_height: u32,
    pub fullscreen: bool,
    pub user_type: String,
    pub extra_jvm_args: Option<String>,
}

pub struct InstanceSettings {
    pub max_memory: Option<u32>,
    pub min_memory: Option<u32>,
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
    pub user_type: Option<String>,
}

impl LaunchContext {
    pub fn build(
        version: ResolvedVersion,
        username: String,
        uuid: String,
        access_token: String,
        instance: Option<InstanceSettings>,
    ) -> Result<Self, LauncherError> {
        let cfg = config::load_config()?;
        let java_path = if let Some(ref inst) = instance {
            if let Some(ref custom_java) = inst.java_path {
                let p = PathBuf::from(custom_java);
                if p.exists() { p } else { java::find_java()? }
            } else {
                java::find_java()?
            }
        } else {
            java::find_java()?
        };

        let max_memory = instance.as_ref().and_then(|i| i.max_memory).unwrap_or(cfg.max_memory);
        let min_memory = instance.as_ref().and_then(|i| i.min_memory).unwrap_or(cfg.min_memory);

        if min_memory < 256 {
            return Err(LauncherError::InvalidConfig(
                "Minimum memory must be at least 256MB".into()
            ));
        }
        if max_memory < min_memory {
            return Err(LauncherError::InvalidConfig(
                "Maximum memory must be greater than or equal to minimum memory".into()
            ));
        }
        if max_memory > 65536 {
            return Err(LauncherError::InvalidConfig(
                "Maximum memory cannot exceed 65536MB (64GB)".into()
            ));
        }

        let user_type = instance.as_ref()
            .and_then(|i| i.user_type.clone())
            .unwrap_or_else(|| "mojang".to_string());

        let game_dir = paths::get_game_dir();
        let assets_dir = paths::get_assets_dir();
        let version_dir = paths::get_versions_dir().join(&version.id);
        let natives_dir = version_dir.join("natives");

        let extra_jvm_args = instance.as_ref().and_then(|i| i.jvm_args.clone())
            .or_else(|| cfg.jvm_args.clone());

        Ok(LaunchContext {
            version,
            username,
            uuid,
            access_token,
            game_dir,
            assets_dir,
            version_dir,
            natives_dir,
            java_path,
            min_memory,
            max_memory,
            window_width: cfg.window_width,
            window_height: cfg.window_height,
            fullscreen: cfg.fullscreen,
            user_type,
            extra_jvm_args,
        })
    }
}

pub fn build_launch_command(ctx: &LaunchContext) -> Result<Vec<String>, LauncherError> {
    let mut cmd = Vec::new();

    cmd.push(paths::path_to_string(&ctx.java_path)?);

    cmd.push(format!("-Xms{}m", ctx.min_memory));
    cmd.push(format!("-Xmx{}m", ctx.max_memory));

    if let Some(ref extra_args) = ctx.extra_jvm_args {
        if !extra_args.is_empty() {
            for arg in extra_args.split_whitespace() {
                cmd.push(arg.to_string());
            }
        }
    }

    cmd.push("-Djava.library.path=".to_string() + &paths::path_to_string(&ctx.natives_dir)?);

    cmd.push("-Dminecraft.launcher.brand=BonNext".to_string());
    cmd.push("-Dminecraft.launcher.version=1.0.0".to_string());

    cmd.push("-Dlog4j2.formatMsgNoLookups=true".to_string());

    #[cfg(target_os = "linux")]
    {
        cmd.push("-Dawt.useSystemAAFontSettings=on".to_string());
        cmd.push("-Dswing.aatext=true".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        cmd.push("-Dsun.java2d.metal=true".to_string());
    }

    let variables = build_template_variables(ctx)?;

    let classpath = build_classpath(ctx)?;
    cmd.push("-cp".to_string());
    cmd.push(classpath);

    if let Some(ref logging) = ctx.version.logging_config {
        let resolved = resolve_template(&logging.argument, &variables);
        if let Some(local_path) = resolve_logging_path(&logging.argument, &ctx.version.id) {
            cmd.push(format!("-Dlog4j.configurationFile={}", local_path));
        } else {
            cmd.push(resolved);
        }
    }

    for arg in &ctx.version.jvm_args {
        let resolved = resolve_template(arg, &variables);
        cmd.push(resolved);
    }

    cmd.push(ctx.version.main_class.clone());

    for arg in &ctx.version.game_args {
        let resolved = resolve_template(arg, &variables);
        cmd.push(resolved);
    }

    if ctx.fullscreen {
        cmd.push("--fullscreen".to_string());
    }

    Ok(cmd)
}

fn build_classpath(ctx: &LaunchContext) -> Result<String, LauncherError> {
    let mut classpath_paths = Vec::new();
    let libraries_dir = paths::get_libraries_dir();

    for lib in &ctx.version.libraries {
        let lib_path = libraries_dir.join(&lib.path);
        classpath_paths.push(paths::path_to_string(&lib_path)?);
    }

    let client_jar = ctx.version_dir.join(format!("{}.jar", ctx.version.id));
    classpath_paths.push(paths::path_to_string(&client_jar)?);

    Ok(classpath_paths.join(paths::classpath_separator()))
}

fn build_template_variables(ctx: &LaunchContext) -> Result<HashMap<String, String>, LauncherError> {
    let mut vars = HashMap::new();

    vars.insert("${auth_player_name}".to_string(), ctx.username.clone());
    vars.insert("${auth_uuid}".to_string(), ctx.uuid.clone());
    vars.insert("${auth_access_token}".to_string(), ctx.access_token.clone());
    vars.insert("${auth_session}".to_string(), ctx.access_token.clone());
    vars.insert("${user_type}".to_string(), ctx.user_type.clone());
    vars.insert("${user_properties}".to_string(), "{}".to_string());

    vars.insert("${version_name}".to_string(), ctx.version.id.clone());
    vars.insert("${version_type}".to_string(), ctx.version.version_type.clone());
    vars.insert("${assets_root}".to_string(), paths::path_to_string(&ctx.assets_dir)?);
    vars.insert("${assets_index_name}".to_string(), ctx.version.asset_index.id.clone());
    vars.insert("${game_directory}".to_string(), paths::path_to_string(&ctx.game_dir)?);
    vars.insert("${game_assets}".to_string(), paths::path_to_string(&ctx.assets_dir.join("virtual").join("legacy"))?);

    vars.insert("${natives_directory}".to_string(), paths::path_to_string(&ctx.natives_dir)?);
    vars.insert("${library_directory}".to_string(), paths::path_to_string(&paths::get_libraries_dir())?);
    vars.insert("${classpath_separator}".to_string(), paths::classpath_separator().to_string());

    vars.insert("${launcher_name}".to_string(), "BonNext".to_string());
    vars.insert("${launcher_version}".to_string(), "1.0.0".to_string());

    vars.insert("${classpath}".to_string(), build_classpath_string(ctx)?);

    if ctx.fullscreen || ctx.window_width > 0 {
        vars.insert("${resolution_width}".to_string(), ctx.window_width.to_string());
        vars.insert("${resolution_height}".to_string(), ctx.window_height.to_string());
    }

    Ok(vars)
}

fn build_classpath_string(ctx: &LaunchContext) -> Result<String, LauncherError> {
    let mut classpath_paths = Vec::new();
    let libraries_dir = paths::get_libraries_dir();
    for lib in &ctx.version.libraries {
        let lib_path = libraries_dir.join(&lib.path);
        classpath_paths.push(paths::path_to_string(&lib_path)?);
    }
    let client_jar = ctx.version_dir.join(format!("{}.jar", ctx.version.id));
    classpath_paths.push(paths::path_to_string(&client_jar)?);

    Ok(classpath_paths.join(paths::classpath_separator()))
}

fn resolve_template(template: &str, variables: &HashMap<String, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in variables {
        result = result.replace(key, value);
    }
    result
}

/// Resolve the logging config path. If `${path}` is in the argument,
/// replace it with the local downloaded file path.
fn resolve_logging_path(logging_arg: &str, version_id: &str) -> Option<String> {
    // If the argument contains ${path}, resolve it to the local file
    if logging_arg.contains("${path}") {
        let version_dir = paths::get_versions_dir().join(version_id);
        // Find the downloaded log config file (log4j2.xml or similar)
        if let Ok(entries) = std::fs::read_dir(&version_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".xml") || name.ends_with(".cfg") {
                    return Some(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    None
}
