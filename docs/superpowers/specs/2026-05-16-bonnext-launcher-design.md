# BonNext Launcher — 设计规格说明书

**日期**: 2026-05-16  
**版本**: v0.1.0 (MVP)  
**核心目标**: 跨平台、稳定、极速、启动 Minecraft Java Edition

---

## 1. 项目概述

BonNext 是一个跨平台（Windows + macOS）的 Minecraft Java Edition 启动器。MVP 阶段聚焦于“用最快的速度让用户玩上游戏”，包含完整的认证、下载、启动流程。

### 1.1 核心设计原则

| 原则 | 含义 |
|------|------|
| **极速** | 冷启动目标 < 2 秒（含 WebView 拉起）；启动 Minecraft 的额外开销最小化 |
| **稳定** | 状态机锁死非法操作；三层容错防御；任何失败都有明确的恢复路径 |
| **跨平台** | Windows 10+ 和 macOS 12+，一套代码两个平台 |
| **最小惊喜** | 界面极简，核心操作不超过 3 步 |

### 1.2 非目标（v0.1 不做）

- Mod/Modpack 管理
- 多实例/多账号管理
- 皮肤/披风自定义
- 第三方服务器联机
- 自动更新（启动器自身）

---

## 2. 技术选型

| 层次 | 技术 | 理由 |
|------|------|------|
| **桌面壳** | Tauri 2.x | Rust 驱动的轻量桌面框架，比 Electron 快 3-5 倍 |
| **核心引擎** | Rust | 零成本抽象，编译器保证内存安全，原生性能 |
| **Web 前端** | React 18 + TypeScript | 组件化开发，类型安全 |
| **样式** | 手写 CSS（无 UI 框架） | 减少依赖体积，极致轻量 |
| **包管理** | pnpm + Vite | 快速的包管理和构建 |
| **HTTP 客户端** | reqwest | Rust 生态中最成熟的异步 HTTP 库 |
| **JSON 处理** | serde + serde_json | Rust 标准 JSON 序列化 |
| **日志** | tracing | 结构化异步日志 |

---

## 3. 整体架构

```
┌─────────────────────────────────────────────────┐
│                  Tauri 壳                        │
│  ┌───────────────────────────────────────────┐  │
│  │          Web 前端 (React + TS)             │  │
│  │  ┌─────────┐ ┌────────┐ ┌─────────────┐  │  │
│  │  │ 登录页   │ │ 主页   │ │ 设置/启动页   │  │  │
│  │  └─────────┘ └────────┘ └─────────────┘  │  │
│  └──────────────┬────────────────────────────┘  │
│                 │ invoke / listen                │
│  ┌──────────────▼────────────────────────────┐  │
│  │          Rust 核心引擎                      │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐ │  │
│  │  │ 认证  │ │ 版本  │ │ 下载  │ │  启动    │ │  │
│  │  │ 模块  │ │ 管理  │ │ 管理  │ │  引擎    │ │  │
│  │  └──────┘ └──────┘ └──────┘ └──────────┘ │  │
│  │                    ┌──────────┐            │  │
│  │                    │ 平台适配  │            │  │
│  │                    └──────────┘            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                           │ 子进程
                    ┌──────▼──────┐
                    │  Minecraft   │
                    │ (Java 进程)  │
                    └─────────────┘
```

**通信机制**：
- 前端 → Rust：通过 Tauri `invoke` 调用命令
- Rust → 前端：通过 Tauri `emit` 推送事件（进度、状态变更）

---

## 4. Rust 核心引擎

### 4.1 模块划分

```
src-tauri/src/
├── main.rs              # Tauri 入口
├── lib.rs               # 模块注册
├── auth/
│   ├── mod.rs           # 认证模块入口
│   ├── microsoft.rs     # Microsoft OAuth 2.0 流程
│   └── session.rs       # Token 缓存与刷新
├── version/
│   ├── mod.rs           # 版本管理入口
│   ├── manifest.rs      # 版本清单解析
│   └── resolver.rs      # 版本依赖解析 (libraries, assets)
├── download/
│   ├── mod.rs           # 下载管理入口
│   ├── queue.rs         # 下载队列与并发控制
│   └── verifier.rs      # SHA1 校验
├── launch/
│   ├── mod.rs           # 启动引擎入口
│   ├── args.rs          # JVM 参数构建
│   ├── process.rs       # 进程管理与监听
│   └── state.rs         # 启动状态机
├── platform/
│   ├── mod.rs           # 平台抽象入口
│   ├── java.rs          # Java 运行时定位
│   └── paths.rs         # 游戏目录管理
├── config.rs            # 用户配置读写
└── error.rs             # 统一错误类型
```

### 4.2 认证模块

**流程**：
1. 前端点击“微软登录” → 调用 `auth_start_login`
2. Rust 打开系统浏览器，导航到 Microsoft OAuth 授权页面
3. 用户完成授权 → 浏览器重定向到 `localhost:PORT/callback`
4. Rust 启动本地 HTTP 服务器接收回调，获取 `authorization_code`
5. 用 `authorization_code` 换取 `access_token` + `refresh_token`
6. 用 `access_token` 换取 Xbox Live token → XSTS token → Minecraft token
7. 用 Minecraft token 获取玩家 UUID 和用户名
8. 缓存 refresh_token 到本地（加密存储）

**支持的模式**：
- 正版在线登录（Microsoft OAuth）
- 离线模式（仅输入用户名，跳过认证）

### 4.3 版本管理模块

**流程**：
1. 从 `https://launchermeta.mojang.com/mc/game/version_manifest.json` 获取版本清单
2. 缓存版本清单到本地（24 小时过期）
3. 用户选择版本后，下载并解析该版本的 JSON
4. 解析出：libraries 列表、assets 索引、主 jar 信息、JVM 参数、游戏参数
5. 对比本地已有文件，生成下载清单（diff）

### 4.4 下载管理模块

**下载策略**：
- 并发数：8（可配置）
- 每个文件最大重试 3 次，指数退避（1s → 2s → 4s）
- 使用 HTTP Range 请求实现断点续传
- 每个文件下载完成后立即 SHA1 校验，不一致则重新下载
- 下载进度实时通过事件推送到前端

**下载源**：
- Libraries：`https://libraries.minecraft.net/`
- Assets：`https://resources.download.minecraft.net/`
- 可扩展镜像源支持

### 4.5 启动引擎

**JVM 参数构建规则**：
1. 读取版本 JSON 中的 `arguments.jvm`，替换模板变量
2. 拼接所有 libraries 构建 classpath（Windows 用 `;`，macOS 用 `:`）
3. 添加用户自定义 JVM 参数
4. 设置 `-Xmx` 等内存参数

**进程管理**：
- `Command::new("java").args(...).spawn()` 启动子进程
- 非阻塞读取 stdout/stderr
- stdout 行缓存，通过事件推送到前端
- 子进程退出时，检查 exit code：
  - `0` → 正常退出
  - `非0` → 崩溃，捕获 stderr 生成崩溃报告
- 启动器退出时，检查是否有运行中的 Minecraft，有则询问是否一起关闭

### 4.6 平台适配层

**Java 定位策略**：

| 平台 | 查找顺序 |
|------|----------|
| Windows | 环境变量 `JAVA_HOME` → `PATH` → 注册表 → 引导用户安装 |
| macOS | `/usr/bin/java` → `/usr/libexec/java_home` → Homebrew → 引导用户安装 |

**游戏目录**（`.minecraft` 路径）：

| 平台 | 默认路径 |
|------|----------|
| Windows | `%APPDATA%/.bonnext` |
| macOS | `~/Library/Application Support/bonnext` |

不直接使用官方 `.minecraft` 目录，避免冲突。

---

## 5. Web 前端

### 5.1 页面结构

```
前端路由
├── /login       登录页
├── /            主页（主面板）
├── /settings    设置页
└── /download    下载进度页（覆盖层/模态）
```

### 5.2 登录页

- 微软账号登录按钮（一大颗）
- 登录状态指示（Loading / 成功 / 失败）
- 离线模式入口（小字链接：“或跳过登录，使用离线模式”）
- 登录成功后自动跳转主页

### 5.3 主页（主面板）

```
┌────────────────────────────────┐
│  [玩家头像] 玩家名              │
│                                │
│     Minecraft 版本              │
│  ┌──────────────────────┐      │
│  │ 1.21.4          ▼    │      │
│  └──────────────────────┘      │
│                                │
│       ┌──────────┐             │
│       │  开始游戏  │             │
│       └──────────┘             │
│                                │
│  ⚙ 设置    ❓ 登出             │
└────────────────────────────────┘
```

- 版本下拉框：从 Rust 拉取版本列表，默认选最新 release
- 开始游戏按钮：最醒目，触发启动流程
- 游戏运行时按钮变为“游戏运行中...”（灰色不可点）

### 5.4 设置页

- Java 运行时路径（文本框 + 浏览按钮）
- 内存分配（滑块：1GB - 系统内存的 80%）
- 游戏窗口分辨率
- JVM 额外参数（高级选项，折叠）
- 启动后行为（保持启动器 / 关闭启动器 / 最小化到托盘）

### 5.5 下载进度页

- 以半透明覆盖层形式出现在主页上方
- 总进度条 + “正在下载：xxx.jar (45/128)”
- 下载速度（MB/s）
- 取消按钮（取消后清理已下载的部分文件）

---

## 6. 数据流与状态管理

### 6.1 启动流程状态机

```
                    ┌─────────┐
                    │  Idle   │
                    └────┬────┘
                         │ 用户点击 [开始游戏]
                    ┌────▼────┐
                    │Checking │ ← 检查 Java、版本完整性
                    └────┬────┘
                         │ 有缺失
                    ┌────▼────────┐
                    │Downloading  │ → 实时推送进度
                    └────┬────────┘
                         │ 完成
                    ┌────▼────┐
                    │Validating│ ← SHA1 校验
                    └────┬────┘
                         │ 通过
                    ┌────▼────┐
                    │Launching │ ← 构建参数并 spawn
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ Running │ ← 监听子进程
                    └────┬────┘
                         │ 进程退出
               ┌─────────┴─────────┐
          ┌────▼────┐       ┌─────▼─────┐
          │ Exited  │       │  Crashed  │
          │(code=0) │       │(code≠0)   │
          └─────────┘       └───────────┘
```

**所有状态为互斥**，任何时候只有一个状态有效。

### 6.2 前端状态管理

使用 React Context + useReducer：

```typescript
type AppState = {
  auth: { loggedIn: boolean; username: string; uuid: string };
  versions: { list: VersionInfo[]; selected: string };
  launch: LaunchState; // 与 Rust 状态机同步
  settings: { javaPath: string; maxMemory: number; jvmArgs: string };
};
```

Rust 通过 Tauri events 推送状态变更，前端 reducer 处理状态转换。

---

## 7. 错误处理与可靠性

### 7.1 故障场景与对策

| 故障 | 级别 | 对策 |
|------|------|------|
| Java 未安装 | 阻塞 | 引导用户安装，提供下载链接 |
| 磁盘空间不足（< 1GB） | 阻塞 | 拒绝下载，提示清理空间 |
| 网络不可达 | 阻塞 | 明确提示网络错误，给出检查建议 |
| 下载中断 | 可恢复 | 断点续传 + 最多 3 次自动重试 |
| SHA1 校验失败 | 可恢复 | 删除该文件并重新下载 |
| OAuth 超时（120s） | 可恢复 | 提示超时并允许重试 |
| 启动参数不完整 | 阻塞 | 重新执行检查流程 |
| 游戏进程崩溃 | 可恢复 | 收集日志，显示崩溃报告 |
| 启动器崩溃 | 灾难 | 确保 Minecraft 子进程也被清理 |

### 7.2 日志系统

- 路径：`{game_dir}/logs/launcher.log`
- 轮转策略：保留最近 5 个文件，每个最大 10MB
- 崩溃日志标记为 `launcher.crash.log`，不被轮转覆盖
- 日志级别：`INFO` 默认，`DEBUG` 可开启

### 7.3 并发安全

- 启动状态机锁死：`Running` 状态下禁止再次调用启动命令
- 下载队列为原子操作，不存在部分下载被覆盖
- 配置文件读写使用文件锁

---

## 8. 目录结构总览

```
BonNext/
├── src-tauri/                # Rust 核心 + Tauri 配置
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── auth/
│   │   ├── version/
│   │   ├── download/
│   │   ├── launch/
│   │   ├── platform/
│   │   ├── config.rs
│   │   └── error.rs
│   └── icons/
├── src/                      # Web 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── DownloadOverlay.tsx
│   ├── components/
│   ├── hooks/
│   ├── state/
│   │   └── appReducer.ts
│   └── styles/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-16-bonnext-launcher-design.md
```

---

## 9. 实现优先级

MVP 分三个阶段实现：

### Phase 1：骨架与启动（核心）
- Tauri 项目初始化
- 版本清单解析
- 下载模块（基础）
- 启动引擎（硬编码 Java 路径 + 测试版本）
- 前端主页 + 版本选择 + 启动按钮
- 验收：能从命令行 `tauri dev` 启动 Minecraft

### Phase 2：认证与体验
- Microsoft OAuth 登录流程
- Token 缓存与刷新
- 离线模式
- 下载进度界面
- 日志系统

### Phase 3：打磨
- 设置页
- Java 自动定位
- 错误处理完善
- 打包分发（`.msi` / `.dmg`）

---

## 10. 成功标准

1. **冷启动**：从双击到主界面可见 < 2 秒
2. **内存占用**：空闲时 < 100MB（含 WebView）
3. **下载可靠性**：100MB 文件的 SHA1 校验通过率 100%
4. **崩溃恢复**：任何可恢复错误有明确的用户提示和重试路径
5. **跨平台**：同一代码在 Windows 10+ 和 macOS 12+ 上编译通过并正常运行
