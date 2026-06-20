# BonNext 社交共玩网络 — 设计文档

> 2026-05-30 | 状态: 设计完成

## 一、愿景

让 BonNext 从"打开游戏的工具"变成"和谁一起玩的入口"。

Minecraft 的社交体验目前碎片化：加好友靠 Discord、同步模组靠手动复制、知道朋友在玩什么靠口头问。BonNext 社交共玩网络把这些整合在启动器内，端到端加密、P2P 优先、无需中心服务器。

## 二、竞品定位

| 能力                    | Lunar Client  | 其他启动器 | BonNext        |
| ----------------------- | ------------- | ---------- | -------------- |
| 好友在线状态            | ✅            | ❌         | ✅             |
| 共玩邀请 + 自动配置同步 | ❌            | ❌         | ✅ (独家)      |
| P2P 模组传输            | ❌            | ❌         | ✅ (独家)      |
| 内置聊天                | ✅ (封闭生态) | ❌         | ✅ (开放, E2E) |
| AI 配置推荐             | ❌            | ❌         | ✅ (独家)      |
| 兴趣匹配发现新朋友      | ❌            | ❌         | ✅ (独家)      |
| 端到端加密              | ❌            | ❌         | ✅             |

Lunar Client 是唯一有社交的竞品，但它是封闭生态。BonNext 做的是开放、加密、去中心化的社交层。

## 三、架构

```
┌─────────────────────────────────────────────────┐
│                  BonNext 社交层                   │
├─────────────────────────────────────────────────┤
│  Profile  │  Friends  │  Sessions  │  Chat      │  ← 前端状态管理
├─────────────────────────────────────────────────┤
│  Identity │  Discovery │   Sync    │  Transport │  ← Rust 核心模块
│  (密钥对)  │ (mDNS+P2P)│ (diff引擎) │ (QUIC/WS)  │
├─────────────────────────────────────────────────┤
│              P2P Network Layer                   │
│    libp2p / rust-libp2p (Kademlia DHT)          │
├─────────────────────────────────────────────────┤
│              E2E Encryption                      │
│    X25519 + ChaCha20-Poly1305                   │
└─────────────────────────────────────────────────┘
```

**关键设计决策**：

- **身份**：本地生成 Ed25519 密钥对 → 公钥指纹即用户 ID。无需注册，私钥即身份。公钥可导出/导入便于跨设备迁移。
- **发现**：局域网 mDNS 自动发现；远程通过轻量信令服务器做 NAT 穿透。好友建立连接后形成 P2P 网络，无需中心节点中转数据。
- **同步**：结构化 diff（模组/版本/资源包差异）→ 只传输差异部分 → P2P 增量同步。
- **加密**：所有 P2P 通信（聊天、文件传输、状态同步）端到端加密。

## 四、模块设计

### 4.1 身份与好友 (Identity & Friends)

用户初次使用社交功能时自动生成密钥对，公钥指纹即为可分享的用户 ID（`bon-<base58>` 格式短码）。

**好友关系建立**：

- 局域网内自动发现并推荐
- 输入好友 ID 添加
- 一次性邀请链接/二维码

**在线状态**：在线 / 忙碌（游戏中）/ 离开 / 隐身

**数据模型**（本地 JSON 存储）：

```rust
struct Friend {
    id: String,          // 对方的公钥指纹
    name: String,        // 本地备注名
    last_seen: DateTime,
    status: Status,      // Online/Away/Busy/Offline
    current_game: Option<GameInfo>,
}
```

### 4.2 共玩邀请 (Co-Play Invitation)

核心价值：解决"和朋友一起玩 Minecraft 有多痛苦"的问题。

**用户流程**：

```
发起方: 选择好友 → 点击"共玩邀请" → 选择用哪个实例
接收方: 收到通知 → 点击接受 → 自动分析配置差异 → 同步 → 双方就绪 → 一键启动
```

**配置差异分析**：对比 Minecraft 版本、加载器类型/版本、模组列表（JAR名 + 哈希）、资源包、光影。生成差异报告展示给接收方，接收方可选择"合并到现有实例"或"创建临时共玩实例"。

**P2P 传输**：利用已有 P2P 基础设施。局域网直连，远程走中继。

**新增 Rust 命令**：

```rust
invite_to_coplay(peer_id: String, instance_id: String) -> InviteToken
analyze_coplay_diff(instance_id: String, peer_profile: PeerConfigSnapshot) -> ConfigDiff
sync_coplay_instance(peer_id: String, diff: ConfigDiff) -> String  // 返回新实例ID
respond_coplay_invite(token: String, accept: bool) -> void
```

**配置快照格式**（网络传输）：

```rust
struct PeerConfigSnapshot {
    minecraft_version: String,
    loader_type: LoaderType,
    loader_version: String,
    mods: Vec<ModFileInfo>,
    resource_packs: Vec<FileInfo>,
    shaders: Vec<FileInfo>,
    jvm_args: Option<String>,
    memory_mb: Option<u32>,
}
```

### 4.3 内置聊天 (IM)

轻量即时通讯，不侵入游戏、不依赖 Discord。

**功能范围**：

- 一对一聊天
- 截图即分享（自动拉取实例截图目录）
- 实例配置即分享（一键导出 + 对方一键导入）
- 离线消息（好友上线后自动推送，中继最多缓存 7 天，加密存储）

**不做的**：群聊（避免变成又一个 Discord）、语音通话、通用文件分享。

**传输层**：复用 P2P 加密通道。离线消息走中继缓存（加密）。

**新增 Rust 命令**：

```rust
send_message(peer_id: String, content: String, attachments: Vec<Attachment>) -> MessageId
get_messages(peer_id: String, before: Option<MessageId>, limit: u32) -> Vec<Message>
mark_messages_read(peer_id: String) -> void
```

**消息存储**：本地 SQLite（加密），远程中继仅做盲转发 + 临时缓存，不解密。

### 4.4 社交动态 (Social Feed)

Steam Friends 风格的活动时间线，完全可选择分享、本地优先。

| 活动类型 | 内容                     | 隐私                         |
| -------- | ------------------------ | ---------------------------- |
| 正在玩   | 版本 + 服务器名          | 可设置"对所有人/仅好友/关闭" |
| 新装模组 | "X 安装了 Create v0.5.1" | 仅好友可见                   |
| 成就解锁 | 已解锁的成就             | 可逐条控制                   |
| 新实例   | "X 创建了新整合包"       | 可选择分享                   |
| 共玩请求 | "X 邀请你一起玩"         | 仅被邀请方                   |

**实现**：好友上线后 P2P 拉取对方最近活动（不做中心化存储）。每条活动附带签名可验证来源。本地缓存。

### 4.5 AI 兴趣匹配

利用已有 AI 基础设施实现个性化社交推荐。

- **偏好画像**：分析实例列表、游玩时长、收藏内容 → 本地提取特征向量
- **好友推荐**："玩法相似的用户" → 远程对比偏好画像的余弦相似度（需双方开启可被发现）
- **共玩实例推荐**：触发共玩邀请后，AI 基于双方硬件和偏好推荐最合适的模组组合

## 五、新增代码结构

```
src-tauri/src/social/
  identity.rs       # 密钥生成、身份管理
  discovery.rs      # mDNS + Peer 发现
  transport.rs      # QUIC P2P 加密通道
  sync.rs           # 配置 diff + P2P 文件同步

src-tauri/src/chat/
  messages.rs       # 消息收发、离线缓存
  attachments.rs    # 附件管理

src-tauri/src/social_feed.rs   # 动态管理

src-tauri/src/recommendation.rs # AI 偏好匹配

commands/social.rs  # Tauri 命令注册

src/stores/socialStore.tsx     # 前端社交状态管理
src/stores/chatStore.tsx       # 前端聊天状态管理
```

## 六、现有依赖

复用的已有基础设施：

- P2P 网络 (`scan_p2p_peers`, `send_file_p2p`)
- 局域网发现 (`start_lan_discovery`, `stop_lan_discovery`, `get_lan_worlds`)
- AI 基础设施（已有 AI 助手系统）
- 安全模块（加密、密钥存储、审计日志）
- 实例管理（创建/克隆/导出/导入）
- 好友系统基本数据模型 (`list_friends`, `add_friend`, `remove_friend`)
- 下载队列和进度系统

## 七、待定项

- 信令/中继服务器的部署方案（默认提供一个轻量实例，用户可自建）
- 中继服务器是否开源
- 跨设备密钥同步方案（密钥导出/导入 vs 助记词 vs 自动备份）
