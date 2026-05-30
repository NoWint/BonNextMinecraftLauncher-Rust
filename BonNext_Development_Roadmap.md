# BonNext v0.0.5 开发路线图

| 字段         | 值                  |
| ------------ | ------------------- |
| **报告编号** | BN-ROADMAP-2026-001 |
| **项目**     | BonNext v0.0.5      |
| **日期**     | 2026年5月29日       |
| **版本**     | 1.0                 |
| **状态**     | 评审中              |

---

## 摘要

本路线图文档对 BonNext v0.0.5 版本进行全面的技术评估与改进规划，旨在系统性地识别当前产品在用户体验、性能表现、架构健壮性、安全合规及可维护性五个维度上的短板，并给出优先级明确、技术方案具体的改进条目。

BonNext 作为一款面向全球 Minecraft 玩家社区的桌面启动器产品，其核心竞争力不仅在于能否正确启动游戏，更在于能否提供流畅、直观、可信赖的全链路体验——从浏览内容、管理实例、配置环境到启动游戏，每一个环节都直接影响用户留存和口碑传播。当前版本在基础功能层面已基本可用，但在体验细节、性能瓶颈、架构弹性等方面暴露出一系列亟待解决的问题，这些问题若不及时处理，将随着用户规模增长和功能迭代而加速恶化。

**方法论**：本路线图基于对 BonNext 完整代码库的深度审查，覆盖 Rust 后端（`src-tauri/src/`）约 15,000 行核心代码和 React 前端（`src/`）约 20,000 行组件与状态管理代码。评估过程采用静态代码分析、架构模式识别、已知缺陷追踪与行业最佳实践对标相结合的方式，每一条目均经过代码验证，确保问题描述准确、技术建议可落地。具体而言，评估团队逐一审查了后端的认证模块、下载队列、实例管理、版本解析、启动流程、内容平台集成等核心路径，以及前端的路由架构、状态管理、组件层次、样式系统、国际化框架等关键模块，对每一处发现的潜在问题均标注了具体的文件路径和行号引用。

**条目分布**：本路线图共规划 120 项改进条目，按五大维度分布如下：

| 维度             | 条目数  | P0    | P1     | P2     | P3     |
| ---------------- | ------- | ----- | ------ | ------ | ------ |
| 用户体验优化     | 30      | 2     | 4      | 16     | 8      |
| 性能提升         | 20      | 0     | 3      | 13     | 4      |
| 架构健壮性       | 25      | 2     | 5      | 12     | 6      |
| 安全与合规       | 25      | 3     | 6      | 10     | 6      |
| 可维护性与工程化 | 20      | 1     | 4      | 10     | 5      |
| **合计**         | **120** | **8** | **22** | **61** | **29** |

**最关键的改进方向**：

1. **路由系统统一（UX-07，P0）**：当前自定义 `getPageFromHash()` 与 `react-router-dom` 的 `HashRouter` 严重冲突，导致 `useParams` 无法获取参数、浏览器后退行为异常，影响 InstanceDetailPage 等核心功能页面的正常运行。这是当前最高优先级的阻断性问题。

2. **Light 主题对比度修复（UX-16，P0）**：Light 主题下部分文本与背景的对比度远低于 WCAG AA 标准（4.5:1），严重影响可读性并违反无障碍法规要求，属于合规性阻断问题。

3. **下载进度实时展示（UX-05，P1）**：后端已通过 `app.emit("download-progress", ...)` 推送进度事件，前端 `downloadStore` 也定义了 `progress`/`speed`/`eta` 字段，但两者之间缺少事件监听桥接，导致用户无法感知下载进度——这对启动器产品是核心体验缺陷。

4. **下载队列阻塞 IO 替换（PERF-01，P1）**：`download/queue.rs` 中 `std::fs::create_dir_all` 在 tokio 异步运行时中阻塞工作线程，可能导致下载过程中 UI 冻结，属于性能层面的高优先级问题。

5. **模组启用/禁用开关（UX-04，P1）**：后端 `instance/manager.rs` 已识别 `.jar.disabled` 后缀但缺少 `toggle_mod` 命令，前端 LibraryPage 缺少切换控件——这是 MC 启动器的核心功能缺失。

本路线图前半部分（本文档）涵盖摘要、引言、用户体验优化 30 项及性能提升 20 项，共计 50 项条目。后半部分将涵盖架构健壮性 25 项、安全与合规 25 项及可维护性与工程化 20 项。

---

## 1. 引言

### 1.1 路线图目标

BonNext 是一款基于 Tauri v2 构建的跨平台 Minecraft Java Edition 启动器，采用 Rust 后端 + React 18 前端架构，以 ZZZ 风格的 Neo-Tokyo 赛博朋克美学为核心视觉语言。当前版本 v0.0.5 已实现核心启动流程、多账户认证（Microsoft OAuth 2.0 设备流 + Yggdrasil 外置登录 + 离线模式）、实例管理（含模组包导入导出、启动器迁移、快照支持、崩溃诊断）、Modrinth/CurseForge 双源内容平台（搜索、详情、安装、收藏）等基础功能，但在用户体验一致性、性能优化深度、架构可扩展性、安全合规性及工程化成熟度方面仍存在显著差距。

具体而言，当前版本面临以下核心挑战：前端路由系统存在自定义实现与 react-router-dom 的冲突，导致参数传递和浏览器导航异常；后端多处使用同步阻塞 IO，在 tokio 异步运行时中造成线程池压力；下载系统缺少断点续传和进度反馈，用户无法感知下载状态；多主题系统（Dark/Light/OLED/MD3）在对比度和变量完整性方面存在缺陷；无障碍设计覆盖不足，键盘导航和屏幕阅读器支持有限；国际化翻译存在硬编码中文字符串，影响全球用户体验。这些问题的存在不仅影响当前用户的使用体验，更制约了产品的长期发展潜力。

本路线图的核心目标为：

1. **系统性识别问题**：通过全量代码审查，建立完整的技术债务清单，避免遗漏关键缺陷。每一项发现均需追溯至具体的代码位置和执行路径，确保问题定位的精确性，而非停留在现象描述层面。

2. **量化优先级**：基于用户影响范围、安全风险等级、实现复杂度三维度，为每项改进赋予明确优先级，指导资源分配。优先级的判定不仅考虑问题本身的严重程度，还需综合评估修复该问题可能引入的回归风险和对其他模块的连锁影响。

3. **提供可执行方案**：每一条目均包含具体的技术实现建议，含代码示例或架构描述，确保开发团队可直接参考实施，而非停留在概念层面。技术方案的选择遵循最小侵入原则——优先考虑在现有架构基础上渐进式改进，而非推翻重构。

4. **建立改进基线**：为后续版本的持续迭代提供可追溯的改进记录，支持进度跟踪与效果评估。每项改进完成后应可通过可量化的指标（如首屏加载时间、操作响应延迟、无障碍合规率等）验证效果。

### 1.2 评估方法论

本路线图的评估过程遵循以下方法论：

**代码审查范围**：

- Rust 后端：`src-tauri/src/` 全部模块，包括 `auth/`（Microsoft OAuth 2.0 设备流、Yggdrasil 外置登录、离线模式）、`config.rs`（JSON 配置持久化）、`download/`（并行下载队列、SHA1 校验、镜像故障转移）、`version/`（Mojang 清单获取、JSON 解析、OS/feature 规则评估）、`launch/`（状态机驱动的启动流程）、`loader/`（Fabric + Forge 安装）、`instance/`（实例管理、模组包导入导出、迁移）、`platform/`（Java 检测与自动下载）、`security/`（AES-256-GCM 加密、凭证存储、审计日志、JVM 白名单、沙箱模式）、`commands/`（约 100 个 Tauri IPC 命令）、`modrinth.rs`、`curseforge.rs`、`cache.rs`、`http_client.rs` 等。
- React 前端：`src/` 全部模块，包括 `api/`（模块化 API 层，含 cachedInvoke 缓存与请求去重）、`stores/`（authStore、configStore、instanceStore、toastStore、themeStore、downloadStore 六大状态管理）、`pages/`（首页、商店、实例、版本、设置等页面组件）、`components/`（ContentCard、InstallButton、DownloadPanel、Modal、SearchPalette 等 UI 组件）、`styles/`（tokens.css 设计令牌、themes.css 多主题、ux-delight.css 动画）、`plugins/`（ZZZ 主题插件、MD3 主题插件）、`utils/`（errorMapping、logger、composeProviders）、`i18n/`（国际化框架）等。
- 配置与构建：`vite.config.ts`、`Cargo.toml`、`tauri.conf.json` 等。

**评估维度**：

1. **用户体验（UX）**：交互反馈、导航架构、表单体验、视觉设计、无障碍、通知引导、多语言。
2. **性能（Performance）**：异步并发、缓存策略、网络传输、前端渲染、存储 IO。
3. **架构（Architecture）**：模块解耦、状态管理、错误处理、API 设计、可测试性。
4. **安全（Security）**：数据保护、输入验证、权限控制、审计合规、依赖安全。
5. **可维护性（Maintainability）**：代码规范、文档覆盖、构建优化、监控告警、技术债务。

**问题识别手段**：

- 静态代码模式扫描（如 `std::fs::` 阻塞调用、硬编码颜色值、缺失 aria 属性）
- 架构反模式识别（如 OnceLock 不可重置、全量 JSON 读写、自定义路由冲突）
- 行业标准对标（WCAG 2.1 AA、OWASP Top 10、Rust API Guidelines）
- 已知缺陷追踪（GitHub Issues、用户反馈、开发者标注的 TODO/FIXME）

在评估过程中，我们特别关注了以下几类高频问题模式：第一，后端 Rust 代码中 `std::fs` 同步调用在 tokio 异步上下文中的使用，这类问题在 `config.rs`、`download/queue.rs`、`download/verifier.rs` 等模块中均有发现，是导致 UI 冻结的主要原因之一；第二，前端 `window.location.hash` 手动导航替代 `react-router-dom` 的 `useNavigate`，全项目至少 30 处使用该模式，严重破坏了路由系统的一致性；第三，CSS 变量使用不一致，部分组件直接硬编码颜色值而非引用主题变量，导致主题切换时视觉表现异常；第四，事件监听缺失，后端已推送的事件（如 `download-progress`）在前端未被消费，造成功能"半实现"的状态。

### 1.3 优先级定义

本路线图采用四级优先级体系，定义如下：

| 优先级 | 标签 | 含义                                                | 响应要求                           |
| ------ | ---- | --------------------------------------------------- | ---------------------------------- |
| **P0** | 阻断 | 功能不可用或存在严重安全/合规风险，影响核心用户流程 | 必须在当前版本发布前修复           |
| **P1** | 高   | 显著影响用户体验或系统稳定性，存在潜在数据风险      | 应在当前版本或下一个补丁版本中修复 |
| **P2** | 中   | 影响部分用户体验或开发效率，但不阻断核心流程        | 计划在后续 1-2 个版本中改进        |
| **P3** | 低   | 锦上添花或长期优化项，影响范围有限                  | 根据资源情况择机实施               |

优先级评定基于以下三维度加权：

- **用户影响范围**（40%）：受影响用户比例与严重程度
- **安全/合规风险**（30%）：数据泄露、法规违规等风险等级
- **实现复杂度**（30%）：所需工时与引入回归风险（复杂度越低，优先级倾向越高）

在实际评定过程中，我们遵循以下补充原则：当一个问题同时涉及用户体验和安全合规时，以安全合规维度为准升级优先级；当修复某个问题可能引入大范围回归风险时，即使问题本身严重，也可能适当降低优先级并要求先进行充分的回归测试准备；对于依赖其他条目才能实施的改进项，其优先级不应高于前置依赖项。此外，P0 级别的条目数量应严格控制——过多的 P0 条目意味着优先级体系失效，无法有效指导资源分配。

### 1.4 文档结构

本路线图文档分为两大部分：

**第一部分（本文档）**：

- 第 2 章：用户体验优化（30 项），涵盖交互反馈与状态管理、导航与信息架构、表单与输入体验、视觉与主题、无障碍设计、通知与引导、多语言与本地化七个子类。
- 第 3 章：性能提升（20 项），涵盖异步与并发优化、缓存优化、网络优化、前端渲染优化、存储与 IO 优化五个子类。

**第二部分（独立文档）**：

- 第 4 章：架构健壮性（25 项）
- 第 5 章：安全与合规（25 项）
- 第 6 章：可维护性与工程化（20 项）
- 附录：条目索引、依赖关系图、实施时间线建议

---

## 2. 用户体验优化（30项）

用户体验是启动器产品的核心竞争力。一个功能完备但体验粗糙的启动器，很难在 HMCL、Prism Launcher、ATLauncher 等成熟竞品中脱颖而出。本章从交互反馈与状态管理、导航与信息架构、表单与输入体验、视觉与主题、无障碍设计、通知与引导、多语言与本地化七个维度，系统性地梳理了 30 项用户体验改进条目。

其中，P0 级别 2 项（路由系统冲突、Light 主题对比度），P1 级别 4 项（设置防抖、模组开关、下载进度、焦点陷阱），P2 级别 16 项，P3 级别 8 项。建议优先处理 P0 和 P1 条目，它们直接影响核心功能的可用性和合规性。

### 2.1 交互反馈与状态管理（6项）

交互反馈是用户与系统沟通的桥梁。当用户执行操作后，系统必须在合理的时间内给出明确的反馈——无论是视觉变化、状态更新还是错误提示。缺乏反馈的交互会让用户产生"系统是否响应了我的操作"的疑虑，进而导致重复操作或误判系统故障。本子类涵盖骨架屏统一、设置防抖、确认对话框、模组开关、下载进度和 Toast 通知六个方面的改进。

### UX-01 全局加载状态骨架屏统一

- **优先级**: P2（中）
- **类别**: 交互反馈 > 加载状态
- **改进内容**: 当前项目中 `Skeleton` 组件已实现基础骨架屏功能（支持 text/title/card/icon/avatar 五种变体），但仅在部分页面使用。CollectionsPage 和 VersionsPage 在数据加载时显示空白区域，缺乏视觉反馈，用户无法区分"加载中"与"无数据"两种状态。需要建立统一的加载状态管理机制，确保所有数据加载页面在请求期间展示骨架屏。
- **技术实现建议**:
  1. 创建 `useSkeleton` 自定义 Hook，基于 `cachedInvoke` 的请求状态自动切换骨架屏与内容区域：

  ```typescript
  // src/hooks/useSkeleton.ts
  import { useState, useEffect } from 'react';
  import { ipcInflight } from '../api/cache';

  export function useSkeleton(cacheKey: string): boolean {
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
      const check = () => setIsLoading(ipcInflight.has(cacheKey));
      const interval = setInterval(check, 100);
      return () => clearInterval(interval);
    }, [cacheKey]);
    return isLoading;
  }
  ```

  2. 在 `CardSkeleton` 组件中替换硬编码内联样式为 CSS Module，并应用 clip-path 斜角风格以匹配 ZZZ 美学：

  ```css
  /* src/components/ui/Skeleton.module.css 补充 */
  .cardSkeleton {
    background: var(--bg-card);
    border: 1px solid var(--border);
    clip-path: var(--clip-medium);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  ```

  3. 在 CollectionsPage 和 VersionsPage 中引入骨架屏占位，模式如下：

  ```tsx
  {isLoading ? (
    <div className={styles.grid}>
      {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  ) : (
    <div className={styles.grid}>{data.map(item => <ContentCard ... />)}</div>
  )}
  ```

- **预期解决的问题**: 数据加载期间页面闪烁空白，用户无法判断系统是否正在工作，误以为功能故障或页面卡死。
- **关联模块**: [Skeleton.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/Skeleton.tsx), [cache.ts](file:///Users/xiatian/Desktop/BonNext/src/api/cache.ts), CollectionsPage.tsx, VersionsPage.tsx

---

### UX-02 设置项变更防抖与乐观更新

- **优先级**: P1（高）
- **类别**: 交互反馈 > 设置交互
- **改进内容**: 当前设置页面（如 MemorySection 中的内存滑块）每次值变更都直接调用后端 API 写入配置，无防抖机制。拖动滑块时高频触发 `save_config`，每次均执行 `std::fs::write` 同步磁盘 IO（见 `config.rs:198`），导致操作卡顿和频繁磁盘写入。同时缺少乐观更新策略，用户需等待后端响应后才能看到 UI 变化。
- **技术实现建议**:
  1. 创建通用 `useDebouncedCallback` Hook，包装设置项的 API 调用：

  ```typescript
  // src/hooks/useDebouncedCallback.ts
  import { useRef, useCallback } from 'react';

  export function useDebouncedCallback<T extends (...args: unknown[]) => void>(callback: T, delay: number = 300): T {
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    return useCallback(
      (...args: unknown[]) => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => callback(...args), delay);
      },
      [callback, delay],
    ) as T;
  }
  ```

  2. 在 configStore 中实现乐观更新模式——先更新本地状态，再异步同步后端，失败时回滚并 toast 提示：

  ```typescript
  // src/stores/configStore.tsx 中添加
  const updateConfigOptimistic = async (key: string, value: unknown) => {
    const previous = state.config;
    dispatch({ type: 'UPDATE_CONFIG', key, value }); // 乐观更新
    try {
      await api.saveConfig({ ...state.config, [key]: value });
    } catch (err) {
      dispatch({ type: 'UPDATE_CONFIG', key, value: previous[key] }); // 回滚
      addToast(errorToast(err, '配置保存失败'));
    }
  };
  ```

  3. 在 MemorySection 中替换直接 API 调用为防抖版本：

  ```tsx
  const debouncedSave = useDebouncedCallback((value: number) => updateConfigOptimistic('max_memory', value), 300);
  <input type="range" onChange={(e) => debouncedSave(Number(e.target.value))} />;
  ```

- **预期解决的问题**: 设置页操作卡顿（尤其是内存滑块拖动），频繁磁盘 IO 加速 SSD 磨损，用户等待后端响应的延迟感。
- **关联模块**: [MemorySection.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/settings/MemorySection.tsx), [configStore.tsx](file:///Users/xiatian/Desktop/BonNext/src/stores/configStore.tsx), [config.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/config.rs)

---

### UX-03 操作确认对话框统一

- **优先级**: P2（中）
- **类别**: 交互反馈 > 破坏性操作保护
- **改进内容**: 当前删除实例、卸载模组、清除下载记录等破坏性操作缺少确认对话框，用户误点击后操作不可逆。虽然 `Modal` 组件已实现焦点陷阱和 aria 属性，但缺少面向确认场景的高阶封装。需要创建 `ConfirmDialog` 组件，在所有破坏性操作前统一弹出确认。
- **技术实现建议**:
  1. 基于 `Modal` 组件创建 `ConfirmDialog`，支持自定义危险等级和确认文案：

  ```tsx
  // src/components/ui/ConfirmDialog.tsx
  interface ConfirmDialogProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    dangerLevel?: 'low' | 'medium' | 'high';
    confirmText?: string;
  }
  // dangerLevel='high' 时确认按钮使用红色，需输入确认文本
  // dangerLevel='medium' 时确认按钮使用警告色
  // dangerLevel='low' 时使用默认强调色
  ```

  2. 创建 `useConfirm` Hook，以 Promise 方式使用确认对话框：

  ```typescript
  // src/hooks/useConfirm.ts
  export function useConfirm() {
    const [state, setState] = useState<ConfirmState | null>(null);
    const confirm = (options: Omit<ConfirmState, 'resolve' | 'reject'>): Promise<boolean> =>
      new Promise((resolve) => setState({ ...options, resolve }));
    return { confirm, state, setState };
  }
  ```

  3. 在 instanceStore 的 `deleteInstance`、downloadStore 的 `removeTask`（批量清除时）等操作前插入确认逻辑。

- **预期解决的问题**: 误操作导致实例删除、模组卸载等数据丢失，且无法恢复。
- **关联模块**: [Modal.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/Modal.tsx), [instanceStore.tsx](file:///Users/xiatian/Desktop/BonNext/src/stores/instanceStore.tsx), [downloadStore.tsx](file:///Users/xiatian/Desktop/BonNext/src/stores/downloadStore.tsx)

---

### UX-04 模组启用/禁用开关

- **优先级**: P1（高）
- **类别**: 交互反馈 > 模组管理
- **改进内容**: 后端 `instance/manager.rs:723` 已识别 `.jar.disabled` 后缀的模组文件（在列出模组时跳过或标记），但缺少 `toggle_mod` 命令来切换模组的启用/禁用状态。前端 LibraryPage 仅支持删除模组，无法临时禁用。这是 Minecraft 启动器的核心功能——用户调试模组兼容性时需要反复启用/禁用模组，当前只能通过删除和重新安装来实现，体验极差。
- **技术实现建议**:
  1. 后端添加 `toggle_mod` Tauri 命令，通过重命名 `.jar` ↔ `.jar.disabled` 实现切换：

  ```rust
  // src-tauri/src/commands/instance.rs
  #[tauri::command]
  pub async fn toggle_mod(instance_id: &str, mod_filename: &str, enabled: bool) -> Result<(), LauncherError> {
      let mods_dir = paths::get_game_dir()
          .join("instances").join(instance_id).join(".minecraft").join("mods");
      let disabled_path = mods_dir.join(format!("{}.disabled", mod_filename));
      let enabled_path = mods_dir.join(&mod_filename);
      if enabled {
          tokio::fs::rename(&disabled_path, &enabled_path).await
              .map_err(|e| LauncherError::InstanceError(format!("Failed to enable mod: {}", e)))?;
      } else {
          tokio::fs::rename(&enabled_path, &disabled_path).await
              .map_err(|e| LauncherError::InstanceError(format!("Failed to disable mod: {}", e)))?;
      }
      Ok(())
  }
  ```

  2. 前端 API 层添加对应调用：

  ```typescript
  // src/api/instances.ts
  export const toggleMod = (instanceId: string, filename: string, enabled: boolean) =>
    invoke('toggle_mod', { instanceId, modFilename: filename, enabled });
  ```

  3. LibraryPage 中为每个模组行添加 Toggle 开关组件（复用 `Inputs.tsx` 中已有的 `Toggle` 组件），并支持批量操作（多选后一键禁用/启用）。

- **预期解决的问题**: 调试模组兼容性需反复安装卸载，操作繁琐且浪费时间；无法快速排查某个模组是否导致崩溃。
- **关联模块**: [manager.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/instance/manager.rs#L723), [Inputs.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/Inputs.tsx), LibraryPage.tsx

---

### UX-05 下载进度实时展示

- **优先级**: P1（高）
- **类别**: 交互反馈 > 下载体验
- **改进内容**: 后端已通过 `app.emit("download-progress", AggProgressSnapshot {...})` 推送下载进度事件（见 `commands/launch.rs:377,430,451`），前端 `downloadStore` 也定义了 `progress`/`speed`/`eta` 字段（见 `downloadStore.tsx:10-12`），且 `api/versions.ts` 中已封装了 `onDownloadProgress` 监听函数（见 `versions.ts:7`）。但关键问题在于：`DownloadProvider` 中从未调用 `onDownloadProgress` 来注册事件监听，导致后端推送的进度数据无法到达前端 store。DownloadPanel 组件因此无法展示实时进度条和速度信息。
- **技术实现建议**:
  1. 在 `DownloadProvider` 中注册 `download-progress` 事件监听，将后端推送的数据映射到 store：

  ```typescript
  // src/stores/downloadStore.tsx 中 DownloadProvider 内添加
  useEffect(() => {
    const unlisten = onDownloadProgress((payload) => {
      // payload 结构需与后端 AggProgressSnapshot 对齐
      dispatch({
        type: 'UPDATE_TASK',
        id: payload.taskId,
        status: 'downloading',
        progress: payload.progress, // 0-100 百分比
        speed: payload.speed, // bytes/sec
        eta: payload.eta, // 剩余秒数
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
  ```

  2. 后端 `AggProgressSnapshot` 需确保包含 `taskId` 字段以匹配前端任务。若当前结构缺少该字段，需在 `commands/launch.rs` 中的 emit 调用处补充。

  3. DownloadPanel 组件中渲染进度条和速度信息：

  ```tsx
  <div className={styles.progress}>
    <div className={styles.progressBar} style={{ width: `${task.progress ?? 0}%` }} />
    <span className={styles.speed}>{task.speed ? `${(task.speed / 1048576).toFixed(1)} MB/s` : '—'}</span>
    <span className={styles.eta}>{task.eta ? `剩余 ${formatEta(task.eta)}` : ''}</span>
  </div>
  ```

- **预期解决的问题**: 下载进度完全不可见，用户无法判断下载是否在进行、还需等待多久，严重影响启动器核心体验。
- **关联模块**: [downloadStore.tsx](file:///Users/xiatian/Desktop/BonNext/src/stores/downloadStore.tsx), [DownloadPanel.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/DownloadPanel.tsx), [versions.ts](file:///Users/xiatian/Desktop/BonNext/src/api/versions.ts), [launch.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/commands/launch.rs#L377)

---

### UX-06 Toast 通知分类与队列优化

- **优先级**: P2（中）
- **类别**: 交互反馈 > 通知系统
- **改进内容**: 当前 `toastStore` 已实现 `type` 字段（success/error/info/warning）和基于类型的差异化持续时间（error 6 秒，其他 3.5 秒，见 `toastStore.tsx:41`），以及类型关联的音效反馈（见 `toastStore.tsx:49-50`）。但视觉层面缺少类型对应的图标和颜色区分——所有通知使用相同样式渲染，用户难以快速识别通知级别。此外，队列上限为 5 条（`slice(-4)` 保留最新 5 条，见 `toastStore.tsx:42`），高频场景下重要错误通知可能被淹没。
- **技术实现建议**:
  1. 为每种通知类型添加对应图标和颜色变量：

  ```css
  /* Toast.module.css */
  .toast--success {
    border-left: 3px solid var(--success);
  }
  .toast--error {
    border-left: 3px solid var(--danger);
  }
  .toast--warning {
    border-left: 3px solid #ffaa00;
  }
  .toast--info {
    border-left: 3px solid var(--accent);
  }
  ```

  2. 错误类型通知不自动消失（`duration: 0`），需用户手动关闭：

  ```typescript
  // toastStore.tsx 修改
  const duration = toast.duration ?? (toast.type === 'error' ? 0 : 3500);
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  ```

  3. 添加通知历史面板，通过侧边栏图标入口查看最近 50 条通知记录，防止重要通知被新通知挤出队列后丢失。

- **预期解决的问题**: 重要错误通知被普通通知淹没后自动消失，用户无法回溯查看；不同级别通知视觉不可区分，降低信息获取效率。
- **关联模块**: [toastStore.tsx](file:///Users/xiatian/Desktop/BonNext/src/stores/toastStore.tsx)

---

### 2.2 导航与信息架构（5项）

清晰的导航架构是用户高效使用产品的前提。当用户无法快速找到所需功能或迷失在深层页面中时，产品的可用性将大打折扣。本子类涵盖路由系统统一、全局搜索、面包屑导航、页面过渡动画和侧边栏可折叠五个方面的改进，其中路由系统统一是当前最高优先级的阻断性问题。

### UX-07 路由系统统一与浏览器历史支持

- **优先级**: P0（阻断）
- **类别**: 导航 > 路由架构
- **改进内容**: 当前 `App.tsx` 中存在自定义 `getPageFromHash()` 函数（见 `App.tsx:44-45`），手动解析 `window.location.hash` 来确定当前页面，与 `react-router-dom` 的 `HashRouter` 严重冲突。全项目至少有 30 处使用 `window.location.hash = '#/xxx'` 进行手动导航（如 `HomePage.tsx:463`、`InstancesPage.tsx:313`、`InstanceDetailPage.tsx:401` 等），而非使用 `react-router-dom` 的 `useNavigate()`。这导致以下严重问题：`useParams` 无法获取路由参数（如 InstanceDetailPage 的实例 ID），浏览器后退/前进按钮行为异常，深层链接无法直接访问特定页面。
- **技术实现建议**:
  1. 移除 `App.tsx` 中的 `getPageFromHash()` 函数和手动 `hashchange` 监听，完全依赖 `react-router-dom` 的路由系统：

  ```typescript
  // App.tsx 重构后
  import { HashRouter, Routes, Route } from 'react-router-dom';

  export default function App() {
    return (
      <AppProviders>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/home" />} />
              <Route path="home" element={<HomePage />} />
              <Route path="instances" element={<InstancesPage />} />
              <Route path="instances/new" element={<NewInstancePage />} />
              <Route path="instances/:id" element={<InstanceDetailPage />} />
              {/* ...其他路由 */}
            </Route>
          </Routes>
        </HashRouter>
      </AppProviders>
    );
  }
  ```

  2. 将所有 `window.location.hash = '#/xxx'` 替换为 `useNavigate()` 调用。涉及约 30 处修改，可分批进行：

  ```typescript
  // Before:
  window.location.hash = '#/instances/new';
  // After:
  const navigate = useNavigate();
  navigate('/instances/new');
  ```

  3. InstanceDetailPage 中使用 `useParams` 获取实例 ID：

  ```typescript
  // Before:
  const hashParts = window.location.hash.replace('#/', '').split('/');
  const instanceId = hashParts[1];
  // After:
  const { id: instanceId } = useParams<{ id: string }>();
  ```

  4. 侧边栏导航使用 `NavLink` 替代手动 hash 切换，自动获得 active 状态样式。

- **预期解决的问题**: InstanceDetailPage 等功能页参数丢失导致页面崩溃；浏览器后退按钮行为异常；深层链接无法直接访问；路由参数无法传递。
- **关联模块**: [App.tsx](file:///Users/xiatian/Desktop/BonNext/src/App.tsx#L44), [InstanceDetailPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/InstanceDetailPage.tsx#L73), [HomePage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/HomePage.tsx), [InstancesPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/InstancesPage.tsx), 所有使用 `window.location.hash` 的组件

---

### UX-08 全局搜索面板（Command Palette）

- **优先级**: P2（中）
- **类别**: 导航 > 全局搜索
- **改进内容**: 项目中已存在 `SearchPalette` 组件，但功能有限，仅支持当前页面的搜索。缺少全局搜索能力，用户需在多个页面间切换查找特定实例、模组、版本或设置项。Command Palette 模式已成为现代桌面应用的标配交互模式（VS Code、Notion、Linear 等），可显著提升操作效率。
- **技术实现建议**:
  1. 扩展 `SearchPalette` 为全局 Command Palette，注册 `Cmd+K` / `Ctrl+K` 全局快捷键：

  ```typescript
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  ```

  2. 建立统一搜索索引，聚合多数据源结果：

  ```typescript
  interface SearchSource {
    id: string;
    label: string;
    search: (query: string) => Promise<SearchResult[]>;
    icon: React.ReactNode;
  }
  // 注册搜索源：instances, mods, versions, settings, actions
  ```

  3. 支持模糊匹配（使用 `fuse.js` 或内置 `Intl.Collator`），最近搜索记录持久化到 localStorage。

- **预期解决的问题**: 查找特定实例、模组或设置项需多次点击和页面切换，操作路径长、效率低。
- **关联模块**: [SearchPalette.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/SearchPalette.tsx)

---

### UX-09 面包屑导航

- **优先级**: P2（中）
- **类别**: 导航 > 层级导航
- **改进内容**: 深层页面（如 InstanceDetailPage 的子 Tab、ContentDetailPage 的版本详情）缺少层级导航，用户无法快速判断当前位置和返回上级页面。面包屑导航是解决此问题的标准模式，且应与 ZZZ 美学风格统一。
- **技术实现建议**:
  1. 创建 `Breadcrumb` 组件，基于当前路由自动生成层级：

  ```tsx
  // src/components/ui/Breadcrumb.tsx
  interface BreadcrumbItem {
    label: string;
    path?: string;
  }
  interface BreadcrumbProps {
    items: BreadcrumbItem[];
  }
  // 渲染为: 首页 > 实例 > My Instance > 模组
  // 使用 clip-path: var(--clip-small) 风格的分隔符
  ```

  2. 在 AppShell 中根据路由自动生成面包屑映射：

  ```typescript
  const routeBreadcrumbMap: Record<string, BreadcrumbItem[]> = {
    '/instances': [{ label: '首页', path: '/home' }, { label: '实例' }],
    '/instances/:id': [{ label: '首页', path: '/home' }, { label: '实例', path: '/instances' }, { label: '详情' }],
    // ...
  };
  ```

  3. 将面包屑组件放置在页面顶部内容区域，与页面标题对齐。

- **预期解决的问题**: 深层页面用户迷失位置，无法快速返回上级，需反复使用侧边栏导航。
- **关联模块**: AppShell.tsx, App.tsx, `src/components/ui/`

---

### UX-10 页面切换过渡动画

- **优先级**: P2（中）
- **类别**: 导航 > 过渡体验
- **改进内容**: 当前页面切换无过渡动画，视觉跳变生硬。`ux-delight.css` 中已定义 `.stagger-in` 等入场动画类，但未应用于页面级别的路由切换。需要为路由切换添加淡入+微位移的过渡效果，提升视觉连贯性。
- **技术实现建议**:
  1. 使用 CSS `@view-transition` 或 React `CSSTransition` 实现页面过渡：

  ```tsx
  // 使用 framer-motion（轻量方案，无需额外依赖可使用 CSS 方案）
  <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
      <Route
        path="/home"
        element={
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <HomePage />
          </motion.div>
        }
      />
    </Routes>
  </AnimatePresence>
  ```

  2. 纯 CSS 方案（无需新增依赖）——利用 `ux-delight.css` 中已有的动画定义，在路由容器上添加过渡类：

  ```css
  .page-enter {
    animation: pageIn 0.2s ease-out;
  }
  @keyframes pageIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  ```

  3. 确保过渡动画尊重 `prefers-reduced-motion` 偏好（见 UX-19）。

- **预期解决的问题**: 页面切换视觉断裂感，用户感知到界面"闪烁"或"跳变"，降低产品精致度。
- **关联模块**: [App.tsx](file:///Users/xiatian/Desktop/BonNext/src/App.tsx), [ux-delight.css](file:///Users/xiatian/Desktop/BonNext/src/styles/ux-delight.css)

---

### UX-11 侧边栏可折叠与自定义

- **优先级**: P3（低）
- **类别**: 导航 > 布局灵活性
- **改进内容**: 当前侧边栏（`Sidebar` 组件）固定宽度不可折叠，在小窗口或低分辨率屏幕上占用过多内容区域空间。应支持折叠为图标模式，并记住用户偏好。
- **技术实现建议**:
  1. 在 `Sidebar` 组件中添加折叠/展开状态，折叠时仅显示图标：

  ```typescript
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);
  ```

  2. 折叠模式下侧边栏宽度从 `240px` 缩减为 `56px`，图标居中显示，hover 时弹出 tooltip 显示完整标签。

  3. 在侧边栏底部添加折叠切换按钮，使用 chevron 图标。

- **预期解决的问题**: 小窗口下内容区域受限，侧边栏占用空间无法释放；用户无法根据个人偏好调整布局。
- **关联模块**: [Sidebar.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/layout/Sidebar.tsx), [AppShell.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/AppShell.tsx)

---

### 2.3 表单与输入体验（4项）

表单是用户配置启动器行为的主要交互方式。复杂的表单（如 JVM 参数、实例创建）如果缺乏引导和验证，会让用户感到困惑甚至配置错误，导致游戏无法启动。本子类涵盖 JVM 预设、实例向导增强、智能默认值和表单验证四个方面的改进。

### UX-12 JVM参数预设系统

- **优先级**: P2（中）
- **类别**: 表单体验 > 高级配置
- **改进内容**: JVM 参数配置（AdvancedSection）需要用户手动输入 `-Xmx`、`-XX:+UseG1GC` 等参数，普通用户不了解这些参数的含义和推荐组合。需要提供预设模板系统，降低配置门槛。前端已有 `OptimizationPresets` 组件框架，但尚未实现完整的预设逻辑。
- **技术实现建议**:
  1. 定义预设模板数据结构：

  ```typescript
  interface JVMPreset {
    id: string;
    name: string; // "性能优先" / "兼容优先" / "大模组包"
    description: string; // 预设说明
    args: string[]; // ["-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", ...]
    minMemory: number; // 推荐最低内存 MB
    recommendedMemory: number;
  }
  const PRESETS: JVMPreset[] = [
    {
      id: 'performance',
      name: '性能优先',
      description: '优化GC暂停时间，适合对帧率敏感的场景',
      args: [
        '-XX:+UseG1GC',
        '-XX:+ParallelRefProcEnabled',
        '-XX:MaxGCPauseMillis=200',
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+DisableExplicitGC',
      ],
      minMemory: 2048,
      recommendedMemory: 4096,
    },
    // ... 更多预设
  ];
  ```

  2. 支持用户自定义预设保存到 config 中，与系统预设合并显示。

  3. 选择预设后自动填充参数文本框，用户可在此基础上微调。

- **预期解决的问题**: JVM 参数配置门槛高，普通用户不知道如何优化；错误配置可能导致游戏崩溃或性能低下。
- **关联模块**: [AdvancedSection.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/settings/AdvancedSection.tsx)

---

### UX-13 实例创建向导增强

- **优先级**: P2（中）
- **类别**: 表单体验 > 向导流程
- **改进内容**: 当前 `NewInstancePage` 的创建流程较为简单，缺少版本与加载器的兼容性预检、推荐模组引导等步骤。新手用户容易选择不兼容的版本组合（如 Forge 1.20.1 + Fabric Loader），导致实例创建后无法正常启动。
- **技术实现建议**:
  1. 将创建流程重构为多步骤向导：

  ```
  Step 1: 选择游戏版本 → Step 2: 选择加载器（含兼容性校验）→ Step 3: 推荐模组（可选）→ Step 4: 确认创建
  ```

  2. 版本+加载器兼容性实时校验——查询 Modrinth/FurseForge 的 loader 版本兼容数据：

  ```typescript
  const checkCompatibility = async (mcVersion: string, loaderType: string, loaderVersion: string) => {
    const versions = await api.getModloaderVersions(mcVersion, loaderType);
    return versions.some((v) => v.id === loaderVersion);
  };
  ```

  3. 在 Step 3 中展示热门模组包快速导入选项，基于 Modrinth 的 popular tags 数据。

- **预期解决的问题**: 新手创建实例容易选错版本组合导致启动失败；缺少引导导致创建流程不直观。
- **关联模块**: [NewInstancePage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/NewInstancePage.tsx)

---

### UX-14 智能默认值与自动检测

- **优先级**: P2（中）
- **类别**: 表单体验 > 智能推荐
- **改进内容**: 内存分配、Java 路径、游戏目录等设置项需要用户手动配置，缺少基于系统硬件的智能推荐。新用户往往不知道如何合理分配内存（分配过多导致系统卡顿，分配过少导致游戏崩溃）。
- **技术实现建议**:
  1. 后端添加 `get_recommended_config` 命令，基于系统信息生成推荐配置：

  ```rust
  #[tauri::command]
  pub fn get_recommended_config(sys_info: &SystemInfo) -> RecommendedConfig {
      let total_mem_mb = sys_info.total_memory / (1024 * 1024);
      RecommendedConfig {
          max_memory: ((total_mem_mb as f64 * 0.5).min(8192.0)) as u64, // 不超过50%或8GB
          min_memory: 512,
          java_path: None, // 自动检测
      }
  }
  ```

  2. 前端首次启动时调用该命令，在设置页显示"推荐"标签：

  ```tsx
  <div className={styles.field}>
    <label>最大内存</label>
    <input type="range" ... />
    {isRecommended && <Badge variant="accent">推荐</Badge>}
  </div>
  ```

  3. Java 路径自动检测——后端 `platform/java.rs` 已有检测逻辑，前端应在设置页自动填充检测结果。

- **预期解决的问题**: 新用户不知道如何配置内存、Java 路径等设置，错误配置导致游戏无法启动或系统卡顿。
- **关联模块**: [configStore.tsx](file:///Users/xiatian/Desktop/BonNext/src/stores/configStore.tsx), [SettingsPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/SettingsPage.tsx), `src-tauri/src/platform/java.rs`

---

### UX-15 表单验证与错误提示增强

- **优先级**: P2（中）
- **类别**: 表单体验 > 输入验证
- **改进内容**: 部分表单缺少实时验证，错误仅在提交后显示。例如 Yggdrasil 外置登录的 URL 格式、内存分配范围、Java 路径是否存在等关键输入项，均缺少即时校验反馈。`errorMapping.ts` 已有结构化错误映射，但未应用于表单验证场景。
- **技术实现建议**:
  1. 创建通用 `useFormField` Hook，集成验证逻辑：

  ```typescript
  // src/hooks/useFormField.ts
  interface ValidationRule {
    validate: (value: string) => boolean;
    message: string;
  }
  export function useFormField(initialValue: string, rules: ValidationRule[]) {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);
    const validate = () => {
      for (const rule of rules) {
        if (!rule.validate(value)) {
          setError(rule.message);
          return false;
        }
      }
      setError(null);
      return true;
    };
    return { value, setValue, error, validate, onBlur: validate };
  }
  ```

  2. 定义常用验证规则：

  ```typescript
  const VALIDATORS = {
    url: { validate: (v) => /^https?:\/\/.+/.test(v), message: '请输入有效的 URL（以 http:// 或 https:// 开头）' },
    memoryRange: {
      validate: (v) => {
        const n = Number(v);
        return n >= 512 && n <= 32768;
      },
      message: '内存范围：512MB - 32768MB',
    },
    javaPath: { validate: (v) => !v || v.includes('java'), message: '请输入有效的 Java 路径' },
  };
  ```

  3. 错误提示靠近字段显示，使用红色边框 + 下方文字提示模式。

- **预期解决的问题**: 用户提交表单后才发现输入错误，需要反复修改和提交，体验差且效率低。
- **关联模块**: [errorMapping.ts](file:///Users/xiatian/Desktop/BonNext/src/utils/errorMapping.ts), 所有表单组件

---

### 2.4 视觉与主题（4项）

视觉设计是 BonNext 的差异化优势——ZZZ 风格的 Neo-Tokyo 赛博朋克美学是产品的核心辨识度。然而，多主题支持（Dark/Light/OLED/MD3）在实现层面存在对比度不足、变量缺失、硬编码颜色等问题，影响了视觉一致性和无障碍合规。本子类涵盖 Light 主题对比度修复、accent 透明度补全、OLED 主题完善和动画偏好尊重四个方面的改进。

### UX-16 Light主题对比度修复

- **优先级**: P0（阻断）
- **类别**: 视觉设计 > 无障碍合规
- **改进内容**: Light 主题的强调色 `--accent: #6B5F00` 与白色背景 `--bg-card: #ffffff` 的对比度约为 5.2:1，满足 WCAG AA 大文本标准（3:1）但接近普通文本标准（4.5:1）的边界。然而，Light 主题中 `--text-muted: #777777` 与 `--bg-primary: #fafafa` 的对比度仅约 4.1:1，低于 WCAG AA 标准 4.5:1；`--text-faint: #aaaaaa` 与白色背景的对比度仅约 2.7:1，远低于标准。部分派生色如 `--color-accent-06: rgba(107, 95, 0, 0.08)` 在白色背景上几乎不可见。这不仅是视觉体验问题，更是无障碍合规问题。
- **技术实现建议**:
  1. 调整 Light 主题中低对比度色值，确保所有文本色与背景色对比度 ≥ 4.5:1：

  ```css
  .theme-light {
    --text-muted: #666666; /* 原 #777777, 对比度 4.1→5.7 */
    --text-faint: #888888; /* 原 #aaaaaa, 对比度 2.7→3.95 → 需进一步调深 */
    --color-accent-06: rgba(107, 95, 0, 0.15); /* 原 0.08, 提高可见度 */
    --color-accent-10: rgba(107, 95, 0, 0.2); /* 原 0.12 */
  }
  ```

  2. 添加自动化对比度检测脚本，在 CI 中运行：

  ```javascript
  // scripts/check-contrast.mjs
  import { readFileSync } from 'fs';
  const css = readFileSync('src/styles/themes.css', 'utf-8');
  // 解析 CSS 变量，计算前景/背景对比度
  // 对比度 < 4.5 的组合输出为 error
  ```

  3. 为所有主题添加对比度注释，方便后续维护：

  ```css
  --text-muted: #666666; /* vs #fafafa: 5.7:1 ✓ AA */
  ```

- **预期解决的问题**: Light 主题下部分文字不可读，违反 WCAG AA 无障碍标准，可能导致合规风险和用户投诉。
- **关联模块**: [themes.css](file:///Users/xiatian/Desktop/BonNext/src/styles/themes.css)

---

### UX-17 暗色主题accent透明度变量补全

- **优先级**: P2（中）
- **类别**: 视觉设计 > 设计系统一致性
- **改进内容**: Light 主题已定义完整的 accent 透明度梯度（`--color-accent-06` 至 `--color-accent-30`，见 `themes.css:71-75`），但 Dark 主题和 OLED 主题缺少对应的透明度变量。这导致组件在不同主题下使用硬编码的 `rgba(255, 230, 0, 0.x)` 值，表现不一致且难以统一调整。
- **技术实现建议**:
  1. 在 Dark 主题和 OLED 主题中补全 accent 透明度梯度：

  ```css
  .theme-dark {
    --color-accent-06: rgba(255, 230, 0, 0.06);
    --color-accent-10: rgba(255, 230, 0, 0.1);
    --color-accent-15: rgba(255, 230, 0, 0.15);
    --color-accent-20: rgba(255, 230, 0, 0.2);
    --color-accent-30: rgba(255, 230, 0, 0.3);
    --color-accent-50: rgba(255, 230, 0, 0.5);
  }
  .theme-oled {
    --color-accent-06: rgba(255, 230, 0, 0.08); /* OLED 纯黑背景需略高透明度 */
    --color-accent-10: rgba(255, 230, 0, 0.12);
    /* ... */
  }
  ```

  2. 全局搜索替换所有硬编码的 `rgba(255, 230, 0, ...)` 为 CSS 变量引用：

  ```bash
  grep -rn "rgba(255, 230, 0" src/ --include="*.css" --include="*.module.css"
  ```

  3. 在 `tokens.css` 中定义语义化的 accent 用途变量（如 `--accent-hover-bg`、`--accent-active-bg`），映射到透明度梯度变量。

- **预期解决的问题**: 不同主题下 accent 透明度不一致，组件视觉表现差异大；硬编码 rgba 值难以统一调整。
- **关联模块**: [themes.css](file:///Users/xiatian/Desktop/BonNext/src/styles/themes.css), [tokens.css](file:///Users/xiatian/Desktop/BonNext/src/styles/tokens.css), 所有 `*.module.css` 文件

---

### UX-18 OLED主题完善

- **优先级**: P3（低）
- **类别**: 视觉设计 > 主题完整性
- **改进内容**: OLED 主题（纯黑 `#000000` 背景，见 `themes.css:91-120`）部分组件使用硬编码颜色值而非 CSS 变量，导致在纯黑背景下显示异常（如边框不可见、文字与背景融合）。需要审查所有组件的 CSS Module，确保颜色值均通过 CSS 变量引用。
- **技术实现建议**:
  1. 全局扫描硬编码颜色值：

  ```bash
  grep -rn "#[0-9a-fA-F]\{3,8\}" src/ --include="*.module.css" | grep -v "var(--"
  ```

  2. 将所有硬编码色值替换为 CSS 变量引用。重点关注以下场景：
  - `#141414`、`#1a1a1a` 等深灰色 → `var(--bg-secondary)`、`var(--bg-card)`
  - `#ffffff`、`#fff` 等白色 → `var(--text-primary)`
  - `#888`、`#aaa` 等灰色 → `var(--text-muted)`、`var(--text-secondary)`
  3. 为 OLED 主题添加专用覆盖层，处理纯黑背景下的特殊视觉需求（如更明显的边框、更高的阴影对比度）。

- **预期解决的问题**: OLED 主题下部分元素不可见或视觉异常，主题切换体验不完整。
- **关联模块**: [themes.css](file:////Users/xiatian/Desktop/BonNext/src/styles/themes.css), 所有 `*.module.css` 文件

---

### UX-19 动画偏好尊重（prefers-reduced-motion）

- **优先级**: P2（中）
- **类别**: 视觉设计 > 无障碍
- **改进内容**: 项目已部分支持 `prefers-reduced-motion`（`global.css:187,363`、`tokens.css:102`、`ux-delight.css:1175`、`utils/reducedMotion.ts`），但覆盖不完整。`ux-delight.css` 中大量入场动画、交错动画、shimmer 效果未包裹在 `@media (prefers-reduced-motion: no-preference)` 中，动画敏感用户无法正常使用。
- **技术实现建议**:
  1. 在 `ux-delight.css` 中，将所有动画定义包裹在媒体查询中：

  ```css
  /* Before */
  .stagger-in {
    animation: staggerIn 0.4s ease-out;
  }

  /* After */
  @media (prefers-reduced-motion: no-preference) {
    .stagger-in {
      animation: staggerIn 0.4s ease-out;
    }
  }
  ```

  2. 对于装饰性动画（noise overlay、scanline overlay、粒子效果），在 `prefers-reduced-motion: reduce` 下完全禁用：

  ```css
  @media (prefers-reduced-motion: reduce) {
    .noise-overlay,
    .scanline-overlay {
      display: none;
    }
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

  3. 在 `utils/reducedMotion.ts` 中导出 Hook，供 JS 控制的动画使用：

  ```typescript
  export const useReducedMotion = () => {
    const [prefersReduced, setPrefersReduced] = useState(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }, []);
    return prefersReduced;
  };
  ```

- **预期解决的问题**: 动画敏感用户（前庭功能障碍、注意力障碍等）无法正常使用应用，违反无障碍最佳实践。
- **关联模块**: [ux-delight.css](file:///Users/xiatian/Desktop/BonNext/src/styles/ux-delight.css), [global.css](file:///Users/xiatian/Desktop/BonNext/src/styles/global.css), [reducedMotion.ts](file:///Users/xiatian/Desktop/BonNext/src/utils/reducedMotion.ts)

---

### 2.5 无障碍设计（4项）

无障碍设计不仅是道德义务，更是法律合规要求。欧盟《无障碍法案》（European Accessibility Act）将于 2025 年 6 月生效，要求数字产品满足 WCAG 2.1 AA 标准。BonNext 作为面向全球用户的桌面应用，必须确保键盘可访问性、屏幕阅读器兼容性和色彩对比度合规。本子类涵盖 Modal 焦点陷阱、键盘可访问性、屏幕阅读器支持和对比度自动检测四个方面的改进。

### UX-20 Modal焦点陷阱完善

- **优先级**: P1（高）
- **类别**: 无障碍 > 键盘交互
- **改进内容**: 当前 `Modal` 组件已实现焦点陷阱（Tab/Shift+Tab 循环，见 `Modal.tsx:31-58`）、`role="dialog"` 和 `aria-modal="true"`（见 `Modal.tsx:94-95`）、打开时焦点移入和关闭时焦点恢复（见 `Modal.tsx:61-77`）。但存在以下问题：焦点陷阱仅监听 Modal 内部的 Tab 键，未阻止浏览器默认的 Tab 行为穿透到 Modal 外部（缺少 `e.preventDefault()` 在某些边界条件下）；打开 Modal 时未设置 `aria-hidden="true"` 到背景内容；多个 Modal 嵌套时焦点管理可能冲突。
- **技术实现建议**:
  1. 增强 Modal 打开时的背景内容隐藏：

  ```typescript
  useEffect(() => {
    if (open) {
      // 标记背景内容为 aria-hidden
      const siblings = Array.from(modalRef.current?.parentElement?.children || []);
      siblings.forEach((el) => {
        if (el !== modalRef.current) el.setAttribute('aria-hidden', 'true');
      });
    }
    return () => {
      // 恢复
      const siblings = Array.from(modalRef.current?.parentElement?.children || []);
      siblings.forEach((el) => el.removeAttribute('aria-hidden'));
    };
  }, [open]);
  ```

  2. 添加 Modal 嵌套支持——维护 Modal 栈，确保焦点在最顶层 Modal 内循环：

  ```typescript
  // 全局 Modal 管理器
  const modalStack: HTMLDivElement[] = [];
  function pushModal(ref: HTMLDivElement) {
    modalStack.push(ref);
  }
  function popModal() {
    modalStack.pop();
  }
  function getTopModal() {
    return modalStack[modalStack.length - 1];
  }
  ```

  3. 在 `handleKeyDown` 的 Tab 处理中，确保 `e.preventDefault()` 在所有需要阻止默认行为的路径上都被调用。

- **预期解决的问题**: 键盘用户在 Modal 打开时可能 Tab 到背景内容，违反 WAI-ARIA Dialog 模式；多 Modal 嵌套时焦点管理混乱。
- **关联模块**: [Modal.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/Modal.tsx)

---

### UX-21 交互元素键盘可访问性

- **优先级**: P2（中）
- **类别**: 无障碍 > 键盘导航
- **改进内容**: `ContentCard`、`InstallButton` 等交互组件使用 `div`/`span` 元素实现点击行为，缺少 `tabIndex`、`role` 和键盘事件处理。键盘用户无法通过 Tab 聚焦到这些元素，也无法通过 Enter/Space 触发操作。部分组件已添加 `aria-label`（如 `NewsArticleModal.tsx:67`、`MiniMode.tsx:142`），但覆盖不完整。
- **技术实现建议**:
  1. 为所有可点击的 `div`/`span` 添加语义化属性：

  ```tsx
  // Before:
  <div className={styles.card} onClick={handleClick}>
  // After:
  <div className={styles.card} onClick={handleClick}
       role="button" tabIndex={0}
       onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}>
  ```

  2. 创建 `Clickable` 高阶组件或 `useClickable` Hook，统一处理键盘交互：

  ```typescript
  // src/hooks/useClickable.ts
  export function useClickable(onClick: () => void) {
    return {
      role: 'button' as const,
      tabIndex: 0,
      onClick,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      },
    };
  }
  ```

  3. 添加 `focus-visible` 样式，确保键盘焦点可见：

  ```css
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  ```

- **预期解决的问题**: 键盘用户无法操作内容卡片、安装按钮等核心交互元素，严重影响可访问性。
- **关联模块**: [ContentCard.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/ContentCard.tsx), InstallButton.tsx, 所有使用 `div onClick` 的交互组件

---

### UX-22 屏幕阅读器支持

- **优先级**: P2（中）
- **类别**: 无障碍 > 辅助技术
- **改进内容**: 关键交互区域缺少 `aria-label` 和 `aria-live` 动态区域。下载进度变化、实例状态变更、错误提示等动态内容无法被屏幕阅读器感知。页面标题未随路由切换动态更新。
- **技术实现建议**:
  1. 为图标按钮添加 `aria-label`：

  ```tsx
  <button onClick={onClose} aria-label="关闭对话框">
    <Icon name="cross" size={14} />
  </button>
  ```

  2. 下载进度区域添加 `aria-live="polite"`：

  ```tsx
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {task.progress !== undefined && `下载进度 ${Math.round(task.progress)}%`}
  </div>
  ```

  3. 路由切换时动态更新 `document.title`：

  ```typescript
  useEffect(() => {
    document.title = `${pageTitle} - BonNext`;
  }, [location.pathname]);
  ```

  4. 添加 `.sr-only` 工具类用于屏幕阅读器专用文本：

  ```css
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  ```

- **预期解决的问题**: 屏幕阅读器用户无法获取页面动态信息（下载进度、状态变更、错误提示），严重影响视障用户的使用。
- **关联模块**: 所有交互组件, App.tsx, DownloadPanel.tsx

---

### UX-23 色彩对比度自动化检测

- **优先级**: P3（低）
- **类别**: 无障碍 > 自动化检测
- **改进内容**: 当前缺少对比度检测机制，主题变更或新增组件可能引入对比度问题而不被察觉。需要建立自动化检测流程，在开发阶段就发现无障碍问题。
- **技术实现建议**:
  1. CI 中集成 `axe-core` 进行运行时无障碍检测：

  ```yaml
  # .github/workflows/a11y.yml
  - name: Accessibility audit
    run: npx @axe-core/cli http://localhost:1420 --include "**"
  ```

  2. 添加 CSS 变量对比度静态检测脚本：

  ```javascript
  // scripts/check-contrast.mjs
  // 解析 themes.css 中的 CSS 变量
  // 计算前景/背景色对组合的 WCAG 对比度
  // 低于 4.5:1 的组合输出为 error
  ```

  3. 在开发模式下添加对比度实时提示（浏览器扩展或 DevTools 面板）。

- **预期解决的问题**: 无障碍问题在开发阶段不可见，直到用户投诉或合规审计时才被发现，修复成本高。
- **关联模块**: CI 配置, [themes.css](file:///Users/xiatian/Desktop/BonNext/src/styles/themes.css)

---

### 2.6 通知与引导（4项）

有效的通知和引导系统能帮助用户发现功能、理解操作后果、避免误操作。对于 BonNext 这样功能丰富的启动器，新手引导和上下文帮助尤为重要——许多高级功能（如模组管理、版本切换、代理配置）如果缺乏引导，用户可能永远不会发现和使用。本子类涵盖新手引导增强、应用更新通知、操作撤销机制和上下文帮助系统四个方面的改进。

### UX-24 新手引导系统增强

- **优先级**: P2（中）
- **类别**: 通知引导 > 功能发现
- **改进内容**: 当前 `OnboardingWizard` 仅覆盖首次登录流程，缺少后续功能发现引导。新用户不知道实例管理、模组安装、版本切换等高级功能的存在，导致产品功能利用率低。
- **技术实现建议**:
  1. 实现功能发现提示系统，基于用户行为触发：

  ```typescript
  interface DiscoveryTip {
    id: string;
    trigger: 'first_visit' | 'first_action' | 'n_uses'; // 触发条件
    page: string; // 在哪个页面显示
    target: string; // 指向哪个元素
    title: string;
    description: string;
    dismissible: boolean;
  }
  ```

  2. 引导进度保存到 config 中，避免重复提示：

  ```rust
  // config.rs 中添加
  pub struct OnboardingState {
      pub completed_steps: Vec<String>,
      pub dismissed_tips: Vec<String>,
  }
  ```

  3. 使用 Spotlight 高亮模式（类似 driver.js），将用户注意力聚焦到目标元素。

- **预期解决的问题**: 新用户不知道高级功能存在，产品功能利用率低，用户留存率受影响。
- **关联模块**: [HomePage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/HomePage.tsx), [OnboardingWizard.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/OnboardingWizard.tsx)

---

### UX-25 应用更新通知

- **优先级**: P2（中）
- **类别**: 通知引导 > 版本更新
- **改进内容**: 当前缺少应用自身的更新检测和通知机制。Tauri v2 支持内置的 updater 插件，但尚未集成。用户无法得知新版本可用，可能长期使用包含已知缺陷的旧版本。
- **技术实现建议**:
  1. 启动时检查 GitHub Releases API：

  ```rust
  #[tauri::command]
  pub async fn check_for_updates() -> Result<Option<UpdateInfo>, LauncherError> {
      let client = build_client();
      let resp: serde_json::Value = client
          .get("https://api.github.com/repos/BonNext/BonNext/releases/latest")
          .send().await?.json().await?;
      let latest = resp["tag_name"].as_str().unwrap_or("");
      if latest > env!("CARGO_PKG_VERSION") {
          Ok(Some(UpdateInfo {
              version: latest.to_string(),
              changelog: resp["body"].as_str().unwrap_or("").to_string(),
              download_url: resp["assets"][0]["browser_download_url"].as_str().unwrap_or("").to_string(),
          }))
      } else {
          Ok(None)
      }
  }
  ```

  2. 有更新时在 AppShell 顶部显示通知栏，支持"立即更新"/"跳过此版本"。

  3. 跳过的版本号保存到 config，避免重复提醒。

- **预期解决的问题**: 用户不知道有新版本可用，可能长期使用包含安全漏洞或已知缺陷的旧版本。
- **关联模块**: [lib.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/lib.rs), [AppShell.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/AppShell.tsx)

---

### UX-26 操作撤销机制

- **优先级**: P3（低）
- **类别**: 通知引导 > 操作安全
- **改进内容**: 删除实例、移除模组等操作不可撤销，误操作导致数据永久丢失。虽然 UX-03 的确认对话框可降低误操作概率，但无法完全避免。需要实现软删除机制，提供恢复窗口。
- **技术实现建议**:
  1. 后端实现软删除——移至回收站目录而非直接删除：

  ```rust
  // instance/manager.rs
  pub async fn soft_delete_instance(id: &str) -> Result<(), LauncherError> {
      let instance_dir = get_instance_dir(id);
      let trash_dir = paths::get_game_dir().join(".trash").join(id);
      tokio::fs::create_dir_all(trash_dir.parent().unwrap()).await?;
      tokio::fs::rename(&instance_dir, &trash_dir).await?;
      // 记录删除时间，30天后自动清理
      let meta = serde_json::json!({ "deleted_at": chrono::Utc::now().to_rfc3339() });
      tokio::fs::write(trash_dir.join(".trash_meta.json"), meta.to_string()).await?;
      Ok(())
  }
  ```

  2. Toast 通知添加"撤销"按钮，30 秒内可恢复：

  ```typescript
  addToast({
    type: 'info',
    title: '实例已删除',
    message: '点击撤销可恢复',
    duration: 30000,
    action: { label: '撤销', onClick: () => api.restoreInstance(id) },
  });
  ```

  3. 后台定时任务清理超过 30 天的回收站项目。

- **预期解决的问题**: 误操作导致数据永久丢失，即使有确认对话框也无法完全避免。
- **关联模块**: [manager.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/instance/manager.rs)

---

### UX-27 上下文帮助系统

- **优先级**: P3（低）
- **类别**: 通知引导 > 帮助文档
- **改进内容**: 复杂设置项（如 JVM 参数、代理配置、安全设置）缺少解释，用户需查阅外部文档才能理解含义。需要在设置项旁添加上下文帮助入口。
- **技术实现建议**:
  1. 为设置项添加 `info` 图标 + 悬浮提示：

  ```tsx
  <div className={styles.field}>
    <label>
      JVM 参数
      <Tooltip content="JVM 参数控制 Java 虚拟机的运行行为。常见参数包括 -Xmx（最大内存）和 -XX:+UseG1GC（垃圾回收器）。">
        <Icon name="info" size={14} className={styles.infoIcon} />
      </Tooltip>
    </label>
    <input ... />
  </div>
  ```

  2. 首次使用时显示简要说明气泡（与 UX-24 的功能发现系统联动）。

  3. 设置项关联在线文档链接，点击跳转到 BonNext 文档站点的对应章节。

- **预期解决的问题**: 用户不理解设置含义，错误配置导致功能异常；需频繁查阅外部文档，体验割裂。
- **关联模块**: [SettingsPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/SettingsPage.tsx)

---

### 2.7 多语言与本地化（3项）

国际化是 BonNext 走向全球用户的基础。当前项目已集成 i18n 框架，但翻译覆盖不完整、格式本地化缺失、RTL 布局不支持等问题，严重制约了产品在非中文用户群体中的可用性。本子类涵盖 i18n 翻译完整性、日期数字格式本地化和 RTL 布局支持三个方面的改进。

### UX-28 i18n翻译完整性

- **优先级**: P1（高）
- **类别**: 多语言 > 翻译覆盖
- **改进内容**: 项目已集成 i18n 系统（`src/i18n/`），但安全设置等模块仍存在硬编码中文字符串，破坏了 i18n 完整性。非中文用户会看到混合语言界面，严重影响国际化体验。部分页面的翻译覆盖率低，缺失翻译未回退到英文。
- **技术实现建议**:
  1. 全局扫描硬编码中文字符串：

  ```bash
  grep -rn "[\u4e00-\u9fff]" src/ --include="*.tsx" --include="*.ts" | grep -v "i18n/" | grep -v ".d.ts"
  ```

  2. 将所有硬编码字符串提取到 i18n 资源文件中：

  ```json
  // src/i18n/locales/en/settings.json
  { "security": { "proxyEnabled": "Proxy Enabled", "proxyUrl": "Proxy URL" } }
  // src/i18n/locales/zh/settings.json
  { "security": { "proxyEnabled": "启用代理", "proxyUrl": "代理地址" } }
  ```

  3. 添加翻译覆盖率检测脚本，在 CI 中运行：

  ```javascript
  // scripts/check-i18n.mjs
  // 比较各语言文件的 key 覆盖率
  // 缺失翻译 > 5% 时 CI 失败
  ```

  4. 确保 i18n 系统的回退机制：缺失翻译 → 英文 → key 本身。

- **预期解决的问题**: 非中文用户看到混合语言界面，国际化体验差；翻译缺失无回退机制。
- **关联模块**: `src/i18n/`, `src/pages/settings/`

---

### UX-29 日期与数字格式本地化

- **优先级**: P3（低）
- **类别**: 多语言 > 格式本地化
- **改进内容**: 日期时间显示格式未本地化，所有区域使用同一格式。数字（如下载量、文件大小）的格式化也未考虑地区差异（如千位分隔符）。
- **技术实现建议**:
  1. 创建 `format.ts` 工具模块，使用 `Intl` API 格式化：

  ```typescript
  // src/utils/format.ts
  export function formatDate(date: Date | string, locale?: string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale || navigator.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }

  export function formatNumber(num: number, locale?: string): string {
    return new Intl.NumberFormat(locale || navigator.language).format(num);
  }

  export function formatFileSize(bytes: number, locale?: string): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size)} ${units[i]}`;
  }
  ```

  2. 支持用户在设置中选择 12/24 小时制。

- **预期解决的问题**: 日期和数字格式不符合用户地区习惯，降低信息可读性。
- **关联模块**: `src/utils/format.ts`, `src/utils/time.ts`

---

### UX-30 RTL布局支持

- **优先级**: P3（低）
- **类别**: 多语言 > 布局方向
- **改进内容**: 阿拉伯语、希伯来语等 RTL（从右到左）语言的布局完全不支持。当前所有布局假设 LTR 方向，RTL 语言下界面镜像错误。
- **技术实现建议**:
  1. 在 HTML 根元素添加 `dir` 属性支持：

  ```typescript
  useEffect(() => {
    const rtlLocales = ['ar', 'he', 'fa', 'ur'];
    const isRTL = rtlLocales.some((l) => navigator.language.startsWith(l));
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [i18n.language]);
  ```

  2. CSS 使用逻辑属性替代物理方向属性：

  ```css
  /* Before */
  .card {
    margin-left: 16px;
    padding-right: 8px;
  }
  /* After */
  .card {
    margin-inline-start: 16px;
    padding-inline-end: 8px;
  }
  ```

  3. clip-path 方向适配——当前 `--clip-primary` 等斜角裁剪假设 LTR 方向，RTL 下需镜像：

  ```css
  [dir='rtl'] {
    --clip-primary: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  }
  ```

- **预期解决的问题**: RTL 语言用户界面布局错误，文字和交互元素方向不正确。
- **关联模块**: `src/styles/`, 所有组件

---

## 3. 性能提升（20项）

性能是用户体验的基石。一个响应迟缓的启动器，无论功能多么丰富，都会让用户产生不可靠的印象。本章从异步与并发优化、缓存优化、网络优化、前端渲染优化、存储与 IO 优化五个维度，梳理了 20 项性能改进条目。

其中，P1 级别 3 项（下载队列阻塞 IO 替换、下载断点续传、大列表虚拟滚动），P2 级别 13 项，P3 级别 4 项。性能优化的特点是单项改进的收益往往可以量化——例如将 `std::fs` 替换为 `tokio::fs` 可以直接消除 UI 冻结，启用 HTTP 压缩可以减少 60-80% 的 API 传输量，虚拟滚动可以将 DOM 节点数从数千降至数十。建议每项优化完成后进行基准测试，记录改进前后的关键指标变化。

值得注意的是，性能优化需要避免过早优化的陷阱。本章列出的条目均基于实际代码审查中发现的具体问题，而非理论推测。每一条目都附带了问题所在的文件路径和行号，确保优化方向的正确性。同时，性能优化应遵循"测量-优化-验证"的闭环流程：先通过 Profiler 或基准测试确认瓶颈所在，再实施针对性优化，最后通过对比测试验证改进效果。

### 3.1 异步与并发优化（5项）

异步与并发是 Rust + Tokio 技术栈的核心优势，但当前代码中存在多处同步阻塞调用和串行执行逻辑，未能充分发挥异步运行时的并发能力。本子类重点关注将阻塞 IO 替换为异步操作、将串行流程并行化，以消除 UI 冻结和缩短等待时间。

### PERF-01 下载队列阻塞FS调用替换为异步

- **优先级**: P1（高）
- **类别**: 异步优化 > 阻塞调用消除
- **改进内容**: `download/queue.rs:173` 中 `std::fs::create_dir_all(parent)?` 在 tokio 异步运行时中直接阻塞工作线程。同样的问题存在于 `queue.rs:159`（`std::fs::remove_file`）、`queue.rs:347`（`std::fs::read_to_string`）和 `verifier.rs:7,52`。在 tokio 运行时中调用阻塞 IO 会占用工作线程，当并发下载数较高时（默认 8 个并发），可能导致线程池耗尽，UI 事件无法及时处理。
- **技术实现建议**:
  1. 将 `std::fs` 调用替换为 `tokio::fs` 异步版本：

  ```rust
  // queue.rs:173 Before:
  std::fs::create_dir_all(parent)?;
  // After:
  tokio::fs::create_dir_all(parent).await?;

  // queue.rs:159 Before:
  let _ = std::fs::remove_file(&task.target_path);
  // After:
  let _ = tokio::fs::remove_file(&task.target_path).await;

  // queue.rs:347 Before:
  let content = std::fs::read_to_string(&index_path)?;
  // After:
  let content = tokio::fs::read_to_string(&index_path).await?;
  ```

  2. 对于 `verifier.rs` 中的阻塞调用，由于 SHA1 校验是 CPU 密集型操作，应使用 `spawn_blocking`：

  ```rust
  // verifier.rs
  let hash = tokio::task::spawn_blocking(move || {
      compute_sha1(&path)
  }).await.map_err(|e| LauncherError::DownloadFailed(e.to_string()))?;
  ```

  3. 全局审查所有 `std::fs::` 调用（`config.rs:166,183,198`、`process.rs`、`migration.rs` 等），统一替换为异步版本或 `spawn_blocking` 包装。

- **预期解决的问题**: 下载过程中 UI 可能冻结，高并发下载时线程池耗尽导致整个应用无响应。
- **关联模块**: [queue.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/download/queue.rs#L173), [verifier.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/download/verifier.rs), [config.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/config.rs#L166)

---

### PERF-02 配置文件读写异步化

- **优先级**: P2（中）
- **类别**: 异步优化 > IO 非阻塞
- **改进内容**: `config.rs` 中 `load_config`（第 166 行）和 `save_config`（第 198 行）均使用同步 `std::fs::read_to_string` 和 `std::fs::write`。每次配置变更（如内存滑块拖动）都会触发同步磁盘写入，阻塞 tokio 线程。结合 UX-02 的防抖优化，还需将底层 IO 操作异步化。
- **技术实现建议**:
  1. 将 `load_config` 和 `save_config` 改为异步函数：

  ```rust
  pub async fn load_config() -> Result<AppConfig, LauncherError> {
      let path = paths::get_config_path();
      if !path.exists() {
          let config = AppConfig::default();
          save_config(&config).await?;
          return Ok(config);
      }
      let content = tokio::fs::read_to_string(&path).await?;
      let mut config: AppConfig = serde_json::from_str(&content)?;
      // ... 解密逻辑不变
      Ok(config)
  }

  pub async fn save_config(config: &AppConfig) -> Result<(), LauncherError> {
      let path = paths::get_config_path();
      if let Some(parent) = path.parent() {
          tokio::fs::create_dir_all(parent).await?;
      }
      // ... 加密逻辑不变
      let content = serde_json::to_string_pretty(&config_for_save)?;
      tokio::fs::write(&path, content).await?;
      Ok(())
  }
  ```

  2. 添加内存缓存，减少磁盘读取频率：

  ```rust
  static CONFIG_CACHE: OnceLock<Mutex<Option<AppConfig>>> = OnceLock::new();
  pub async fn load_config_cached() -> Result<AppConfig, LauncherError> {
      let cache = CONFIG_CACHE.get_or_init(|| Mutex::new(None));
      let guard = cache.lock().await;
      if let Some(ref config) = *guard {
          return Ok(config.clone());
      }
      drop(guard);
      let config = load_config().await?;
      *cache.lock().await = Some(config.clone());
      Ok(config)
  }
  ```

  3. 所有调用 `load_config` / `save_config` 的 Tauri 命令需相应改为 `.await` 调用。

- **预期解决的问题**: 设置页操作卡顿，频繁同步磁盘 IO 阻塞 tokio 线程。
- **关联模块**: [config.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/config.rs)

---

### PERF-03 实例列表增量更新

- **优先级**: P2（中）
- **类别**: 异步优化 > 数据持久化
- **改进内容**: 当前实例数据存储在 `instances.json` 单一文件中（见 `manager.rs:56`），每次实例 CRUD 操作都全量读写该文件。当实例数量增多时（如 50+ 实例），每次操作的 IO 开销显著增加，且全量写入存在数据丢失风险（写入中断时整个文件损坏）。
- **技术实现建议**:
  1. 短期方案——实现增量更新，仅写入变更的实例：

  ```rust
  pub async fn update_instance(instance: &InstanceInfo) -> Result<(), LauncherError> {
      let mut instances = load_instances().await?;
      let idx = instances.iter().position(|i| i.id == instance.id)
          .ok_or(LauncherError::InstanceNotFound(instance.id.clone()))?;
      instances[idx] = instance.clone();
      save_instances(&instances).await?; // 仍需全量写入，但可优化为仅更新内存缓存
      Ok(())
  }
  ```

  2. 中期方案——引入 `sled` 或 `redb` 嵌入式键值数据库，每个实例独立存储：

  ```rust
  use redb::{Database, TableDefinition};

  const TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("instances");

  pub async fn save_instance(db: &Database, instance: &InstanceInfo) -> Result<(), LauncherError> {
      let write_txn = db.begin_write()?;
      {
          let mut table = write_txn.open_table(TABLE)?;
          let json = serde_json::to_vec(instance)?;
          table.insert(instance.id.as_str(), json.as_slice())?;
      }
      write_txn.commit()?;
      Ok(())
  }
  ```

  3. 内存中维护 `HashMap<String, InstanceInfo>` 映射，避免每次操作都读取磁盘。

- **预期解决的问题**: 实例数量多时 CRUD 操作变慢；全量写入存在数据丢失风险。
- **关联模块**: [manager.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/instance/manager.rs#L56)

---

### PERF-04 启动流程并行化

- **优先级**: P2（中）
- **类别**: 异步优化 > 流程并行
- **改进内容**: 当前游戏启动流程中的版本检查、库文件验证、资源完整性检查等步骤串行执行。这些步骤之间大多无依赖关系，可以并行执行以缩短启动前等待时间。
- **技术实现建议**:
  1. 使用 `tokio::join!` 并行执行独立检查步骤：

  ```rust
  async fn pre_launch_checks(&self, version_id: &str) -> Result<LaunchContext, LauncherError> {
      let (version, libs, assets) = tokio::join!(
          self.resolve_version(version_id),       // 版本解析
          self.verify_libraries(version_id),       // 库文件验证
          self.check_assets(version_id),           // 资源完整性检查
      );
      let version = version?;
      let libs = libs?;
      let assets = assets?;
      Ok(LaunchContext { version, libs, assets })
  }
  ```

  2. 进度事件合并——并行检查时，将多个进度源合并为统一的进度百分比：

  ```rust
  let total_steps = 3;
  let completed = AtomicU32::new(0);
  // 每个检查完成后递增计数并发射进度事件
  let progress = completed.fetch_add(1, Ordering::Relaxed) + 1;
  let _ = app.emit("launch-progress", json!({
      "step": progress, "total": total_steps,
      "message": "正在验证游戏文件..."
  }));
  ```

  3. 确保并行检查中的错误不会互相影响——任一检查失败时取消其他检查并报告错误。

- **预期解决的问题**: 启动前检查耗时长，用户等待时间不必要地延长。
- **关联模块**: [process.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/launch/process.rs)

---

### PERF-05 Modrinth/CurseForge搜索并行请求

- **优先级**: P2（中）
- **类别**: 异步优化 > API 并行
- **改进内容**: 当用户在 Marketplace 搜索内容时，Modrinth 和 CurseForge 两个数据源的请求是串行执行的。两个 API 之间无依赖关系，完全可以并行请求，将响应时间从 `T1 + T2` 缩短为 `max(T1, T2)`。
- **技术实现建议**:
  1. 使用 `tokio::join!` 并行请求两个 API：

  ```rust
  #[tauri::command]
  pub async fn search_content(query: &str, limit: usize) -> Result<Vec<ModResult>, LauncherError> {
      let (modrinth_result, cf_result) = tokio::join!(
          search_modrinth(query, limit),
          search_curseforge(query, limit),
      );
      let mut results = Vec::new();
      if let Ok(mods) = modrinth_result { results.extend(mods); }
      if let Ok(mods) = cf_result { results.extend(mods); }
      // 按 relevance 排序并去重
      results.sort_by(|a, b| b.downloads.cmp(&a.downloads));
      results.truncate(limit);
      Ok(results)
  }
  ```

  2. 结果去重——基于模组名称和 slug 的模糊匹配，避免同一模组在两个源的结果中重复出现。

  3. 任一源失败不影响另一源——使用 `if let Ok` 处理部分失败，确保用户至少能看到一个源的结果。

- **预期解决的问题**: 内容搜索响应慢，双源串行请求导致等待时间加倍。
- **关联模块**: `src-tauri/src/commands/` 目录, [modrinth.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/modrinth.rs), [curseforge.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/curseforge.rs)

---

### 3.2 缓存优化（4项）

缓存是性能优化的经典手段，但缓存策略不当反而会导致数据不一致和用户体验恶化。当前项目存在前后端缓存 TTL 不匹配、缺少预加载机制、图片无本地缓存、HTTP 客户端不可重置等问题。本子类重点关注缓存一致性、预加载策略和连接管理优化。

### PERF-06 前后端缓存策略统一

- **优先级**: P2（中）
- **类别**: 缓存优化 > 缓存一致性
- **改进内容**: 前端 `cachedInvoke` 的默认 TTL 为 60 秒（见 `cache.ts:2`），后端 `ApiCache` 的 TTL 为 300-1800 秒（搜索 300s、项目 1800s、热门 900s，见 `cache.rs:5-7`）。两层缓存 TTL 不匹配导致数据不一致：前端缓存过期后重新请求，可能命中后端缓存中的旧数据；而后端缓存过期时前端缓存可能仍然有效，显示过期数据。
- **技术实现建议**:
  1. 方案 A——统一为单一缓存层（推荐）：移除前端 `cachedInvoke` 的 TTL 缓存，仅保留请求去重（`ipcInflight`），由后端统一控制缓存策略：

  ```typescript
  // cache.ts 修改
  export function cachedInvoke<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 仅做请求去重，不做 TTL 缓存
    const existing = ipcInflight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fn().finally(() => ipcInflight.delete(key));
    ipcInflight.set(key, promise);
    return promise;
  }
  ```

  2. 方案 B——后端在响应中返回缓存元信息，前端据此动态调整：

  ```rust
  #[derive(Serialize)]
  struct CachedResponse<T> {
      data: T,
      cache_ttl: u64,  // 秒
      cached_at: u64,   // Unix timestamp
  }
  ```

  3. 添加缓存失效机制——当用户执行写操作（安装/卸载模组）时，自动 `invalidateCache` 相关 key。

- **预期解决的问题**: 两层缓存 TTL 不匹配导致显示过期数据，用户看到的信息与实际状态不一致。
- **关联模块**: [cache.ts](file:///Users/xiatian/Desktop/BonNext/src/api/cache.ts), [cache.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/cache.rs)

---

### PERF-07 版本清单预加载

- **优先级**: P2（中）
- **类别**: 缓存优化 > 预加载
- **改进内容**: 版本清单（Mojang 版本清单 + Fabric/Forge 加载器版本）仅在用户访问版本页时按需加载，首次访问延迟较大（需请求外部 API + 解析 JSON）。应在应用启动后后台预加载，确保用户访问时数据已就绪。
- **技术实现建议**:
  1. 在 `lib.rs` 的 `setup` 钩子中启动后台预加载任务：

  ```rust
  // lib.rs setup 闭包中添加
  let app_clone = app.clone();
  tokio::spawn(async move {
      // 延迟 2 秒后预加载，避免影响启动速度
      tokio::time::sleep(Duration::from_secs(2)).await;
      let _ = version::manifest::fetch_version_manifest(&app_clone).await;
      tracing::info!("Version manifest preloaded");
  });
  ```

  2. 预加载结果写入后端 `ApiCache`，前端 `cachedInvoke` 请求时直接命中缓存。

  3. 预加载使用低优先级异步任务，不阻塞主线程和其他关键操作。

- **预期解决的问题**: 版本页首次加载慢，用户需等待数秒才能看到版本列表。
- **关联模块**: `src-tauri/src/version/resolver.rs`, `src-tauri/src/version/manifest.rs`

---

### PERF-08 实例封面图缓存

- **优先级**: P3（低）
- **类别**: 缓存优化 > 图片缓存
- **改进内容**: 实例列表页每次渲染都重新从网络加载封面图（如 Modrinth 的项目图标），无本地缓存机制。当用户频繁切换页面时，相同图片反复请求网络，浪费带宽并导致图片闪烁。
- **技术实现建议**:
  1. 后端添加图片缓存命令，下载图片到本地缓存目录：

  ```rust
  #[tauri::command]
  pub async fn get_cached_image(url: &str) -> Result<String, LauncherError> {
      let cache_dir = paths::get_game_dir().join(".cache").join("images");
      let hash = format!("{:x}", md5::compute(url.as_bytes()));
      let cached_path = cache_dir.join(&hash);
      if cached_path.exists() {
          return Ok(cached_path.to_string_lossy().to_string());
      }
      tokio::fs::create_dir_all(&cache_dir).await?;
      let client = build_client();
      let bytes = client.get(url).send().await?.bytes().await?;
      tokio::fs::write(&cached_path, &bytes).await?;
      Ok(cached_path.to_string_lossy().to_string())
  }
  ```

  2. 使用 ETag/Last-Modified 条件请求，避免重复下载未变更的图片。

  3. 前端内存中维护缩略图 LRU 缓存（最近 50 张），避免重复的 IPC 调用。

- **预期解决的问题**: 实例列表图片加载慢、重复网络请求浪费带宽、页面切换时图片闪烁。
- **关联模块**: [InstancesPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/InstancesPage.tsx)

---

### PERF-09 HTTP客户端连接池优化

- **优先级**: P2（中）
- **类别**: 缓存优化 > 连接管理
- **改进内容**: `http_client.rs` 中使用 `OnceLock<reqwest::Client>` 创建全局 HTTP 客户端（见 `http_client.rs:4,21`）。`OnceLock` 一旦初始化就不可重置，意味着代理配置变更后无法重建客户端——用户修改代理设置后需重启应用才能生效。此外，连接池参数（如 `pool_max_idle_per_host`、`pool_idle_timeout`）使用默认值，未针对启动器场景优化。
- **技术实现建议**:
  1. 使用 `Arc<Swap<Client>>` 替代 `OnceLock`，支持配置变更时重建客户端：

  ```rust
  use std::sync::Arc;
  use tokio::sync::RwLock;

  static API_CLIENT: OnceLock<Arc<RwLock<reqwest::Client>>> = OnceLock::new();

  pub async fn get_client() -> Arc<RwLock<reqwest::Client>> {
      API_CLIENT.get_or_init(|| {
          Arc::new(RwLock::new(build_client_with_proxy()
              .unwrap_or_else(|_| build_default_client())))
      }).clone()
  }

  pub async fn rebuild_client() -> Result<(), LauncherError> {
      let client = get_client().await;
      let new_client = build_client_with_proxy()?;
      *client.write().await = new_client;
      Ok(())
  }
  ```

  2. 优化连接池参数：

  ```rust
  reqwest::Client::builder()
      .pool_max_idle_per_host(4)     // 每个主机最多 4 个空闲连接
      .pool_idle_timeout(Duration::from_secs(90))  // 空闲超时 90 秒
      .tcp_keepalive(Duration::from_secs(30))      // TCP 保活 30 秒
  ```

  3. 在代理配置保存后调用 `rebuild_client()` 重建客户端。

- **预期解决的问题**: 代理设置变更后需重启应用才能生效；连接池参数未优化导致连接管理效率低。
- **关联模块**: [http_client.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/http_client.rs)

---

### 3.3 网络优化（4项）

网络是启动器最依赖的基础设施——版本清单、库文件下载、内容平台 API 调用均依赖网络通信。当前下载系统缺少断点续传和带宽限制，HTTP 客户端未启用压缩，API 请求缺少批量合并，这些缺陷在网络条件不佳时尤为突出。本子类重点关注下载可靠性、带宽管理和传输效率优化。

### PERF-10 下载断点续传

- **优先级**: P1（高）
- **类别**: 网络优化 > 下载可靠性
- **改进内容**: 当前大文件下载（如 Minecraft 版本 JSON、库文件 JAR）中断后需从头开始，浪费带宽和时间。`download/queue.rs` 的 `do_download` 方法（第 166 行起）使用简单的 `GET` 请求流式写入，未记录已下载字节数，不支持 HTTP Range 请求。网络不稳定时大文件下载反复失败，严重影响用户体验。
- **技术实现建议**:
  1. 记录已下载字节数到临时文件，恢复时发送 Range 请求：

  ```rust
  async fn do_download_resumable(
      &self,
      url: &str,
      target_path: &Path,
      expected_size: u64,
  ) -> Result<u64, LauncherError> {
      let tmp_path = target_path.with_extension("part");
      let mut downloaded: u64 = 0;

      // 检查临时文件是否存在，获取已下载字节数
      if tmp_path.exists() {
          if let Ok(metadata) = tokio::fs::metadata(&tmp_path).await {
              downloaded = metadata.len();
          }
      }

      // 构建 Range 请求
      let mut request = self.client.get(url);
      if downloaded > 0 {
          request = request.header("Range", format!("bytes={}-", downloaded));
      }

      let mut response = request.send().await?;

      // 处理 206 Partial Content 或 200 OK
      if response.status() == reqwest::StatusCode::PARTIAL_CONTENT {
          let mut file = tokio::fs::OpenOptions::new()
              .append(true).open(&tmp_path).await?;
          // 继续写入...
      } else {
          // 服务器不支持 Range，从头下载
          downloaded = 0;
          let mut file = tokio::fs::File::create(&tmp_path).await?;
          // 完整写入...
      }

      // 下载完成后重命名为目标文件
      tokio::fs::rename(&tmp_path, target_path).await?;
      Ok(downloaded)
  }
  ```

  2. 下载前验证已下载部分的完整性（可选，通过 Content-Length 头判断）。

  3. 下载任务状态持久化，应用重启后可恢复未完成的下载。

- **预期解决的问题**: 网络不稳定时大文件下载反复失败，浪费带宽和时间；长时间下载中断后需从头开始。
- **关联模块**: [queue.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/download/queue.rs#L166)

---

### PERF-11 下载带宽限制

- **优先级**: P2（中）
- **类别**: 网络优化 > 带宽管理
- **改进内容**: 当前下载任务占用全部可用带宽，影响用户的其他网络活动（如浏览网页、语音通话）。需要实现下载带宽限制功能，让用户可以控制下载速度。
- **技术实现建议**:
  1. 实现令牌桶限速器：

  ```rust
  use tokio::sync::Mutex;
  use std::time::Instant;

  struct TokenBucket {
      rate: u64,           // bytes per second
      tokens: u64,         // 当前可用令牌数
      last_refill: Instant,
      max_burst: u64,      // 最大突发量
  }

  impl TokenBucket {
      async fn acquire(&mut self, count: u64) {
          loop {
              self.refill();
              if self.tokens >= count {
                  self.tokens -= count;
                  return;
              }
              let wait_ms = ((count - self.tokens) as f64 / self.rate as f64 * 1000.0) as u64;
              tokio::time::sleep(Duration::from_millis(wait_ms.min(100))).await;
          }
      }

      fn refill(&mut self) {
          let now = Instant::now();
          let elapsed = now.duration_since(self.last_refill).as_secs_f64();
          self.tokens = (self.tokens + (elapsed * self.rate as f64) as u64).min(self.max_burst);
          self.last_refill = now;
      }
  }
  ```

  2. 在 `config.rs` 中添加 `max_download_speed` 设置项（0 表示不限速）：

  ```rust
  pub struct DownloadConfig {
      pub max_concurrent: usize,
      pub max_download_speed: u64,  // bytes/sec, 0 = unlimited
  }
  ```

  3. 前端设置页添加带宽限制滑块（0/1/5/10/50 MB/s 档位）。

- **预期解决的问题**: 下载时其他网络活动卡顿，用户无法同时进行其他需要网络的操作。
- **关联模块**: [queue.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/download/queue.rs), [config.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/config.rs)

---

### PERF-12 HTTP响应压缩

- **优先级**: P2（中）
- **类别**: 网络优化 > 传输效率
- **改进内容**: `http_client.rs` 中构建 reqwest 客户端时未启用 `gzip`/`brotli` 解压功能。Modrinth API 和 Mojang 版本清单的 JSON 响应通常支持 gzip 压缩，启用后可减少 60-80% 的传输量。
- **技术实现建议**:
  1. 在 `build_client` 和 `build_download_client` 中启用压缩：

  ```rust
  // http_client.rs
  pub fn build_client() -> &'static reqwest::Client {
      API_CLIENT.get_or_init(|| {
          build_client_with_proxy()
              .unwrap_or_else(|_| {
                  reqwest::Client::builder()
                      .user_agent(format!("BonNext/{} (MinecraftLauncher)", env!("CARGO_PKG_VERSION")))
                      .timeout(Duration::from_secs(60))
                      .connect_timeout(Duration::from_secs(15))
                      .gzip(true)       // 启用 gzip 解压
                      .brotli(true)     // 启用 brotli 解压
                      .deflate(true)    // 启用 deflate 解压
                      .build()
                      .expect("Failed to build HTTP client")
              })
      })
  }
  ```

  2. 验证主要 API 服务器支持压缩——Modrinth API 返回 `Content-Encoding: gzip`，Mojang 版本清单同样支持。

  3. 注意：下载的 JAR 文件已经是压缩格式，启用压缩对二进制文件下载无显著效果，但 JSON API 响应的压缩收益明显。

- **预期解决的问题**: API 响应传输量大，增加网络延迟和带宽消耗。
- **关联模块**: [http_client.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/http_client.rs)

---

### PERF-13 请求合并与批量接口

- **优先级**: P3（低）
- **类别**: 网络优化 > 请求优化
- **改进内容**: 多个模组详情页同时加载时（如 LibraryPage 的更新检查），每个模组单独请求 Modrinth/CurseForge API。当安装了 20+ 模组时，可能同时发起 20+ 个 API 请求，触发速率限制并增加延迟。
- **技术实现建议**:
  1. 后端添加批量查询命令：

  ```rust
  #[tauri::command]
  pub async fn batch_get_projects(ids: Vec<String>) -> Result<Vec<ModProjectFull>, LauncherError> {
      // Modrinth API 支持批量查询: GET /v2/projects?ids=["id1","id2"]
      let client = build_client();
      let ids_json = serde_json::to_string(&ids)?;
      let resp: Vec<ModProjectFull> = client
          .get(&format!("https://api.modrinth.com/v2/projects?ids={}", ids_json))
          .send().await?
          .json().await?;
      Ok(resp)
  }
  ```

  2. 前端实现请求合并——在短时间窗口内（50ms）收集同一类型的请求，合并为批量请求：

  ```typescript
  // src/api/batch.ts
  const pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }
  >();
  let batchTimer: ReturnType<typeof setTimeout> | null = null;

  export function batchGetProject(id: string): Promise<ModProjectFull> {
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      if (!batchTimer) {
        batchTimer = setTimeout(flushBatch, 50);
      }
    });
  }

  async function flushBatch() {
    const ids = [...pendingRequests.keys()];
    const pending = new Map(pendingRequests);
    pendingRequests.clear();
    batchTimer = null;
    try {
      const results = await invoke<ModProjectFull[]>('batch_get_projects', { ids });
      results.forEach((project) => {
        pending.get(project.id)?.resolve(project);
      });
    } catch (err) {
      pending.forEach(({ reject }) => reject(err));
    }
  }
  ```

- **预期解决的问题**: 列表页网络请求过多，触发 API 速率限制，增加页面加载延迟。
- **关联模块**: [modrinth.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/modrinth.rs)

---

### 3.4 前端渲染优化（4项）

前端渲染性能直接影响用户感知的响应速度。当列表项过多、组件重渲染频繁、图片加载未优化时，页面会出现明显的卡顿和延迟。React 的声明式编程模型虽然简化了开发，但也容易引入不必要的重渲染。本子类重点关注虚拟滚动、组件记忆化、图片懒加载和代码分割四个方面的优化。

### PERF-14 大列表虚拟滚动

- **优先级**: P1（高）
- **类别**: 渲染优化 > 列表性能
- **改进内容**: InstancesPage、LibraryPage 等页面渲染大量列表项时未使用虚拟滚动，所有列表项同时渲染到 DOM 中。当实例或模组数量达到 50+ 时，DOM 节点数量激增，导致滚动卡顿和内存占用增加。ContentCard 组件的图片加载进一步加剧了性能问题。
- **技术实现建议**:
  1. 引入 `@tanstack/react-virtual` 实现虚拟滚动：

  ```bash
  pnpm add @tanstack/react-virtual
  ```

  2. 在 InstancesPage 中适配虚拟化列表：

  ```tsx
  import { useVirtualizer } from '@tanstack/react-virtual';

  function InstanceList({ instances }: { instances: InstanceInfo[] }) {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
      count: instances.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 80, // 每个列表项高度
      overscan: 5, // 预渲染 5 个
    });

    return (
      <div ref={parentRef} className={styles.list} style={{ overflow: 'auto', height: '100%' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              style={{
                position: 'absolute',
                top: item.start,
                left: 0,
                width: '100%',
                height: item.size,
              }}
            >
              <ContentCard instance={instances[item.index]} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

  3. 确保 clip-path 样式在虚拟化列表中正常工作——虚拟化不改变单个项的渲染逻辑，只需确保项的高度测量准确。

- **预期解决的问题**: 大量实例/模组时页面卡顿、滚动不流畅、内存占用高。
- **关联模块**: [InstancesPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/InstancesPage.tsx), [LibraryPage.tsx](file:///Users/xiatian/Desktop/BonNext/src/pages/LibraryPage.tsx)

---

### PERF-15 组件React.memo优化

- **优先级**: P2（中）
- **类别**: 渲染优化 > 重渲染控制
- **改进内容**: 多个列表项组件（ContentCard、InstanceCard 等）未使用 `React.memo`，父组件状态变更时导致全量重渲染。例如在 InstancesPage 中，选中一个实例时所有实例卡片都会重新渲染，即使只有选中状态发生了变化。
- **技术实现建议**:
  1. 对纯展示组件添加 `React.memo`：

  ```tsx
  // ContentCard.tsx
  export const ContentCard = React.memo(function ContentCard({ title, description, ... }: ContentCardProps) {
    // ...
  });
  ```

  2. 使用 `useCallback` 稳定回调引用，避免因回调变化导致 memo 失效：

  ```tsx
  // InstancesPage.tsx
  const handleInstanceClick = useCallback(
    (id: string) => {
      navigate(`/instances/${id}`);
    },
    [navigate],
  );
  ```

  3. 使用 React DevTools Profiler 识别不必要的重渲染，针对性优化。

- **预期解决的问题**: 列表操作时整体卡顿，不必要的重渲染浪费 CPU 资源。
- **关联模块**: `src/components/ui/` 目录

---

### PERF-16 图片懒加载与占位符

- **优先级**: P2（中）
- **类别**: 渲染优化 > 图片加载
- **改进内容**: ContentCard 组件已使用 `loading="lazy"` 属性（见 `ContentCard.tsx:59`），但缺少低分辨率占位符和加载状态指示。大量图片同时请求时仍会导致网络拥塞和视觉闪烁。
- **技术实现建议**:
  1. 添加低分辨率占位符（blurhash 或纯色）：

  ```tsx
  <div className={styles.imageWrapper}>
    {isLoading && <div className={styles.placeholder} style={{ background: `var(--accent-15)` }} />}
    <img
      src={iconUrl}
      alt={title}
      loading="lazy"
      onLoad={() => setIsLoaded(true)}
      className={classNames(styles.image, { [styles.loaded]: isLoaded })}
    />
  </div>
  ```

  2. 使用 IntersectionObserver 控制图片加载优先级——视口外的图片延迟加载：

  ```typescript
  const [ref, inView] = useInView({ triggerOnce: true, rootMargin: '200px' });
  <img src={inView ? iconUrl : undefined} ... />
  ```

  3. 为 Modrinth/CurseForge 的项目图标实现本地缩略图缓存（与 PERF-08 联动）。

- **预期解决的问题**: 图片密集页面加载慢、视觉闪烁、大量并发图片请求占用带宽。
- **关联模块**: [ContentCard.tsx](file:///Users/xiatian/Desktop/BonNext/src/components/ui/ContentCard.tsx)

---

### PERF-17 前端代码分割优化

- **优先级**: P3（低）
- **类别**: 渲染优化 > 包体积
- **改进内容**: 项目已使用 `React.lazy` 进行路由级代码分割，但可能存在可优化的分割点。大型依赖（如 i18n 资源文件、MD3 插件的 @material/web 组件）可能被包含在主 bundle 中，增加首屏加载时间。
- **技术实现建议**:
  1. 分析构建产物，识别大型 chunk：

  ```bash
  pnpm add -D vite-bundle-visualizer
  pnpm exec vite-bundle-visualizer
  ```

  2. 将 i18n 资源按语言拆分，按需加载：

  ```typescript
  // 当前可能是全量导入
  // 优化为按语言动态导入
  async function loadLocale(locale: string) {
    const messages = await import(`./locales/${locale}.json`);
    i18n.setResourceBundle(locale, messages);
  }
  ```

  3. MD3 插件的 @material/web 组件仅在 MD3 主题激活时加载：

  ```typescript
  const MD3AppShell = React.lazy(() => import('./plugins/builtins/md3-theme/layout/MD3AppShell'));
  ```

  4. 预加载关键路由——在用户 hover 侧边栏导航项时预加载对应页面：

  ```typescript
  <NavLink onMouseEnter={() => import('./pages/InstancesPage')} />
  ```

- **预期解决的问题**: 首屏加载慢，不必要的资源被提前加载。
- **关联模块**: [vite.config.ts](file:///Users/xiatian/Desktop/BonNext/vite.config.ts), [App.tsx](file:///Users/xiatian/Desktop/BonNext/src/App.tsx)

---

### 3.5 存储与IO优化（3项）

存储和 IO 操作是数据持久化的基础，其可靠性直接决定用户数据的安全性。当前配置文件写入缺少原子性保证，库文件硬链接缺少回退机制，游戏输出缺少流控——这些问题在正常使用中可能不明显，但在异常场景（崩溃、断电、跨文件系统）下会导致数据丢失或损坏。本子类重点关注原子写入、硬链接回退和日志流控三个方面的优化。

### PERF-18 配置文件原子写入

- **优先级**: P2（中）
- **类别**: IO优化 > 数据安全
- **改进内容**: `save_config`（`config.rs:198`）直接使用 `std::fs::write` 覆盖写入配置文件。如果写入过程中应用崩溃或断电，可能导致配置文件损坏（写入半截数据）或丢失（旧数据已被覆盖但新数据未写入完成）。这对用户配置来说是不可接受的风险。
- **技术实现建议**:
  1. 实现原子写入——先写入临时文件，然后 rename 替换：

  ```rust
  pub async fn save_config_atomic(config: &AppConfig) -> Result<(), LauncherError> {
      let path = paths::get_config_path();
      if let Some(parent) = path.parent() {
          tokio::fs::create_dir_all(parent).await?;
      }

      let mut config_for_save = config.clone();
      // ... 加密逻辑不变

      let content = serde_json::to_string_pretty(&config_for_save)?;

      // 写入临时文件
      let tmp_path = path.with_extension("json.tmp");
      tokio::fs::write(&tmp_path, &content).await?;

      // 备份旧配置
      if path.exists() {
          let backup_path = path.with_extension("json.bak");
          let _ = tokio::fs::rename(&path, &backup_path).await;
      }

      // 原子 rename（同一文件系统上是原子操作）
      tokio::fs::rename(&tmp_path, &path).await?;

      Ok(())
  }
  ```

  2. `load_config` 中添加损坏检测和自动恢复：

  ```rust
  let content = match tokio::fs::read_to_string(&path).await {
      Ok(c) => c,
      Err(_) => {
          // 尝试从备份恢复
          let backup = path.with_extension("json.bak");
          if backup.exists() {
              tracing::warn!("Config corrupted, restoring from backup");
              tokio::fs::read_to_string(&backup).await?
          } else {
              return Ok(AppConfig::default());
          }
      }
  };
  ```

- **预期解决的问题**: 崩溃或断电导致配置文件损坏，用户设置丢失。
- **关联模块**: [config.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/config.rs)

---

### PERF-19 库文件硬链接共享优化

- **优先级**: P2（中）
- **类别**: IO优化 > 存储共享
- **改进内容**: 跨实例共享库文件使用硬链接，但未验证硬链接是否成功。当实例目录和共享库目录位于不同文件系统（如不同分区或磁盘）时，硬链接会失败（`EXDEV` 错误），但当前代码可能未处理此回退情况，导致库文件重复占用空间。
- **技术实现建议**:
  1. 硬链接失败时回退到符号链接或文件复制：

  ```rust
  fn link_or_copy(src: &Path, dst: &Path) -> Result<(), LauncherError> {
      // 尝试硬链接（最节省空间）
      if std::fs::hard_link(src, dst).is_ok() {
          return Ok(());
      }
      // 硬链接失败（可能跨文件系统），尝试符号链接
      if std::fs::symlink(src, dst).is_ok() {
          tracing::info!("Used symlink instead of hardlink for {:?}", dst);
          return Ok(());
      }
      // 符号链接也失败（可能权限问题），回退到复制
      tracing::warn!("Falling back to file copy for {:?}", dst);
      std::fs::copy(src, dst)?;
      Ok(())
  }
  ```

  2. 添加硬链接状态检查——定期验证共享库文件的硬链接计数：

  ```rust
  fn verify_hardlink(path: &Path) -> bool {
      std::fs::metadata(path)
          .map(|m| m.nlink() > 1)
          .unwrap_or(false)
  }
  ```

  3. 在实例创建时记录共享方式（hardlink/symlink/copy），便于后续维护和空间统计。

- **预期解决的问题**: 跨分区实例库文件重复占用空间，硬链接失败未处理导致实例不完整。
- **关联模块**: [manager.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/instance/manager.rs)

---

### PERF-20 游戏输出流式处理

- **优先级**: P2（中）
- **类别**: IO优化 > 流式处理
- **改进内容**: `launch/process.rs` 中游戏进程的 stdout/stderr 使用 `std::io::BufReader` 逐行读取（见 `process.rs:235,262`），并通过 `tracing::info!` 记录日志。长时间运行时，Minecraft 可能产生大量输出（尤其是调试模式或模组包），导致日志文件无限增长和内存压力。
- **技术实现建议**:
  1. 添加日志文件轮转（大小限制）：

  ```rust
  use tracing_appender::rolling::RollingFileAppender;

  // 在 setup 中配置日志轮转
  let file_appender = RollingFileAppender::new(
      tracing_appender::rolling::Rotation::DAILY,
      log_dir,
      "minecraft.log",
  )
  .max_log_files(7)         // 保留最近 7 天
  .max_file_size(50 * 1024 * 1024);  // 单文件最大 50MB
  ```

  2. 限制内存中的日志缓冲区大小：

  ```rust
  // 使用固定大小的环形缓冲区
  const LOG_BUFFER_SIZE: usize = 1000;
  let log_buffer: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::with_capacity(LOG_BUFFER_SIZE)));

  // 在日志写入时
  let mut buffer = log_buffer.lock().await;
  if buffer.len() >= LOG_BUFFER_SIZE {
      buffer.pop_front();
  }
  buffer.push_back(line.clone());
  ```

  3. 前端游戏日志面板使用虚拟滚动（与 PERF-14 联动），避免大量日志 DOM 节点。

- **预期解决的问题**: 长时间运行时日志文件无限增长占用磁盘空间；内存中日志缓冲区持续增长导致内存泄漏。
- **关联模块**: [process.rs](file:///Users/xiatian/Desktop/BonNext/src-tauri/src/launch/process.rs)

---

_本文档为 BonNext v0.0.5 开发路线图第一部分，涵盖用户体验优化 30 项和性能提升 20 项。第二部分将涵盖架构健壮性 25 项、安全与合规 25 项及可维护性与工程化 20 项。_

# BonNext 项目开发路线图（下篇）

> 本文档为 BonNext 项目开发路线图的后半部分，涵盖功能扩展（45项）、代码质量改进（15项）、安全加固（10项）、实施路线图、结论及附录。前半部分（UX优化30项 + 性能优化20项）见 `roadmap_part1.md`。

---

## 4. 功能扩展（45项）

### 4.1 实例管理增强（6项）

### FE-01 实例快照与回滚

- **优先级**: P1
- **类别**: 实例管理
- **改进内容**: 添加实例快照功能，允许用户保存当前实例的完整状态（模组配置、配置文件、世界存档），并支持一键回滚到任意快照。当前后端已实现 `create_snapshot`/`list_snapshots`/`restore_snapshot`/`delete_snapshot` 四个命令的基础框架，但前端尚未提供对应的UI入口，且快照的存储效率和增量备份能力有待增强。
- **技术实现建议**: 后端方面，在现有 commands/instance.rs 的快照命令基础上，将快照存储格式从全量 `.tar.gz` 改为增量备份（基于 librsync 的差异算法），大幅减少磁盘占用；添加 `snapshot_metadata.json` 记录每个快照的时间戳、描述、大小和标签；实现快照自动清理策略（按数量或时间保留）。前端方面，在 InstanceDetailPage 中添加"快照"Tab页，展示快照时间线视图；支持创建快照时添加备注；回滚前显示差异对比（新增/删除/修改的文件列表）；回滚操作需二次确认。
- **预期解决的问题**: 模组更新或配置修改导致存档损坏后无法恢复到之前的状态；用户在尝试新模组组合时缺乏安全网，不敢大胆实验。
- **关联模块**: src-tauri/src/commands/instance.rs, src-tauri/src/instance/manager.rs, src/pages/InstanceDetailPage.tsx

### FE-02 实例复制与模板

- **优先级**: P2
- **类别**: 实例管理
- **改进内容**: 支持基于现有实例创建新实例，复制模组列表和配置但不复制世界存档；同时支持将实例配置保存为可复用的模板，方便快速创建相似配置的新实例。当前已有 `duplicate_instance` 命令实现了基础复制功能，但缺少模板保存、分享和模板市场功能。
- **技术实现建议**: 扩展 `duplicate_instance` 命令，添加 `clone_mode` 参数区分"完整复制"和"仅配置复制"两种模式；定义 `InstanceTemplate` 结构体（包含 version_id、loader_type、loader_version、mod_list、jvm_args_override 等字段），序列化为 JSON 存储在 `templates/` 目录；添加 `save_as_template`/`list_templates`/`create_from_template`/`export_template`/`import_template` 命令；模板导出为 `.bonnext-template.json` 文件，支持社区分享。前端在 InstancesPage 的实例右键菜单中添加"保存为模板"选项；NewInstancePage 中添加"从模板创建"入口。
- **预期解决的问题**: 创建相似配置的实例需要重复操作（如为不同存档创建相同模组配置的实例）；缺少标准化的实例配置复用机制。
- **关联模块**: src-tauri/src/instance/manager.rs, src-tauri/src/commands/instance.rs, src/pages/NewInstancePage.tsx

### FE-03 实例分组与标签

- **优先级**: P2
- **类别**: 实例管理
- **改进内容**: 为实例添加标签和分组功能，当实例数量增多时能够高效管理和查找。当前 `GameInstance` 结构体缺少 `tags` 字段，实例列表页面也没有分组和过滤能力。
- **技术实现建议**: 后端在 `GameInstance` 结构体中添加 `tags: Vec<String>` 和 `group: Option<String>` 字段；添加 `set_instance_tags`/`set_instance_group`/`list_groups` 命令；实例配置文件中持久化标签和分组信息。前端在 InstancesPage 中实现分组侧边栏（类似文件夹导航）；支持拖拽实例到分组；标签以彩色 Badge 形式展示在实例卡片上；添加按标签/分组的过滤功能；支持批量设置标签。
- **预期解决的问题**: 实例列表混乱，当用户拥有十几个实例时查找和管理困难；无法按用途（如"整合包"、"测试"、"多人"）分类实例。
- **关联模块**: src-tauri/src/instance/manager.rs, src/pages/InstancesPage.tsx

### FE-04 实例导入增强

- **优先级**: P2
- **类别**: 实例管理
- **改进内容**: 扩展实例导入功能，支持更多启动器格式的导入，包括原始 `.minecraft` 目录的 ZIP 压缩包、MultiMC 导出格式、ATLauncher 实例格式等。当前 migration.rs 已支持 HMCL 和部分 MultiMC 格式，但覆盖面不够全面。
- **技术实现建议**: 扩展 `detect_modpack_format` 命令的识别能力，增加对 ATLauncher（`instance.json`）、原始 `.minecraft` ZIP（检测 `versions/` 目录结构）、Prism Launcher（MultiMC 变体）的自动检测；为每种格式实现对应的解析器（trait `InstanceImporter`，方法 `detect`/`import`/`preview`）；添加导入预览功能，在导入前展示包含的模组列表、版本信息和可能的兼容性警告；处理模组路径映射差异（如 ATLauncher 的 `mods/` vs MultiMC 的 `minecraft/mods/`）。
- **预期解决的问题**: 从其他启动器迁移时格式支持不完整，部分用户无法顺利迁移现有实例；导入前无法预览内容，导入后才发现问题。
- **关联模块**: src-tauri/src/instance/migration.rs, src-tauri/src/commands/instance.rs

### FE-05 实例健康检查

- **优先级**: P2
- **类别**: 实例管理
- **改进内容**: 在启动游戏前自动执行实例完整性检查，包括缺失库文件、损坏的文件、版本不兼容、JRE 版本不匹配等，提前发现问题而非启动后才报错。
- **技术实现建议**: 添加 `health_check(instance_id)` 命令，返回 `HealthCheckReport` 结构体；检查项包括：库文件存在性和 SHA1 校验（复用 verifier.rs 的逻辑）、模组版本与 Minecraft 版本兼容性（查询 Modrinth API 验证）、JRE 版本与 Minecraft 版本匹配（1.16.5 以下需 Java 8/11，1.17+ 需 Java 17+，1.20.5+ 需 Java 21+）、磁盘空间是否充足、模组冲突检测（复用现有 `check_mod_conflicts` 命令）。每项检查返回 `Pass`/`Warn`/`Fail` 三级状态，附带修复建议。前端在实例详情页添加"健康检查"按钮，以仪表盘形式展示检查结果。
- **预期解决的问题**: 启动游戏后才发现文件损坏或版本不兼容，浪费用户时间；缺少预防性的问题检测机制。
- **关联模块**: src-tauri/src/launch/process.rs, src-tauri/src/download/verifier.rs, src-tauri/src/commands/misc.rs

### FE-06 世界存档管理

- **优先级**: P2
- **类别**: 实例管理
- **改进内容**: 添加世界存档的备份、恢复、导入导出功能，并支持每次游戏启动前自动备份世界存档。当前已有 `list_instance_saves` 命令列出存档，但缺少备份和恢复能力。
- **技术实现建议**: 在 commands/world.rs 中扩展命令集：`backup_save`（将指定存档压缩为 `.tar.gz` 存入 `backups/saves/` 目录）、`restore_save`（从备份恢复，覆盖前先创建当前存档的自动备份）、`export_save`（导出为可分享的 ZIP）、`import_save`（从 ZIP 导入存档）、`list_save_backups`（列出存档的备份历史）；在游戏启动流程中添加自动备份钩子（在 `launch_game` 命令执行前自动备份所有存档）；添加存档大小统计和清理建议。前端在实例详情页的"世界"Tab中添加备份/恢复按钮和备份历史列表。
- **预期解决的问题**: 世界存档丢失后无法恢复；手动备份存档需要找到存档目录并手动复制，操作繁琐。
- **关联模块**: src-tauri/src/commands/world.rs, src-tauri/src/instance/manager.rs

### 4.2 模组与内容管理（7项）

### FE-07 模组依赖图可视化

- **优先级**: P1
- **类别**: 内容管理
- **改进内容**: 实现模组依赖关系的可视化展示，帮助用户直观理解模组间的依赖和冲突关系。当前 `check_mod_conflicts` 命令仅返回文本形式的冲突列表，缺少图形化展示。
- **技术实现建议**: 后端扩展 `check_mod_conflicts` 命令，解析每个模组的 `mods.toml`（Forge）、`fabric.mod.json`（Fabric）、`quilt.mod.json`（Quilt）中的 `depends`/`breaks`/`conflicts` 字段，构建完整的依赖图数据结构（节点为模组，边为依赖/冲突关系），序列化为 `{nodes: [{id, name, version}], edges: [{source, target, type}]}` 格式返回前端。前端使用 react-flow 库渲染交互式依赖图：依赖关系用实线箭头表示，冲突关系用红色虚线表示；缺失依赖的节点标红；支持点击节点查看详情；支持缩放和拖拽；高亮选中模组的直接依赖链。在 InstanceDetailPage 的模组列表中添加"依赖图"视图切换按钮。
- **预期解决的问题**: 模组冲突排查耗时，用户需要逐个查看模组说明才能理解依赖关系；缺少直观的依赖关系展示工具。
- **关联模块**: src-tauri/src/commands/misc.rs, src/pages/InstanceDetailPage.tsx

### FE-08 模组版本锁定

- **优先级**: P2
- **类别**: 内容管理
- **改进内容**: 添加模组版本锁定机制，被锁定的模组不参与批量更新操作，防止意外升级到不兼容的版本。当前 content.rs 的 `installed_content.json` 中缺少版本锁定标记。
- **技术实现建议**: 在 `InstalledContent` 结构体中添加 `pinned: bool` 字段；添加 `pin_mod`/`unpin_mod` 命令；修改 `bulk_update_content` 命令逻辑，跳过 `pinned: true` 的模组；更新 `check_content_updates` 返回结果中标注锁定状态。前端在 LibraryPage 的模组列表中添加锁定图标（锁形图标，点击切换）；锁定模组行显示灰色背景和锁定标识；批量更新时显示"X个模组已锁定，不会更新"提示。
- **预期解决的问题**: 批量更新模组时可能升级到不兼容版本，导致游戏崩溃；用户无法保护已知稳定的模组版本不被意外更新。
- **关联模块**: src-tauri/src/content.rs, src-tauri/src/commands/content.rs, src/pages/LibraryPage.tsx

### FE-09 模组配置编辑器

- **优先级**: P3
- **类别**: 内容管理
- **改进内容**: 内置模组配置文件编辑器，支持直接在启动器中编辑 `.json`、`.toml`、`.cfg`、`.properties` 等格式的配置文件，无需切换到外部编辑器或文件管理器。
- **技术实现建议**: 前端实现一个基于 CodeMirror 6 的配置编辑器组件，支持 JSON/TOML/Properties 语法高亮和格式化；添加常用配置项的表单化编辑模式（解析配置文件结构，生成表单UI，适合非技术用户）；编辑前自动备份原配置文件；支持配置文件对比视图（当前版本 vs 备份版本）；后端添加 `read_config_file`/`write_config_file` 命令，带路径安全校验（仅允许访问实例目录下的配置文件，复用 sanitizer.rs 的 `sanitize_path` 防止路径遍历）。
- **预期解决的问题**: 修改模组配置需要切换到文件管理器找到对应目录再用文本编辑器打开，操作繁琐且容易改错位置。
- **关联模块**: 新增前端组件 src/components/ui/ConfigEditor.tsx，后端扩展 src-tauri/src/commands/instance.rs

### FE-10 资源包与光影包管理增强

- **优先级**: P2
- **类别**: 内容管理
- **改进内容**: 增强资源包和光影包的管理体验，添加缩略图预览、拖拽排序、一键启用/禁用、兼容性标注等功能。当前 `list_instance_resourcepacks` 和 `list_instance_shaders` 命令仅返回文件列表，缺少预览和排序能力。
- **技术实现建议**: 后端扩展资源包命令，解析 `pack.mcmeta` 获取描述和图标信息；读取 `options.txt` 中的资源包顺序；添加 `set_resourcepack_order`/`toggle_resourcepack`/`toggle_shader` 命令。前端实现资源包缩略图网格视图（从 ZIP 中提取 `pack.png`）；拖拽排序组件（基于 `@dnd-kit/core`），排序结果写入 `options.txt`；启用/禁用开关（通过在文件名前添加/移除 `.disabled` 后缀实现）；光影包兼容性标注（基于 Iris/Optifine 的支持信息）。在 InstanceDetailPage 的资源包/光影包 Tab 中实现上述功能。
- **预期解决的问题**: 资源包管理体验差，无法预览效果、无法调整加载顺序、无法快速启用/禁用。
- **关联模块**: src-tauri/src/commands/content.rs, src/pages/InstanceDetailPage.tsx

### FE-11 内容推荐引擎

- **优先级**: P2
- **类别**: 内容管理
- **改进内容**: 实现个性化内容推荐系统，基于用户已安装的模组和浏览历史推荐相关内容，降低内容发现门槛。当前 StorePage 仅展示热门和最新内容，缺少个性化推荐。
- **技术实现建议**: 实现三层推荐策略：第一层基于标签相似度（提取已安装模组的 Modrinth 分类标签，计算 Jaccard 相似度推荐同类模组）；第二层基于 Modrinth/CurseForge 的推荐 API（Modrinth 的 `GET /v2/project/{id}/recommendations`）；第三层基于协同过滤（维护本地安装统计，"安装了A的用户也安装了B"）。后端添加 `get_recommendations` 命令（当前已有基础实现），增强推荐算法和缓存策略。前端在商店首页添加"为你推荐"板块；在模组详情页添加"相关推荐"区域；推荐结果附带推荐理由（如"因为你安装了 Sodium"）。
- **预期解决的问题**: 发现新模组困难，用户需要主动搜索或浏览热门列表；缺少基于个人偏好的内容发现机制。
- **关联模块**: src/pages/StorePage.tsx, src-tauri/src/modrinth.rs, src-tauri/src/commands/system.rs

### FE-12 下载暂停/恢复

- **优先级**: P1
- **类别**: 内容管理
- **改进内容**: 实现大文件下载的暂停和恢复功能，避免下载中断后需要从头开始。当前 download/queue.rs 的 `DownloadQueue` 仅支持并发下载和重试，缺少暂停/恢复和断点续传能力。
- **技术实现建议**: 后端重构 `DownloadQueue`，添加 `PauseSignal`（使用 `tokio::sync::watch` 通道）控制下载暂停/恢复；下载状态持久化到磁盘（`download_state.json`，记录每个任务的 URL、目标路径、已下载字节数、SHA1、总大小）；恢复下载时使用 HTTP Range 请求从断点继续（需服务端支持，Mojang/Modrinth/CurseForge CDN 均支持）；添加 `pause_download`/`resume_download`/`cancel_download` 三个 Tauri 命令。前端在 downloadStore.tsx 中添加暂停/恢复/取消操作；DownloadPanel 中每个下载项显示暂停/恢复按钮；暂停的任务显示已下载进度和暂停标识。
- **预期解决的问题**: 大文件（如 Minecraft 主 jar、大型整合包）下载中断后需重新开始，浪费带宽和时间；用户无法主动暂停下载以释放网络带宽。
- **关联模块**: src-tauri/src/download/queue.rs, src/stores/downloadStore.tsx, src/components/ui/DownloadPanel.tsx

### FE-13 模组更新日志查看

- **优先级**: P2
- **类别**: 内容管理
- **改进内容**: 在模组更新时展示更新日志（changelog），让用户了解新版本的变化，做出是否更新的明智决策。当前更新流程仅显示版本号变化，缺少更新内容说明。
- **技术实现建议**: 后端扩展 Modrinth 和 CurseForge 的版本查询命令，在 `get_mod_versions` 和 `get_cf_mod_versions` 返回结果中包含 `changelog` 字段（Modrinth API 的 `GET /v2/version/{id}` 已提供 changelog；CurseForge API 的 `GET /v1/mods/{modId}/files/{fileId}` 的 `changelog` 字段为 HTML 格式需转换为 Markdown）；添加 `get_version_changelog` 命令单独获取指定版本的更新日志。前端在 LibraryPage 的更新提示中添加"查看更新日志"链接；使用 Markdown 渲染器展示 changelog；添加版本对比视图（旧版本 vs 新版本的变化摘要）。
- **预期解决的问题**: 用户在更新模组时无法了解更新内容，盲目更新可能引入不兼容变化或不想要的功能。
- **关联模块**: src/pages/LibraryPage.tsx, src-tauri/src/modrinth.rs, src-tauri/src/curseforge.rs

### 4.3 下载与安装（4项）

### FE-14 下载队列优先级管理

- **优先级**: P2
- **类别**: 下载管理
- **改进内容**: 为下载队列添加优先级管理功能，支持调整下载顺序和紧急任务插队。当前 downloadStore.tsx 的下载任务按添加顺序执行，无法调整优先级。
- **技术实现建议**: 后端在 `DownloadTask` 结构体中添加 `priority: u32` 字段（数值越小优先级越高）；`DownloadQueue` 按优先级排序执行；添加 `set_download_priority` 命令。前端在 DownloadPanel 中实现拖拽排序（基于 `@dnd-kit/sortable`），拖拽后调用 `set_download_priority` 更新优先级；添加"紧急下载"按钮（将任务优先级设为最高）；高优先级任务以黄色边框标识；正在下载的任务不受优先级调整影响（仅影响队列中的等待任务）。
- **预期解决的问题**: 急需使用的模组排在长队列后面，需要等待前面的下载完成；无法根据实际需求调整下载顺序。
- **关联模块**: src/stores/downloadStore.tsx, src-tauri/src/download/queue.rs

### FE-15 批量安装与依赖自动解析

- **优先级**: P2
- **类别**: 下载管理
- **改进内容**: 增强批量安装模组时的依赖解析能力，递归解析完整的依赖树，显示所有将被安装的依赖项供用户确认，并自动跳过已安装的兼容版本。当前 InstallButton 的依赖解析为单层，可能遗漏间接依赖。
- **技术实现建议**: 后端实现递归依赖解析器：从 Modrinth/CurseForge API 获取每个模组的依赖列表，对每个依赖递归查询其依赖，直到所有依赖都被解析或达到最大深度（防止循环依赖）；生成完整的依赖树 `{mod_id, version_id, dependencies: [...]}`；与已安装模组列表对比，标记"新增"、"升级"、"已满足"三种状态；添加 `resolve_dependencies` 命令返回完整依赖树。前端在安装确认对话框中展示依赖树视图（可折叠/展开）；用户可取消勾选不需要的可选依赖；显示总下载大小估算。
- **预期解决的问题**: 安装模组时缺少前置依赖导致游戏崩溃；批量安装时无法预览完整的安装内容；重复安装已有的依赖浪费带宽。
- **关联模块**: src/components/ui/InstallButton.tsx, src-tauri/src/modrinth.rs

### FE-16 安装失败自动回滚

- **优先级**: P2
- **类别**: 下载管理
- **改进内容**: 实现安装过程的原子性，当部分文件下载失败时自动回滚已下载的文件，避免残留不一致状态。当前安装流程中如果某个依赖下载失败，已下载到 `mods/` 目录的文件不会被清理。
- **技术实现建议**: 采用"临时目录+原子移动"策略：安装开始时在实例目录下创建 `.install_tmp/{session_id}/` 临时目录；所有文件先下载到临时目录；全部下载成功后，将文件从临时目录移动到目标位置（使用 `tokio::fs::rename`，同文件系统下为原子操作）；任何步骤失败时，清理临时目录并删除已移动的文件（记录操作日志用于回滚）；添加安装会话状态机（`Preparing`→`Downloading`→`Verifying`→`Installing`→`Completed`/`RolledBack`）。对于模组安装，在移动前先备份被覆盖的旧版本模组文件。
- **预期解决的问题**: 安装失败后文件状态不一致，部分模组已安装但依赖缺失，导致游戏启动崩溃；残留文件占用磁盘空间。
- **关联模块**: src-tauri/src/download/queue.rs, src-tauri/src/content.rs

### FE-17 Quilt/NeoForge 加载器支持

- **优先级**: P2
- **类别**: 下载管理
- **改进内容**: 添加 Quilt 和 NeoForge 模组加载器的支持，扩展启动器的模组生态覆盖面。当前 loader/ 目录仅包含 `fabric.rs` 和 `forge.rs` 两个加载器实现。
- **技术实现建议**: 创建 `src-tauri/src/loader/quilt.rs`，Quilt 使用 Fabric Meta API 的兼容层（`https://meta.fabricmc.net/v2/` 替换为 `https://meta.quiltmc.org/v3/`），解析 Quilt Loader 的版本清单和安装元数据；创建 `src-tauri/src/loader/neoforge.rs`，NeoForge 使用独立的 API（`https://maven.neoforged.net/api/maven/` 获取版本列表，`https://projects.neoforged.net/neoforged/neoforge/` 获取安装元数据），安装流程参考 Forge 但使用 NeoForge 特有的安装脚本。前端在 format.ts 中已定义了 Quilt 和 NeoForge 的图标和标签映射，需在实例创建和加载器安装流程中添加对应的选项。
- **预期解决的问题**: 无法安装 Quilt 和 NeoForge 模组，限制了用户的模组选择范围；部分热门整合包使用 Quilt/NeoForge，无法通过 BonNext 安装。
- **关联模块**: src-tauri/src/loader/mod.rs, src-tauri/src/loader/fabric.rs, src-tauri/src/loader/forge.rs

### 4.4 社交与多人联机（5项）

### FE-18 好友系统

- **优先级**: P3
- **类别**: 社交
- **改进内容**: 实现基于 Terracotta 服务器的好友系统，支持好友添加/删除、在线状态查看、游戏状态同步。当前 commands/social.rs 已有 `list_friends`/`add_friend`/`remove_friend` 命令的框架，但功能不完整。
- **技术实现建议**: 基于 Terracotta 的用户系统实现好友功能：添加好友通过用户名搜索和邀请码两种方式；好友关系存储在 Terracotta 服务器端（通过 REST API 交互）；在线状态通过 WebSocket 实时推送；游戏状态同步（当前游玩的实例、服务器地址）通过 Terracotta 的状态接口获取。前端添加好友列表侧边栏（可折叠），显示在线/离线状态和当前游戏信息；支持点击好友头像快速加入同一服务器。
- **预期解决的问题**: 无法查看朋友是否在线和正在玩什么；缺少启动器内的社交互动功能。
- **关联模块**: src-tauri/src/terracotta.rs, src-tauri/src/commands/social.rs

### FE-19 服务器列表与快速加入

- **优先级**: P2
- **类别**: 多人联机
- **改进内容**: 添加服务器列表管理功能，支持服务器的添加/编辑/删除/收藏，以及服务器状态检测（在线人数、延迟、版本）。当前 commands/server.rs 仅有 `ping_server` 命令，缺少完整的 CRUD 管理。
- **技术实现建议**: 后端添加服务器列表管理命令：`add_server`/`update_server`/`remove_server`/`list_servers`/`favorite_server`；服务器信息持久化到 `servers.json`（包含 address、name、icon_base64、is_favorite、last_joined 等字段）；`ping_server` 命令增强，返回在线玩家数、MOTD、版本号、延迟（当前已有基础实现）；添加 `import_servers_from_clipboard`（从剪贴板解析服务器地址）和 `import_servers_from_file`（从 `servers.dat` NBT 文件导入）。前端实现服务器列表页面（卡片视图+列表视图切换）；服务器状态实时指示灯（绿色在线/红色离线/黄色检测中）；收藏服务器置顶；双击快速加入。
- **预期解决的问题**: 管理服务器地址不便，每次需手动输入IP；无法快速查看服务器是否在线和当前人数。
- **关联模块**: src-tauri/src/commands/server.rs, 新增前端页面 src/pages/ServersPage.tsx

### FE-20 联机房间管理增强

- **优先级**: P2
- **类别**: 多人联机
- **改进内容**: 增强 Terracotta 联机房间的管理功能，添加房间密码保护、玩家踢出/禁止、房间设置（难度、游戏模式）、邀请链接等。当前 Terracotta 集成仅有 `set_host`/`set_guest`/`set_idle` 三个状态切换命令，缺少细粒度的房间管理。
- **技术实现建议**: 后端扩展 Terracotta 命令集：`create_room`（支持密码、最大人数、游戏模式等参数）、`join_room_with_password`、`kick_player`、`ban_player`、`set_room_settings`、`generate_invite_link`、`join_via_invite_link`；这些命令通过 Terracotta 的 REST API 实现（`POST /room/create`、`POST /room/{id}/kick` 等）。前端在联机面板中添加房间管理界面：创建房间时的设置表单；房间内玩家列表（支持踢出/禁止操作）；邀请链接一键复制；房间设置实时修改。
- **预期解决的问题**: 联机房间管理粗糙，缺少基本的权限控制和设置能力；无法防止陌生人随意加入。
- **关联模块**: src-tauri/src/terracotta.rs, src-tauri/src/lib.rs（Terracotta 命令定义处）

### FE-21 游戏内聊天桥接

- **优先级**: P3
- **类别**: 多人联机
- **改进内容**: 实现启动器与游戏内聊天的桥接，在启动器中查看和发送游戏内聊天消息，无需切出游戏。当前游戏进程的输出通过 `game-output` 事件发送到前端，但未解析聊天消息。
- **技术实现建议**: 后端在 launch/process.rs 的游戏输出监听中添加聊天消息解析器：使用正则表达式匹配 Minecraft 的聊天日志格式（`[Chat] <Player> message`、`[Async Chat Thread]` 等）；解析后的聊天消息通过 `chat-message` 事件发送到前端；添加 `send_chat_message` 命令（通过向游戏进程的 stdin 写入 `/say` 或 `/msg` 命令实现，仅对单人游戏开放管理员权限时有效）。前端在实例详情页添加可折叠的聊天面板；消息按时间线展示，支持玩家名称着色；添加消息输入框。
- **预期解决的问题**: 游戏全屏运行时查看聊天需要切出游戏，影响游戏体验；管理员在启动器中无法快速执行游戏命令。
- **关联模块**: src-tauri/src/launch/process.rs, src/pages/InstanceDetailPage.tsx

### FE-22 皮肤管理增强

- **优先级**: P2
- **类别**: 多人联机
- **改进内容**: 增强皮肤管理功能，添加 3D 皮肤预览、皮肤上传、皮肤库浏览和 Cape 管理。当前已有 `yggdrasil_upload_skin`/`yggdrasil_reset_skin`/`microsoft_upload_skin`/`microsoft_delete_skin`/`set_local_skin`/`read_skin_file`/`validate_skin_file` 等命令，但缺少 3D 预览和皮肤库功能。
- **技术实现建议**: 前端集成 three.js 实现皮肤 3D 预览：使用 `skinview3d` 库（专为 Minecraft 皮肤设计的 WebGL 渲染器），支持旋转、缩放、动画（行走/奔跑）；皮肤上传流程优化（拖拽上传、裁剪调整、Steve/Alex 模型选择）；添加皮肤库浏览功能（从 LittleSkin 等皮肤站获取热门皮肤列表）；Cape 管理界面（展示已拥有的 Cape，支持切换和预览）。在设置页的皮肤站部分整合以上功能。
- **预期解决的问题**: 皮肤管理体验差，无法预览上传效果；缺少皮肤发现和选择功能；Cape 管理不便。
- **关联模块**: src-tauri/src/commands/auth.rs, src/pages/settings/（皮肤站相关 Section）

### 4.5 数据统计与分析（5项）

### FE-23 游戏时长趋势图

- **优先级**: P2
- **类别**: 数据统计
- **改进内容**: 添加游戏时长的趋势分析功能，按日/周/月展示游戏时长变化。当前已有 `get_playtime_stats` 和 `record_playtime` 命令记录游戏时长，但仅有总计数据，缺少趋势分析。
- **技术实现建议**: 后端扩展 `get_playtime_stats` 命令，添加 `time_range` 参数（`day`/`week`/`month`/`year`）和 `granularity` 参数（`hour`/`day`/`week`）；每次游戏启动和退出时记录时间戳到 `playtime_history.json`（`{instance_id, started_at, stopped_at, duration}`）；按时间范围聚合返回趋势数据。前端使用 recharts 库绘制面积图/柱状图；支持日/周/月/年切换；鼠标悬停显示详细数据；在 InstancesPage 的实例卡片中显示最近7天的游戏时长迷你图。
- **预期解决的问题**: 无法了解自己的游戏习惯和时间分布；缺少游戏时长的可视化分析。
- **关联模块**: src-tauri/src/commands/misc.rs, src/pages/InstancesPage.tsx

### FE-24 模组使用率统计

- **优先级**: P3
- **类别**: 数据统计
- **改进内容**: 统计模组的启用/禁用历史和使用频率，帮助用户识别不常用的模组并建议清理。
- **技术实现建议**: 后端在模组启用/禁用操作时记录日志到 `mod_usage.json`（`{mod_id, action: enable/disable, timestamp}`）；添加 `get_mod_usage_stats` 命令，返回每个模组的启用次数、最近使用时间、累计启用时长（基于游戏时长和模组启用状态交叉计算）；添加 `suggest_cleanup` 命令，识别超过30天未启用的模组。前端在 LibraryPage 中添加"使用统计"视图，以热力图或排行榜形式展示模组使用率；不常用模组显示"建议清理"标签。
- **预期解决的问题**: 模组列表臃肿，不知道哪些模组经常使用、哪些从未启用；缺少数据驱动的模组清理建议。
- **关联模块**: 新增后端模块 src-tauri/src/analytics.rs，扩展 src-tauri/src/commands/content.rs

### FE-25 截图管理增强

- **优先级**: P2
- **类别**: 数据统计
- **改进内容**: 增强截图管理功能，添加缩略图网格视图、按日期分组、一键复制/分享、上传到图床。当前 `list_screenshots` 命令仅返回截图文件列表，缺少预览和分享能力。
- **技术实现建议**: 后端扩展 `list_screenshots` 命令，返回缩略图数据（将截图缩放到 200x200 的 base64 编码图片，避免前端加载原图）；添加 `upload_screenshot` 命令（上传到 imgur 或自定义图床，返回分享链接）；按拍摄日期分组返回。前端实现截图网格视图（瀑布流布局，使用 `react-masonry-css`）；点击查看大图（支持左右切换）；按日期分组展示（"今天"、"昨天"、"本周"、"更早"）；右键菜单支持"复制到剪贴板"、"上传分享"、"在文件管理器中打开"。
- **预期解决的问题**: 截图管理不便，无法快速预览和分享；截图文件分散在实例目录中难以统一管理。
- **关联模块**: src-tauri/src/commands/misc.rs, src/pages/InstanceDetailPage.tsx

### FE-26 崩溃报告智能分析

- **优先级**: P2
- **类别**: 数据统计
- **改进内容**: 增强 crash_parser.rs 的崩溃报告分析能力，识别更多崩溃模式，关联已知问题数据库，提供具体的修复建议。当前 `parse_crash_report` 和 `diagnose_crash` 命令已有基础实现，但识别的崩溃模式有限。
- **技术实现建议**: 扩展崩溃模式识别规则库：添加常见模组冲突模式（如 Optifine 与 Sodium 不兼容、Forge 和 Fabric 模组混装）、Java 版本不匹配模式（`UnsupportedClassVersionError`）、内存不足模式（`OutOfMemoryError`）、原生库加载失败模式（`UnsatisfiedLinkError`）；每种模式关联修复建议和文档链接；添加本地已知问题数据库（`known_issues.json`，包含模组名+版本+问题描述+解决方案，可在线更新）；崩溃报告与 Modrinth 的 issue tracker 关联查询。前端在崩溃报告页面展示结构化分析结果：崩溃原因（红色）、可能原因列表（黄色）、修复建议（绿色，可操作按钮如"降级模组"、"切换Java版本"）。
- **预期解决的问题**: 游戏崩溃后用户不知道如何修复，崩溃报告对非技术用户来说难以理解；缺少针对性的修复建议。
- **关联模块**: src-tauri/src/crash_parser.rs, src-tauri/src/commands/instance.rs

### FE-27 启动成功率追踪

- **优先级**: P2
- **类别**: 数据统计
- **改进内容**: 记录每次游戏启动的结果（成功/崩溃/超时），计算启动成功率趋势，对异常版本发出告警。
- **技术实现建议**: 后端在游戏退出时记录启动结果到 `launch_history.json`（`{instance_id, version_id, launched_at, result: success/crash/timeout, exit_code, duration}`）；添加 `get_launch_success_rate` 命令，按版本/实例/时间范围计算成功率；连续3次启动失败时通过 `app.emit()` 发送告警事件。前端在实例详情页添加"稳定性"指标（成功率百分比+趋势箭头）；启动成功率低于80%的版本显示警告标识；添加启动历史时间线视图。
- **预期解决的问题**: 不知道哪个版本或模组配置最稳定；缺少启动失败的模式识别和预警机制。
- **关联模块**: src-tauri/src/launch/process.rs, src/pages/InstanceDetailPage.tsx

### 4.6 启动器核心功能（6项）

### FE-28 应用自动更新

- **优先级**: P1
- **类别**: 启动器核心
- **改进内容**: 实现应用自身的自动更新机制，包括更新检查、下载、安装全流程。当前 Cargo.toml 和 tauri.conf.json 中未集成 `tauri-plugin-updater`，用户需手动下载新版本。
- **技术实现建议**: 集成 `tauri-plugin-updater`：在 `Cargo.toml` 中添加 `tauri-plugin-updater` 依赖；在 `tauri.conf.json` 中配置更新源（GitHub Releases 的 JSON endpoint）；在 `lib.rs` 的 `run()` 中注册插件；实现更新检查逻辑（启动时后台检查，不阻塞主流程）；下载更新时显示进度条；支持增量更新（差量下载，减少下载量）；更新前自动备份当前版本；添加"跳过此版本"选项。前端添加更新通知弹窗（显示版本号、更新日志、下载进度）；设置页添加"检查更新"按钮和自动更新开关。
- **预期解决的问题**: 用户使用过时版本，缺少新功能和安全修复；手动下载更新操作繁琐。
- **关联模块**: src-tauri/Cargo.toml, src-tauri/tauri.conf.json, src-tauri/src/lib.rs

### FE-29 多 JRE 版本管理

- **优先级**: P1
- **类别**: 启动器核心
- **改进内容**: 实现多 JRE 版本管理，支持自动下载和管理不同版本的 JRE（8/11/17/21），实例可关联特定 JRE 版本，启动时自动选择匹配版本。当前已有 `find_all_java`/`check_java_version`/`download_java_version`/`list_downloaded_jres` 等命令，但缺少实例级别的 JRE 关联和自动匹配逻辑。
- **技术实现建议**: 后端完善 JRE 管理功能：在 `GameInstance` 中添加 `jre_path: Option<String>` 字段，允许实例指定 JRE；添加 `auto_select_jre(instance_id)` 命令，根据 Minecraft 版本自动选择匹配的 JRE（1.16.5- → Java 8/11，1.17~1.20.4 → Java 17，1.20.5+ → Java 21）；扩展 `download_java_version` 支持 Adoptium（Eclipse Temurin）的 JRE 8/11/17/21 下载；JRE 安装目录为 `{data_dir}/jres/{version}/`。前端在设置页的 Java 部分添加 JRE 版本管理器（列出已安装的 JRE、下载新版本、删除不需要的版本）；实例设置中添加 JRE 选择下拉框（"自动"或指定版本）。
- **预期解决的问题**: 新版本 Minecraft 需要 Java 17+ 但用户只有 Java 8；不同实例需要不同 Java 版本，手动切换不便。
- **关联模块**: src-tauri/src/commands/misc.rs, src-tauri/src/platform/, src/pages/settings/（JRE Section）

### FE-30 Java 参数预设管理

- **优先级**: P2
- **类别**: 启动器核心
- **改进内容**: 完善 JVM 参数预设系统，提供开箱即用的预设模板（性能优化/兼容性/大模组包），支持用户自定义预设保存和实例级别覆盖。当前已有 `get_optimization_presets_cmd` 和 `apply_optimization_preset` 命令，但预设种类有限且不支持自定义。
- **技术实现建议**: 后端定义预设模板：`PerformancePreset`（G1GC + 大内存分配优化，适合高性能机器）、`CompatibilityPreset`（SerialGC + 保守内存设置，适合低配机器）、`ModpackPreset`（ZGC + 大堆内存 + 字符串去重，适合大型整合包）、`VanillaPreset`（默认参数，适合原版）；添加 `save_custom_preset`/`list_custom_presets`/`delete_custom_preset` 命令；在 `GameInstance` 中添加 `jvm_args_override: Option<Vec<String>>` 字段，实例级覆盖全局预设。前端在设置页的高级部分完善 OptimizationPresets 组件：预设卡片选择（显示适用场景和预期效果）；自定义预设编辑器（参数列表+说明）；实例设置中的 JVM 参数覆盖入口。
- **预期解决的问题**: JVM 参数配置门槛高，普通用户不知道如何优化；缺少针对不同场景的参数推荐。
- **关联模块**: src-tauri/src/commands/optimization.rs, src/pages/settings/（AdvancedSection）

### FE-31 游戏目录文件浏览器

- **优先级**: P2
- **类别**: 启动器核心
- **改进内容**: 添加内置的游戏目录文件浏览器，支持在启动器内浏览和管理游戏文件，无需切换到系统文件管理器。
- **技术实现建议**: 后端添加文件浏览命令：`list_directory(path)` 返回目录内容（文件名、大小、修改时间、类型）；`read_text_file(path)` 返回文本文件内容（限制大小 1MB）；`get_file_info(path)` 返回文件详细信息；所有路径参数经过 `sanitize_path` 校验，仅允许访问实例目录下的文件。前端实现文件浏览器组件：左侧树形目录结构（虚拟滚动，支持懒加载子目录）；右侧文件列表（图标视图/列表视图切换）；常用目录快捷入口（saves、mods、config、logs、screenshots）；文本文件预览（语法高亮）；图片文件预览；右键菜单（重命名、删除、在系统文件管理器中打开）。在 InstanceDetailPage 中添加"文件"Tab。
- **预期解决的问题**: 管理游戏文件需要切换到系统文件管理器，操作不便且容易误操作其他目录。
- **关联模块**: 新增前端组件 src/components/ui/FileBrowser.tsx，后端扩展 src-tauri/src/commands/instance.rs

### FE-32 游戏日志实时查看器

- **优先级**: P2
- **类别**: 启动器核心
- **改进内容**: 实现游戏运行时的实时日志查看器，在启动器内直接查看游戏输出，支持日志级别着色、关键词过滤和搜索。当前已有 `read_log_file` 和 `list_instance_logs` 命令，但仅支持查看历史日志文件，缺少实时流式查看。
- **技术实现建议**: 后端在 launch/process.rs 的游戏输出监听中，将每行输出通过 `game-output` 事件发送到前端（当前已有此机制）；添加 `get_recent_logs(instance_id, lines)` 命令，读取日志文件最后N行用于初始化。前端实现日志查看器组件：订阅 `game-output` 事件实时追加日志行；日志级别着色（INFO 白色、WARN 黄色、ERROR 红色、DEBUG 灰色）；关键词过滤输入框（实时过滤匹配行）；全文搜索（高亮匹配结果）；自动滚动到底部（可手动锁定滚动位置）；日志行数限制（保留最近 10000 行，避免内存溢出）。在 InstanceDetailPage 的运行状态区域添加"查看日志"按钮。
- **预期解决的问题**: 调试游戏问题需要手动找到日志文件再用文本编辑器打开；无法实时观察游戏运行状态。
- **关联模块**: src-tauri/src/launch/process.rs, src-tauri/src/commands/world.rs, src/pages/InstanceDetailPage.tsx

### FE-33 启动前检查增强

- **优先级**: P2
- **类别**: 启动器核心
- **改进内容**: 在游戏启动前执行全面的预检查，包括端口占用、磁盘空间、内存可用性、Java 版本兼容性等，提前发现问题而非启动后才报错。
- **技术实现建议**: 添加 `pre_launch_check(instance_id)` 命令，执行以下检查项：端口 25565 是否被占用（`TcpListener::bind("0.0.0.0:25565")` 测试）；磁盘剩余空间是否满足实例配置的内存大小（当前 `LauncherError::DiskSpace` 已定义但未在启动前检查）；系统可用内存是否满足配置的最大内存（`sys-info` crate 获取可用内存）；Java 版本是否与 Minecraft 版本匹配；游戏进程是否已在运行（检查 `running_games` 中是否已有该实例）；必要文件是否存在（版本 jar、主库文件）。每项检查返回 `Pass`/`Warn`/`Fail`，`Fail` 项阻止启动，`Warn` 项显示确认对话框。前端在启动按钮点击后先执行预检查，展示检查结果；`Fail` 项阻止启动并显示修复建议；`Warn` 项显示"仍要启动"选项。
- **预期解决的问题**: 启动游戏后才发现端口被占用或内存不足，浪费时间；缺少预防性的启动检查机制。
- **关联模块**: src-tauri/src/launch/process.rs, src-tauri/src/error.rs

### 4.7 平台集成（5项）

### FE-34 Modrinth 深度集成

- **优先级**: P2
- **类别**: 平台集成
- **改进内容**: 深化 Modrinth 平台集成，添加账户 OAuth 登录、收藏列表同步、关注项目更新通知、项目合集支持。当前 modrinth.rs 仅实现了搜索、详情、版本查询等基础 API 调用，未涉及用户级功能。
- **技术实现建议**: 实现 Modrinth OAuth 登录流程（`https://api.modrinth.com/v2/auth/authorize` → 回调获取 Token）；使用 Token 调用用户相关 API：`GET /v2/user/{id}/follows` 获取关注列表、`POST /v2/project/{id}/follow` 关注项目、`GET /v2/user/{id}/notifications` 获取通知；将 Modrinth 收藏同步到本地 collections.rs 的收藏系统；支持 Modrinth 项目合集（`GET /v2/collection/{id}`）的浏览和一键安装。前端在设置页添加 Modrinth 账户绑定入口；商店页添加"关注更新"通知角标；合集页面支持一键安装合集中的所有模组。
- **预期解决的问题**: Modrinth 功能利用不充分，缺少账户级功能；关注的项目有更新时无法及时得知。
- **关联模块**: src-tauri/src/modrinth.rs, src-tauri/src/collections.rs

### FE-35 CurseForge 深度集成

- **优先级**: P2
- **类别**: 平台集成
- **改进内容**: 增强 CurseForge 平台集成，支持用户自定义 API Key、收藏同步、文件关系图和 Modpack 专属页面。当前 curseforge.rs 使用默认社区 API Key，功能受限。
- **技术实现建议**: 添加用户自定义 CurseForge API Key 的支持（通过 key_store.rs 安全存储）；使用用户 API Key 解锁更多 API 功能：`GET /v1/mods/{modId}/description` 获取完整描述、收藏列表同步、文件依赖关系图；CurseForge Modpack 专属页面（解析 manifest.json，展示包含的模组列表和可选模组）；添加 `sync_cf_favorites` 命令。前端在设置页添加 CurseForge API Key 配置入口；商店页的 CurseForge 内容显示更丰富的信息。
- **预期解决的问题**: CurseForge 功能受限，默认 API Key 有调用频率限制；缺少用户级功能如收藏同步。
- **关联模块**: src-tauri/src/curseforge.rs, src-tauri/src/security/key_store.rs

### FE-36 皮肤站深度集成

- **优先级**: P2
- **类别**: 平台集成
- **改进内容**: 深化 Yggdrasil 皮肤站集成，添加皮肤库浏览、热门皮肤推荐、皮肤上传/更换、Cape 管理和自定义皮肤站 URL 记忆。当前已有基础的 Yggdrasil 登录和皮肤操作命令，但缺少皮肤发现和管理功能。
- **技术实现建议**: 后端添加皮肤站浏览命令：`browse_skins`（从皮肤站 API 获取皮肤列表，支持分页和搜索）、`get_popular_skins`（热门皮肤推荐）、`get_skin_preview`（获取皮肤图片用于预览）；支持自定义皮肤站 URL（在配置中添加 `custom_skin_station_url` 字段，记忆最近使用的皮肤站地址）；Cape 管理命令：`list_capes`/`select_cape`。前端实现皮肤库浏览页面（网格视图，支持搜索和筛选）；皮肤一键应用（点击皮肤图 → 预览 → 确认上传）；Cape 管理界面（展示已拥有的 Cape 缩略图，点击切换）。
- **预期解决的问题**: 皮肤管理体验差，缺少皮肤发现和选择功能；自定义皮肤站 URL 每次需手动输入。
- **关联模块**: src-tauri/src/commands/auth.rs, src/pages/settings/（SkinStationSection）

### FE-37 Discord Rich Presence 增强

- **优先级**: P3
- **类别**: 平台集成
- **改进内容**: 增强 Discord Rich Presence 的信息展示，显示当前模组名称、服务器地址（脱敏）、游戏时长和加入按钮。当前 commands/social.rs 已有 `start_discord_rpc`/`stop_discord_rpc`/`update_discord_presence` 命令，但展示信息有限。
- **技术实现建议**: 扩展 `update_discord_presence` 命令的参数，添加 `mod_name`（当前游玩的主要模组名）、`server_address`（脱敏处理，仅显示域名部分，隐藏端口和IP）、`elapsed`（游戏时长，自动计算）、`join_url`（Terracotta 房间邀请链接，点击可直接加入）；在游戏启动时自动更新 Discord 状态，退出时清除；支持用户在设置中自定义 Discord 展示内容的隐私级别（完全不展示/仅展示游戏/展示服务器信息）。
- **预期解决的问题**: Discord 状态信息不够丰富，好友无法了解具体在玩什么；缺少从 Discord 直接加入游戏的功能。
- **关联模块**: src-tauri/src/commands/social.rs

### FE-38 Microsoft 账户皮肤管理

- **优先级**: P3
- **类别**: 平台集成
- **改进内容**: 实现微软账户的皮肤上传和管理功能。当前已有 `microsoft_upload_skin`/`microsoft_delete_skin`/`microsoft_get_skin_profile` 命令，但前端缺少对应的UI入口。
- **技术实现建议**: 后端完善 `microsoft_upload_skin` 命令，调用 Minecraft Profile API（`PUT /minecraft/profile/skins`）上传皮肤，支持 Steve/Alex 模型选择；`microsoft_get_skin_profile` 返回当前皮肤 URL 和模型类型；`microsoft_delete_skin` 重置为默认皮肤。前端在设置页的账户区域添加微软账户皮肤管理：当前皮肤 3D 预览；上传新皮肤（拖拽或选择文件，支持 PNG 格式校验）；Steve/Alex 模型切换；重置为默认皮肤按钮。
- **预期解决的问题**: 微软账户修改皮肤需登录 Minecraft 官网，操作不便；启动器内缺少统一的皮肤管理入口。
- **关联模块**: src-tauri/src/commands/auth.rs, src-tauri/src/auth/microsoft.rs

### 4.8 开发者工具（4项）

### FE-39 模组开发模板

- **优先级**: P3
- **类别**: 开发者工具
- **改进内容**: 添加模组开发辅助功能，提供 Fabric/Forge 模组项目模板生成和开发环境一键配置。
- **技术实现建议**: 后端添加模组开发模板命令：`create_mod_project(template_type, mod_id, mod_name, mc_version)` 生成项目骨架（Fabric 使用 fabric-example-mod 模板，Forge 使用 MDK 模板）；`setup_dev_environment(project_path)` 一键配置开发环境（下载 Gradle wrapper、运行 `gradle genSources`）；`create_test_instance(project_path)` 自动创建测试实例并链接到开发项目的 build output。模板包含 `build.gradle`、`fabric.mod.json`/`mods.toml`、主类模板、README 等。
- **预期解决的问题**: 模组开发环境搭建繁琐，新手不知道从何开始；缺少标准化的项目初始化工具。
- **关联模块**: 新增后端模块 src-tauri/src/devtools.rs

### FE-40 调试启动模式

- **优先级**: P2
- **类别**: 开发者工具
- **改进内容**: 添加调试模式启动选项，支持 JDWP 远程调试、调试端口配置和自动挂载开发目录。
- **技术实现建议**: 在 launch/args.rs 的 JVM 参数构建中添加调试模式支持：添加 `debug_launch` 命令（在标准 `launch_game` 基础上追加 `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005` JVM 参数）；调试端口可配置（默认 5005）；添加 `suspend` 选项（启动时暂停等待调试器连接）；自动将 `mod_development` 目录添加到 classpath；在 jvm_whitelist.rs 的白名单中添加 `-agentlib:jdwp` 前缀。前端在实例设置中添加"调试模式"开关和端口配置输入框；调试启动时显示"等待调试器连接"状态。
- **预期解决的问题**: 模组调试需手动配置 JVM 调试参数，门槛高且容易出错。
- **关联模块**: src-tauri/src/launch/args.rs, src-tauri/src/security/jvm_whitelist.rs

### FE-41 日志分析工具

- **优先级**: P3
- **类别**: 开发者工具
- **改进内容**: 添加结构化日志分析工具，识别 WARN/ERROR 模式，提供性能分析（tick 时间统计）和内存泄漏检测提示。
- **技术实现建议**: 扩展 crash_parser.rs 的功能，添加日志分析能力：`analyze_log(log_content)` 命令，解析日志中的 WARN/ERROR 条目并分类统计；`analyze_tick_times(log_content)` 提取 tick 时间数据（匹配 `Can't keep up!` 和 tick 耗时日志），生成性能报告；`detect_memory_issues(log_content)` 识别内存相关警告（GC 日志分析、`OutOfMemoryError` 前兆）；结果以结构化 JSON 返回。前端在日志查看器中添加"分析"按钮，展示分析报告（问题列表、性能图表、建议）。
- **预期解决的问题**: 分析日志效率低，需要手动搜索关键信息；缺少自动化的性能和内存问题识别。
- **关联模块**: src-tauri/src/crash_parser.rs

### FE-42 模组兼容性数据库

- **优先级**: P3
- **类别**: 开发者工具
- **改进内容**: 建立模组兼容性信息来源，集成 Modrinth 的兼容性数据，支持用户报告兼容性问题，维护社区兼容性列表。
- **技术实现建议**: 后端添加兼容性数据库模块：从 Modrinth API 获取模组的兼容性信息（版本兼容性、已知冲突）；实现本地兼容性数据库（`compatibility_db.json`，结构为 `{mod_pair: {mod_a, mod_b, status: compatible/conflict/unknown, source: api/user, notes}}`）；添加 `report_compatibility` 命令（用户提交兼容性报告）、`check_compatibility` 命令（查询两个模组的兼容性）；定期从远程仓库同步社区维护的兼容性列表。前端在模组详情页显示兼容性标签（"已知兼容"/"可能冲突"/"未知"）；安装模组时自动检查与已安装模组的兼容性并提示。
- **预期解决的问题**: 不知道模组之间是否兼容，安装后才发现冲突导致崩溃；缺少兼容性信息的集中来源。
- **关联模块**: src-tauri/src/modrinth.rs, 新增后端模块 src-tauri/src/compatibility.rs

### 4.9 其他功能扩展（8项）

### FE-43 成就系统完善

- **优先级**: P3
- **类别**: 其他
- **改进内容**: 完善成就系统，定义完整的成就列表，实现成就解锁通知和展示页面。当前 commands/achievement.rs 已有 `get_achievements` 和 `unlock_achievement` 命令框架，但成就定义不完整，前端缺少展示。
- **技术实现建议**: 定义成就列表：首次启动游戏（"初次启动"）、安装10个模组（"模组爱好者"）、游玩100小时（"资深矿工"）、创建5个实例（"多面手"）、完成一次联机（"社交达人"）、使用快照版本（"先锋测试者"）、完成首次模组开发（"开发者"）等；每个成就定义 `id`、`name`、`description`、`icon`、`condition`（触发条件函数）、`rarity`（common/rare/epic/legendary）；成就解锁时通过 `app.emit()` 发送通知事件；成就数据持久化到 `achievements.json`。前端实现成就展示页面（网格卡片布局，未解锁为灰色剪影，已解锁为彩色图标）；解锁通知（Toast + 动画效果）；成就进度条（如"已安装 7/10 个模组"）。
- **预期解决的问题**: 缺少游戏化激励机制，用户缺少探索和使用的动力；成就系统框架已有但功能不完整。
- **关联模块**: src-tauri/src/commands/achievement.rs

### FE-44 系统托盘集成

- **优先级**: P2
- **类别**: 其他
- **改进内容**: 实现系统托盘集成，关闭窗口时最小化到托盘而非退出，支持托盘菜单快速操作和后台下载继续。当前关闭窗口时应用直接退出。
- **技术实现建议**: 集成 `tauri-plugin-tray`（Tauri v2 的系统托盘 API）：在 tauri.conf.json 中配置托盘图标和菜单项；在 lib.rs 的 `run()` 中注册托盘插件和事件处理；拦截窗口关闭事件，改为隐藏窗口（`window.hide()`）；托盘菜单项包括：显示主窗口、快速启动最近实例、下载状态、退出应用；托盘图标动态变化（下载进行中显示下载图标，游戏运行中显示游戏图标）；后台下载任务在窗口隐藏时继续执行。
- **预期解决的问题**: 关闭窗口后下载中断；缺少快速启动游戏的入口；每次操作都需要打开主窗口。
- **关联模块**: src-tauri/tauri.conf.json, src-tauri/src/lib.rs

### FE-45 多账户快速切换

- **优先级**: P2
- **类别**: 其他
- **改进内容**: 添加账户快速切换功能，在顶部栏显示当前账户头像，点击弹出下拉菜单可快速切换账户。当前账户切换需进入设置页面，步骤较多。
- **技术实现建议**: 前端在 AppShell 的顶部栏右侧添加账户头像组件：点击弹出下拉菜单，显示所有已登录账户列表（头像+用户名+账户类型标签）；当前账户高亮标识；点击其他账户直接切换（调用 `set_active_account`）；下拉菜单底部添加"添加账户"和"管理账户"链接。账户头像从 Minecraft Profile API 获取（微软账户）或 Yggdrasil 皮肤站获取（外置登录账户），缓存到本地。
- **预期解决的问题**: 账户切换不便，需要进入设置页面操作；无法快速查看当前登录的账户。
- **关联模块**: src/components/AppShell.tsx, src/stores/authStore.tsx

### FE-46 键盘快捷键系统

- **优先级**: P2
- **类别**: 其他
- **改进内容**: 实现全局键盘快捷键系统，定义常用操作的快捷键映射，支持快捷键自定义和冲突检测。当前 useKeyboardShortcuts.ts 和 useKeyboard.ts 已有基础实现，但快捷键定义不完整且不支持自定义。
- **技术实现建议**: 定义默认快捷键映射：`Cmd/Ctrl+K` 打开搜索面板、`Cmd/Ctrl+N` 新建实例、`Cmd/Ctrl+,` 打开设置、`Cmd/Ctrl+L` 启动游戏、`Cmd/Ctrl+D` 打开下载面板、`Cmd/Ctrl+1~9` 切换侧边栏页面；实现快捷键自定义界面（记录快捷键组合，保存到 localStorage）；冲突检测（新快捷键与已有快捷键冲突时提示）；全局快捷键通过 Tauri 的 `GlobalShortcut` 插件注册（应用未聚焦时也能响应）。统一 useKeyboard.ts 和 useKeyboardShortcuts.ts 的导出命名，消除当前的同名导出冲突。
- **预期解决的问题**: 操作效率低，所有操作都需要鼠标点击；缺少键盘驱动的快速操作方式。
- **关联模块**: src/hooks/useKeyboardShortcuts.ts, src/hooks/useKeyboard.ts

### FE-47 剪贴板智能识别

- **优先级**: P3
- **类别**: 其他
- **改进内容**: 实现剪贴板智能识别功能，自动识别剪贴板中的 Minecraft 服务器地址、Modrinth/CurseForge 链接等，并弹出操作建议。
- **技术实现建议**: 前端实现剪贴板监听器（使用 `navigator.clipboard.readText()` API，在窗口获得焦点时检查剪贴板变化）；定义识别规则：Minecraft 服务器地址（正则 `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b` 或域名+端口格式）、Modrinth 链接（`modrinth.com/mod/{slug}`）、CurseForge 链接（`curseforge.com/minecraft/mc-mods/{slug}`）、分享码（特定格式的实例配置分享码）；识别到匹配内容后弹出操作建议浮窗（如"检测到服务器地址，是否添加到服务器列表？"）；用户可关闭自动识别或添加白名单。
- **预期解决的问题**: 从网页复制链接后需手动在启动器中搜索；服务器地址需要手动输入。
- **关联模块**: 新增前端模块 src/hooks/useClipboardWatcher.ts

### FE-48 游戏版本快照支持

- **优先级**: P2
- **类别**: 其他
- **改进内容**: 添加 Minecraft 快照版本的支持，允许用户在版本浏览器中选择和安装快照版本。当前 version/resolver.rs 解析版本清单时可能过滤了快照版本。
- **技术实现建议**: 后端修改版本清单解析逻辑，保留 `type: "snapshot"` 的版本条目；在 `GameInstance` 中添加 `is_snapshot: bool` 标记；快照版本创建实例时显示警告提示（"快照版本可能不稳定，可能导致世界存档损坏"）；快照版本自动推荐对应的 JRE 版本（最新快照通常需要最新版 Java）；添加 `enable_snapshots` 配置项（默认关闭，需用户主动开启）。前端在 VersionsPage 中添加"显示快照"开关；快照版本以不同颜色标识（如黄色标签）；创建快照实例时显示二次确认对话框。
- **预期解决的问题**: 无法体验最新的 Minecraft 快照版本；快照玩家需要使用官方启动器。
- **关联模块**: src-tauri/src/version/resolver.rs, src-tauri/src/commands/version.rs, src/pages/VersionsPage.tsx

### FE-49 本地模组文件安装

- **优先级**: P2
- **类别**: 其他
- **改进内容**: 支持直接安装本地下载的 `.jar` 模组文件和 `.mrpack` 整合包文件，通过文件选择器或拖拽方式安装。当前仅支持从 Modrinth/CurseForge 在线安装。
- **技术实现建议**: 后端添加 `install_from_file` 命令：接受文件路径和目标实例 ID 参数；自动检测文件类型（`.jar` 为模组，`.mrpack` 为整合包，`.zip` 需进一步判断）；`.jar` 文件：解析 `fabric.mod.json`/`mods.toml` 获取模组元数据，复制到实例的 `mods/` 目录，记录到 `installed_content.json`；`.mrpack` 文件：复用现有的 `import_modpack` 逻辑；安装前兼容性检查（模组的 Minecraft 版本要求与实例版本是否匹配）；支持批量文件安装。前端在 LibraryPage 和 InstanceDetailPage 中添加"从文件安装"按钮和拖拽区域。
- **预期解决的问题**: 手动安装模组需要找到 `mods/` 目录并复制文件，操作繁琐；无法在启动器内管理本地下载的模组文件。
- **关联模块**: src-tauri/src/instance/manager.rs, src-tauri/src/commands/instance.rs

### FE-50 数据导出与迁移

- **优先级**: P3
- **类别**: 其他
- **改进内容**: 实现启动器数据的完整导出导入功能，支持跨设备迁移配置、账户信息、实例列表等数据。
- **技术实现建议**: 后端添加 `export_data`/`import_data` 命令：`export_data` 将配置文件（`config.json`）、账户信息（脱敏处理，仅导出账户名和类型，不导出 Token）、实例元数据（`instances.json`，不含游戏文件本身）、收藏列表（`collections.json`）、成就数据（`achievements.json`）打包为加密压缩包（使用 AES-256-GCM 加密，用户设置导出密码）；`import_data` 解密并导入数据，合并策略（跳过已存在的实例、覆盖/保留配置选项）；添加迁移向导（检测新设备上的 Java 环境、磁盘空间等）。前端实现数据导出向导（选择导出内容 → 设置密码 → 选择保存位置）和导入向导（选择文件 → 输入密码 → 预览导入内容 → 确认导入）。
- **预期解决的问题**: 换电脑后需重新配置所有设置和实例；缺少启动器数据的备份和恢复机制。
- **关联模块**: 新增后端模块 src-tauri/src/migration.rs, src-tauri/src/config.rs, src-tauri/src/security/crypto.rs

---

## 5. 代码质量改进（15项）

### 5.1 错误处理（4项）

### CQ-01 LauncherError 变体细化

- **优先级**: P1
- **类别**: 错误处理
- **改进内容**: 细化 `LauncherError` 枚举变体，消除 `Other(String)` 万能变体的滥用，添加专用变体使前端能够差异化处理不同类型的错误。当前 error.rs 中的 `Other(String)` 变体被广泛使用，前端无法根据错误类型展示不同的 UI 反馈。
- **技术实现建议**: 添加专用变体替代 `Other` 的常见用法：`AuthExpired(String)`（认证过期，前端可自动触发刷新）、`RateLimited { retry_after: Option<u64> }`（API 限流，前端可显示倒计时）、`NetworkUnreachable`（网络不可达，前端可显示网络检查建议）、`DiskFull { path: String, required: u64, available: u64 }`（磁盘已满，前端可显示清理建议）、`ModConflict { mod_a: String, mod_b: String, reason: String }`（模组冲突，前端可显示冲突详情）、`VersionIncompatible { required: String, actual: String }`（版本不兼容）、`InstanceLocked(String)`（实例被锁定）；逐步替换所有 `Other(...)` 使用为专用变体（全局搜索 `LauncherError::Other` 并逐一替换）；添加 `error_code(&self) -> &str` 方法返回标准化错误码（如 `AUTH_EXPIRED`、`RATE_LIMITED`）；保留 `Other` 变体但标记为 `#[deprecated]` 鼓励使用专用变体。
- **预期解决的问题**: 前端无法根据错误类型展示不同 UI（如认证过期应自动刷新而非显示错误提示）；错误信息不够具体，用户难以理解问题原因。
- **关联模块**: src-tauri/src/error.rs

### CQ-02 错误链与上下文传播

- **优先级**: P2
- **类别**: 错误处理
- **改进内容**: 为错误添加上下文信息和错误链，使调试时能够追溯错误的根本原因。当前错误处理中 `?` 操作符直接传播底层错误，丢失了"在做什么时出错"的上下文信息。
- **技术实现建议**: 为 `LauncherError` 实现 `std::error::Error` trait（当前已通过 `thiserror` 的 `#[error(...)]` 派生自动实现）；为不实现 `Error` trait 的错误类型添加手动 `From` 实现，附带上下文信息（如 `From<reqwest::Error> for LauncherError` 改为在转换时添加 URL 和请求方法上下文）；在关键错误转换点使用 `.map_err(|e| LauncherError::Xxx(format!("context: {}", e)))` 模式添加上下文；在日志记录中输出完整错误链（`tracing::error!(error = ?err, "operation failed")`，`?` 格式化输出 Debug 信息包含错误链）；考虑引入 `anyhow` 用于内部错误传播，仅在 Tauri 命令边界转换为 `LauncherError`。
- **预期解决的问题**: 调试时无法追溯错误来源，仅看到最终错误信息而不知道是哪个操作触发的；日志中缺少错误上下文，排查问题效率低。
- **关联模块**: src-tauri/src/error.rs, src-tauri/src/（所有模块的错误处理）

### CQ-03 前端错误边界

- **优先级**: P1
- **类别**: 错误处理
- **改进内容**: 添加 React Error Boundary 组件，防止单个组件的渲染错误导致整个应用白屏崩溃。当前 App.tsx 缺少 Error Boundary 包裹，任何组件的 JavaScript 错误都会导致整个应用不可用。
- **技术实现建议**: 创建 `ErrorBoundary` 组件（基于 React 的 `componentDidCatch` 和 `getDerivedStateFromError` 生命周期）：捕获渲染错误后显示友好的回退 UI（包含错误描述、重试按钮、错误详情折叠区域）；在关键层级添加 Error Boundary：`App` 根组件包裹全局 Error Boundary（回退 UI 为全屏错误页面）、每个路由页面包裹页面级 Error Boundary（回退 UI 为页面内错误提示，保留侧边栏导航）、`DownloadPanel` 等关键浮层组件独立包裹；错误信息记录到 logger.ts 的日志系统；生产环境隐藏错误堆栈详情，开发环境显示完整堆栈。使用类组件实现（React 的 Error Boundary 仅支持类组件），或使用 `react-error-boundary` 库的函数式 API。
- **预期解决的问题**: 组件异常导致整个应用白屏崩溃，用户无法恢复只能重启；缺少优雅降级机制。
- **关联模块**: src/App.tsx, 新增组件 src/components/ui/ErrorBoundary.tsx

### CQ-04 前后端错误类型同步

- **优先级**: P2
- **类别**: 错误处理
- **改进内容**: 实现前后端错误类型的结构化同步，后端 `LauncherError` 序列化后前端能精确匹配错误类型，而非通过字符串匹配推断。当前 error.rs 的 `Serialize` 实现仅输出 `{type, message}`，前端 errorMapping.ts 通过字符串匹配推断错误类型，脆弱且易出错。
- **技术实现建议**: 后端增强 `LauncherError` 的序列化格式为 `{type: "AuthFailed", code: "AUTH_FAILED", message: "...", suggestion: "请重新登录", details: {...}}`：`type` 为变体名（已有）、`code` 为标准化错误码（新增，通过 `error_code()` 方法获取）、`suggestion` 为用户友好的修复建议（新增，通过 `suggestion()` 方法获取）、`details` 为变体特定的结构化数据（新增，如 `DiskFull` 的 `required`/`available` 字段）。前端定义对应的 TypeScript 类型：`type LauncherError = { type: string; code: string; message: string; suggestion?: string; details?: Record<string, unknown> }`；更新 errorMapping.ts 使用 `code` 字段匹配而非字符串推断；为每种错误码定义专门的 UI 处理逻辑（如 `AUTH_EXPIRED` 自动刷新、`RATE_LIMITED` 显示倒计时）。
- **预期解决的问题**: 前端错误处理代码脆弱，依赖字符串匹配容易因后端错误消息变化而失效；缺少结构化的错误信息，前端无法展示针对性的修复建议。
- **关联模块**: src-tauri/src/error.rs, src/utils/errorMapping.ts, src/utils/errorMap.ts

### 5.2 类型安全（3项）

### CQ-05 消除 TypeScript any 类型

- **优先级**: P2
- **类别**: 类型安全
- **改进内容**: 消除前端代码中的 TypeScript `any` 类型使用，为所有 IPC 命令定义精确的返回类型，启用 `noImplicitAny` 编译选项。当前 api/ 模块中部分返回类型使用 `any`，失去了编译期类型检查保护。
- **技术实现建议**: 第一步：全局搜索 `any` 类型使用（`grep -r ": any" src/` 和 `grep -r "as any" src/`），建立清理清单；第二步：为每个 Tauri `invoke` 调用定义精确的返回类型接口（如 `invoke<ModProjectFull>('get_mod_details', ...)` 而非 `invoke<any>`）；第三步：使用 `zod` 库为关键 API 响应添加运行时验证（`z.object({...}).parse(result)`），确保后端返回数据符合前端预期；第四步：在 `tsconfig.json` 中启用 `noImplicitAny: true` 和 `strict: true`；第五步：逐步修复所有类型错误（优先修复 `api/` 模块，再处理组件中的 `any`）。
- **预期解决的问题**: 类型错误在运行时才暴露，编译期无法发现；`any` 类型使 IDE 无法提供有效的代码补全和重构支持。
- **关联模块**: src/api/, tsconfig.json

### CQ-06 前后端类型定义自动生成

- **优先级**: P2
- **类别**: 类型安全
- **改进内容**: 实现从 Rust 结构体自动生成 TypeScript 类型定义，消除手动维护两套类型定义的同步负担。当前前端 TypeScript 接口与后端 Rust 结构体手动维护，容易出现不一致。
- **技术实现建议**: 集成 `ts-rs` crate：在 Cargo.toml 中添加 `ts-rs` 依赖；为所有 Tauri 命令的参数和返回类型结构体派生 `#[derive(TS)]`（如 `GameInstance`、`ModResult`、`ModProjectFull`、`ModVersion` 等）；使用 `ts-rs` 的 `export!` 宏将所有类型导出到 `src-tauri/generated/types.ts`；在 `build.rs` 中自动执行类型导出（编译时生成）；前端通过相对路径引用生成的类型文件；CI 中添加类型同步检查步骤（比较生成的类型与前端使用的类型是否一致）。替代方案：使用 `specta` + `tauri-specta` 从 Tauri 命令自动生成完整的 TypeScript API 绑定。
- **预期解决的问题**: 前后端类型定义不一致导致运行时错误；手动维护两套类型定义工作量大且容易遗漏。
- **关联模块**: src-tauri/Cargo.toml, src/api/types.ts

### CQ-07 Rust newtype 模式增强

- **优先级**: P3
- **类别**: 类型安全
- **改进内容**: 在 Rust 后端引入 newtype 模式，为语义不同的原始类型参数创建专用类型，防止编译期参数混用。当前多个命令参数使用 `String` 类型，如 `instance_id`、`mod_slug`、`version_id` 等，编译器无法区分。
- **技术实现建议**: 定义 newtype 包装类型：`InstanceId(String)`、`ModSlug(String)`、`VersionId(String)`、`UserId(String)`、`FilePath(String)`；每个 newtype 实现 `From<String>` 和 `AsRef<str>` trait 以保持易用性；实现 `Serialize`/`Deserialize` 使其透明序列化为字符串（`#[serde(transparent)]`）；逐步替换 Tauri 命令参数中的原始 `String` 为对应的 newtype（优先替换 `instance_id` 和 `version_id`，这两个最容易被混用）；添加编译期保护：`fn launch_game(instance: InstanceId)` 调用时传入 `VersionId` 会编译错误。
- **预期解决的问题**: 参数传错在编译期无法发现（如把 `version_id` 传给需要 `instance_id` 的函数）；代码可读性差，`String` 类型无法表达参数的语义。
- **关联模块**: src-tauri/src/（所有命令和模块）

### 5.3 测试覆盖（4项）

### CQ-08 后端核心模块单元测试

- **优先级**: P1
- **类别**: 测试
- **改进内容**: 为后端核心模块补充单元测试，当前仅 sanitizer.rs 和 jvm_whitelist.rs 有测试，认证、下载、启动、实例等核心模块零测试覆盖。
- **技术实现建议**: 按优先级补充测试：第一优先级 `auth` 模块（OAuth 流程 mock 测试：使用 `mockito` mock Microsoft OAuth endpoint，测试 device code 获取、token 交换、refresh 流程、过期处理）；第二优先级 `download` 模块（重试逻辑测试：mock HTTP 服务器返回失败响应，验证重试次数和退避策略；SHA1 校验测试：提供已知 SHA1 的测试文件；并发下载测试：验证信号量限制并发数）；第三优先级 `launch` 模块（状态机转换测试：验证所有合法和非法状态转换，`set_state` 应拒绝非法转换，`force_set_state` 允许任意转换；JVM 参数构建测试：验证不同配置下的参数生成）；第四优先级 `instance` 模块（实例 CRUD 测试：使用临时目录作为数据目录，测试创建/读取/更新/删除操作）。测试框架使用 Rust 内置 `#[test]` + `tokio::test`，HTTP mock 使用 `mockito` crate。
- **预期解决的问题**: 代码变更可能引入回归，核心功能缺少自动化验证；重构风险高，无法保证修改后功能正确。
- **关联模块**: src-tauri/src/auth/, src-tauri/src/download/, src-tauri/src/launch/, src-tauri/src/instance/

### CQ-09 前端组件测试

- **优先级**: P2
- **类别**: 测试
- **改进内容**: 为前端核心组件和逻辑添加测试，当前前端测试文件极少，核心组件和 Store 逻辑无测试覆盖。
- **技术实现建议**: 使用 `vitest` + `@testing-library/react` 作为测试框架（与 Vite 生态一致）：优先测试 Store 逻辑（`authStore` 的登录/登出/切换账户 reducer、`downloadStore` 的任务添加/进度更新/完成逻辑、`configStore` 的配置保存/加载逻辑，Store 测试不需要 DOM 渲染，效率高）；其次测试关键组件（`InstallButton` 的安装流程、`CollectionButton` 的收藏切换、`ContentCard` 的渲染和交互）；最后测试 `api/` 模块的缓存逻辑（`cachedInvoke` 的 TTL 缓存和请求去重）。Mock Tauri 的 `invoke` 函数（使用 `vi.mock('@tauri-apps/api/core')`）；组件测试使用 `@testing-library/react` 的 `render` + `screen` + `fireEvent`/`userEvent`。
- **预期解决的问题**: 前端重构风险高，缺少自动化测试保护；Store 逻辑变更可能引入难以发现的 bug。
- **关联模块**: src/stores/, src/components/ui/, src/api/

### CQ-10 集成测试

- **优先级**: P2
- **类别**: 测试
- **改进内容**: 添加前后端集成测试，验证关键用户流程的端到端正确性。当前缺少集成测试，前后端交互问题只能在发布后被用户发现。
- **技术实现建议**: 使用 Tauri 官方推荐的 `tauri-driver` + WebDriver 协议进行集成测试：测试关键用户流程——登录流程（离线登录 → 验证账户列表更新）、创建实例（选择版本 → 配置 → 验证实例创建）、安装模组（搜索 → 选择版本 → 验证下载和安装）、启动游戏（预检查 → 启动 → 验证状态变化）；测试环境使用 mock HTTP 服务器替代真实 API；CI 中在 Linux 容器中运行集成测试（需要 Xvfb 虚拟显示）；测试超时设置合理（单个测试不超过 60 秒）。替代方案：使用 Playwright + Tauri 的 WebView 进行端到端测试（更灵活但配置更复杂）。
- **预期解决的问题**: 前后端交互问题在发布后才发现；缺少端到端的用户流程验证。
- **关联模块**: 新增目录 tests/, src-tauri/

### CQ-11 测试覆盖率目标与 CI 集成

- **优先级**: P2
- **类别**: 测试
- **改进内容**: 建立测试覆盖率度量和目标，集成到 CI 流程中，确保测试质量可度量且持续改进。
- **技术实现建议**: Rust 端集成 `cargo-tarpaulin`（或 `cargo-llvm-cov`，macOS 兼容性更好）：`cargo llvm-cov --html` 生成覆盖率报告；JavaScript 端集成 `c8`（V8 原生覆盖率）：`c8 vitest run` 生成覆盖率报告；CI 中添加覆盖率检查步骤：PR 中显示覆盖率变化（使用 `codecov` 或 `coveralls` 服务）；设置覆盖率目标：核心模块（auth/download/launch/instance）> 80%，其他模块 > 60%，整体 > 50%；覆盖率不达标时 CI 警告但不阻塞（初期），逐步提高门槛；在 README 中展示覆盖率徽章。
- **预期解决的问题**: 测试质量不可度量，无法评估测试的有效性；缺少持续改进测试覆盖的激励机制。
- **关联模块**: CI 配置文件, src-tauri/Cargo.toml, package.json

### 5.4 代码组织（4项）

### CQ-12 dead_code 清理与集成

- **优先级**: P2
- **类别**: 代码组织
- **改进内容**: 清理代码库中标记为 `dead_code` 的代码，评估其用途并决定集成到实际使用或删除。当前 cache.rs、http_client.rs、web_api.rs 等多处代码标记了 `#[allow(dead_code)]`。
- **技术实现建议**: 第一步：全局搜索 `#[allow(dead_code)]` 和 `#[allow(dead_code)]` 标注，建立清单；第二步：逐个评估每个 `dead_code` 的用途——如果是有意预留的 API（如 CurseForge 缓存方法），应集成到实际调用链中；如果是废弃的旧实现，应删除；第三步：优先处理 cache.rs 中的 CF 缓存方法（应被 CurseForge 命令调用），http_client.rs 中的代理客户端构建器（应被代理配置使用）；第四步：移除不再需要的 `#[allow(dead_code)]` 标注，启用编译器对未使用代码的警告。
- **预期解决的问题**: 代码库中存在大量未使用代码，增加维护负担和编译时间；`dead_code` 标注掩盖了潜在的集成缺失。
- **关联模块**: src-tauri/src/cache.rs, src-tauri/src/http_client.rs, src-tauri/src/web_api.rs

### CQ-13 lib.rs Terracotta 命令外移

- **优先级**: P2
- **类别**: 代码组织
- **改进内容**: 将 lib.rs 中直接定义的 8 个 Terracotta 相关命令（`download_terracotta`、`is_terracotta_installed`、`start_terracotta`、`stop_terracotta`、`get_terracotta_state`、`terracotta_set_host`、`terracotta_set_guest`、`terracotta_set_idle`）移至 `commands/terracotta.rs` 模块，遵循其他命令的模块化组织原则。
- **技术实现建议**: 创建 src-tauri/src/commands/terracotta.rs，将 8 个 Terracotta 命令函数移入；`TerracottaState` 结构体移至 `terracotta.rs` 模块或保留在 `lib.rs`（作为公开类型）；在 commands/mod.rs 中添加 `pub mod terracotta;`；更新 lib.rs 的 `invoke_handler` 中的命令路径（`commands::terracotta::download_terracotta` 等）；全局静态变量 `TerracottaState` 通过 `app.manage()` 注册为 Tauri 管理状态（当前已是如此，仅需调整引用路径）。
- **预期解决的问题**: lib.rs 职责过重，同时承担应用初始化、状态管理和 Terracotta 命令定义；违反模块化原则，增加代码阅读和维护难度。
- **关联模块**: src-tauri/src/lib.rs, src-tauri/src/commands/mod.rs

### CQ-14 前端 Store 模块化

- **优先级**: P3
- **类别**: 代码组织
- **改进内容**: 将前端各 Store 文件按功能进一步拆分，降低单文件复杂度，提高可维护性。当前 authStore.tsx、downloadStore.tsx 等文件较大，包含了状态定义、reducer 逻辑和 action 函数。
- **技术实现建议**: 每个 Store 拆分为三个文件：`{storeName}Types.ts`（状态类型定义和 action 类型）、`{storeName}Reducer.ts`（reducer 函数）、`{storeName}Actions.ts`（action 创建函数和副作用逻辑）；以 `authStore` 为例：`authTypes.ts` 导出 `AuthState`、`AuthAction` 类型；`authReducer.ts` 导出 `authReducer` 函数；`authActions.ts` 导出 `login`、`logout`、`switchAccount` 等 action 函数；`index.ts` 导出组合 Hook `useAuthStore()` 整合 reducer 和 actions。这种拆分方式保持了 `useReducer` + Context 的架构不变，仅调整文件组织。
- **预期解决的问题**: Store 文件过大难以维护和审查；状态定义、逻辑和副作用混在一起，职责不清晰。
- **关联模块**: src/stores/

### CQ-15 重复代码消除

- **优先级**: P2
- **类别**: 代码组织
- **改进内容**: 消除代码库中的重复代码，统一实现。当前 format.ts 和 time.ts 存在功能重叠；useKeyboard.ts 和 useKeyboardShortcuts.ts 存在同名导出冲突。
- **技术实现建议**: 第一步：统一 `relativeTime` 函数——time.ts 中的 `relativeTime` 为权威实现，format.ts 中如有类似功能则删除并改为从 `time.ts` 导入；全局搜索 `relativeTime` 的所有引用确保导入路径正确。第二步：解决 hooks 同名导出冲突——审查 useKeyboard.ts 和 useKeyboardShortcuts.ts 的导出，将 `useKeyboardShortcuts` 的导出重命名为 `useShortcutBindings` 以避免命名冲突；合并两个 hook 中重叠的功能。第三步：全局搜索其他重复代码模式（使用 `jscpd` 工具检测代码重复），处理发现的重复。
- **预期解决的问题**: 代码冗余增加维护成本，修改时容易遗漏某个副本；同名导出冲突可能导致运行时错误。
- **关联模块**: src/utils/format.ts, src/utils/time.ts, src/hooks/useKeyboard.ts, src/hooks/useKeyboardShortcuts.ts

---

## 6. 安全加固（10项）

### 6.1 认证安全（3项）

### SEC-01 HTML 清洗器替换为 DOMPurify

- **优先级**: P0
- **类别**: 认证安全
- **改进内容**: 将自定义正则表达式 HTML 清洗器替换为 DOMPurify 库，消除 XSS 风险。项目已安装 `dompurify` 依赖但未使用，当前可能存在使用自定义正则清洗 HTML 的代码路径，正则清洗器无法覆盖所有 XSS 向量（如 `<img src=x onerror=alert(1)>`、`<svg onload=...>`、编码绕过等）。
- **技术实现建议**: 第一步：全局搜索前端代码中的 HTML 清洗逻辑（搜索 `sanitizeHtml`、`sanitize`、`innerHTML`、`dangerouslySetInnerHTML` 等关键词），定位所有自定义清洗实现；第二步：将所有自定义 HTML 清洗替换为 `DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'h4'], ALLOWED_ATTR: ['href', 'target', 'rel'] })`；第三步：配置 DOMPurify 的允许标签和属性白名单（CurseForge 的 changelog 为 HTML 格式，需要渲染基本格式但禁止脚本执行）；第四步：添加 Content Security Policy (CSP) header 作为纵深防御——在 tauri.conf.json 中配置 CSP，禁止 inline script 和 eval；第五步：在所有使用 `dangerouslySetInnerHTML` 的地方添加代码审查注释，确保内容经过 DOMPurify 清洗。
- **预期解决的问题**: 自定义正则 HTML 清洗器存在 XSS 绕过风险，恶意内容可能执行脚本窃取用户数据或执行未授权操作。
- **关联模块**: src/pages/ContentDetailPage.tsx（可能渲染 HTML 格式的 changelog）, src-tauri/tauri.conf.json

### SEC-02 代理密码加密降级修复

- **优先级**: P1
- **类别**: 数据安全
- **改进内容**: 修复代理密码加密失败时静默降级为明文存储的问题。当前 config.rs 中代理密码的加密存储已实现（使用 crypto.rs 的 AES-256-GCM 加密），但加密失败时可能静默降级为明文存储，存在安全隐患。
- **技术实现建议**: 修改密码存储逻辑：加密失败时返回错误而非降级为明文（`encrypt_string()` 返回 `Err` 时，`save_config` 应传播错误而非存储明文）；首次运行时强制初始化加密密钥（在 `lib.rs` 的 `setup` 闭包中检查加密密钥是否已初始化，未初始化则生成并存储）；迁移现有明文密码（启动时检测 `proxy_password` 是否为明文——明文特征为非 base64 编码或解密失败——自动加密并保存）；添加配置校验命令 `validate_config_security`，检查所有敏感字段是否已加密；在设置页面的代理配置区域显示加密状态指示器。
- **预期解决的问题**: 代理密码可能以明文形式存储在配置文件中，任何能读取配置文件的程序都能获取代理密码。
- **关联模块**: src-tauri/src/config.rs, src-tauri/src/security/crypto.rs, src-tauri/src/security/credential_store.rs

### SEC-03 Token 安全存储增强

- **优先级**: P2
- **类别**: 认证安全
- **改进内容**: 将 Microsoft/Yggdrasil 的认证 Token 从 JSON 文件存储迁移到系统 Keychain，防止其他程序读取。当前 Token 存储在 `accounts.json` 文件中，虽然已有加密存储的迁移逻辑（credential_store.rs 的 `migrate_plain_to_encrypted`），但加密文件仍不如系统 Keychain 安全。
- **技术实现建议**: 集成 `keyring` crate（跨平台系统 Keychain 访问：macOS Keychain、Linux Secret Service/gnome-keyring、Windows Credential Manager）：定义 `SecureTokenStore` trait（`save_token`/`load_token`/`delete_token`）；实现 `KeychainTokenStore`（使用 `keyring::Entry` 存储 Token，key 格式为 `com.bonnext.auth.{account_id}`）；实现 `EncryptedFileTokenStore` 作为回退（当系统 Keychain 不可用时使用加密文件存储，复用现有 crypto.rs 的加密功能）；启动时优先尝试 Keychain，失败则回退到加密文件；添加 `migrate_to_keychain` 命令将现有 Token 迁移到 Keychain。前端在安全设置中显示 Token 存储方式（"系统 Keychain" 或 "加密文件"）。
- **预期解决的问题**: Token 存储在文件中可被其他程序读取，即使加密也不如系统 Keychain 安全（Keychain 有额外的访问控制）。
- **关联模块**: src-tauri/src/auth/token_store.rs, src-tauri/src/security/credential_store.rs

### 6.2 数据安全（3项）

### SEC-04 敏感日志脱敏

- **优先级**: P1
- **类别**: 数据安全
- **改进内容**: 实现日志中敏感信息的自动脱敏，防止 Token、密码等敏感信息泄露到日志文件中。当前代码中可能存在将敏感信息记录到日志的情况（如 `tracing::info!("token: {}", token)`），日志文件可能被其他程序读取或上传到问题报告中。
- **技术实现建议**: 定义 `Sensitive<T>` 包装类型（`struct Sensitive<T>(T)`）：实现 `Display` trait 时输出 `***REDACTED***`；实现 `Debug` trait时输出 `Sensitive(***)`；实现 `tracing::Value` 时自动脱敏；审计所有 `tracing::info!`/`tracing::debug!`/`tracing::error!` 调用，将 Token、密码、API Key 等参数包装为 `Sensitive`；添加 `tracing-subscriber` 的 `Layer` 过滤器，对包含特定字段名（`token`、`password`、`secret`、`key`、`auth`）的日志值自动脱敏；在 platform/logger.rs 的日志初始化中注册脱敏过滤器。
- **预期解决的问题**: 日志文件可能包含敏感信息（Token、密码），被其他程序读取或上传到问题报告中导致信息泄露。
- **关联模块**: src-tauri/src/platform/logger.rs, src-tauri/src/（所有使用 tracing 的模块）

### SEC-05 Web API 时序攻击防护

- **优先级**: P2
- **类别**: 数据安全
- **改进内容**: 修复 Web API 的 Token 比对存在的时序攻击风险。当前 web_api.rs 的 `verify_token` 函数使用 `auth == format!("Bearer {}", state.auth_token)` 进行字符串比较，这是简单字符串比较，攻击者可通过响应时间差异逐字符推断 Token 内容。
- **技术实现建议**: 使用常量时间比较替代简单字符串比较：添加 `subtle` crate 依赖（`cargo add subtle`）；修改 `verify_token` 函数使用 `subtle::ConstantTimeEq`：`use subtle::ConstantTimeEq; let expected = format!("Bearer {}", state.auth_token); bool::from(expected.as_bytes().ct_eq(auth.as_bytes()))`；或者使用 HMAC 签名验证方案（更安全但更复杂）：服务端生成随机 nonce，客户端用 Token 作为密钥计算 HMAC-SHA256，服务端验证 HMAC；同时添加请求频率限制（rate limiting）作为额外防护层。
- **预期解决的问题**: 攻击者可通过响应时间差异逐字符推断 Web API 的认证 Token，获取未授权访问。
- **关联模块**: src-tauri/src/web_api.rs

### SEC-06 IPC 命令输入验证

- **优先级**: P2
- **类别**: 数据安全
- **改进内容**: 为所有 Tauri IPC 命令添加输入验证层，防止恶意参数导致的意外行为。当前 security/sanitizer.rs 已实现路径、ID、URL 和通用字符串的清洗函数，但并非所有命令都使用了这些验证。
- **技术实现建议**: 第一步：审计所有 Tauri 命令的参数，建立验证清单（哪些参数需要路径验证、哪些需要 ID 验证、哪些需要长度限制）；第二步：为每个命令添加输入验证——路径参数使用 `sanitize_path`、ID 参数使用 `sanitize_id`、URL 参数使用 `sanitize_url`、自由文本使用 `sanitize_general_string`；第三步：特别关注以下高风险命令：`open_folder`（路径遍历风险）、`import_modpack`（ZIP 炸弹风险，添加解压大小限制）、`launch_game`（JVM 参数注入风险，使用 jvm_whitelist.rs 验证）；第四步：添加参数长度限制（所有字符串参数不超过合理长度，防止缓冲区溢出和 DoS）；第五步：使用 `validator` crate 实现声明式验证（`#[validate(length(max = 256))]`）。
- **预期解决的问题**: 恶意输入可能导致路径遍历、命令注入、ZIP 炸弹等安全漏洞；缺少统一的输入验证层。
- **关联模块**: src-tauri/src/commands/, src-tauri/src/security/sanitizer.rs

### 6.3 通信安全（2项）

### SEC-07 Web API CORS 收紧

- **优先级**: P2
- **类别**: 通信安全
- **改进内容**: 收紧 Web API 的 CORS 配置，限制允许的源为 localhost，添加 CSRF Token 防护。当前 web_api.rs 使用 `tower_http::cors::CorsLayer`，如果配置过宽（允许所有源），恶意网页可通过 CSRF 攻击调用本地 API。
- **技术实现建议**: 修改 CORS 配置：将允许的源限制为 `http://localhost:*` 和 `https://tauri.localhost`（Tauri WebView 的源）；设置 `allow_methods` 仅为 `GET` 和 `POST`；设置 `allow_headers` 仅为 `Authorization` 和 `Content-Type`；添加 CSRF Token 机制——首次启动时生成随机 CSRF Token，API 请求需在 `X-CSRF-Token` header 中携带该 Token；生产环境完全禁用 CORS（Web API 仅供本地 Tauri WebView 访问，不需要跨域）；添加 `cors_mode` 配置项（`strict`/`development`/`disabled`）。
- **预期解决的问题**: 恶意网页可通过 CSRF 攻击调用本地 Web API，获取实例信息或执行未授权操作。
- **关联模块**: src-tauri/src/web_api.rs

### SEC-08 下载完整性校验增强

- **优先级**: P2
- **类别**: 通信安全
- **改进内容**: 增强下载文件的完整性校验，当 SHA1 校验值不可用时使用 SHA256 作为备选，对关键文件强制校验。当前 download/verifier.rs 在 SHA1 校验值缺失时可能跳过校验，存在中间人攻击风险。
- **技术实现建议**: 实现多级校验策略：第一优先级 SHA1（当前已实现）；第二优先级 SHA256（当 SHA1 不可用时，从版本清单的 `sha256` 字段获取或从 Modrinth API 获取）；第三优先级文件大小校验（仅校验文件大小是否匹配，最低安全级别）；关键文件强制校验（`authlib-injector.jar`、版本主 jar、加载器 jar 等关键文件必须通过 SHA1 或 SHA256 校验，校验失败直接拒绝使用）；添加 `mark_untrusted` 机制——未通过哈希校验的文件标记为不可信，在 UI 中显示警告；添加 `verify_all_downloads` 命令，批量校验已下载文件的完整性。
- **预期解决的问题**: 下载文件可能被中间人篡改，缺少完整性校验的文件存在安全风险；关键文件（如认证库）被篡改可能导致账户泄露。
- **关联模块**: src-tauri/src/download/verifier.rs, src-tauri/src/download/queue.rs

### 6.4 进程与供应链安全（2项）

### SEC-09 JVM 命令注入防护

- **优先级**: P1
- **类别**: 进程安全
- **改进内容**: 增强 JVM 参数构建中的用户输入验证，防止恶意参数注入。当前 jvm_whitelist.rs 已实现基于前缀白名单的 JVM 参数验证，但白名单可能不够全面，且部分危险参数（如 `-agentpath`、`-javaagent`）需要更细粒度的验证。
- **技术实现建议**: 增强 JVM 参数白名单：添加更多允许的前缀（如 `-Dminecraft.applet.TargetDirectory=`、`-Djava.library.path=` 等 Minecraft 启动必需参数）；对 `-javaagent` 参数进行路径验证（仅允许指向实例目录下的已知模组 jar，使用 `sanitize_path` 验证路径）；对 `-agentpath` 参数进行严格限制（仅允许指向已知路径的 agent 库）；过滤所有可能执行任意代码的参数（`-agentlib:jdwp` 仅在调试模式下允许，`-Xrunjdwp` 同理）；参数值中的特殊字符转义（防止 shell 注入，虽然 Tauri 使用 `std::process::Command` 不经过 shell，但仍需防范参数注入）；添加 `validate_jvm_args_strict` 命令，返回验证结果和被过滤的参数列表。
- **预期解决的问题**: 恶意 JVM 参数可能执行任意代码（如 `-javaagent` 加载恶意 agent）、访问敏感系统资源、或绕过安全限制。
- **关联模块**: src-tauri/src/security/jvm_whitelist.rs, src-tauri/src/launch/args.rs

### SEC-10 依赖安全审计自动化

- **优先级**: P2
- **类别**: 供应链安全
- **改进内容**: 实现依赖安全漏洞的自动化检测，在 CI 中集成 Rust 和 JavaScript 的安全审计工具。当前缺少自动化的依赖安全检测，依赖漏洞可能在发布后才被发现。
- **技术实现建议**: Rust 端集成 `cargo-audit`：在 CI pipeline 中添加 `cargo audit` 步骤，检查 `Cargo.lock` 中已知漏洞的依赖（基于 RustSec Advisory Database）；设置允许的漏洞等级阈值（`critical` 和 `high` 级别漏洞阻塞合并，`medium` 和 `low` 级别发出警告）；JavaScript 端集成 `npm audit`：在 CI 中运行 `pnpm audit --audit-level=high`，高级别漏洞阻塞合并；添加 `pnpm audit` 的例外配置（`.npmrc` 中设置已知且可接受的漏洞）；PR 中显示新增漏洞（对比主分支的审计结果）；定期（每周）运行完整审计并生成报告；考虑集成 `Snyk` 或 `Dependabot` 实现自动化的依赖更新和漏洞修复。
- **预期解决的问题**: 依赖漏洞在发布后才发现，可能已被攻击者利用；缺少持续的安全审计机制。
- **关联模块**: CI 配置文件, src-tauri/Cargo.toml, package.json

---

## 7. 实施路线图

### 7.1 第一阶段：紧急修复（1-2周）

本阶段聚焦于影响用户安全和基本可用性的 P0 和关键 P1 问题，确保应用的核心功能可靠运行。

**安全修复**：

- SEC-01（P0）：HTML 清洗器替换为 DOMPurify，消除 XSS 风险
- SEC-02（P1）：代理密码加密降级修复，防止明文密码存储
- SEC-04（P1）：敏感日志脱敏，防止 Token 和密码泄露到日志
- SEC-09（P1）：JVM 命令注入防护增强，防止恶意参数执行任意代码

**错误处理**：

- CQ-01（P1）：LauncherError 变体细化，使前端能差异化处理错误
- CQ-03（P1）：前端 Error Boundary，防止单组件崩溃导致白屏

**测试**：

- CQ-08（P1）：后端核心模块单元测试，覆盖 auth/download/launch 模块

**核心功能**：

- FE-28（P1）：应用自动更新，确保用户使用最新版本
- FE-29（P1）：多 JRE 版本管理，解决 Java 版本兼容性问题

**验收标准**：所有 P0 问题修复完成；P1 关键问题修复率 ≥ 80%；核心模块测试覆盖率 ≥ 30%；通过安全扫描无高危漏洞。

### 7.2 第二阶段：核心增强（3-6周）

本阶段聚焦于用户体验优化、性能提升和核心功能扩展，显著提升应用的可用性和稳定性。

**功能扩展**：

- FE-01（P1）：实例快照与回滚
- FE-07（P1）：模组依赖图可视化
- FE-12（P1）：下载暂停/恢复

**安全加固**：

- SEC-02（P1）：代理密码加密降级修复（如第一阶段未完成）
- SEC-04（P1）：敏感日志脱敏（如第一阶段未完成）

**代码质量**：

- CQ-01（P1）：LauncherError 变体细化（继续推进）
- CQ-04（P2）：前后端错误类型同步
- CQ-05（P2）：消除 TypeScript any 类型
- CQ-12（P2）：dead_code 清理与集成

**验收标准**：所有 P1 问题修复完成；核心模块测试覆盖率 ≥ 50%；新增功能均有对应测试；代码审查通过率 100%。

### 7.3 第三阶段：体验提升（7-12周）

本阶段聚焦于用户体验完善、性能优化和功能扩展，全面提升应用的竞争力。

**功能扩展**（P2 优先级）：

- FE-02~FE-06：实例管理增强（复制模板、分组标签、导入增强、健康检查、存档管理）
- FE-08~FE-11：内容管理增强（版本锁定、资源包管理、推荐引擎）
- FE-13~FE-17：下载安装增强（更新日志、批量安装、回滚、Quilt/NeoForge）
- FE-19~FE-20：多人联机增强（服务器列表、房间管理）
- FE-22~FE-27：数据统计与核心功能（皮肤管理、时长趋势、截图管理、崩溃分析、成功率追踪、日志查看器等）
- FE-30~FE-33：启动器核心（Java 预设、文件浏览器、日志查看器、启动检查）
- FE-44~FE-46、FE-48~FE-49：其他功能（托盘集成、账户切换、快捷键、快照支持、本地安装）

**代码质量**（P2 优先级）：

- CQ-02：错误链与上下文传播
- CQ-06：前后端类型定义自动生成
- CQ-09：前端组件测试
- CQ-10：集成测试
- CQ-11：测试覆盖率目标与 CI 集成
- CQ-13：lib.rs Terracotta 命令外移
- CQ-15：重复代码消除

**安全加固**（P2 优先级）：

- SEC-03：Token 安全存储增强
- SEC-05：Web API 时序攻击防护
- SEC-06：IPC 命令输入验证
- SEC-07：Web API CORS 收紧
- SEC-08：下载完整性校验增强
- SEC-10：依赖安全审计自动化

**验收标准**：所有 P2 问题修复完成；整体测试覆盖率 ≥ 60%；性能指标达到路线图上篇 PERF 系列条目的目标；安全扫描无中危及以上漏洞。

### 7.4 第四阶段：生态完善（13-20周）

本阶段聚焦于生态完善、长尾功能实现和代码质量收尾，将应用打磨到生产级品质。

**功能扩展**（P3 优先级）：

- FE-09：模组配置编辑器
- FE-18：好友系统
- FE-21：游戏内聊天桥接
- FE-24：模组使用率统计
- FE-34~FE-38：平台集成深化（Modrinth/CurseForge/皮肤站/Discord/微软皮肤）
- FE-39~FE-42：开发者工具（模组模板、日志分析、兼容性数据库）
- FE-43：成就系统完善
- FE-47：剪贴板智能识别
- FE-50：数据导出与迁移

**代码质量**（P3 优先级）：

- CQ-07：Rust newtype 模式增强
- CQ-14：前端 Store 模块化

**验收标准**：所有条目完成或明确延后；整体测试覆盖率 ≥ 70%；文档完整度 ≥ 90%；用户满意度调研达标。

---

## 8. 结论

### 8.1 整体价值

本路线图共规划 120 项改进（UX 优化 30 项 + 性能优化 20 项 + 功能扩展 45 项 + 代码质量 15 项 + 安全加固 10 项），覆盖了 BonNext 项目从用户体验到底层安全的全方位提升。这些改进的核心价值体现在以下维度：

**安全性**：10 项安全加固措施从认证安全、数据安全、通信安全到供应链安全构建了纵深防御体系。特别是 SEC-01（DOMPurify 替换）和 SEC-09（JVM 注入防护）两项 P0/P1 级别修复，直接消除了 XSS 和命令注入两个高危攻击面，为用户数据和系统安全提供了基础保障。

**可用性**：30 项 UX 优化和 45 项功能扩展大幅提升了应用的易用性和功能完整度。从实例快照回滚到模组依赖图可视化，从下载暂停恢复到多 JRE 版本管理，每一项改进都针对真实用户痛点，使 BonNext 从"能用"进化为"好用"。

**可靠性**：15 项代码质量改进从错误处理、类型安全、测试覆盖到代码组织，系统性地提升了代码库的健康度。特别是 CQ-08（后端核心模块单元测试）和 CQ-03（前端 Error Boundary）两项 P1 级别改进，直接降低了生产环境的故障率。

**性能**：20 项性能优化从启动速度、内存管理、渲染性能到网络优化，确保应用在大规模模组包和高频操作场景下依然流畅响应。

### 8.2 关键里程碑

| 里程碑       | 时间节点 | 核心交付物                  | 验收标准                             |
| ------------ | -------- | --------------------------- | ------------------------------------ |
| M1：安全基线 | 第2周末  | SEC-01/02/04/09 修复完成    | 无高危安全漏洞                       |
| M2：核心可用 | 第6周末  | FE-28/29 + CQ-01/03/08 完成 | 自动更新可用；核心模块测试 ≥ 50%     |
| M3：体验升级 | 第12周末 | P2 功能扩展 + 代码质量改进  | 所有 P2 条目完成；测试覆盖率 ≥ 60%   |
| M4：生态完善 | 第20周末 | 全部120项改进完成或明确延后 | 整体测试覆盖率 ≥ 70%；用户满意度达标 |

### 8.3 资源建议

**人力配置**：

- Rust 后端开发 2 人：负责安全加固、核心功能扩展和性能优化
- React 前端开发 2 人：负责 UX 优化、功能扩展前端实现和组件测试
- 全栈开发 1 人：负责前后端集成、API 层重构和集成测试
- QA 1 人：负责测试用例编写、自动化测试维护和质量把关

**技术债务处理原则**：

- 每个迭代分配 20% 时间处理技术债务（代码质量改进项）
- 新功能开发必须包含对应测试（测试覆盖率门槛）
- 安全问题优先级高于功能需求（P0 安全问题阻塞发布）

**风险与缓解**：

- 风险：Tauri v2 生态不成熟，部分插件（updater、tray）可能存在兼容性问题 → 缓解：提前进行技术验证，准备备选方案
- 风险：大规模重构可能引入回归 → 缓解：先补充测试再重构，CI 门禁确保质量
- 风险：功能范围过大导致交付延期 → 缓解：严格按优先级排序，P3 条目可延后到后续版本

---

## 附录

### 附录A：条目索引表（按优先级排序）

#### P0 级别（1项）

| 编号   | 标题                        | 类别     |
| ------ | --------------------------- | -------- |
| SEC-01 | HTML 清洗器替换为 DOMPurify | 认证安全 |

#### P1 级别（11项）

| 编号   | 标题                   | 类别       |
| ------ | ---------------------- | ---------- |
| CQ-01  | LauncherError 变体细化 | 错误处理   |
| CQ-03  | 前端错误边界           | 错误处理   |
| CQ-08  | 后端核心模块单元测试   | 测试       |
| FE-01  | 实例快照与回滚         | 实例管理   |
| FE-07  | 模组依赖图可视化       | 内容管理   |
| FE-12  | 下载暂停/恢复          | 内容管理   |
| FE-28  | 应用自动更新           | 启动器核心 |
| FE-29  | 多 JRE 版本管理        | 启动器核心 |
| SEC-02 | 代理密码加密降级修复   | 数据安全   |
| SEC-04 | 敏感日志脱敏           | 数据安全   |
| SEC-09 | JVM 命令注入防护       | 进程安全   |

#### P2 级别（47项）

| 编号   | 标题                       | 类别       |
| ------ | -------------------------- | ---------- |
| CQ-02  | 错误链与上下文传播         | 错误处理   |
| CQ-04  | 前后端错误类型同步         | 错误处理   |
| CQ-05  | 消除 TypeScript any 类型   | 类型安全   |
| CQ-06  | 前后端类型定义自动生成     | 类型安全   |
| CQ-09  | 前端组件测试               | 测试       |
| CQ-10  | 集成测试                   | 测试       |
| CQ-11  | 测试覆盖率目标与 CI 集成   | 测试       |
| CQ-12  | dead_code 清理与集成       | 代码组织   |
| CQ-13  | lib.rs Terracotta 命令外移 | 代码组织   |
| CQ-15  | 重复代码消除               | 代码组织   |
| FE-02  | 实例复制与模板             | 实例管理   |
| FE-03  | 实例分组与标签             | 实例管理   |
| FE-04  | 实例导入增强               | 实例管理   |
| FE-05  | 实例健康检查               | 实例管理   |
| FE-06  | 世界存档管理               | 实例管理   |
| FE-08  | 模组版本锁定               | 内容管理   |
| FE-10  | 资源包与光影包管理增强     | 内容管理   |
| FE-11  | 内容推荐引擎               | 内容管理   |
| FE-13  | 模组更新日志查看           | 内容管理   |
| FE-14  | 下载队列优先级管理         | 下载管理   |
| FE-15  | 批量安装与依赖自动解析     | 下载管理   |
| FE-16  | 安装失败自动回滚           | 下载管理   |
| FE-17  | Quilt/NeoForge 加载器支持  | 下载管理   |
| FE-19  | 服务器列表与快速加入       | 多人联机   |
| FE-20  | 联机房间管理增强           | 多人联机   |
| FE-22  | 皮肤管理增强               | 多人联机   |
| FE-23  | 游戏时长趋势图             | 数据统计   |
| FE-25  | 截图管理增强               | 数据统计   |
| FE-26  | 崩溃报告智能分析           | 数据统计   |
| FE-27  | 启动成功率追踪             | 数据统计   |
| FE-30  | Java 参数预设管理          | 启动器核心 |
| FE-31  | 游戏目录文件浏览器         | 启动器核心 |
| FE-32  | 游戏日志实时查看器         | 启动器核心 |
| FE-33  | 启动前检查增强             | 启动器核心 |
| FE-34  | Modrinth 深度集成          | 平台集成   |
| FE-35  | CurseForge 深度集成        | 平台集成   |
| FE-36  | 皮肤站深度集成             | 平台集成   |
| FE-40  | 调试启动模式               | 开发者工具 |
| FE-44  | 系统托盘集成               | 其他       |
| FE-45  | 多账户快速切换             | 其他       |
| FE-46  | 键盘快捷键系统             | 其他       |
| FE-48  | 游戏版本快照支持           | 其他       |
| FE-49  | 本地模组文件安装           | 其他       |
| SEC-03 | Token 安全存储增强         | 认证安全   |
| SEC-05 | Web API 时序攻击防护       | 数据安全   |
| SEC-06 | IPC 命令输入验证           | 数据安全   |
| SEC-07 | Web API CORS 收紧          | 通信安全   |
| SEC-08 | 下载完整性校验增强         | 通信安全   |
| SEC-10 | 依赖安全审计自动化         | 供应链安全 |

#### P3 级别（14项）

| 编号  | 标题                       | 类别       |
| ----- | -------------------------- | ---------- |
| CQ-07 | Rust newtype 模式增强      | 类型安全   |
| CQ-14 | 前端 Store 模块化          | 代码组织   |
| FE-09 | 模组配置编辑器             | 内容管理   |
| FE-18 | 好友系统                   | 社交       |
| FE-21 | 游戏内聊天桥接             | 多人联机   |
| FE-24 | 模组使用率统计             | 数据统计   |
| FE-37 | Discord Rich Presence 增强 | 平台集成   |
| FE-38 | Microsoft 账户皮肤管理     | 平台集成   |
| FE-39 | 模组开发模板               | 开发者工具 |
| FE-41 | 日志分析工具               | 开发者工具 |
| FE-42 | 模组兼容性数据库           | 开发者工具 |
| FE-43 | 成就系统完善               | 其他       |
| FE-47 | 剪贴板智能识别             | 其他       |
| FE-50 | 数据导出与迁移             | 其他       |

### 附录B：条目依赖关系图

以下列出关键条目间的依赖关系，箭头表示"依赖于"（前置条件）：

```
SEC-01 (DOMPurify) ← SEC-07 (CORS收紧，纵深防御)
CQ-01 (错误变体细化) ← CQ-04 (前后端错误同步，需要先定义错误码)
CQ-06 (类型自动生成) ← CQ-05 (消除any，类型生成后可替换any)
CQ-08 (后端测试) ← CQ-10 (集成测试，单元测试是集成测试的基础)
CQ-08 (后端测试) ← CQ-11 (覆盖率目标，需要先有测试才能度量覆盖率)
FE-12 (下载暂停/恢复) ← FE-14 (优先级管理，共享下载队列重构)
FE-15 (批量安装依赖解析) ← FE-07 (依赖图可视化，共享依赖解析逻辑)
FE-17 (Quilt/NeoForge) ← FE-40 (调试启动，新加载器需支持调试模式)
FE-28 (自动更新) ← FE-44 (托盘集成，更新后可能需要托盘通知)
FE-29 (多JRE管理) ← FE-33 (启动前检查，JRE匹配是检查项之一)
SEC-09 (JVM注入防护) ← FE-40 (调试启动，调试模式需白名单放行JDWP)
```

### 附录C：参考文献

[1] OWASP Foundation. OWASP Top Ten Web Application Security Risks[EB/OL]. (2021-03-20)[2026-05-30]. https://owasp.org/www-project-top-ten/.

[2] RustSec Advisory Database[DB/OL]. (2026)[2026-05-30]. https://rustsec.org/.

[3] Tauri. Tauri v2 Security Architecture[EB/OL]. (2025)[2026-05-30]. https://v2.tauri.app/security/.

[4] Mozilla. Content Security Policy (CSP)[EB/OL]. (2026)[2026-05-30]. https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP.

[5] HEISKANEN S. Constant-Time Comparison for Authentication Tokens[J]. ACM Computing Surveys, 2023, 55(3): 1-28.

[6] Modrinth. Modrinth API v2 Documentation[EB/OL]. (2026)[2026-05-30]. https://docs.modrinth.com/.

[7] CurseForge. CurseForge Core API Documentation[EB/OL]. (2026)[2026-05-30]. https://docs.curseforge.com/.

[8] Microsoft. Microsoft Identity Platform and OAuth 2.0 Device Code Flow[EB/OL]. (2026)[2026-05-30]. https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code.

[9] Eclipse Foundation. Adoptium — Eclipse Temurin JRE Distribution[EB/OL]. (2026)[2026-05-30]. https://adoptium.net/.

[10] React. Error Boundaries — React Documentation[EB/OL]. (2026)[2026-05-30]. https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary.

[11] DOMPurify. DOMPurify — XSS Sanitizer for HTML, SVG, and MathML[EB/OL]. (2026)[2026-05-30]. https://github.com/cure53/DOMPurify.

[12] ts-rs. ts-rs — Generate TypeScript declarations from Rust types
