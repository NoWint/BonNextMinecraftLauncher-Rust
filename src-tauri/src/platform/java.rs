use crate::error::LauncherError;
use crate::config::UserConfig;

#[cfg(target_os = "macos")]
pub fn find_java() -> Option<String> {
    use std::process::Command;

    let paths = [
        "/usr/bin/java",
        "/usr/local/bin/java",
        "/opt/homebrew/bin/java",
    ];

    for path in &paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    if let Ok(output) = Command::new("/usr/libexec/java_home").output() {
        if output.status.success() {
            let home = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let java_bin = std::path::Path::new(&home).join("bin").join("java");
            if java_bin.exists() {
                return Some(java_bin.to_string_lossy().to_string());
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
pub fn find_java() -> Option<String> {
    let paths = ["C:\\Program Files\\Java", "C:\\Program Files (x86)\\Java"];

    for base in &paths {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let java_exe = entry.path().join("bin").join("java.exe");
                if java_exe.exists() {
                    return Some(java_exe.to_string_lossy().to_string());
                }
            }
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let java_exe =
            std::path::Path::new(&java_home).join("bin").join("java.exe");
        if java_exe.exists() {
            return Some(java_exe.to_string_lossy().to_string());
        }
    }

    None
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn find_java() -> Option<String> {
    let paths = ["/usr/bin/java", "/usr/local/bin/java"];
    for path in &paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    None
}

pub fn validate_java(path: &str) -> Result<(), LauncherError> {
    let output = std::process::Command::new(path)
        .arg("-version")
        .output()
        .map_err(|_| LauncherError::JavaNotFound)?;

    if !output.status.success() {
        return Err(LauncherError::JavaNotFound);
    }

    Ok(())
}

pub fn auto_detect_and_set(config: &mut UserConfig) {
    if !config.java_path.is_empty() && config.java_path != "java" {
        if validate_java(&config.java_path).is_ok() {
            return;
        }
    }

    if let Some(found) = find_java() {
        tracing::info!("Auto-detected Java at: {}", found);
        config.java_path = found;
    }
}
