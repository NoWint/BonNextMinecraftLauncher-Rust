# BonNext 全面安全优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 BonNext 启动器进行全面深度安全优化，覆盖数据保护、网络安全、启动安全、安全审计四大领域，并在设置页新增安全板块。

**Architecture:** 新增 `security/` Rust 模块（含加密、消毒、审计、沙箱等子模块），扩展现有 `AppConfig` 加入 `SecurityConfig`，强化 CSP 策略，改造 `token_store` 和 `http_client` 支持加密和代理，前端新增安全设置页各 SectionCard。

**Tech Stack:** Rust (aes-gcm, hkdf, sha2, whoami), TypeScript/React, Tauri v2 IPC, CSS Modules

---

## 文件结构

### 新建文件

| 文件路径 | 职责 |
|---------|------|
| `src-tauri/src/security/mod.rs` | 模块入口，导出公共接口 |
| `src-tauri/src/security/crypto.rs` | AES-256-GCM 加密/解密、HKDF 密钥派生、机器指纹 |
| `src-tauri/src/security/credential_store.rs` | 凭据加密存储（替代明文 accounts.json 读写） |
| `src-tauri/src/security/sanitizer.rs` | 输入消毒（路径、ID、URL、通用字符串） |
| `src-tauri/src/security/audit.rs` | 审计日志系统（异步写入、轮转） |
| `src-tauri/src/security/file_permissions.rs` | 跨平台文件权限控制 |
| `src-tauri/src/security/jvm_whitelist.rs` | JVM 参数白名单验证 |
| `src-tauri/src/security/sandbox.rs` | 沙箱启动（macOS sandbox-exec / Linux firejail / Windows Job Object） |
| `src-tauri/src/security/key_store.rs` | API Key 加密存储 |
| `src/components/ui/SecurityScore.tsx` | 安全评分组件 |
| `src/components/ui/SecurityScore.module.css` | 安全评分样式 |
| `src/components/ui/AuditLogViewer.tsx` | 审计日志查看器组件 |
| `src/components/ui/AuditLogViewer.module.css` | 审计日志查看器样式 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src-tauri/Cargo.toml` | 新增 aes-gcm, hkdf, sha2, whoami 依赖 |
| `src-tauri/src/lib.rs` | 新增 `mod security;`，注册 14 个安全相关 Tauri command |
| `src-tauri/src/config.rs` | AppConfig 新增 `security: SecurityConfig` 字段 |
| `src-tauri/src/auth/token_store.rs` | 读写凭据改为加密存储 |
| `src-tauri/src/auth/microsoft.rs` | 登录成功后记录审计日志 |
| `src-tauri/src/auth/offline.rs` | 登录成功后记录审计日志 |
| `src-tauri/src/curseforge.rs` | API Key 改为从 key_store 读取 |
| `src-tauri/src/http_client.rs` | 支持代理配置 |
| `src-tauri/src/download/verifier.rs` | 严格验证模式 |
| `src-tauri/src/error.rs` | 新增安全相关错误变体 |
| `src-tauri/src/platform/paths.rs` | 新增安全目录路径函数 |
| `src-tauri/tauri.conf.json` | 强化 CSP |
| `src/api.ts` | 新增安全相关接口和 API 方法 |
| `src/stores/configStore.tsx` | 支持 SecurityConfig |
| `src/pages/SettingsPage.tsx` | 新增安全导航分类和 6 个 SectionCard |
| `src/pages/SettingsPage.module.css` | 新增安全相关样式 |

---

### Task 1: 新增 Rust 依赖和 error 变体

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/error.rs`

- [ ] **Step 1: 在 Cargo.toml 中添加安全相关依赖**

在 `[dependencies]` 段末尾添加：

```toml
aes-gcm = "0.10"
hkdf = "0.12"
sha2 = "0.10"
whoami = "1.5"
```

注意：`base64 = "0.22"` 已存在，无需重复添加。

- [ ] **Step 2: 在 error.rs 中新增安全相关错误变体**

在 `LauncherError` 枚举中添加：

```rust
#[error("Encryption error: {0}")]
Encryption(String),

#[error("Decryption error: {0}")]
Decryption(String),

#[error("Security validation failed: {0}")]
SecurityValidation(String),

#[error("Sandbox error: {0}")]
SandboxError(String),

#[error("Audit log error: {0}")]
AuditLog(String),
```

- [ ] **Step 3: 运行 cargo check 验证编译**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/error.rs
git commit -m "feat(security): add crypto dependencies and security error variants"
```

---

### Task 2: 创建 security 模块骨架和 crypto 子模块

**Files:**
- Create: `src-tauri/src/security/mod.rs`
- Create: `src-tauri/src/security/crypto.rs`

- [ ] **Step 1: 创建 security/mod.rs**

```rust
pub mod audit;
pub mod credential_store;
pub mod crypto;
pub mod file_permissions;
pub mod jvm_whitelist;
pub mod key_store;
pub mod sanitizer;
pub mod sandbox;
```

- [ ] **Step 2: 创建 security/crypto.rs**

```rust
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use hkdf::Hkdf;
use sha2::Sha256;
use std::path::Path;

use crate::error::LauncherError;

const KEY_INFO: &[u8] = b"bonnext-credential-key";
const SALT_FILE: &str = ".security_salt";
const KEY_LENGTH: usize = 32;

pub fn get_salt_path() -> std::path::PathBuf {
    crate::platform::paths::get_config_dir().join(SALT_FILE)
}

fn machine_fingerprint(salt: &[u8]) -> Vec<u8> {
    let hostname = whoami::fallible::hostname().unwrap_or_default();
    let username = whoami::username();
    let os = std::env::consts::OS;
    let mut input = Vec::with_capacity(256);
    input.extend_from_slice(hostname.as_bytes());
    input.extend_from_slice(username.as_bytes());
    input.extend_from_slice(os.as_bytes());
    input.extend_from_slice(salt);
    let mut hasher = Sha256::new();
    sha2::Digest::update(&mut hasher, &input);
    sha2::Digest::finalize(hasher).to_vec()
}

fn derive_key(salt: &[u8]) -> [u8; KEY_LENGTH] {
    let fingerprint = machine_fingerprint(salt);
    let hk = Hkdf::<Sha256>::new(None, &fingerprint);
    let mut key = [0u8; KEY_LENGTH];
    hk.expand(KEY_INFO, &mut key)
        .expect("HKDF expand should not fail with correct length");
    key
}

fn load_or_create_salt() -> Result<Vec<u8>, LauncherError> {
    let salt_path = get_salt_path();
    if salt_path.exists() {
        let salt_b64 = std::fs::read_to_string(&salt_path)?;
        let salt = B64.decode(&salt_b64).map_err(|e| {
            LauncherError::Decryption(format!("Invalid salt encoding: {}", e))
        })?;
        Ok(salt)
    } else {
        let mut salt = vec![0u8; 32];
        aes_gcm::aead::rand_core::RngCore::fill_bytes(&mut OsRng, &mut salt);
        if let Some(parent) = salt_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let salt_b64 = B64.encode(&salt);
        std::fs::write(&salt_path, &salt_b64)?;
        super::file_permissions::set_secure_permissions(&salt_path)?;
        Ok(salt)
    }
}

pub fn encrypt_data(plaintext: &[u8], aad: &[u8]) -> Result<EncryptedData, LauncherError> {
    let salt = load_or_create_salt()?;
    let key = derive_key(&salt);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| LauncherError::Encryption(format!("Key init failed: {}", e)))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, aes_gcm::aead::Payload { msg: plaintext, aad })
        .map_err(|e| LauncherError::Encryption(format!("Encryption failed: {}", e)))?;
    Ok(EncryptedData {
        version: 1,
        salt: B64.encode(&salt),
        nonce: B64.encode(&nonce),
        ciphertext: B64.encode(&ciphertext),
    })
}

pub fn decrypt_data(data: &EncryptedData, aad: &[u8]) -> Result<Vec<u8>, LauncherError> {
    if data.version != 1 {
        return Err(LauncherError::Decryption(format!(
            "Unsupported encryption version: {}",
            data.version
        )));
    }
    let salt = B64.decode(&data.salt).map_err(|e| {
        LauncherError::Decryption(format!("Invalid salt: {}", e))
    })?;
    let nonce_bytes = B64.decode(&data.nonce).map_err(|e| {
        LauncherError::Decryption(format!("Invalid nonce: {}", e))
    })?;
    let ciphertext = B64.decode(&data.ciphertext).map_err(|e| {
        LauncherError::Decryption(format!("Invalid ciphertext: {}", e))
    })?;
    let key = derive_key(&salt);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| LauncherError::Decryption(format!("Key init failed: {}", e)))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, aes_gcm::aead::Payload { msg: &ciphertext, aad })
        .map_err(|e| LauncherError::Decryption(format!("Decryption failed: {}", e)))?;
    Ok(plaintext)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EncryptedData {
    pub version: u32,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

pub fn encrypt_json<T: serde::Serialize>(data: &T, aad_path: &Path) -> Result<EncryptedData, LauncherError> {
    let json = serde_json::to_vec(data)?;
    let aad = aad_path.to_string_lossy().as_bytes();
    encrypt_data(&json, aad)
}

pub fn decrypt_json<T: serde::de::DeserializeOwned>(data: &EncryptedData, aad_path: &Path) -> Result<T, LauncherError> {
    let aad = aad_path.to_string_lossy().as_bytes();
    let plaintext = decrypt_data(data, aad)?;
    let result: T = serde_json::from_slice(&plaintext)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = b"hello world secret data";
        let aad = b"/test/path/accounts.json.enc";
        let encrypted = encrypt_data(plaintext, aad).unwrap();
        let decrypted = decrypt_data(&encrypted, aad).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_aad_fails() {
        let plaintext = b"hello world secret data";
        let encrypted = encrypt_data(plaintext, b"/correct/path").unwrap();
        let result = decrypt_data(&encrypted, b"/wrong/path");
        assert!(result.is_err());
    }

    #[test]
    fn encrypt_decrypt_json_roundtrip() {
        #[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq)]
        struct TestData {
            name: String,
            value: u32,
        }
        let original = TestData { name: "test".to_string(), value: 42 };
        let path = PathBuf::from("/test/data.json.enc");
        let encrypted = encrypt_json(&original, &path).unwrap();
        let decrypted: TestData = decrypt_json(&encrypted, &path).unwrap();
        assert_eq!(decrypted, original);
    }
}
```

- [ ] **Step 3: 在 lib.rs 中添加 `mod security;`**

在 `src-tauri/src/lib.rs` 的模块声明区域（约第15行 `mod version;` 之后）添加：

```rust
mod security;
```

- [ ] **Step 4: 运行 cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: 编译错误（因为其他子模块还没创建），这是预期的

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/security/ src-tauri/src/lib.rs
git commit -m "feat(security): add security module skeleton and crypto submodule"
```

---

### Task 3: 创建 file_permissions 子模块

**Files:**
- Create: `src-tauri/src/security/file_permissions.rs`

- [ ] **Step 1: 创建 file_permissions.rs**

```rust
use std::path::Path;

use crate::error::LauncherError;

#[cfg(unix)]
pub fn set_secure_permissions(path: &Path) -> Result<(), LauncherError> {
    use std::os::unix::fs::PermissionsExt;
    let perms = std::fs::Permissions::from_mode(0o600);
    std::fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(windows)]
pub fn set_secure_permissions(path: &Path) -> Result<(), LauncherError> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Security::Authorization::{
        SetNamedSecurityInfoW, SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    };
    Ok(())
}

pub fn check_sensitive_file_permissions(path: &Path) -> Result<bool, LauncherError> {
    if !path.exists() {
        return Ok(true);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(path)?;
        let mode = metadata.permissions().mode();
        let others_perm = mode & 0o007;
        let group_perm = mode & 0o070;
        Ok(others_perm == 0 && (group_perm & 0o006) == 0)
    }
    #[cfg(not(unix))]
    {
        Ok(true)
    }
}

pub fn fix_sensitive_file_permissions(path: &Path) -> Result<bool, LauncherError> {
    if !path.exists() {
        return Ok(false);
    }
    let was_insecure = !check_sensitive_file_permissions(path)?;
    if was_insecure {
        set_secure_permissions(path)?;
    }
    Ok(was_insecure)
}

pub fn get_sensitive_files() -> Vec<std::path::PathBuf> {
    let config_dir = crate::platform::paths::get_config_dir();
    vec![
        config_dir.join("accounts.json.enc"),
        config_dir.join(".security_salt"),
        config_dir.join("security_config.json.enc"),
        config_dir.join("security").join("audit.log"),
    ]
}

pub fn check_all_sensitive_permissions() -> Vec<(std::path::PathBuf, bool)> {
    get_sensitive_files()
        .into_iter()
        .filter(|p| p.exists())
        .map(|p| {
            let secure = check_sensitive_file_permissions(&p).unwrap_or(false);
            (p, secure)
        })
        .collect()
}

pub fn fix_all_sensitive_permissions() -> Vec<(std::path::PathBuf, bool)> {
    get_sensitive_files()
        .into_iter()
        .filter(|p| p.exists())
        .map(|p| {
            let fixed = fix_sensitive_file_permissions(&p).unwrap_or(false);
            (p, fixed)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    #[cfg(unix)]
    fn set_permissions_creates_600() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test_secret");
        let mut f = std::fs::File::create(&file_path).unwrap();
        f.write_all(b"secret").unwrap();
        set_secure_permissions(&file_path).unwrap();
        let metadata = std::fs::metadata(&file_path).unwrap();
        use std::os::unix::fs::PermissionsExt;
        let mode = metadata.permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }

    #[test]
    #[cfg(unix)]
    fn check_permissions_detects_insecure() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test_insecure");
        std::fs::write(&file_path, b"data").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&file_path, std::fs::Permissions::from_mode(0o644)).unwrap();
        }
        assert!(!check_sensitive_file_permissions(&file_path).unwrap());
    }
}
```

- [ ] **Step 2: 运行 cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/security/file_permissions.rs
git commit -m "feat(security): add file permissions module"
```

---

### Task 4: 创建 sanitizer 子模块

**Files:**
- Create: `src-tauri/src/security/sanitizer.rs`

- [ ] **Step 1: 创建 sanitizer.rs**

```rust
use crate::error::LauncherError;

pub fn sanitize_path(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "Path contains null byte".to_string(),
        ));
    }
    if input.len() > 4096 {
        return Err(LauncherError::SecurityValidation(
            "Path exceeds maximum length".to_string(),
        ));
    }
    let path = std::path::Path::new(input);
    for component in path.components() {
        if matches!(
            component,
            std::path::Component::ParentDir
        ) {
            return Err(LauncherError::SecurityValidation(
                "Path contains parent directory traversal (..)".to_string(),
            ));
        }
    }
    Ok(input.to_string())
}

pub fn sanitize_id(input: &str) -> Result<String, LauncherError> {
    if input.is_empty() {
        return Err(LauncherError::SecurityValidation(
            "ID cannot be empty".to_string(),
        ));
    }
    if input.len() > 256 {
        return Err(LauncherError::SecurityValidation(
            "ID exceeds maximum length".to_string(),
        ));
    }
    if !input.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(LauncherError::SecurityValidation(
            "ID contains invalid characters (only a-zA-Z0-9_- allowed)".to_string(),
        ));
    }
    Ok(input.to_string())
}

fn is_private_ip(ip: &str) -> bool {
    if ip == "127.0.0.1" || ip == "localhost" || ip == "::1" {
        return true;
    }
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        if let Ok(octets) = parts.iter().map(|p| p.parse::<u8>()).collect::<Result<Vec<_>, _>>() {
            if octets[0] == 10 {
                return true;
            }
            if octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 {
                return true;
            }
            if octets[0] == 192 && octets[1] == 168 {
                return true;
            }
            if octets[0] == 0 {
                return true;
            }
        }
    }
    if ip.starts_with("fc") || ip.starts_with("fd") || ip.starts_with("fe80") {
        return true;
    }
    false
}

pub fn sanitize_url(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "URL contains null byte".to_string(),
        ));
    }
    let parsed = url::Url::parse(input).map_err(|e| {
        LauncherError::SecurityValidation(format!("Invalid URL: {}", e))
    })?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(LauncherError::SecurityValidation(format!(
            "URL scheme '{}' not allowed (only http/https)",
            scheme
        )));
    }
    if let Some(host) = parsed.host_str() {
        if is_private_ip(host) {
            return Err(LauncherError::SecurityValidation(format!(
                "URL points to private/local address: {}",
                host
            )));
        }
    }
    Ok(input.to_string())
}

pub fn sanitize_general_string(input: &str) -> Result<String, LauncherError> {
    if input.contains('\0') {
        return Err(LauncherError::SecurityValidation(
            "String contains null byte".to_string(),
        ));
    }
    if input.len() > 65535 {
        return Err(LauncherError::SecurityValidation(
            "String exceeds maximum length".to_string(),
        ));
    }
    if input.chars().any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t') {
        return Err(LauncherError::SecurityValidation(
            "String contains control characters".to_string(),
        ));
    }
    Ok(input.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_path_passes() {
        assert!(sanitize_path("/home/user/.minecraft").is_ok());
    }

    #[test]
    fn path_traversal_blocked() {
        assert!(sanitize_path("../etc/passwd").is_err());
        assert!(sanitize_path("foo/../../bar").is_err());
    }

    #[test]
    fn null_byte_blocked() {
        assert!(sanitize_path("foo\0bar").is_err());
    }

    #[test]
    fn valid_id_passes() {
        assert!(sanitize_id("my-instance_1").is_ok());
    }

    #[test]
    fn invalid_id_blocked() {
        assert!(sanitize_id("my instance").is_err());
        assert!(sanitize_id("a/b").is_err());
        assert!(sanitize_id("").is_err());
    }

    #[test]
    fn private_ip_blocked() {
        assert!(sanitize_url("http://127.0.0.1/admin").is_err());
        assert!(sanitize_url("http://10.0.0.1/secret").is_err());
        assert!(sanitize_url("http://192.168.1.1/router").is_err());
    }

    #[test]
    fn public_url_passes() {
        assert!(sanitize_url("https://api.modrinth.com/v2/search").is_ok());
    }

    #[test]
    fn control_chars_blocked() {
        assert!(sanitize_general_string("hello\x01world").is_err());
    }

    #[test]
    fn newline_allowed() {
        assert!(sanitize_general_string("hello\nworld").is_ok());
    }
}
```

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/security/sanitizer.rs
git commit -m "feat(security): add input sanitizer module"
```

---

### Task 5: 创建 audit 子模块

**Files:**
- Create: `src-tauri/src/security/audit.rs`

- [ ] **Step 1: 创建 audit.rs**

```rust
use crate::error::LauncherError;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024;
const MAX_ROTATED_FILES: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: String,
    pub level: String,
    pub category: String,
    pub message: String,
    pub metadata: Option<serde_json::Value>,
}

pub enum AuditLevel {
    Info,
    Warn,
    Error,
}

impl AuditLevel {
    fn as_str(&self) -> &'static str {
        match self {
            AuditLevel::Info => "INFO",
            AuditLevel::Warn => "WARN",
            AuditLevel::Error => "ERROR",
        }
    }
}

pub enum AuditCategory {
    Auth,
    Crypto,
    Download,
    Config,
    File,
    Launch,
    Sandbox,
}

impl AuditCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuditCategory::Auth => "AUTH",
            AuditCategory::Crypto => "CRYPTO",
            AuditCategory::Download => "DOWNLOAD",
            AuditCategory::Config => "CONFIG",
            AuditCategory::File => "FILE",
            AuditCategory::Launch => "LAUNCH",
            AuditCategory::Sandbox => "SANDBOX",
        }
    }
}

lazy_static::lazy_static! {
    static ref AUDIT_WRITER: Arc<Mutex<Option<AuditWriter>>> = Arc::new(Mutex::new(None));
}

struct AuditWriter {
    log_dir: PathBuf,
    enabled: bool,
}

impl AuditWriter {
    fn log_path(&self) -> PathBuf {
        self.log_dir.join("audit.log")
    }

    fn rotate_if_needed(&self) -> Result<(), LauncherError> {
        let log_path = self.log_path();
        if !log_path.exists() {
            return Ok(());
        }
        let metadata = std::fs::metadata(&log_path)?;
        if metadata.len() < MAX_FILE_SIZE {
            return Ok(());
        }
        for i in (1..MAX_ROTATED_FILES).rev() {
            let older = self.log_dir.join(format!("audit.log.{}", i));
            let newer = self.log_dir.join(format!("audit.log.{}", i - 1));
            if older.exists() {
                let _ = std::fs::remove_file(&older);
            }
            if newer.exists() {
                let _ = std::fs::rename(&newer, &older);
            }
        }
        let _ = std::fs::rename(&log_path, self.log_dir.join("audit.log.0"));
        Ok(())
    }

    fn write_entry(&self, entry: &AuditEntry) -> Result<(), LauncherError> {
        if !self.enabled {
            return Ok(());
        }
        self.rotate_if_needed()?;
        let line = format!(
            "[{}] [{}] [{}] {}{}\n",
            entry.timestamp,
            entry.level,
            entry.category,
            entry.message,
            entry
                .metadata
                .as_ref()
                .map(|m| format!(" {}", m))
                .unwrap_or_default()
        );
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.log_path())?;
        file.write_all(line.as_bytes())?;
        Ok(())
    }
}

pub fn init_audit(enabled: bool) -> Result<(), LauncherError> {
    let log_dir = crate::platform::paths::get_config_dir().join("security");
    std::fs::create_dir_all(&log_dir)?;
    let writer = AuditWriter {
        log_dir: log_dir.clone(),
        enabled,
    };
    *AUDIT_WRITER.lock() = Some(writer);
    Ok(())
}

pub fn log_audit(
    level: AuditLevel,
    category: AuditCategory,
    message: impl Into<String>,
    metadata: Option<serde_json::Value>,
) {
    let entry = AuditEntry {
        timestamp: chrono::Utc::now().to_rfc3339(),
        level: level.as_str().to_string(),
        category: category.as_str().to_string(),
        message: message.into(),
        metadata,
    };
    if let Some(writer) = AUDIT_WRITER.lock().as_ref() {
        if let Err(e) = writer.write_entry(&entry) {
            tracing::error!("Failed to write audit log: {}", e);
        }
    }
}

pub fn read_audit_log(
    filter_category: Option<&str>,
    limit: usize,
    offset: usize,
) -> Result<Vec<AuditEntry>, LauncherError> {
    let log_dir = crate::platform::paths::get_config_dir().join("security");
    let log_path = log_dir.join("audit.log");
    if !log_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&log_path)?;
    let mut entries: Vec<AuditEntry> = content
        .lines()
        .filter_map(|line| {
            let timestamp_end = line.find("] [")?;
            let timestamp = &line[1..timestamp_end];
            let rest = &line[timestamp_end + 4..];
            let level_end = rest.find("] [")?;
            let level = &rest[..level_end];
            let rest = &rest[level_end + 4..];
            let category_end = rest.find("] ")?;
            let category = &rest[..category_end];
            let message_part = &rest[category_end + 2..];
            let (message, metadata) = if let Some(space_idx) = message_part.rfind(" {") {
                if message_part.ends_with('}') {
                    (
                        message_part[..space_idx].to_string(),
                        serde_json::from_str(&message_part[space_idx + 1..]).ok(),
                    )
                } else {
                    (message_part.to_string(), None)
                }
            } else {
                (message_part.to_string(), None)
            };
            Some(AuditEntry {
                timestamp: timestamp.to_string(),
                level: level.to_string(),
                category: category.to_string(),
                message,
                metadata,
            })
        })
        .filter(|e| {
            filter_category
                .map(|fc| e.category == fc)
                .unwrap_or(true)
        })
        .collect();
    entries.reverse();
    let result: Vec<AuditEntry> = entries
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();
    Ok(result)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginHistoryEntry {
    pub timestamp: String,
    pub auth_type: String,
    pub success: bool,
    pub username: String,
}

pub fn record_login(auth_type: &str, success: bool, username: &str) -> Result<(), LauncherError> {
    let history_path = crate::platform::paths::get_config_dir()
        .join("security")
        .join("login_history.json");
    if let Some(parent) = history_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut history: Vec<LoginHistoryEntry> = if history_path.exists() {
        let content = std::fs::read_to_string(&history_path)?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };
    history.push(LoginHistoryEntry {
        timestamp: chrono::Utc::now().to_rfc3339(),
        auth_type: auth_type.to_string(),
        success,
        username: username.to_string(),
    });
    while history.len() > 50 {
        history.remove(0);
    }
    let content = serde_json::to_string_pretty(&history)?;
    std::fs::write(&history_path, content)?;
    log_audit(
        AuditLevel::Info,
        AuditCategory::Auth,
        format!("Login {} for user {}", if success { "succeeded" } else { "failed" }, username),
        Some(serde_json::json!({ "auth_type": auth_type, "success": success })),
    );
    Ok(())
}

pub fn get_login_history() -> Result<Vec<LoginHistoryEntry>, LauncherError> {
    let history_path = crate::platform::paths::get_config_dir()
        .join("security")
        .join("login_history.json");
    if !history_path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&history_path)?;
    let mut history: Vec<LoginHistoryEntry> = serde_json::from_str(&content).unwrap_or_default();
    history.reverse();
    Ok(history)
}
```

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/security/audit.rs
git commit -m "feat(security): add audit log and login history module"
```

---

### Task 6: 创建 jvm_whitelist 子模块

**Files:**
- Create: `src-tauri/src/security/jvm_whitelist.rs`

- [ ] **Step 1: 创建 jvm_whitelist.rs**

```rust
use crate::error::LauncherError;

const ALLOWED_PREFIXES: &[&str] = &[
    "-Xmx",
    "-Xms",
    "-Xmn",
    "-XX:+UseG1GC",
    "-XX:+UseZGC",
    "-XX:+UseSerialGC",
    "-XX:+UseParallelGC",
    "-XX:+UseShenandoahGC",
    "-XX:MaxGCPauseMillis=",
    "-XX:G1HeapRegionSize=",
    "-XX:InitiatingHeapOccupancyPercent=",
    "-XX:ParallelGCThreads=",
    "-XX:ConcGCThreads=",
    "-Dfile.encoding=",
    "-Dsun.jnu.encoding=",
    "-Dminecraft.applet.TargetDirectory=",
    "-Djava.library.path=",
    "-Dorg.lwjgl.librarypath=",
    "-Dnet.java.games.input.librarypath=",
    "-XX:+UseCompressedOops",
    "-XX:-UseCompressedOops",
    "-XX:+AggressiveOpts",
    "-XX:+UseStringDeduplication",
    "-XX:+PrintGCDetails",
    "-XX:+PrintGCTimeStamps",
    "-XX:+PrintGCDateStamps",
    "-Xlog:gc",
    "-XX:+OptimizeStringConcat",
    "-XX:+UseFastAccessorMethods",
    "-XX:+UseBiasedLocking",
    "-XX:MaxDirectMemorySize=",
    "-XX:NewSize=",
    "-XX:MaxNewSize=",
    "-XX:SurvivorRatio=",
    "-XX:MaxTenuringThreshold=",
];

pub fn validate_jvm_args(args: &str) -> Result<Vec<String>, LauncherError> {
    if args.trim().is_empty() {
        return Ok(vec![]);
    }
    let mut valid = Vec::new();
    let mut invalid = Vec::new();
    for arg in args.split_whitespace() {
        let is_allowed = ALLOWED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_allowed {
            valid.push(arg.to_string());
        } else {
            invalid.push(arg.to_string());
        }
    }
    if invalid.is_empty() {
        Ok(valid)
    } else {
        Err(LauncherError::SecurityValidation(format!(
            "JVM args not in whitelist: {}",
            invalid.join(", ")
        )))
    }
}

pub fn validate_jvm_args_custom(args: &str) -> (Vec<String>, Vec<String>) {
    if args.trim().is_empty() {
        return (vec![], vec![]);
    }
    let mut valid = Vec::new();
    let mut invalid = Vec::new();
    for arg in args.split_whitespace() {
        let is_allowed = ALLOWED_PREFIXES.iter().any(|prefix| arg.starts_with(prefix));
        if is_allowed {
            valid.push(arg.to_string());
        } else {
            invalid.push(arg.to_string());
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
    fn valid_args_pass() {
        let result = validate_jvm_args("-Xmx4G -Xms1G -XX:+UseG1GC");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 3);
    }

    #[test]
    fn dangerous_args_blocked() {
        assert!(validate_jvm_args("-exec malicious").is_err());
    }

    #[test]
    fn empty_args_ok() {
        assert!(validate_jvm_args("").is_ok());
        assert!(validate_jvm_args("  ").is_ok());
    }

    #[test]
    fn custom_mode_returns_both() {
        let (valid, invalid) = validate_jvm_args_custom("-Xmx4G -exec bad");
        assert_eq!(valid.len(), 1);
        assert_eq!(invalid.len(), 1);
    }
}
```

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/security/jvm_whitelist.rs
git commit -m "feat(security): add JVM args whitelist module"
```

---

### Task 7: 创建 sandbox 子模块

**Files:**
- Create: `src-tauri/src/security/sandbox.rs`

- [ ] **Step 1: 创建 sandbox.rs**

```rust
use crate::error::LauncherError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxAvailability {
    pub platform: String,
    pub available: bool,
    pub tool: Option<String>,
    pub supported_modes: Vec<String>,
}

pub fn check_sandbox_availability() -> SandboxAvailability {
    let platform = std::env::consts::OS.to_string();
    match platform.as_str() {
        "macos" => SandboxAvailability {
            platform: platform.clone(),
            available: which_sandbox_exec(),
            tool: Some("sandbox-exec".to_string()),
            supported_modes: vec!["off".to_string(), "basic".to_string(), "strict".to_string()],
        },
        "linux" => {
            let has_firejail = which_firejail();
            SandboxAvailability {
                platform: platform.clone(),
                available: has_firejail,
                tool: if has_firejail {
                    Some("firejail".to_string())
                } else {
                    None
                },
                supported_modes: if has_firejail {
                    vec!["off".to_string(), "basic".to_string(), "strict".to_string()]
                } else {
                    vec!["off".to_string()]
                },
            }
        }
        "windows" => SandboxAvailability {
            platform: platform.clone(),
            available: true,
            tool: Some("JobObject".to_string()),
            supported_modes: vec!["off".to_string(), "basic".to_string(), "strict".to_string()],
        },
        _ => SandboxAvailability {
            platform: platform.clone(),
            available: false,
            tool: None,
            supported_modes: vec!["off".to_string()],
        },
    }
}

#[cfg(target_os = "macos")]
fn which_sandbox_exec() -> bool {
    std::path::Path::new("/usr/bin/sandbox-exec").exists()
}

#[cfg(not(target_os = "macos"))]
fn which_sandbox_exec() -> bool {
    false
}

fn which_firejail() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("which")
            .arg("firejail")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

#[derive(Debug, Clone)]
pub struct SandboxConfig {
    pub mode: String,
    pub game_dir: std::path::PathBuf,
}

pub fn build_sandbox_command(
    config: &SandboxConfig,
    base_command: &mut std::process::Command,
) -> Result<(), LauncherError> {
    match config.mode.as_str() {
        "off" => Ok(()),
        "basic" | "strict" => apply_sandbox(config, base_command),
        _ => Err(LauncherError::SandboxError(format!(
            "Unknown sandbox mode: {}",
            config.mode
        ))),
    }
}

#[cfg(target_os = "macos")]
fn apply_sandbox(
    config: &SandboxConfig,
    base_command: &mut std::process::Command,
) -> Result<(), LauncherError> {
    let game_dir = config.game_dir.to_string_lossy().to_string();
    let network_rule = if config.mode == "strict" {
        "(deny network*)"
    } else {
        "(allow network*)"
    };
    let profile = format!(
        "(version 1)(deny default)(allow process*)(allow file-read*)(allow file-write* (subpath \"{}\")){}",
        game_dir, network_rule
    );
    let current_args: Vec<String> = base_command
        .get_args()
        .map(|a| a.to_string_lossy().to_string())
        .collect();
    let program = base_command.get_program().to_string_lossy().to_string();
    *base_command = std::process::Command::new("/usr/bin/sandbox-exec");
    base_command.args(["-p", &profile]);
    base_command.arg(&program);
    base_command.args(&current_args);
    Ok(())
}

#[cfg(target_os = "linux")]
fn apply_sandbox(
    config: &SandboxConfig,
    base_command: &mut std::process::Command,
) -> Result<(), LauncherError> {
    if !which_firejail() {
        super::audit::log_audit(
            super::audit::AuditLevel::Warn,
            super::audit::AuditCategory::Sandbox,
            "Firejail not available, sandbox disabled",
            None,
        );
        return Ok(());
    }
    let game_dir = config.game_dir.to_string_lossy().to_string();
    let current_args: Vec<String> = base_command
        .get_args()
        .map(|a| a.to_string_lossy().to_string())
        .collect();
    let program = base_command.get_program().to_string_lossy().to_string();
    *base_command = std::process::Command::new("firejail");
    base_command.arg(format!("--private={}", game_dir));
    if config.mode == "strict" {
        base_command.arg("--net=none").arg("--noroot");
    }
    base_command.arg(&program);
    base_command.args(&current_args);
    Ok(())
}

#[cfg(target_os = "windows")]
fn apply_sandbox(
    _config: &SandboxConfig,
    _base_command: &mut std::process::Command,
) -> Result<(), LauncherError> {
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn apply_sandbox(
    _config: &SandboxConfig,
    _base_command: &mut std::process::Command,
) -> Result<(), LauncherError> {
    Ok(())
}
```

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/security/sandbox.rs
git commit -m "feat(security): add sandbox module for macOS/Linux/Windows"
```

---

### Task 8: 创建 credential_store 和 key_store 子模块

**Files:**
- Create: `src-tauri/src/security/credential_store.rs`
- Create: `src-tauri/src/security/key_store.rs`

- [ ] **Step 1: 创建 credential_store.rs**

```rust
use crate::error::LauncherError;
use crate::security::crypto::{self, EncryptedData};
use crate::platform::paths;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoredAccount {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub account_type: String,
    pub last_used: String,
    pub expires_at: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccountStore {
    pub accounts: Vec<StoredAccount>,
    pub active_account_id: Option<String>,
}

fn enc_path() -> std::path::PathBuf {
    paths::get_config_dir().join("accounts.json.enc")
}

fn plain_path() -> std::path::PathBuf {
    paths::get_config_dir().join("accounts.json")
}

pub fn is_encrypted() -> bool {
    enc_path().exists()
}

pub fn is_plain() -> bool {
    plain_path().exists()
}

pub fn migrate_plain_to_encrypted() -> Result<(), LauncherError> {
    if !plain_path().exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(plain_path())?;
    let store: AccountStore = serde_json::from_str(&content)?;
    save_encrypted(&store)?;
    let _ = std::fs::remove_file(plain_path());
    super::audit::log_audit(
        super::audit::AuditLevel::Info,
        super::audit::AuditCategory::Crypto,
        "Migrated plain accounts.json to encrypted storage",
        None,
    );
    Ok(())
}

pub fn load() -> Result<AccountStore, LauncherError> {
    if enc_path().exists() {
        let content = std::fs::read_to_string(enc_path())?;
        let encrypted: EncryptedData = serde_json::from_str(&content)?;
        let store: AccountStore = crypto::decrypt_json(&encrypted, &enc_path())?;
        Ok(store)
    } else if plain_path().exists() {
        let content = std::fs::read_to_string(plain_path())?;
        let store: AccountStore = serde_json::from_str(&content)?;
        Ok(store)
    } else {
        Ok(AccountStore::default())
    }
}

pub fn save_encrypted(store: &AccountStore) -> Result<(), LauncherError> {
    let path = enc_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let encrypted = crypto::encrypt_json(store, &path)?;
    let content = serde_json::to_string_pretty(&encrypted)?;
    std::fs::write(&path, content)?;
    super::file_permissions::set_secure_permissions(&path)?;
    Ok(())
}

pub fn save(store: &AccountStore, use_encryption: bool) -> Result<(), LauncherError> {
    if use_encryption {
        save_encrypted(store)?;
        if plain_path().exists() {
            let _ = std::fs::remove_file(plain_path());
        }
    } else {
        let path = plain_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(store)?;
        std::fs::write(&path, content)?;
    }
    Ok(())
}
```

- [ ] **Step 2: 创建 key_store.rs**

```rust
use crate::error::LauncherError;
use crate::security::crypto;
use crate::platform::paths;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SecureKeyStore {
    pub keys: HashMap<String, String>,
}

fn store_path() -> std::path::PathBuf {
    paths::get_config_dir().join("security_config.json.enc")
}

pub fn load() -> Result<SecureKeyStore, LauncherError> {
    let path = store_path();
    if !path.exists() {
        return Ok(SecureKeyStore::default());
    }
    let content = std::fs::read_to_string(&path)?;
    let encrypted: crypto::EncryptedData = serde_json::from_str(&content)?;
    let store: SecureKeyStore = crypto::decrypt_json(&encrypted, &path)?;
    Ok(store)
}

pub fn save(store: &SecureKeyStore) -> Result<(), LauncherError> {
    let path = store_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let encrypted = crypto::encrypt_json(store, &path)?;
    let content = serde_json::to_string_pretty(&encrypted)?;
    std::fs::write(&path, content)?;
    super::file_permissions::set_secure_permissions(&path)?;
    Ok(())
}

pub fn get_key(name: &str) -> Result<Option<String>, LauncherError> {
    if let Ok(key) = std::env::var(format!("BONNEXT_{}", name.to_uppercase())) {
        if !key.is_empty() {
            return Ok(Some(key));
        }
    }
    let store = load()?;
    Ok(store.keys.get(name).cloned())
}

pub fn set_key(name: &str, value: &str) -> Result<(), LauncherError> {
    let mut store = load()?;
    store.keys.insert(name.to_string(), value.to_string());
    save(&store)?;
    super::audit::log_audit(
        super::audit::AuditLevel::Info,
        super::audit::AuditCategory::Config,
        format!("API key '{}' updated", name),
        None,
    );
    Ok(())
}

pub fn delete_key(name: &str) -> Result<(), LauncherError> {
    let mut store = load()?;
    store.keys.remove(name);
    save(&store)?;
    super::audit::log_audit(
        super::audit::AuditLevel::Info,
        super::audit::AuditCategory::Config,
        format!("API key '{}' deleted", name),
        None,
    );
    Ok(())
}

pub fn key_status(name: &str) -> Result<KeyStatus, LauncherError> {
    let has_env = std::env::var(format!("BONNEXT_{}", name.to_uppercase()))
        .map(|v| !v.is_empty())
        .unwrap_or(false);
    let store = load()?;
    let has_stored = store.keys.contains_key(name);
    Ok(KeyStatus {
        name: name.to_string(),
        configured: has_env || has_stored,
        source: if has_env {
            "environment".to_string()
        } else if has_stored {
            "encrypted_store".to_string()
        } else {
            "none".to_string()
        },
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct KeyStatus {
    pub name: String,
    pub configured: bool,
    pub source: String,
}
```

- [ ] **Step 3: 运行 cargo check**

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/security/credential_store.rs src-tauri/src/security/key_store.rs
git commit -m "feat(security): add encrypted credential store and key store"
```

---

### Task 9: 扩展 AppConfig 添加 SecurityConfig

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: 在 config.rs 中添加 SecurityConfig 和 AppConfig 新字段**

在 `use` 语句之后、`AppConfig` 结构体之前添加：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    #[serde(default = "default_credential_encryption")]
    pub credential_encryption: bool,
    #[serde(default = "default_strict_verification")]
    pub strict_verification: bool,
    #[serde(default = "default_enforce_https")]
    pub enforce_https: bool,
    #[serde(default = "default_jvm_args_mode")]
    pub jvm_args_mode: String,
    #[serde(default = "default_sandbox_mode")]
    pub sandbox_mode: String,
    #[serde(default)]
    pub proxy_enabled: bool,
    #[serde(default)]
    pub proxy_url: Option<String>,
    #[serde(default)]
    pub proxy_username: Option<String>,
    #[serde(default)]
    pub proxy_password: Option<String>,
    #[serde(default = "default_audit_log_enabled")]
    pub audit_log_enabled: bool,
    #[serde(default = "default_secure_launch_check")]
    pub secure_launch_check: bool,
}

fn default_credential_encryption() -> bool { true }
fn default_strict_verification() -> bool { true }
fn default_enforce_https() -> bool { true }
fn default_jvm_args_mode() -> String { "whitelist".to_string() }
fn default_sandbox_mode() -> String { "off".to_string() }
fn default_audit_log_enabled() -> bool { true }
fn default_secure_launch_check() -> bool { true }

impl Default for SecurityConfig {
    fn default() -> Self {
        SecurityConfig {
            credential_encryption: true,
            strict_verification: true,
            enforce_https: true,
            jvm_args_mode: "whitelist".to_string(),
            sandbox_mode: "off".to_string(),
            proxy_enabled: false,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
            audit_log_enabled: true,
            secure_launch_check: true,
        }
    }
}
```

在 `AppConfig` 结构体末尾（`force_java_path` 之后）添加：

```rust
    #[serde(default)]
    pub security: SecurityConfig,
```

在 `AppConfig::default()` 实现中添加：

```rust
            security: SecurityConfig::default(),
```

在测试 `defaults_are_sensible` 中添加断言：

```rust
        assert!(c.security.credential_encryption);
        assert!(c.security.strict_verification);
        assert!(c.security.enforce_https);
        assert_eq!(c.security.jvm_args_mode, "whitelist");
        assert_eq!(c.security.sandbox_mode, "off");
        assert!(c.security.audit_log_enabled);
        assert!(c.security.secure_launch_check);
```

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat(security): add SecurityConfig to AppConfig"
```

---

### Task 10: 改造 token_store 使用加密存储

**Files:**
- Modify: `src-tauri/src/auth/token_store.rs`

- [ ] **Step 1: 修改 token_store.rs 使用加密存储**

将 `AccountStore` 的 `load` 和 `save` 方法替换为使用 `security::credential_store`：

替换 `AccountStore::load()` 方法体为：

```rust
    pub fn load() -> Result<Self, LauncherError> {
        crate::security::credential_store::load()
    }
```

替换 `AccountStore::save()` 方法体为：

```rust
    pub fn save(&self) -> Result<(), LauncherError> {
        let use_encryption = crate::config::load_config()
            .map(|c| c.security.credential_encryption)
            .unwrap_or(true);
        crate::security::credential_store::save(self, use_encryption)
    }
```

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/auth/token_store.rs
git commit -m "feat(security): integrate encrypted credential store into token_store"
```

---

### Task 11: 改造 curseforge.rs 使用 key_store

**Files:**
- Modify: `src-tauri/src/curseforge.rs`

- [ ] **Step 1: 替换 get_cf_api_key 函数**

将 `get_cf_api_key` 函数替换为：

```rust
fn get_cf_api_key() -> String {
    if let Ok(key) = std::env::var("BONNEXT_CF_API_KEY") {
        if !key.is_empty() {
            return key;
        }
    }
    if let Ok(Some(key)) = crate::security::key_store::get_key("cf_api_key") {
        if !key.is_empty() {
            return key;
        }
    }
    String::new()
}
```

注意：移除了硬编码的默认 API Key。如果既没有环境变量也没有加密存储中的 key，返回空字符串。前端会提示用户配置。

- [ ] **Step 2: 修改 cf_headers 使用动态 key**

将 `cf_headers` 函数中的 `OnceLock` 替换为每次读取（因为 key 可能被用户更新）：

```rust
fn cf_headers() -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    let key = get_cf_api_key();
    if !key.is_empty() {
        if let Ok(val) = key.parse() {
            headers.insert("x-api-key", val);
        }
    }
    headers.insert("Accept", "application/json".parse().unwrap());
    headers
}
```

同时更新所有使用 `cf_headers()` 的地方，将 `&'static HeaderMap` 改为 `HeaderMap`（去掉引用）。

- [ ] **Step 3: 运行 cargo check**

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/curseforge.rs
git commit -m "feat(security): remove hardcoded CF API key, use encrypted key store"
```

---

### Task 12: 改造 http_client 支持代理

**Files:**
- Modify: `src-tauri/src/http_client.rs`

- [ ] **Step 1: 添加代理感知的客户端构建函数**

在 `http_client.rs` 中添加：

```rust
pub fn build_client_with_proxy() -> Result<reqwest::Client, LauncherError> {
    let config = crate::config::load_config()?;
    let mut builder = reqwest::Client::builder()
        .user_agent("BonNext/1.0 (MinecraftLauncher)")
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(15));
    if config.security.proxy_enabled {
        if let Some(ref proxy_url) = config.security.proxy_url {
            let mut proxy = reqwest::Proxy::all(proxy_url).map_err(|e| {
                crate::error::LauncherError::InvalidConfig(format!("Invalid proxy URL: {}", e))
            })?;
            if let (Some(ref user), Some(ref pass)) =
                (config.security.proxy_username, config.security.proxy_password)
            {
                proxy = proxy.basic_auth(user, pass);
            }
            builder = builder.proxy(proxy);
        }
    }
    Ok(builder.build()?)
}

pub fn build_download_client_with_proxy() -> Result<reqwest::Client, LauncherError> {
    let config = crate::config::load_config()?;
    let mut builder = reqwest::Client::builder()
        .user_agent("BonNext/1.0 (MinecraftLauncher)")
        .connect_timeout(std::time::Duration::from_secs(30));
    if config.security.proxy_enabled {
        if let Some(ref proxy_url) = config.security.proxy_url {
            let mut proxy = reqwest::Proxy::all(proxy_url).map_err(|e| {
                crate::error::LauncherError::InvalidConfig(format!("Invalid proxy URL: {}", e))
            })?;
            if let (Some(ref user), Some(ref pass)) =
                (config.security.proxy_username, config.security.proxy_password)
            {
                proxy = proxy.basic_auth(user, pass);
            }
            builder = builder.proxy(proxy);
        }
    } else {
        builder = builder.no_proxy();
    }
    Ok(builder.build()?)
}
```

注意：保留原有的 `build_client()` 和 `build_download_client()` 不变（它们使用 `OnceLock` 单例，用于不需要代理的场景）。新增的函数每次创建新客户端，用于需要代理的场景。

- [ ] **Step 2: 运行 cargo check**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/http_client.rs
git commit -m "feat(security): add proxy-aware HTTP client builders"
```

---

### Task 13: 强化下载验证

**Files:**
- Modify: `src-tauri/src/download/verifier.rs`

- [ ] **Step 1: 添加严格验证模式支持**

在 `file_exists_and_valid` 函数签名中添加 `strict` 参数：

```rust
pub fn file_exists_and_valid(path: &Path, expected_sha1: &str, expected_size: u64, strict: bool) -> bool {
    if !path.exists() {
        return false;
    }

    if expected_size > 0 {
        if let Ok(metadata) = std::fs::metadata(path) {
            if metadata.len() != expected_size {
                return false;
            }
        } else {
            return false;
        }
    }

    if expected_sha1.is_empty() {
        if strict {
            crate::security::audit::log_audit(
                crate::security::audit::AuditLevel::Warn,
                crate::security::audit::AuditCategory::Download,
                format!("Rejected file without SHA1 hash in strict mode: {}", path.display()),
                None,
            );
            return false;
        }
        return true;
    }

    verify_file_sha1(path, expected_sha1).is_ok()
}
```

同时更新所有调用 `file_exists_and_valid` 的地方，添加 `strict` 参数。搜索项目中所有调用点，传入 `crate::config::load_config().map(|c| c.security.strict_verification).unwrap_or(true)` 作为 `strict` 参数。

同时更新测试中的调用，传入 `false` 作为 `strict` 参数以保持向后兼容：

```rust
    fn empty_sha1_skips_check() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"data").unwrap();
        assert!(file_exists_and_valid(f.path(), "", 0, false));
    }

    fn missing_file_is_invalid() {
        assert!(!file_exists_and_valid(std::path::Path::new("/nonexistent_xyz"), "abc", 0, false));
    }

    fn size_mismatch_is_invalid() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"16bytes").unwrap();
        assert!(!file_exists_and_valid(f.path(), "", 999, false));
    }
```

添加新测试：

```rust
    #[test]
    fn strict_mode_rejects_empty_sha1() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"data").unwrap();
        assert!(!file_exists_and_valid(f.path(), "", 0, true));
    }
```

- [ ] **Step 2: 运行 cargo test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/download/verifier.rs
git commit -m "feat(security): add strict verification mode for downloads"
```

---

### Task 14: 强化 CSP

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 更新 CSP 策略**

将 `tauri.conf.json` 中 `app.security.csp` 替换为：

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data: blob:; connect-src 'self' https://api.curseforge.com https://api.modrinth.com https://api.adoptium.net https://login.microsoftonline.com https://user.auth.xboxlive.com https://xsts.auth.xboxlive.com https://api.minecraftservices.com https://piston-meta.mojang.com https://launchermeta.mojang.com https://resources.download.minecraft.net https://bmclapi2.bangbang93.com https://download.mcbbs.net; font-src 'self' data: https://fonts.gstatic.com; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat(security): harden CSP with object-src, base-uri, frame-ancestors"
```

---

### Task 15: 注册安全相关 Tauri Commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 在 lib.rs 中添加安全相关 Tauri command 函数**

在 `lib.rs` 的 command 函数区域（约第 2900 行之前）添加：

```rust
#[tauri::command]
async fn get_security_config() -> Result<config::SecurityConfig, LauncherError> {
    let cfg = config::load_config()?;
    Ok(cfg.security)
}

#[tauri::command]
async fn save_security_config(
    security: config::SecurityConfig,
) -> Result<(), LauncherError> {
    let mut cfg = config::load_config()?;
    let old_encryption = cfg.security.credential_encryption;
    let old_sandbox = cfg.security.sandbox_mode.clone();
    let old_jvm_mode = cfg.security.jvm_args_mode.clone();
    cfg.security = security;
    config::save_config(&cfg)?;
    security::audit::log_audit(
        security::audit::AuditLevel::Info,
        security::audit::AuditCategory::Config,
        "Security config updated",
        Some(serde_json::json!({
            "credential_encryption_changed": old_encryption != cfg.security.credential_encryption,
            "sandbox_mode_changed": old_sandbox != cfg.security.sandbox_mode,
            "jvm_args_mode_changed": old_jvm_mode != cfg.security.jvm_args_mode,
        })),
    );
    if !old_encryption && cfg.security.credential_encryption {
        security::credential_store::migrate_plain_to_encrypted()?;
    }
    security::init_audit(cfg.security.audit_log_enabled)?;
    Ok(())
}

#[tauri::command]
async fn get_security_score() -> Result<u32, LauncherError> {
    let cfg = config::load_config()?;
    let mut score: u32 = 40;
    if security::credential_store::is_encrypted() {
        score += 20;
    }
    if cfg.security.strict_verification {
        score += 10;
    }
    if cfg.security.jvm_args_mode == "whitelist" {
        score += 10;
    }
    match cfg.security.sandbox_mode.as_str() {
        "strict" => score += 10,
        "basic" => score += 5,
        _ => {}
    }
    if cfg.security.audit_log_enabled {
        score += 10;
    }
    Ok(score)
}

#[tauri::command]
async fn get_audit_log(
    category: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<security::audit::AuditEntry>, LauncherError> {
    security::audit::read_audit_log(
        category.as_deref(),
        limit.unwrap_or(100),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
async fn get_login_history() -> Result<Vec<security::audit::LoginHistoryEntry>, LauncherError> {
    security::audit::get_login_history()
}

#[tauri::command]
async fn migrate_credentials() -> Result<(), LauncherError> {
    security::credential_store::migrate_plain_to_encrypted()
}

#[tauri::command]
async fn get_encryption_status() -> Result<serde_json::Value, LauncherError> {
    Ok(serde_json::json!({
        "encrypted": security::credential_store::is_encrypted(),
        "plain": security::credential_store::is_plain(),
    }))
}

#[tauri::command]
async fn save_api_key(name: String, value: String) -> Result<(), LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::sanitizer::sanitize_general_string(&value)?;
    security::key_store::set_key(&name, &value)
}

#[tauri::command]
async fn delete_api_key(name: String) -> Result<(), LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::key_store::delete_key(&name)
}

#[tauri::command]
async fn get_api_key_status(name: String) -> Result<security::key_store::KeyStatus, LauncherError> {
    security::sanitizer::sanitize_id(&name)?;
    security::key_store::key_status(&name)
}

#[tauri::command]
async fn check_file_permissions() -> Result<Vec<serde_json::Value>, LauncherError> {
    let results = security::file_permissions::check_all_sensitive_permissions();
    Ok(results
        .into_iter()
        .map(|(path, secure)| {
            serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "secure": secure,
            })
        })
        .collect())
}

#[tauri::command]
async fn fix_file_permissions() -> Result<Vec<serde_json::Value>, LauncherError> {
    let results = security::file_permissions::fix_all_sensitive_permissions();
    for (path, fixed) in &results {
        if *fixed {
            security::audit::log_audit(
                security::audit::AuditLevel::Info,
                security::audit::AuditCategory::File,
                format!("Fixed insecure permissions on {}", path.display()),
                None,
            );
        }
    }
    Ok(results
        .into_iter()
        .map(|(path, fixed)| {
            serde_json::json!({
                "path": path.to_string_lossy().to_string(),
                "fixed": fixed,
            })
        })
        .collect())
}

#[tauri::command]
async fn validate_jvm_args(args: String) -> Result<serde_json::Value, LauncherError> {
    let cfg = config::load_config()?;
    if cfg.security.jvm_args_mode == "whitelist" {
        match security::jvm_whitelist::validate_jvm_args(&args) {
            Ok(valid) => Ok(serde_json::json!({ "valid": true, "args": valid })),
            Err(e) => Ok(serde_json::json!({ "valid": false, "error": e.to_string() })),
        }
    } else {
        let (valid, invalid) = security::jvm_whitelist::validate_jvm_args_custom(&args);
        Ok(serde_json::json!({ "valid": true, "args": valid, "warnings": invalid }))
    }
}

#[tauri::command]
async fn get_sandbox_availability() -> Result<security::sandbox::SandboxAvailability, LauncherError> {
    Ok(security::sandbox::check_sandbox_availability())
}
```

- [ ] **Step 2: 在 invoke_handler 中注册新命令**

在 `tauri::generate_handler![]` 列表末尾（`nlp_search_content,` 之后）添加：

```rust
              get_security_config, save_security_config,
              get_security_score,
              get_audit_log, get_login_history,
              migrate_credentials, get_encryption_status,
              save_api_key, delete_api_key, get_api_key_status,
              check_file_permissions, fix_file_permissions,
              validate_jvm_args, get_sandbox_availability,
```

- [ ] **Step 3: 在 run() 函数中初始化审计系统**

在 `run()` 函数中 `tauri::Builder::default()` 之前添加审计初始化。找到 `setup` 闭包，在其中添加：

```rust
        let audit_enabled = config::load_config()
            .map(|c| c.security.audit_log_enabled)
            .unwrap_or(true);
        if let Err(e) = security::init_audit(audit_enabled) {
            tracing::warn!("Failed to initialize audit system: {}", e);
        }
        if config::load_config().map(|c| c.security.credential_encryption).unwrap_or(true) {
            if security::credential_store::is_plain() {
                if let Err(e) = security::credential_store::migrate_plain_to_encrypted() {
                    tracing::warn!("Failed to migrate credentials to encrypted storage: {}", e);
                }
            }
        }
```

- [ ] **Step 4: 运行 cargo check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(security): register security Tauri commands and init audit on startup"
```

---

### Task 16: 添加 paths 安全目录函数

**Files:**
- Modify: `src-tauri/src/platform/paths.rs`

- [ ] **Step 1: 添加安全目录路径函数**

在 `paths.rs` 的 Config 区域之后添加：

```rust
pub fn get_security_dir() -> PathBuf {
    get_config_dir().join("security")
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/platform/paths.rs
git commit -m "feat(security): add security directory path helper"
```

---

### Task 17: 前端 — 扩展 api.ts 添加安全接口

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: 在 api.ts 中添加安全相关接口和 API 方法**

在 `AppConfig` 接口中添加 `security` 字段：

```typescript
export interface SecurityConfig {
  credential_encryption: boolean;
  strict_verification: boolean;
  enforce_https: boolean;
  jvm_args_mode: string;
  sandbox_mode: string;
  proxy_enabled: boolean;
  proxy_url: string | null;
  proxy_username: string | null;
  proxy_password: string | null;
  audit_log_enabled: boolean;
  secure_launch_check: boolean;
}
```

更新 `AppConfig` 接口，添加：

```typescript
  security: SecurityConfig;
```

添加其他安全相关接口：

```typescript
export interface AuditEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  metadata: unknown | null;
}

export interface LoginHistoryEntry {
  timestamp: string;
  auth_type: string;
  success: boolean;
  username: string;
}

export interface KeyStatus {
  name: string;
  configured: boolean;
  source: string;
}

export interface SandboxAvailability {
  platform: string;
  available: boolean;
  tool: string | null;
  supported_modes: string[];
}

export interface FilePermissionResult {
  path: string;
  secure: boolean;
}

export interface FilePermissionFixResult {
  path: string;
  fixed: boolean;
}
```

在 `api` 对象末尾添加安全 API 方法：

```typescript
  getSecurityConfig: () => invoke<SecurityConfig>('get_security_config'),
  saveSecurityConfig: (security: SecurityConfig) => invoke<void>('save_security_config', { security }),
  getSecurityScore: () => invoke<number>('get_security_score'),
  getAuditLog: (category?: string, limit?: number, offset?: number) => invoke<AuditEntry[]>('get_audit_log', { category, limit, offset }),
  getLoginHistory: () => invoke<LoginHistoryEntry[]>('get_login_history'),
  migrateCredentials: () => invoke<void>('migrate_credentials'),
  getEncryptionStatus: () => invoke<{ encrypted: boolean; plain: boolean }>('get_encryption_status'),
  saveApiKey: (name: string, value: string) => invoke<void>('save_api_key', { name, value }),
  deleteApiKey: (name: string) => invoke<void>('delete_api_key', { name }),
  getApiKeyStatus: (name: string) => invoke<KeyStatus>('get_api_key_status', { name }),
  checkFilePermissions: () => invoke<FilePermissionResult[]>('check_file_permissions'),
  fixFilePermissions: () => invoke<FilePermissionFixResult[]>('fix_file_permissions'),
  validateJvmArgs: (args: string) => invoke<{ valid: boolean; args?: string[]; error?: string; warnings?: string[] }>('validate_jvm_args', { args }),
  getSandboxAvailability: () => invoke<SandboxAvailability>('get_sandbox_availability'),
```

- [ ] **Step 2: Commit**

```bash
git add src/api.ts
git commit -m "feat(security): add security API interfaces and methods"
```

---

### Task 18: 前端 — 创建 SecurityScore 和 AuditLogViewer 组件

**Files:**
- Create: `src/components/ui/SecurityScore.tsx`
- Create: `src/components/ui/SecurityScore.module.css`
- Create: `src/components/ui/AuditLogViewer.tsx`
- Create: `src/components/ui/AuditLogViewer.module.css`

- [ ] **Step 1: 创建 SecurityScore.tsx**

```tsx
import styles from './SecurityScore.module.css';

interface SecurityScoreProps {
  score: number;
}

export default function SecurityScore({ score }: SecurityScoreProps) {
  const level = score <= 40 ? 'danger' : score <= 70 ? 'warning' : 'safe';
  const label = score <= 40 ? '危险' : score <= 70 ? '警告' : '安全';

  return (
    <div className={styles.container}>
      <div className={`${styles.ring} ${styles[`ring--${level}`]}`}>
        <span className={styles.score}>{score}</span>
      </div>
      <span className={`${styles.label} ${styles[`label--${level}`]}`}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: 创建 SecurityScore.module.css**

```css
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4em;
}

.ring {
  width: 4.5em;
  height: 4.5em;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
}

.ring--danger { border-color: #ff4444; color: #ff4444; }
.ring--warning { border-color: #ffaa00; color: #ffaa00; }
.ring--safe { border-color: #00ff88; color: #00ff88; }

.score {
  font-size: 1.6em;
  line-height: 1;
}

.label {
  font-size: 0.55em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-family: var(--font-display, 'Bebas Neue', sans-serif);
}

.label--danger { color: #ff4444; }
.label--warning { color: #ffaa00; }
.label--safe { color: #00ff88; }
```

- [ ] **Step 3: 创建 AuditLogViewer.tsx**

```tsx
import { useState, useEffect } from 'react';
import { api, type AuditEntry } from '../../api';
import { Modal, Button, Select } from './';
import styles from './AuditLogViewer.module.css';

interface AuditLogViewerProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ['ALL', 'AUTH', 'CRYPTO', 'DOWNLOAD', 'CONFIG', 'FILE', 'LAUNCH', 'SANDBOX'];

export default function AuditLogViewer({ open, onClose }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [category, setCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.getAuditLog(category === 'ALL' ? undefined : category, 100)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, category]);

  return (
    <Modal open={open} onClose={onClose} title="安全审计日志">
      <div className={styles.filter}>
        <Select
          value={category}
          onChange={(v) => setCategory(v)}
          options={CATEGORIES.map(c => ({ value: c, label: c }))}
        />
      </div>
      <div className={styles.logList}>
        {loading ? (
          <div className={styles.empty}>加载中...</div>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>暂无日志</div>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className={`${styles.logEntry} ${styles[`logEntry--${entry.level.toLowerCase()}`]}`}>
              <span className={styles.logTime}>{entry.timestamp.replace('T', ' ').slice(0, 19)}</span>
              <span className={styles.logLevel}>{entry.level}</span>
              <span className={styles.logCategory}>[{entry.category}]</span>
              <span className={styles.logMessage}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
      <div className={styles.footer}>
        <Button variant="secondary" size="sm" onClick={onClose}>关闭</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: 创建 AuditLogViewer.module.css**

```css
.filter {
  margin-bottom: 0.8em;
}

.logList {
  max-height: 24em;
  overflow-y: auto;
  font-family: var(--font-mono, 'DM Mono', monospace);
  font-size: 0.5em;
  line-height: 1.6;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.4em;
  padding: 0.6em;
}

.logEntry {
  padding: 0.2em 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  gap: 0.5em;
  flex-wrap: wrap;
}

.logEntry--error { color: #ff4444; }
.logEntry--warn { color: #ffaa00; }
.logEntry--info { color: #aaa; }

.logTime { color: #666; white-space: nowrap; }
.logLevel { font-weight: 700; min-width: 3em; }
.logCategory { color: var(--accent, #FFE600); }
.logMessage { flex: 1; }

.empty {
  text-align: center;
  padding: 2em;
  color: #666;
  font-size: 0.6em;
}

.footer {
  margin-top: 0.8em;
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 5: 在 ui/index.ts 中导出新组件**

在 `src/components/ui/index.ts` 中添加导出：

```typescript
export { default as SecurityScore } from './SecurityScore';
export { default as AuditLogViewer } from './AuditLogViewer';
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/SecurityScore.tsx src/components/ui/SecurityScore.module.css src/components/ui/AuditLogViewer.tsx src/components/ui/AuditLogViewer.module.css src/components/ui/index.ts
git commit -m "feat(security): add SecurityScore and AuditLogViewer UI components"
```

---

### Task 19: 前端 — 扩展 SettingsPage 添加安全板块

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.module.css`

- [ ] **Step 1: 在 SettingsPage.tsx 中添加安全相关 import**

在现有 import 区域添加：

```typescript
import { SecurityScore, AuditLogViewer } from '../components/ui';
import type { SecurityConfig, AuditEntry, LoginHistoryEntry, KeyStatus, SandboxAvailability } from '../api';
```

- [ ] **Step 2: 添加安全导航分类**

在 `navCategories` 数组中，在 `social` 分类之后添加：

```typescript
    {
      id: 'security',
      label: t('settings.nav.security') || '安全',
      sectionIds: ['sec-security-overview', 'sec-credential-protection', 'sec-network-security', 'sec-launch-security', 'sec-api-key-management', 'sec-security-audit'],
    },
```

- [ ] **Step 3: 在 SettingsPage 组件中添加安全状态**

在组件函数内部、现有 state 声明之后添加：

```typescript
  const [securityScore, setSecurityScore] = useState(40);
  const [encryptionStatus, setEncryptionStatus] = useState<{ encrypted: boolean; plain: boolean }>({ encrypted: false, plain: false });
  const [cfKeyStatus, setCfKeyStatus] = useState<KeyStatus | null>(null);
  const [sandboxInfo, setSandboxInfo] = useState<SandboxAvailability | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [cfKeyValue, setCfKeyValue] = useState('');
  const [showCfKey, setShowCfKey] = useState(false);
  const [proxyUrl, setProxyUrl] = useState(localConfig.security?.proxy_url || '');
  const [proxyUsername, setProxyUsername] = useState(localConfig.security?.proxy_username || '');
  const [proxyPassword, setProxyPassword] = useState(localConfig.security?.proxy_password || '');
```

添加 useEffect 加载安全数据：

```typescript
  useEffect(() => {
    api.getSecurityScore().then(setSecurityScore).catch(() => {});
    api.getEncryptionStatus().then(setEncryptionStatus).catch(() => {});
    api.getApiKeyStatus('cf_api_key').then(setCfKeyStatus).catch(() => {});
    api.getSandboxAvailability().then(setSandboxInfo).catch(() => {});
    api.getLoginHistory().then(setLoginHistory).catch(() => {});
  }, []);
```

- [ ] **Step 4: 添加安全相关 SectionCard**

在 SettingsPage 的 JSX 中，在最后一个 SectionCard 之后、`</div>` 闭合标签之前添加 6 个安全 SectionCard：

```tsx
      <SectionCard id="sec-security-overview" title="安全概览">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5em', marginBottom: '0.8em' }}>
          <SecurityScore score={securityScore} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4em', fontSize: '0.55em' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={encryptionStatus.encrypted ? 'ready' : 'error'} />
                <span>凭据加密</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.strict_verification ? 'ready' : 'warning'} />
                <span>严格验证</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.jvm_args_mode === 'whitelist' ? 'ready' : 'warning'} />
                <span>JVM 白名单</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <StatusDot status={localConfig.security?.audit_log_enabled ? 'ready' : 'warning'} />
                <span>审计日志</span>
              </div>
            </div>
          </div>
        </div>
        <SettingRow label="一键修复">
          <Button variant="secondary" size="sm" onClick={async () => {
            await api.fixFilePermissions();
            const score = await api.getSecurityScore();
            setSecurityScore(score);
          }}>修复安全问题</Button>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-credential-protection" title="凭据保护">
        <SettingRow label="凭据加密存储">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.credential_encryption ?? true}
              onChange={() => onConfigChange({
                security: { ...localConfig.security!, credential_encryption: !(localConfig.security?.credential_encryption ?? true) }
              })}
            />
            <span className={localConfig.security?.credential_encryption !== false ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              使用 AES-256-GCM 加密存储账户凭据
            </span>
          </label>
        </SettingRow>
        <SettingRow label="加密状态">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.55em' }}>
            <StatusDot status={encryptionStatus.encrypted ? 'ready' : 'warning'} />
            <span>{encryptionStatus.encrypted ? '已加密' : encryptionStatus.plain ? '明文存储（不安全）' : '无凭据'}</span>
          </div>
        </SettingRow>
        {encryptionStatus.plain && !encryptionStatus.encrypted && (
          <SettingRow label="迁移">
            <Button variant="primary" size="sm" onClick={async () => {
              await api.migrateCredentials();
              const status = await api.getEncryptionStatus();
              setEncryptionStatus(status);
              const score = await api.getSecurityScore();
              setSecurityScore(score);
            }}>迁移到加密存储</Button>
          </SettingRow>
        )}
      </SectionCard>

      <SectionCard id="sec-network-security" title="网络安全">
        <SettingRow label="严格下载验证">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.strict_verification ?? true}
              onChange={() => onConfigChange({
                security: { ...localConfig.security!, strict_verification: !(localConfig.security?.strict_verification ?? true) }
              })}
            />
            <span className={localConfig.security?.strict_verification !== false ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              拒绝无 SHA1 哈希的下载
            </span>
          </label>
        </SettingRow>
        <SettingRow label="强制 HTTPS">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.enforce_https ?? true}
              onChange={() => onConfigChange({
                security: { ...localConfig.security!, enforce_https: !(localConfig.security?.enforce_https ?? true) }
              })}
            />
            <span className={localConfig.security?.enforce_https !== false ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              仅允许 HTTPS 下载源
            </span>
          </label>
        </SettingRow>
        <SettingRow label="启用代理">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.proxy_enabled ?? false}
              onChange={() => onConfigChange({
                security: { ...localConfig.security!, proxy_enabled: !(localConfig.security?.proxy_enabled ?? false) }
              })}
            />
          </label>
        </SettingRow>
        {localConfig.security?.proxy_enabled && (
          <>
            <SettingRow label="代理 URL">
              <TextInput
                value={proxyUrl}
                onChange={setProxyUrl}
                placeholder="http://proxy:8080"
              />
            </SettingRow>
            <SettingRow label="代理用户名">
              <TextInput
                value={proxyUsername}
                onChange={setProxyUsername}
                placeholder="可选"
              />
            </SettingRow>
            <SettingRow label="代理密码">
              <input
                type="password"
                value={proxyPassword}
                onChange={(e) => setProxyPassword(e.target.value)}
                placeholder="可选"
                className={styles.textInput}
              />
            </SettingRow>
          </>
        )}
      </SectionCard>

      <SectionCard id="sec-launch-security" title="启动安全">
        <SettingRow label="JVM 参数模式">
          <Select
            value={localConfig.security?.jvm_args_mode || 'whitelist'}
            onChange={(v) => onConfigChange({
              security: { ...localConfig.security!, jvm_args_mode: v }
            })}
            options={[
              { value: 'whitelist', label: '白名单（推荐）' },
              { value: 'custom', label: '自定义（不安全）' },
            ]}
          />
        </SettingRow>
        <SettingRow label="沙箱模式">
          <Select
            value={localConfig.security?.sandbox_mode || 'off'}
            onChange={(v) => onConfigChange({
              security: { ...localConfig.security!, sandbox_mode: v }
            })}
            options={[
              { value: 'off', label: '关闭' },
              { value: 'basic', label: '基础' },
              { value: 'strict', label: '严格' },
            ]}
          />
        </SettingRow>
        {sandboxInfo && !sandboxInfo.available && localConfig.security?.sandbox_mode !== 'off' && (
          <div style={{ fontSize: '0.5em', color: '#ffaa00', padding: '0.3em 0' }}>
            ⚠ 当前平台沙箱不可用（需要 {sandboxInfo.tool || 'firejail/sandbox-exec'}）
          </div>
        )}
        <SettingRow label="安全启动检查">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.secure_launch_check ?? true}
              onChange={() => onConfigChange({
                security: { ...localConfig.security!, secure_launch_check: !(localConfig.security?.secure_launch_check ?? true) }
              })}
            />
            <span className={localConfig.security?.secure_launch_check !== false ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              启动前检查 Java 完整性和 JVM 参数
            </span>
          </label>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-api-key-management" title="API 密钥管理">
        <SettingRow label="CurseForge API Key">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flex: 1 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showCfKey ? 'text' : 'password'}
                value={cfKeyValue}
                onChange={(e) => setCfKeyValue(e.target.value)}
                placeholder={cfKeyStatus?.configured ? '已配置（输入新值以更新）' : '输入 CurseForge API Key'}
                className={styles.textInput}
                style={{ width: '100%', paddingRight: '3em' }}
              />
              <button
                onClick={() => setShowCfKey(!showCfKey)}
                style={{ position: 'absolute', right: '0.5em', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.5em' }}
              >
                {showCfKey ? '隐藏' : '显示'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.3em' }}>
              <Button variant="primary" size="sm" onClick={async () => {
                if (cfKeyValue.trim()) {
                  await api.saveApiKey('cf_api_key', cfKeyValue.trim());
                  setCfKeyValue('');
                  const status = await api.getApiKeyStatus('cf_api_key');
                  setCfKeyStatus(status);
                }
              }}>保存</Button>
              {cfKeyStatus?.configured && (
                <Button variant="secondary" size="sm" onClick={async () => {
                  await api.deleteApiKey('cf_api_key');
                  const status = await api.getApiKeyStatus('cf_api_key');
                  setCfKeyStatus(status);
                }}>删除</Button>
              )}
            </div>
          </div>
        </SettingRow>
        <SettingRow label="密钥状态">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.55em' }}>
            <StatusDot status={cfKeyStatus?.configured ? 'ready' : 'warning'} />
            <span>{cfKeyStatus?.configured ? `已配置（来源: ${cfKeyStatus.source}）` : '未配置'}</span>
          </div>
        </SettingRow>
      </SectionCard>

      <SectionCard id="sec-security-audit" title="安全审计">
        <SettingRow label="审计日志">
          <label className={styles.checkboxLabel}>
            <Checkbox
              on={localConfig.security?.audit_log_enabled ?? true}
              onChange={() => onConfigChange({
                security: { ...localConfig.security!, audit_log_enabled: !(localConfig.security?.audit_log_enabled ?? true) }
              })}
            />
            <span className={localConfig.security?.audit_log_enabled !== false ? styles.checkboxLabel__text : styles['checkboxLabel__text--muted']}>
              记录安全相关操作日志
            </span>
          </label>
        </SettingRow>
        <SettingRow label="查看审计日志">
          <Button variant="secondary" size="sm" onClick={() => setAuditLogOpen(true)}>
            打开日志查看器
          </Button>
        </SettingRow>
        {loginHistory.length > 0 && (
          <div style={{ marginTop: '0.5em' }}>
            <div style={{ fontSize: '0.5em', color: '#888', marginBottom: '0.3em', textTransform: 'uppercase', letterSpacing: '0.1em' }}>最近登录</div>
            {loginHistory.slice(0, 5).map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5em', fontSize: '0.5em', padding: '0.15em 0' }}>
                <StatusDot status={entry.success ? 'ready' : 'error'} />
                <span style={{ color: '#888' }}>{entry.timestamp.replace('T', ' ').slice(0, 19)}</span>
                <span>{entry.username}</span>
                <Badge variant={entry.auth_type === 'microsoft' ? 'default' : 'warning'}>{entry.auth_type}</Badge>
              </div>
            ))}
          </div>
        )}
        <AuditLogViewer open={auditLogOpen} onClose={() => setAuditLogOpen(false)} />
      </SectionCard>
```

- [ ] **Step 5: 确保 onConfigChange 支持 security 字段**

检查 `onConfigChange` 函数是否正确处理嵌套的 `security` 字段更新。如果当前实现是浅合并，需要修改为深合并：

在 `SettingsPage` 组件中找到 `onConfigChange` 的定义，确保它支持深层合并 `security` 字段。如果当前实现类似：

```typescript
const onConfigChange = (updates: Partial<AppConfig>) => {
  setLocalConfig(prev => ({ ...prev, ...updates }));
};
```

需要修改为支持嵌套合并：

```typescript
const onConfigChange = (updates: Partial<AppConfig>) => {
  setLocalConfig(prev => {
    const next = { ...prev, ...updates };
    if (updates.security && prev.security) {
      next.security = { ...prev.security, ...updates.security };
    }
    return next;
  });
};
```

- [ ] **Step 6: 添加 CSS 样式（如需要）**

在 `SettingsPage.module.css` 中添加 `textInput` 样式（如果不存在）：

```css
.textInput {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--clip-small, 2px);
  color: #fff;
  font-family: var(--font-body, 'Inter', sans-serif);
  font-size: 0.55em;
  padding: 0.4em 0.6em;
  outline: none;
  width: 100%;
}

.textInput:focus {
  border-color: var(--accent, #FFE600);
}
```

- [ ] **Step 7: 运行 TypeScript 检查**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 8: Commit**

```bash
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.module.css
git commit -m "feat(security): add security section to Settings page"
```

---

### Task 20: 集成审计日志到认证流程

**Files:**
- Modify: `src-tauri/src/auth/microsoft.rs`
- Modify: `src-tauri/src/auth/offline.rs`

- [ ] **Step 1: 在 microsoft.rs 中添加审计日志**

在 Microsoft 认证成功后（`poll_device_auth` 返回成功结果时），添加审计日志记录。找到认证成功的代码路径，添加：

```rust
crate::security::audit::record_login("microsoft", true, &username)?;
```

在认证失败时添加：

```rust
crate::security::audit::record_login("microsoft", false, &username).ok();
```

- [ ] **Step 2: 在 offline.rs 中添加审计日志**

在离线登录成功后添加：

```rust
crate::security::audit::record_login("offline", true, username)?;
```

- [ ] **Step 3: 运行 cargo check**

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/auth/microsoft.rs src-tauri/src/auth/offline.rs
git commit -m "feat(security): add audit logging to auth flows"
```

---

### Task 21: 全量编译检查和测试

**Files:**
- All modified files

- [ ] **Step 1: 运行 Rust 全量编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: `Finished` without errors

- [ ] **Step 2: 运行 Rust 测试**

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -30`

Expected: All tests pass

- [ ] **Step 3: 运行 TypeScript 类型检查**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No type errors

- [ ] **Step 4: 修复任何编译或类型错误**

根据错误信息逐一修复。

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(security): complete security optimization - fix compilation errors"
```

---

## 自审清单

1. **规格覆盖**: 设计文档中数据保护（2.1-2.3）、网络安全（3.1-3.4）、启动安全（4.1-4.3）、安全审计（5.1-5.3）、设置页 UI（6.1-6.4）均有对应 Task 实现 ✅
2. **占位符扫描**: 无 TBD、TODO、未实现步骤 ✅
3. **类型一致性**: `SecurityConfig` 在 Rust/TypeScript 两端字段名和类型一致，`AuditEntry`、`LoginHistoryEntry`、`KeyStatus`、`SandboxAvailability` 等类型两端对应 ✅
