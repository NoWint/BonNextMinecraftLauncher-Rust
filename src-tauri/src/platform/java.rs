use crate::error::LauncherError;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
pub struct JavaInfo {
    pub path: String,
    pub version: Option<u32>,
    pub vendor: Option<String>,
}

pub fn find_java() -> Result<PathBuf, LauncherError> {
    if let Some(custom) = find_custom_java() {
        return Ok(custom);
    }

    if let Some(java_home) = find_java_home() {
        return Ok(java_home);
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(java) = find_linux_java() {
            return Ok(java);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(java) = find_macos_java() {
            return Ok(java);
        }
    }

    if let Some(path_java) = find_in_path() {
        return Ok(path_java);
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(java) = find_windows_registry() {
            return Ok(java);
        }
    }

    Err(LauncherError::JavaNotFound)
}

pub fn find_all_java() -> Vec<JavaInfo> {
    let mut seen: BTreeMap<String, JavaInfo> = BTreeMap::new();

    let add_java = |seen: &mut BTreeMap<String, JavaInfo>, path: PathBuf| {
        let key = path.to_string_lossy().to_string();
        if seen.contains_key(&key) {
            return;
        }
        let version = check_java_version(&path);
        seen.insert(key, JavaInfo { path: path.to_string_lossy().to_string(), version, vendor: None });
    };

    if let Some(p) = find_custom_java() {
        add_java(&mut seen, p);
    }

    if let Some(p) = find_java_home() {
        add_java(&mut seen, p);
    }

    #[cfg(target_os = "linux")]
    {
        for info in find_all_linux_java() {
            add_java(&mut seen, PathBuf::from(&info.path));
        }
    }

    #[cfg(target_os = "macos")]
    {
        for info in find_all_macos_java() {
            add_java(&mut seen, PathBuf::from(&info.path));
        }
    }

    for info in find_all_in_path() {
        add_java(&mut seen, PathBuf::from(&info.path));
    }

    #[cfg(target_os = "windows")]
    {
        for info in find_all_windows_registry() {
            add_java(&mut seen, PathBuf::from(&info.path));
        }
    }

    let mut results: Vec<JavaInfo> = seen.into_values().collect();
    results.sort_by(|a, b| b.version.cmp(&a.version).then_with(|| a.path.cmp(&b.path)));
    results
}

fn find_custom_java() -> Option<PathBuf> {
    let cfg = crate::config::load_config().ok()?;
    let java_path = cfg.java_path?;
    if java_path.is_empty() {
        return None;
    }
    let cleaned = java_path
        .trim_matches('"')
        .trim_matches('\'')
        .trim_end_matches(std::path::is_separator)
        .to_string();
    let path = PathBuf::from(&cleaned);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn find_java_home() -> Option<PathBuf> {
    let raw = std::env::var("JAVA_HOME").ok()?;
    let java_home = raw
        .trim_matches('"')
        .trim_matches('\'')
        .trim_end_matches(std::path::is_separator)
        .to_string();
    if java_home.is_empty() {
        return None;
    }
    let java = if cfg!(target_os = "windows") {
        let javaw = PathBuf::from(&java_home).join("bin").join("javaw.exe");
        if javaw.exists() {
            javaw
        } else {
            PathBuf::from(&java_home).join("bin").join("java.exe")
        }
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

    #[cfg(target_os = "windows")]
    {
        let path_var = std::env::var("PATH").ok()?;
        for dir in path_var.split(';') {
            let candidate = PathBuf::from(dir).join(java_name);
            if candidate.exists() {
                return Some(candidate);
            }
            let fallback = PathBuf::from(dir).join("java.exe");
            if fallback.exists() {
                return Some(fallback);
            }
        }
        None
    }

    #[cfg(not(target_os = "windows"))]
    {
        let path_var = std::env::var("PATH").ok()?;
        for dir in path_var.split(':') {
            let candidate = PathBuf::from(dir).join(java_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
        None
    }
}

fn find_all_in_path() -> Vec<JavaInfo> {
    let mut results = Vec::new();
    let java_names: &[&str] = if cfg!(target_os = "windows") {
        &["javaw.exe", "java.exe"]
    } else {
        &["java"]
    };
    let path_var = match std::env::var("PATH") {
        Ok(p) => p,
        Err(_) => return results,
    };
    let separator = if cfg!(target_os = "windows") { ';' } else { ':' };
    for dir in path_var.split(separator) {
        for java_name in java_names {
            let candidate = PathBuf::from(dir).join(java_name);
            if candidate.exists() {
                let path_str = candidate.to_string_lossy().to_string();
                if !results.iter().any(|r: &JavaInfo| r.path == path_str) {
                    let version = check_java_version(&candidate);
                    results.push(JavaInfo { path: path_str, version, vendor: None });
                }
            }
        }
    }
    results
}

#[cfg(target_os = "windows")]
fn find_windows_registry() -> Option<PathBuf> {
    let mut command = std::process::Command::new("reg");
    command.args([
        "query",
        r"HKLM\SOFTWARE\JavaSoft\Java Runtime Environment",
        "/s",
        "/v",
        "JavaHome",
    ]);
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command.output().ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(idx) = line.find("JavaHome") {
            if let Some(val) = line[idx..].split("REG_SZ").nth(1) {
                let java_home = val.trim();
                let javaw = PathBuf::from(java_home).join("bin").join("javaw.exe");
                if javaw.exists() {
                    return Some(javaw);
                }
                let java_exe = PathBuf::from(java_home).join("bin").join("java.exe");
                if java_exe.exists() {
                    return Some(java_exe);
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn find_all_windows_registry() -> Vec<JavaInfo> {
    let mut results = Vec::new();
    let mut command = std::process::Command::new("reg");
    command.args([
        "query",
        r"HKLM\SOFTWARE\JavaSoft\Java Runtime Environment",
        "/s",
        "/v",
        "JavaHome",
    ]);
    command.creation_flags(CREATE_NO_WINDOW);
    if let Ok(output) = command.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(idx) = line.find("JavaHome") {
                    if let Some(val) = line[idx..].split("REG_SZ").nth(1) {
                        let java_home = val.trim();
                        for exe in &["javaw.exe", "java.exe"] {
                            let java = PathBuf::from(java_home).join("bin").join(exe);
                            if java.exists() {
                                let path_str = java.to_string_lossy().to_string();
                                if !results.iter().any(|r: &JavaInfo| r.path == path_str) {
                                    let version = check_java_version(&java);
                                    results.push(JavaInfo { path: path_str, version, vendor: None });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut command = std::process::Command::new("reg");
    command.args([
        "query",
        r"HKLM\SOFTWARE\JavaSoft\JDK",
        "/s",
        "/v",
        "JavaHome",
    ]);
    command.creation_flags(CREATE_NO_WINDOW);
    if let Ok(output) = command.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(idx) = line.find("JavaHome") {
                    if let Some(val) = line[idx..].split("REG_SZ").nth(1) {
                        let java_home = val.trim();
                        for exe in &["javaw.exe", "java.exe"] {
                            let java = PathBuf::from(java_home).join("bin").join(exe);
                            if java.exists() {
                                let path_str = java.to_string_lossy().to_string();
                                if !results.iter().any(|r: &JavaInfo| r.path == path_str) {
                                    let version = check_java_version(&java);
                                    results.push(JavaInfo { path: path_str, version, vendor: None });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

#[cfg(target_os = "linux")]
fn find_linux_java() -> Option<PathBuf> {
    let search_paths: &[&str] = &[
        "/usr/lib/jvm/default/bin/java",
        "/usr/lib/jvm/default-jdk/bin/java",
        "/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-21-openjdk-arm64/bin/java",
        "/usr/lib/jvm/java-17-openjdk-arm64/bin/java",
        "/usr/lib/jvm/java-11-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-8-openjdk-amd64/bin/java",
        "/usr/local/lib/jvm/bin/java",
    ];
    for path_str in search_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(entries) = std::fs::read_dir("/usr/lib/jvm") {
        for entry in entries.flatten() {
            let java = entry.path().join("bin").join("java");
            if java.exists() {
                return Some(java);
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn find_all_linux_java() -> Vec<JavaInfo> {
    let mut results = Vec::new();
    let search_paths: &[&str] = &[
        "/usr/lib/jvm/default/bin/java",
        "/usr/lib/jvm/default-jdk/bin/java",
        "/usr/lib/jvm/java-25-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-24-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-23-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-22-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-11-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-8-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-25-openjdk-arm64/bin/java",
        "/usr/lib/jvm/java-21-openjdk-arm64/bin/java",
        "/usr/lib/jvm/java-17-openjdk-arm64/bin/java",
        "/usr/local/lib/jvm/bin/java",
    ];
    for path_str in search_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            let version = check_java_version(&p);
            results.push(JavaInfo { path: p.to_string_lossy().to_string(), version, vendor: None });
        }
    }
    if let Ok(entries) = std::fs::read_dir("/usr/lib/jvm") {
        for entry in entries.flatten() {
            let java = entry.path().join("bin").join("java");
            if java.exists() {
                let path_str = java.to_string_lossy().to_string();
                if !results.iter().any(|r: &JavaInfo| r.path == path_str) {
                    let version = check_java_version(&java);
                    results.push(JavaInfo { path: path_str, version, vendor: None });
                }
            }
        }
    }
    results
}

#[cfg(target_os = "macos")]
fn find_macos_java() -> Option<PathBuf> {
    for major in [21, 17, 11, 8, 18, 19, 20, 22, 23, 24, 25] {
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

#[cfg(target_os = "macos")]
fn find_all_macos_java() -> Vec<JavaInfo> {
    let mut results = Vec::new();
    for major in [25, 24, 23, 22, 21, 20, 19, 18, 17, 11, 8] {
        let output = std::process::Command::new("/usr/libexec/java_home")
            .arg("-v")
            .arg(major.to_string())
            .output();
        if let Ok(output) = output {
            if output.status.success() {
                let home = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !home.is_empty() {
                    let java = PathBuf::from(&home).join("bin").join("java");
                    if java.exists() {
                        let path_str = java.to_string_lossy().to_string();
                        if !results.iter().any(|r: &JavaInfo| r.path == path_str) {
                            let version = check_java_version(&java);
                            results.push(JavaInfo { path: path_str, version, vendor: None });
                        }
                    }
                }
            }
        }
    }
    results
}

#[allow(clippy::ptr_arg)]
pub fn check_java_version(java_path: &PathBuf) -> Option<u32> {
    let mut command = std::process::Command::new(java_path.as_os_str());
    command.arg("-version");
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command.output().ok()?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_java_version_modern() {
        assert_eq!(parse_java_version("openjdk version \"21.0.1\" 2023-10-17"), Some(21));
        assert_eq!(parse_java_version("openjdk version \"17.0.9\" 2023-10-17"), Some(17));
    }

    #[test]
    fn test_parse_java_version_legacy() {
        assert_eq!(parse_java_version("java version \"1.8.0_392\""), Some(8));
        assert_eq!(parse_java_version("java version \"1.11.0_20\""), Some(11));
    }

    #[test]
    fn test_parse_java_version_invalid() {
        assert_eq!(parse_java_version("not a version string"), None);
        assert_eq!(parse_java_version(""), None);
    }

    #[test]
    fn test_java_home_cleaning() {
        let cases = vec![
            ("\"C:\\Program Files\\Java\\jdk-21\"", "C:\\Program Files\\Java\\jdk-21"),
            ("'/usr/lib/jvm/java-21'", "/usr/lib/jvm/java-21"),
            ("/usr/lib/jvm/java-21/", "/usr/lib/jvm/java-21"),
        ];
        for (input, expected) in cases {
            let cleaned = input
                .trim_matches('"')
                .trim_matches('\'')
                .trim_end_matches(std::path::is_separator)
                .to_string();
            assert_eq!(cleaned, expected, "Failed for input: {:?}", input);
        }
    }
}
