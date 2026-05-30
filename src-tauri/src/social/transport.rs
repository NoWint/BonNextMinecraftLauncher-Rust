use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305,
};
use ed25519_dalek::SigningKey;
use serde::{Serialize, Deserialize};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    pub ephemeral_public_key: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub struct SendSession {
    cipher: ChaCha20Poly1305,
}

pub struct ReceiveSession {
    cipher: ChaCha20Poly1305,
    #[allow(dead_code)]
    peer_identity_key: ed25519_dalek::VerifyingKey,
}

pub fn create_send_session(
    _my_signing_key: &SigningKey,
    _peer_verifying_key: &ed25519_dalek::VerifyingKey,
) -> SendSession {
    let key = ChaCha20Poly1305::generate_key(&mut OsRng);
    SendSession { cipher: ChaCha20Poly1305::new(&key) }
}

pub fn encrypt_message(session: &mut SendSession, plaintext: &[u8]) -> EncryptedMessage {
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = session.cipher.encrypt(&nonce, plaintext)
        .expect("encryption should not fail");
    EncryptedMessage {
        ephemeral_public_key: String::new(),
        nonce: BASE64.encode(nonce.as_slice()),
        ciphertext: BASE64.encode(&ciphertext),
    }
}

pub fn create_receive_session(
    _my_signing_key: &SigningKey,
    peer_verifying_key: ed25519_dalek::VerifyingKey,
) -> ReceiveSession {
    let key = ChaCha20Poly1305::generate_key(&mut OsRng);
    ReceiveSession { cipher: ChaCha20Poly1305::new(&key), peer_identity_key: peer_verifying_key }
}

pub fn decrypt_message(session: &ReceiveSession, msg: &EncryptedMessage) -> Result<Vec<u8>, String> {
    let nonce_bytes = BASE64.decode(&msg.nonce).map_err(|e| format!("Invalid nonce: {}", e))?;
    let ciphertext = BASE64.decode(&msg.ciphertext).map_err(|e| format!("Invalid ciphertext: {}", e))?;
    let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);
    session.cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::social::identity;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let signing = identity::generate_identity();
        let peer = identity::generate_identity();
        let mut send = create_send_session(&signing.signing_key, &peer.verifying_key);
        let recv = create_receive_session(&peer.signing_key, signing.verifying_key);
        let plaintext = b"hello peer!";
        let encrypted = encrypt_message(&mut send, plaintext);
        let decrypted = decrypt_message(&recv, &encrypted).unwrap();
        assert_eq!(plaintext, decrypted.as_slice());
    }
}
