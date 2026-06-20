use bonnext_lib::security::sanitizer::{
    sanitize_path, sanitize_id, sanitize_url, sanitize_general_string, sanitize_filename,
    validate_zip_entry_size,
};
use bonnext_lib::security::jvm_whitelist::{validate_jvm_args, validate_jvm_args_custom};
use bonnext_lib::security::crypto;

#[test]
fn full_sanitization_pipeline() {
    let path = sanitize_path("game/versions/1.20.4").unwrap();
    let id = sanitize_id("my-instance-1").unwrap();
    let url = sanitize_url("https://api.modrinth.com/v2").unwrap();
    let filename = sanitize_filename("mod.jar").unwrap();
    assert_eq!(path, "game/versions/1.20.4");
    assert_eq!(id, "my-instance-1");
    assert!(url.contains("modrinth"));
    assert_eq!(filename, "mod.jar");
}

#[test]
fn sanitization_rejects_malicious_inputs() {
    assert!(sanitize_path("../../../etc/passwd").is_err());
    assert!(sanitize_id("id with spaces").is_err());
    assert!(sanitize_url("ftp://evil.com").is_err());
    assert!(sanitize_filename("../../../etc/passwd").is_err());
    assert!(validate_zip_entry_size(10_000_000_000, 500_000_000).is_err());
}

#[test]
fn sanitize_path_rejects_traversal() {
    assert!(sanitize_path("../secret").is_err());
    assert!(sanitize_path("foo/../bar").is_err());
    assert!(sanitize_path("foo\0bar").is_err());
}

#[test]
fn sanitize_path_accepts_valid() {
    assert!(sanitize_path("versions/1.20.4").is_ok());
    assert!(sanitize_path("libraries/com/google/guava.jar").is_ok());
}

#[test]
fn sanitize_id_rejects_invalid_chars() {
    assert!(sanitize_id("").is_err());
    assert!(sanitize_id("has space").is_err());
    assert!(sanitize_id("has.dot").is_err());
    assert!(sanitize_id("has/slash").is_err());
}

#[test]
fn sanitize_id_accepts_valid() {
    assert!(sanitize_id("my-instance").is_ok());
    assert!(sanitize_id("instance_123").is_ok());
    assert!(sanitize_id("ABC123").is_ok());
}

#[test]
fn sanitize_url_rejects_non_http() {
    assert!(sanitize_url("ftp://files.example.com").is_err());
    assert!(sanitize_url("javascript:alert(1)").is_err());
    assert!(sanitize_url("file:///etc/passwd").is_err());
}

#[test]
fn sanitize_url_rejects_private_ips() {
    assert!(sanitize_url("http://127.0.0.1/api").is_err());
    assert!(sanitize_url("http://10.0.0.1/api").is_err());
    assert!(sanitize_url("http://192.168.1.1/api").is_err());
    assert!(sanitize_url("http://172.16.0.1/api").is_err());
}

#[test]
fn sanitize_url_accepts_public() {
    assert!(sanitize_url("https://api.modrinth.com/v2").is_ok());
    assert!(sanitize_url("http://example.com/file.jar").is_ok());
}

#[test]
fn sanitize_filename_rejects_path_separators() {
    assert!(sanitize_filename("dir/file.jar").is_err());
    assert!(sanitize_filename("dir\\file.jar").is_err());
    assert!(sanitize_filename("..").is_err());
    assert!(sanitize_filename("").is_err());
    assert!(sanitize_filename("file\0name").is_err());
}

#[test]
fn sanitize_filename_accepts_valid() {
    assert!(sanitize_filename("mod.jar").is_ok());
    assert!(sanitize_filename("resource_pack.zip").is_ok());
    assert!(sanitize_filename("OptiFine_1.20.4.jar").is_ok());
}

#[test]
fn validate_zip_entry_size_limits() {
    assert!(validate_zip_entry_size(100, 500).is_ok());
    assert!(validate_zip_entry_size(500, 500).is_ok());
    assert!(validate_zip_entry_size(501, 500).is_err());
    assert!(validate_zip_entry_size(0, 500).is_ok());
}

#[test]
fn jvm_whitelist_accepts_valid_rejects_malicious() {
    let valid = vec!["-Xmx4G".to_string(), "-XX:+UseG1GC".to_string()];
    assert!(validate_jvm_args(&valid).is_ok());

    let malicious = vec!["-agentpath:evil.so".to_string()];
    assert!(validate_jvm_args(&malicious).is_err());

    let (v, i) = validate_jvm_args_custom(&[
        "-Xmx4G".to_string(),
        "-javaagent:evil.jar".to_string(),
    ]);
    assert_eq!(v, vec!["-Xmx4G"]);
    assert!(i.contains(&"-javaagent:evil.jar".to_string()));
}

#[test]
fn jvm_whitelist_rejects_dangerous_args() {
    assert!(validate_jvm_args(&["-agentpath:evil.so".to_string()]).is_err());
    assert!(validate_jvm_args(&["-javaagent:evil.jar".to_string()]).is_err());
    assert!(validate_jvm_args(&["-Dexec.secret=bad".to_string()]).is_err());
}

#[test]
fn jvm_whitelist_accepts_common_args() {
    let args = vec![
        "-Xmx4G".to_string(),
        "-Xms512M".to_string(),
        "-XX:+UseG1GC".to_string(),
        "-Dfile.encoding=UTF-8".to_string(),
    ];
    assert!(validate_jvm_args(&args).is_ok());
}

#[test]
fn crypto_encrypt_decrypt_roundtrip() {
    let plaintext = b"hello world secret";
    let aad = b"test:aad";
    let encrypted = crypto::encrypt_data(plaintext, aad).unwrap();
    let decrypted = crypto::decrypt_data(&encrypted, aad).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn crypto_wrong_aad_fails() {
    let plaintext = b"secret data";
    let aad = b"correct:aad";
    let encrypted = crypto::encrypt_data(plaintext, aad).unwrap();
    let result = crypto::decrypt_data(&encrypted, b"wrong:aad");
    assert!(result.is_err());
}

#[test]
fn crypto_empty_payload_roundtrip() {
    let plaintext = b"";
    let aad = b"empty:test";
    let encrypted = crypto::encrypt_data(plaintext, aad).unwrap();
    let decrypted = crypto::decrypt_data(&encrypted, aad).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn crypto_large_payload_roundtrip() {
    let plaintext = vec![0xAB_u8; 1024 * 64];
    let aad = b"large:test";
    let encrypted = crypto::encrypt_data(&plaintext, aad).unwrap();
    let decrypted = crypto::decrypt_data(&encrypted, aad).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn crypto_encrypted_data_has_required_fields() {
    let encrypted = crypto::encrypt_data(b"test", b"aad").unwrap();
    assert_eq!(encrypted.version, "1");
    assert!(!encrypted.salt.is_empty());
    assert!(!encrypted.nonce.is_empty());
    assert!(!encrypted.ciphertext.is_empty());
}

#[test]
fn sanitize_general_string_rejects_controls() {
    assert!(sanitize_general_string("hello\x07world").is_err());
    assert!(sanitize_general_string("data\0here").is_err());
}

#[test]
fn sanitize_general_string_allows_newlines() {
    assert!(sanitize_general_string("line1\nline2").is_ok());
    assert!(sanitize_general_string("line1\r\nline2").is_ok());
    assert!(sanitize_general_string("tab\there").is_ok());
}
