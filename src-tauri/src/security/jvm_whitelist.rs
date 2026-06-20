use crate::error::LauncherError;

const ALLOWED_PREFIXES: &[&str] = &[
    "-Xmx",
    "-Xms",
    "-Xmn",
    "-Xss",
    "-XX:+UseG1GC",
    "-XX:+UseZGC",
    "-XX:+UseZGenerational",
    "-XX:+UseShenandoahGC",
    "-XX:+UseParallelGC",
    "-XX:+UseSerialGC",
    "-XX:+UseStringDeduplication",
    "-XX:+OptimizeStringConcat",
    "-XX:+UseCompressedOops",
    "-XX:+UseCompressedClassPointers",
    "-XX:+UseTLAB",
    "-XX:+ResizeTLAB",
    "-XX:MaxGCPauseMillis=",
    "-XX:InitiatingHeapOccupancyPercent=",
    "-XX:G1HeapRegionSize=",
    "-XX:MaxHeapFreeRatio=",
    "-XX:MinHeapFreeRatio=",
    "-XX:NewRatio=",
    "-XX:SurvivorRatio=",
    "-XX:MaxTenuringThreshold=",
    "-XX:+AggressiveOpts",
    "-XX:+AlwaysPreTouch",
    "-XX:ParallelGCThreads=",
    "-XX:ConcGCThreads=",
    "-XX:+DisableExplicitGC",
    "-XX:+UseLargePages",
    "-XX:LargePageSizeInBytes=",
    "-XX:+UseNUMA",
    "-Dfile.encoding=",
    "-Dsun.java2d.d3d=",
    "-Dsun.java2d.opengl=",
    "-Djava.net.preferIPv4Stack=",
    "-Dminecraft.applet.TargetDirectory=",
    "-Djava.library.path=",
    "-Dorg.lwjgl.librarypath=",
    "-Dorg.lwjgl.util.NoChecks=",
    "-Dfml.ignoreInvalidMinecraftCertificates=",
    "-Dfml.coreMods.load=",
    "-Dmixin.debug.verbose=",
    "-Dmixin.debug.export=",
    "-agentlib:jdwp",
];

const BLOCKED_PREFIXES: &[&str] = &[
    "-agentpath:",
    "-agentlib:",
    "-Xrunjdwp:",
    "-javaagent:",
    "-Djava.security.policy=",
    "-Djava.rmi.server.",
    "-Djavax.net.ssl.",
    "-Djdk.http.auth.",
];

pub fn validate_jvm_args(args: &[String]) -> Result<Vec<String>, LauncherError> {
    let mut valid = Vec::new();
    for arg in args {
        let is_blocked = BLOCKED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_blocked {
            return Err(LauncherError::SecurityValidation(format!(
                "JVM argument blocked for security: {}",
                arg
            )));
        }
        let is_allowed = ALLOWED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_allowed {
            valid.push(arg.clone());
        } else {
            return Err(LauncherError::SecurityValidation(format!(
                "JVM argument not in whitelist: {}",
                arg
            )));
        }
    }
    Ok(valid)
}

pub fn validate_jvm_args_custom(args: &[String]) -> (Vec<String>, Vec<String>) {
    let mut valid = Vec::new();
    let mut invalid = Vec::new();
    for arg in args {
        let is_blocked = BLOCKED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_blocked {
            invalid.push(arg.clone());
            continue;
        }
        let is_allowed = ALLOWED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_allowed {
            valid.push(arg.clone());
        } else {
            invalid.push(arg.clone());
        }
    }
    (valid, invalid)
}

// Used in tests only
#[allow(dead_code)]
pub fn get_whitelist_entries() -> Vec<&'static str> {
    ALLOWED_PREFIXES.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_allowed_args() {
        let args = vec![
            "-Xmx4G".to_string(),
            "-Xms512M".to_string(),
            "-XX:+UseG1GC".to_string(),
        ];
        let result = validate_jvm_args(&args).unwrap();
        assert_eq!(result, args);
    }

    #[test]
    fn reject_disallowed_arg() {
        let args = vec!["-Xmx4G".to_string(), "-Dexec.secret=bad".to_string()];
        assert!(validate_jvm_args(&args).is_err());
    }

    #[test]
    fn custom_validation_splits() {
        let args = vec![
            "-Xmx4G".to_string(),
            "-evil".to_string(),
            "-XX:+UseG1GC".to_string(),
        ];
        let (valid, invalid) = validate_jvm_args_custom(&args);
        assert_eq!(valid, vec!["-Xmx4G", "-XX:+UseG1GC"]);
        assert_eq!(invalid, vec!["-evil"]);
    }

    #[test]
    fn whitelist_entries_not_empty() {
        let entries = get_whitelist_entries();
        assert!(!entries.is_empty());
        assert!(entries.contains(&"-Xmx"));
    }

    #[test]
    fn reject_agent_path() {
        let args = vec!["-agentpath:/tmp/evil.so".to_string()];
        assert!(validate_jvm_args(&args).is_err());
    }

    #[test]
    fn reject_javaagent() {
        let args = vec!["-javaagent:evil.jar".to_string()];
        assert!(validate_jvm_args(&args).is_err());
    }

    #[test]
    fn reject_security_policy() {
        let args = vec!["-Djava.security.policy=/tmp/policy".to_string()];
        assert!(validate_jvm_args(&args).is_err());
    }

    #[test]
    fn allow_minecraft_properties() {
        let args = vec![
            "-Dminecraft.applet.TargetDirectory=/game".to_string(),
            "-Djava.library.path=/lib".to_string(),
        ];
        assert!(validate_jvm_args(&args).is_ok());
    }

    #[test]
    fn custom_validation_blocks_agents() {
        let args = vec![
            "-Xmx4G".to_string(),
            "-agentpath:evil.so".to_string(),
        ];
        let (valid, invalid) = validate_jvm_args_custom(&args);
        assert_eq!(valid, vec!["-Xmx4G"]);
        assert_eq!(invalid, vec!["-agentpath:evil.so"]);
    }
}
