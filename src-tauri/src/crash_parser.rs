use serde::Serialize;

use crate::error::LauncherError;

#[derive(Debug, Clone, Serialize)]
pub struct CrashInfo {
    pub description: String,
    pub suggestion: String,
    pub severity: String,
    pub error_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CrashDiagnosis {
    pub crash_info: CrashInfo,
    pub additional_findings: Vec<CrashFinding>,
    pub auto_fix_available: bool,
    pub auto_fix_action: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CrashFinding {
    pub finding: String,
    pub severity: String,
    pub category: String,
    pub detail: String,
}

struct ErrorMapping {
    pattern: &'static str,
    suggestion: &'static str,
    severity: &'static str,
    error_type: &'static str,
    auto_fix: Option<&'static str>,
}

const ERROR_MAPPINGS: &[ErrorMapping] = &[
    ErrorMapping {
        pattern: "UnsupportedClassVersionError",
        suggestion: "需要更新Java版本",
        severity: "high",
        error_type: "java_version",
        auto_fix: Some("update_java"),
    },
    ErrorMapping {
        pattern: "OutOfMemoryError",
        suggestion: "内存不足，增加分配内存",
        severity: "high",
        error_type: "memory",
        auto_fix: Some("increase_memory"),
    },
    ErrorMapping {
        pattern: "UnsatisfiedLinkError",
        suggestion: "原生库加载失败，可能是权限不足或库文件缺失，请检查natives目录权限或重新下载版本",
        severity: "high",
        error_type: "native_libs",
        auto_fix: Some("redownload_version"),
    },
    ErrorMapping {
        pattern: "ClassNotFoundException",
        suggestion: "模组/库缺失",
        severity: "medium",
        error_type: "missing_class",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "ClassDefNotFoundError",
        suggestion: "模组/库缺失",
        severity: "medium",
        error_type: "missing_class",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "NoClassDefFoundError",
        suggestion: "模组/库缺失",
        severity: "medium",
        error_type: "missing_class",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "IllegalArgumentException: Only one quick play",
        suggestion: "版本参数冲突，请重试",
        severity: "medium",
        error_type: "argument_conflict",
        auto_fix: Some("reset_launch_state"),
    },
    ErrorMapping {
        pattern: "NullPointerException",
        suggestion: "游戏内部错误，请检查模组兼容性",
        severity: "medium",
        error_type: "internal",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "FileNotFoundException",
        suggestion: "文件缺失，重新下载版本",
        severity: "high",
        error_type: "missing_file",
        auto_fix: Some("redownload_version"),
    },
    ErrorMapping {
        pattern: "SocketException",
        suggestion: "网络连接失败，请检查网络设置",
        severity: "medium",
        error_type: "network",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "ConnectException",
        suggestion: "网络连接失败，请检查网络设置",
        severity: "medium",
        error_type: "network",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "SSLException",
        suggestion: "网络连接安全错误，请检查网络或尝试使用加速器",
        severity: "medium",
        error_type: "network",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "InvocationTargetException",
        suggestion: "游戏启动失败，可能缺少依赖库",
        severity: "high",
        error_type: "launch_failure",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "NoSuchMethodError",
        suggestion: "版本不兼容，尝试更新或更换Mod/模组加载器",
        severity: "high",
        error_type: "version_mismatch",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "IncompatibleClassChangeError",
        suggestion: "模组版本冲突，请检查模组兼容性",
        severity: "high",
        error_type: "version_mismatch",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "AccessDeniedException",
        suggestion: "文件访问权限不足，检查目录权限",
        severity: "medium",
        error_type: "permission",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "ZipException",
        suggestion: "资源包损坏，重新下载版本",
        severity: "high",
        error_type: "corrupted_file",
        auto_fix: Some("redownload_version"),
    },
    ErrorMapping {
        pattern: "EOFException",
        suggestion: "文件下载不完整，重新下载版本",
        severity: "high",
        error_type: "corrupted_file",
        auto_fix: Some("redownload_version"),
    },
    ErrorMapping {
        pattern: "ArrayIndexOutOfBoundsException",
        suggestion: "模组/游戏内部错误",
        severity: "medium",
        error_type: "internal",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "GLException",
        suggestion: "显卡驱动不兼容，请更新显卡驱动",
        severity: "high",
        error_type: "graphics",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "LWJGLException",
        suggestion: "图形库加载失败，检查显卡驱动或更新Java",
        severity: "high",
        error_type: "graphics",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "Pixel format not accelerated",
        suggestion: "显卡驱动不支持OpenGL，请更新显卡驱动",
        severity: "high",
        error_type: "graphics",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "OpenGL",
        suggestion: "显卡驱动不兼容，请更新显卡驱动",
        severity: "high",
        error_type: "graphics",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "EXCEPTION_ACCESS_VIOLATION",
        suggestion: "内存访问冲突，尝试减少模组或增加内存",
        severity: "high",
        error_type: "memory",
        auto_fix: Some("increase_memory"),
    },
    ErrorMapping {
        pattern: "Process crashed",
        suggestion: "JVM崩溃，可能是Java版本或显卡驱动问题",
        severity: "high",
        error_type: "jvm_crash",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "java.lang.OutOfMemoryError: Java heap space",
        suggestion: "Java堆内存不足，建议增加最大内存分配",
        severity: "high",
        error_type: "memory",
        auto_fix: Some("increase_memory"),
    },
    ErrorMapping {
        pattern: "java.lang.OutOfMemoryError: GC overhead limit exceeded",
        suggestion: "GC开销超限，内存严重不足，建议大幅增加内存分配",
        severity: "high",
        error_type: "memory",
        auto_fix: Some("increase_memory"),
    },
    ErrorMapping {
        pattern: "java.lang.OutOfMemoryError: Metaspace",
        suggestion: "Metaspace内存不足，建议增加Metaspace大小或减少模组数量",
        severity: "high",
        error_type: "memory",
        auto_fix: Some("increase_metaspace"),
    },
    ErrorMapping {
        pattern: "Failed to start the minecraft runtime",
        suggestion: "Minecraft运行时启动失败，请检查Java路径和版本",
        severity: "high",
        error_type: "launch_failure",
        auto_fix: Some("check_java"),
    },
    ErrorMapping {
        pattern: "Could not find or load main class",
        suggestion: "找不到主类，版本文件可能损坏，请重新下载",
        severity: "high",
        error_type: "missing_class",
        auto_fix: Some("redownload_version"),
    },
    ErrorMapping {
        pattern: "FabricLoader",
        suggestion: "Fabric加载器错误，请检查Fabric版本与Minecraft版本兼容性",
        severity: "high",
        error_type: "loader_error",
        auto_fix: Some("reinstall_loader"),
    },
    ErrorMapping {
        pattern: "MixinApplyError",
        suggestion: "Mixin注入失败，模组与当前版本不兼容",
        severity: "high",
        error_type: "mod_conflict",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "Mixin",
        suggestion: "Mixin相关错误，模组可能与当前版本或其他模组不兼容",
        severity: "medium",
        error_type: "mod_conflict",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "cpw.mods.modlauncher",
        suggestion: "Forge加载器错误，请检查Forge版本与Minecraft版本兼容性",
        severity: "high",
        error_type: "loader_error",
        auto_fix: Some("reinstall_loader"),
    },
    ErrorMapping {
        pattern: "net.minecraftforge",
        suggestion: "Forge相关错误，请检查Forge版本兼容性",
        severity: "medium",
        error_type: "loader_error",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "DuplicateModsFoundException",
        suggestion: "存在重复模组，请删除重复的模组文件",
        severity: "high",
        error_type: "mod_conflict",
        auto_fix: Some("remove_duplicate_mods"),
    },
    ErrorMapping {
        pattern: "ModResolutionException",
        suggestion: "模组依赖解析失败，缺少前置模组或版本不匹配",
        severity: "high",
        error_type: "mod_dependency",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "MissingDependenciesException",
        suggestion: "缺少模组依赖，请安装所需的前置模组",
        severity: "high",
        error_type: "mod_dependency",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "SecurityException",
        suggestion: "安全限制导致启动失败，检查Java安全策略或文件权限",
        severity: "medium",
        error_type: "permission",
        auto_fix: None,
    },
    ErrorMapping {
        pattern: "InvalidKeySpecException",
        suggestion: "加密密钥规范错误，可能是账户认证问题，请重新登录",
        severity: "medium",
        error_type: "auth_error",
        auto_fix: Some("relogin"),
    },
    ErrorMapping {
        pattern: "AuthenticationException",
        suggestion: "认证失败，请重新登录Microsoft账户",
        severity: "high",
        error_type: "auth_error",
        auto_fix: Some("relogin"),
    },
];

struct FindingRule {
    pattern: &'static str,
    finding: &'static str,
    severity: &'static str,
    category: &'static str,
    detail: &'static str,
}

const FINDING_RULES: &[FindingRule] = &[
    FindingRule {
        pattern: "java.lang.OutOfMemoryError",
        finding: "内存溢出",
        severity: "high",
        category: "memory",
        detail: "JVM分配的内存不足以运行当前配置，建议增加内存分配或减少模组数量",
    },
    FindingRule {
        pattern: "GL_OUT_OF_MEMORY",
        finding: "显存溢出",
        severity: "high",
        category: "graphics",
        detail: "GPU显存不足，尝试降低渲染距离、关闭光影或减少资源包分辨率",
    },
    FindingRule {
        pattern: "java.version",
        finding: "Java版本信息",
        severity: "info",
        category: "environment",
        detail: "日志中包含Java版本信息，可用于诊断版本兼容性问题",
    },
    FindingRule {
        pattern: "Loading Minecraft",
        finding: "Minecraft加载阶段崩溃",
        severity: "medium",
        category: "loading",
        detail: "游戏在加载阶段崩溃，可能是模组或资源包导致",
    },
    FindingRule {
        pattern: "Loading Resources",
        finding: "资源加载阶段崩溃",
        severity: "medium",
        category: "resources",
        detail: "游戏在资源加载阶段崩溃，可能是资源包问题",
    },
    FindingRule {
        pattern: "SoundManager",
        finding: "声音系统错误",
        severity: "low",
        category: "audio",
        detail: "声音系统出现问题，通常不影响游戏运行",
    },
    FindingRule {
        pattern: "Unable to fit",
        finding: "纹理图集溢出",
        severity: "medium",
        category: "graphics",
        detail: "纹理图集过大，尝试降低资源包分辨率或减少模组",
    },
    FindingRule {
        pattern: "StackOverflowError",
        finding: "栈溢出",
        severity: "high",
        category: "memory",
        detail: "调用栈溢出，可能是无限递归或模组冲突导致",
    },
    FindingRule {
        pattern: "ConcurrentModificationException",
        finding: "并发修改异常",
        severity: "medium",
        category: "mod_conflict",
        detail: "多线程并发修改集合导致，通常是模组线程安全问题",
    },
    FindingRule {
        pattern: "UnsupportedOperationException",
        finding: "不支持的操作",
        severity: "medium",
        category: "compatibility",
        detail: "尝试使用不支持的操作，可能是版本兼容性问题",
    },
];

pub fn parse_crash_report(report_path: &str) -> Result<CrashInfo, LauncherError> {
    let content = std::fs::read_to_string(report_path).map_err(|e| {
        LauncherError::Other(format!("Cannot read crash report '{}': {}", report_path, e))
    })?;

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

    let mut all_text = description.clone();
    for exc in &exception_lines {
        all_text.push(' ');
        all_text.push_str(exc);
    }
    for cb in &caused_by_lines {
        all_text.push(' ');
        all_text.push_str(cb);
    }

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

pub fn diagnose_crash(report_path: &str) -> Result<CrashDiagnosis, LauncherError> {
    let content = std::fs::read_to_string(report_path).map_err(|e| {
        LauncherError::Other(format!("Cannot read crash report '{}': {}", report_path, e))
    })?;

    let crash_info = parse_crash_report(report_path)?;

    let mut additional_findings: Vec<CrashFinding> = Vec::new();

    for rule in FINDING_RULES {
        if content.contains(rule.pattern) {
            additional_findings.push(CrashFinding {
                finding: rule.finding.to_string(),
                severity: rule.severity.to_string(),
                category: rule.category.to_string(),
                detail: rule.detail.to_string(),
            });
        }
    }

    let mod_names: Vec<&str> = content
        .lines()
        .filter(|l| l.contains("at ") && l.contains("mod_"))
        .filter_map(|l| l.split("mod_").nth(1))
        .filter_map(|s| s.split('.').next())
        .take(5)
        .collect();

    if !mod_names.is_empty() {
        additional_findings.push(CrashFinding {
            finding: "相关模组".to_string(),
            severity: "info".to_string(),
            category: "mods".to_string(),
            detail: format!("堆栈追踪中涉及以下模组: {}", mod_names.join(", ")),
        });
    }

    let auto_fix_available = ERROR_MAPPINGS
        .iter()
        .find(|m| content.contains(m.pattern))
        .and_then(|m| m.auto_fix)
        .is_some();

    let auto_fix_action = ERROR_MAPPINGS
        .iter()
        .find(|m| content.contains(m.pattern))
        .and_then(|m| m.auto_fix)
        .map(|s| s.to_string());

    Ok(CrashDiagnosis {
        crash_info,
        additional_findings,
        auto_fix_available,
        auto_fix_action,
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

    fn diagnose_from_str(content: &str) -> CrashDiagnosis {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        std::fs::write(tmp.path(), content).unwrap();
        diagnose_crash(&tmp.path().to_string_lossy()).unwrap()
    }

    #[test]
    fn test_out_of_memory() {
        let info = parse_from_str(
            "Description: Unexpected error\njava.lang.OutOfMemoryError: Java heap space\nCaused by: java.lang.OutOfMemoryError: GC overhead limit exceeded"
        );
        assert_eq!(info.suggestion, "Java堆内存不足，建议增加最大内存分配");
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

    #[test]
    fn test_diagnose_oom() {
        let diag = diagnose_from_str(
            "Description: Unexpected error\njava.lang.OutOfMemoryError: Java heap space"
        );
        assert!(diag.auto_fix_available);
        assert_eq!(diag.auto_fix_action, Some("increase_memory".to_string()));
        assert!(diag.additional_findings.iter().any(|f| f.category == "memory"));
    }

    #[test]
    fn test_diagnose_fabric_error() {
        let diag = diagnose_from_str(
            "Description: Loading error\nFabricLoader failed to load mod"
        );
        assert!(diag.auto_fix_available);
        assert_eq!(diag.auto_fix_action, Some("reinstall_loader".to_string()));
    }

    #[test]
    fn test_diagnose_no_autofix() {
        let diag = diagnose_from_str(
            "Description: Something happened\njava.lang.NullPointerException: unknown"
        );
        assert!(!diag.auto_fix_available);
        assert_eq!(diag.auto_fix_action, None);
    }
}
