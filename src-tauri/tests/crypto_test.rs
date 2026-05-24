use bonnext_lib::*;

#[test]
fn encrypt_decrypt_roundtrip() {
    let plaintext = b"hello bonnext integration test";
    let aad = b"test-aad";
    let encrypted = encrypt_data(plaintext, aad).unwrap();
    let decrypted = decrypt_data(&encrypted, aad).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn wrong_aad_fails_decryption() {
    let plaintext = b"secret data";
    let aad = b"correct-aad";
    let encrypted = encrypt_data(plaintext, aad).unwrap();
    let result = decrypt_data(&encrypted, b"wrong-aad");
    assert!(result.is_err());
}

#[test]
fn encrypted_data_structure() {
    let plaintext = b"test payload";
    let aad = b"aad";
    let encrypted = encrypt_data(plaintext, aad).unwrap();
    assert_eq!(encrypted.version, "1");
    assert!(!encrypted.salt.is_empty());
    assert!(!encrypted.nonce.is_empty());
    assert!(!encrypted.ciphertext.is_empty());
}

#[test]
fn encrypt_decrypt_empty_payload() {
    let plaintext = b"";
    let aad = b"empty-test";
    let encrypted = encrypt_data(plaintext, aad).unwrap();
    let decrypted = decrypt_data(&encrypted, aad).unwrap();
    assert_eq!(decrypted, plaintext);
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

#[test]
fn encrypt_decrypt_large_payload() {
    let plaintext = vec![0xAB_u8; 1024 * 64];
    let aad = b"large-payload-test";
    let encrypted = encrypt_data(&plaintext, aad).unwrap();
    let decrypted = decrypt_data(&encrypted, aad).unwrap();
    assert_eq!(decrypted, plaintext);
}
