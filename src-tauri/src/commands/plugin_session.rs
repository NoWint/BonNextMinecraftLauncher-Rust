use crate::error::LauncherError;
use parking_lot::Mutex;
use rand::Rng;
use std::collections::HashMap;

/// 插件会话：激活时颁发，携带权限快照
#[derive(Clone, Debug)]
pub struct PluginSession {
    pub plugin_id: String,
    pub permissions: Vec<String>,
    pub http_domains: Vec<String>,
    pub fs_read_scopes: Vec<String>,
    pub fs_write_scopes: Vec<String>,
    pub invoke_namespaces: Vec<String>,
    pub can_listen_events: bool,
    pub can_emit_events: bool,
    pub created_at: std::time::Instant,
}

/// 全局会话表：token → session
pub struct SessionStore {
    sessions: Mutex<HashMap<String, PluginSession>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// 颁发新 token，返回 64 字符十六进制字符串
    pub fn create(&self, session: PluginSession) -> String {
        let token: String = (0..64)
            .map(|_| format!("{:x}", rand::thread_rng().gen_range(0..16)))
            .collect();
        self.sessions.lock().insert(token.clone(), session);
        token
    }

    /// 校验 token 并返回 session 引用
    pub fn validate(&self, token: &str) -> Result<PluginSession, LauncherError> {
        self.sessions
            .lock()
            .get(token)
            .cloned()
            .ok_or_else(|| LauncherError::Other("Invalid or expired plugin session token".to_string()))
    }

    /// 撤销 token（插件 deactivate 时调用）
    pub fn revoke(&self, token: &str) {
        self.sessions.lock().remove(token);
    }

    /// 撤销某插件的所有 token（卸载时调用）
    pub fn revoke_by_plugin(&self, plugin_id: &str) {
        let mut sessions = self.sessions.lock();
        sessions.retain(|_, session| session.plugin_id != plugin_id);
    }
}

impl PluginSession {
    pub fn can_http(&self, url: &str) -> bool {
        let Ok(parsed) = url::Url::parse(url) else {
            return false;
        };
        let hostname = parsed.host_str().unwrap_or("");
        self.http_domains.iter().any(|domain| {
            hostname == domain || hostname.ends_with(&format!(".{}", domain))
        })
    }

    pub fn can_invoke(&self, command: &str) -> bool {
        if command.contains(':') {
            let ns = command.split(':').next().unwrap_or("");
            return self.invoke_namespaces.iter().any(|n| n == ns);
        }
        // 未映射命令默认拒绝（fail-closed）
        false
    }

    pub fn can_fs_read(&self, scope: &str) -> bool {
        self.fs_read_scopes.iter().any(|s| s == "global" || s == scope)
    }

    pub fn can_fs_write(&self, scope: &str) -> bool {
        self.fs_write_scopes.iter().any(|s| s == "global" || s == scope)
    }
}

#[tauri::command]
pub async fn plugin_register_session(
    session_store: tauri::State<'_, SessionStore>,
    plugin_id: String,
    permissions: Vec<String>,
) -> Result<String, LauncherError> {
    // 校验 plugin_id 字符集
    if !plugin_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
        return Err(LauncherError::Other("Invalid plugin ID".to_string()));
    }

    // 解析权限字符串为结构化 session
    let mut http_domains = Vec::new();
    let mut fs_read_scopes = Vec::new();
    let mut fs_write_scopes = Vec::new();
    let mut invoke_namespaces = Vec::new();
    let mut can_listen_events = false;
    let mut can_emit_events = false;

    for perm in &permissions {
        if let Some(domain) = perm.strip_prefix("http:") {
            http_domains.push(domain.to_string());
        } else if let Some(scope) = perm.strip_prefix("fs:read:") {
            fs_read_scopes.push(scope.to_string());
        } else if let Some(scope) = perm.strip_prefix("fs:write:") {
            fs_write_scopes.push(scope.to_string());
        } else if let Some(ns) = perm.strip_prefix("invoke:") {
            invoke_namespaces.push(ns.to_string());
        } else if perm == "events:listen" {
            can_listen_events = true;
        } else if perm == "events:emit" {
            can_emit_events = true;
        }
    }

    let session = PluginSession {
        plugin_id: plugin_id.clone(),
        permissions: permissions.clone(),
        http_domains,
        fs_read_scopes,
        fs_write_scopes,
        invoke_namespaces,
        can_listen_events,
        can_emit_events,
        created_at: std::time::Instant::now(),
    };

    Ok(session_store.create(session))
}

#[tauri::command]
pub async fn plugin_revoke_session(
    session_store: tauri::State<'_, SessionStore>,
    token: String,
) -> Result<(), LauncherError> {
    session_store.revoke(&token);
    Ok(())
}
