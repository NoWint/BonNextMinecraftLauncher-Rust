use crate::error::LauncherError;
use crate::version::resolver::ResolvedLibrary;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};

pub fn extract_natives(
    libraries: &[ResolvedLibrary],
    natives_dir: &Path,
) -> Result<(), LauncherError> {
    fs::create_dir_all(natives_dir)?;

    for lib in libraries {
        if !lib.is_native {
            continue;
        }

        let jar_path = PathBuf::from(&lib.artifact.path);
        let full_path = crate::platform::paths::get_libraries_dir().join(&jar_path);

        if !full_path.exists() {
            tracing::warn!("Native JAR not found: {}", full_path.display());
            continue;
        }

        extract_native_jar(&full_path, natives_dir, &lib.extract_exclude)?;
    }

    Ok(())
}

fn extract_native_jar(
    jar_path: &Path,
    natives_dir: &Path,
    exclude: &[String],
) -> Result<(), LauncherError> {
    let file = File::open(jar_path)?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| LauncherError::LaunchFailed(format!("Failed to open native JAR: {}", e)))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| {
            LauncherError::LaunchFailed(format!("Failed to read zip entry: {}", e))
        })?;

        let name = entry.name().to_string();

        if should_exclude(&name, exclude) {
            continue;
        }

        if entry.is_dir() {
            continue;
        }

        let out_path = natives_dir.join(&name);

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut out_file = File::create(&out_path)?;
        std::io::copy(&mut entry, &mut out_file)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if name.ends_with(".so") || name.ends_with(".dylib") {
                fs::set_permissions(&out_path, fs::Permissions::from_mode(0o755))?;
            }
        }
    }

    Ok(())
}

fn should_exclude(name: &str, exclude: &[String]) -> bool {
    for pattern in exclude {
        if name.starts_with(pattern) {
            return true;
        }
    }
    false
}
