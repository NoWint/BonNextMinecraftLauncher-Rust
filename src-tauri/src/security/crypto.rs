use crate::error::LauncherError;
use crate::platform::paths::get_config_dir;
use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::Aes256Gcm;
use aes_gcm::Nonce;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub version: String,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub fn get_salt_path() -> std::path::PathBuf {
    get_config_dir().join(".security_salt")
}

pub fn machine_fingerprint(salt: &[u8]) -> String {
    let hostname = whoami::fallible::hostname().unwrap_or_default();
    let username = whoami::username();
    let os = std::env::consts::OS.to_string();
    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    hasher.update(username.as_bytes());
    hasher.update(os.as_bytes());
    hasher.update(salt);
    let result = hasher.finalize();
    hex::encode(result)
}

pub fn derive_key(salt: &[u8]) -> Result<[u8; 32], LauncherError> {
    let fingerprint = machine_fingerprint(salt);
    let hkdf = Hkdf::<Sha256>::new(Some(salt), fingerprint.as_bytes());
    let mut key = [0u8; 32];
    hkdf.expand(b"bonnext-credential-key", &mut key)
        .map_err(|e| LauncherError::Encryption(format!("HKDF key derivation failed: {}", e)))?;
    Ok(key)
}

fn generate_random_bytes(len: usize) -> Vec<u8> {
    let nonce_size = 12;
    let chunks_needed = (len + nonce_size - 1) / nonce_size;
    let mut buf = Vec::with_capacity(chunks_needed * nonce_size);
    for _ in 0..chunks_needed {
        let nonce = Aes256Gcm::generate_nonce(OsRng);
        buf.extend_from_slice(&nonce);
    }
    buf.truncate(len);
    buf
}

pub fn load_or_create_salt() -> Result<Vec<u8>, LauncherError> {
    let salt_path = get_salt_path();
    if salt_path.exists() {
        let data = std::fs::read(&salt_path)?;
        if data.len() == 32 {
            return Ok(data);
        }
    }
    if let Some(parent) = salt_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let salt = generate_random_bytes(32);
    std::fs::write(&salt_path, &salt)?;
    super::file_permissions::set_secure_permissions(&salt_path)?;
    Ok(salt)
}

pub fn encrypt_data(
    plaintext: &[u8],
    aad: &[u8],
) -> Result<EncryptedData, LauncherError> {
    let salt = load_or_create_salt()?;
    let key = derive_key(&salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| LauncherError::Encryption(format!("Cipher init failed: {}", e)))?;
    let nonce = Aes256Gcm::generate_nonce(OsRng);
    let payload = aes_gcm::aead::Payload {
        msg: plaintext,
        aad,
    };
    let ciphertext = cipher
        .encrypt(&nonce, payload)
        .map_err(|e| LauncherError::Encryption(format!("Encryption failed: {}", e)))?;
    Ok(EncryptedData {
        version: "1".to_string(),
        salt: B64.encode(&salt),
        nonce: B64.encode(&nonce),
        ciphertext: B64.encode(&ciphertext),
    })
}

pub fn decrypt_data(
    data: &EncryptedData,
    aad: &[u8],
) -> Result<Vec<u8>, LauncherError> {
    let salt = B64
        .decode(&data.salt)
        .map_err(|e| LauncherError::Decryption(format!("Salt decode failed: {}", e)))?;
    let nonce_bytes = B64
        .decode(&data.nonce)
        .map_err(|e| LauncherError::Decryption(format!("Nonce decode failed: {}", e)))?;
    let ciphertext = B64
        .decode(&data.ciphertext)
        .map_err(|e| LauncherError::Decryption(format!("Ciphertext decode failed: {}", e)))?;
    let key = derive_key(&salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| LauncherError::Decryption(format!("Cipher init failed: {}", e)))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let payload = aes_gcm::aead::Payload {
        msg: &ciphertext,
        aad,
    };
    cipher
        .decrypt(nonce, payload)
        .map_err(|e| LauncherError::Decryption(format!("Decryption failed: {}", e)))
}

pub fn encrypt_json<T: Serialize>(
    data: &T,
    aad_path: &std::path::Path,
) -> Result<EncryptedData, LauncherError> {
    let json = serde_json::to_vec(data)?;
    let aad_str = aad_path.to_string_lossy().to_string();
    let aad = aad_str.as_bytes();
    encrypt_data(&json, aad)
}

pub fn decrypt_json<T: serde::de::DeserializeOwned>(
    data: &EncryptedData,
    aad_path: &std::path::Path,
) -> Result<T, LauncherError> {
    let aad_str = aad_path.to_string_lossy().to_string();
    let aad = aad_str.as_bytes();
    let plaintext = decrypt_data(data, aad)?;
    serde_json::from_slice(&plaintext)
        .map_err(|e| LauncherError::Decryption(format!("JSON deserialization failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = b"hello bonnext security";
        let aad = b"test-aad";
        let encrypted = encrypt_data(plaintext, aad).unwrap();
        let decrypted = decrypt_data(&encrypted, aad).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_aad_fails() {
        let plaintext = b"hello bonnext security";
        let aad = b"correct-aad";
        let encrypted = encrypt_data(plaintext, aad).unwrap();
        let result = decrypt_data(&encrypted, b"wrong-aad");
        assert!(result.is_err());
    }

    #[test]
    fn encrypt_decrypt_json_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let aad_path = dir.path().join("accounts.json.enc");
        let original = serde_json::json!({
            "accounts": [{"id": "test", "username": "player"}],
            "active_account_id": "test"
        });
        let encrypted = encrypt_json(&original, &aad_path).unwrap();
        let decrypted: serde_json::Value = decrypt_json(&encrypted, &aad_path).unwrap();
        assert_eq!(original, decrypted);
    }
}
