use crate::error::LauncherError;
use std::net::IpAddr;

pub fn sanitize_path(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "Path contains null bytes".into(),
        ));
    }
    if input.len() > 4096 {
        return Err(LauncherError::SecurityValidation(
            "Path exceeds maximum length of 4096".into(),
        ));
    }
    let path = std::path::Path::new(input);
    for component in path.components() {
        if component == std::path::Component::ParentDir {
            return Err(LauncherError::SecurityValidation(
                "Path contains parent directory traversal (..)".into(),
            ));
        }
    }
    Ok(input.to_string())
}

pub fn sanitize_id(input: &str) -> Result<String, LauncherError> {
    if input.is_empty() {
        return Err(LauncherError::SecurityValidation(
            "ID cannot be empty".into(),
        ));
    }
    if input.len() > 256 {
        return Err(LauncherError::SecurityValidation(
            "ID exceeds maximum length of 256".into(),
        ));
    }
    if !input
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(LauncherError::SecurityValidation(
            "ID contains invalid characters (only a-zA-Z0-9_- allowed)".into(),
        ));
    }
    Ok(input.to_string())
}

pub fn sanitize_url(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "URL contains null bytes".into(),
        ));
    }
    let parsed = url::Url::parse(input).map_err(|e| {
        LauncherError::SecurityValidation(format!("Invalid URL: {}", e))
    })?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(LauncherError::SecurityValidation(format!(
            "URL scheme '{}' not allowed (only http/https)",
            parsed.scheme()
        )));
    }
    if let Some(host) = parsed.host() {
        match host {
            url::Host::Ipv4(ip) => {
                if is_private_ip(&IpAddr::V4(ip)) {
                    return Err(LauncherError::SecurityValidation(
                        "URL points to a private IP address".into(),
                    ));
                }
            }
            url::Host::Ipv6(ip) => {
                if is_private_ip(&IpAddr::V6(ip)) {
                    return Err(LauncherError::SecurityValidation(
                        "URL points to a private IP address".into(),
                    ));
                }
            }
            url::Host::Domain(_) => {}
        }
    }
    Ok(input.to_string())
}

pub fn sanitize_general_string(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "String contains null bytes".into(),
        ));
    }
    if input.len() > 65535 {
        return Err(LauncherError::SecurityValidation(
            "String exceeds maximum length of 65535".into(),
        ));
    }
    if !input
        .chars()
        .all(|c| !c.is_control() || c == '\n' || c == '\r' || c == '\t')
    {
        return Err(LauncherError::SecurityValidation(
            "String contains invalid control characters".into(),
        ));
    }
    Ok(input.to_string())
}

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            octets[0] == 127
                || octets[0] == 10
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                || (octets[0] == 192 && octets[1] == 168)
        }
        IpAddr::V6(v6) => {
            if v6.is_loopback() {
                return true;
            }
            let segments = v6.segments();
            (segments[0] & 0xfe00) == 0xfc00 || (segments[0] & 0xffc0) == 0xfe80
        }
    }
}

pub fn sanitize_jvm_arg(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "JVM argument contains null bytes".into(),
        ));
    }
    if input.len() > 4096 {
        return Err(LauncherError::SecurityValidation(
            "JVM argument exceeds maximum length".into(),
        ));
    }
    Ok(input.to_string())
}

pub fn validate_zip_entry_size(entry_size: u64, max_total: u64) -> Result<(), LauncherError> {
    if entry_size > max_total {
        return Err(LauncherError::SecurityValidation(format!(
            "ZIP entry size {} exceeds maximum allowed {}",
            entry_size, max_total
        )));
    }
    Ok(())
}

pub fn sanitize_filename(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "Filename contains null bytes".into(),
        ));
    }
    if input.len() > 255 {
        return Err(LauncherError::SecurityValidation(
            "Filename exceeds maximum length of 255".into(),
        ));
    }
    if input.contains('/') || input.contains('\\') {
        return Err(LauncherError::SecurityValidation(
            "Filename contains path separators".into(),
        ));
    }
    if input == ".." {
        return Err(LauncherError::SecurityValidation(
            "Filename cannot be '..'".into(),
        ));
    }
    Ok(input.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_path_valid() {
        assert_eq!(sanitize_path("foo/bar").unwrap(), "foo/bar");
    }

    #[test]
    fn sanitize_path_rejects_null() {
        assert!(sanitize_path("foo\0bar").is_err());
    }

    #[test]
    fn sanitize_path_rejects_parent_dir() {
        assert!(sanitize_path("foo/../etc/passwd").is_err());
    }

    #[test]
    fn sanitize_id_valid() {
        assert_eq!(sanitize_id("my-instance_1").unwrap(), "my-instance_1");
    }

    #[test]
    fn sanitize_id_rejects_empty() {
        assert!(sanitize_id("").is_err());
    }

    #[test]
    fn sanitize_url_rejects_private_ip() {
        assert!(sanitize_url("http://127.0.0.1/api").is_err());
        assert!(sanitize_url("http://10.0.0.1/api").is_err());
        assert!(sanitize_url("http://192.168.1.1/api").is_err());
    }

    #[test]
    fn sanitize_url_allows_public() {
        assert!(sanitize_url("https://api.modrinth.com/v2").is_ok());
    }

    #[test]
    fn sanitize_jvm_arg_rejects_null() {
        assert!(sanitize_jvm_arg("-Xmx4G\0bad").is_err());
    }

    #[test]
    fn sanitize_jvm_arg_allows_valid() {
        assert_eq!(sanitize_jvm_arg("-Xmx4G").unwrap(), "-Xmx4G");
    }

    #[test]
    fn validate_zip_entry_rejects_oversized() {
        assert!(validate_zip_entry_size(1_000_000_000, 500_000_000).is_err());
    }

    #[test]
    fn validate_zip_entry_allows_normal() {
        assert!(validate_zip_entry_size(1000, 500_000_000).is_ok());
    }

    #[test]
    fn sanitize_filename_rejects_path_sep() {
        assert!(sanitize_filename("foo/bar").is_err());
        assert!(sanitize_filename("foo\\bar").is_err());
    }

    #[test]
    fn sanitize_filename_rejects_parent() {
        assert!(sanitize_filename("..").is_err());
    }

    #[test]
    fn sanitize_filename_allows_normal() {
        assert_eq!(sanitize_filename("mod.jar").unwrap(), "mod.jar");
    }

    #[test]
    fn sanitize_path_rejects_too_long() {
        let long = "a".repeat(4097);
        assert!(sanitize_path(&long).is_err());
    }

    #[test]
    fn sanitize_path_allows_max_length() {
        let exact = "a".repeat(4096);
        assert!(sanitize_path(&exact).is_ok());
    }

    #[test]
    fn sanitize_path_rejects_leading_parent() {
        assert!(sanitize_path("../etc/passwd").is_err());
    }

    #[test]
    fn sanitize_path_rejects_trailing_parent() {
        assert!(sanitize_path("foo/bar/..").is_err());
    }

    #[test]
    fn sanitize_id_rejects_special_chars() {
        assert!(sanitize_id("my instance").is_err());
        assert!(sanitize_id("instance@1").is_err());
        assert!(sanitize_id("a/b").is_err());
        assert!(sanitize_id("a.b").is_err());
    }

    #[test]
    fn sanitize_id_rejects_too_long() {
        let long = "a".repeat(257);
        assert!(sanitize_id(&long).is_err());
    }

    #[test]
    fn sanitize_id_allows_max_length() {
        let exact = "a".repeat(256);
        assert!(sanitize_id(&exact).is_ok());
    }

    #[test]
    fn sanitize_id_allows_underscore_hyphen() {
        assert!(sanitize_id("my-instance_1").is_ok());
        assert!(sanitize_id("_-").is_ok());
    }

    #[test]
    fn sanitize_url_rejects_null_bytes() {
        assert!(sanitize_url("https://example.com\0/path").is_err());
    }

    #[test]
    fn sanitize_url_rejects_ftp_scheme() {
        assert!(sanitize_url("ftp://example.com/file").is_err());
    }

    #[test]
    fn sanitize_url_rejects_javascript_scheme() {
        assert!(sanitize_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn sanitize_url_rejects_172_16_private() {
        assert!(sanitize_url("http://172.16.0.1/api").is_err());
    }

    #[test]
    fn sanitize_url_rejects_172_31_private() {
        assert!(sanitize_url("http://172.31.255.255/api").is_err());
    }

    #[test]
    fn sanitize_url_allows_172_15_public() {
        assert!(sanitize_url("http://172.15.0.1/api").is_ok());
    }

    #[test]
    fn sanitize_url_allows_172_32_public() {
        assert!(sanitize_url("http://172.32.0.1/api").is_ok());
    }

    #[test]
    fn sanitize_general_string_rejects_null() {
        assert!(sanitize_general_string("hello\0world").is_err());
    }

    #[test]
    fn sanitize_general_string_rejects_too_long() {
        let long = "a".repeat(65536);
        assert!(sanitize_general_string(&long).is_err());
    }

    #[test]
    fn sanitize_general_string_allows_max_length() {
        let exact = "a".repeat(65535);
        assert!(sanitize_general_string(&exact).is_ok());
    }

    #[test]
    fn sanitize_general_string_rejects_control_chars() {
        assert!(sanitize_general_string("hello\x01world").is_err());
        assert!(sanitize_general_string("hello\x07world").is_err());
    }

    #[test]
    fn sanitize_general_string_allows_newline_tab() {
        assert!(sanitize_general_string("hello\nworld").is_ok());
        assert!(sanitize_general_string("hello\tworld").is_ok());
        assert!(sanitize_general_string("hello\r\nworld").is_ok());
    }
}
