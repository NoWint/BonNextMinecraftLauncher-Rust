# BonNext 全面安全优化设计文档

**日期**: 2026-05-24
**状态**: 已批准
**范围**: 跨平台安全加固 + 安全设置页

---

## 1. 概述

对 BonNext 启动器进行全面深度安全优化，覆盖数据保护、网络安全、启动安全、安全审计四大领域，并在设置页新增安全板块提供可视化管理界面。

**加密方案**: 应用层 AES-256-GCM 加密（密钥派生自机器唯一标识）
**实施策略**: 一次性全面实施

---

## 2. 数据保护

### 2.1 凭据加密存储

**问题**: `accounts.json` 中 access_token / refresh_token 明文存储

**方案**: 新增 `src-tauri/src/security.rs` 模块

**加密流程**:
1. 机器指纹 = SHA-256(hostname + username + OS type + 32字节随机salt)
2. 加密密钥 = HKDF-SHA256(机器指纹, info="bonnext-credential-key")
3. 凭据文件 = AES-256-GCM(plaintext_json, random_12byte_nonce, AAD=文件路径)
4. 存储格式: `{ "salt": base64, "nonce": base64, "ciphertext": base64, "version": 1 }`

**关键设计**:
- salt 首次生成后持久化在 `config_dir/.security_salt`（权限 600）
- 换机器后凭据文件无法解密（预期行为，需重新登录）
- 向后兼容：首次启动检测到明文 `accounts.json`，自动加密并替换为 `accounts.json.enc`
- 使用 `aes-gcm` crate（纯 Rust，无 C 依赖，跨平台性能好）
- 文件权限：macOS/Linux 设置 600，Windows 设置仅当前用户可读

**新增依赖**:
- `aes-gcm = "0.10"` — AES-256-GCM 加密
- `hkdf = "0.12"` — HKDF 密钥派生
- `sha2 = "0.10"` — SHA-256 哈希（可能已存在）
- `base64 = "0.22"` — Base64 编码（可能已存在）
- `hostname = "0.4"` — 获取主机名
- `whoami = "1.5"` — 获取用户名和 OS 信息

### 2.2 API Key 安全管理

**问题**: CurseForge API Key 硬编码在源码中

**方案**:
- 移除硬编码 key，改为从加密配置文件或环境变量读取
- 新增 `security_config.json.enc`（加密存储）保存 API keys
- 设置页提供 API Key 管理界面（输入/更新/删除）
- 首次启动无 key 时，Modrinth 功能正常，CurseForge 功能提示配置 key
- 优先级：环境变量 `BONNEXT_CF_API_KEY` > 加密配置文件 > 无（提示配置）

### 2.3 文件权限控制

**方案**:
- 所有敏感文件创建时设置限制性权限：
  - macOS/Linux: `chmod 600`
  - Windows: 移除继承的 ACE，仅保留当前用户的 Read/Write 权限
- 敏感文件列表：
  - `accounts.json.enc`
  - `.security_salt`
  - `security_config.json.enc`
  - `security/audit.log`
- 启动时自检：检测敏感文件权限是否过于宽松，若宽松则自动修复并记录审计日志
- 新增 `security/file_permissions.rs` 模块实现跨平台权限控制

---

## 3. 网络安全

### 3.1 CSP 强化

**当前 CSP 缺陷**: 缺少 `object-src 'none'`、`base-uri 'self'`、`form-action 'self'` 等指令

**强化后 CSP**:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' https: data: blob:;
connect-src 'self' https://api.curseforge.com https://api.modrinth.com https://api.adoptium.net https://login.microsoftonline.com https://user.auth.xboxlive.com https://xsts.auth.xboxlive.com https://api.minecraftservices.com https://piston-meta.mojang.com https://launchermeta.mojang.com https://resources.download.minecraft.net https://bmclapi2.bangbang93.com https://download.mcbbs.net;
font-src 'self' data: https://fonts.gstatic.com;
media-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

**新增指令**:
- `object-src 'none'` — 禁止加载插件
- `base-uri 'self'` — 防止 base 标签劫持
- `form-action 'self'` — 限制表单提交目标
- `frame-ancestors 'none'` — 防止被嵌入 iframe
- `upgrade-insecure-requests` — 自动升级 HTTP 为 HTTPS

### 3.2 下载验证策略

**方案**:
- 新增安全配置项 `strict_verification: bool`（默认 true）
- 严格模式下：SHA1 为空时**拒绝**下载（当前行为是跳过验证）
- 宽松模式下：保持当前行为（SHA1 为空时跳过）
- 新增下载源 HTTPS 强制：`enforce_https: bool`（默认 true），非 HTTPS URL 直接拒绝
- 验证失败时记录审计日志

### 3.3 代理设置

**方案**:
- 新增安全配置项：
  - `proxy_enabled: bool`（默认 false）
  - `proxy_url: Option<String>`
  - `proxy_username: Option<String>`
  - `proxy_password: Option<String>`（加密存储）
- 代理 URL 验证：必须是 `http://` 或 `https://` 格式
- 代理认证凭据加密存储在 `security_config.json.enc`
- 下载客户端和 API 客户端均遵循代理设置
- 默认跟随系统代理（proxy_enabled = false 时）

### 3.4 输入消毒

**方案**: 新增 `src-tauri/src/security/sanitizer.rs` 模块

**消毒规则**:
- 路径参数：拒绝 `..`、空字节（`\0`）、超长路径（>4096 字符）
- ID 参数：仅允许 `[a-zA-Z0-9_-]`，最大长度 256
- URL 参数：验证 scheme 为 https/http，拒绝内网 IP（127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, [::1], fc00::/7）
- JVM 参数：白名单模式（见 4.1 节）
- 通用字符串：拒绝空字节、控制字符（除换行/制表符）、超长输入（>65535）

**应用方式**: 创建 `SanitizedInput<T>` 包装类型，在 Tauri command 入口统一消毒

---

## 4. 启动安全

### 4.1 JVM 参数白名单

**问题**: `jvm_args` 允许任意字符串注入

**方案**:
- 新增安全配置项 `jvm_args_mode: "whitelist" | "custom"`（默认 whitelist）
- 白名单允许的参数类别：
  - 内存：`-Xmx`, `-Xms`, `-Xmn`
  - GC：`-XX:+UseG1GC`, `-XX:+UseZGC`, `-XX:+UseSerialGC`, `-XX:+UseParallelGC`, `-XX:+UseShenandoahGC`, `-XX:MaxGCPauseMillis=N`, `-XX:G1HeapRegionSize=N`
  - 编码：`-Dfile.encoding=UTF-8`, `-Dsun.jnu.encoding=UTF-8`
  - Minecraft 相关：`-Dminecraft.applet.TargetDirectory=...`
  - 性能：`-XX:+UseCompressedOops`, `-XX:+AggressiveOpts`, `-XX:+UseStringDeduplication`
  - 调试：`-XX:+PrintGCDetails`, `-XX:+PrintGCTimeStamps`, `-Xlog:gc*`
- 自定义模式：允许任意参数但显示安全警告，记录审计日志
- 设置页 UI 提供参数编辑器，白名单模式下只允许从预设列表选择

### 4.2 沙箱启动选项

**方案**:
- 新增安全配置项 `sandbox_mode: "off" | "basic" | "strict"`（默认 off）
- macOS：使用 `sandbox-exec`（系统自带）：
  - basic：允许读写游戏目录，拒绝写入其他位置
  - strict：basic + 禁止网络（除 Minecraft 服务器连接）+ 禁止子进程
- Linux：使用 Firejail（检测是否安装）：
  - basic：`--private=~/.local/share/bonnext/<instance>/.minecraft`
  - strict：basic + `--net=none`（Minecraft 服务器连接需额外配置）+ `--noroot`
- Windows：使用 Job Object 限制：
  - basic：限制进程优先级和内存上限
  - strict：basic + 限制子进程创建（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）
- 沙箱不可用时自动降级并记录审计日志

### 4.3 安全启动检查

**方案**:
- 新增安全配置项 `secure_launch_check: bool`（默认 true）
- 启动前自动检查：
  - Java 可执行文件是否被篡改（文件大小 + 修改时间校验）
  - 游戏目录权限是否正常
  - JVM 参数是否在白名单内
  - 沙箱是否正常启用（如配置了沙箱）
- 检查失败时阻止启动并提示用户

---

## 5. 安全审计

### 5.1 审计日志系统

**方案**: 新增 `src-tauri/src/security/audit.rs` 模块

**存储位置**: `config_dir/security/audit.log`

**日志格式**: `[ISO8601] [LEVEL] [CATEGORY] message {metadata_json}`

**日志级别**: INFO, WARN, ERROR

**日志类别**:
- `AUTH` — 登录/登出/Token刷新/认证失败
- `CRYPTO` — 加密/解密操作、密钥派生
- `DOWNLOAD` — 下载验证通过/失败、SHA1 不匹配
- `CONFIG` — 安全配置变更
- `FILE` — 敏感文件权限修复
- `LAUNCH` — 游戏启动/沙箱状态
- `SANDBOX` — 沙箱启用/降级/失败

**日志轮转**: 单文件最大 5MB，保留最近 3 个文件

**性能考虑**:
- 使用 `tokio::spawn` 异步写入，不阻塞主线程
- 使用 `Arc<Mutex<LineWriter>>` 缓冲写入
- 批量刷新：每 100 条或每 5 秒刷新一次

### 5.2 登录历史

**方案**:
- 记录每次登录事件：时间、类型（Microsoft/Offline）、成功/失败、IP（如可获取）
- 存储在 `config_dir/security/login_history.json`
- 保留最近 50 条记录
- 设置页展示最近登录记录

### 5.3 敏感操作记录

**自动记录审计日志的操作**:
- 安全配置变更（含变更前后值）
- 凭据加密/解密操作
- 文件权限修复（含修复前后权限）
- 下载验证失败（含文件名和期望/实际 SHA1）
- JVM 参数被修改为自定义模式
- 沙箱模式变更
- API Key 变更
- 代理配置变更
- 启动安全检查失败

---

## 6. 安全设置页 UI

### 6.1 导航结构

在现有 6 个分类旁新增第 7 个：**安全**（图标：盾牌/锁）

### 6.2 SectionCard 布局

| Section | 包含的设置项 |
|---------|-------------|
| **安全概览** | 安全评分（0-100）、各安全维度状态指示灯、一键修复按钮 |
| **凭据保护** | 加密存储开关（默认开）、加密状态指示器、迁移明文→加密按钮 |
| **网络安全** | 代理开关 + 代理URL + 代理认证、严格下载验证开关、HTTPS强制开关 |
| **启动安全** | JVM参数模式（白名单/自定义）、沙箱模式（off/basic/strict）、安全启动检查开关 |
| **API密钥管理** | CurseForge API Key 输入框（密码样式）、密钥状态指示 |
| **安全审计** | 审计日志开关、最近登录历史列表、审计日志查看器（弹窗） |

### 6.3 安全评分算法

```
评分 = 基础分 40
  + 凭据加密 20（已加密 +20）
  + 严格验证 10（已启用 +10）
  + JVM白名单 10（白名单模式 +10）
  + 沙箱启用 10（basic +5, strict +10）
  + 审计日志 10（已启用 +10）
```

### 6.4 UI 设计规范

- 遵循 ZZZ/Neo-Tokcyberpunk 美学风格
- 安全评分使用渐变色：0-40 红色、41-70 黄色、71-100 绿色
- 状态指示灯：绿色=安全、黄色=警告、红色=危险
- 开关组件复用现有 Toggle 组件
- API Key 输入框使用密码样式（`type="password"`），带显示/隐藏切换
- 审计日志查看器使用 Modal 弹窗，支持搜索和类别过滤
- 所有安全设置变更需二次确认（Modal 确认框）

---

## 7. 数据模型

### 7.1 AppConfig 新增字段

```rust
pub struct SecurityConfig {
    pub credential_encryption: bool,        // 默认 true
    pub strict_verification: bool,          // 默认 true
    pub enforce_https: bool,                // 默认 true
    pub jvm_args_mode: String,              // "whitelist" | "custom"，默认 "whitelist"
    pub sandbox_mode: String,               // "off" | "basic" | "strict"，默认 "off"
    pub proxy_enabled: bool,                // 默认 false
    pub proxy_url: Option<String>,          // 验证格式 http:// 或 https://
    pub proxy_username: Option<String>,
    pub proxy_password: Option<String>,     // 加密存储在 security_config.json.enc
    pub audit_log_enabled: bool,            // 默认 true
    pub secure_launch_check: bool,          // 默认 true
}
```

在 `AppConfig` 中新增：
```rust
pub struct AppConfig {
    // ... 现有字段 ...
    pub security: SecurityConfig,
}
```

### 7.2 加密凭据文件格式

```rust
pub struct EncryptedCredentials {
    pub version: u32,
    pub salt: String,       // base64 encoded
    pub nonce: String,      // base64 encoded
    pub ciphertext: String, // base64 encoded
}
```

### 7.3 安全配置加密文件格式

```rust
pub struct EncryptedSecurityConfig {
    pub version: u32,
    pub nonce: String,
    pub ciphertext: String,
    // 使用与凭据相同的 salt
}
```

### 7.4 审计日志条目

```rust
pub struct AuditEntry {
    pub timestamp: String,
    pub level: String,
    pub category: String,
    pub message: String,
    pub metadata: Option<serde_json::Value>,
}
```

### 7.5 登录历史条目

```rust
pub struct LoginHistoryEntry {
    pub timestamp: String,
    pub auth_type: String,
    pub success: bool,
    pub username: String,
}
```

---

## 8. 新增 Tauri Commands

| Command | 功能 |
|---------|------|
| `get_security_config` | 获取安全配置 |
| `save_security_config` | 保存安全配置（含审计日志） |
| `get_security_score` | 计算并返回安全评分 |
| `get_audit_log` | 获取审计日志（支持分页和过滤） |
| `get_login_history` | 获取登录历史 |
| `migrate_credentials` | 手动触发凭据加密迁移 |
| `get_encryption_status` | 获取凭据加密状态 |
| `save_api_key` | 保存 API Key（加密存储） |
| `delete_api_key` | 删除 API Key |
| `get_api_key_status` | 获取 API Key 配置状态（不返回 key 本身） |
| `check_file_permissions` | 检查敏感文件权限 |
| `fix_file_permissions` | 修复敏感文件权限 |
| `validate_jvm_args` | 验证 JVM 参数是否在白名单内 |
| `get_sandbox_availability` | 检测当前平台沙箱可用性 |

---

## 9. 新增 Rust 模块结构

```
src-tauri/src/security/
├── mod.rs              # 模块入口，导出公共接口
├── crypto.rs           # AES-256-GCM 加密/解密、HKDF 密钥派生
├── credential_store.rs # 凭据加密存储（替代明文 accounts.json）
├── sanitizer.rs        # 输入消毒
├── audit.rs            # 审计日志系统
├── file_permissions.rs # 跨平台文件权限控制
├── jvm_whitelist.rs    # JVM 参数白名单
├── sandbox.rs          # 沙箱启动（macOS/Linux/Windows）
└── key_store.rs        # API Key 加密存储
```

---

## 10. 前端新增文件

```
src/
├── components/ui/
│   ├── SecurityScore.tsx          # 安全评分组件
│   ├── SecurityScore.module.css
│   ├── AuditLogViewer.tsx         # 审计日志查看器
│   └── AuditLogViewer.module.css
├── pages/SettingsPage/
│   └── sections/
│       ├── SecurityOverview.tsx    # 安全概览 SectionCard
│       ├── CredentialProtection.tsx
│       ├── NetworkSecurity.tsx
│       ├── LaunchSecurity.tsx
│       ├── ApiKeyManagement.tsx
│       └── SecurityAudit.tsx
```

---

## 11. 性能影响评估

| 功能 | 性能影响 | 缓解措施 |
|------|---------|---------|
| 凭据加密/解密 | 启动时 +10-20ms | 仅在读写凭据时执行，缓存解密结果 |
| 输入消毒 | 每次调用 <1ms | 纯内存操作，无 IO |
| 审计日志写入 | 每条 <0.1ms | 异步写入 + 批量刷新 |
| 沙箱启动 | 启动游戏 +50-200ms | 仅在启用沙箱时 |
| 文件权限检查 | 启动时 +5-10ms | 仅在启动时执行一次 |
| HKDF 密钥派生 | 首次 +5ms | 缓存派生密钥在内存中 |

总体性能影响：启动时增加约 30-40ms，运行时几乎无影响。

---

## 12. 向后兼容性

- 首次启动检测到明文 `accounts.json` → 自动加密迁移
- `SecurityConfig` 所有字段有默认值 → 旧版 config.json 升级后自动填充
- 沙箱功能可选，默认关闭 → 不影响现有用户
- CSP 强化仅影响前端渲染 → 不影响 Rust 后端
- API Key 从硬编码迁移到加密存储 → 首次启动自动迁移
