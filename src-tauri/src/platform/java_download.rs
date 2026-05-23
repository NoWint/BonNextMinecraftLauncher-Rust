#![allow(dead_code)]
use crate::error::LauncherError;
use crate::platform::paths;
use serde::Serialize;
use std::io::Read;
use std::path::{Path, PathBuf};

/// A JRE release entry from the Adoptium API.
#[derive(Debug, Clone, Serialize)]
pub struct JreRelease {
    pub major_version: u32,
    pub os: String,
    pub arch: String,
    pub image_type: String,
    pub download_url: String,
    pub size_mb: f64,
}

/// Check if a compatible JRE is already downloaded for the given major version.
pub fn find_downloaded_jre(major_version: u32) -> Option<PathBuf> {
    let target_dir = paths::get_game_dir()
        .join("java")
        .join(major_version.to_string());
    let java_exe = java_executable_path(&target_dir);
    if java_exe.exists() {
        tracing::info!("Found downloaded JRE {}: {}", major_version, java_exe.display());
        Some(java_exe)
    } else {
        None
    }
}

/// Get available JRE versions from Adoptium for current OS/arch.
pub async fn fetch_available_jres(major_version: u32) -> Result<Vec<JreRelease>, LauncherError> {
    let api_url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot",
        major_version
    );
    let client = crate::http_client::build_client();
    let json: Vec<serde_json::Value> = client
        .get(&api_url)
        .send().await?.error_for_status()?
        .json().await?;

    let target_os = current_os_name();
    let target_arch = current_arch_name();
    let mut releases = Vec::new();

    for entry in &json {
        let binary = entry.get("binary").and_then(|b| b.as_object());
        let package = entry.get("binary").and_then(|b| b.get("package")).and_then(|p| p.as_object());
        if let (Some(binary), Some(package)) = (binary, package) {
            let os = binary.get("os").and_then(|v| v.as_str()).unwrap_or("");
            let arch = binary.get("architecture").and_then(|v| v.as_str()).unwrap_or("");
            let image_type = binary.get("image_type").and_then(|v| v.as_str()).unwrap_or("");
            let size = package.get("size").and_then(|v| v.as_u64()).unwrap_or(0) as f64 / 1_048_576.0;
            let url = package.get("link").and_then(|v| v.as_str()).unwrap_or("");

            if os == target_os && arch == target_arch && !url.is_empty() {
                releases.push(JreRelease {
                    major_version,
                    os: os.to_string(),
                    arch: arch.to_string(),
                    image_type: image_type.to_string(),
                    download_url: url.to_string(),
                    size_mb: size,
                });
            }
        }
    }
    Ok(releases)
}

/// Download and extract an Adoptium JDK for the current platform.
///
/// Uses the Adoptium API v3 to find the right binary for the current
/// OS and architecture, downloads it, and extracts it to
/// `{game_dir}/java/{version}/`.
///
/// The `on_progress` callback receives (downloaded_bytes, total_bytes).
/// Returns the path to the java executable.
pub async fn download_java(java_version: u32) -> Result<String, LauncherError> {
    download_java_with_progress(java_version, |_, _| {}).await
}

/// Same as download_java but with a progress callback.
pub async fn download_java_with_progress(
    java_version: u32,
    on_progress: impl Fn(u64, u64) + Send + 'static,
) -> Result<String, LauncherError> {
    let target_dir = paths::get_game_dir()
        .join("java")
        .join(java_version.to_string());

    let java_exe = java_executable_path(&target_dir);

    // If already downloaded, return the path
    if java_exe.exists() {
        tracing::info!(
            "Java {} already present at {}",
            java_version,
            java_exe.display()
        );
        return Ok(java_exe.to_string_lossy().to_string());
    }

    std::fs::create_dir_all(&target_dir)?;

    let download_url = resolve_adoptium_url(java_version).await?;

    tracing::info!(
        "Downloading Java {} from {}",
        java_version,
        download_url
    );

    let temp_dir = tempfile::TempDir::new()
        .map_err(|e| LauncherError::Other(format!("Failed to create temp dir: {}", e)))?;

    let archive_name = download_url
        .rsplit('/')
        .next()
        .unwrap_or("jdk.archive");
    let archive_path = temp_dir.path().join(archive_name);

    download_file(&download_url, &archive_path, &on_progress).await?;

    tracing::info!("Extracting Java {} to {}", java_version, target_dir.display());

    extract_archive(&archive_path, &target_dir)?;

    // On macOS, JDK may be nested inside a Contents/Home directory.
    // Search for the actual java executable after extraction.
    let final_java_path = find_java_after_extract(&target_dir)?;

    if !final_java_path.exists() {
        return Err(LauncherError::Other(format!(
            "Java executable not found after extraction at: {}",
            final_java_path.display()
        )));
    }

    // Make java executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Some(bin_dir) = final_java_path.parent() {
            if let Ok(entries) = std::fs::read_dir(bin_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let file_name = path.file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let is_executable_candidate = !file_name.contains('.')
                            || file_name.ends_with(".sh")
                            || file_name == "jspawnhelper";
                        if is_executable_candidate {
                            if let Ok(metadata) = std::fs::metadata(&path) {
                                let mut perms = metadata.permissions();
                                perms.set_mode(0o755);
                                if let Err(e) = std::fs::set_permissions(&path, perms) {
                                    tracing::warn!("Failed to set executable permission on {}: {}", path.display(), e);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    tracing::info!(
        "Java {} installed at {}",
        java_version,
        final_java_path.display()
    );

    Ok(final_java_path.to_string_lossy().to_string())
}

/// Query the Adoptium API v3 for the latest JDK binary URL for the current platform.
async fn resolve_adoptium_url(java_version: u32) -> Result<String, LauncherError> {
    let api_url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot",
        java_version
    );

    let client = crate::http_client::build_client();
    let response = client
        .get(&api_url)
        .send()
        .await
        .map_err(LauncherError::Http)?;

    if !response.status().is_success() {
        return Err(LauncherError::Other(format!(
            "Adoptium API returned {} for version {}",
            response.status(),
            java_version
        )));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(LauncherError::Http)?;

    let binaries = json
        .as_array()
        .ok_or_else(|| {
            LauncherError::Other("Unexpected Adoptium API response format".to_string())
        })?;

    let target_os = current_os_name();
    let target_arch = current_arch_name();

    // First pass: look for exact match (os + arch + jdk image_type)
    for release in binaries {
        let binary = release
            .get("binary")
            .and_then(|b| b.as_object());

        let package = release
            .get("binary")
            .and_then(|b| b.get("package"))
            .and_then(|p| p.as_object());

        if let (Some(binary), Some(package)) = (binary, package) {
            let os = binary
                .get("os")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let arch = binary
                .get("architecture")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let image_type = binary
                .get("image_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if os == target_os && arch == target_arch && image_type == "jdk" {
                if let Some(link) = package
                    .get("link")
                    .and_then(|v| v.as_str())
                {
                    return Ok(link.to_string());
                }
            }
        }
    }

    // Fallback: try without image_type filter
    for release in binaries {
        let binary = release
            .get("binary")
            .and_then(|b| b.as_object());

        let package = release
            .get("binary")
            .and_then(|b| b.get("package"))
            .and_then(|p| p.as_object());

        if let (Some(binary), Some(package)) = (binary, package) {
            let os = binary
                .get("os")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let arch = binary
                .get("architecture")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if os == target_os && arch == target_arch {
                if let Some(link) = package
                    .get("link")
                    .and_then(|v| v.as_str())
                {
                    return Ok(link.to_string());
                }
            }
        }
    }

    Err(LauncherError::Other(format!(
        "No Adoptium JDK found for {} {} version {}",
        target_os, target_arch, java_version
    )))
}

fn current_os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
}

fn current_arch_name() -> &'static str {
    if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86") {
        "x86"
    } else if cfg!(target_arch = "arm") {
        "arm"
    } else {
        "x64"
    }
}

fn java_executable_path(target_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        let javaw = target_dir.join("bin").join("javaw.exe");
        if javaw.exists() {
            javaw
        } else {
            target_dir.join("bin").join("java.exe")
        }
    } else {
        target_dir.join("bin").join("java")
    }
}

/// After extracting, find the actual java executable.
/// On macOS, Adoptium tar.gz extracts with a nested Contents/Home structure.
fn find_java_after_extract(target_dir: &Path) -> Result<PathBuf, LauncherError> {
    // First, check if java is directly in target_dir/bin/
    let direct = java_executable_path(target_dir);
    if direct.exists() {
        return Ok(direct);
    }

    // On macOS, look for Contents/Home/bin/java inside extracted JDK directory
    #[cfg(target_os = "macos")]
    {
        for entry in std::fs::read_dir(target_dir).map_err(LauncherError::Io)? {
            let entry = entry.map_err(LauncherError::Io)?;
            let path = entry.path();
            if path.is_dir() {
                let home_java = path
                    .join("Contents")
                    .join("Home")
                    .join("bin")
                    .join("java");
                if home_java.exists() {
                    return Ok(home_java);
                }
            }
        }
    }

    // Search recursively for a bin/java executable (up to 3 levels deep)
    let found = find_java_recursive(target_dir, 3).map_err(LauncherError::Io)?;
    Ok(found)
}

fn find_java_recursive(dir: &Path, max_depth: u32) -> Result<PathBuf, std::io::Error> {
    if max_depth == 0 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "java not found in nested directories",
        ));
    }

    if dir.is_dir() {
        let candidate = java_executable_path(dir);
        if candidate.exists() {
            return Ok(candidate);
        }

        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                match find_java_recursive(&path, max_depth - 1) {
                    Ok(found) => return Ok(found),
                    Err(_) => continue,
                }
            }
        }
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "java not found in recursive search",
    ))
}

/// Download a file from a URL to a local path, with progress callback.
async fn download_file(
    url: &str,
    dest: &Path,
    on_progress: &(impl Fn(u64, u64) + Send + 'static),
) -> Result<(), LauncherError> {
    let client = crate::http_client::build_download_client();

    let response = client
        .get(url)
        .send()
        .await
        .map_err(LauncherError::Http)?;

    let response = response
        .error_for_status()
        .map_err(LauncherError::Http)?;

    let total_size = response.content_length().unwrap_or(0);

    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(LauncherError::Io)?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use futures_util::StreamExt;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(LauncherError::Http)?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(LauncherError::Io)?;
        downloaded += chunk.len() as u64;

        // Report progress via callback
        on_progress(downloaded, total_size);

        // Log progress every 10MB
        if downloaded % (10 * 1024 * 1024) < 1024 * 1024 {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 {
                (downloaded as f64 / elapsed) as u64
            } else {
                0
            };
            tracing::info!(
                "Java download: {:.1}MB / {:.1}MB ({:.1} MB/s)",
                downloaded as f64 / 1_048_576.0,
                total_size as f64 / 1_048_576.0,
                speed as f64 / 1_048_576.0,
            );
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(LauncherError::Io)?;

    tracing::info!(
        "Java download complete: {:.1}MB",
        downloaded as f64 / 1_048_576.0
    );

    Ok(())
}

/// Extract a .tar.gz or .zip archive to a destination directory.
fn extract_archive(archive_path: &Path, dest: &Path) -> Result<(), LauncherError> {
    std::fs::create_dir_all(dest)?;

    match detect_archive_format(archive_path) {
        ArchiveFormat::Zip => extract_zip(archive_path, dest),
        ArchiveFormat::TarGz => extract_tar_gz(archive_path, dest),
    }
}

enum ArchiveFormat {
    Zip,
    TarGz,
}

fn detect_archive_format(path: &Path) -> ArchiveFormat {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if file_name.ends_with(".zip") {
        return ArchiveFormat::Zip;
    }
    if file_name.ends_with(".tar.gz") || file_name.ends_with(".tgz") {
        return ArchiveFormat::TarGz;
    }

    if let Ok(mut f) = std::fs::File::open(path) {
        let mut magic = [0u8; 4];
        if f.read_exact(&mut magic).is_ok() {
            if magic[0] == 0x50 && magic[1] == 0x4B && magic[2] == 0x03 && magic[3] == 0x04 {
                return ArchiveFormat::Zip;
            }
            if magic[0] == 0x1F && magic[1] == 0x8B {
                return ArchiveFormat::TarGz;
            }
        }
    }

    if cfg!(target_os = "windows") {
        ArchiveFormat::Zip
    } else {
        ArchiveFormat::TarGz
    }
}

fn extract_zip(archive_path: &Path, dest: &Path) -> Result<(), LauncherError> {
    let file = std::fs::File::open(archive_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().to_string();
        let entry_path = sanitize_entry_path(dest, &name)?;

        if entry.is_dir() {
            std::fs::create_dir_all(&entry_path)?;
        } else {
            if let Some(parent) = entry_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out_file = std::fs::File::create(&entry_path)?;
            std::io::copy(&mut entry, &mut out_file)?;
        }
    }

    #[cfg(unix)]
    {
        set_bin_executable_permissions(dest);
    }

    Ok(())
}

fn extract_tar_gz(archive_path: &Path, dest: &Path) -> Result<(), LauncherError> {
    use flate2::read::GzDecoder;
    use tar::Archive;

    let file = std::fs::File::open(archive_path)?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?;
        let path_str = path.to_string_lossy().to_string();
        let entry_dest = sanitize_entry_path(dest, &path_str)?;

        if entry.header().entry_type().is_dir() {
            std::fs::create_dir_all(&entry_dest)?;
        } else {
            if let Some(parent) = entry_dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            entry.unpack(&entry_dest).map_err(|e| LauncherError::Other(format!(
                "Failed to unpack tar entry: {}", e
            )))?;
        }
    }

    #[cfg(unix)]
    {
        set_bin_executable_permissions(dest);
    }

    Ok(())
}

#[cfg(unix)]
fn set_bin_executable_permissions(base_dir: &Path) {
    use std::os::unix::fs::PermissionsExt;
    fn set_perms_recursive(dir: &Path) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if path.file_name().map_or(false, |n| n == "bin") {
                        if let Ok(bin_entries) = std::fs::read_dir(&path) {
                            for bin_entry in bin_entries.flatten() {
                                let bin_path = bin_entry.path();
                                if bin_path.is_file() {
                                    if let Ok(metadata) = std::fs::metadata(&bin_path) {
                                        let mut perms = metadata.permissions();
                                        perms.set_mode(0o755);
                                        if let Err(e) = std::fs::set_permissions(&bin_path, perms) {
                                            tracing::warn!("Failed to set permission on {}: {}", bin_path.display(), e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    set_perms_recursive(&path);
                }
            }
        }
    }
    set_perms_recursive(base_dir);
}

/// Strip any parent directory (`..`) components and leading slashes from an
/// archive entry name to prevent zip-slip attacks.
fn sanitize_entry_path(base: &Path, name: &str) -> Result<PathBuf, LauncherError> {
    // Build a safe path by filtering out parent-directory components
    let safe: PathBuf = std::path::Path::new(name)
        .components()
        .filter(|c| !matches!(c, std::path::Component::ParentDir | std::path::Component::RootDir))
        .collect();

    Ok(base.join(safe))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_entry_path_prevents_traversal() {
        let base = Path::new("/tmp/jdk");
        let result = sanitize_entry_path(base, "../../etc/passwd").unwrap();
        assert!(result.starts_with("/tmp/jdk"));
        assert!(!result.to_string_lossy().contains(".."));
    }

    #[test]
    fn test_sanitize_entry_path_allows_normal() {
        let base = Path::new("/tmp/jdk");
        let result = sanitize_entry_path(base, "bin/java").unwrap();
        assert_eq!(result, Path::new("/tmp/jdk/bin/java"));
    }

    #[test]
    fn test_sanitize_entry_path_strips_leading_slash() {
        let base = Path::new("/tmp/jdk");
        let result = sanitize_entry_path(base, "/etc/passwd").unwrap();
        assert!(result.starts_with("/tmp/jdk"));
        assert!(!result.to_string_lossy().contains(".."));
    }

    #[test]
    fn test_sanitize_entry_path_mixed_traversal() {
        let base = Path::new("/tmp/jdk");
        let result = sanitize_entry_path(base, "foo/../../bar/baz").unwrap();
        assert!(result.starts_with("/tmp/jdk"));
        assert!(!result.to_string_lossy().contains(".."));
    }

    #[test]
    fn test_current_os_name_returns_valid() {
        let os = current_os_name();
        assert!(!os.is_empty());
        assert!(os == "windows" || os == "mac" || os == "linux");
    }

    #[test]
    fn test_current_arch_name_returns_valid() {
        let arch = current_arch_name();
        assert!(!arch.is_empty());
        assert!(arch == "x64" || arch == "x86" || arch == "aarch64" || arch == "arm");
    }

    #[test]
    fn test_detect_archive_format_zip_magic() {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("test_unknown_archive");
        {
            use std::io::Write;
            let mut f = std::fs::File::create(&zip_path).unwrap();
            f.write_all(&[0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]).unwrap();
        }
        assert!(matches!(detect_archive_format(&zip_path), ArchiveFormat::Zip));
    }

    #[test]
    fn test_detect_archive_format_gzip_magic() {
        let dir = tempfile::tempdir().unwrap();
        let gz_path = dir.path().join("test_unknown_archive");
        {
            use std::io::Write;
            let mut f = std::fs::File::create(&gz_path).unwrap();
            f.write_all(&[0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]).unwrap();
        }
        assert!(matches!(detect_archive_format(&gz_path), ArchiveFormat::TarGz));
    }

    #[test]
    fn test_detect_archive_format_by_extension() {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("jdk.zip");
        let tgz_path = dir.path().join("jdk.tar.gz");
        std::fs::File::create(&zip_path).unwrap();
        std::fs::File::create(&tgz_path).unwrap();
        assert!(matches!(detect_archive_format(&zip_path), ArchiveFormat::Zip));
        assert!(matches!(detect_archive_format(&tgz_path), ArchiveFormat::TarGz));
    }

    #[test]
    fn test_java_executable_path() {
        let dir = Path::new("/tmp/jdk-21");
        let result = java_executable_path(dir);
        if cfg!(target_os = "windows") {
            assert!(result.to_string_lossy().contains("java.exe") || result.to_string_lossy().contains("javaw.exe"));
        } else {
            assert!(result.to_string_lossy().ends_with("bin/java"));
        }
    }
}
