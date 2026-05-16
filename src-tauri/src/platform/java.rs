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

    let bonnext_java = crate::platform::paths::get_game_dir().join("jre").join("bin").join("java");
    if bonnext_java.exists() {
        return Some(bonnext_java.to_string_lossy().to_string());
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

    let bonnext_java = crate::platform::paths::get_game_dir().join("jre").join("bin").join("java.exe");
    if bonnext_java.exists() {
        return Some(bonnext_java.to_string_lossy().to_string());
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

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let java_bin = std::path::Path::new(&java_home).join("bin").join("java");
        if java_bin.exists() {
            return Some(java_bin.to_string_lossy().to_string());
        }
    }

    let bonnext_java = crate::platform::paths::get_game_dir().join("jre").join("bin").join("java");
    if bonnext_java.exists() {
        return Some(bonnext_java.to_string_lossy().to_string());
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

pub async fn download_jre() -> Result<String, LauncherError> {
    let jre_dir = crate::platform::paths::get_game_dir().join("jre");
    if jre_dir.exists() {
        #[cfg(target_os = "windows")]
        let java_bin = jre_dir.join("bin").join("java.exe");
        #[cfg(not(target_os = "windows"))]
        let java_bin = jre_dir.join("bin").join("java");

        if java_bin.exists() {
            return Ok(java_bin.to_string_lossy().to_string());
        }
    }

    let (url, file_name) = if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        ("https://mirrors.huaweicloud.com/openjdk/21.0.2/openjdk-21.0.2_macos-aarch64_bin.tar.gz", "jre.tar.gz")
    } else if cfg!(target_os = "macos") {
        ("https://mirrors.huaweicloud.com/openjdk/21.0.2/openjdk-21.0.2_macos-x64_bin.tar.gz", "jre.tar.gz")
    } else if cfg!(target_os = "windows") && cfg!(target_arch = "x86_64") {
        ("https://mirrors.huaweicloud.com/openjdk/21.0.2/openjdk-21.0.2_windows-x64_bin.zip", "jre.zip")
    } else if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
        ("https://mirrors.huaweicloud.com/openjdk/21.0.2/openjdk-21.0.2_linux-x64_bin.tar.gz", "jre.tar.gz")
    } else {
        return Err(LauncherError::Other("Unsupported platform for JRE download".to_string()));
    };

    tracing::info!("Downloading JRE from: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()?;

    let response = client.get(url).send().await?.error_for_status()?;

    let tmp_dir = std::env::temp_dir().join("bonnext-jre-download");
    let tmp_dir_clone = tmp_dir.clone();
    tokio::task::spawn_blocking(move || std::fs::create_dir_all(&tmp_dir_clone))
        .await
        .map_err(|e| LauncherError::Other(e.to_string()))??;
    let archive_path = tmp_dir.join(file_name);

    let mut file = tokio::fs::File::create(&archive_path).await?;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
    }

    tracing::info!("JRE downloaded, extracting...");

    let game_dir = crate::platform::paths::get_game_dir();
    tokio::fs::create_dir_all(game_dir.join("jre")).await?;

    let archive_path_clone = archive_path.clone();
    let jre_dest = game_dir.join("jre");
    let extract_result: Result<Result<(), LauncherError>, _> = tokio::task::spawn_blocking(move || {
        if cfg!(target_os = "windows") {
            let status = std::process::Command::new("powershell")
                .args([
                    "-Command",
                    &format!(
                        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                        archive_path_clone.display(),
                        jre_dest.display()
                    ),
                ])
                .status()
                .map_err(|e| LauncherError::Io(e))?;
            if !status.success() {
                return Err(LauncherError::Other("Failed to extract JRE archive".to_string()));
            }
        } else {
            let status = std::process::Command::new("tar")
                .args([
                    "-xzf",
                    &archive_path_clone.to_string_lossy(),
                    "-C",
                    &jre_dest.to_string_lossy(),
                ])
                .status()
                .map_err(|e| LauncherError::Io(e))?;
            if !status.success() {
                return Err(LauncherError::Other("Failed to extract JRE archive".to_string()));
            }
        }
        Ok(())
    }).await;

    extract_result
        .map_err(|e| LauncherError::Other(e.to_string()))?
        ?;

    let _ = tokio::fs::remove_file(&archive_path).await;

    fn find_java_in_dir(dir: &std::path::Path) -> Option<std::path::PathBuf> {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = path.file_name()?.to_string_lossy();
                    if name.starts_with("jdk") {
                        #[cfg(target_os = "windows")]
                        let java = path.join("bin").join("java.exe");
                        #[cfg(not(target_os = "windows"))]
                        let java = path.join("bin").join("java");
                        if java.exists() {
                            return Some(java);
                        }
                    }
                    if let Some(found) = find_java_in_dir(&path) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }

    if let Some(found) = find_java_in_dir(&game_dir.join("jre")) {
        tracing::info!("JRE installed at: {}", found.display());
        return Ok(found.to_string_lossy().to_string());
    }

    let _ = tokio::fs::remove_dir_all(game_dir.join("jre")).await;

    Err(LauncherError::Other("Could not find java binary after extraction".to_string()))
}
