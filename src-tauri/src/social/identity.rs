use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

pub struct Identity {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
}

pub fn public_key_to_id(verifying_key: &VerifyingKey) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifying_key.as_bytes());
    let hash = hasher.finalize();
    format!("bon-{}", bs58::encode(&hash[..8]).into_string())
}

pub fn generate_identity() -> Identity {
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();
    Identity { signing_key, verifying_key }
}

pub fn export_identity(identity: &Identity) -> String {
    BASE64.encode(identity.signing_key.to_bytes())
}

pub fn import_identity(encoded: &str) -> Result<Identity, String> {
    let bytes = BASE64.decode(encoded).map_err(|e| format!("Invalid base64: {}", e))?;
    let bytes: [u8; 32] = bytes.try_into().map_err(|_| "Invalid key length".to_string())?;
    let signing_key = SigningKey::from_bytes(&bytes);
    let verifying_key = signing_key.verifying_key();
    Ok(Identity { signing_key, verifying_key })
}

pub fn get_or_create_identity() -> Identity {
    let key_path = crate::platform::paths::get_game_dir().join("identity.key");
    if key_path.exists() {
        match std::fs::read_to_string(&key_path) {
            Ok(encoded) => {
                if let Ok(id) = import_identity(encoded.trim()) {
                    return id;
                }
            }
            Err(_) => {}
        }
    }
    let identity = generate_identity();
    let exported = export_identity(&identity);
    if let Err(e) = std::fs::write(&key_path, &exported) {
        tracing::warn!("Failed to save identity key: {}", e);
    }
    identity
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_identity_produces_valid_keypair() {
        let id = generate_identity();
        let message = b"hello world";
        let sig = id.signing_key.sign(message);
        id.verifying_key.verify(message, &sig).unwrap();
    }

    #[test]
    fn test_public_key_to_id_is_stable() {
        let id = generate_identity();
        let id1 = public_key_to_id(&id.verifying_key);
        let id2 = public_key_to_id(&id.verifying_key);
        assert_eq!(id1, id2);
    }

    #[test]
    fn test_public_key_to_id_has_correct_prefix() {
        let id = generate_identity();
        let user_id = public_key_to_id(&id.verifying_key);
        assert!(user_id.starts_with("bon-"));
        assert!(user_id.len() >= 8);
    }

    #[test]
    fn test_export_import_roundtrip() {
        let id = generate_identity();
        let original_id = public_key_to_id(&id.verifying_key);
        let exported = export_identity(&id);
        let imported = import_identity(&exported).unwrap();
        let imported_id = public_key_to_id(&imported.verifying_key);
        assert_eq!(original_id, imported_id);
    }

    #[test]
    fn test_import_invalid_key_returns_err() {
        assert!(import_identity("not-valid-base64!!!").is_err());
        assert!(import_identity("").is_err());
    }

    #[test]
    fn test_different_keys_produce_different_ids() {
        let id1 = generate_identity();
        let id2 = generate_identity();
        assert_ne!(public_key_to_id(&id1.verifying_key), public_key_to_id(&id2.verifying_key));
    }
}
