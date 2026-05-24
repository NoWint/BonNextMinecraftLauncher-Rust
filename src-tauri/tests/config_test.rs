use bonnext_lib::*;

#[test]
fn config_default_values() {
    let config = AppConfig::default();
    assert_eq!(config.max_memory, 2048);
    assert_eq!(config.min_memory, 512);
    assert_eq!(config.window_width, 854);
    assert_eq!(config.window_height, 480);
    assert_eq!(config.download_source, "official");
    assert_eq!(config.max_concurrent_downloads, 8);
    assert!(!config.fullscreen);
    assert!(!config.keep_launcher_open);
    assert!(config.show_log_on_crash);
}

#[test]
fn config_security_defaults() {
    let config = AppConfig::default();
    assert!(config.security.credential_encryption);
    assert!(config.security.strict_verification);
    assert!(config.security.enforce_https);
    assert_eq!(config.security.jvm_args_mode, "whitelist");
    assert_eq!(config.security.sandbox_mode, "off");
    assert!(config.security.audit_log_enabled);
    assert!(config.security.secure_launch_check);
}

#[test]
fn config_serialization_roundtrip() {
    let config = AppConfig::default();
    let json = serde_json::to_string(&config).unwrap();
    let deserialized: AppConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(config.max_memory, deserialized.max_memory);
    assert_eq!(config.min_memory, deserialized.min_memory);
    assert_eq!(config.download_source, deserialized.download_source);
    assert_eq!(config.max_concurrent_downloads, deserialized.max_concurrent_downloads);
}

#[test]
fn config_custom_values_roundtrip() {
    let config = AppConfig {
        max_memory: 8192,
        min_memory: 1024,
        download_source: "bmclapi".to_string(),
        keep_launcher_open: true,
        fullscreen: true,
        jvm_args: Some("-XX:+UseG1GC".to_string()),
        ..AppConfig::default()
    };
    let json = serde_json::to_string(&config).unwrap();
    let deserialized: AppConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.max_memory, 8192);
    assert_eq!(deserialized.min_memory, 1024);
    assert_eq!(deserialized.download_source, "bmclapi");
    assert!(deserialized.keep_launcher_open);
    assert!(deserialized.fullscreen);
    assert_eq!(deserialized.jvm_args.as_deref(), Some("-XX:+UseG1GC"));
}

#[test]
fn config_json_missing_fields_use_defaults() {
    let json = r#"{"max_memory": 4096}"#;
    let config: AppConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.max_memory, 4096);
    assert_eq!(config.min_memory, 512);
    assert_eq!(config.download_source, "official");
}

#[test]
fn security_config_serialization_roundtrip() {
    let sec = SecurityConfig::default();
    let json = serde_json::to_string(&sec).unwrap();
    let deserialized: SecurityConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(sec.credential_encryption, deserialized.credential_encryption);
    assert_eq!(sec.strict_verification, deserialized.strict_verification);
    assert_eq!(sec.enforce_https, deserialized.enforce_https);
    assert_eq!(sec.jvm_args_mode, deserialized.jvm_args_mode);
    assert_eq!(sec.sandbox_mode, deserialized.sandbox_mode);
}
