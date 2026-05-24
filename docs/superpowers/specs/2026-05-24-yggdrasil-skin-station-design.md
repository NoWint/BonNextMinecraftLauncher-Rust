# BonNext Yggdrasil 皮肤站登录与皮肤管理设计文档

**日期**: 2026-05-24
**状态**: 已批准
**范围**: 通用 Yggdrasil 协议支持 + LittleSkin 预设 + 皮肤管理 + 3D 预览

---

## 1. 概述

为 BonNext 启动器添加通用 Yggdrasil 协议支持，使用户能够通过第三方皮肤站（如 LittleSkin）登录 Minecraft，并在启动器内管理角色和皮肤。启动游戏时自动注入 authlib-injector 实现外置登录。

**协议**: 通用 Yggdrasil（兼容所有 Yggdrasil 协议皮肤站）
**预设**: LittleSkin / Blessing Studio / 自定义
**皮肤管理**: 皮肤上传/更换、角色管理、3D 皮肤预览

---

## 2. Yggdrasil 协议后端

### 2.1 认证模块

新增 `src-tauri/src/auth/yggdrasil.rs`

**Yggdrasil 协议 API 端点**:

| 端点                                                                    | 方法 | 功能                   |
| ----------------------------------------------------------------------- | ---- | ---------------------- |
| `{server}/api/yggdrasil/authserver/authenticate`                        | POST | 密码登录               |
| `{server}/api/yggdrasil/authserver/refresh`                             | POST | Token 刷新             |
| `{server}/api/yggdrasil/authserver/validate`                            | POST | Token 验证             |
| `{server}/api/yggdrasil/authserver/signout`                             | POST | 登出（使 Token 失效）  |
| `{server}/api/yggdrasil/authserver/invalidate`                          | POST | 使 Token 失效          |
| `{server}/api/yggdrasil/sessionserver/session/minecraft/profile/{uuid}` | GET  | 获取玩家档案（含皮肤） |

**数据结构**:

```rust
pub struct YggdrasilAuthResult {
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub client_token: String,
    pub server_url: String,
    pub available_profiles: Vec<YggdrasilProfile>,
    pub selected_profile: Option<YggdrasilProfile>,
}

pub struct YggdrasilProfile {
    pub id: String,
    pub name: String,
}
```

**登录流程**:

1. 用户输入服务器地址 + 邮箱 + 密码
2. 调用 `authenticate` API，请求体：

   ```json
   {
     "username": "邮箱",
     "password": "密码",
     "requestUser": true,
     "agent": { "name": "Minecraft", "version": 1 }
   }
   ```

3. 如果返回多个 `availableProfiles`，用户选择角色
4. 保存到 `AccountStore`（`account_type = "yggdrasil"`）
5. 记录安全审计日志

**Token 刷新**:

- `ensure_fresh_token()` 中新增 Yggdrasil 分支

- 使用 `client_token` + `access_token` 调用 refresh API

- 刷新成功后更新 `access_token` 和 `client_token`

### 2.2 皮肤管理 API

| 端点                                                                                   | 方法   | 功能                                |
| -------------------------------------------------------------------------------------- | ------ | ----------------------------------- |
| `{server}/api/yggdrasil/sessionserver/session/minecraft/profile/{uuid}?unsigned=false` | GET    | 获取含皮肤纹理的 profile            |
| `{server}/api/user/profile/{uuid}/skin`                                                | PUT    | 上传皮肤（multipart: model + file） |
| `{server}/api/user/profile/{uuid}/skin`                                                | DELETE | 重置皮肤为默认                      |

**皮肤 profile 响应格式**:

```json
{
  "id": "uuid",
  "name": "username",
  "properties": [
    {
      "name": "textures",
      "value": "base64编码的JSON",
      "signature": "签名"
    }
  ]
}
```

解码 `value` 后：

```json
{
  "timestamp": 1234567890,
  "profileId": "uuid",
  "profileName": "username",
  "textures": {
    "SKIN": { "url": "https://...", "metadata": { "model": "slim" } },
    "CAPE": { "url": "https://..." }
  }
}
```

### 2.3 authlib-injector 集成

**启动时注入逻辑**（在 `launch_game_inner` 中）:

1. 检查活跃账号是否为 Yggdrasil 类型
2. 如果是，检查本地是否已有 `authlib-injector.jar`
3. 如果没有，从 `https://authlib-injector.yushi.moe/artifact/latest/authlib-injector.jar` 下载
4. 验证下载的 jar 文件大小 > 0
5. 在 JVM 参数中注入：`-javaagent:{authlib-injector.jar路径}={server_url}`
6. 设置 `--username`、`--uuid`、`--accessToken` 为 Yggdrasil 的值
7. `user_type` 设为 `"mojang"`（authlib-injector 兼容此类型）

**存储位置**: `{game_dir}/shared/authlib-injector.jar`

**下载逻辑**: 复用现有 `download::queue` 模块，下载完成后记录审计日志

---

## 3. 数据模型变更

### 3.1 StoredAccount 扩展

在现有 `StoredAccount` 结构体中新增字段：

```rust
pub struct StoredAccount {
    // ... 现有字段 ...
    pub yggdrasil_client_token: Option<String>,
    pub yggdrasil_server_url: Option<String>,
    pub yggdrasil_selected_profile: Option<String>,
}
```

`account_type` 字段新增值：`"yggdrasil"`

### 3.2 预设服务器列表

```rust
const YGGDRASIL_PRESETS: &[(&str, &str)] = &[
    ("LittleSkin", "https://littleskin.cn/api/yggdrasil"),
    ("Blessing Studio", "https://bsgchina.cn/api/yggdrasil"),
    ("自定义", ""),
];
```

---

## 4. 新增 Tauri Commands

| Command                    | 参数                                             | 功能                        |
| -------------------------- | ------------------------------------------------ | --------------------------- |
| `yggdrasil_login`          | server_url, email, password                      | Yggdrasil 密码登录          |
| `yggdrasil_refresh_token`  | (无参，使用活跃账号)                             | 刷新 Yggdrasil token        |
| `yggdrasil_get_profile`    | uuid, server_url, access_token                   | 获取玩家档案（含皮肤信息）  |
| `yggdrasil_upload_skin`    | uuid, server_url, access_token, file_path, model | 上传皮肤                    |
| `yggdrasil_reset_skin`     | uuid, server_url, access_token                   | 重置皮肤                    |
| `yggdrasil_select_profile` | account_id, profile_id                           | 选择角色                    |
| `get_yggdrasil_presets`    | (无参)                                           | 获取预设服务器列表          |
| `ensure_authlib_injector`  | (无参)                                           | 确保已下载 authlib-injector |

---

## 5. 前端 UI

### 5.1 设置页新增「皮肤站」SectionCard

在 `general` 导航分类中，在 `sec-account` 之后新增 `sec-skin-station`。

**UI 布局**:

| 区域        | 内容                        | 显示条件 |
| ----------- | --------------------------- | -------- |
| 服务器配置  | 服务器地址输入框 + 预设下拉 | 始终     |
| 登录表单    | 邮箱 + 密码 + 登录按钮      | 未登录   |
| 账号状态    | 用户名 + 服务器 + 登出按钮  | 已登录   |
| 角色选择    | 角色列表 + 选择按钮         | 多角色   |
| 3D 皮肤预览 | skinview3d 渲染 + 模型切换  | 已登录   |
| 皮肤上传    | 文件选择 + 上传 + 重置按钮  | 已登录   |

### 5.2 3D 皮肤预览

使用 `skinview3d` 库（\~30KB gzipped）：

- 渲染 Minecraft 皮肤 3D 模型

- 支持鼠标旋转、缩放

- 支持经典（Steve）和纤细（Alex）模型切换

- 皮肤纹理从 Yggdrasil API 获取的 URL 加载

- 自动旋转动画

**新增依赖**: `skinview3d`（npm 包）

### 5.3 账号类型 Badge 更新

将当前 `access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'` 改为使用 `account_type` 字段：

- `offline` → OFFLINE

- `microsoft` → MICROSOFT

- `yggdrasil` → YGGDRASIL（使用项目 accent 色 #FFE600）

---

## 6. 新增文件结构

### 后端

```
src-tauri/src/auth/
├── mod.rs              # 新增 pub mod yggdrasil;
├── yggdrasil.rs        # 新建：Yggdrasil 协议实现
├── microsoft.rs        # 不变
├── offline.rs          # 不变
└── token_store.rs      # 修改：新增 yggdrasil 字段 + ensure_fresh_token 分支
```

### 前端

```
src/
├── components/ui/
│   ├── SkinViewer3D.tsx          # 新建：3D 皮肤预览组件
│   └── SkinViewer3D.module.css
├── pages/SettingsPage.tsx        # 修改：新增皮肤站 SectionCard
```

---

## 7. 修改文件清单

| 文件                                | 修改内容                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `src-tauri/src/auth/mod.rs`         | 新增 `pub mod yggdrasil;`                                                      |
| `src-tauri/src/auth/token_store.rs` | StoredAccount 新增 3 个 yggdrasil 字段；ensure_fresh_token 新增 yggdrasil 分支 |
| `src-tauri/src/commands/auth.rs`    | 新增 8 个 Yggdrasil 相关命令                                                   |
| `src-tauri/src/lib.rs`              | 注册新命令                                                                     |
| `src-tauri/src/launch/args.rs`      | 启动时注入 authlib-injector JVM 参数                                           |
| `src/api.ts`                        | 新增 Yggdrasil 类型 + API 方法                                                 |
| `src/stores/authStore.tsx`          | 新增 yggdrasilLogin 方法                                                       |
| `src/pages/SettingsPage.tsx`        | 新增皮肤站 SectionCard + Badge 修复                                            |
| `src/pages/SettingsPage.module.css` | 新增皮肤站相关样式                                                             |

---

## 8. 安全考虑

- Yggdrasil 密码仅在登录时使用，不持久化（仅保存 access_token 和 client_token）

- client_token 和 access_token 通过现有 security::credential_store 加密存储

- authlib-injector.jar 下载使用 HTTPS，验证文件大小

- 服务器 URL 输入经过 sanitizer::sanitize_url 验证

- 所有 Yggdrasil API 调用记录审计日志
