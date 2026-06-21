use crate::config;
use crate::error::LauncherError;
use crate::platform::java;
use crate::platform::paths;
use crate::version::resolver::ResolvedVersion;
use std::collections::HashMap;
use std::path::PathBuf;

pub struct LaunchContext {
    pub version: ResolvedVersion,
    /// 原始版本 ID（用于文件系统路径：version_dir、natives_dir、client JAR、log4j 配置）。
    /// 当安装 Loader 后 `version.id` 会被改为 loader 版本 ID（如 `fabric-loader-0.15.11-1.21`），
    /// 但版本文件实际存储在原始版本目录下，因此路径构建必须使用此字段。
    pub original_version_id: String,
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
    pub debug_mode: bool,
    pub debug_port: u16,
}

pub struct InstanceSettings {
    pub id: Option<String>,
    pub max_memory: Option<u32>,
    pub min_memory: Option<u32>,
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
    pub user_type: Option<String>,
    pub debug_mode: Option<bool>,
    pub debug_port: Option<u16>,
}

impl LaunchContext {
    pub fn build(
        version: ResolvedVersion,
        original_version_id: String,
        username: String,
        uuid: String,
        access_token: String,
        instance: Option<InstanceSettings>,
    ) -> Result<Self, LauncherError> {
        let cfg = config::load_config()?;

        let java_path = if cfg.force_java_path {
            if let Some(ref forced_java) = cfg.java_path {
                let p = PathBuf::from(forced_java);
                if p.exists() {
                    p
                } else {
                    tracing::warn!("Forced Java path does not exist: {}", forced_java);
                    java::find_java()?
                }
            } else {
                java::find_java()?
            }
        } else if let Some(ref inst) = instance {
            if let Some(ref custom_java) = inst.java_path {
                let p = PathBuf::from(custom_java);
                if p.exists() { p } else { java::find_java()? }
            } else {
                java::find_java()?
            }
        } else {
            java::find_java()?
        };

        let max_memory = if cfg.force_memory {
            cfg.max_memory
        } else {
            instance.as_ref().and_then(|i| i.max_memory).unwrap_or(cfg.max_memory)
        };
        let min_memory = if cfg.force_memory {
            cfg.min_memory
        } else {
            instance.as_ref().and_then(|i| i.min_memory).unwrap_or(cfg.min_memory)
        };

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

        let game_dir = if let Some(ref inst) = instance {
            if let Some(ref inst_id) = inst.id {
                paths::get_instance_minecraft_dir(inst_id)
            } else {
                paths::get_game_dir()
            }
        } else {
            paths::get_game_dir()
        };
        let assets_dir = paths::get_assets_dir();
        // 关键修复：版本目录和 natives 目录必须使用原始版本 ID 构建，
        // 而非 loader 版本 ID。版本文件（client JAR、log4j 配置、natives）
        // 都存储在原始版本目录下，使用 loader 版本 ID 会导致路径找不到。
        let version_dir = paths::get_versions_dir().join(&original_version_id);
        let natives_dir = version_dir.join("natives");

        let extra_jvm_args = instance.as_ref().and_then(|i| i.jvm_args.clone())
            .or_else(|| cfg.jvm_args.clone());

        let debug_mode = instance.as_ref().and_then(|i| i.debug_mode).unwrap_or(false);
        let debug_port = instance.as_ref().and_then(|i| i.debug_port).unwrap_or(5005);

        Ok(LaunchContext {
            version,
            original_version_id,
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
            debug_mode,
            debug_port,
        })
    }
}

pub async fn build_launch_command(ctx: &LaunchContext) -> Result<Vec<String>, LauncherError> {
    let mut cmd = Vec::new();

    cmd.push(paths::path_to_string(&ctx.java_path)?);

    cmd.push(format!("-Xms{}m", ctx.min_memory));
    cmd.push(format!("-Xmx{}m", ctx.max_memory));

    // 默认 GC 参数：提升 Minecraft 运行时性能和 GC 效率。
    // 仅在用户未通过 extra_jvm_args 自定义 GC 时生效（extra_jvm_args 在后面追加，
    // JVM 以最后出现的 GC 配置为准）。
    cmd.push("-XX:+UseG1GC".to_string());
    cmd.push("-XX:+ParallelRefProcEnabled".to_string());
    cmd.push("-XX:MaxGCPauseMillis=200".to_string());
    cmd.push("-XX:+UnlockExperimentalVMOptions".to_string());
    cmd.push("-XX:+DisableExplicitGC".to_string());
    // Java 17+ 的 ZGC 备选（低延迟），但 G1GC 对 Minecraft 更稳定，保持默认。

    if ctx.debug_mode {
        cmd.push(format!("-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:{}", ctx.debug_port));
    }

    let active_account = crate::auth::token_store::AccountStore::load().ok().and_then(|s| s.get_active().cloned());
    if let Some(ref acct) = active_account {
        let jar_path = crate::platform::paths::get_game_dir().join("shared").join("authlib-injector.jar");
        let jar_valid = jar_path.exists() && std::fs::read(&jar_path).map(|data| data.len() > 4 && &data[0..4] == b"PK\x03\x04").unwrap_or(false);
        if jar_valid {
            if acct.account_type == "yggdrasil" {
                if let Some(ref server_url) = acct.yggdrasil_server_url {
                    if let Some(ref skin_path) = acct.local_skin_path {
                        if std::path::Path::new(skin_path).exists() {
                            match crate::auth::skin_server::start_skin_server(
                                &acct.uuid,
                                &acct.username,
                                skin_path,
                                acct.local_skin_model.as_deref().unwrap_or("default"),
                                None,
                            ).await {
                                Ok(handle) => {
                                    let server_url_local = format!("http://127.0.0.1:{}", handle.port);
                                    let agent_arg = format!("-javaagent:{}={}", jar_path.to_string_lossy(), server_url_local);
                                    cmd.push(agent_arg);
                                    crate::auth::skin_server::set_active_handle(handle);
                                }
                                Err(e) => {
                                    tracing::warn!("Failed to start local skin server for yggdrasil account: {}", e);
                                    let agent_arg = format!("-javaagent:{}={}", jar_path.to_string_lossy(), server_url);
                                    cmd.push(agent_arg);
                                }
                            }
                        } else {
                            let agent_arg = format!("-javaagent:{}={}", jar_path.to_string_lossy(), server_url);
                            cmd.push(agent_arg);
                        }
                    } else {
                        let agent_arg = format!("-javaagent:{}={}", jar_path.to_string_lossy(), server_url);
                        cmd.push(agent_arg);
                    }
                }
            } else if acct.account_type == "offline" {
                if let Some(ref skin_path) = acct.local_skin_path {
                    if std::path::Path::new(skin_path).exists() {
                        match crate::auth::skin_server::start_skin_server(
                            &acct.uuid,
                            &acct.username,
                            skin_path,
                            acct.local_skin_model.as_deref().unwrap_or("default"),
                            None,
                        ).await {
                            Ok(handle) => {
                                let server_url = format!("http://127.0.0.1:{}", handle.port);
                                let agent_arg = format!("-javaagent:{}={}", jar_path.to_string_lossy(), server_url);
                                cmd.push(agent_arg);
                                crate::auth::skin_server::set_active_handle(handle);
                            }
                            Err(e) => {
                                tracing::warn!("Failed to start local skin server: {}", e);
                            }
                        }
                    }
                }
            }
            // 关键修复：Microsoft 账户不再注入 authlib-injector。
            // authlib-injector 会劫持所有 Mojang/Microsoft 认证请求（sessionserver、api.mojang），
            // 导致 Microsoft OAuth 令牌验证失败 → 黑屏闪退。
            // Microsoft 账户应使用官方认证流程。本地皮肤功能仅支持 offline/yggdrasil 账户。
        } else {
            tracing::warn!("authlib-injector.jar not found at {:?}", jar_path);
        }
    }

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
        // macOS 上 LWJGL3/OpenGL 必须在主线程运行，否则 JVM 在初始化
        // Cocoa/OpenGL 上下文时立即崩溃（exit code 255）。
        cmd.push("-XstartOnFirstThread".to_string());
        // 不强制 -Dsun.java2d.metal=true：macOS 27.0 beta 上 Metal 后端存在
        // gldCopyBufferSubData bug，让 JVM 自动选择渲染管线更稳定。
    }

    let variables = build_template_variables(ctx)?;

    let classpath = build_classpath(ctx)?;
    cmd.push("-cp".to_string());
    cmd.push(classpath);

    if let Some(ref logging) = ctx.version.logging_config {
        let resolved = resolve_template(&logging.argument, &variables);
        // 关键修复：log4j 配置文件在原始版本目录下，使用 original_version_id 查找。
        if let Some(local_path) = resolve_logging_path(&logging.argument, &ctx.original_version_id) {
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

    // 关键修复：client JAR 文件名是原始版本 ID（如 1.21.jar），不是 loader 版本 ID。
    let client_jar = ctx.version_dir.join(format!("{}.jar", ctx.original_version_id));
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
    // 关键修复：client JAR 文件名是原始版本 ID。
    let client_jar = ctx.version_dir.join(format!("{}.jar", ctx.original_version_id));
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
