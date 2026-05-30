use serde::{Serialize, Deserialize};
use sha1::{Sha1, Digest as Sha1Digest};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileInfo {
    pub filename: String,
    pub sha1: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfigSnapshot {
    pub minecraft_version: String,
    pub loader_type: Option<String>,
    pub loader_version: Option<String>,
    pub mods: Vec<FileInfo>,
    pub resource_packs: Vec<FileInfo>,
    pub shaders: Vec<FileInfo>,
    pub jvm_args: Option<String>,
    pub memory_mb: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigDiff {
    pub version_match: bool,
    pub loader_match: bool,
    pub missing_mods: Vec<FileInfo>,
    pub extra_mods: Vec<FileInfo>,
    pub missing_resource_packs: Vec<FileInfo>,
    pub missing_shaders: Vec<FileInfo>,
    pub total_download_bytes: u64,
    pub total_file_count: u32,
}

pub fn generate_instance_snapshot(
    instance_dir: &PathBuf,
    minecraft_version: &str,
    loader_type: Option<&str>,
    loader_version: Option<&str>,
) -> Result<PeerConfigSnapshot, String> {
    Ok(PeerConfigSnapshot {
        minecraft_version: minecraft_version.to_string(),
        loader_type: loader_type.map(|s| s.to_string()),
        loader_version: loader_version.map(|s| s.to_string()),
        mods: scan_files(&instance_dir.join("mods"))?,
        resource_packs: scan_files(&instance_dir.join("resourcepacks"))?,
        shaders: scan_files(&instance_dir.join("shaderpacks"))?,
        jvm_args: None,
        memory_mb: None,
    })
}

pub fn compute_diff(local: &PeerConfigSnapshot, remote: &PeerConfigSnapshot) -> ConfigDiff {
    let local_mods: std::collections::HashSet<String> = local.mods.iter().map(|m| m.filename.clone()).collect();
    let remote_mods: std::collections::HashSet<String> = remote.mods.iter().map(|m| m.filename.clone()).collect();
    let missing_mods: Vec<FileInfo> = remote.mods.iter().filter(|m| !local_mods.contains(&m.filename)).cloned().collect();
    let extra_mods: Vec<FileInfo> = local.mods.iter().filter(|m| !remote_mods.contains(&m.filename)).cloned().collect();
    let local_rps: std::collections::HashSet<String> = local.resource_packs.iter().map(|r| r.filename.clone()).collect();
    let missing_resource_packs: Vec<FileInfo> = remote.resource_packs.iter().filter(|r| !local_rps.contains(&r.filename)).cloned().collect();
    let local_shaders: std::collections::HashSet<String> = local.shaders.iter().map(|s| s.filename.clone()).collect();
    let missing_shaders: Vec<FileInfo> = remote.shaders.iter().filter(|s| !local_shaders.contains(&s.filename)).cloned().collect();
    let total_download_bytes: u64 = missing_mods.iter().map(|m| m.size_bytes).sum::<u64>()
        + missing_resource_packs.iter().map(|r| r.size_bytes).sum::<u64>()
        + missing_shaders.iter().map(|s| s.size_bytes).sum::<u64>();
    let total_file_count = (missing_mods.len() + missing_resource_packs.len() + missing_shaders.len()) as u32;
    ConfigDiff {
        version_match: local.minecraft_version == remote.minecraft_version,
        loader_match: local.loader_type == remote.loader_type && local.loader_version == remote.loader_version,
        missing_mods,
        extra_mods,
        missing_resource_packs,
        missing_shaders,
        total_download_bytes,
        total_file_count,
    }
}

fn scan_files(dir: &PathBuf) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    let entries = std::fs::read_dir(dir).map_err(|e| format!("Failed to read {:?}: {}", dir, e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            let sha1 = compute_quick_sha1(&path).unwrap_or_default();
            files.push(FileInfo { filename, sha1, size_bytes: size });
        }
    }
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

fn compute_quick_sha1(path: &PathBuf) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("read error: {}", e))?;
    let hash = Sha1::digest(&data);
    Ok(hex::encode(hash))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_scan_empty_dir() {
        let dir = tempdir().unwrap();
        let files = scan_files(&dir.path().to_path_buf()).unwrap();
        assert!(files.is_empty());
    }

    #[test]
    fn test_scan_files_with_content() {
        let dir = tempdir().unwrap();
        let mods_dir = dir.path().join("mods");
        std::fs::create_dir(&mods_dir).unwrap();
        std::fs::write(mods_dir.join("test.jar"), b"hello world").unwrap();
        let files = scan_files(&mods_dir).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "test.jar");
        assert!(files[0].size_bytes > 0);
        assert!(!files[0].sha1.is_empty());
    }

    #[test]
    fn test_compute_diff_no_difference() {
        let snap = PeerConfigSnapshot {
            minecraft_version: "1.21".into(), loader_type: Some("fabric".into()),
            loader_version: Some("0.16.0".into()),
            mods: vec![FileInfo { filename: "mod.jar".into(), sha1: "abc".into(), size_bytes: 100 }],
            resource_packs: vec![], shaders: vec![], jvm_args: None, memory_mb: None,
        };
        let diff = compute_diff(&snap, &snap.clone());
        assert!(diff.version_match);
        assert!(diff.loader_match);
        assert!(diff.missing_mods.is_empty());
        assert_eq!(diff.total_file_count, 0);
    }

    #[test]
    fn test_compute_diff_detects_missing_mods() {
        let local = PeerConfigSnapshot {
            minecraft_version: "1.21".into(), loader_type: None, loader_version: None,
            mods: vec![], resource_packs: vec![], shaders: vec![], jvm_args: None, memory_mb: None,
        };
        let remote = PeerConfigSnapshot {
            minecraft_version: "1.21".into(), loader_type: None, loader_version: None,
            mods: vec![FileInfo { filename: "sodium.jar".into(), sha1: "def".into(), size_bytes: 500 }],
            resource_packs: vec![], shaders: vec![], jvm_args: None, memory_mb: None,
        };
        let diff = compute_diff(&local, &remote);
        assert_eq!(diff.missing_mods.len(), 1);
        assert_eq!(diff.missing_mods[0].filename, "sodium.jar");
        assert_eq!(diff.total_download_bytes, 500);
    }
}
