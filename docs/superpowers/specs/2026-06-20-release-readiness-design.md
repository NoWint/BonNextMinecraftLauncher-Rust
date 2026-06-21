# BonNext v1.0.0 发布就绪设计

**日期**: 2026-06-20
**状态**: 已批准
**作者**: Brainstorming Session
**目标版本**: 1.0.0（首个正式稳定版）
**GitHub 仓库**: NoWint/BonNextMinecraftLauncher-Rust

## 1. 概述

BonNext 当前版本 0.0.6，准备发布为首个正式稳定版 1.0.0。经全面调研，项目在架构、错误处理、i18n、a11y、主题系统方面表现优秀，但存在若干发布前需解决的问题。本设计按优先级分层修复，确保"完整、好用、耐用、实用、好看"的发布标准。

### 1.1 发布决策

| 决策项 | 选择 |
|--------|------|
| 发布定位 | 正式稳定版 |
| 版本号 | 升级到 1.0.0 |
| 自动更新 | 启用，对接 GitHub Releases |
| 代码签名 | 暂不签名，README/Release 说明绕过方式 |
| 社交功能 | 未暴露，记录为已知限制 |
| 测试范围 | 补充核心流程测试 |
| 发布方案 | 优先级分层单次发布（P0+P1+P2） |

### 1.2 不在本次范围

- 代码签名（需证书，后续版本）
- 大文件拆分（InstanceDetailPage 1495 行、settings/index.tsx 1790 行）
- tokio::fs 转换（plugin_proxy.rs 30 处 std::fs）
- 移动端适配（桌面应用，仅支持窗口缩放）

## 2. P0：发布基础设施

### 2.1 启用 GitHub Releases 自动更新

**问题**：`tauri.conf.json` 中 updater 完全禁用（`active: false`、`endpoints: []`、`pubkey: ""`），但后端 `check_for_updates`/`install_update` 命令已实现，用户调用会失败。

**方案**：对接 GitHub Releases 作为更新源。

**改动点**：

1. **生成签名密钥对**（本地一次性操作）：
   ```bash
   pnpm tauri signer generate -w ~/.tauri/bonnext.key
   ```
   - 私钥 → GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`
   - 密码 → GitHub Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - 公钥 → 写入 `tauri.conf.json`

2. **配置 `src-tauri/tauri.conf.json`**：
   ```json
   "bundle": {
     "createUpdaterArtifacts": true
   },
   "plugins": {
     "updater": {
       "active": true,
       "endpoints": [
         "https://github.com/NoWint/BonNextMinecraftLauncher-Rust/releases/latest/download/latest.json"
       ],
       "pubkey": "<生成的公钥>"
     }
   }
   ```

3. **修改 `.github/workflows/release.yml`**：
   - 版本计算改为 `1.0.N` 序列（或手动指定 1.0.0）
   - 三个构建 job 添加环境变量 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - `pnpm tauri build` 会自动签名 updater artifacts（配置 pubkey 后）
   - release job 生成 `latest.json` 清单（含各平台签名、下载 URL、版本号），与构建产物一起上传到 GitHub Release
   - latest.json 格式遵循 Tauri updater 规范

4. **前端更新检查 UI**：
   - 确认设置页有"检查更新"入口调用 `check_for_updates`
   - 检查结果通过 toast 反馈（有更新/已是最新/检查失败）
   - `install_update` 触发下载安装并重启

### 2.2 无签名用户说明

**问题**：无代码签名，macOS/Windows 首次运行有安全警告。

**方案**：诚实告知用户绕过方式。

**改动点**：

1. **README.md** 新增"安装说明"章节：
   - **macOS**：首次打开右键 → 打开（或系统偏好设置 → 安全性与隐私 → 仍要打开）
   - **Windows**：SmartScreen → "更多信息" → "仍要运行"
   - 说明为何有警告（未购买开发者证书签名）

2. **release.yml** 的 Release body 模板添加同样的绕过说明

3. **应用内首次启动**（可选）：首次运行 toast 提示"未签名应用，如遇安全警告请参考 README 说明"

## 3. P1：关键修复

### 3.1 同步 CHANGELOG.md

**问题**：CHANGELOG 记录了 `[0.2.0]` 和 `[0.1.0]`，但实际版本是 `0.0.6`；`[Unreleased]` 段内容与实际功能不符。

**改动**：
- 重写 CHANGELOG.md，版本号体系统一为 `1.0.0`
- `[1.0.0] - 2026-06-XX` 段记录本次发布全部变更
- 从 git log 提取 0.0.3 → 0.0.6 的历史变更记录
- `[Unreleased]` 段留空
- 同步 `SECURITY.md` 支持版本表：`0.1.x` → `1.0.x`

### 3.2 核心流程测试

**问题**：前端仅 11 个测试文件（stores/hooks/utils），无页面和 UI 组件测试。

**新增测试文件**：

| 测试文件 | 覆盖内容 |
|---------|---------|
| `src/shells/zzz/pages/__tests__/LoginPage.test.tsx` | 离线登录、访客模式、表单验证、错误反馈、加载状态 |
| `src/shells/zzz/pages/__tests__/NewInstancePage.test.tsx` | 模板选择、版本加载、加载器选择、创建实例、错误提示 |
| `src/shells/zzz/pages/__tests__/HomePage.test.tsx` | 启动状态机映射、空状态、快速启动、错误 toast |
| `src/shells/zzz/components/ui/__tests__/InstallButton.test.tsx` | 版本获取、依赖解析、下载队列集成 |
| `src/shells/zzz/components/ui/__tests__/Modal.test.tsx` | 焦点陷阱、Escape 关闭、焦点恢复、模态栈、aria 属性 |
| `src/shells/zzz/components/ui/__tests__/DownloadPanel.test.tsx` | 任务列表、暂停/恢复/取消、速度格式化、空状态 |
| `src/shells/zzz/pages/__tests__/ContentDetailPage.test.tsx` | 加载/错误/未找到状态、版本列表、DOMPurify 净化 |
| `src/shared/utils/__tests__/errorMapping.test.ts` | 补充错误类型映射边界用例 |

**测试策略**：
- mock Tauri `invoke`（使用现有 `src/test/setup.ts`）
- 使用现有 `src/test/test-utils.tsx` 渲染组件
- 聚焦用户交互流程（点击、输入、状态变化），而非内部实现细节
- 使用 `@testing-library/react` 的 `screen`、`fireEvent`/`userEvent`

### 3.3 DownloadPanel i18n

**问题**：`DownloadPanel.tsx` 的 `STATUS_LABELS`（pending/downloading/paused/complete/failed/cancelled）和 header 文本硬编码英文。

**改动**：
- `src/shared/i18n/zh-CN.ts` 和 `en-US.ts` 添加键：
  - `download.status.pending` / `download.status.downloading` / `download.status.paused` / `download.status.complete` / `download.status.failed` / `download.status.cancelled`
  - `download.panel.title` / `download.panel.active` / `download.panel.completed` / `download.panel.empty` / `download.panel.clearCompleted` / `download.panel.speed` / `download.panel.eta`
- `DownloadPanel.tsx` 改用 `t()` 函数
- Unicode emoji `⬇` 改用项目 Icon 系统（lucide-react 的 Download 图标）

### 3.4 NewInstancePage 静默错误

**问题**：版本加载 `.catch(() => {})` 和加载器版本加载失败静默吞错，用户无感知。

**改动**：
- 版本加载失败 → `addToast({ type: 'error', title: t('instance.create.versionLoadError') })` + 重试按钮
- 加载器版本加载失败 → `addToast({ type: 'error', title: t('instance.create.loaderVersionLoadError') })` + 下拉框显示"加载失败"
- 移除 `.catch(() => {})`，改为 `.catch((e) => { logger.error(...); addToast(...) })`
- 添加对应 i18n 键

### 3.5 p2p.rs TODO 文档化

**改动**：
- `src-tauri/src/social/p2p.rs:165` TODO 注释补充：社交功能未在 1.0.0 release 暴露，签名验证待社交功能上线前实现
- Release Notes 记录为已知限制

## 4. P2：质量打磨

### 4.1 响应式断点

**问题**：除设置页外，核心页面无媒体查询，最小窗口 960×640 下复杂页面可能拥挤。

**改动**：
- 为核心页面 CSS Module 添加断点：
  - `@media (max-width: 1200px)`：中等屏幕，网格列数减少、侧边栏紧凑
  - `@media (max-width: 960px)`：最小窗口，单列布局、隐藏次要装饰元素
- 优先处理页面：
  - `HomePage.module.css`（Hero + 实例列表 + 服务器监控 + 游戏时长）
  - `InstancesPage.module.css`（Hero + 列表 + 过滤栏）
  - `MarketplacePage.module.css`（网格 + 侧边分类）
  - `InstanceDetailPage.module.css`（Tab 布局 + 内容区）
- 不做移动端适配（桌面应用，窗口缩放即可）

### 4.2 引导 data-tour 目标修复

**问题**：OnboardingWizard 的 Quick Start 引用 `data-tour="home-new-instance"` 和 `data-tour="home-play"`，但 HomePage 未添加这些属性。

**改动**：
- `HomePage.tsx` 的"新建实例"按钮添加 `data-tour="home-new-instance"`
- `HomePage.tsx` 的"启动"按钮添加 `data-tour="home-play"`
- 验证 Quick Start 5 步流程（home-new-instance → new-name → new-version → new-create → home-play）能正确高亮

### 4.3 LoginPage 内联样式

**问题**：LoginPage 多处使用内联 `style={}` 违反 CSS Modules 规范。

**改动**：
- 创建 `src/shells/zzz/pages/LoginPage.module.css`
- 将内联样式提取为 CSS 类，保持现有视觉效果不变
- LoginPage.tsx 改用 `styles.xxx`

### 4.4 VersionsPage 空状态

**问题**：版本列表为空（API 返回空或过滤无结果）时页面空白。

**改动**：
- 添加空状态组件（图标 + 标题 + 描述 + 重试按钮）
- 区分"无数据"（API 返回空）和"过滤无结果"（过滤后为空）两种情况
- 复用现有空状态视觉风格（与其他页面一致）

### 4.5 InstancesPage 骨架屏

**问题**：加载实例时无 Skeleton 反馈，仅有 error 文本。

**改动**：
- 加载状态使用 `CardSkeleton`（与 HomePage/LibraryPage 一致）
- 复用现有 `src/shells/zzz/components/ui/Skeleton.tsx` 的 `CardSkeleton` 组件
- 保持视觉一致性

### 4.6 安全审计改阻断式

**问题**：`.github/workflows/security-audit.yml` 中 `cargo audit || true` 和 `continue-on-error: true` 导致漏洞不阻断 CI。

**改动**：
- 移除 `|| true` 和 `continue-on-error: true`
- `cargo audit` 发现漏洞时 CI 失败
- `pnpm audit --audit-level=high` 同样改为阻断式
- 可选：配置忽略特定非关键漏洞（通过 `audit.toml` 或 `.npmrc`）

### 4.7 生产构建移除 console.log

**问题**：44 处 `console.*` 跨 15 文件，生产构建应移除。

**改动**：
- `vite.config.ts` 的 `esbuild` 配置添加 `pure` 选项，移除 `console.log`/`console.debug`/`console.info`，保留 `console.error`/`console.warn`（全局错误处理需要）：
  ```typescript
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info'],
  }
  ```
- 此配置仅在 `build`（生产构建）时生效，`dev` 模式下 console 正常输出

## 5. 版本号同步

将以下文件的版本号从 `0.0.6` 改为 `1.0.0`：
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

`release.yml` 的版本计算逻辑改为 `1.0.N` 序列。

## 6. 验证流程

### 6.1 本地编译运行查看效果

每完成一层后，本地运行查看效果：
```bash
pnpm tauri dev    # 开发模式运行，查看 UI 效果
```

### 6.2 分层验证

| 层级 | 验证方式 |
|------|---------|
| P0 | `cargo check` + 本地 `pnpm tauri build` 生成 updater artifacts + 手动测试更新检查 |
| P1 | `npx tsc --noEmit` + `npx vitest run`（含新测试）+ `cargo test` + 手动测试登录/创建实例/启动 |
| P2 | `npx tsc --noEmit` + `npx vitest run` + 手动缩放窗口测试响应式 + 手动走引导流程 |
| 最终 | 全量 `pnpm build` + `cargo build --manifest-path src-tauri/Cargo.toml` + 三平台 release.yml dry-run |

### 6.3 发布前手动 QA 清单

- [ ] 离线登录 → 创建实例 → 下载版本 → 启动游戏 全流程
- [ ] Microsoft 登录流程（如有账号）
- [ ] 模组安装 → 依赖解析 → 下载 → 安装到实例
- [ ] 主题切换（dark/light/OLED）无视觉异常
- [ ] 窗口缩放至最小 960×640 无布局崩溃
- [ ] 引导流程（Quick Start + Detailed Tour）正常高亮
- [ ] 检查更新功能（需先发布一个版本才能测试）
- [ ] 中英文切换无缺失翻译

## 7. 发布流程

1. **版本号同步**：`package.json` / `tauri.conf.json` / `Cargo.toml` 全部改为 `1.0.0`
2. **CHANGELOG**：整理 1.0.0 变更记录
3. **本地验证**：`pnpm tauri dev` 查看效果 + 全量测试通过
4. **提交**：`git commit -m "release: v1.0.0"` + `git tag v1.0.0`
5. **触发 release.yml**：手动触发 GitHub Actions
   - 三平台构建 + 签名 updater artifacts + 生成 latest.json + 创建 GitHub Release
6. **验证更新**：在旧版本（0.0.6）中检查更新，确认能检测到 1.0.0 并下载安装
7. **Release Notes** 包含：
   - 新功能列表
   - 修复列表
   - 已知限制（无签名、社交功能未启用）
   - 安装绕过说明（macOS/Windows）

## 8. 已知限制（Release Notes 中声明）

- **无代码签名**：macOS/Windows 首次运行有安全警告，需手动绕过（README 附指引）
- **社交/P2P 功能未启用**：代码存在但 UI 未暴露，签名验证待后续版本
- **响应式有限**：支持 960×640 及以上窗口，未适配移动端
- **自动更新首次启用**：1.0.0 之前的版本无法自动更新到 1.0.0（updater 未配置），用户需手动下载

## 9. 实施顺序

```
P0-1 自动更新配置 → P0-2 无签名说明 → P1-1 CHANGELOG → P1-2 测试 →
P1-3 i18n → P1-4 静默错误 → P1-5 p2p文档 → P2-1 响应式 →
P2-2 引导修复 → P2-3 内联样式 → P2-4 空状态 → P2-5 骨架屏 →
P2-6 安全审计 → P2-7 console.log → 版本号同步 → 本地验证 → 发布
```

每步完成后运行 `pnpm tauri dev` 查看效果，确保改动符合预期。
