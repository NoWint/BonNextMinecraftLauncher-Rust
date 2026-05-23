# BonNext 50 个新功能设计文档

> 基于现有架构扩展的详细功能规格说明
> 日期: 2026-05-23
> 版本: v1.0

---

## 概述

本文档定义 BonNext 启动器在现有功能基础上的 50 个新功能。所有功能按类别组织，包含详细描述、技术实现方案、UI/UX 设计和优先级评估。

---

## 类别一：核心启动体验（1-8）

### 1. 智能一键启动（Smart Quick Launch）

**描述**: 在首页提供一键启动最近游玩的实例，无需任何额外点击。根据用户习惯自动选择最优实例。

**实现方案**:
- 后端: 在 `config.rs` 中新增 `last_played_instance` 和 `quick_launch_enabled` 字段
- 前端: HomePage 添加大型"继续游戏"按钮，显示最近实例的封面、版本、最后游玩时间
- 智能排序: 按 `last_played` 时间倒序，若实例不完整则自动跳过

**UI设计**: 首页中央放置 280x160px 的实例卡片，带缩略图、版本标签、"▶ 继续"按钮

**优先级**: P0

---

### 2. 游戏内叠加层（In-Game Overlay）

**描述**: 游戏运行时按 `F12` 呼出轻量叠加层，显示实时 FPS、内存使用、好友状态、快速设置。

**实现方案**:
- 后端: 使用 `tauri::window` 创建透明置顶窗口，通过共享内存/IPC 获取游戏进程信息
- 前端: Overlay 专用 React 组件树，极简风格（与主 UI 区分）
- 进程监控: 读取游戏进程内存占用，集成 `fps_counter` 库或通过 JNI 获取

**UI设计**: 左上角半透明面板，FPS 大字体显示，内存进度条，好友头像列表

**优先级**: P1

---

### 3. 崩溃自动诊断（Crash Auto-Diagnosis）

**描述**: 游戏崩溃后自动分析日志，识别已知问题（OOM、Mod 冲突、Java 版本不匹配），给出修复建议。

**实现方案**:
- 后端: 扩展 `crash_parser.rs`，添加规则引擎匹配常见崩溃模式
- 规则库: 正则表达式 + 关键词匹配，覆盖 50+ 种常见崩溃场景
- 修复建议: 每个规则关联修复动作（如"增加内存至 4GB"、"更新 Fabric API"）

**UI设计**: 崩溃后弹出 Modal，显示诊断结果（红色=严重/黄色=警告/绿色=可忽略），提供"一键修复"按钮

**优先级**: P0

---

### 4. 实例快照与回滚（Instance Snapshots）

**描述**: 为实例创建时间点快照，支持一键回滚到之前状态。使用写时复制（CoW）节省磁盘空间。

**实现方案**:
- 后端: 使用 `reflink`（Linux/macOS）或硬链接（Windows）实现 CoW 快照
- 存储: 每个实例的 `.snapshots/` 目录，保存差异文件列表
- 回滚: 恢复快照时反向应用差异

**UI设计**: InstanceDetailPage 添加"快照"标签页，时间轴展示，支持命名快照和自动快照策略

**优先级**: P1

---

### 5. 多开实例管理（Multi-Instance Launcher）

**描述**: 同时运行多个 Minecraft 实例，在启动器内统一管理所有运行中实例的状态。

**实现方案**:
- 后端: 将 `AppState.launch_state` 从单值改为 `HashMap<instance_id, LaunchState>`
- 进程管理: 每个实例独立进程，通过 PID 跟踪
- 资源隔离: 独立内存分配，防止互相干扰

**UI设计**: 侧边栏显示运行中实例数量徽章，点击展开快速切换面板

**优先级**: P1

---

### 6. 智能内存调优（Smart Memory Tuner）

**描述**: 根据系统总内存、实例模组数量、Java 版本自动推荐最优内存分配。

**实现方案**:
- 后端: 扩展 `auto_tune_memory()`，考虑模组数量权重（每个模组 +50MB 估算）
- 规则引擎: 低配(<8GB)=2-3GB, 中配(8-16GB)=4-6GB, 高配(>16GB)=6-12GB
- 动态调整: 游戏运行时监控内存使用，下次启动时优化

**UI设计**: SettingsPage 内存设置添加"自动优化"开关，显示推荐值和当前值对比

**优先级**: P0

---

### 7. 启动预热（Launch Pre-warming）

**描述**: 启动器打开后后台预加载 Java 运行时和常用库，减少首次启动等待时间。

**实现方案**:
- 后端: 启动器启动后创建低优先级线程，mmap 常用 JAR 文件到内存
- 缓存策略: 基于最近使用实例预测需要预加载的内容
- 资源控制: 仅在系统空闲时预热，避免影响其他应用

**UI设计**: 设置中添加"启动预热"选项，可选"始终/仅空闲时/关闭"

**优先级**: P2

---

### 8. 访客模式（Guest Mode）

**描述**: 提供不保存任何状态的临时游戏环境，适合朋友借用电脑时快速游玩。

**实现方案**:
- 后端: 创建临时实例目录（`/tmp/bonnext-guest-xxx`），退出时自动清理
- 隔离: 不访问已有存档、配置、账户信息
- 快捷入口: 登录页添加"访客游玩"按钮

**UI设计**: 登录页底部添加"访客模式"文字链接，启动时显示临时提示条

**优先级**: P2

---

## 类别二：内容生态扩展（9-18）

### 9. 资源包浏览器（Resource Pack Browser）

**描述**: 类似模组浏览器的资源包市场，支持浏览、搜索、预览、一键安装。

**实现方案**:
- 后端: 集成 Modrinth/CF 资源包 API，复用现有搜索基础设施
- 预览: 提取资源包内的 `pack.png` 作为缩略图
- 安装: 下载到 `resourcepacks/` 目录，自动在游戏内启用

**UI设计**: MarketplacePage 添加"资源包"标签页，卡片展示 pack.png 预览

**优先级**: P1

---

### 10. 光影包浏览器（Shader Pack Browser）

**描述**: 浏览和安装 Iris/Oculus 兼容的光影包，按显卡性能分级推荐。

**实现方案**:
- 后端: 集成 Iris 官方光影列表 API + Modrinth shader 分类
- 分级: 根据光影包描述中的性能标签（Low/Medium/High/Ultra）分类
- 依赖检查: 自动检查是否安装 Iris/Oculus，未安装时提示

**UI设计**: 卡片带性能标签徽章（绿色=低配友好，红色=高端卡），截图画廊预览

**优先级**: P1

---

### 11. 数据包管理器（Datapack Manager）

**描述**: 管理世界数据包，支持从 VanillaTweaks 等源浏览和安装。

**实现方案**:
- 后端: 解析世界目录的 `datapacks/` 文件夹，读取 `pack.mcmeta`
- 集成: VanillaTweaks API 获取热门数据包列表
- 安装: 下载 ZIP 并解压到指定世界的 datapacks 目录

**UI设计**: LibraryPage 添加"数据包"标签，按世界分组展示

**优先级**: P2

---

### 12. 整合包导入增强（Enhanced Modpack Import）

**描述**: 支持更多整合包格式：CurseForge ZIP、Modrinth mrpack、FTB、ATLauncher、HMCL 配置。

**实现方案**:
- 后端: 扩展 `import_modpack()`，添加格式检测（通过文件结构识别）
- 解析器: 为每种格式编写专用解析器（mrpack=JSON manifest, CF=overrides/）
- 依赖安装: 自动下载整合包指定的所有文件

**UI设计**: NewInstancePage 添加"导入整合包"选项，拖放 ZIP/mrpack 文件支持

**优先级**: P0

---

### 13. 整合包导出（Modpack Export）

**描述**: 将当前实例导出为可分享的整合包（mrpack 或 CF ZIP 格式）。

**实现方案**:
- 后端: 扩展 `export_mrpack()`，生成符合 Modrinth 规范的 manifest.json
- 配置捕获: 收集 mods/、config/、resourcepacks/、shaderpacks/ 内容
- 元数据: 允许用户填写名称、版本、作者、描述

**UI设计**: InstanceDetailPage 添加"导出整合包"按钮，弹出配置对话框

**优先级**: P1

---

### 14. 模组批量更新（Bulk Mod Update）

**描述**: 扫描实例中所有已安装模组，检测可用更新，支持一键批量更新。

**实现方案**:
- 后端: 复用 `check_content_updates()`，扩展为批量操作
- 版本匹配: 根据模组文件名哈希或 `installed_content.json` 元数据匹配最新版本
- 回滚: 更新前自动创建备份

**UI设计**: LibraryPage 添加"检查更新"按钮，列表显示可更新模组，带 changelog 预览

**优先级**: P0

---

### 15. 模组冲突检测（Mod Conflict Detection）

**描述**: 安装模组前检查与已有模组的兼容性，警告已知冲突。

**实现方案**:
- 后端: 建立冲突数据库（JSON 文件），记录已知不兼容的模组对
- 检测时机: 安装按钮点击时、实例启动前
- 来源: 整合社区维护的冲突数据 + 自动分析 JAR 内 `fabric.mod.json` 的 `conflicts` 字段

**UI设计**: 安装确认 Modal 中显示冲突警告（黄色卡片），列出冲突模组和解决方案

**优先级**: P1

---

### 16. 一键优化包（One-Click Optimization Presets）

**描述**: 根据硬件配置自动推荐并安装经过验证的优化模组组合。

**实现方案**:
- 后端: 预设定义（JSON）："低配"（Sodium+Lithium+Starlight+FerriteCore）、"中配"、"高配"
- 硬件检测: 复用 `get_system_info()` 判断配置等级
- 自动安装: 调用现有 `install_content()` 批量安装

**UI设计**: InstanceDetailPage 添加"优化"标签，显示当前配置等级和推荐预设卡片

**优先级**: P0

---

### 17. 世界种子库（World Seed Library）

**描述**: 浏览精选种子，预览生成地形，一键创建世界。

**实现方案**:
- 后端: 集成 Chunkbase API 或自建种子数据库
- 预览: 使用 Minemap 等工具生成俯视图缩略图
- 创建: 自动生成 `level.dat` 并放入 saves 目录

**UI设计**: 独立页面或 Marketplace 子标签，种子卡片带生物群系标签和缩略图

**优先级**: P2

---

### 18. 模组汉化补丁（Mod Translation Patches）

**描述**: 自动检测已安装模组的汉化资源包（i18n-update-mod 等），提示安装。

**实现方案**:
- 后端: 扫描已安装模组，匹配 CF/Modrinth 上的汉化包项目
- 集成: 与 i18n-update-mod 数据库对接
- 自动应用: 下载后放入 resourcepacks 并自动启用

**UI设计**: LibraryPage 中模组列表显示"汉化可用"徽章，一键安装按钮

**优先级**: P2

---

## 类别三：社交与联机（19-26）

### 19. 好友系统（Friends System）

**描述**: 添加好友、查看在线状态、正在游玩的服务器/版本。

**实现方案**:
- 后端: 轻量级 WebSocket 服务器（或使用点对点信令），维护在线状态
- 账户: 基于 Microsoft 账户 UUID 或自建好友码系统
- 隐私: 可设置状态可见性（在线/离线/游戏中/隐身）

**UI设计**: 侧边栏添加"好友"面板，头像列表带状态指示灯（绿色=在线，蓝色=游戏中）

**优先级**: P1

---

### 20. 局域网世界发现（LAN World Discovery）

**描述**: 自动发现局域网内其他 BonNext 用户开放的单人世界，一键加入。

**实现方案**:
- 后端: 使用 mDNS/Bonjour 广播/发现局域网游戏
- 协议: 兼容 Minecraft 原版的 LAN 广播机制
- 直连: 自动填充 IP 和端口到快速连接

**UI设计**: HomePage 添加"局域网世界"区域，发现的世界显示主机名、版本、当前玩家数

**优先级**: P1

---

### 21. 服务器状态监控（Server Status Monitor）

**描述**: 添加常玩服务器，实时监控在线人数、延迟、MOTD。

**实现方案**:
- 后端: 使用 Minecraft Server List Ping 协议（UDP 查询）
- 缓存: 每 30 秒刷新一次状态
- 批量: 支持添加多个服务器，并行查询

**UI设计**: HomePage 添加"我的服务器"区域，服务器卡片显示 favicon、在线人数、延迟条

**优先级**: P1

---

### 22. 截图管理器（Screenshot Manager）

**描述**: 自动收集游戏内截图，按时间/世界/服务器组织，支持分享。

**实现方案**:
- 后端: 监控 `screenshots/` 目录，读取 PNG 元数据（时间戳）
- 组织: 按日期分组，支持按世界名称筛选（从 level.dat 关联）
- 分享: 集成 imgur 或自建图床上传

**UI设计**: 新页面"截图库"，瀑布流布局，支持全屏查看和删除

**优先级**: P2

---

### 23. 游戏时间追踪（Playtime Tracker）

**描述**: 精确记录每个实例的游戏时长，生成可视化统计报告。

**实现方案**:
- 后端: 游戏启动时开始计时，退出时保存到 `playtime.json`
- 精度: 区分"前台运行"和"后台挂机"时间
- 聚合: 按日/周/月统计，生成趋势图

**UI设计**: HomePage 显示本周游戏时长，SettingsPage 添加详细统计页面（柱状图+饼图）

**优先级**: P0

---

### 24. 成就系统（Achievement System）

**描述**: 启动器层面的元成就，激励用户探索功能。

**实现方案**:
- 后端: `achievements.json` 存储解锁状态，触发条件监听各种事件
- 成就定义: JSON 文件定义条件（如 `first_launch`、`install_10_mods`、`100_hours_played`）
- 奖励: 解锁主题、徽章、头像框等虚拟奖励

**UI设计**: 侧边栏用户头像旁显示成就等级徽章，独立"成就"页面展示解锁进度

**优先级**: P2

---

### 25. 实例配置分享（Instance Config Share）

**描述**: 一键生成实例配置的分享链接，好友可一键导入。

**实现方案**:
- 后端: 将实例配置（不含存档）序列化为 JSON，生成短链接
- 存储: 临时服务器存储或生成可复制的配置码
- 导入: 接收方粘贴配置码即可创建相同配置的实例

**UI设计**: InstanceDetailPage 添加"分享配置"按钮，生成二维码+文本码

**优先级**: P1

---

### 26. 活动日历（Event Calendar）

**描述**: 展示 Minecraft 相关活动（版本发布、模组 Jam、服务器活动）。

**实现方案**:
- 后端: 订阅 Mojang 版本发布 RSS + 社区活动 API
- 本地: 用户可添加私人事件（如"和朋友联机"）
- 提醒: 事件前推送通知

**UI设计**: HomePage 添加小型日历组件，独立页面展示完整月视图

**优先级**: P3

---

## 类别四：视觉与个性化（27-34）

### 27. 动态背景（Dynamic Backgrounds）

**描述**: 支持视频背景、WebGL 粒子效果、游戏截图轮播。

**实现方案**:
- 前端: CSS `video` 标签或 Canvas WebGL 渲染
- 预设: 提供 5+ 内置动态背景（赛博朋克粒子、星空、矩阵雨等）
- 自定义: 允许用户上传视频或选择截图文件夹轮播

**UI设计**: SettingsPage "外观"部分添加背景选择器，实时预览

**优先级**: P1

---

### 28. 音效主题（Sound Themes）

**描述**: UI 交互音效（按钮点击、状态变化、通知），支持主题包。

**实现方案**:
- 前端: Web Audio API 播放短音效
- 主题: JSON 定义各事件的音效文件路径
- 内置: 赛博朋克（电子音）、幻想（魔法音）、极简（静音）三套主题

**UI设计**: SettingsPage 添加"音效"部分，音量滑块+主题选择

**优先级**: P2

---

### 29. 迷你模式（Mini Mode）

**描述**: 高度压缩的悬浮窗口，只显示启动按钮和关键信息，可置顶。

**实现方案**:
- 前端: 独立的 MiniMode 组件，窗口尺寸 300x180px
- 置顶: Tauri `alwaysOnTop` 属性
- 交互: 点击展开完整窗口，拖拽移动位置

**UI设计**: 紧凑布局，大启动按钮，实例名称，版本标签

**优先级**: P2

---

### 30. 实例图标自定义（Instance Icon Customization）

**描述**: 为每个实例选择自定义图标（游戏内方块/物品、Emoji、上传图片）。

**实现方案**:
- 后端: 实例配置添加 `icon_path` 字段，支持 PNG/SVG
- 图标库: 内置 Minecraft 方块图标集（从游戏 assets 提取）
- 上传: 用户可上传自定义图片，自动裁剪为 64x64

**UI设计**: InstanceDetailPage 头像区域可点击更换，弹出图标选择器

**优先级**: P2

---

### 31. 字体自定义（Font Customization）

**描述**: 支持自定义界面字体，包括中文字体回退策略。

**实现方案**:
- 前端: CSS `@font-face` 动态加载，支持系统字体列表
- 回退: `font-family: 'Custom', 'PingFang SC', 'Microsoft YaHei', sans-serif`
- 渲染: 提供实时预览

**UI设计**: SettingsPage 字体选择下拉框，粗细滑块，行高调整

**优先级**: P2

---

### 32. 启动动画自定义（Launch Animation）

**描述**: 启动游戏时显示自定义加载画面。

**实现方案**:
- 前端: 启动按钮点击后全屏显示动画，直到游戏窗口出现
- 预设: 版本对应官方艺术图、动态进度条、随机提示文字
- 自定义: 允许用户上传 GIF/视频作为加载画面

**UI设计**: 全屏遮罩，中央动画，底部进度条和状态文字

**优先级**: P3

---

### 33. 色盲友好模式（Colorblind Mode）

**描述**: 为色盲用户提供替代色彩方案，确保状态指示可区分。

**实现方案**:
- 前端: CSS 变量替换，提供红色盲、绿色盲、蓝色盲三种模式
- 替代: 不仅靠颜色，还添加图标/文字/纹理区分状态
- 测试: 使用色盲模拟器验证

**UI设计**: SettingsPage 无障碍部分添加色盲模式选择

**优先级**: P2

---

### 34. 窗口透明度（Window Transparency）

**描述**: 支持毛玻璃/半透明窗口效果（Windows Mica / macOS Vibrancy）。

**实现方案**:
- Tauri: 配置 `transparent: true`，使用 CSS `backdrop-filter: blur()`
- 平台适配: Windows 11 使用 Mica，macOS 使用 Vibrancy，Linux 使用模糊合成器
- 性能: 提供"性能模式"关闭透明效果

**UI设计**: SettingsPage 外观部分添加透明度和模糊强度滑块

**优先级**: P3

---

## 类别五：性能与监控（35-42）

### 35. 硬件性能档案（Hardware Profile）

**描述**: 自动检测 CPU/GPU/RAM，建立性能档案用于优化推荐。

**实现方案**:
- 后端: 扩展 `get_system_info()`，添加 GPU 检测（通过 `wgpu` 或系统 API）
- 评分: 根据硬件规格计算性能分数（1-10）
- 推荐: 基于分数推荐渲染距离、内存分配、模组选择

**UI设计**: SettingsPage 系统信息卡片显示性能分数和等级

**优先级**: P1

---

### 36. 启动性能剖析（Launch Profiling）

**描述**: 可视化展示 Minecraft 启动各阶段耗时，帮助定位瓶颈。

**实现方案**:
- 后端: 在游戏日志中注入时间戳标记，或使用 Java agent 采集
- 阶段: Java 初始化 → 类加载 → 资源加载 → Mod 初始化 → 世界加载
- 展示: 瀑布图显示各阶段耗时

**UI设计**: 独立"性能"页面，启动后自动生成报告，瀑布图+饼图

**优先级**: P2

---

### 37. 帧时间分析（Frame Time Analysis）

**描述**: 在叠加层中显示帧时间分布图，诊断卡顿原因。

**实现方案**:
- 后端: 通过 JNI 或日志解析获取每帧耗时数据
- 分析: 计算 1%/0.1% 低帧率，识别卡顿峰值
- 可视化: 实时折线图 + 直方图

**UI设计**: 叠加层扩展区域，小型实时图表

**优先级**: P2

---

### 38. 磁盘空间分析器（Disk Space Analyzer）

**描述**: 可视化展示各实例、版本、资源的磁盘占用，一键清理。

**实现方案**:
- 后端: 遍历游戏目录，按类别统计（实例/版本/库/资源/日志）
- 清理: 安全删除旧版本、未使用资源、过期日志
- 建议: 标记可清理的大文件

**UI设计**: SettingsPage 存储部分，树状图/矩形树图展示占用，"清理"按钮

**优先级**: P1

---

### 39. P2P 局域网传输（P2P LAN Transfer）

**描述**: 局域网内直接传输实例、模组文件，无需互联网下载。

**实现方案**:
- 后端: 使用 `libp2p` 或自定义 TCP 协议，mDNS 发现对等节点
- 传输: 断点续传，校验 SHA1
- 安全: 仅允许同一子网，传输前确认对话框

**UI设计**: 发现局域网节点时显示通知，右键实例"发送到..."

**优先级**: P1

---

### 40. 下载调度器（Download Scheduler）

**描述**: 智能限速、定时下载、优先级队列。

**实现方案**:
- 后端: 扩展下载队列，添加优先级权重和限速器
- 规则: 检测到游戏运行时自动限速、夜间全速下载
- 队列: 可暂停/恢复单个任务

**UI设计**: DownloadPanel 添加优先级标签和限速设置

**优先级**: P2

---

### 41. JVM GC 调优建议（GC Tuning Advisor）

**描述**: 根据硬件配置自动推荐最佳垃圾回收器参数。

**实现方案**:
- 后端: 规则引擎：低配=G1GC, 中配=ZGC, 高配=Shenandoah
- 参数: 自动生成 `-XX:+UseZGC -XX:+ZGenerational` 等参数
- 测试: 提供"基准测试"按钮对比不同 GC 的启动时间

**UI设计**: SettingsPage Java 部分添加"GC 调优"区域，显示当前和建议参数

**优先级**: P2

---

### 42. 电量管理（Battery Management）

**描述**: 笔记本电池模式下自动降低游戏性能以延长续航。

**实现方案**:
- 后端: 检测电池状态（通过系统 API），电池模式时注入节能 JVM 参数
- 策略: 限制最大帧率、降低渲染距离、减少内存分配
- 恢复: 插电后自动恢复设置

**UI设计**: SettingsPage 添加"电量管理"开关，显示当前电源状态

**优先级**: P3

---

## 类别六：数据与智能（43-47）

### 43. 使用分析仪表盘（Usage Dashboard）

**描述**: 个人游玩数据的可视化展示，类似 Spotify Wrapped。

**实现方案**:
- 后端: 聚合 `playtime.json`、启动日志、模组安装记录
- 统计: 总时长、最常玩版本、模组偏好、活跃时段
- 导出: 生成年度回顾图片分享

**UI设计**: 独立"统计"页面，大数字卡片+趋势图+词云

**优先级**: P1

---

### 44. 智能模组推荐（Smart Mod Recommendations）

**描述**: 基于已安装模组和游玩习惯推荐可能感兴趣的新模组。

**实现方案**:
- 后端: 简单协同过滤：安装 Sodium 的用户也常装 Iris
- 规则: 基于类别的关联规则（建筑类→WorldEdit, 科技类→Create）
- 来源: 分析 Modrinth 的 "Projects that use this" 数据

**UI设计**: MarketplacePage 首页"为你推荐"区域，基于当前实例的推荐卡片

**优先级**: P1

---

### 45. 版本迁移助手（Version Migration Assistant）

**描述**: 新 Minecraft 版本发布时，自动分析模组兼容性并给出迁移建议。

**实现方案**:
- 后端: 对比当前实例模组列表与新版本的 Modrinth API 数据
- 报告: 已更新（绿色）、待更新（黄色）、已弃用（红色）
- 批量: 一键更新所有已兼容模组

**UI设计**: 版本发布时首页横幅通知，点击展开详细迁移报告

**优先级**: P1

---

### 46. 异常检测（Anomaly Detection）

**描述**: 自动检测 FPS 异常下降、崩溃模式、内存泄漏迹象。

**实现方案**:
- 后端: 建立性能基线，偏离超过阈值时报警
- 模式: 频繁崩溃同一模组 → 标记问题模组
- 建议: 基于历史数据给出修复建议

**UI设计**: 检测到异常时 Toast 通知，"查看详情"跳转到诊断页面

**优先级**: P2

---

### 47. 自然语言搜索（Natural Language Search）

**描述**: 用自然语言描述需求搜索内容，如"适合建筑党的中世纪资源包"。

**实现方案**:
- 后端: 本地 Embedding 模型（轻量，如 `fastText`）或调用远程 API
- 索引: 对模组描述、标签、分类建立向量索引
- 回退: 无法理解时回退到关键词搜索

**UI设计**: 搜索框支持自然语言，结果顶部显示"AI 理解：你在找..."

**优先级**: P2

---

## 类别七：系统集成与扩展（48-50）

### 48. Discord Rich Presence（Discord 状态同步）

**描述**: 同步游戏状态到 Discord，显示正在游玩的版本和服务器。

**实现方案**:
- 后端: 集成 Discord Game SDK 或 RPC API
- 状态: 显示 "Playing Minecraft 1.20.1 - Survival"， elapsed time
- 按钮: "Ask to Join" 邀请功能

**UI设计**: SettingsPage 集成部分添加 Discord 开关和隐私选项

**优先级**: P1

---

### 49. CLI 模式（Command Line Interface）

**描述**: 命令行界面用于脚本化和自动化操作。

**实现方案**:
- 后端: 使用 `clap` 构建 CLI，支持 `bonnext launch <instance>`、`bonnext install <mod>` 等
- IPC: CLI 与 GUI 实例通过 socket/文件锁通信
- 输出: JSON 模式用于脚本解析

**UI设计**: 无 UI，纯命令行，提供 `--help` 和 man page

**优先级**: P2

---

### 50. 本地 Web API（Local Web API）

**描述**: 提供 REST API 让外部工具和插件可以控制启动器。

**实现方案**:
- 后端: 使用 `axum` 或 `actix-web` 启动本地 HTTP 服务器（端口可配置）
- 端点: `GET /instances`、`POST /launch/:id`、`GET /status`
- 安全: 仅监听 localhost，可选 Token 认证

**UI设计**: SettingsPage 开发者部分添加 API 开关和文档链接

**优先级**: P3

---

## 附录 A：优先级定义

| 优先级 | 含义 | 预期时间线 |
|--------|------|-----------|
| P0 | 核心功能，必须实现 | 1-2 个月 |
| P1 | 重要功能，显著提升体验 | 2-4 个月 |
| P2 | 增强功能，有明确价值 | 4-6 个月 |
| P3 | 锦上添花，长期规划 | 6-12 个月 |

---

## 附录 B：技术依赖矩阵

| 功能 | 新增后端模块 | 新增前端页面/组件 | 外部依赖 |
|------|-------------|------------------|---------|
| 1. 智能一键启动 | config.rs 扩展 | HomePage 卡片 | 无 |
| 2. 游戏内叠加层 | overlay.rs | Overlay.tsx | 无 |
| 3. 崩溃自动诊断 | crash_parser.rs 扩展 | CrashModal.tsx | 无 |
| 4. 实例快照 | snapshot.rs | SnapshotTab.tsx | 无 |
| 5. 多开管理 | launch/state.rs 重构 | MultiInstancePanel.tsx | 无 |
| 6. 智能内存 | config.rs 扩展 | Settings 内存区域 | 无 |
| 7. 启动预热 | warmup.rs | 设置选项 | 无 |
| 8. 访客模式 | guest.rs | LoginPage 链接 | 无 |
| 9. 资源包浏览器 | 复用 modrinth.rs | ResourcePackTab.tsx | Modrinth API |
| 10. 光影浏览器 | 复用 modrinth.rs | ShaderTab.tsx | Modrinth API |
| 11. 数据包管理 | datapack.rs | DatapackTab.tsx | VanillaTweaks API |
| 12. 整合包导入 | import/ 目录 | ImportWizard.tsx | 无 |
| 13. 整合包导出 | export.rs | ExportModal.tsx | zip |
| 14. 批量更新 | content.rs 扩展 | BulkUpdatePage.tsx | Modrinth/CF API |
| 15. 冲突检测 | conflict.rs | ConflictWarning.tsx | 无 |
| 16. 优化预设 | presets.rs | OptimizationTab.tsx | Modrinth API |
| 17. 世界种子 | seed_library.rs | SeedBrowser.tsx | Chunkbase API |
| 18. 汉化补丁 | i18n_patch.rs | TranslationBadge.tsx | CF API |
| 19. 好友系统 | friends.rs | FriendsPanel.tsx | WebSocket |
| 20. LAN 发现 | lan_discovery.rs | LANWorlds.tsx | mdns |
| 21. 服务器监控 | server_status.rs | ServerMonitor.tsx | 无 |
| 22. 截图管理 | screenshot.rs | ScreenshotGallery.tsx | 无 |
| 23. 时间追踪 | playtime.rs (扩展) | PlaytimeStats.tsx | 无 |
| 24. 成就系统 | achievements.rs | AchievementsPage.tsx | 无 |
| 25. 配置分享 | config_share.rs | ShareModal.tsx | 可选后端 |
| 26. 活动日历 | calendar.rs | EventCalendar.tsx | RSS |
| 27. 动态背景 | 无 | DynamicBackground.tsx | 无 |
| 28. 音效主题 | 无 | SoundTheme.tsx | Web Audio API |
| 29. 迷你模式 | 无 | MiniMode.tsx | Tauri API |
| 30. 图标自定义 | instance/manager.rs 扩展 | IconPicker.tsx | 无 |
| 31. 字体自定义 | 无 | FontSettings.tsx | 无 |
| 32. 启动动画 | 无 | LaunchAnimation.tsx | 无 |
| 33. 色盲模式 | 无 | ColorblindSettings.tsx | 无 |
| 34. 窗口透明 | 无 | TransparencySettings.tsx | Tauri API |
| 35. 硬件档案 | system_info.rs 扩展 | HardwareCard.tsx | sysinfo |
| 36. 启动剖析 | profiling.rs | ProfilingReport.tsx | Java agent |
| 37. 帧时间分析 | frame_time.rs | FrameTimeGraph.tsx | JNI |
| 38. 磁盘分析 | disk_analyzer.rs | DiskUsageChart.tsx | 无 |
| 39. P2P 传输 | p2p.rs | P2PTransfer.tsx | libp2p |
| 40. 下载调度 | download/scheduler.rs | DownloadScheduler.tsx | 无 |
| 41. GC 调优 | gc_advisor.rs | GCSettings.tsx | 无 |
| 42. 电量管理 | battery.rs | BatterySettings.tsx | 系统 API |
| 43. 分析仪表盘 | analytics.rs | DashboardPage.tsx | chart.js |
| 44. 智能推荐 | recommendations.rs | Recommendations.tsx | 无 |
| 45. 版本迁移 | migration.rs | MigrationAssistant.tsx | Modrinth API |
| 46. 异常检测 | anomaly.rs | AnomalyToast.tsx | 无 |
| 47. 自然语言搜索 | nlp_search.rs | NLPSearchBox.tsx | fastText |
| 48. Discord RPC | discord.rs | DiscordSettings.tsx | discord-sdk |
| 49. CLI 模式 | cli.rs | 无 | clap |
| 50. Web API | web_api.rs | APISettings.tsx | axum |

---

## 附录 C：与现有功能的兼容性

所有 50 个新功能均基于现有架构设计：

- **状态管理**: 复用现有的 React Context + useReducer 模式
- **IPC 通信**: 复用 `api.ts` → Tauri command → Rust 的数据流
- **样式系统**: 复用 CSS Modules + `tokens.css` 设计令牌
- **错误处理**: 复用 `LauncherError` 和 Toast 通知系统
- **主题系统**: 复用现有 dark/light/OLED 主题框架
- **国际化**: 复用现有 i18n 系统

---

*文档结束*
