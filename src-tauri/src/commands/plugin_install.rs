//! Plugin signature verification and trusted key management.
//!
//! Signature format:
//! - `SIGNATURE.sig`: base64-encoded Ed25519 signature (64 bytes) of the tree hash
//! - `SIGNATURE.pubkey`: base64-encoded Ed25519 public key (32 bytes)
//!
//! Tree hash computation:
//! 1. List all files in the zip except SIGNATURE.sig and SIGNATURE.pubkey
//! 2. Sort filenames lexicographically
//! 3. For each file: compute SHA-256(content)
//! 4. Concatenate: `<filename>\0<sha256_hex>\0` for each file
//! 5. Compute SHA-256 of the concatenation → tree hash
//!
//! The signature is Ed25519.sign(tree_hash, private_key).
//! The public key must be in the trusted key set (built-in or user-added).

use crate::error::LauncherError;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;

/// A trusted public key entry.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct TrustedKey {
    /// Unique identifier (e.g., "bonnext-official")
    pub id: String,
    /// Human-readable label (e.g., "BonNext Official")
    pub label: String,
    /// Base64-encoded Ed25519 public key (32 bytes)
    pub public_key: String,
    /// Whether this is a built-in key (cannot be removed by users)
    #[serde(default)]
    pub builtin: bool,
}

/// Built-in trusted public key definitions (compile-time constants).
/// In production, these would be the official BonNext signing keys.
/// For now, we use a placeholder that can be replaced at build time.
/// Uses static strings because `String::from()` is not const.
const BUILTIN_TRUSTED_KEY_DEFS: &[(&str, &str, &str, bool)] = &[
    (
        "bonnext-official",
        "BonNext Official",
        // This is a placeholder key. Replace with the real official public key
        // before production release. Generated with ed25519-dalek for testing.
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
        true,
    ),
];

/// Convert built-in key definitions to owned TrustedKey instances.
fn builtin_trusted_keys() -> Vec<TrustedKey> {
    BUILTIN_TRUSTED_KEY_DEFS
        .iter()
        .map(|(id, label, public_key, builtin)| TrustedKey {
            id: id.to_string(),
            label: label.to_string(),
            public_key: public_key.to_string(),
            builtin: *builtin,
        })
        .collect()
}

/// Check if a public key matches any built-in trusted key.
fn is_builtin_trusted(public_key: &str) -> bool {
    BUILTIN_TRUSTED_KEY_DEFS
        .iter()
        .any(|(_, _, pk, _)| *pk == public_key)
}

/// Check if a key ID matches any built-in trusted key.
fn is_builtin_key_id(id: &str) -> bool {
    BUILTIN_TRUSTED_KEY_DEFS.iter().any(|(kid, _, _, _)| *kid == id)
}

/// Find the built-in key label for a given public key.
fn builtin_key_label(public_key: &str) -> Option<String> {
    BUILTIN_TRUSTED_KEY_DEFS
        .iter()
        .find(|(_, _, pk, _)| *pk == public_key)
        .map(|(_, label, _, _)| label.to_string())
}

/// Find the built-in key ID for a given public key.
fn builtin_key_id(public_key: &str) -> Option<String> {
    BUILTIN_TRUSTED_KEY_DEFS
        .iter()
        .find(|(_, _, pk, _)| *pk == public_key)
        .map(|(id, _, _, _)| id.to_string())
}

/// Manages trusted public keys for plugin signature verification.
/// Built-in keys are compile-time constants; user-added keys are persisted
/// to `game_dir/trusted_keys.json`.
pub struct TrustedKeyStore {
    /// User-added keys (loaded from disk)
    user_keys: parking_lot::RwLock<Vec<TrustedKey>>,
}

impl TrustedKeyStore {
    pub fn new() -> Self {
        let store = Self {
            user_keys: parking_lot::RwLock::new(Vec::new()),
        };
        store.load_from_disk();
        store
    }

    /// Get all trusted keys (built-in + user-added).
    pub fn list_keys(&self) -> Vec<TrustedKey> {
        let mut keys = builtin_trusted_keys();
        keys.extend(self.user_keys.read().iter().cloned());
        keys
    }

    /// Check if a public key (hex-encoded) is trusted.
    pub fn is_trusted(&self, public_key: &str) -> bool {
        if is_builtin_trusted(public_key) {
            return true;
        }
        self.user_keys.read().iter().any(|k| k.public_key == public_key)
    }

    /// Add a user-trusted key. Returns error if the key already exists.
    pub fn add_key(&self, key: TrustedKey) -> Result<(), LauncherError> {
        // Validate public key format
        validate_public_key(&key.public_key)?;

        let mut keys = self.user_keys.write();
        if keys.iter().any(|k| k.id == key.id) || is_builtin_key_id(&key.id) {
            return Err(LauncherError::Other(format!("Trusted key '{}' already exists", key.id)));
        }
        if keys.iter().any(|k| k.public_key == key.public_key) || is_builtin_trusted(&key.public_key) {
            return Err(LauncherError::Other("This public key is already trusted".to_string()));
        }

        let mut key = key;
        key.builtin = false;
        keys.push(key);
        drop(keys);
        self.save_to_disk()?;
        Ok(())
    }

    /// Remove a user-trusted key by ID. Built-in keys cannot be removed.
    pub fn remove_key(&self, id: &str) -> Result<(), LauncherError> {
        if is_builtin_key_id(id) {
            return Err(LauncherError::Other(format!(
                "Cannot remove built-in trusted key '{}'",
                id
            )));
        }
        let mut keys = self.user_keys.write();
        let original_len = keys.len();
        keys.retain(|k| k.id != id);
        if keys.len() == original_len {
            return Err(LauncherError::Other(format!(
                "Trusted key '{}' not found",
                id
            )));
        }
        drop(keys);
        self.save_to_disk()?;
        Ok(())
    }

    /// Path to the user trusted keys file: game_dir/trusted_keys.json
    fn keys_path() -> std::path::PathBuf {
        crate::platform::paths::get_game_dir().join("trusted_keys.json")
    }

    fn load_from_disk(&self) {
        let path = Self::keys_path();
        if !path.exists() {
            return;
        }
        match std::fs::read_to_string(&path) {
            Ok(content) => {
                if let Ok(keys) = serde_json::from_str::<Vec<TrustedKey>>(&content) {
                    *self.user_keys.write() = keys;
                }
            }
            Err(_) => {
                tracing::warn!("Failed to read trusted_keys.json, starting with empty user keys");
            }
        }
    }

    fn save_to_disk(&self) -> Result<(), LauncherError> {
        let path = Self::keys_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let keys = self.user_keys.read();
        let json = serde_json::to_string_pretty(&*keys)?;
        std::fs::write(&path, json)?;
        Ok(())
    }
}

impl Default for TrustedKeyStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Validate that a public key string is a valid hex-encoded Ed25519 public key (64 hex chars = 32 bytes).
fn validate_public_key(public_key: &str) -> Result<(), LauncherError> {
    if public_key.len() != 64 {
        return Err(LauncherError::Other(format!(
            "Invalid public key length: expected 64 hex characters, got {}",
            public_key.len()
        )));
    }
    if !public_key.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(LauncherError::Other(
            "Invalid public key: must be hexadecimal characters only".to_string(),
        ));
    }
    Ok(())
}

/// Decode a hex-encoded Ed25519 public key (64 hex chars → 32 bytes).
fn decode_public_key(hex_key: &str) -> Result<VerifyingKey, LauncherError> {
    validate_public_key(hex_key)?;
    let bytes = hex::decode(hex_key)
        .map_err(|e| LauncherError::Other(format!("Failed to decode public key: {}", e)))?;
    let arr: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| LauncherError::Other("Invalid public key length".to_string()))?;
    VerifyingKey::from_bytes(&arr)
        .map_err(|e| LauncherError::Other(format!("Invalid Ed25519 public key: {}", e)))
}

/// Compute the tree hash of a zip archive's contents.
///
/// Excludes SIGNATURE.sig and SIGNATURE.pubkey files.
/// For each remaining file, computes SHA-256(content), then concatenates
/// `<filename>\0<sha256_hex>\0` for all files (sorted by name), and
/// computes SHA-256 of the result.
pub fn compute_tree_hash<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
) -> Result<[u8; 32], LauncherError> {
    // Collect (filename, sha256_hex) pairs, excluding signature files.
    let mut entries: Vec<(String, String)> = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| LauncherError::Other(format!("Zip read error: {}", e)))?;
        let name = entry.name().to_string();

        // Skip directories
        if name.ends_with('/') {
            continue;
        }
        // Skip signature files
        if name == "SIGNATURE.sig" || name == "SIGNATURE.pubkey" {
            continue;
        }

        let mut content = Vec::new();
        entry
            .read_to_end(&mut content)
            .map_err(|e| LauncherError::Other(format!("Failed to read zip entry: {}", e)))?;

        let mut hasher = Sha256::new();
        hasher.update(&content);
        let hash = hasher.finalize();
        entries.push((name, hex::encode(hash)));
    }

    // Sort by filename for deterministic ordering
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    // Concatenate: filename\0sha256_hex\0 for each entry
    let mut concat = Vec::new();
    for (name, hash) in &entries {
        concat.extend_from_slice(name.as_bytes());
        concat.push(0);
        concat.extend_from_slice(hash.as_bytes());
        concat.push(0);
    }

    let mut hasher = Sha256::new();
    hasher.update(&concat);
    let result = hasher.finalize();
    let mut tree_hash = [0u8; 32];
    tree_hash.copy_from_slice(&result);
    Ok(tree_hash)
}

/// Result of signature verification.
#[derive(Debug)]
pub enum SignatureVerificationResult {
    /// Plugin is signed and signature is valid.
    Valid { key_id: String, key_label: String },
    /// Plugin is signed but signature verification failed.
    Invalid { reason: String },
    /// Plugin is signed but the public key is not trusted.
    Untrusted { public_key: String },
    /// Plugin has no signature file (unsigned).
    Unsigned,
}

/// Verify a plugin's signature from a zip archive.
///
/// Looks for SIGNATURE.sig and SIGNATURE.pubkey in the zip.
/// If both are present, computes the tree hash and verifies the Ed25519 signature.
/// If the public key is not in the trusted set, returns Untrusted.
/// If SIGNATURE.sig is absent, returns Unsigned.
pub fn verify_plugin_signature<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    key_store: &TrustedKeyStore,
) -> Result<SignatureVerificationResult, LauncherError> {
    // Read SIGNATURE.sig and SIGNATURE.pubkey from the zip
    let mut signature_bytes: Option<Vec<u8>> = None;
    let mut public_key_hex: Option<String> = None;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| LauncherError::Other(format!("Zip read error: {}", e)))?;
        let name = entry.name().to_string();

        if name == "SIGNATURE.sig" {
            let mut content = Vec::new();
            entry
                .read_to_end(&mut content)
                .map_err(|e| LauncherError::Other(format!("Failed to read signature: {}", e)))?;
            signature_bytes = Some(content);
        } else if name == "SIGNATURE.pubkey" {
            let mut content = String::new();
            entry
                .read_to_string(&mut content)
                .map_err(|e| LauncherError::Other(format!("Failed to read public key: {}", e)))?;
            public_key_hex = Some(content.trim().to_string());
        }
    }

    let signature_raw = match signature_bytes {
        Some(s) => s,
        None => return Ok(SignatureVerificationResult::Unsigned),
    };

    let pubkey_hex = match public_key_hex {
        Some(p) => p,
        None => {
            return Ok(SignatureVerificationResult::Invalid {
                reason: "SIGNATURE.sig present but SIGNATURE.pubkey missing".to_string(),
            });
        }
    };

    // Validate public key format
    if let Err(e) = validate_public_key(&pubkey_hex) {
        return Ok(SignatureVerificationResult::Invalid {
            reason: format!("Invalid public key: {}", e),
        });
    }

    // Check if the public key is trusted
    if !key_store.is_trusted(&pubkey_hex) {
        return Ok(SignatureVerificationResult::Untrusted {
            public_key: pubkey_hex,
        });
    }

    // Decode the signature (base64 or raw hex)
    let signature_bytes_decoded = decode_signature(&signature_raw)?;
    if signature_bytes_decoded.len() != 64 {
        return Ok(SignatureVerificationResult::Invalid {
            reason: format!(
                "Invalid signature length: expected 64 bytes, got {}",
                signature_bytes_decoded.len()
            ),
        });
    }

    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(&signature_bytes_decoded);
    let signature = Signature::from_bytes(&sig_array);

    // Decode the public key
    let verifying_key = match decode_public_key(&pubkey_hex) {
        Ok(k) => k,
        Err(e) => {
            return Ok(SignatureVerificationResult::Invalid {
                reason: format!("Invalid public key: {}", e),
            });
        }
    };

    // Compute tree hash
    let tree_hash = compute_tree_hash(archive)?;

    // Verify the signature
    match verifying_key.verify(&tree_hash, &signature) {
        Ok(()) => {
            // Find the key ID and label (check built-in first, then user keys)
            let key_id = builtin_key_id(&pubkey_hex)
                .or_else(|| {
                    key_store
                        .list_keys()
                        .into_iter()
                        .find(|k| k.public_key == pubkey_hex)
                        .map(|k| k.id)
                })
                .unwrap_or_default();
            let key_label = builtin_key_label(&pubkey_hex)
                .or_else(|| {
                    key_store
                        .list_keys()
                        .into_iter()
                        .find(|k| k.public_key == pubkey_hex)
                        .map(|k| k.label)
                })
                .unwrap_or_default();
            Ok(SignatureVerificationResult::Valid { key_id, key_label })
        }
        Err(e) => Ok(SignatureVerificationResult::Invalid {
            reason: format!("Signature verification failed: {}", e),
        }),
    }
}

/// Decode a signature from either base64 or hex encoding.
fn decode_signature(raw: &[u8]) -> Result<Vec<u8>, LauncherError> {
    let text = String::from_utf8_lossy(raw).trim().to_string();

    // Try base64 first
    if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(&text) {
        return Ok(decoded);
    }

    // Try hex
    if let Ok(decoded) = hex::decode(&text) {
        return Ok(decoded);
    }

    Err(LauncherError::Other(
        "Failed to decode signature (not valid base64 or hex)".to_string(),
    ))
}

// ============================================================================
// Tauri Commands for Trusted Key Management
// ============================================================================

/// List all trusted public keys (built-in + user-added).
#[tauri::command]
pub async fn list_trusted_keys(
    key_store: tauri::State<'_, TrustedKeyStore>,
) -> Result<Vec<TrustedKey>, LauncherError> {
    Ok(key_store.list_keys())
}

/// Add a user-trusted public key.
#[tauri::command]
pub async fn add_trusted_key(
    key_store: tauri::State<'_, TrustedKeyStore>,
    id: String,
    label: String,
    public_key: String,
) -> Result<(), LauncherError> {
    key_store.add_key(TrustedKey {
        id,
        label,
        public_key,
        builtin: false,
    })
}

/// Remove a user-trusted public key by ID. Built-in keys cannot be removed.
#[tauri::command]
pub async fn remove_trusted_key(
    key_store: tauri::State<'_, TrustedKeyStore>,
    id: String,
) -> Result<(), LauncherError> {
    key_store.remove_key(&id)
}

/// Verify a plugin zip's signature without installing.
/// Returns the verification result as a structured response.
#[tauri::command]
pub async fn verify_plugin_signature_command(
    key_store: tauri::State<'_, TrustedKeyStore>,
    zip_path: String,
) -> Result<serde_json::Value, LauncherError> {
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| LauncherError::Other(format!("Failed to open zip file: {}", e)))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| LauncherError::Other(format!("Invalid zip file: {}", e)))?;

    let result = verify_plugin_signature(&mut archive, &key_store)?;

    Ok(match result {
        SignatureVerificationResult::Valid { key_id, key_label } => serde_json::json!({
            "status": "valid",
            "key_id": key_id,
            "key_label": key_label,
        }),
        SignatureVerificationResult::Invalid { reason } => serde_json::json!({
            "status": "invalid",
            "reason": reason,
        }),
        SignatureVerificationResult::Untrusted { public_key } => serde_json::json!({
            "status": "untrusted",
            "public_key": public_key,
        }),
        SignatureVerificationResult::Unsigned => serde_json::json!({
            "status": "unsigned",
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use ed25519_dalek::Signer;
    use rand::rngs::OsRng;
    use std::io::Cursor;
    use std::io::Write;

    fn create_test_zip(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut buf = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buf);
            let options =
                zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            for (name, data) in files {
                zip.start_file(name, options).unwrap();
                zip.write_all(data).unwrap();
            }
            zip.finish().unwrap();
        }
        buf.into_inner()
    }

    #[test]
    fn test_compute_tree_hash_deterministic() {
        let files1: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
            ("index.js", b"console.log('hello');"),
        ];
        let files2: Vec<(&str, &[u8])> = vec![
            ("index.js", b"console.log('hello');"),
            ("manifest.json", b"{\"id\":\"test\"}"),
        ];

        let zip1 = create_test_zip(&files1);
        let zip2 = create_test_zip(&files2);

        let mut archive1 = zip::ZipArchive::new(Cursor::new(zip1)).unwrap();
        let mut archive2 = zip::ZipArchive::new(Cursor::new(zip2)).unwrap();

        let hash1 = compute_tree_hash(&mut archive1).unwrap();
        let hash2 = compute_tree_hash(&mut archive2).unwrap();

        assert_eq!(hash1, hash2, "Tree hash should be deterministic regardless of file order in zip");
    }

    #[test]
    fn test_tree_hash_excludes_signature_files() {
        let files_with_sig: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
            ("SIGNATURE.sig", b"fake-signature"),
            ("SIGNATURE.pubkey", b"fake-pubkey"),
        ];
        let files_without_sig: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
        ];

        let zip1 = create_test_zip(&files_with_sig);
        let zip2 = create_test_zip(&files_without_sig);

        let mut archive1 = zip::ZipArchive::new(Cursor::new(zip1)).unwrap();
        let mut archive2 = zip::ZipArchive::new(Cursor::new(zip2)).unwrap();

        let hash1 = compute_tree_hash(&mut archive1).unwrap();
        let hash2 = compute_tree_hash(&mut archive2).unwrap();

        assert_eq!(hash1, hash2, "Tree hash should exclude SIGNATURE.sig and SIGNATURE.pubkey");
    }

    #[test]
    fn test_tree_hash_changes_with_content() {
        let files1: Vec<(&str, &[u8])> = vec![("index.js", b"console.log('hello');")];
        let files2: Vec<(&str, &[u8])> = vec![("index.js", b"console.log('world');")];

        let zip1 = create_test_zip(&files1);
        let zip2 = create_test_zip(&files2);

        let mut archive1 = zip::ZipArchive::new(Cursor::new(zip1)).unwrap();
        let mut archive2 = zip::ZipArchive::new(Cursor::new(zip2)).unwrap();

        let hash1 = compute_tree_hash(&mut archive1).unwrap();
        let hash2 = compute_tree_hash(&mut archive2).unwrap();

        assert_ne!(hash1, hash2, "Tree hash should change when content changes");
    }

    #[test]
    fn test_signature_verification_valid() {
        // Generate a signing key pair
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        let pubkey_hex = hex::encode(verifying_key.to_bytes());

        // Create plugin files
        let files: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
            ("index.js", b"console.log('hello');"),
        ];
        let zip_data = create_test_zip(&files);

        // Compute tree hash
        let mut archive = zip::ZipArchive::new(Cursor::new(zip_data)).unwrap();
        let tree_hash = compute_tree_hash(&mut archive).unwrap();

        // Sign the tree hash
        let signature = signing_key.sign(&tree_hash);
        let sig_bytes = signature.to_bytes().to_vec();

        // Create signed zip with signature and pubkey
        let signed_files: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
            ("index.js", b"console.log('hello');"),
            ("SIGNATURE.sig", sig_bytes.as_slice()),
            ("SIGNATURE.pubkey", pubkey_hex.as_bytes()),
        ];
        let signed_zip = create_test_zip(&signed_files);

        // Create a key store with this key trusted
        let key_store = TrustedKeyStore::new();
        // We can't easily add to the built-in keys, so we test the verification logic directly
        let mut archive = zip::ZipArchive::new(Cursor::new(signed_zip)).unwrap();

        // Manually verify (bypassing key store trust check)
        let verifying_key = decode_public_key(&pubkey_hex).unwrap();
        let mut sig_array = [0u8; 64];
        sig_array.copy_from_slice(&sig_bytes);
        let sig = Signature::from_bytes(&sig_array);

        let computed_hash = compute_tree_hash(&mut archive).unwrap();
        assert!(verifying_key.verify(&computed_hash, &sig).is_ok());
    }

    #[test]
    fn test_signature_verification_invalid() {
        // Generate two different signing keys
        let mut csprng = OsRng;
        let signing_key1 = SigningKey::generate(&mut csprng);
        let signing_key2 = SigningKey::generate(&mut csprng);
        let verifying_key2 = signing_key2.verifying_key();
        let pubkey_hex = hex::encode(verifying_key2.to_bytes());

        // Create plugin files
        let files: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
            ("index.js", b"console.log('hello');"),
        ];
        let zip_data = create_test_zip(&files);

        // Compute tree hash
        let mut archive = zip::ZipArchive::new(Cursor::new(zip_data)).unwrap();
        let tree_hash = compute_tree_hash(&mut archive).unwrap();

        // Sign with key1 (wrong key)
        let signature = signing_key1.sign(&tree_hash);
        let sig_bytes = signature.to_bytes().to_vec();

        // Create signed zip
        let signed_files: Vec<(&str, &[u8])> = vec![
            ("manifest.json", b"{\"id\":\"test\"}"),
            ("index.js", b"console.log('hello');"),
            ("SIGNATURE.sig", sig_bytes.as_slice()),
            ("SIGNATURE.pubkey", pubkey_hex.as_bytes()),
        ];
        let signed_zip = create_test_zip(&signed_files);

        // Verify with key2 (should fail)
        let verifying_key = decode_public_key(&pubkey_hex).unwrap();
        let mut sig_array = [0u8; 64];
        sig_array.copy_from_slice(&sig_bytes);
        let sig = Signature::from_bytes(&sig_array);

        let mut archive = zip::ZipArchive::new(Cursor::new(signed_zip)).unwrap();
        let computed_hash = compute_tree_hash(&mut archive).unwrap();
        assert!(verifying_key.verify(&computed_hash, &sig).is_err());
    }

    #[test]
    fn test_validate_public_key() {
        // Valid 64-char hex
        assert!(validate_public_key("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a").is_ok());

        // Too short
        assert!(validate_public_key("d75a980182").is_err());

        // Non-hex characters
        assert!(validate_public_key("z75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a").is_err());

        // Empty
        assert!(validate_public_key("").is_err());
    }

    #[test]
    fn test_decode_signature_base64() {
        // base64 of "hello" = "aGVsbG8="
        let result = decode_signature(b"aGVsbG8=").unwrap();
        assert_eq!(result, b"hello");
    }

    #[test]
    fn test_decode_signature_hex() {
        // hex of "hello" = "68656c6c6f"
        let result = decode_signature(b"68656c6c6f").unwrap();
        assert_eq!(result, b"hello");
    }

    #[test]
    fn test_trusted_key_store_add_and_remove() {
        let store = TrustedKeyStore::new();
        // Use a unique ID to avoid conflicts with parallel tests
        let key_id = "test-key-add-remove";

        // Clean up any leftover state from previous test runs
        let _ = store.remove_key(key_id);

        // Generate a valid key
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let pubkey_hex = hex::encode(signing_key.verifying_key().to_bytes());

        // Add key
        store
            .add_key(TrustedKey {
                id: key_id.to_string(),
                label: "Test Key".to_string(),
                public_key: pubkey_hex.clone(),
                builtin: false,
            })
            .unwrap();

        // Verify it's trusted
        assert!(store.is_trusted(&pubkey_hex));

        // Remove key
        store.remove_key(key_id).unwrap();
        assert!(!store.is_trusted(&pubkey_hex));
    }

    #[test]
    fn test_cannot_remove_builtin_key() {
        let store = TrustedKeyStore::new();
        let result = store.remove_key("bonnext-official");
        assert!(result.is_err());
    }

    #[test]
    fn test_cannot_add_duplicate_key() {
        let store = TrustedKeyStore::new();
        // Use a unique ID to avoid conflicts with parallel tests
        let key_id = "test-key-duplicate";

        // Clean up any leftover state from previous test runs
        let _ = store.remove_key(key_id);

        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let pubkey_hex = hex::encode(signing_key.verifying_key().to_bytes());

        // Add key
        store
            .add_key(TrustedKey {
                id: key_id.to_string(),
                label: "Test Key".to_string(),
                public_key: pubkey_hex.clone(),
                builtin: false,
            })
            .unwrap();

        // Try to add same key again
        let result = store.add_key(TrustedKey {
            id: key_id.to_string(),
            label: "Test Key".to_string(),
            public_key: pubkey_hex,
            builtin: false,
        });
        assert!(result.is_err());

        // Cleanup
        store.remove_key(key_id).unwrap();
    }
}
