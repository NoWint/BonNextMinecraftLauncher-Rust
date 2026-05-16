use crate::error::LauncherError;
use sha1::{Digest, Sha1};
use std::path::Path;

pub fn verify_file_sha1(path: &Path, expected_sha1: &str) -> Result<(), LauncherError> {
    let data = std::fs::read(path).map_err(|e| {
        LauncherError::Sha1Mismatch(format!(
            "cannot read file {}: {}",
            path.display(),
            e
        ))
    })?;

    let actual_sha1 = compute_sha1(&data);

    if actual_sha1.eq_ignore_ascii_case(expected_sha1) {
        Ok(())
    } else {
        Err(LauncherError::Sha1Mismatch(format!(
            "file {} expected {} but got {}",
            path.display(),
            expected_sha1,
            actual_sha1
        )))
    }
}

pub fn compute_sha1(data: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex::encode(result)
}

pub fn file_exists_and_valid(path: &Path, expected_sha1: &str, expected_size: u64) -> bool {
    if !path.exists() {
        return false;
    }

    if expected_size > 0 {
        if let Ok(metadata) = std::fs::metadata(path) {
            if metadata.len() != expected_size {
                return false;
            }
        } else {
            return false;
        }
    }

    // If SHA1 is unknown (empty), skip hash verification
    if expected_sha1.is_empty() {
        return true;
    }

    verify_file_sha1(path, expected_sha1).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn known_sha1_matches() {
        let data = b"hello world";
        let hash = compute_sha1(data);
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(data).unwrap();
        assert!(verify_file_sha1(f.path(), &hash).is_ok());
    }

    #[test]
    fn wrong_sha1_fails() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"data").unwrap();
        assert!(verify_file_sha1(f.path(), "0000000000000000000000000000000000000000").is_err());
    }

    #[test]
    fn empty_sha1_skips_check() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"data").unwrap();
        assert!(file_exists_and_valid(f.path(), "", 0));
    }

    #[test]
    fn missing_file_is_invalid() {
        assert!(!file_exists_and_valid(std::path::Path::new("/nonexistent_xyz"), "abc", 0));
    }

    #[test]
    fn size_mismatch_is_invalid() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"16bytes").unwrap();
        assert!(!file_exists_and_valid(f.path(), "", 999));
    }
}
