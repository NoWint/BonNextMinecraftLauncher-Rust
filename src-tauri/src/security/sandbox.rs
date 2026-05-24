use crate::error::LauncherError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxAvailability {
    pub platform: String,
    pub available: bool,
    pub tool: String,
    pub supported_modes: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    pub mode: String,
    pub game_dir: std::path::PathBuf,
}

pub fn check_sandbox_availability() -> SandboxAvailability {
    #[cfg(target_os = "macos")]
    {
        let available = std::process::Command::new("sandbox-exec")
            .arg("-n")
            .arg("no")
            .output()
            .is_ok();
        SandboxAvailability {
            platform: "macos".to_string(),
            available,
            tool: "sandbox-exec".to_string(),
            supported_modes: vec!["strict".to_string(), "standard".to_string()],
        }
    }

    #[cfg(target_os = "linux")]
    {
        let available = std::process::Command::new("firejail")
            .arg("--version")
            .output()
            .is_ok();
        SandboxAvailability {
            platform: "linux".to_string(),
            available,
            tool: "firejail".to_string(),
            supported_modes: vec!["strict".to_string(), "standard".to_string()],
        }
    }

    #[cfg(target_os = "windows")]
    {
        SandboxAvailability {
            platform: "windows".to_string(),
            available: false,
            tool: String::new(),
            supported_modes: Vec::new(),
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        SandboxAvailability {
            platform: std::env::consts::OS.to_string(),
            available: false,
            tool: String::new(),
            supported_modes: Vec::new(),
        }
    }
}

#[allow(dead_code)]
pub fn build_sandbox_command(
    config: &SandboxConfig,
    program: &str,
    args: &[String],
) -> Result<std::process::Command, LauncherError> {
    if config.mode == "none" {
        let mut cmd = std::process::Command::new(program);
        cmd.args(args);
        return Ok(cmd);
    }

    let availability = check_sandbox_availability();
    if !availability.available {
        let _ = super::audit::log_audit(
            super::audit::AuditLevel::Warn,
            super::audit::AuditCategory::Sandbox,
            "Sandbox requested but not available on this platform",
            Some(serde_json::json!({
                "platform": availability.platform,
                "mode": config.mode,
            })),
        );
        let mut cmd = std::process::Command::new(program);
        cmd.args(args);
        return Ok(cmd);
    }

    #[cfg(target_os = "macos")]
    {
        let game_dir = config.game_dir.to_string_lossy().to_string();
        let profile = if config.mode == "strict" {
            format!(
                "(version 1)(deny default)(allow file-read* file-write* (subpath \"{}\"))(allow process-exec)(allow process-fork)(allow signal)(allow sysctl-read)(allow file-read* (subpath \"/usr\"))(allow file-read* (subpath \"/System\"))(allow file-read* (subpath \"/Library\"))",
                game_dir
            )
        } else {
            format!(
                "(version 1)(allow default)(allow file-read* file-write* (subpath \"{}\"))",
                game_dir
            )
        };
        let mut cmd = std::process::Command::new("sandbox-exec");
        cmd.arg("-p").arg(&profile).arg("--").arg(program);
        cmd.args(args);
        Ok(cmd)
    }

    #[cfg(target_os = "linux")]
    {
        let game_dir = config.game_dir.to_string_lossy().to_string();
        let mut cmd = std::process::Command::new("firejail");
        cmd.arg(format!("--private={}", game_dir));
        if config.mode == "strict" {
            cmd.arg("--net=none").arg("--noroot");
        }
        cmd.arg("--").arg(program);
        cmd.args(args);
        Ok(cmd)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let mut cmd = std::process::Command::new(program);
        cmd.args(args);
        Ok(cmd)
    }
}
