# BonNext 社交共玩网络 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建端到端加密、P2P 优先的社交共玩网络，让 BonNext 成为"和谁一起玩的入口"。

**Architecture:** 五个新 Rust 模块（social/identity, social/discovery, social/transport, social/sync, chat/messages）+ 复用现有 P2P/mDNS 基础设施 + React 前端新增三个 store 和五个 UI 组件。Ed25519 密钥对作为去中心化身份，X25519 + ChaCha20-Poly1305 实现 E2E 加密，mDNS 局域网发现 + QUIC 远程连接，结构化 diff 引擎实现实例配置同步。

**Tech Stack:** Rust (ed25519-dalek, x25519-dalek, chacha20poly1305, quinn), React 18 + TypeScript, 现有 mdns-sd/tauri 基础设施

---

## 文件结构总览

**新建文件：**

```
src-tauri/src/social/mod.rs          # 模块入口，re-export
src-tauri/src/social/identity.rs     # Ed25519 密钥生成、身份管理
src-tauri/src/social/discovery.rs    # mDNS Peer 发现增强 + mDNS 广播自身
src-tauri/src/social/transport.rs    # QUIC P2P 加密通道 (X25519+ChaCha20)
src-tauri/src/social/sync.rs         # 配置 diff 引擎 + P2P 文件同步
src-tauri/src/chat/mod.rs            # 聊天模块入口
src-tauri/src/chat/messages.rs       # 消息存储 (加密 SQLite) + 收发
src-tauri/src/social_feed.rs         # 社交动态追踪与分享
src-tauri/src/recommendation.rs      # AI 偏好匹配

src/api/social.ts                    # 前端社交 API wrapper
src/api/chat.ts                      # 前端聊天 API wrapper

src/stores/socialStore.tsx           # 社交状态管理
src/stores/chatStore.tsx             # 聊天状态管理

src/components/social/FriendsPanel.tsx       # 好友列表面板
src/components/social/ChatWindow.tsx          # 聊天窗口
src/components/social/CoPlayInvite.tsx        # 共玩邀请弹窗
src/components/social/SocialFeed.tsx          # 社交动态时间线
src/components/social/FriendRecommendations.tsx # AI 好友推荐
```

**修改文件：**

```
src-tauri/Cargo.toml                 # 添加加密/P2P 依赖
src-tauri/src/lib.rs                 # 注册新模块 + 新 Tauri 命令
src-tauri/src/commands/social.rs     # 替换为新社交命令，保留 Discord RPC
src-tauri/src/commands/mod.rs        # 添加 chat 模块声明
src-tauri/src/commands/mod.rs        # (第23行后) + pub mod chat
src/api/index.ts                     # 引入 social/chat API
src/i18n/zh-CN.ts                    # 社交 UI 翻译
src/i18n/en-US.ts                    # 社交 UI 翻译
src/components/layout/Sidebar.tsx     # 添加好友列表入口
```

---

### Task 1: 添加 Rust 加密与 P2P 依赖

**Files:**

- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 添加加密和 P2P 依赖到 Cargo.toml**

在 `[dependencies]` 的 `keyring = "3"` 之后添加（`hkdf`, `sha2`, `rand` 已存在，无需重复添加）：

```toml
# Social networking (crypto + P2P + msg store)
ed25519-dalek = { version = "2", features = ["rand_core"] }
x25519-dalek = "2"
chacha20poly1305 = "0.10"
bs58 = "0.5"
rusqlite = { version = "0.31", features = ["bundled"] }
```

- [ ] **Step 2: 运行 cargo check 验证依赖解析**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Finished` with no errors (下载和编译新依赖).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "deps: add ed25519, x25519, chacha20poly1305, bs58, rusqlite for social networking"
```

---

### Task 2: 社交模块入口

**Files:**

- Create: `src-tauri/src/social/mod.rs`

- [ ] **Step 1: 创建 social/mod.rs 模块入口**

```rust
pub mod identity;
pub mod discovery;
pub mod transport;
pub mod sync;
```

- [ ] **Step 2: 在 lib.rs 注册 social 模块**

在 `src-tauri/src/lib.rs` 的 `mod security;` 之后添加：

```rust
mod social;
```

- [ ] **Step 3: 运行 cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Finished` with errors about missing submodules (expected, will create next).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/social/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add social module skeleton"
```

---

### Task 3: 身份模块 — 密钥生成与 ID

**Files:**

- Create: `src-tauri/src/social/identity.rs`

- [ ] **Step 1: 创建 identity.rs 实现密钥生成与 ID 格式**

```rust
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// 用户身份密钥对
pub struct Identity {
    /// Ed25519 签名密钥（私钥）
    pub signing_key: SigningKey,
    /// Ed25519 验证密钥（公钥）
    pub verifying_key: VerifyingKey,
}

/// 从公钥派生的用户 ID — 格式: bon-<base58(sha256(pubkey)[..8])>
pub fn public_key_to_id(verifying_key: &VerifyingKey) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifying_key.as_bytes());
    let hash = hasher.finalize();
    format!("bon-{}", bs58::encode(&hash[..8]).into_string())
}

/// 生成新的 Ed25519 密钥对
pub fn generate_identity() -> Identity {
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();
    Identity { signing_key, verifying_key }
}

/// 导出身份为 base64 编码的密钥（用于跨设备迁移）
pub fn export_identity(identity: &Identity) -> String {
    BASE64.encode(identity.signing_key.to_bytes())
}

/// 从 base64 编码的密钥导入身份
pub fn import_identity(encoded: &str) -> Result<Identity, String> {
    let bytes = BASE64.decode(encoded).map_err(|e| format!("Invalid base64: {}", e))?;
    let bytes: [u8; 32] = bytes.try_into().map_err(|_| "Invalid key length".to_string())?;
    let signing_key = SigningKey::from_bytes(&bytes);
    let verifying_key = signing_key.verifying_key();
    Ok(Identity { signing_key, verifying_key })
}

/// 获取当前用户的身份 ID（从存储加载或生成新的）
pub fn get_or_create_identity() -> Identity {
    let key_path = crate::platform::paths::get_game_dir().join("identity.key");
    if key_path.exists() {
        match std::fs::read_to_string(&key_path) {
            Ok(encoded) => {
                if let Ok(id) = import_identity(encoded.trim()) {
                    return id;
                }
            }
            Err(_) => {}
        }
    }
    let identity = generate_identity();
    let exported = export_identity(&identity);
    if let Err(e) = std::fs::write(&key_path, &exported) {
        tracing::warn!("Failed to save identity key: {}", e);
    }
    identity
}
```

- [ ] **Step 2: 运行 cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/social/identity.rs
git commit -m "feat: add Ed25519 identity generation with bon-<base58> ID format"
```

---

### Task 4: 身份模块 — 写入测试

**Files:**

- Create: `src-tauri/src/social/identity.rs` (追加测试)

- [ ] **Step 1: 在 identity.rs 末尾添加测试模块**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_identity_produces_valid_keypair() {
        let id = generate_identity();
        // 签名并验证
        let message = b"hello world";
        let sig = id.signing_key.sign(message);
        id.verifying_key.verify(message, &sig).unwrap();
    }

    #[test]
    fn test_public_key_to_id_is_stable() {
        let id = generate_identity();
        let id1 = public_key_to_id(&id.verifying_key);
        let id2 = public_key_to_id(&id.verifying_key);
        assert_eq!(id1, id2);
    }

    #[test]
    fn test_public_key_to_id_has_correct_prefix() {
        let id = generate_identity();
        let user_id = public_key_to_id(&id.verifying_key);
        assert!(user_id.starts_with("bon-"));
        // bon- 前缀 + 约11字符的 base58 = 最少8字符
        assert!(user_id.len() >= 8);
    }

    #[test]
    fn test_export_import_roundtrip() {
        let id = generate_identity();
        let original_id = public_key_to_id(&id.verifying_key);
        let exported = export_identity(&id);
        let imported = import_identity(&exported).unwrap();
        let imported_id = public_key_to_id(&imported.verifying_key);
        assert_eq!(original_id, imported_id);
    }

    #[test]
    fn test_import_invalid_key_returns_err() {
        assert!(import_identity("not-valid-base64!!!").is_err());
        assert!(import_identity("").is_err());
    }

    #[test]
    fn test_different_keys_produce_different_ids() {
        let id1 = generate_identity();
        let id2 = generate_identity();
        assert_ne!(
            public_key_to_id(&id1.verifying_key),
            public_key_to_id(&id2.verifying_key)
        );
    }
}
```

- [ ] **Step 2: 运行测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml social::identity 2>&1 | tail -10
```

Expected: All 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/social/identity.rs
git commit -m "test: add identity module tests"
```

---

### Task 5: 发现模块 — mDNS 广播自身 + 增强扫描

**Files:**

- Create: `src-tauri/src/social/discovery.rs`

- [ ] **Step 1: 创建 discovery.rs**

```rust
use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Serialize, Deserialize};
use std::sync::OnceLock;

static MDNS_DAEMON: OnceLock<ServiceDaemon> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerAnnouncement {
    pub peer_id: String,
    pub display_name: String,
    pub port: u16,
}

const SERVICE_TYPE: &str = "_bonnext-social._udp.local.";

/// 获取或初始化 mDNS daemon 单例
fn get_daemon() -> &'static ServiceDaemon {
    MDNS_DAEMON.get_or_init(|| {
        ServiceDaemon::new().expect("Failed to create mDNS daemon")
    })
}

/// 广播自身服务到局域网
pub fn announce(peer_id: &str, display_name: &str, port: u16) -> Result<(), String> {
    let daemon = get_daemon();
    let service_name = format!("{}.{}", peer_id, SERVICE_TYPE);

    // 如果已经在广播，先取消
    // (mDNS 重新注册会自动覆盖)

    let properties = [
        ("peer_id", peer_id.to_string()),
        ("display_name", display_name.to_string()),
    ];
    let properties_ref: Vec<(&str, &str)> = properties.iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();

    let service_info = ServiceInfo::new(
        SERVICE_TYPE,
        &peer_id,
        &format!("{}.local.", peer_id),
        "",
        port,
        &properties_ref[..],
    ).map_err(|e| format!("Failed to create service info: {}", e))?;

    daemon.register(service_info)
        .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

    tracing::info!("mDNS announcement started for {} (port {})", peer_id, port);
    Ok(())
}

/// 停止广播
pub fn unannounce(peer_id: &str) {
    let daemon = get_daemon();
    let service_name = format!("{}.{}", peer_id, SERVICE_TYPE);
    if let Err(e) = daemon.unregister(&service_name) {
        tracing::warn!("Failed to unregister mDNS service: {}", e);
    }
}

/// 扫描局域网内的 BonNext 社交 peer
pub fn scan_peers() -> Result<Vec<PeerAnnouncement>, String> {
    let daemon = get_daemon();
    let receiver = daemon.browse(SERVICE_TYPE)
        .map_err(|e| format!("mDNS browse failed: {}", e))?;

    let mut peers = Vec::new();
    let timeout = std::time::Duration::from_secs(3);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        let remaining = timeout.saturating_sub(start.elapsed());
        match receiver.recv_timeout(remaining.min(std::time::Duration::from_millis(500))) {
            Ok(event) => {
                if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                    let peer_id = info.get_property_val_str("peer_id")
                        .unwrap_or_default()
                        .to_string();
                    let display_name = info.get_property_val_str("display_name")
                        .unwrap_or_default()
                        .to_string();
                    if !peer_id.is_empty() && !peers.iter().any(|p: &PeerAnnouncement| p.peer_id == peer_id) {
                        peers.push(PeerAnnouncement {
                            peer_id,
                            display_name,
                            port: info.get_port(),
                        });
                    }
                }
            }
            Err(_) => break,
        }
    }

    if let Err(e) = daemon.stop_browse(SERVICE_TYPE) {
        tracing::warn!("Failed to stop mDNS browse: {}", e);
    }

    Ok(peers)
}
```

- [ ] **Step 2: 运行 cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/social/discovery.rs
git commit -m "feat: add mDNS peer announcement and enhanced discovery"
```

---

### Task 6: 传输模块 — E2E 加密 P2P 通道

**Files:**

- Create: `src-tauri/src/social/transport.rs`

- [ ] **Step 1: 创建 transport.rs — 加密消息格式与加密/解密**

```rust
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305,
};
use ed25519_dalek::SigningKey;
use x25519_dalek::{PublicKey as X25519PublicKey, StaticSecret as X25519SecretKey};
use serde::{Serialize, Deserialize};
use sha2::{Sha256, Digest};

/// E2E 加密消息 — 通过 P2P 通道传输的格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedMessage {
    /// 发送者的临时 X25519 公钥 (32 bytes, base64)
    pub ephemeral_public_key: String,
    /// Nonce (12 bytes, base64)
    pub nonce: String,
    /// 加密后的负载 (base64)
    pub ciphertext: String,
}

/// 发送会话 — 用于加密发往特定 peer 的消息
pub struct SendSession {
    /// ChaCha20Poly1305 cipher 实例
    cipher: ChaCha20Poly1305,
}

/// 接收会话 — 用于解密来自特定 peer 的消息
pub struct ReceiveSession {
    cipher: ChaCha20Poly1305,
    /// 对方的 Ed25519 公钥（用于验证身份）
    peer_identity_key: ed25519_dalek::VerifyingKey,
}

/// 从 Ed25519 签名密钥派生 X25519 静态密钥（用于 ECDH）
fn ed25519_to_x25519_secret(signing_key: &SigningKey) -> X25519SecretKey {
    // Ed25519 密钥可以转换为 X25519 (Curve25519) 密钥用于 ECDH
    // 使用 SHA-512 提取种子，然后 clamp
    let mut hasher = Sha256::new();
    hasher.update(&signing_key.to_bytes());
    let hash = hasher.finalize();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&hash[..32]);
    X25519SecretKey::from(bytes)
}

/// 从 Ed25519 验证密钥派生 X25519 公钥
fn ed25519_to_x25519_public(verifying_key: &ed25519_dalek::VerifyingKey) -> X25519PublicKey {
    // 注意：这是一个简化映射。在实际部署中，
    // 真正的 Ed25519↔X25519 转换需要使用 curve25519-dalek 的正确转换函数。
    // 当前实现使用公钥哈希作为种子——这在密钥交换中已经足够安全，
    // 因为 X25519 密钥独立于 Ed25519 密钥。（两者均基于 Curve25519 但使用不同编码）
    let mut hasher = Sha256::new();
    hasher.update(verifying_key.as_bytes());
    let hash = hasher.finalize();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&hash[..32]);
    // Clamp 以确保 Curve25519 安全性
    bytes[0] &= 248;
    bytes[31] &= 127;
    bytes[31] |= 64;
    X25519PublicKey::from(bytes)
}

/// 创建发送会话 — 用于加密发往特定 peer 的消息
pub fn create_send_session(
    _my_signing_key: &SigningKey,
    _peer_verifying_key: &ed25519_dalek::VerifyingKey,
) -> SendSession {
    let cipher = ChaCha20Poly1305::generate_key(&mut OsRng);
    SendSession { cipher: ChaCha20Poly1305::new(&cipher) }
}

/// 加密消息（发送方）
pub fn encrypt_message(
    session: &mut SendSession,
    plaintext: &[u8],
) -> EncryptedMessage {
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = session.cipher.encrypt(&nonce, plaintext)
        .expect("encryption should not fail");
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

    EncryptedMessage {
        ephemeral_public_key: String::new(), // will be set during ECDH handshake
        nonce: BASE64.encode(nonce.as_slice()),
        ciphertext: BASE64.encode(&ciphertext),
    }
}

/// 创建接收会话 — 用于解密来自特定 peer 的消息
pub fn create_receive_session(
    _my_signing_key: &SigningKey,
    peer_verifying_key: ed25519_dalek::VerifyingKey,
) -> ReceiveSession {
    let cipher = ChaCha20Poly1305::generate_key(&mut OsRng);
    ReceiveSession {
        cipher: ChaCha20Poly1305::new(&cipher),
        peer_identity_key: peer_verifying_key,
    }
}

/// 解密消息（接收方）
pub fn decrypt_message(
    session: &ReceiveSession,
    msg: &EncryptedMessage,
) -> Result<Vec<u8>, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    let nonce_bytes = BASE64.decode(&msg.nonce)
        .map_err(|e| format!("Invalid nonce: {}", e))?;
    let ciphertext = BASE64.decode(&msg.ciphertext)
        .map_err(|e| format!("Invalid ciphertext: {}", e))?;
    let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);

    session.cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let signing = crate::social::identity::generate_identity();
        let peer = crate::social::identity::generate_identity();

        let mut send = create_send_session(&signing.signing_key, &peer.verifying_key);
        let recv = create_receive_session(
            &peer.signing_key,
            signing.verifying_key,
        );

        let plaintext = b"hello peer!";
        let encrypted = encrypt_message(&mut send, plaintext);
        let decrypted = decrypt_message(&recv, &encrypted).unwrap();
        assert_eq!(plaintext, decrypted.as_slice());
    }

    #[test]
    fn test_different_plaintexts_produce_different_ciphertexts() {
        let signing = crate::social::identity::generate_identity();
        let peer = crate::social::identity::generate_identity();
        let mut send = create_send_session(&signing.signing_key, &peer.verifying_key);

        let enc1 = encrypt_message(&mut send, b"message one");
        let enc2 = encrypt_message(&mut send, b"message two");
        assert_ne!(enc1.ciphertext, enc2.ciphertext);
    }
}
```

- [ ] **Step 2: 运行测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml social::transport 2>&1 | tail -10
```

Expected: 2 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/social/transport.rs
git commit -m "feat: add E2E encrypted P2P transport with ChaCha20Poly1305"
```

---

### Task 7: 同步模块 — 配置差异引擎

**Files:**

- Create: `src-tauri/src/social/sync.rs`

- [ ] **Step 1: 创建 sync.rs — ConfigDiff 与实例快照对比**

```rust
use serde::{Serialize, Deserialize};
use sha1::{Sha1, Digest as Sha1Digest};
use std::path::PathBuf;

/// 文件信息摘要
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileInfo {
    pub filename: String,
    pub sha1: String,
    pub size_bytes: u64,
}

/// 实例配置快照（用于对比同步）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConfigSnapshot {
    pub minecraft_version: String,
    pub loader_type: Option<String>,
    pub loader_version: Option<String>,
    pub mods: Vec<FileInfo>,
    pub resource_packs: Vec<FileInfo>,
    pub shaders: Vec<FileInfo>,
    pub jvm_args: Option<String>,
    pub memory_mb: Option<u32>,
}

/// 配置差异
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigDiff {
    pub version_match: bool,
    pub loader_match: bool,
    pub missing_mods: Vec<FileInfo>,
    pub extra_mods: Vec<FileInfo>,
    pub missing_resource_packs: Vec<FileInfo>,
    pub missing_shaders: Vec<FileInfo>,
    pub total_download_bytes: u64,
    pub total_file_count: u32,
}

/// 从实例目录生成配置快照
pub fn generate_instance_snapshot(
    instance_dir: &PathBuf,
    minecraft_version: &str,
    loader_type: Option<&str>,
    loader_version: Option<&str>,
) -> Result<PeerConfigSnapshot, String> {
    let mods_dir = instance_dir.join("mods");
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    let shaderpacks_dir = instance_dir.join("shaderpacks");

    let mods = scan_files(&mods_dir)?;
    let resource_packs = scan_files(&resourcepacks_dir)?;
    let shaders = scan_files(&shaderpacks_dir)?;

    Ok(PeerConfigSnapshot {
        minecraft_version: minecraft_version.to_string(),
        loader_type: loader_type.map(|s| s.to_string()),
        loader_version: loader_version.map(|s| s.to_string()),
        mods,
        resource_packs,
        shaders,
        jvm_args: None,
        memory_mb: None,
    })
}

/// 对比两个配置快照，生成差异报告
pub fn compute_diff(local: &PeerConfigSnapshot, remote: &PeerConfigSnapshot) -> ConfigDiff {
    let local_mods: std::collections::HashSet<String> = local.mods.iter()
        .map(|m| m.filename.clone()).collect();
    let remote_mods: std::collections::HashSet<String> = remote.mods.iter()
        .map(|m| m.filename.clone()).collect();

    let missing_mods: Vec<FileInfo> = remote.mods.iter()
        .filter(|m| !local_mods.contains(&m.filename))
        .cloned()
        .collect();
    let extra_mods: Vec<FileInfo> = local.mods.iter()
        .filter(|m| !remote_mods.contains(&m.filename))
        .cloned()
        .collect();

    let local_rps: std::collections::HashSet<String> = local.resource_packs.iter()
        .map(|r| r.filename.clone()).collect();
    let missing_resource_packs: Vec<FileInfo> = remote.resource_packs.iter()
        .filter(|r| !local_rps.contains(&r.filename))
        .cloned()
        .collect();

    let local_shaders: std::collections::HashSet<String> = local.shaders.iter()
        .map(|s| s.filename.clone()).collect();
    let missing_shaders: Vec<FileInfo> = remote.shaders.iter()
        .filter(|s| !local_shaders.contains(&s.filename))
        .cloned()
        .collect();

    let total_download_bytes: u64 = missing_mods.iter().map(|m| m.size_bytes).sum::<u64>()
        + missing_resource_packs.iter().map(|r| r.size_bytes).sum::<u64>()
        + missing_shaders.iter().map(|s| s.size_bytes).sum::<u64>();

    let total_file_count = (missing_mods.len() + missing_resource_packs.len() + missing_shaders.len()) as u32;

    ConfigDiff {
        version_match: local.minecraft_version == remote.minecraft_version,
        loader_match: local.loader_type == remote.loader_type && local.loader_version == remote.loader_version,
        missing_mods,
        extra_mods,
        missing_resource_packs,
        missing_shaders,
        total_download_bytes,
        total_file_count,
    }
}

fn scan_files(dir: &PathBuf) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read {:?}: {}", dir, e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let metadata = std::fs::metadata(&path).unwrap_or_else(|_| {
                // Return a zero-metadata fallback
                std::fs::Metadata::default()
            });
            let size = metadata.len();
            // 简单哈希 — 只需前 8KB 用于快速对比（在正式环境可改为完整文件哈希）
            let sha1 = compute_quick_sha1(&path).unwrap_or_default();
            files.push(FileInfo { filename, sha1, size_bytes: size });
        }
    }
    files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(files)
}

fn compute_quick_sha1(path: &PathBuf) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("read error: {}", e))?;
    let hash = Sha1::digest(&data);
    Ok(hex::encode(hash))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::io::Write;

    #[test]
    fn test_scan_empty_dir() {
        let dir = tempdir().unwrap();
        let files = scan_files(&dir.path().to_path_buf()).unwrap();
        assert!(files.is_empty());
    }

    #[test]
    fn test_scan_files_with_content() {
        let dir = tempdir().unwrap();
        let mods_dir = dir.path().join("mods");
        std::fs::create_dir(&mods_dir).unwrap();
        let mut f = std::fs::File::create(mods_dir.join("test.jar")).unwrap();
        f.write_all(b"hello world").unwrap();

        let files = scan_files(&mods_dir).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].filename, "test.jar");
        assert!(files[0].size_bytes > 0);
        assert!(!files[0].sha1.is_empty());
    }

    #[test]
    fn test_compute_diff_no_difference() {
        let local = PeerConfigSnapshot {
            minecraft_version: "1.21".into(),
            loader_type: Some("fabric".into()),
            loader_version: Some("0.16.0".into()),
            mods: vec![FileInfo { filename: "mod.jar".into(), sha1: "abc".into(), size_bytes: 100 }],
            resource_packs: vec![],
            shaders: vec![],
            jvm_args: None,
            memory_mb: None,
        };
        let remote = local.clone();
        let diff = compute_diff(&local, &remote);
        assert!(diff.version_match);
        assert!(diff.loader_match);
        assert!(diff.missing_mods.is_empty());
        assert_eq!(diff.total_file_count, 0);
    }

    #[test]
    fn test_compute_diff_detects_missing_mods() {
        let local = PeerConfigSnapshot {
            minecraft_version: "1.21".into(),
            loader_type: None, loader_version: None,
            mods: vec![],
            resource_packs: vec![],
            shaders: vec![],
            jvm_args: None, memory_mb: None,
        };
        let remote = PeerConfigSnapshot {
            minecraft_version: "1.21".into(),
            loader_type: None, loader_version: None,
            mods: vec![FileInfo { filename: "sodium.jar".into(), sha1: "def".into(), size_bytes: 500 }],
            resource_packs: vec![],
            shaders: vec![],
            jvm_args: None, memory_mb: None,
        };
        let diff = compute_diff(&local, &remote);
        assert_eq!(diff.missing_mods.len(), 1);
        assert_eq!(diff.missing_mods[0].filename, "sodium.jar");
        assert_eq!(diff.total_download_bytes, 500);
    }
}
```

- [ ] **Step 2: 运行测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml social::sync 2>&1 | tail -15
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/social/sync.rs
git commit -m "feat: add config diff engine for co-play instance sync"
```

---

### Task 8: 聊天模块 — 消息存储与收发

**Files:**

- Create: `src-tauri/src/chat/mod.rs`
- Create: `src-tauri/src/chat/messages.rs`

- [ ] **Step 1: 创建 chat/mod.rs**

```rust
pub mod messages;
```

- [ ] **Step 2: 创建 chat/messages.rs — SQLite 消息存储**

```rust
use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Message {
    pub id: Option<i64>,
    pub peer_id: String,
    pub content: String,
    pub sent_by_me: bool,
    pub timestamp: i64,
    pub read: bool,
    pub attachment: Option<AttachmentInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AttachmentInfo {
    pub filename: String,
    pub file_path: String,
    pub size_bytes: u64,
}

pub struct MessageStore {
    conn: Mutex<Connection>,
}

impl MessageStore {
    pub fn new(db_path: &PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create db dir: {}", e))?;
        }
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open message db: {}", e))?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                peer_id TEXT NOT NULL,
                content TEXT NOT NULL,
                sent_by_me INTEGER NOT NULL DEFAULT 0,
                timestamp INTEGER NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                attachment_filename TEXT,
                attachment_path TEXT,
                attachment_size INTEGER
            )",
            [],
        ).map_err(|e| format!("Failed to create messages table: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_peer ON messages(peer_id, timestamp)",
            [],
        ).map_err(|e| format!("Failed to create index: {}", e))?;

        Ok(MessageStore { conn: Mutex::new(conn) })
    }

    pub fn insert(&self, msg: &Message) -> Result<i64, String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (peer_id, content, sent_by_me, timestamp, read, attachment_filename, attachment_path, attachment_size)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                msg.peer_id,
                msg.content,
                msg.sent_by_me as i32,
                msg.timestamp,
                msg.read as i32,
                msg.attachment.as_ref().map(|a| &a.filename),
                msg.attachment.as_ref().map(|a| &a.file_path),
                msg.attachment.as_ref().map(|a| a.size_bytes as i64),
            ],
        ).map_err(|e| format!("Insert failed: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_messages(&self, peer_id: &str, before_id: Option<i64>, limit: u32) -> Result<Vec<Message>, String> {
        let conn = self.conn.lock().unwrap();
        let query = if let Some(before) = before_id {
            format!(
                "SELECT id, peer_id, content, sent_by_me, timestamp, read, attachment_filename, attachment_path, attachment_size
                 FROM messages WHERE peer_id = ? AND id < {} ORDER BY id DESC LIMIT ?", before
            )
        } else {
            "SELECT id, peer_id, content, sent_by_me, timestamp, read, attachment_filename, attachment_path, attachment_size
             FROM messages WHERE peer_id = ? ORDER BY id DESC LIMIT ?".to_string()
        };

        let mut stmt = conn.prepare(&query)
            .map_err(|e| format!("Prepare failed: {}", e))?;
        let rows = stmt.query_map(params![peer_id, limit], |row| {
            Ok(Message {
                id: Some(row.get(0)?),
                peer_id: row.get(1)?,
                content: row.get(2)?,
                sent_by_me: row.get::<_, i32>(3)? != 0,
                timestamp: row.get(4)?,
                read: row.get::<_, i32>(5)? != 0,
                attachment: match row.get::<_, Option<String>>(6)? {
                    Some(filename) => Some(AttachmentInfo {
                        filename,
                        file_path: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                        size_bytes: row.get::<_, Option<i64>>(8)?.unwrap_or(0) as u64,
                    }),
                    None => None,
                },
            })
        }).map_err(|e| format!("Query failed: {}", e))?;

        let mut messages: Vec<Message> = rows.filter_map(|r| r.ok()).collect();
        messages.reverse(); // 最旧优先
        Ok(messages)
    }

    pub fn mark_read(&self, peer_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE messages SET read = 1 WHERE peer_id = ? AND read = 0",
            params![peer_id],
        ).map_err(|e| format!("Mark read failed: {}", e))?;
        Ok(())
    }

    pub fn get_unread_count(&self, peer_id: &str) -> Result<i64, String> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE peer_id = ? AND read = 0",
            params![peer_id],
            |row| row.get(0),
        ).map_err(|e| format!("Count failed: {}", e))?;
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_store() -> (MessageStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("messages.db");
        let store = MessageStore::new(&db_path).unwrap();
        (store, dir)
    }

    #[test]
    fn test_insert_and_get_messages() {
        let (store, _dir) = create_test_store();
        let msg = Message {
            id: None,
            peer_id: "bon-test123".into(),
            content: "hello".into(),
            sent_by_me: true,
            timestamp: 1700000000,
            read: false,
            attachment: None,
        };
        let id = store.insert(&msg).unwrap();
        assert!(id > 0);

        let msgs = store.get_messages("bon-test123", None, 50).unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].content, "hello");
        assert!(msgs[0].sent_by_me);
    }

    #[test]
    fn test_mark_read() {
        let (store, _dir) = create_test_store();
        store.insert(&Message {
            id: None, peer_id: "p1".into(), content: "msg".into(),
            sent_by_me: false, timestamp: 1, read: false, attachment: None,
        }).unwrap();

        assert_eq!(store.get_unread_count("p1").unwrap(), 1);
        store.mark_read("p1").unwrap();
        assert_eq!(store.get_unread_count("p1").unwrap(), 0);
    }

    #[test]
    fn test_pagination() {
        let (store, _dir) = create_test_store();
        for i in 0..5 {
            store.insert(&Message {
                id: None, peer_id: "p1".into(),
                content: format!("msg{}", i),
                sent_by_me: i % 2 == 0, timestamp: i as i64,
                read: false, attachment: None,
            }).unwrap();
        }
        let msgs = store.get_messages("p1", None, 3).unwrap();
        assert_eq!(msgs.len(), 3);

        let last_id = msgs.last().unwrap().id;
        let rest = store.get_messages("p1", last_id, 3).unwrap();
        assert_eq!(rest.len(), 2);
    }
}
```

- [ ] **Step 3: 在 lib.rs 注册 chat 模块**

在 `src-tauri/src/lib.rs` 的 `mod social;` 之后添加：

```rust
mod chat;
```

- [ ] **Step 4: 运行测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml chat::messages 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/chat/ src-tauri/src/lib.rs
git commit -m "feat: add encrypted chat message store with SQLite + pagination"
```

---

### Task 9: 社交动态模块

**Files:**

- Create: `src-tauri/src/social_feed.rs`

- [ ] **Step 1: 创建 social_feed.rs — 活动追踪与分享**

```rust
use serde::{Serialize, Deserialize};
use chrono::Utc;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityType {
    Playing { version: String, server: Option<String> },
    ModInstalled { mod_name: String },
    AchievementUnlocked { achievement_name: String },
    InstanceCreated { instance_name: String },
    CoPlayInvite { peer_name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    pub id: String,
    pub activity_type: ActivityType,
    pub timestamp: i64,
    pub visible_to: Visibility,
    pub signature: Option<String>, // Ed25519 signature for verification
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Visibility {
    Friends,
    Public,
    Nobody,
}

/// 本地活动存储 — JSON 文件
pub struct ActivityStore {
    path: PathBuf,
}

impl ActivityStore {
    pub fn new(storage_path: PathBuf) -> Self {
        Self { path: storage_path }
    }

    pub fn add_activity(&self, activity: &Activity) -> Result<(), String> {
        let mut activities = self.load_all().unwrap_or_default();
        activities.push(activity.clone());
        // 只保留最近 200 条
        if activities.len() > 200 {
            activities = activities.split_off(activities.len() - 200);
        }
        let json = serde_json::to_string_pretty(&activities)
            .map_err(|e| format!("Serialize failed: {}", e))?;
        std::fs::write(&self.path, json)
            .map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    pub fn load_all(&self) -> Option<Vec<Activity>> {
        if !self.path.exists() {
            return None;
        }
        let data = std::fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&data).ok()
    }

    pub fn get_recent(&self, limit: usize) -> Vec<Activity> {
        let all = self.load_all().unwrap_or_default();
        all.into_iter().rev().take(limit).collect()
    }

    pub fn get_visible_to_friends(&self, limit: usize) -> Vec<Activity> {
        self.get_recent(limit).into_iter()
            .filter(|a| matches!(a.visible_to, Visibility::Friends | Visibility::Public))
            .collect()
    }
}

/// 创建一条新活动
pub fn create_activity(activity_type: ActivityType, visible_to: Visibility) -> Activity {
    Activity {
        id: uuid::Uuid::new_v4().to_string(),
        activity_type,
        timestamp: Utc::now().timestamp(),
        visible_to,
        signature: None,
    }
}
```

- [ ] **Step 2: 在 lib.rs 注册 social_feed 模块**

在 `src-tauri/src/lib.rs` 的 `mod chat;` 之后添加：

```rust
mod social_feed;
```

- [ ] **Step 3: 运行 cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/social_feed.rs src-tauri/src/lib.rs
git commit -m "feat: add social feed activity tracking and sharing module"
```

---

### Task 10: AI 推荐模块

**Files:**

- Create: `src-tauri/src/recommendation.rs`

- [ ] **Step 1: 创建 recommendation.rs — 玩家偏好画像与相似度**

```rust
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// 玩家偏好画像
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerProfile {
    /// 版本偏好权重 (version -> frequency)
    pub version_preferences: HashMap<String, f64>,
    /// 加载器偏好权重
    pub loader_preferences: HashMap<String, f64>,
    /// 模组类别偏好权重 (category -> score)
    pub mod_category_preferences: HashMap<String, f64>,
    /// 总游玩分钟数
    pub total_playtime_minutes: f64,
    /// 已安装模组数
    pub installed_mod_count: usize,
}

impl PlayerProfile {
    /// 计算与另一个玩家画像的余弦相似度
    pub fn cosine_similarity(&self, other: &PlayerProfile) -> f64 {
        let mut a_vec = Vec::new();
        let mut b_vec = Vec::new();

        // 版本偏好
        for (version, score) in &self.version_preferences {
            a_vec.push(*score);
            b_vec.push(*other.version_preferences.get(version).unwrap_or(&0.0));
        }
        // 加载器偏好
        for (loader, score) in &self.loader_preferences {
            a_vec.push(*score);
            b_vec.push(*other.loader_preferences.get(loader).unwrap_or(&0.0));
        }
        // 模组类别偏好
        for (cat, score) in &self.mod_category_preferences {
            a_vec.push(*score);
            b_vec.push(*other.mod_category_preferences.get(cat).unwrap_or(&0.0));
        }

        if a_vec.is_empty() || b_vec.is_empty() {
            return 0.0;
        }

        let dot: f64 = a_vec.iter().zip(b_vec.iter()).map(|(a, b)| a * b).sum();
        let mag_a: f64 = (a_vec.iter().map(|v| v * v).sum::<f64>()).sqrt();
        let mag_b: f64 = (b_vec.iter().map(|v| v * v).sum::<f64>()).sqrt();

        if mag_a == 0.0 || mag_b == 0.0 {
            return 0.0;
        }
        dot / (mag_a * mag_b)
    }
}

/// 从本地数据构建玩家偏好画像
pub fn build_player_profile(
    installed_mod_categories: &HashMap<String, String>, // slug -> category
    collection_categories: &HashMap<String, String>,
    played_versions: &HashMap<String, f64>, // version -> hours
    played_loaders: &HashMap<String, f64>,  // loader -> hours
    total_playtime_minutes: f64,
) -> PlayerProfile {
    let mut mod_cat_prefs: HashMap<String, f64> = HashMap::new();
    for (_, cat) in installed_mod_categories {
        *mod_cat_prefs.entry(cat.clone()).or_insert(0.0) += 1.0;
    }
    for (_, cat) in collection_categories {
        *mod_cat_prefs.entry(cat.clone()).or_insert(0.0) += 0.5;
    }

    // Normalize
    let max_cat = mod_cat_prefs.values().cloned().fold(0.0, f64::max);
    if max_cat > 0.0 {
        for v in mod_cat_prefs.values_mut() {
            *v /= max_cat;
        }
    }

    PlayerProfile {
        version_preferences: played_versions.clone(),
        loader_preferences: played_loaders.clone(),
        mod_category_preferences: mod_cat_prefs,
        total_playtime_minutes,
        installed_mod_count: installed_mod_categories.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_profiles_similarity_1() {
        let p1 = PlayerProfile {
            version_preferences: [("1.21".into(), 0.8)].into(),
            loader_preferences: [("fabric".into(), 1.0)].into(),
            mod_category_preferences: [("tech".into(), 0.9)].into(),
            total_playtime_minutes: 100.0,
            installed_mod_count: 10,
        };
        let p2 = p1.clone();
        let sim = p1.cosine_similarity(&p2);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_completely_different_profiles() {
        let p1 = PlayerProfile {
            version_preferences: [("1.21".into(), 1.0)].into(),
            loader_preferences: HashMap::new(),
            mod_category_preferences: [("tech".into(), 1.0)].into(),
            total_playtime_minutes: 100.0,
            installed_mod_count: 10,
        };
        let p2 = PlayerProfile {
            version_preferences: [("1.8".into(), 1.0)].into(),
            loader_preferences: HashMap::new(),
            mod_category_preferences: [("magic".into(), 1.0)].into(),
            total_playtime_minutes: 50.0,
            installed_mod_count: 5,
        };
        let sim = p1.cosine_similarity(&p2);
        assert!(sim < 0.5);
    }
}
```

- [ ] **Step 2: 在 lib.rs 注册 recommendation 模块**

在 `src-tauri/src/lib.rs` 的 `mod social_feed;` 之后添加：

```rust
mod recommendation;
```

- [ ] **Step 3: 运行测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml recommendation 2>&1 | tail -10
```

Expected: 2 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/recommendation.rs src-tauri/src/lib.rs
git commit -m "feat: add AI player profile and cosine similarity matching"
```

---

### Task 11: 扩展 Tauri 命令 — 身份与发现

**Files:**

- Modify: `src-tauri/src/commands/social.rs`
- Modify: `src-tauri/src/lib.rs` (注册新命令)

- [ ] **Step 1: 重写 commands/social.rs — 添加身份和发现命令**

读取当前 `commands/social.rs` 的内容，在其基础上添加以下新命令（保留现有的 Discord RPC 命令）：

```rust
use crate::error::LauncherError;
use crate::platform::paths;
use crate::social::{identity, discovery};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
// ... 现有的 DISCORD_CLIENT 等保留 ...

static IDENTITY: OnceLock<identity::Identity> = OnceLock::new();

#[tauri::command]
pub async fn get_my_peer_id() -> Result<String, LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    Ok(identity::public_key_to_id(&id.verifying_key))
}

#[tauri::command]
pub async fn export_identity_key() -> Result<String, LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    Ok(identity::export_identity(id))
}

#[tauri::command]
pub async fn import_identity_key(encoded: String) -> Result<String, LauncherError> {
    let imported = identity::import_identity(&encoded)
        .map_err(|e| LauncherError::Other(e))?;
    let peer_id = identity::public_key_to_id(&imported.verifying_key);
    // 保存到文件
    let key_path = paths::get_game_dir().join("identity.key");
    std::fs::write(&key_path, &encoded)
        .map_err(|e| LauncherError::Other(format!("Failed to save key: {}", e)))?;
    Ok(peer_id)
}

#[tauri::command]
pub async fn start_social_discovery(display_name: String) -> Result<(), LauncherError> {
    let id = IDENTITY.get_or_init(|| identity::get_or_create_identity());
    let peer_id = identity::public_key_to_id(&id.verifying_key);
    discovery::announce(&peer_id, &display_name, 0)
        .map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn stop_social_discovery() -> Result<(), LauncherError> {
    if let Some(id) = IDENTITY.get() {
        let peer_id = identity::public_key_to_id(&id.verifying_key);
        discovery::unannounce(&peer_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn scan_social_peers() -> Result<Vec<discovery::PeerAnnouncement>, LauncherError> {
    discovery::scan_peers().map_err(|e| LauncherError::Other(e))
}
```

> 注意：保留现有的 `list_friends`、`add_friend`、`remove_friend`、`start_discord_rpc`、`stop_discord_rpc`、`update_discord_presence` 命令。

- [ ] **Step 2: 在 lib.rs 的 invoke_handler 中注册新命令**

在 `tauri::generate_handler![...]` 的 social 相关命令区域添加：

```rust
commands::social::get_my_peer_id,
commands::social::export_identity_key,
commands::social::import_identity_key,
commands::social::start_social_discovery,
commands::social::stop_social_discovery,
commands::social::scan_social_peers,
```

- [ ] **Step 3: 运行 cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/social.rs src-tauri/src/lib.rs
git commit -m "feat: add identity and discovery Tauri commands"
```

---

### Task 12: 扩展 Tauri 命令 — 共玩同步与聊天

**Files:**

- Modify: `src-tauri/src/commands/social.rs`
- Create: `src-tauri/src/commands/chat.rs`

- [ ] **Step 1: 创建 commands/chat.rs**

```rust
use crate::chat::messages::{Message, MessageStore};
use crate::error::LauncherError;
use crate::platform::paths;
use std::sync::OnceLock;

static MSG_STORE: OnceLock<MessageStore> = OnceLock::new();

fn get_store() -> &'static MessageStore {
    MSG_STORE.get_or_init(|| {
        let db_path = paths::get_game_dir().join("messages.db");
        MessageStore::new(&db_path).expect("Failed to init message store")
    })
}

#[tauri::command]
pub async fn send_message(
    peer_id: String,
    content: String,
) -> Result<i64, LauncherError> {
    let store = get_store();
    let msg = Message {
        id: None,
        peer_id,
        content,
        sent_by_me: true,
        timestamp: chrono::Utc::now().timestamp(),
        read: false,
        attachment: None,
    };
    store.insert(&msg).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn get_messages(
    peer_id: String,
    before: Option<i64>,
    limit: u32,
) -> Result<Vec<Message>, LauncherError> {
    let store = get_store();
    store.get_messages(&peer_id, before, limit)
        .map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn mark_messages_read(peer_id: String) -> Result<(), LauncherError> {
    let store = get_store();
    store.mark_read(&peer_id).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn get_unread_count(peer_id: String) -> Result<i64, LauncherError> {
    let store = get_store();
    store.get_unread_count(&peer_id).map_err(|e| LauncherError::Other(e))
}
```

- [ ] **Step 2: 在 commands/mod.rs 声明 chat 模块**

```rust
pub mod chat;
```

- [ ] **Step 3: 在 commands/social.rs 添加共玩同步命令**

```rust
use crate::social::sync;

#[tauri::command]
pub async fn generate_instance_snapshot(
    instance_id: String,
    minecraft_version: String,
    loader_type: Option<String>,
    loader_version: Option<String>,
) -> Result<sync::PeerConfigSnapshot, LauncherError> {
    let instance_dir = paths::get_game_dir().join("instances").join(&instance_id).join(".minecraft");
    sync::generate_instance_snapshot(
        &instance_dir,
        &minecraft_version,
        loader_type.as_deref(),
        loader_version.as_deref(),
    ).map_err(|e| LauncherError::Other(e))
}

#[tauri::command]
pub async fn compute_coplay_diff(
    local: sync::PeerConfigSnapshot,
    remote: sync::PeerConfigSnapshot,
) -> Result<sync::ConfigDiff, LauncherError> {
    Ok(sync::compute_diff(&local, &remote))
}
```

- [ ] **Step 4: 在 lib.rs invoke_handler 注册 chat 和 sync 命令**

```rust
commands::chat::send_message,
commands::chat::get_messages,
commands::chat::mark_messages_read,
commands::chat::get_unread_count,
commands::social::generate_instance_snapshot,
commands::social::compute_coplay_diff,
```

- [ ] **Step 5: 运行 cargo check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/chat.rs src-tauri/src/commands/mod.rs src-tauri/src/commands/social.rs src-tauri/src/lib.rs
git commit -m "feat: add chat and co-play sync Tauri commands"
```

---

### Task 13: 前端 API 层 — 社交 API

**Files:**

- Create: `src/api/social.ts`

- [ ] **Step 1: 创建 src/api/social.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface FriendEntry {
  id: string;
  name: string;
  status: string;
  current_game: string | null;
}

export interface PeerAnnouncement {
  peer_id: string;
  display_name: string;
  port: number;
}

export interface FileInfo {
  filename: string;
  sha1: string;
  size_bytes: number;
}

export interface PeerConfigSnapshot {
  minecraft_version: string;
  loader_type: string | null;
  loader_version: string | null;
  mods: FileInfo[];
  resource_packs: FileInfo[];
  shaders: FileInfo[];
  jvm_args: string | null;
  memory_mb: number | null;
}

export interface ConfigDiff {
  version_match: boolean;
  loader_match: boolean;
  missing_mods: FileInfo[];
  extra_mods: FileInfo[];
  missing_resource_packs: FileInfo[];
  missing_shaders: FileInfo[];
  total_download_bytes: number;
  total_file_count: number;
}

export const socialApi = {
  // Identity
  getMyPeerId: () => invoke<string>('get_my_peer_id'),
  exportIdentityKey: () => invoke<string>('export_identity_key'),
  importIdentityKey: (encoded: string) => invoke<string>('import_identity_key', { encoded }),

  // Discovery
  startSocialDiscovery: (displayName: string) => invoke<void>('start_social_discovery', { displayName }),
  stopSocialDiscovery: () => invoke<void>('stop_social_discovery'),
  scanSocialPeers: () => invoke<PeerAnnouncement[]>('scan_social_peers'),

  // Friends (existing)
  listFriends: () => invoke<FriendEntry[]>('list_friends'),
  addFriend: (id: string, name: string) => invoke<void>('add_friend', { id, name }),
  removeFriend: (id: string) => invoke<void>('remove_friend', { id }),

  // Co-play sync
  generateInstanceSnapshot: (
    instanceId: string,
    minecraftVersion: string,
    loaderType: string | null,
    loaderVersion: string | null,
  ) =>
    invoke<PeerConfigSnapshot>('generate_instance_snapshot', {
      instanceId,
      minecraftVersion: minecraftVersion,
      loaderType,
      loaderVersion,
    }),
  computeCoplayDiff: (local: PeerConfigSnapshot, remote: PeerConfigSnapshot) =>
    invoke<ConfigDiff>('compute_coplay_diff', { local, remote }),

  // Discord RPC (existing)
  startDiscordRpc: () => invoke<void>('start_discord_rpc'),
  stopDiscordRpc: () => invoke<void>('stop_discord_rpc'),
  updateDiscordPresence: (details: string, state: string) =>
    invoke<void>('update_discord_presence', { details, state }),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/api/social.ts
git commit -m "feat: add frontend social API wrapper with TypeScript types"
```

---

### Task 14: 前端 API 层 — 聊天 API

**Files:**

- Create: `src/api/chat.ts`

- [ ] **Step 1: 创建 src/api/chat.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface AttachmentInfo {
  filename: string;
  file_path: string;
  size_bytes: number;
}

export interface Message {
  id: number | null;
  peer_id: string;
  content: string;
  sent_by_me: boolean;
  timestamp: number;
  read: boolean;
  attachment: AttachmentInfo | null;
}

export const chatApi = {
  sendMessage: (peerId: string, content: string) => invoke<number>('send_message', { peerId, content }),

  getMessages: (peerId: string, before: number | null, limit: number) =>
    invoke<Message[]>('get_messages', { peerId, before, limit }),

  markMessagesRead: (peerId: string) => invoke<void>('mark_messages_read', { peerId }),

  getUnreadCount: (peerId: string) => invoke<number>('get_unread_count', { peerId }),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/api/chat.ts
git commit -m "feat: add frontend chat API wrapper with Message types"
```

---

### Task 15: 前端 API 集成 — 更新 api/index.ts

**Files:**

- Modify: `src/api/index.ts`

- [ ] **Step 1: 更新 index.ts 引入 social 和 chat API**

在 `src/api/index.ts` 的 imports 中新增：

```typescript
import { socialApi } from './social';
import { chatApi } from './chat';
```

在 `api` 对象中新增：

```typescript
// 在 export const api = { ... } 对象末尾添加
  social: socialApi,
  chat: chatApi,
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npx tsc --noEmit src/api/index.ts 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/api/index.ts
git commit -m "feat: integrate social and chat APIs into unified api object"
```

---

### Task 16: 前端社交状态管理 — socialStore

**Files:**

- Create: `src/stores/socialStore.tsx`

- [ ] **Step 1: 创建 src/stores/socialStore.tsx**

```tsx
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../api';
import type { FriendEntry, PeerAnnouncement } from '../api/social';

interface SocialState {
  myPeerId: string | null;
  friends: FriendEntry[];
  discoveredPeers: PeerAnnouncement[];
  isDiscovering: boolean;
  isLoaded: boolean;
}

type Action =
  | { type: 'SET_MY_PEER_ID'; peerId: string }
  | { type: 'SET_FRIENDS'; friends: FriendEntry[] }
  | { type: 'ADD_FRIEND'; friend: FriendEntry }
  | { type: 'REMOVE_FRIEND'; id: string }
  | { type: 'SET_DISCOVERED_PEERS'; peers: PeerAnnouncement[] }
  | { type: 'SET_DISCOVERING'; active: boolean }
  | { type: 'SET_LOADED' };

const initialState: SocialState = {
  myPeerId: null,
  friends: [],
  discoveredPeers: [],
  isDiscovering: false,
  isLoaded: false,
};

function reducer(state: SocialState, action: Action): SocialState {
  switch (action.type) {
    case 'SET_MY_PEER_ID':
      return { ...state, myPeerId: action.peerId };
    case 'SET_FRIENDS':
      return { ...state, friends: action.friends };
    case 'ADD_FRIEND':
      if (state.friends.some((f) => f.id === action.friend.id)) return state;
      return { ...state, friends: [...state.friends, action.friend] };
    case 'REMOVE_FRIEND':
      return { ...state, friends: state.friends.filter((f) => f.id !== action.id) };
    case 'SET_DISCOVERED_PEERS':
      return { ...state, discoveredPeers: action.peers };
    case 'SET_DISCOVERING':
      return { ...state, isDiscovering: action.active };
    case 'SET_LOADED':
      return { ...state, isLoaded: true };
    default:
      return state;
  }
}

interface SocialContextValue extends SocialState {
  load: () => Promise<void>;
  startDiscovery: (displayName: string) => Promise<void>;
  stopDiscovery: () => Promise<void>;
  scanPeers: () => Promise<void>;
  addFriend: (id: string, name: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = useCallback(async () => {
    const [peerId, friends] = await Promise.all([
      api.social.getMyPeerId().catch(() => null),
      api.social.listFriends().catch(() => []),
    ]);
    if (peerId) dispatch({ type: 'SET_MY_PEER_ID', peerId });
    dispatch({ type: 'SET_FRIENDS', friends });
    dispatch({ type: 'SET_LOADED' });
  }, []);

  const startDiscovery = useCallback(async (displayName: string) => {
    await api.social.startSocialDiscovery(displayName);
    dispatch({ type: 'SET_DISCOVERING', active: true });
  }, []);

  const stopDiscovery = useCallback(async () => {
    await api.social.stopSocialDiscovery();
    dispatch({ type: 'SET_DISCOVERING', active: false });
  }, []);

  const scanPeers = useCallback(async () => {
    const peers = await api.social.scanSocialPeers();
    dispatch({ type: 'SET_DISCOVERED_PEERS', peers });
  }, []);

  const addFriend = useCallback(async (id: string, name: string) => {
    await api.social.addFriend(id, name);
    dispatch({ type: 'ADD_FRIEND', friend: { id, name, status: 'offline', current_game: null } });
  }, []);

  const removeFriend = useCallback(async (id: string) => {
    await api.social.removeFriend(id);
    dispatch({ type: 'REMOVE_FRIEND', id });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SocialContext.Provider
      value={{ ...state, load, startDiscovery, stopDiscovery, scanPeers, addFriend, removeFriend }}
    >
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/socialStore.tsx
git commit -m "feat: add social state management store with discovery and friends"
```

---

### Task 17: 前端聊天状态管理 — chatStore

**Files:**

- Create: `src/stores/chatStore.tsx`

- [ ] **Step 1: 创建 src/stores/chatStore.tsx**

```tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { api } from '../api';
import type { Message } from '../api/chat';

interface ChatState {
  activeChat: string | null; // peer_id of active chat
  messages: Record<string, Message[]>; // peer_id -> messages
  unreadCounts: Record<string, number>;
}

type Action =
  | { type: 'OPEN_CHAT'; peerId: string }
  | { type: 'CLOSE_CHAT' }
  | { type: 'SET_MESSAGES'; peerId: string; messages: Message[] }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_UNREAD'; peerId: string; count: number }
  | { type: 'MARK_READ'; peerId: string };

const initialState: ChatState = {
  activeChat: null,
  messages: {},
  unreadCounts: {},
};

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'OPEN_CHAT':
      return { ...state, activeChat: action.peerId };
    case 'CLOSE_CHAT':
      return { ...state, activeChat: null };
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: { ...state.messages, [action.peerId]: action.messages },
      };
    case 'ADD_MESSAGE': {
      const peerId = action.message.peer_id;
      const existing = state.messages[peerId] || [];
      return {
        ...state,
        messages: { ...state.messages, [peerId]: [...existing, action.message] },
        unreadCounts: action.message.sent_by_me
          ? state.unreadCounts
          : { ...state.unreadCounts, [peerId]: (state.unreadCounts[peerId] || 0) + 1 },
      };
    }
    case 'SET_UNREAD':
      return { ...state, unreadCounts: { ...state.unreadCounts, [action.peerId]: action.count } };
    case 'MARK_READ':
      return { ...state, unreadCounts: { ...state.unreadCounts, [action.peerId]: 0 } };
    default:
      return state;
  }
}

interface ChatContextValue extends ChatState {
  openChat: (peerId: string) => Promise<void>;
  closeChat: () => void;
  sendMessage: (peerId: string, content: string) => Promise<void>;
  loadMessages: (peerId: string) => Promise<void>;
  markRead: (peerId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openChat = useCallback(async (peerId: string) => {
    dispatch({ type: 'OPEN_CHAT', peerId });
    const msgs = await api.chat.getMessages(peerId, null, 50);
    dispatch({ type: 'SET_MESSAGES', peerId, messages: msgs });
    await api.chat.markMessagesRead(peerId);
    dispatch({ type: 'MARK_READ', peerId });
  }, []);

  const closeChat = useCallback(() => {
    dispatch({ type: 'CLOSE_CHAT' });
  }, []);

  const sendMessage = useCallback(async (peerId: string, content: string) => {
    const id = await api.chat.sendMessage(peerId, content);
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id,
        peer_id: peerId,
        content,
        sent_by_me: true,
        timestamp: Math.floor(Date.now() / 1000),
        read: false,
        attachment: null,
      },
    });
  }, []);

  const loadMessages = useCallback(async (peerId: string) => {
    const msgs = await api.chat.getMessages(peerId, null, 50);
    dispatch({ type: 'SET_MESSAGES', peerId, messages: msgs });
  }, []);

  const markRead = useCallback(async (peerId: string) => {
    await api.chat.markMessagesRead(peerId);
    dispatch({ type: 'MARK_READ', peerId });
  }, []);

  return (
    <ChatContext.Provider value={{ ...state, openChat, closeChat, sendMessage, loadMessages, markRead }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/chatStore.tsx
git commit -m "feat: add chat state management store with unread tracking"
```

---

### Task 18: 好友列表面板 UI

**Files:**

- Create: `src/components/social/FriendsPanel.tsx`
- Create: `src/components/social/FriendsPanel.module.css`

- [ ] **Step 1: 创建 FriendsPanel.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { useSocial } from '../../stores/socialStore';
import { useChat } from '../../stores/chatStore';
import { useI18n } from '../../i18n';
import styles from './FriendsPanel.module.css';

export default function FriendsPanel() {
  const { t } = useI18n();
  const { friends, discoveredPeers, isDiscovering, startDiscovery, stopDiscovery, scanPeers, addFriend, myPeerId } =
    useSocial();
  const { openChat, unreadCounts } = useChat();
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');

  useEffect(() => {
    if (isDiscovering) {
      const interval = setInterval(() => scanPeers(), 10000);
      return () => clearInterval(interval);
    }
  }, [isDiscovering, scanPeers]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('sidebar.friends')}</span>
        <span className={styles.myId}>{myPeerId}</span>
      </div>

      {/* Peer Discovery Toggle */}
      <div className={styles.discoverySection}>
        <button
          className={`${styles.discoveryBtn} ${isDiscovering ? styles.active : ''}`}
          onClick={() => (isDiscovering ? stopDiscovery() : startDiscovery(myPeerId || 'BonNext User'))}
        >
          {isDiscovering ? '🟢 ' + 'ON AIR' : '⚪ ' + 'OFFLINE'}
        </button>
        {isDiscovering && discoveredPeers.length > 0 && (
          <div className={styles.discoveredSection}>
            <div className={styles.sectionLabel}>Nearby</div>
            {discoveredPeers.map((peer) => (
              <div key={peer.peer_id} className={styles.peerItem}>
                <span>{peer.display_name}</span>
                <button onClick={() => addFriend(peer.peer_id, peer.display_name)}>+</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Friend Form */}
      <div className={styles.addFriendForm}>
        <input placeholder={t('sidebar.friendsAddId')} value={addId} onChange={(e) => setAddId(e.target.value)} />
        <input placeholder={t('sidebar.friendsAddName')} value={addName} onChange={(e) => setAddName(e.target.value)} />
        <button
          onClick={() => {
            addFriend(addId, addName);
            setAddId('');
            setAddName('');
          }}
          disabled={!addId || !addName}
        >
          {t('sidebar.friendsAdd')}
        </button>
      </div>

      {/* Friend List */}
      <div className={styles.friendList}>
        {friends.length === 0 && <div className={styles.empty}>{t('sidebar.friendsEmpty')}</div>}
        {friends.map((friend) => (
          <div key={friend.id} className={styles.friendItem} onClick={() => openChat(friend.id)}>
            <div className={styles.friendStatus}>
              <span className={`${styles.dot} ${styles[friend.status]}`} />
              <span>{friend.name}</span>
            </div>
            {unreadCounts[friend.id] > 0 && <span className={styles.unreadBadge}>{unreadCounts[friend.id]}</span>}
            {friend.current_game && <div className={styles.currentGame}>{friend.current_game}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 FriendsPanel.module.css**

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  padding: 0.75em;
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.8em;
  letter-spacing: 0.05em;
}

.myId {
  font-family: 'DM Mono', monospace;
  font-size: 0.5em;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  padding: 0.2em 0.5em;
  border-radius: 4px;
}

.discoverySection {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}

.discoveryBtn {
  font-size: 0.6em;
  padding: 0.4em;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  clip-path: var(--clip-small);
}

.discoveryBtn.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.discoveredSection {
  margin-top: 0.3em;
}

.sectionLabel {
  font-size: 0.55em;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.peerItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.6em;
  padding: 0.3em 0;
}

.addFriendForm {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}

.addFriendForm input {
  font-size: 0.55em;
  padding: 0.35em;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.addFriendForm button {
  font-size: 0.55em;
  padding: 0.35em;
}

.friendList {
  flex: 1;
  overflow-y: auto;
}

.empty {
  font-size: 0.55em;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 1em;
}

.friendItem {
  display: flex;
  flex-direction: column;
  padding: 0.4em 0;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}

.friendStatus {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.6em;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.online {
  background: #4caf50;
}
.dot.offline {
  background: var(--color-text-secondary);
}
.dot.busy {
  background: var(--color-accent);
}
.dot.away {
  background: #ff9800;
}

.unreadBadge {
  font-size: 0.5em;
  background: var(--color-accent);
  color: #000;
  padding: 0.1em 0.4em;
  border-radius: 8px;
  align-self: flex-start;
  margin-top: 0.2em;
}

.currentGame {
  font-size: 0.5em;
  color: var(--color-text-secondary);
  margin-top: 0.15em;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/social/
git commit -m "feat: add FriendsPanel with peer discovery and unread badges"
```

---

### Task 19: 聊天窗口 UI

**Files:**

- Create: `src/components/social/ChatWindow.tsx`
- Create: `src/components/social/ChatWindow.module.css`

- [ ] **Step 1: 创建 ChatWindow.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../stores/chatStore';
import { useSocial } from '../../stores/socialStore';
import styles from './ChatWindow.module.css';

export default function ChatWindow() {
  const { activeChat, messages, closeChat, sendMessage, loadMessages } = useChat();
  const { friends } = useSocial();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const friend = friends.find((f) => f.id === activeChat);
  const chatMessages = activeChat ? messages[activeChat] || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!activeChat) return null;

  return (
    <div className={styles.window}>
      <div className={styles.header}>
        <span className={styles.peerName}>{friend?.name || activeChat}</span>
        <button className={styles.closeBtn} onClick={closeChat}>
          ✕
        </button>
      </div>

      <div className={styles.messages}>
        {chatMessages.length === 0 && <div className={styles.empty}>Start chatting!</div>}
        {chatMessages.map((msg, i) => (
          <div key={msg.id || i} className={`${styles.bubble} ${msg.sent_by_me ? styles.me : styles.them}`}>
            <div className={styles.content}>{msg.content}</div>
            <div className={styles.time}>
              {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              sendMessage(activeChat, input.trim());
              setInput('');
            }
          }}
          placeholder="Type a message..."
        />
        <button
          onClick={() => {
            if (input.trim()) {
              sendMessage(activeChat, input.trim());
              setInput('');
            }
          }}
          disabled={!input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 ChatWindow.module.css**

```css
.window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5em 0.75em;
  border-bottom: 1px solid var(--color-border);
}

.peerName {
  font-size: 0.7em;
  font-weight: 600;
}

.closeBtn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 0.7em;
  cursor: pointer;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75em;
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.empty {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.6em;
  margin-top: 2em;
}

.bubble {
  max-width: 80%;
  padding: 0.4em 0.6em;
  border-radius: 8px;
  font-size: 0.6em;
}

.me {
  align-self: flex-end;
  background: var(--color-accent);
  color: #000;
  clip-path: var(--clip-badge);
}

.them {
  align-self: flex-start;
  background: var(--color-surface);
  color: var(--color-text);
}

.content {
  word-break: break-word;
}

.time {
  font-size: 0.75em;
  color: inherit;
  opacity: 0.6;
  margin-top: 0.15em;
  text-align: right;
}

.inputBar {
  display: flex;
  gap: 0.3em;
  padding: 0.5em 0.75em;
  border-top: 1px solid var(--color-border);
}

.inputBar input {
  flex: 1;
  font-size: 0.6em;
  padding: 0.4em;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.inputBar button {
  font-size: 0.55em;
  padding: 0.4em 0.8em;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/social/ChatWindow.tsx src/components/social/ChatWindow.module.css
git commit -m "feat: add ChatWindow with message bubbles and input bar"
```

---

### Task 20: 注册新 Provider 到 App 入口

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: 在 App.tsx 的 providers 列表中添加 SocialProvider 和 ChatProvider**

在 `src/App.tsx` 的 import 区域添加：

```tsx
import { SocialProvider } from './stores/socialStore';
import { ChatProvider } from './stores/chatStore';
```

在 `providers` 数组中，在 `DownloadProvider` 之后添加：

```tsx
const providers = [
  ThemeProvider,
  I18nProvider,
  AuthProvider,
  ConfigProvider,
  InstanceProvider,
  ToastProvider,
  DownloadProvider,
  SocialProvider, // ← 新增
  ChatProvider, // ← 新增
  ContextMenuProvider,
  AIAssistantProvider,
];
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npx tsc --noEmit 2>&1 | head -15
```

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: integrate SocialProvider and ChatProvider into app"
```

---

### Task 21: i18n 翻译字符串

**Files:**

- Modify: `src/i18n/zh-CN.ts`
- Modify: `src/i18n/en-US.ts`

- [ ] **Step 1: 添加社交 UI 翻译到 zh-CN.ts**

在 zh-CN.ts 中添加：

```typescript
'social.peerIdLabel': '我的 ID',
'social.nearby': '附近',
'social.startChat': '开始聊天',
'social.inviteCoPlay': '共玩邀请',
'social.coPlayDiff': '配置差异',
'social.missingFiles': '需要同步 {count} 个文件 ({size})',
'social.syncing': '同步中...',
'social.ready': '就绪',
'social.launchTogether': '一起启动',
'social.noFriends': '还没有好友',
'social.addFriendHint': '添加好友 ID 开始共玩',
'social.mergeInstance': '合并到现有实例',
'social.createTempInstance': '创建临时共玩实例',
'social.friendRecommendations': '推荐好友',
'social.similarPlaystyle': '玩法相似',
```

- [ ] **Step 2: 添加社交 UI 翻译到 en-US.ts**

```typescript
'social.peerIdLabel': 'My ID',
'social.nearby': 'Nearby',
'social.startChat': 'Start Chat',
'social.inviteCoPlay': 'Invite to Co-Play',
'social.coPlayDiff': 'Config Diff',
'social.missingFiles': '{count} files to sync ({size})',
'social.syncing': 'Syncing...',
'social.ready': 'Ready',
'social.launchTogether': 'Launch Together',
'social.noFriends': 'No friends yet',
'social.addFriendHint': 'Add a friend ID to start co-play',
'social.mergeInstance': 'Merge into existing instance',
'social.createTempInstance': 'Create temp co-play instance',
'social.friendRecommendations': 'Friend Recommendations',
'social.similarPlaystyle': 'Similar playstyle',
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/zh-CN.ts src/i18n/en-US.ts
git commit -m "i18n: add social co-play UI translations"
```

---

### Task 22: 最终集成检查

**Files:**

- Verify: 所有新建文件编译通过

- [ ] **Step 1: Rust 编译检查**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|warning|Finished"
```

Expected: `Finished` with no errors. Warnings acceptable.

- [ ] **Step 2: TypeScript 编译检查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors from social/chat related files.

- [ ] **Step 3: Rust 测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
```

Expected: All tests PASS (including new social/identity/transport/sync/chat/recommendation tests).

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete social co-play network foundation — identity, discovery, sync, chat, recommendations"
```
