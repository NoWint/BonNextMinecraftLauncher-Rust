use crate::version::resolver::ResolvedVersion;
use std::path::PathBuf;

pub struct LaunchConfig {
    pub java_path: String,
    pub max_memory_mb: u32,
    pub extra_jvm_args: Vec<String>,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub game_dir: PathBuf,
}

pub fn build_launch_command(
    resolved: &ResolvedVersion,
    config: &LaunchConfig,
    libraries_dir: &PathBuf,
    versions_dir: &PathBuf,
    assets_dir: &PathBuf,
) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    args.push(config.java_path.clone());

    let classpath_separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };

    let mut classpath_parts: Vec<String> = Vec::new();

    let client_jar_path = versions_dir.join(&resolved.id).join("client.jar");
    classpath_parts.push(client_jar_path.to_string_lossy().to_string());

    for lib in &resolved.libraries {
        let lib_path = libraries_dir.join(&lib.path);
        classpath_parts.push(lib_path.to_string_lossy().to_string());
    }

    let classpath = classpath_parts.join(classpath_separator);

    for jvm_arg in &resolved.jvm_args {
        let arg = jvm_arg
            .replace("${classpath}", &classpath)
            .replace(
                "${natives_directory}",
                &versions_dir
                    .join(&resolved.id)
                    .join("natives")
                    .to_string_lossy(),
            )
            .replace("${library_directory}", &libraries_dir.to_string_lossy())
            .replace("${version_name}", &resolved.id)
            .replace("${launcher_name}", "bonnext")
            .replace("${launcher_version}", "0.1.0");
        args.push(arg);
    }

    args.push(format!("-Xmx{}M", config.max_memory_mb));

    for extra in &config.extra_jvm_args {
        if !extra.is_empty() {
            args.push(extra.clone());
        }
    }

    args.push(resolved.main_class.clone());

    for game_arg in &resolved.game_args {
        let arg = game_arg
            .replace("${auth_player_name}", &config.username)
            .replace("${auth_uuid}", &config.uuid)
            .replace("${auth_access_token}", &config.access_token)
            .replace("${user_type}", "mojang")
            .replace("${version_name}", &resolved.id)
            .replace("${game_directory}", &config.game_dir.to_string_lossy())
            .replace("${assets_root}", &assets_dir.to_string_lossy())
            .replace("${assets_index_name}", &resolved.asset_index.id)
            .replace("${user_properties}", "{}")
            .replace("${version_type}", "release")
            .replace("${clientid}", "bonnext")
            .replace("${auth_xuid}", "");
        args.push(arg);
    }

    args
}
