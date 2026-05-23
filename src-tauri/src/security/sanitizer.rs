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
}
