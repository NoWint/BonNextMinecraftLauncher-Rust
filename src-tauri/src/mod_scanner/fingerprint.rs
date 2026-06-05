use std::path::Path;
use crate::error::LauncherError;

const M: u32 = 1540483477;
const SEED: u32 = 1;

fn strip_whitespace(data: &[u8]) -> Vec<u8> {
    data.iter().copied().filter(|&b| b != 0x09 && b != 0x0A && b != 0x0D && b != 0x20).collect()
}

pub fn curseforge_fingerprint(data: &[u8]) -> u32 {
    let normalized = strip_whitespace(data);
    let len = normalized.len() as u32;
    if len == 0 { return 0; }
    let mut h: u32 = SEED ^ len;
    let mut i = 0;
    while i + 4 <= normalized.len() {
        let k = u32::from_le_bytes([normalized[i], normalized[i+1], normalized[i+2], normalized[i+3]]);
        h = h.wrapping_add(k);
        h = h.wrapping_mul(M);
        h ^= h >> 16;
        i += 4;
    }
    let remainder = normalized.len() - i;
    if remainder > 0 {
        let mut k: u32 = 0;
        for j in 0..remainder { k |= (normalized[i+j] as u32) << (j * 8); }
        h = h.wrapping_add(k);
        h = h.wrapping_mul(M);
        h ^= h >> 16;
    }
    h = h.wrapping_mul(M);
    h ^= h >> 13;
    h = h.wrapping_mul(M);
    h ^= h >> 15;
    h
}

pub fn curseforge_fingerprint_file(path: &Path) -> Result<u32, LauncherError> {
    let data = std::fs::read(path)
        .map_err(|e| LauncherError::FingerprintCalculation(format!("Failed to read file {:?}: {}", path, e)))?;
    Ok(curseforge_fingerprint(&data))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_fingerprint_empty() { assert_eq!(curseforge_fingerprint(&[]), 0); }
    #[test]
    fn test_fingerprint_whitespace_only() { assert_eq!(curseforge_fingerprint(b"  \t\n\r  "), 0); }
    #[test]
    fn test_fingerprint_deterministic() {
        let fp1 = curseforge_fingerprint(b"Hello, World!");
        let fp2 = curseforge_fingerprint(b"Hello, World!");
        assert_eq!(fp1, fp2);
        assert_ne!(fp1, 0);
    }
    #[test]
    fn test_fingerprint_ignores_whitespace() {
        let fp1 = curseforge_fingerprint(b"HelloWorld");
        let fp2 = curseforge_fingerprint(b"Hello World");
        let fp3 = curseforge_fingerprint(b"Hello\tWorld\n");
        assert_eq!(fp1, fp2);
        assert_eq!(fp2, fp3);
    }
    #[test]
    fn test_fingerprint_different_data() {
        let fp1 = curseforge_fingerprint(b"mod-alpha-1.0.jar");
        let fp2 = curseforge_fingerprint(b"mod-beta-2.0.jar");
        assert_ne!(fp1, fp2);
    }
}
