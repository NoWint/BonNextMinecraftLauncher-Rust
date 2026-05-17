use crate::error::LauncherError;
use std::path::PathBuf;

pub fn find_java() -> Result<PathBuf, LauncherError> {
    if let Some(custom) = find_custom_java() {
        return Ok(custom);
    }

    if let Some(java_home) = find_java_home() {
        return Ok(java_home);
    }

    if cfg!(target_os = "macos") {
        if let Some(java) = find_macos_java() {
            return Ok(java);
        }
    }

    if let Some(path_java) = find_in_path() {
        return Ok(path_java);
    }

    if cfg!(target_os = "windows") {
        if let Some(java) = find_windows_registry() {
            return Ok(java);
        }
    }

    Err(LauncherError::JavaNotFound)
}

fn find_custom_java() -> Option<PathBuf> {
    let cfg = crate::config::load_config().ok()?;
    let java_path = cfg.java_path?;
    if java_path.is_empty() {
        return None;
    }
    let path = PathBuf::from(&java_path);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn find_java_home() -> Option<PathBuf> {
    let java_home = std::env::var("JAVA_HOME").ok()?;
    if java_home.is_empty() {
        return None;
    }
    let java = if cfg!(target_os = "windows") {
        PathBuf::from(&java_home).join("bin").join("javaw.exe")
    } else {
        PathBuf::from(&java_home).join("bin").join("java")
    };
    if java.exists() {
        Some(java)
    } else {
        None
    }
}

fn find_in_path() -> Option<PathBuf> {
    let java_name = if cfg!(target_os = "windows") {
        "javaw.exe"
    } else {
        "java"
    };

    let output = std::process::Command::new("which")
        .arg(java_name)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path_str.is_empty() {
        return None;
    }

    let path = PathBuf::from(&path_str);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn find_windows_registry() -> Option<PathBuf> {
    let output = std::process::Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\JavaSoft\Java Runtime Environment",
            "/s",
            "/v",
            "JavaHome",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(idx) = line.find("JavaHome") {
            if let Some(val) = line[idx..].split("REG_SZ").nth(1) {
                let java_home = val.trim();
                let java = PathBuf::from(java_home).join("bin").join("javaw.exe");
                if java.exists() {
                    return Some(java);
                }
            }
        }
    }

    None
}

fn find_macos_java() -> Option<PathBuf> {
    for major in [21, 17, 21, 18, 19, 20, 22, 23, 24, 25] {
        let output = std::process::Command::new("/usr/libexec/java_home")
            .arg("-v")
            .arg(major.to_string())
            .output()
            .ok()?;

        if output.status.success() {
            let home = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !home.is_empty() {
                let java = PathBuf::from(&home).join("bin").join("java");
                if java.exists() {
                    return Some(java);
                }
            }
        }
    }

    let output = std::process::Command::new("/usr/libexec/java_home")
        .output()
        .ok()?;

    if output.status.success() {
        let home = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let java = PathBuf::from(&home).join("bin").join("java");
        if java.exists() {
            return Some(java);
        }
    }

    None
}

#[allow(clippy::ptr_arg)]
pub fn check_java_version(java_path: &PathBuf) -> Option<u32> {
    let output = std::process::Command::new(java_path.as_os_str())
        .arg("-version")
        .output()
        .ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_java_version(&stderr)
}

fn parse_java_version(version_output: &str) -> Option<u32> {
    for line in version_output.lines() {
        if line.contains("version") {
            let version_str = line.split('"').nth(1)?;
            let major = if version_str.starts_with("1.") {
                version_str.strip_prefix("1.")?.split('.').next()?.parse().ok()?
            } else {
                version_str.split('.').next()?.parse().ok()?
            };
            return Some(major);
        }
    }
    None
}
