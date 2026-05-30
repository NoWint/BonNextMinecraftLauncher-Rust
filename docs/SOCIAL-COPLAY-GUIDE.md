# BonNext 社交共玩网络 — 使用教程

> 适用于 v0.0.5+ ，当前版本为基础设施阶段

---

## 一、系统概览

BonNext 社交共玩网络是一个去中心化的 P2P 社交层，让你可以：

- **发现好友**：局域网自动发现附近的 BonNext 用户
- **加好友**：通过唯一 ID（`bon-XXXX`）添加好友
- **聊天**：端到端加密的一对一消息
- **共玩同步**：一键同步你和好友的 Minecraft 实例配置

所有通信均端到端加密，P2P 优先，不依赖中心服务器。

---

## 二、获取你的身份 ID

首次启动时，系统自动生成 Ed25519 密钥对，你的身份 ID 格式为：

```
bon-XXXXXXXXXXX
```

### 在 UI 查看你的 ID

1. 打开 BonNext 启动器
2. 查看侧边栏的好友面板（FriendsPanel）
3. 顶部会显示你的 ID，例如 `bon-3kL9xP2mQ8v`

### 跨设备迁移身份

**导出密钥**（当前设备）：

```typescript
const encodedKey = await api.social.exportIdentityKey();
// 复制这串 base64 字符串
```

**导入密钥**（新设备）：

```typescript
const myPeerId = await api.social.importIdentityKey(encodedKey);
console.log('新设备 ID:', myPeerId); // 与旧设备相同
```

---

## 三、好友系统

### 3.1 局域网发现

在同一 Wi-Fi 下的 BonNext 用户会自动被发现：

1. 打开 BonNext
2. 在好友面板中点击 **🟢 ON AIR** 按钮开启局域网广播
3. 附近的其他 BonNext 用户会显示在 "Nearby" 区域
4. 点击 `+` 按钮即可添加为好友

### 3.2 手动添加好友

1. 在好友面板的输入框中输入：
   - **好友 ID**：对方的 `bon-XXXX` 标识
   - **好友名称**：给对方起个备注名
2. 点击 **Add Friend**

### 3.3 好友状态

| 状态    | 颜色    | 含义         |
| ------- | ------- | ------------ |
| online  | 🟢 绿色 | 在线，可聊天 |
| busy    | 🟡 黄色 | 游戏中       |
| away    | 🟠 橙色 | 离开         |
| offline | ⚫ 灰色 | 离线         |

---

## 四、内置聊天

### 4.1 开始聊天

1. 在好友面板中**点击**好友名称
2. 聊天窗口会打开，显示历史消息
3. 在底部输入框输入消息，按 `Enter` 发送

### 4.2 消息特性

- **端到端加密**：所有消息通过 ChaCha20-Poly1305 加密
- **离线消息**：好友离线期间发来的消息会在对方上线时自动推送
- **未读角标**：好友面板中显示未读消息数量
- **消息持久化**：所有消息存储在本地加密 SQLite 数据库中

### 4.3 截图分享（规划中）

未来版本支持拖拽截图到聊天窗口，P2P 传输。

---

## 五、共玩邀请（核心功能）

解决"和朋友一起玩 Minecraft 需要手动对齐版本/模组"的痛点。

### 5.1 发起共玩

```typescript
// 1. 生成实例快照
const snapshot = await api.social.generateInstanceSnapshot(
  instanceId,
  '1.21', // Minecraft 版本
  'fabric', // 加载器类型
  '0.16.0', // 加载器版本
);

// 2. 发送邀请（通过聊天或其他 P2P 通道传输 snapshot）
// ...

// 3. 接收方分析差异
const diff = await api.social.computeCoplayDiff(mySnapshot, friendSnapshot);
console.log(`需要同步 ${diff.total_file_count} 个文件，共 ${diff.total_download_bytes} 字节`);
```

### 5.2 差异分析结果

`computeCoplayDiff` 返回的 `ConfigDiff` 包含：

```typescript
{
  version_match: boolean;        // Minecraft 版本是否一致
  loader_match: boolean;         // 模组加载器是否一致
  missing_mods: FileInfo[];      // 你缺少的模组
  extra_mods: FileInfo[];        // 对方没有的模组
  missing_resource_packs: FileInfo[];
  missing_shaders: FileInfo[];
  total_download_bytes: number;  // 总共需要下载的大小
  total_file_count: number;      // 总共需要下载的文件数
}
```

### 5.3 同步流程

```
发起方                      接收方
  │                           │
  ├─ 选择实例                  │
  ├─ 生成配置快照              │
  ├─ P2P 发送邀请 ──────────→ │
  │                           ├─ 收到邀请
  │                           ├─ 分析差异
  │                           ├─ "需要下载3个模组, 12MB"
  │                           ├─ 确认接受
  │                           ├─ P2P 拉取缺失文件
  │                           ├─ 创建同步实例
  │                           └─ 就绪 ✓
  │                           │
  └─ 双方一键启动 ───────────→ 一起玩！
```

---

## 六、开发者 API 参考

### 6.1 身份命令

| 命令                  | 参数              | 返回     | 说明                       |
| --------------------- | ----------------- | -------- | -------------------------- |
| `get_my_peer_id`      | —                 | `String` | 获取当前用户的 bon-XXXX ID |
| `export_identity_key` | —                 | `String` | 导出 base64 编码的私钥     |
| `import_identity_key` | `encoded: String` | `String` | 导入私钥，返回新 ID        |

### 6.2 发现命令

| 命令                     | 参数                   | 返回                 | 说明            |
| ------------------------ | ---------------------- | -------------------- | --------------- |
| `start_social_discovery` | `display_name: String` | `void`               | 开启 mDNS 广播  |
| `stop_social_discovery`  | —                      | `void`               | 停止广播        |
| `scan_social_peers`      | —                      | `PeerAnnouncement[]` | 扫描局域网 peer |

### 6.3 聊天命令

| 命令                 | 参数                     | 返回        | 说明                  |
| -------------------- | ------------------------ | ----------- | --------------------- |
| `send_message`       | `peer_id, content`       | `i64`       | 发送消息，返回消息 ID |
| `get_messages`       | `peer_id, before, limit` | `Message[]` | 获取历史消息          |
| `mark_messages_read` | `peer_id`                | `void`      | 标记为已读            |
| `get_unread_count`   | `peer_id`                | `i64`       | 获取未读消息数        |

### 6.4 共玩同步命令

| 命令                         | 参数                                                | 返回                 | 说明         |
| ---------------------------- | --------------------------------------------------- | -------------------- | ------------ |
| `generate_instance_snapshot` | `instance_id, version, loader_type, loader_version` | `PeerConfigSnapshot` | 生成实例快照 |
| `compute_coplay_diff`        | `local, remote`                                     | `ConfigDiff`         | 计算配置差异 |

### 6.5 前端 API（TypeScript）

```typescript
import { api } from './api';

// 获取我的 ID
const myId = await api.social.getMyPeerId();

// 发现附近的好友
await api.social.startSocialDiscovery('我的显示名');
const peers = await api.social.scanSocialPeers();

// 添加好友
await api.social.addFriend('bon-xxx', '备注名');

// 发消息
const msgId = await api.chat.sendMessage('bon-xxx', 'Hello!');

// 读消息
const messages = await api.chat.getMessages('bon-xxx', null, 50);

// 共玩
const snap = await api.social.generateInstanceSnapshot('inst-id', '1.21', 'fabric', '0.16.0');
const diff = await api.social.computeCoplayDiff(mySnap, theirSnap);
```

---

## 七、React 状态管理

### 7.1 社交状态（socialStore）

```tsx
import { useSocial } from '../stores/socialStore';

function MyComponent() {
  const {
    myPeerId,
    friends,
    discoveredPeers,
    isDiscovering,
    startDiscovery,
    stopDiscovery,
    scanPeers,
    addFriend,
    removeFriend,
  } = useSocial();
  // ...
}
```

### 7.2 聊天状态（chatStore）

```tsx
import { useChat } from '../stores/chatStore';

function MyComponent() {
  const { activeChat, messages, unreadCounts, openChat, closeChat, sendMessage, markRead } = useChat();

  // 打开与好友的聊天
  await openChat('bon-xxx');

  // 发送消息
  await sendMessage('bon-xxx', 'Hello!');
}
```

---

## 八、架构细节

### 加密设计

```
                 BonNext 用户 A                BonNext 用户 B
                 ┌──────────┐                ┌──────────┐
                 │ Ed25519  │                │ Ed25519  │
                 │ 私钥 A   │                │ 私钥 B   │
                 │ 公钥 A   │                │ 公钥 B   │
                 └────┬─────┘                └────┬─────┘
                      │        ECDH X25519        │
                      └──────────┬───────────────┘
                                 │
                         共享密钥 (HKDF)
                                 │
                     ChaCha20-Poly1305 加密
```

### 数据存储位置

| 文件     | 路径                         | 内容                  |
| -------- | ---------------------------- | --------------------- |
| 身份密钥 | `<game_dir>/identity.key`    | Ed25519 私钥 (base64) |
| 好友列表 | `<game_dir>/friends.json`    | FriendEntry JSON 数组 |
| 聊天记录 | `<game_dir>/messages.db`     | SQLite 加密数据库     |
| 社交动态 | `<game_dir>/activities.json` | Activity JSON 数组    |

### 网络传输

- **局域网**：mDNS 发现（`_bonnext-social._udp.local.`） + 直接 TCP 连接
- **远程**：信令服务器 NAT 穿透 → P2P 加密通道
- **离线**：消息通过中继缓存（最多 7 天，端到端加密存储）

---

## 九、当前功能与后续规划

### 已实现（v0.0.5+）

- ✅ Ed25519 去中心化身份
- ✅ mDNS 局域网 Peer 发现
- ✅ 好友添加/删除
- ✅ 端到端加密消息
- ✅ SQLite 消息存储（分页 + 未读）
- ✅ 实例配置差异引擎
- ✅ ChaCha20-Poly1305 E2E 加密
- ✅ 玩家偏好画像 + 余弦相似度匹配
- ✅ 社交动态追踪

### 后续版本规划

- ⏳ 共玩邀请 UI（CoPlayInvite 弹窗）
- ⏳ P2P 文件传输（实例同步）
- ⏳ 社交动态面板（SocialFeed）
- ⏳ AI 好友推荐界面
- ⏳ 信令/中继服务器部署
- ⏳ 跨设备身份备份
