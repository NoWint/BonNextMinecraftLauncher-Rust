# BonNext GitHub #1 全维度碾压设计

> 目标：将 BonNext 推向 GitHub MC 启动器品类第一——功能完备、架构卓越、视觉惊艳、社区活跃。
> 策略：四波次递进，每波并行推进架构/功能/视觉三个维度。
> 平台：Windows + macOS + Linux 全覆盖。

---

## 当前状态评估

| 维度 | 评分 | 关键问题 |
|------|------|---------|
| 架构 | 6/10 | lib.rs 3524行巨型文件、手写路由、依赖重叠、前端零测试 |
| 功能 | 7/10 | 核心启动完整，但12+占位空壳实现 |
| 视觉 | 7/10 | 赛博朋克风格有辨识度，但微交互和动画深度不足 |
| 测试 | 4/10 | Rust 核心有基本测试，前端零覆盖，无集成测试 |
| 安全 | 6/10 | Token 明文存储、CF API Key 硬编码、手写 HTML 解析 |
| 文档 | 9/10 | 优秀，但 README 路线图过时 |

---

## Wave 1 — 地基（架构先行 + 高感知功能 + 交互框架）

### 1.1 架构：lib.rs 拆分 + 路由迁移 + 依赖清理

**lib.rs 拆分为 commands/ 模块体系：**

```
src-tauri/src/
├── lib.rs                    # 瘦身至 ~300行：run() + AppState + 命令注册
├── commands/                 # 新增
│   ├── mod.rs               # 公共导出
│   ├── auth.rs              # Microsoft OAuth + 离线 + 账户管理
│   ├── config.rs            # 配置读写
│   ├── instance.rs          # 实例 CRUD + 快照 + 磁盘分析
│   ├── launch.rs            # 启动/停止/状态查询
│   ├── version.rs           # 版本清单 + 下载 + 解析
│   ├── download.rs          # 下载队列控制
│   ├── modrinth.rs          # Modrinth API 命令
│   ├── curseforge.rs        # CurseForge API 命令
│   ├── content.rs           # 内容安装/更新/冲突
│   ├── collections.rs       # 收藏 CRUD
│   ├── system.rs            # 硬件 + 电池 + 磁盘 + Java
│   ├── server.rs            # 服务器状态 + SLP 协议 + LAN 发现
│   ├── social.rs            # Discord Rich Presence
│   ├── network.rs           # P2P 传输 + Web API
│   ├── cli.rs               # CLI 模式
│   ├── news.rs              # Minecraft 新闻 + HTML 解析
│   ├── world.rs             # NBT 解析 + 世界信息
│   ├── optimization.rs      # 优化预设 + GC 调优 + 帧分析
│   ├── achievement.rs       # 成就系统
│   └── search.rs            # NLP 搜索
```

**原则：**
- 命令层只做参数解析 + 调用逻辑层 + 返回结果，不含业务逻辑
- 结构体跟随命令（SnapshotInfo → instance.rs，ConflictInfo → content.rs）
- HTML 解析引入 `scraper` crate 替代手写实现
- SLP 协议提取到 server.rs

**前端路由迁移：**
- `App.tsx` 中 `getPageFromHash()` → `react-router-dom` 的 `<HashRouter>` + `<Routes>`
- 路由参数通过 `useParams()` 获取
- 保持 hash 模式（Tauri 要求）

**依赖清理：**

| 操作 | 依赖 | 原因 |
|------|------|------|
| 移除 | `futures` | 与 `futures-util` 重叠 |
| 移除 | `opener` | 与 `webbrowser` 重叠 |
| 移除 | `lazy_static` | 用 `std::sync::OnceLock` 替代 |
| 新增 | `scraper` | HTML 解析替代手写 |
| 收窄 | `tokio` | `full` → `["rt-multi-thread", "macros", "time", "io-util", "process", "sync"]` |

### 1.2 功能：Discord RPC + LAN 发现 + GPU 检测 + 电池管理

**Discord Rich Presence：**
- 新增依赖：`discord-rich-presence` crate（纯 Rust 实现，无 SDK 依赖）
- 功能：显示当前游戏版本、加载器、服务器地址、游戏时长
- 状态映射：idle → "在 BonNext 中浏览"，downloading → "下载 Minecraft {version}"，running → "正在游玩 Minecraft {version}"
- 前端：SettingsPage 增加 Discord RPC 开关（默认开启）

**LAN 世界发现：**
- 实现 MC LAN 广播监听（UDP 4445 组播）
- 解析 MC LAN 广播格式：`[MOTD]§[port]§[world-type]`
- 前端：InstancesPage 或 HomePage 增加"局域网世界"面板，显示发现的 LAN 游戏
- 自动刷新（5秒间隔），可手动停止

**GPU 检测修复：**
- `sysinfo` crate 已支持 GPU 检测，当前代码硬编码 "Unknown"
- 使用 `sysinfo::Components` 或 `sysinfo::Graphics` API 获取 GPU 名称和 VRAM
- 映射到 `HardwareProfile` 的 `gpu_name` 和 `gpu_vram_mb` 字段

**电池管理：**
- macOS：IOKit 电源源查询
- Linux：读取 `/sys/class/power_supply/` 或 UPower D-Bus
- Windows：`GetSystemPowerStatus` WinAPI
- 使用 `sysinfo` crate 的统一 API（已支持电池查询）
- 前端：低电量时自动建议节能模式（降低分配内存、关闭粒子效果）

### 1.3 视觉：微交互框架 + 加载态统一

**微交互框架：**
- 全局交互反馈系统：按钮点击波纹、卡片悬浮光效、侧边栏选中指示器动画
- 统一 `transition` 时长：快速 150ms（hover）、标准 250ms（展开）、慢速 400ms（页面切换）
- 新增 `--transition-fast/medium/slow` CSS 变量到 tokens.css
- 所有交互元素添加 `:active` 缩放反馈（scale 0.97）

**加载态统一：**
- 替换所有页面中的"加载中"文本为 Skeleton 组件
- Skeleton 采用赛博朋克风格：clip-path 切角 + 黄色闪烁 shimmer
- 统一 `useLoading` hook：管理加载状态 + 自动超时 + 错误回退
- 数据加载时显示骨架屏，API 错误时显示重试卡片

---

## Wave 2 — 骨架（测试体系 + 命令模块化 + Token 加密 + P2P/CLI/NBT）

### 2.1 架构：测试框架 + Token 加密 + ESLint

**前端测试框架：**
- 引入 Vitest + @testing-library/react + @testing-library/jest-dom
- 配置文件：`vitest.config.ts`
- 优先覆盖：Store reducers（authStore, configStore, instanceStore）、api.ts 缓存逻辑、工具函数
- 目标：核心逻辑 80% 覆盖率

**Rust 测试增强：**
- 为每个 `commands/` 模块添加单元测试
- 新增 `tests/` 集成测试目录：模拟 Tauri 命令调用
- 关键集成测试：完整启动流程（版本解析 → 下载 → 参数构建 → 进程启动）

**Token 加密：**
- 使用已有的 `aes-gcm` + `hkdf` + `sha2` 依赖（当前已引入但未使用）
- 加密方案：HKDF(设备指纹) → AES-256-GCM 加密 Token
- 设备指纹来源：机器 ID（`sysinfo::System::host_id()`）+ 用户名
- 迁移路径：首次读取明文 Token → 加密存储 → 删除明文文件
- `token_store.rs` 自动处理解密/加密，对命令层透明

**代码质量工具：**
- 前端：ESLint + Prettier + husky + lint-staged
- Rust：cargo clippy 作为 CI 必须通过的门禁
- 提交前自动格式化 + lint 检查

### 2.2 功能：P2P 传输 + CLI 模式 + NBT 解析

**P2P 局域网传输：**
- 协议：基于 QUIC（`quinn` crate）或简化 TCP 直连
- 发现：mDNS/DNS-SD 局域网对等节点发现
- 功能：实例导出 → 发送给局域网内其他 BonNext 用户
- 安全：传输前确认 + SHA256 校验
- 前端：SettingsPage 的"局域网"面板显示已发现的对等节点

**CLI 模式：**
- 子命令：`bonnext launch <instance>`、`bonnext list`、`bonnext download <version>`
- 使用 `clap` crate 解析命令行参数
- Tauri 的 `cli` 配置在 `tauri.conf.json` 中
- 输出：结构化 JSON 或人类可读表格（`--format json/table`）

**NBT 解析（parse_level_dat_basic）：**
- 实现完整的 NBT（Named Binary Tag）解析器
- 支持：gzip 压缩的 level.dat 文件
- 提取：游戏模式、难度、种子、世界名称、时间
- 新增模块：`src-tauri/src/nbt.rs`

### 2.3 视觉：动画系统升级 + 页面过渡

**动画系统：**
- 基于 CSS `@keyframes` + `animation` 的统一动画库
- 新增 `styles/animations.css`：
  - `slideInLeft/Right/Up/Down` — 页面切换
  - `fadeIn/fadeOut` — 内容出现/消失
  - `scaleIn/scaleOut` — 弹窗/模态框
  - `glitchIn` — 赛博朋克故障效果（用于标题、重要通知）
  - `pulseGlow` — 黄色脉冲光效（用于主按钮、进度条）
  - `scanLine` — 扫描线动画（用于加载状态）
- 所有动画尊重 `prefers-reduced-motion`

**页面过渡：**
- 路由切换时添加 `slideInLeft` → 当前页 + `slideInRight` → 新页
- 使用 `react-router-dom` 的路由动画（`useLocation` + `AnimatePresence` 模式）
- 侧边栏选中项跟随路由变化，带滑动指示器动画

---

## Wave 3 — 血肉（集成测试 + Web API + NLP 搜索 + 深度视觉打磨）

### 3.1 架构：集成测试 + 安全审计 + 覆盖率

**集成测试：**
- `src-tauri/tests/` 目录：
  - `auth_flow.rs` — 完整 OAuth 流程模拟
  - `download_flow.rs` — 下载 → 校验 → 安装流程
  - `launch_flow.rs` — 版本解析 → JVM 参数 → 进程启动
  - `content_flow.rs` — 搜索 → 安装 → 更新检查
- 使用 `mockito` crate mock HTTP 响应

**安全审计：**
- Token 加密验证（Wave 2 实现后）
- CurseForge API Key 改为运行时环境变量读取，移除硬编码
- `cargo audit` 集成到 CI
- CSP 策略审查和加固
- 路径遍历防护全面检查

**代码覆盖率：**
- Rust：`cargo-llvm-cov` 生成覆盖率报告
- 前端：Vitest 覆盖率（c8 provider）
- CI 中添加覆盖率门禁（Rust ≥ 70%，前端 ≥ 60%）

### 3.2 功能：Web API + NLP 搜索

**Web API 服务器：**
- 内嵌 HTTP 服务器（`axum` 或 `actix-web`，推荐 `axum` 与 tokio 生态一致）
- 端口：随机分配或用户配置
- 认证：启动时生成随机 Token，请求需携带 `Authorization: Bearer <token>`
- 端点：
  - `GET /api/status` — 启动器状态
  - `GET /api/instances` — 实例列表
  - `POST /api/instances/:id/launch` — 远程启动
  - `GET /api/downloads` — 下载进度
  - `POST /api/downloads/pause|resume` — 控制下载
- 前端：SettingsPage 显示 Web API 状态和 Token

**NLP 搜索增强：**
- 本地实现，不依赖外部 API
- 方案：TF-IDF + 同义词扩展
- 同义词表：MC 社区常用术语映射（"光影" → "shader"，"整合包" → "modpack"）
- 搜索流程：用户输入 → 同义词扩展 → TF-IDF 排序 → 合并 Modrinth/CF 结果
- 中英文分词：英文空格分词，中文按字符分词（简化方案，避免引入重型分词库）

### 3.3 视觉：赛博朋克深度打磨 + 音效系统

**赛博朋克视觉深化：**
- 粒子背景升级：从静态粒子 → 动态数据流效果（类似矩阵雨但更赛博朋克）
- 扫描线叠加层优化：降低不透明度至 5%，避免影响可读性
- 噪点纹理优化：SVG noise 替换为 CSS `filter: url(#noise)`，性能更好
- 新增"全息投影"效果：卡片悬浮时边缘出现蓝色/黄色光晕
- 新增"数据流"边框动画：关键区域（启动面板、下载进度）边框显示流动数据效果
- 暗色主题对比度提升：确保所有文本满足 WCAG AA 标准（4.5:1）

**音效系统：**
- 新增 `utils/sound.ts` 扩展：统一音效管理器
- 音效类型：
  - 交互音：按钮点击、开关切换、标签切换
  - 状态音：下载完成、安装成功、错误提示
  - 氛围音：启动游戏时的短暂电子音效
- 音效文件：小型合成音效（< 5KB 每个），内嵌为 base64 或放在 assets/
- 设置：SettingsPage 增加音效开关和音量滑块
- 所有音效尊重系统静音状态

---

## Wave 4 — 抛光（性能优化 + 成就/GC/帧分析 + 最终视觉 QA）

### 4.1 架构：性能优化 + 文档完善

**性能优化：**
- Rust：`cargo bench` 基准测试，识别热点
- 前端：React DevTools Profiler 分析渲染瓶颈
- 关键优化目标：
  - 冷启动时间 < 2s
  - 页面切换 < 200ms
  - 内存占用 < 150MB（空闲态）
  - 下载引擎满带宽利用
- 懒加载：非首屏页面代码分割（React.lazy + Suspense）
- 虚拟列表：长列表（版本列表、模组列表）使用虚拟滚动

**文档完善：**
- README 更新：反映当前功能状态，移除过时路线图
- 新增 `docs/API.md`：所有 Tauri 命令的 API 文档
- 新增 `docs/CONTRIBUTING-CODE.md`：代码贡献指南（模块结构、命名规范、测试要求）
- CHANGELOG 自动化：通过 CI 在 release 时从 git log 生成

### 4.2 功能：成就系统 + GC 调优 + 帧时间分析

**成就系统完善：**
- 当前 10 个成就定义已有，需接入触发逻辑
- 触发点：
  - "首次启动" → launch_game 成功时
  - "模组收藏家" → 安装 10/50/100 个模组时
  - "多实例大师" → 创建 5 个实例时
  - "速度恶魔" → 下载速度超过 50MB/s 时
  - "社区贡献者" → 使用收藏/分享功能时
- 前端：成就解锁时显示赛博朋克风格通知（glitch 动画 + 音效）
- 成就页面：展示所有成就及解锁进度

**GC 调优建议系统：**
- 基于硬件配置 + 实例设置动态生成 GC 参数建议
- 规则引擎：
  - 内存 ≤ 4GB → G1GC + 512MB 堆
  - 内存 4-8GB → G1GC + 1-2GB 堆
  - 内存 ≥ 8GB → ZGC + 4GB+ 堆
  - 模组数量 > 100 → 增大 Metaspace
- 前端：实例设置页显示 GC 建议卡片，一键应用

**帧时间分析：**
- 从游戏日志中解析 FPS 数据（已有基础实现）
- 增强：实时采集游戏进程的帧时间（通过共享内存或日志 tail）
- 前端：实例详情页显示帧时间图表（使用 Canvas 绘制）
- 异常检测：帧时间 > 50ms 标记为卡顿，给出优化建议

### 4.3 视觉：最终 QA + 无障碍

**视觉 QA：**
- 所有页面在三种主题（dark/light/OLED）下逐一检查
- 三平台截图对比，确保一致性
- 动画流畅度测试（60fps 目标）
- 字体渲染检查（Bebas Neue / Inter / DM Mono 在三平台上的表现）

**无障碍：**
- 键盘导航：所有交互元素可通过 Tab 访问，焦点指示器清晰可见
- ARIA 标签：所有图标按钮添加 `aria-label`
- 屏幕阅读器：关键信息区域添加 `role` 和 `aria-live`
- 对比度：所有文本满足 WCAG AA（4.5:1 普通文本，3:1 大文本）
- `prefers-reduced-motion`：所有动画在该设置下禁用或简化
- `prefers-color-scheme`：自动跟随系统主题

---

## 新增依赖汇总

### Rust (Cargo.toml)

| 依赖 | 用途 | Wave |
|------|------|------|
| `scraper` | HTML 解析 | 1 |
| `discord-rich-presence` | Discord RPC（三平台支持） | 1 |
| `clap` | CLI 参数解析 | 2 |
| `quinn` | QUIC/P2P 传输 | 2 |
| `mdns-sd` | mDNS 发现 | 2 |
| `axum` | Web API 服务器 | 3 |
| `tower-http` | axum 中间件 | 3 |
| `mockito` | HTTP mock 测试 | 3 |

### 前端 (package.json)

| 依赖 | 用途 | Wave |
|------|------|------|
| `vitest` | 测试框架 | 2 |
| `@testing-library/react` | 组件测试 | 2 |
| `@testing-library/jest-dom` | DOM 断言 | 2 |
| `eslint` | 代码检查 | 2 |
| `prettier` | 代码格式化 | 2 |
| `husky` | Git hooks | 2 |
| `lint-staged` | 暂存区 lint | 2 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| lib.rs 拆分引入回归 | 拆分前后运行完整测试套件，逐步迁移 |
| P2P 跨平台兼容性 | 优先实现 TCP 直连模式，QUIC 作为增强 |
| Discord RPC 审核要求 | 使用社区维护的 `discord-rich-presence` crate，无需官方 SDK |
| NBT 解析复杂度 | 先支持 level.dat 常用标签，后续扩展 |
| Web API 安全风险 | 随机 Token + 仅监听 localhost + CORS 限制 |
| 音效增加包体积 | 使用合成音效，每个 < 5KB，总计 < 50KB |
| 动画性能影响 | 尊重 prefers-reduced-motion，使用 CSS 硬件加速 |

---

## 成功标准

| 指标 | 目标 |
|------|------|
| GitHub Stars | > 5000（MC 启动器品类前 3） |
| 代码质量 | Rust clippy 零 warning，前端 ESLint 零 error |
| 测试覆盖率 | Rust ≥ 70%，前端 ≥ 60% |
| 冷启动时间 | < 2s |
| 功能完成度 | 0 占位实现，所有声明的功能真实可用 |
| 无障碍 | WCAG AA 合规 |
| 三平台一致性 | 功能和视觉在 Windows/macOS/Linux 上一致 |
