use serde::Serialize;

use crate::error::LauncherError;

#[derive(Debug, Clone, Serialize)]
pub struct CrashInfo {
    pub description: String,
    pub suggestion: String,
    pub severity: String,
    pub error_type: String,
}

struct ErrorMapping {
    pattern: &'static str,
    suggestion: &'static str,
    severity: &'static str,
    error_type: &'static str,
}

const ERROR_MAPPINGS: &[ErrorMapping] = &[
    ErrorMapping {
        pattern: "UnsupportedClassVersionError",
        suggestion: "需要更新Java版本",
        severity: "high",
        error_type: "java_version",
    },
    ErrorMapping {
        pattern: "OutOfMemoryError",
        suggestion: "内存不足，增加分配内存",
        severity: "high",
        error_type: "memory",
    },
    ErrorMapping {
        pattern: "UnsatisfiedLinkError",
        suggestion: "原生库缺失，重新下载版本",
        severity: "high",
        error_type: "native_libs",
    },
    ErrorMapping {
        pattern: "ClassNotFoundException",
        suggestion: "模组/库缺失",
        severity: "medium",
        error_type: "missing_class",
    },
    ErrorMapping {
        pattern: "ClassDefNotFoundError",
        suggestion: "模组/库缺失",
        severity: "medium",
        error_type: "missing_class",
    },
    ErrorMapping {
        pattern: "NoClassDefFoundError",
        suggestion: "模组/库缺失",
        severity: "medium",
        error_type: "missing_class",
    },
    ErrorMapping {
        pattern: "IllegalArgumentException: Only one quick play",
        suggestion: "版本参数冲突，请重试",
        severity: "medium",
        error_type: "argument_conflict",
    },
    ErrorMapping {
        pattern: "NullPointerException",
        suggestion: "游戏内部错误，请检查模组兼容性",
        severity: "medium",
        error_type: "internal",
    },
    ErrorMapping {
        pattern: "FileNotFoundException",
        suggestion: "文件缺失，重新下载版本",
        severity: "high",
        error_type: "missing_file",
    },
    ErrorMapping {
        pattern: "SocketException",
        suggestion: "网络连接失败，请检查网络设置",
        severity: "medium",
        error_type: "network",
    },
    ErrorMapping {
        pattern: "ConnectException",
        suggestion: "网络连接失败，请检查网络设置",
        severity: "medium",
        error_type: "network",
    },
    ErrorMapping {
        pattern: "SSLException",
        suggestion: "网络连接安全错误，请检查网络或尝试使用加速器",
        severity: "medium",
        error_type: "network",
    },
    ErrorMapping {
        pattern: "InvocationTargetException",
        suggestion: "游戏启动失败，可能缺少依赖库",
        severity: "high",
        error_type: "launch_failure",
    },
    ErrorMapping {
        pattern: "NoSuchMethodError",
        suggestion: "版本不兼容，尝试更新或更换Mod/模组加载器",
        severity: "high",
        error_type: "version_mismatch",
    },
    ErrorMapping {
        pattern: "IncompatibleClassChangeError",
        suggestion: "模组版本冲突，请检查模组兼容性",
        severity: "high",
        error_type: "version_mismatch",
    },
    ErrorMapping {
        pattern: "AccessDeniedException",
        suggestion: "文件访问权限不足，检查目录权限",
        severity: "medium",
        error_type: "permission",
    },
    ErrorMapping {
        pattern: "ZipException",
        suggestion: "资源包损坏，重新下载版本",
        severity: "high",
        error_type: "corrupted_file",
    },
    ErrorMapping {
        pattern: "EOFException",
        suggestion: "文件下载不完整，重新下载版本",
        severity: "high",
        error_type: "corrupted_file",
    },
    ErrorMapping {
        pattern: "ArrayIndexOutOfBoundsException",
        suggestion: "模组/游戏内部错误",
        severity: "medium",
        error_type: "internal",
    },
    ErrorMapping {
        pattern: "GLException",
        suggestion: "显卡驱动不兼容，请更新显卡驱动",
        severity: "high",
        error_type: "graphics",
    },
    ErrorMapping {
        pattern: "LWJGLException",
        suggestion: "图形库加载失败，检查显卡驱动或更新Java",
        severity: "high",
        error_type: "graphics",
    },
    ErrorMapping {
        pattern: "Pixel format not accelerated",
        suggestion: "显卡驱动不支持OpenGL，请更新显卡驱动",
        severity: "high",
        error_type: "graphics",
    },
    ErrorMapping {
        pattern: "OpenGL",
        suggestion: "显卡驱动不兼容，请更新显卡驱动",
        severity: "high",
        error_type: "graphics",
    },
    ErrorMapping {
        pattern: "EXCEPTION_ACCESS_VIOLATION",
        suggestion: "内存访问冲突，尝试减少模组或增加内存",
        severity: "high",
        error_type: "memory",
    },
    ErrorMapping {
        pattern: "Process crashed",
        suggestion: "JVM崩溃，可能是Java版本或显卡驱动问题",
        severity: "high",
        error_type: "jvm_crash",
    },
];

pub fn parse_crash_report(report_path: &str) -> Result<CrashInfo, LauncherError> {
    let content = std::fs::read_to_string(report_path).map_err(|e| {
        LauncherError::Other(format!("Cannot read crash report '{}': {}", report_path, e))
    })?;

    // Extract the Description line
    let description = content
        .lines()
        .find(|l| l.starts_with("Description:") || l.starts_with("description:"))
        .map(|l| {
            l.trim_start_matches("Description:")
                .trim_start_matches("description:")
                .trim()
                .to_string()
        })
        .unwrap_or_else(|| "Unknown error".to_string());

    // Collect exception lines (lines starting with java.lang. or javax.)
    let exception_lines: Vec<String> = content
        .lines()
        .filter(|l| {
            let trimmed = l.trim();
            trimmed.starts_with("java.lang.")
                || trimmed.starts_with("javax.")
                || trimmed.starts_with("net.minecraft")
                || trimmed.starts_with("com.mojang")
        })
        .map(|l| {
            l.trim()
                .split('\n')
                .next()
                .unwrap_or("")
                .trim_end_matches(':')
                .to_string()
        })
        .collect();

    // Collect Caused by lines
    let caused_by_lines: Vec<String> = content
        .lines()
        .filter(|l| {
            let trimmed = l.trim();
            trimmed.starts_with("Caused by:") || trimmed.starts_with("caused by:")
        })
        .map(|l| {
            l.trim()
                .strip_prefix("Caused by:")
                .or_else(|| l.trim().strip_prefix("caused by:"))
                .unwrap_or("")
                .trim()
                .to_string()
        })
        .collect();

    // Merge all text for pattern matching
    let mut all_text = description.clone();
    for exc in &exception_lines {
        all_text.push(' ');
        all_text.push_str(exc);
    }
    for cb in &caused_by_lines {
        all_text.push(' ');
        all_text.push_str(cb);
    }

    // Match against known error patterns
    let mut matched: Option<&ErrorMapping> = None;
    for mapping in ERROR_MAPPINGS {
        if all_text.contains(mapping.pattern) {
            matched = Some(mapping);
            break;
        }
    }

    let suggestion = matched
        .map(|m| m.suggestion)
        .unwrap_or("未知错误，请查看详细日志")
        .to_string();
    let severity = matched
        .map(|m| m.severity)
        .unwrap_or("medium")
        .to_string();
    let error_type = matched
        .map(|m| m.error_type)
        .unwrap_or("unknown")
        .to_string();

    Ok(CrashInfo {
        description,
        suggestion,
        severity,
        error_type,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_from_str(content: &str) -> CrashInfo {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), content).unwrap();
        parse_crash_report(&tmp.path().to_string_lossy()).unwrap()
    }

    #[test]
    fn test_out_of_memory() {
        let info = parse_from_str(
            "Description: Unexpected error\njava.lang.OutOfMemoryError: Java heap space\nCaused by: java.lang.OutOfMemoryError: GC overhead limit exceeded"
        );
        assert_eq!(info.suggestion, "内存不足，增加分配内存");
        assert_eq!(info.severity, "high");
        assert_eq!(info.error_type, "memory");
    }

    #[test]
    fn test_unsupported_class_version() {
        let info = parse_from_str(
            "Description: Initialization error\njava.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main"
        );
        assert_eq!(info.suggestion, "需要更新Java版本");
        assert_eq!(info.error_type, "java_version");
    }

    #[test]
    fn test_class_not_found() {
        let info = parse_from_str(
            "Description: Mod loading error\njava.lang.ClassNotFoundException: com.example.mymod.MyMod"
        );
        assert_eq!(info.suggestion, "模组/库缺失");
        assert_eq!(info.error_type, "missing_class");
    }

    #[test]
    fn test_unknown_error() {
        let info = parse_from_str(
            "Description: Something weird happened\njava.lang.SomeRandomError: unknown"
        );
        assert_eq!(info.suggestion, "未知错误，请查看详细日志");
        assert_eq!(info.severity, "medium");
        assert_eq!(info.error_type, "unknown");
    }

    #[test]
    fn test_quick_play() {
        let info = parse_from_str(
            "Description: Launch failed\njava.lang.IllegalArgumentException: Only one quick play"
        );
        assert_eq!(info.suggestion, "版本参数冲突，请重试");
    }
}
