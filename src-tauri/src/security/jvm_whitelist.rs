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
];

pub fn validate_jvm_args(args: &[String]) -> Result<Vec<String>, LauncherError> {
    let mut valid = Vec::new();
    for arg in args {
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
        let is_allowed = ALLOWED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_allowed {
            valid.push(arg.clone());
        } else {
            invalid.push(arg.clone());
        }
    }
    (valid, invalid)
}

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
}
