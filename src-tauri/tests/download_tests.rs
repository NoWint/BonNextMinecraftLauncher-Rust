use bonnext_lib::download::verifier::{
    compute_sha1, compute_sha256, verify_file_sha1, verify_file_sha256, file_exists_and_valid,
};
use std::io::Write;

#[test]
fn sha1_known_value() {
    let data = b"hello world";
    let hash = compute_sha1(data);
    assert_eq!(hash, "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
}

#[test]
fn sha256_known_value() {
    let data = b"hello world";
    let hash = compute_sha256(data);
    assert_eq!(
        hash,
        "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
}

#[test]
fn verify_sha1_matches() {
    let data = b"test data for sha1";
    let hash = compute_sha1(data);
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(data).unwrap();
    assert!(verify_file_sha1(f.path(), &hash).is_ok());
}

#[test]
fn verify_sha1_mismatch() {
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(b"some data").unwrap();
    assert!(
        verify_file_sha1(f.path(), "0000000000000000000000000000000000000000").is_err()
    );
}

#[test]
fn verify_sha256_matches() {
    let data = b"test data for sha256";
    let hash = compute_sha256(data);
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(data).unwrap();
    assert!(verify_file_sha256(f.path(), &hash).is_ok());
}

#[test]
fn verify_sha256_mismatch() {
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(b"some data").unwrap();
    assert!(verify_file_sha256(
        f.path(),
        "0000000000000000000000000000000000000000000000000000000000000000"
    )
    .is_err());
}

#[test]
fn file_exists_and_valid_with_size() {
    let data = b"16 bytes of data";
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(data).unwrap();
    assert!(file_exists_and_valid(f.path(), "", data.len() as u64, false));
    assert!(!file_exists_and_valid(f.path(), "", 9999, false));
}

#[test]
fn file_exists_and_valid_missing_file() {
    assert!(!file_exists_and_valid(
        std::path::Path::new("/nonexistent_test_file_xyz"),
        "",
        0,
        false
    ));
}

#[test]
fn sha1_empty_data() {
    let hash = compute_sha1(b"");
    assert_eq!(hash, "da39a3ee5e6b4b0d3255bfef95601890afd80709");
}

#[test]
fn sha256_empty_data() {
    let hash = compute_sha256(b"");
    assert_eq!(
        hash,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
}

#[test]
fn sha1_case_insensitive_comparison() {
    let data = b"hello world";
    let hash_upper = compute_sha1(data).to_uppercase();
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(data).unwrap();
    assert!(verify_file_sha1(f.path(), &hash_upper).is_ok());
}

#[test]
fn sha256_case_insensitive_comparison() {
    let data = b"hello world";
    let hash_upper = compute_sha256(data).to_uppercase();
    let mut f = tempfile::NamedTempFile::new().unwrap();
    f.write_all(data).unwrap();
    assert!(verify_file_sha256(f.path(), &hash_upper).is_ok());
}
