use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305,
};
use ed25519_dalek::SigningKey;
use serde::{Serialize, Deserialize};
use sha2::{Sha256, Sha512, Digest};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub ephemeral_public_key: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub struct SendSession {
    cipher: ChaCha20Poly1305,
    ephemeral_public: x25519_dalek::PublicKey,
}

pub struct ReceiveSession {
    my_signing_key_bytes: [u8; 32],
}

fn ed25519_to_x25519_secret(signing_key: &SigningKey) -> x25519_dalek::StaticSecret {
    let seed = signing_key.to_bytes();
    let mut hasher = Sha512::new();
    hasher.update(&seed);
    let hash = hasher.finalize();
    let mut key_bytes: [u8; 32] = [0; 32];
    key_bytes.copy_from_slice(&hash[..32]);
    key_bytes[0] &= 248;
    key_bytes[31] &= 127;
    key_bytes[31] |= 64;
    x25519_dalek::StaticSecret::from(key_bytes)
}

fn ed25519_verifying_to_x25519_public(verifying_key: &ed25519_dalek::VerifyingKey) -> x25519_dalek::PublicKey {
    let montgomery = verifying_key.to_montgomery();
    x25519_dalek::PublicKey::from(*montgomery.as_bytes())
}

fn derive_key(shared_secret: &x25519_dalek::SharedSecret) -> chacha20poly1305::Key {
    let mut hasher = Sha256::new();
    hasher.update(shared_secret.as_bytes());
    let hash = hasher.finalize();
    *chacha20poly1305::Key::from_slice(&hash)
}

pub fn create_send_session(
    _my_signing_key: &SigningKey,
    peer_verifying_key: &ed25519_dalek::VerifyingKey,
) -> SendSession {
    let peer_x25519_public = ed25519_verifying_to_x25519_public(peer_verifying_key);
    // Generate ephemeral X25519 key for forward secrecy
    let ephemeral_secret = x25519_dalek::EphemeralSecret::random_from_rng(OsRng);
    let ephemeral_public = x25519_dalek::PublicKey::from(&ephemeral_secret);
    let shared_secret = ephemeral_secret.diffie_hellman(&peer_x25519_public);
    let key = derive_key(&shared_secret);
    SendSession {
        cipher: ChaCha20Poly1305::new(&key),
        ephemeral_public,
    }
}

pub fn encrypt_message(session: &SendSession, plaintext: &[u8]) -> EncryptedMessage {
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = session.cipher.encrypt(&nonce, plaintext)
        .expect("encryption should not fail");
    EncryptedMessage {
        ephemeral_public_key: BASE64.encode(session.ephemeral_public.as_bytes()),
        nonce: BASE64.encode(nonce.as_slice()),
        ciphertext: BASE64.encode(&ciphertext),
    }
}

pub fn create_receive_session(
    my_signing_key: &SigningKey,
) -> ReceiveSession {
    ReceiveSession {
        my_signing_key_bytes: my_signing_key.to_bytes(),
    }
}

pub fn decrypt_message(session: &ReceiveSession, msg: &EncryptedMessage) -> Result<Vec<u8>, String> {
    let ephemeral_public_bytes: [u8; 32] = BASE64.decode(&msg.ephemeral_public_key)
        .map_err(|e| format!("Invalid ephemeral public key: {}", e))?
        .try_into()
        .map_err(|_| "Invalid ephemeral public key length".to_string())?;
    let ephemeral_public = x25519_dalek::PublicKey::from(ephemeral_public_bytes);

    // Re-derive X25519 secret from Ed25519 signing key
    let mut hasher = Sha512::new();
    hasher.update(&session.my_signing_key_bytes);
    let hash = hasher.finalize();
    let mut secret_bytes: [u8; 32] = [0; 32];
    secret_bytes.copy_from_slice(&hash[..32]);
    secret_bytes[0] &= 248;
    secret_bytes[31] &= 127;
    secret_bytes[31] |= 64;
    let my_secret = x25519_dalek::StaticSecret::from(secret_bytes);

    let shared_secret = my_secret.diffie_hellman(&ephemeral_public);
    let key = derive_key(&shared_secret);
    let cipher = ChaCha20Poly1305::new(&key);

    let nonce_bytes = BASE64.decode(&msg.nonce).map_err(|e| format!("Invalid nonce: {}", e))?;
    let ciphertext = BASE64.decode(&msg.ciphertext).map_err(|e| format!("Invalid ciphertext: {}", e))?;
    let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);
    cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::social::identity;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let alice = identity::generate_identity();
        let bob = identity::generate_identity();

        let mut send = create_send_session(&alice.signing_key, &bob.verifying_key);
        let recv = create_receive_session(&bob.signing_key);

        let plaintext = b"hello peer!";
        let encrypted = encrypt_message(&mut send, plaintext);
        let decrypted = decrypt_message(&recv, &encrypted).unwrap();
        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_different_messages_different_ciphertexts() {
        let alice = identity::generate_identity();
        let bob = identity::generate_identity();
        let recv = create_receive_session(&bob.signing_key);

        let mut send1 = create_send_session(&alice.signing_key, &bob.verifying_key);
        let enc1 = encrypt_message(&mut send1, b"msg1");
        let mut send2 = create_send_session(&alice.signing_key, &bob.verifying_key);
        let enc2 = encrypt_message(&mut send2, b"msg2");

        assert_ne!(enc1.ciphertext, enc2.ciphertext);
        assert_ne!(enc1.ephemeral_public_key, enc2.ephemeral_public_key);
        assert_eq!(decrypt_message(&recv, &enc1).unwrap(), b"msg1");
        assert_eq!(decrypt_message(&recv, &enc2).unwrap(), b"msg2");
    }

    #[test]
    fn test_wrong_recipient_cannot_decrypt() {
        let alice = identity::generate_identity();
        let bob = identity::generate_identity();
        let eve = identity::generate_identity();

        let mut send = create_send_session(&alice.signing_key, &bob.verifying_key);
        let encrypted = encrypt_message(&mut send, b"secret");
        let eve_recv = create_receive_session(&eve.signing_key);

        assert!(decrypt_message(&eve_recv, &encrypted).is_err());
    }
}
