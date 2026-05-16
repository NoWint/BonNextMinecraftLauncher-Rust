use crate::error::LauncherError;
use crate::version::models::*;
use std::collections::HashMap;
use std::path::Path;

pub struct LaunchPlan {
    pub java_exec: String,
    pub jvm_args: Vec<String>,
    pub classpath: String,
    pub main_class: String,
    pub game_args: Vec<String>,
    pub instance_dir: String,
}

pub fn build_launch_plan(
    version: &VersionJson,
    game_dir: &Path,
    instance_dir: &Path,
    java_path: &str,
    max_memory_mb: u32,
    extra_jvm_args: &[String],
    username: &str,
    uuid: &str,
    access_token: &str,
    classpath: String,
    natives_dir: &Path,
    window_width: u32,
    window_height: u32,
) -> Result<LaunchPlan, LauncherError> {
    let mut vars = HashMap::new();
    vars.insert("auth_player_name", username.to_string());
    vars.insert("version_name", version.id.clone());
    vars.insert("game_directory", instance_dir.to_string_lossy().to_string());
    vars.insert("assets_root", game_dir.join("assets").to_string_lossy().to_string());
    vars.insert("assets_index_name", version.asset_index.as_ref().map(|a| a.id.clone()).unwrap_or_default());
    vars.insert("auth_uuid", uuid.to_string());
    vars.insert("auth_access_token", access_token.to_string());
    vars.insert("clientid", uuid.to_string());
    vars.insert("user_type", "msa".to_string());
    vars.insert("version_type", version.version_type.clone());
    vars.insert("natives_directory", natives_dir.to_string_lossy().to_string());
    vars.insert("library_directory", game_dir.join("libraries").to_string_lossy().to_string());
    vars.insert("classpath_separator", classpath_separator().to_string());
    vars.insert("launcher_name", "BonNext".to_string());
    vars.insert("launcher_version", env!("CARGO_PKG_VERSION").to_string());
    vars.insert("classpath", classpath.clone());
    vars.insert("user_properties", "{}".to_string());
    vars.insert("auth_xuid", String::new());

    let (mut jvm_args, game_args) = build_args(version, &vars)?;

    if !jvm_args.iter().any(|a| a.starts_with("-Xmx")) {
        jvm_args.push(format!("-Xmx{}m", max_memory_mb));
    }
    if !jvm_args.iter().any(|a| a.starts_with("-Xms")) {
        jvm_args.push("-Xms512m".to_string());
    }

    ensure_jvm_flag(&mut jvm_args, "-Djava.library.path", &natives_dir.to_string_lossy());

    jvm_args.extend(extra_jvm_args.iter().cloned());

    strip_classpath_args(&mut jvm_args);

    Ok(LaunchPlan {
        java_exec: java_path.to_string(),
        jvm_args,
        classpath,
        main_class: version.main_class.clone(),
        game_args,
        instance_dir: instance_dir.to_string_lossy().to_string(),
    })
}

fn build_args(
    version: &VersionJson,
    vars: &HashMap<&str, String>,
) -> Result<(Vec<String>, Vec<String>), LauncherError> {
    let mut jvm_args = Vec::new();
    let mut game_args = Vec::new();

    if !version.arguments.jvm.is_empty() {
        jvm_args.extend(collect_args(&version.arguments.jvm, vars));
    } else {
        jvm_args.push(format!("-Djava.library.path={}", vars.get("natives_directory").unwrap()));
        jvm_args.push("-cp".to_string());
        jvm_args.push("${classpath}".to_string());
    }

    if !version.arguments.game.is_empty() {
        game_args.extend(collect_args(&version.arguments.game, vars));
    } else if !version.minecraft_arguments.is_empty() {
        let parts = version.minecraft_arguments.split_whitespace();
        for part in parts {
            game_args.push(substitute_vars(part, vars));
        }
    }

    Ok((jvm_args, game_args))
}

fn collect_args(
    args: &[serde_json::Value],
    vars: &HashMap<&str, String>,
) -> Vec<String> {
    let mut result = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => {
                result.push(substitute_vars(s, vars));
            }
            serde_json::Value::Object(obj) => {
                if let Some(rules_val) = obj.get("rules") {
                    let rules: Vec<Rule> = match serde_json::from_value(rules_val.clone()) {
                        Ok(r) => r,
                        Err(_) => continue,
                    };
                    if !rule_allows(&rules) {
                        continue;
                    }
                }
                if let Some(value_val) = obj.get("value") {
                    match value_val {
                        serde_json::Value::String(s) => {
                            result.push(substitute_vars(s, vars));
                        }
                        serde_json::Value::Array(arr) => {
                            for v in arr {
                                if let Some(s) = v.as_str() {
                                    result.push(substitute_vars(s, vars));
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    result
}

fn substitute_vars(value: &str, vars: &HashMap<&str, String>) -> String {
    let mut result = value.to_string();
    for (key, val) in vars {
        result = result.replace(&format!("${{{}}}", key), val);
    }
    result
}

fn ensure_jvm_flag(args: &mut Vec<String>, flag: &str, value: &str) {
    let prefix = format!("{}=", flag);
    if !args.iter().any(|a| a.starts_with(&prefix)) {
        args.push(format!("{}={}", flag, value));
    }
}

fn strip_classpath_args(args: &mut Vec<String>) {
    let mut i = 0;
    while i < args.len() {
        if args[i] == "-cp" || args[i] == "-classpath" {
            args.remove(i);
            if i < args.len() {
                args.remove(i);
            }
        } else {
            i += 1;
        }
    }
}

pub fn launch(plan: &LaunchPlan) -> Result<std::process::Child, LauncherError> {
    tracing::info!("Launching Minecraft...");
    tracing::info!("Java: {}", plan.java_exec);
    tracing::info!("Main class: {}", plan.main_class);
    tracing::info!("Instance dir: {}", plan.instance_dir);

    let mut cmd = std::process::Command::new(&plan.java_exec);
    cmd.args(&plan.jvm_args);
    cmd.arg("-cp");
    cmd.arg(&plan.classpath);
    cmd.arg(&plan.main_class);
    cmd.args(&plan.game_args);
    cmd.current_dir(&plan.instance_dir);

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let child = cmd.spawn()?;
    Ok(child)
}
