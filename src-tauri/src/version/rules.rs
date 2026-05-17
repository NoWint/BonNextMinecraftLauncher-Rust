use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OsType {
    Windows,
    MacOS,
    Linux,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchType {
    X86,
    X64,
    Arm64,
}

#[derive(Debug, Clone)]
pub struct RuleContext {
    pub os: OsType,
    pub arch: ArchType,
    pub is_demo_user: bool,
    pub has_custom_resolution: bool,
}

impl Default for RuleContext {
    fn default() -> Self {
        Self {
            os: if cfg!(target_os = "windows") {
                OsType::Windows
            } else if cfg!(target_os = "macos") {
                OsType::MacOS
            } else {
                OsType::Linux
            },
            arch: if cfg!(target_arch = "aarch64") {
                ArchType::Arm64
            } else if cfg!(target_arch = "x86") {
                ArchType::X86
            } else {
                ArchType::X64
            },
            is_demo_user: false,
            has_custom_resolution: false,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Rule {
    pub action: String,
    #[serde(default)]
    pub os: Option<OsRule>,
    #[serde(default)]
    pub features: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OsRule {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub arch: Option<String>,
}

impl RuleContext {
    pub fn current() -> Self {
        Self::default()
    }
}

pub fn evaluate_rules(rules: &[Rule], ctx: &RuleContext) -> bool {
    if rules.is_empty() {
        return true;
    }

    let mut allowed = false;
    for rule in rules {
        let os_match = match &rule.os {
            Some(os) => {
                let name_match = match &os.name {
                    Some(name) => match name.as_str() {
                        "windows" => ctx.os == OsType::Windows,
                        "osx" | "macos" => ctx.os == OsType::MacOS,
                        "linux" => ctx.os == OsType::Linux,
                        _ => true,
                    },
                    None => true,
                };
                let arch_match = match &os.arch {
                    Some(arch) => match arch.as_str() {
                        "x86" => ctx.arch == ArchType::X86,
                        "x64" => ctx.arch == ArchType::X64,
                        "arm64" => ctx.arch == ArchType::Arm64,
                        _ => true,
                    },
                    None => true,
                };
                name_match && arch_match
            }
            None => true,
        };

        let features_match = match &rule.features {
            Some(features) => {
                let mut match_all = true;
                for (key, value) in features {
                    let feature_value = match key.as_str() {
                        "is_demo_user" => ctx.is_demo_user,
                        "has_custom_resolution" => ctx.has_custom_resolution,
                        // Unknown features are not supported, so the rule does not match
                        _ => {
                            match_all = false;
                            break;
                        }
                    };
                    if value.as_bool().unwrap_or(false) != feature_value {
                        match_all = false;
                        break;
                    }
                }
                match_all
            }
            None => true,
        };

        let condition_match = os_match && features_match;

        match rule.action.as_str() {
            "allow" if condition_match => {
                allowed = true;
            }
            "disallow" if condition_match => {
                allowed = false;
            }
            _ => {}
        }
    }

    allowed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_rules_allow() {
        assert!(evaluate_rules(&[], &RuleContext::current()));
    }

    #[test]
    fn allow_for_current_os() {
        let ctx = RuleContext::current();
        let os_name = if cfg!(target_os = "windows") { "windows" } else if cfg!(target_os = "macos") { "osx" } else { "linux" };
        let rules = vec![Rule { action: "allow".into(), os: Some(OsRule { name: Some(os_name.into()), arch: None }), features: None }];
        assert!(evaluate_rules(&rules, &ctx));
    }

    #[test]
    fn disallow_overrides_allow() {
        let os_name = if cfg!(target_os = "windows") { "windows" } else if cfg!(target_os = "macos") { "osx" } else { "linux" };
        let rules = vec![
            Rule { action: "allow".into(), os: None, features: None },
            Rule { action: "disallow".into(), os: Some(OsRule { name: Some(os_name.into()), arch: None }), features: None },
        ];
        assert!(!evaluate_rules(&rules, &RuleContext::current()));
    }

    #[test]
    fn non_matching_os_no_allow() {
        let wrong_os = if cfg!(target_os = "windows") { "linux" } else { "windows" };
        let rules = vec![Rule { action: "allow".into(), os: Some(OsRule { name: Some(wrong_os.into()), arch: None }), features: None }];
        assert!(!evaluate_rules(&rules, &RuleContext::current()));
    }

    #[test]
    fn arch_matching() {
        let arch = if cfg!(target_arch = "aarch64") { "arm64" } else if cfg!(target_arch = "x86") { "x86" } else { "x64" };
        let ctx = RuleContext::current();
        let rules = vec![Rule { action: "allow".into(), os: Some(OsRule { name: None, arch: Some(arch.into()) }), features: None }];
        assert!(evaluate_rules(&rules, &ctx));
    }

    #[test]
    fn demo_user_feature() {
        let ctx = RuleContext { is_demo_user: true, ..RuleContext::current() };
        let mut f = serde_json::Map::new();
        f.insert("is_demo_user".into(), serde_json::Value::Bool(true));
        let rules = vec![Rule { action: "allow".into(), os: None, features: Some(f) }];
        assert!(evaluate_rules(&rules, &ctx));
    }
}
