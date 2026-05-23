use crate::error::LauncherError;
use crate::platform::paths::get_config_dir;

pub fn set_secure_permissions(path: &std::path::Path) -> Result<(), LauncherError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(path)?;
        let mut perms = metadata.permissions();
        perms.set_mode(0o600);
        std::fs::set_permissions(path, perms)?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

pub fn check_sensitive_file_permissions(path: &std::path::Path) -> Result<bool, LauncherError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if !path.exists() {
            return Ok(true);
        }
        let metadata = std::fs::metadata(path)?;
        let mode = metadata.permissions().mode();
        let others = mode & 0o007;
        let group = mode & 0o070;
        Ok(others == 0 && group == 0)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(true)
    }
}

pub fn fix_sensitive_file_permissions(path: &std::path::Path) -> Result<bool, LauncherError> {
    if !path.exists() {
        return Ok(false);
    }
    if check_sensitive_file_permissions(path)? {
        return Ok(false);
    }
    set_secure_permissions(path)?;
    Ok(true)
}

pub fn get_sensitive_files() -> Vec<std::path::PathBuf> {
    let config = get_config_dir();
    vec![
        config.join("accounts.json.enc"),
        config.join(".security_salt"),
        config.join("security_config.json.enc"),
        config.join("security").join("audit.log"),
    ]
}

pub fn check_all_sensitive_permissions() -> Vec<(std::path::PathBuf, bool)> {
    get_sensitive_files()
        .into_iter()
        .filter(|p| p.exists())
        .map(|p| {
            let ok = check_sensitive_file_permissions(&p).unwrap_or(false);
            (p, ok)
        })
        .collect()
}

pub fn fix_all_sensitive_permissions() -> Vec<(std::path::PathBuf, bool)> {
    get_sensitive_files()
        .into_iter()
        .filter(|p| p.exists())
        .filter_map(|p| match fix_sensitive_file_permissions(&p) {
            Ok(fixed) => Some((p, fixed)),
            Err(_) => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(unix)]
    fn set_permissions_creates_600() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test_sensitive");
        std::fs::write(&file_path, b"test").unwrap();
        set_secure_permissions(&file_path).unwrap();
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&file_path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    #[cfg(unix)]
    fn check_permissions_detects_insecure() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test_insecure");
        std::fs::write(&file_path, b"test").unwrap();
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&file_path).unwrap().permissions();
        perms.set_mode(0o644);
        std::fs::set_permissions(&file_path, perms).unwrap();
        assert!(!check_sensitive_file_permissions(&file_path).unwrap());
        let fixed = fix_sensitive_file_permissions(&file_path).unwrap();
        assert!(fixed);
        assert!(check_sensitive_file_permissions(&file_path).unwrap());
    }
}
