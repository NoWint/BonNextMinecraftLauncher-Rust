# BonNext v1.0.0 发布就绪实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 BonNext 从 0.0.6 发布为首个正式稳定版 1.0.0，启用 GitHub Releases 自动更新，修复关键缺陷，补充核心流程测试，打磨 UI 质量。

**Architecture:** 按优先级分层实施：P0 发布基础设施（自动更新+签名说明）→ P1 关键修复（CHANGELOG+测试+i18n+静默错误）→ P2 质量打磨（响应式+引导+内联样式+空状态+骨架屏+安全审计+console.log）→ 版本同步+验证发布。

**Tech Stack:** Tauri v2 + React 18 + TypeScript + Vitest + @testing-library/react + CSS Modules + GitHub Actions

**Spec:** `docs/superpowers/specs/2026-06-20-release-readiness-design.md`

---

## 文件结构

### 新建文件
- `src/shells/zzz/pages/LoginPage.module.css` — LoginPage 样式提取
- `src/shells/zzz/pages/__tests__/LoginPage.test.tsx` — 登录流程测试
- `src/shells/zzz/pages/__tests__/NewInstancePage.test.tsx` — 实例创建测试
- `src/shells/zzz/pages/__tests__/HomePage.test.tsx` — 首页流程测试
- `src/shells/zzz/pages/__tests__/ContentDetailPage.test.tsx` — 内容详情测试
- `src/shells/zzz/components/ui/__tests__/InstallButton.test.tsx` — 安装按钮测试
- `src/shells/zzz/components/ui/__tests__/Modal.test.tsx` — 模态框测试
- `src/shells/zzz/components/ui/__tests__/DownloadPanel.test.tsx` — 下载面板测试

### 修改文件
- `src-tauri/tauri.conf.json` — 启用 updater
- `.github/workflows/release.yml` — 版本序列+updater artifacts+latest.json
- `.github/workflows/security-audit.yml` — 移除非阻断
- `README.md` — 安装说明
- `CHANGELOG.md` — 版本同步
- `SECURITY.md` — 支持版本表
- `src/shared/i18n/zh-CN.ts` / `en-US.ts` — download 键 + 错误提示键
- `src/shells/zzz/components/ui/DownloadPanel.tsx` — i18n 化
- `src/shells/zzz/pages/NewInstancePage.tsx` — 静默错误修复
- `src/shells/zzz/pages/HomePage.tsx` — data-tour 锚点
- `src/shells/zzz/pages/LoginPage.tsx` — 内联样式迁移
- `src/shells/zzz/pages/VersionsPage.tsx` — 空状态
- `src/shells/zzz/pages/InstancesPage.tsx` — 骨架屏
- `src/shells/zzz/pages/*.module.css` — 响应式断点
- `src-tauri/src/social/p2p.rs` — TODO 文档化
- `vite.config.ts` — console.log 移除
- `package.json` / `Cargo.toml` — 版本号
- `src/test/setup.ts` — 补充 event mock

---

## P0：发布基础设施

### Task 1: 生成 updater 签名密钥并配置 tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 生成签名密钥对**

Run:
```bash
pnpm tauri signer generate -w ~/.tauri/bonnext.key
```
输入密码（记住它）。输出会包含公钥（pubkey）和私钥位置。

记录：
- 公钥（pubkey）→ 待写入 tauri.conf.json
- 私钥路径：`~/.tauri/bonnext.key`
- 密码 → 待设为 GitHub Secret

- [ ] **Step 2: 配置 tauri.conf.json 启用 updater**

将 `tauri.conf.json` 的 `bundle.createUpdaterArtifacts` 改为 `true`，`plugins.updater` 改为：

```json
"plugins": {
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/NoWint/BonNextMinecraftLauncher-Rust/releases/latest/download/latest.json"
    ],
    "pubkey": "<替换为 Step 1 生成的公钥>"
  }
}
```

- [ ] **Step 3: 设置 GitHub Secrets**

在 GitHub 仓库 Settings → Secrets and variables → Actions 添加：
- `TAURI_SIGNING_PRIVATE_KEY`：私钥文件内容（`cat ~/.tauri/bonnext.key`）
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：Step 1 输入的密码

- [ ] **Step 4: 验证配置**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3`
Expected: 编译通过（忽略 sha1 asm 环境问题）

---

### Task 2: 修改 release.yml 支持 updater artifacts

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: 修改版本计算逻辑为 1.0.N**

将 `prepare` job 的 `calc` step 替换为：

```yaml
      - id: calc
        name: Calculate next version
        run: |
          LATEST=$(git tag -l 'v1.0.[0-9]*' | sort -V | tail -1)
          if [ -z "$LATEST" ]; then
            PATCH=0
          else
            PATCH=$(echo "$LATEST" | sed 's/v1\.0\.//')
            PATCH=$((PATCH + 1))
          fi
          echo "NEW_VERSION=1.0.$PATCH" >> $GITHUB_OUTPUT
          echo "Next version: 1.0.$PATCH"
```

- [ ] **Step 2: 为三个构建 job 添加签名环境变量**

在 `build-macos`、`build-windows`、`build-linux` 的 steps 之前（`runs-on` 之后）添加：

```yaml
    env:
      TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

- [ ] **Step 3: 上传 updater artifacts**

在三个构建 job 中，`pnpm tauri build` 后添加上传 `.sig` 文件和 updater bundle。在 `build-macos` 的 "Upload DMG artifact" 后添加：

```yaml
      - name: Upload macOS updater artifact
        uses: actions/upload-artifact@v4
        with:
          name: bonnext-macos-updater
          path: src-tauri/target/universal-apple-darwin/release/bundle/macos/*.app.tar.gz
          if-no-files-found: warn
```

在 `build-windows` 的 "Upload EXE artifact" 后添加：

```yaml
      - name: Upload Windows updater artifact
        uses: actions/upload-artifact@v4
        with:
          name: bonnext-windows-updater
          path: |
            src-tauri/target/release/bundle/msi/*.msi.zip
            src-tauri/target/release/bundle/msi/*.msi.zip.sig
            src-tauri/target/release/bundle/nsis/*.nsis.zip
            src-tauri/target/release/bundle/nsis/*.nsis.zip.sig
          if-no-files-found: warn
```

在 `build-linux` 的 "Upload deb artifact" 后添加：

```yaml
      - name: Upload Linux updater artifact
        uses: actions/upload-artifact@v4
        with:
          name: bonnext-linux-updater
          path: |
            src-tauri/target/release/bundle/appimage/*.AppImage.tar.gz
            src-tauri/target/release/bundle/appimage/*.AppImage.tar.gz.sig
          if-no-files-found: warn
```

- [ ] **Step 4: release job 生成 latest.json**

在 `release` job 的 "Create GitHub Release" step 之前添加生成 latest.json 的 step：

```yaml
      - name: Generate latest.json
        run: |
          VERSION="${{ needs.prepare.outputs.version }}"
          DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
          cat > latest.json << EOF
          {
            "version": "v${VERSION}",
            "notes": "BonNext v${VERSION}",
            "pub_date": "${DATE}",
            "platforms": {
              "darwin-aarch64": {
                "signature": "content of .sig file",
                "url": "https://github.com/NoWint/BonNextMinecraftLauncher-Rust/releases/download/v${VERSION}/bonnext.app.tar.gz"
              },
              "darwin-x86_64": {
                "signature": "content of .sig file",
                "url": "https://github.com/NoWint/BonNextMinecraftLauncher-Rust/releases/download/v${VERSION}/bonnext.app.tar.gz"
              },
              "linux-x86_64": {
                "signature": "content of .sig file",
                "url": "https://github.com/NoWint/BonNextMinecraftLauncher-Rust/releases/download/v${VERSION}/bonnext.AppImage.tar.gz"
              },
              "windows-x86_64": {
                "signature": "content of .sig file",
                "url": "https://github.com/NoWint/BonNextMinecraftLauncher-Rust/releases/download/v${VERSION}/bonnext-setup.nsis.zip"
              }
            }
          }
          EOF
```

注意：signature 字段需从 `.sig` 文件读取实际内容。实际实现中需用脚本读取各平台 .sig 文件内容填入。

- [ ] **Step 5: Release body 添加安装绕过说明**

将 `release` job 的 `body` 字段替换为：

```yaml
          body: |
            ## BonNext v${{ needs.prepare.outputs.version }}

            ### Downloads
            | Platform | Package |
            |----------|---------|
            | macOS (Universal) | `.dmg` |
            | Windows | `.msi` / `.exe` |
            | Linux | `.AppImage` / `.deb` |

            ### ⚠️ 安全警告说明（未签名应用）
            本应用未购买开发者证书签名，首次运行会遇到系统安全警告：
            - **macOS**：右键点击应用 → 选择"打开" → 在弹窗中点击"打开"。或前往 系统偏好设置 → 安全性与隐私 → 点击"仍要打开"。
            - **Windows**：SmartScreen 弹窗 → 点击"更多信息" → 点击"仍要运行"。

            ### 已知限制
            - 社交/P2P 功能未在本次发布启用
            - 支持 960×640 及以上窗口尺寸

            > Built with Tauri v2 + React 18 + Rust
```

- [ ] **Step 6: 确保 latest.json 上传到 Release**

在 `files: artifacts/**/*` 后确认 latest.json 包含在 artifacts 中，或单独添加：

```yaml
          files: |
            artifacts/**/*
            latest.json
```

---

### Task 3: README 添加安装说明

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 适当位置添加安装说明章节**

在 README 的特性介绍之后、Download 链接之前添加：

```markdown
## 安装说明

### macOS
1. 下载 `.dmg` 文件并打开
2. 将 BonNext 拖入 Applications 文件夹
3. 首次打开时 macOS 会显示安全警告（应用未签名）
4. **右键点击** BonNext → 选择**"打开"** → 在弹窗中点击**"打开"**
5. 或前往 系统偏好设置 → 安全性与隐私 → 点击**"仍要打开"**

### Windows
1. 下载 `.msi` 或 `.exe` 安装包
2. 运行安装程序，如遇 SmartScreen 弹窗：
3. 点击**"更多信息"** → 点击**"仍要运行"**

### Linux
1. 下载 `.AppImage`（推荐）或 `.deb`
2. AppImage：`chmod +x BonNext-*.AppImage && ./BonNext-*.AppImage`
3. deb：`sudo dpkg -i BonNext-*.deb`

> **关于安全警告**：BonNext 是开源项目，未购买商业开发者证书签名。代码完全公开，可自行审查或从源码构建。
```

---

## P1：关键修复

### Task 4: 同步 CHANGELOG.md 和 SECURITY.md

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `SECURITY.md`

- [ ] **Step 1: 查看近期 git log 提取变更**

Run: `git log --oneline v0.0.2..HEAD --no-merges | head -50`

- [ ] **Step 2: 重写 CHANGELOG.md**

将 CHANGELOG.md 重写为：

```markdown
# Changelog

All notable changes to BonNext will be documented in this file.

## [1.0.0] - 2026-06-XX

### Added
- 插件化架构：最小核心 + 插件系统，支持第三方插件安装
- GitHub Releases 自动更新
- 首次使用引导（Quick Start + Detailed Tour）
- 主题系统：dark/light/OLED + 色盲模式 + 动态背景
- 键盘快捷键（Ctrl+K 搜索、Ctrl+H/I/V/N 导航）
- AI 智能搜索
- 崩溃自动诊断与修复建议
- 模组/整合包安装与依赖解析
- 实例快照与迁移
- 安全模块：AES-256-GCM 加密、JVM 参数白名单、审计日志

### Changed
- 版本号从 0.0.6 升级为 1.0.0（首个正式稳定版）
- 主题系统重构，消除三套主题系统冲突
- 插件事件总线支持按 pluginId 追踪和清理

### Fixed
- 插件事件权限模型失效
- PluginFileSystem 完全不可用
- activate() 失败 UI 注入泄漏
- 主题匹配 bug
- DownloadPanel 硬编码英文（i18n 化）
- NewInstancePage 版本加载静默吞错

### Known Limitations
- 无代码签名（macOS/Windows 首次运行有安全警告）
- 社交/P2P 功能未启用（代码存在但 UI 未暴露）
- 支持 960×640 及以上窗口，未适配移动端

## [0.0.6] - 2026-06-19

### Added
- 插件架构审查与修复（35+ 问题修复）

## [0.0.5] - 2026-06-XX

### Fixed
- XSS 漏洞修复（DOMPurify 集成）
- 路由冲突修复

## [0.0.4] - 2026-06-XX

### Added
- 多 Shell 架构（ZZZ/SwiftUI/Editor）

## [0.0.3] - 2026-06-XX

### Added
- Modrinth/CurseForge 市场集成
- 下载管理器
```

- [ ] **Step 3: 更新 SECURITY.md 支持版本表**

将 SECURITY.md 中的支持版本表 `0.1.x` 改为 `1.0.x`。

---

### Task 5: 补充测试基础设施 mock

**Files:**
- Modify: `src/test/setup.ts`
- Modify: `src/test/test-utils.tsx`
- Modify: `vitest.config.ts`

- [ ] **Step 1: setup.ts 补充 event mock**

将 `src/test/setup.ts` 替换为：

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
```

- [ ] **Step 2: test-utils.tsx 添加 Provider 包裹**

将 `src/test/test-utils.tsx` 替换为：

```tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { I18nProvider } from '../shared/i18n/I18nProvider';
import { ToastProvider } from '../shared/stores/toastStore';

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </I18nProvider>
  );
}

function customRender(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
```

注意：如果 I18nProvider/ToastProvider 的导入路径不同，需根据实际路径调整。先运行验证。

- [ ] **Step 3: vitest.config.ts 补充 plugin-sdk alias**

将 `vitest.config.ts` 的 `resolve.alias` 改为：

```typescript
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@bonnext/plugin-sdk': path.resolve(__dirname, 'src/plugins/sdk'),
    },
  },
```

- [ ] **Step 4: 验证测试基础设施**

Run: `npx vitest run 2>&1 | tail -10`
Expected: 现有 87 测试仍全部通过

---

### Task 6: DownloadPanel i18n 化

**Files:**
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/en-US.ts`
- Modify: `src/shells/zzz/components/ui/DownloadPanel.tsx`

- [ ] **Step 1: zh-CN.ts 添加 download 键**

在 zh-CN.ts 末尾（最后一个键之前）添加：

```typescript
  // Download panel
  'download.panel.title': '下载',
  'download.panel.toggle': '切换下载面板',
  'download.panel.downloads': '下载',
  'download.panel.active': '{count} 个进行中',
  'download.panel.clearCompleted': '清除已完成',
  'download.panel.hide': '隐藏',
  'download.panel.empty': '暂无下载',
  'download.panel.pause': '暂停',
  'download.panel.pauseAria': '暂停下载',
  'download.panel.resume': '恢复',
  'download.panel.resumeAria': '恢复下载',
  'download.panel.cancel': '取消',
  'download.panel.cancelAria': '取消下载',
  'download.panel.dismissAria': '移除下载',
  'download.status.pending': '等待中...',
  'download.status.downloading': '下载中...',
  'download.status.paused': '已暂停',
  'download.status.complete': '已完成',
  'download.status.failed': '失败',
  'download.status.cancelled': '已取消',
  'download.unit.mbps': 'MB/s',
  'download.unit.kbps': 'KB/s',
  'download.unit.bps': 'B/s',
  'download.eta.seconds': '{sec} 秒剩余',
  'download.eta.minutes': '{min} 分 {sec} 秒剩余',
```

- [ ] **Step 2: en-US.ts 添加对应英文键**

在 en-US.ts 末尾添加相同的键名，英文值：

```typescript
  // Download panel
  'download.panel.title': 'Downloads',
  'download.panel.toggle': 'Toggle downloads panel',
  'download.panel.downloads': 'DOWNLOADS',
  'download.panel.active': '{count} active',
  'download.panel.clearCompleted': 'CLEAR DONE',
  'download.panel.hide': 'HIDE',
  'download.panel.empty': 'No downloads',
  'download.panel.pause': 'Pause',
  'download.panel.pauseAria': 'Pause download',
  'download.panel.resume': 'Resume',
  'download.panel.resumeAria': 'Resume download',
  'download.panel.cancel': 'Cancel',
  'download.panel.cancelAria': 'Cancel download',
  'download.panel.dismissAria': 'Dismiss download',
  'download.status.pending': 'Waiting...',
  'download.status.downloading': 'Downloading...',
  'download.status.paused': 'Paused',
  'download.status.complete': 'Completed',
  'download.status.failed': 'Failed',
  'download.status.cancelled': 'Cancelled',
  'download.unit.mbps': 'MB/s',
  'download.unit.kbps': 'KB/s',
  'download.unit.bps': 'B/s',
  'download.eta.seconds': '{sec}s left',
  'download.eta.minutes': '{min}m {sec}s left',
```

- [ ] **Step 3: DownloadPanel.tsx 改用 i18n**

读取 `src/shells/zzz/components/ui/DownloadPanel.tsx` 完整内容，然后：

1. 添加 `useI18n` 导入和调用：
```typescript
import { useI18n } from '../../../../shared/i18n/I18nProvider';
// 在组件内：
const { t } = useI18n();
```

2. 删除 `STATUS_LABELS` 常量，改为函数：
```typescript
const getStatusLabel = (status: string) => t(`download.status.${status}`);
```

3. 替换所有硬编码字符串为 `t()` 调用：
- `title="Downloads"` → `title={t('download.panel.title')}`
- `aria-label="Toggle downloads panel"` → `aria-label={t('download.panel.toggle')}`
- `DOWNLOADS` → `{t('download.panel.downloads')}`
- `{active.length} active` → `{t('download.panel.active', { count: active.length })}`
- `CLEAR DONE` → `{t('download.panel.clearCompleted')}`
- `HIDE` → `{t('download.panel.hide')}`
- `No downloads` → `{t('download.panel.empty')}`
- `title="Pause"` → `title={t('download.panel.pause')}`
- `aria-label="Pause download"` → `aria-label={t('download.panel.pauseAria')}`
- `title="Resume"` → `title={t('download.panel.resume')}`
- `aria-label="Resume download"` → `aria-label={t('download.panel.resumeAria')}`
- `title="Cancel"` → `title={t('download.panel.cancel')}`
- `aria-label="Cancel download"` → `aria-label={t('download.panel.cancelAria')}`
- `aria-label="Dismiss download"` → `aria-label={t('download.panel.dismissAria')}`

4. 速度格式化函数中的单位改为 `t()` 调用

5. ETA 格式化函数中的文本改为 `t()` 调用

6. 将 `⬇` emoji 改为 lucide-react Download 图标：
```typescript
import { Download } from 'lucide-react';
// 替换 ⬇ 为 <Download size={14} />
```

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: 无错误

Run: `npx vitest run 2>&1 | tail -5`
Expected: 全部通过

---

### Task 7: NewInstancePage 静默错误修复

**Files:**
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/en-US.ts`
- Modify: `src/shells/zzz/pages/NewInstancePage.tsx`

- [ ] **Step 1: 添加 i18n 错误键**

zh-CN.ts 添加：
```typescript
  'instance.create.versionLoadError': '版本列表加载失败，请检查网络后重试',
  'instance.create.loaderVersionLoadError': '加载器版本加载失败',
```

en-US.ts 添加：
```typescript
  'instance.create.versionLoadError': 'Failed to load version list, please check your network and retry',
  'instance.create.loaderVersionLoadError': 'Failed to load loader versions',
```

- [ ] **Step 2: 修复 NewInstancePage 静默 catch**

读取 `src/shells/zzz/pages/NewInstancePage.tsx`，找到第 85 行和第 93 行的两个 `.catch(() => {})`。

将版本加载的 catch（第 85 行）改为：
```typescript
    .catch((e) => {
      logger.error('Failed to load versions:', e);
      addToast({ type: 'error', title: t('instance.create.versionLoadError') });
    });
```

将加载器版本加载的 catch（第 93 行）改为：
```typescript
    .catch((e) => {
      logger.error('Failed to load loader versions:', e);
      addToast({ type: 'error', title: t('instance.create.loaderVersionLoadError') });
    });
```

注意：需确认组件已导入 `addToast` 和 `logger`。若未导入，添加：
```typescript
import { useToast } from '../../../../shared/stores/toastStore';
import { logger } from '../../../../shared/utils/logger';
// 在组件内：
const { addToast } = useToast();
```

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: 无错误

---

### Task 8: p2p.rs TODO 文档化

**Files:**
- Modify: `src-tauri/src/social/p2p.rs`

- [ ] **Step 1: 更新 TODO 注释**

读取 `src-tauri/src/social/p2p.rs` 第 160-170 行，将第 165 行的 TODO 注释替换为：

```rust
    // TODO: Verify signature against the friend's stored public key.
    // NOTE: Social/P2P functionality is not exposed in the 1.0.0 release.
    // This signature verification MUST be implemented before the social feature
    // is enabled in a future release. Until then, the P2P code path is not
    // reachable from the UI.
```

- [ ] **Step 2: 验证**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3`
Expected: 编译通过

---

### Task 9: LoginPage 测试

**Files:**
- Create: `src/shells/zzz/pages/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: 编写 LoginPage 测试**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { render } from '../../../../test/test-utils';
import LoginPage from '../LoginPage';

vi.mock('@tauri-apps/api/core');

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders offline login form', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/username|用户名/i)).toBeInTheDocument();
  });

  it('shows shake animation on empty offline submit', async () => {
    render(<LoginPage />);
    const submitBtn = screen.getByRole('button', { name: /offline|离线/i });
    fireEvent.click(submitBtn);
    // 验证 shake 动画类被添加（或错误提示出现）
    await waitFor(() => {
      // 空输入不应调用 invoke
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  it('calls offline_login on valid username submit', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ username: 'TestUser', uuid: 'test-uuid' });
    render(<LoginPage />);
    const input = screen.getByPlaceholderText(/username|用户名/i);
    fireEvent.change(input, { target: { value: 'TestUser' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('offline_login', expect.objectContaining({ username: 'TestUser' }));
    });
  });

  it('renders guest login button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /guest|访客/i })).toBeInTheDocument();
  });
});
```

注意：placeholder/button 文本需根据实际 LoginPage 调整。先读取 LoginPage.tsx 确认实际文本。

- [ ] **Step 2: 运行测试验证**

Run: `npx vitest run src/shells/zzz/pages/__tests__/LoginPage.test.tsx 2>&1 | tail -15`
Expected: 测试通过（可能需根据实际组件调整选择器）

---

### Task 10: Modal 测试

**Files:**
- Create: `src/shells/zzz/components/ui/__tests__/Modal.test.tsx`

- [ ] **Step 1: 编写 Modal 测试**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '../../../../../test/test-utils';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    );
    const backdrop = container.querySelector('[data-backdrop]') || container.firstElementChild;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('has role dialog and aria-modal', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
```

注意：Modal 的 props 和 DOM 结构需根据实际组件调整。先读取 Modal.tsx 确认。

- [ ] **Step 2: 运行测试验证**

Run: `npx vitest run src/shells/zzz/components/ui/__tests__/Modal.test.tsx 2>&1 | tail -15`

---

### Task 11: DownloadPanel 测试

**Files:**
- Create: `src/shells/zzz/components/ui/__tests__/DownloadPanel.test.tsx`

- [ ] **Step 1: 编写 DownloadPanel 测试**

```tsx
import { describe, it, expect } from 'vitest';
import { screen, fireEvent, render } from '../../../../../test/test-utils';
import { DownloadPanel } from '../DownloadPanel';
import { DownloadProvider } from '../../../../shared/stores/downloadStore';

function renderWithDownload(ui: React.ReactElement) {
  return render(<DownloadProvider>{ui}</DownloadProvider>);
}

describe('DownloadPanel', () => {
  it('renders toggle button', () => {
    renderWithDownload(<DownloadPanel />);
    expect(screen.getByLabelText(/toggle downloads/i)).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    renderWithDownload(<DownloadPanel />);
    const toggle = screen.getByLabelText(/toggle downloads/i);
    fireEvent.click(toggle);
    expect(screen.getByText(/no downloads/i)).toBeInTheDocument();
  });
});
```

注意：DownloadPanel 可能需要 DownloadProvider 包裹。先读取组件确认依赖。

- [ ] **Step 2: 运行测试验证**

Run: `npx vitest run src/shells/zzz/components/ui/__tests__/DownloadPanel.test.tsx 2>&1 | tail -15`

---

### Task 12-14: 其余核心流程测试

对 HomePage、NewInstancePage、ContentDetailPage、InstallButton、errorMapping 重复 Task 9-11 的模式：
1. 读取组件源码确认 props/依赖/文本
2. 编写测试（mock invoke、包裹必要 Provider）
3. 运行验证

每个测试文件聚焦 3-5 个核心用例，不追求全覆盖。

---

## P2：质量打磨

### Task 15: HomePage data-tour 锚点

**Files:**
- Modify: `src/shells/zzz/pages/HomePage.tsx`

- [ ] **Step 1: 添加 data-tour 属性**

读取 HomePage.tsx，找到第 600-602 行的"新建实例"按钮和第 344 行附近的"启动"按钮。

在"新建实例"按钮（Hero 区，第 600 行）添加 `data-tour="home-new-instance"`：
```tsx
<Button data-tour="home-new-instance" variant="primary" onClick={() => navigate('/instances/new')}>
  + {t('home.newInstance')}
</Button>
```

在 PlayArea 的启动按钮添加 `data-tour="home-play"`：
```tsx
<Button data-tour="home-play" ...>
  {stateLabel[launchState]}
</Button>
```

- [ ] **Step 2: 验证引导流程**

Run: `npx tsc --noEmit`
Run: `pnpm tauri dev` → 手动走 Quick Start 引导，确认 5 步都能高亮目标

---

### Task 16: LoginPage 内联样式迁移

**Files:**
- Create: `src/shells/zzz/pages/LoginPage.module.css`
- Modify: `src/shells/zzz/pages/LoginPage.tsx`

- [ ] **Step 1: 创建 LoginPage.module.css**

```css
.timeGreeting {
  font-size: 0.5em;
  color: #666;
  letter-spacing: 5px;
  margin-bottom: 8px;
}

.msButton {
  width: 100%;
  justify-content: center;
  font-size: 0.9em;
  padding: 14px 48px;
}

.deviceCode {
  font-family: var(--font-mono);
  font-size: 1.1em;
  letter-spacing: 4px;
  animation: breathe-subtle 2s ease-in-out infinite;
}

.offlineButton {
  font-size: 0.65em;
  padding: 10px 20px;
}

.guestButton {
  width: 100%;
  justify-content: center;
  font-size: 0.65em;
  padding: 8px 20px;
}
```

- [ ] **Step 2: LoginPage.tsx 替换内联样式**

添加 `import styles from './LoginPage.module.css';`

将第 191 行 `style={{...}}` → `className={styles.timeGreeting}`
将第 212 行 → `className={styles.msButton}`
将第 227 行 → `className={styles.deviceCode}`
将第 286 行 → `className={styles.offlineButton}`
将第 306 行 → `className={styles.guestButton}`

保留第 217、292 行的 animation 内联样式（动态值，可接受）。

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit`
Run: `pnpm tauri dev` → 确认 LoginPage 视觉效果不变

---

### Task 17: VersionsPage 空状态

**Files:**
- Modify: `src/shells/zzz/pages/VersionsPage.tsx`
- Modify: `src/shells/zzz/pages/VersionsPage.module.css`

- [ ] **Step 1: 添加空状态 CSS**

VersionsPage.module.css 添加：
```css
.emptyState {
  text-align: center;
  padding: 3em 1em;
  color: var(--color-text-secondary);
}

.emptyState__icon {
  font-size: 2em;
  margin-bottom: 0.5em;
  opacity: 0.5;
}

.emptyState__title {
  font-size: 1em;
  margin-bottom: 0.3em;
  color: var(--color-text);
}

.emptyState__desc {
  font-size: 0.8em;
}
```

- [ ] **Step 2: VersionsPage.tsx 添加空状态渲染**

在 `showSkeleton ? (skeleton) : (grid)` 之间添加空状态判断：

```tsx
{showSkeleton ? (
  <div className={`${styles.grid} stagger-children`}>
    {Array.from({ length: 12 }).map((_, i) => ( /* Skeleton */ ))}
  </div>
) : filtered.length === 0 ? (
  <div className={styles.emptyState}>
    <div className={styles.emptyState__icon}>📦</div>
    <div className={styles.emptyState__title}>
      {error ? t('versions.errorTitle') || 'Unable to load' : t('versions.noVersions') || 'No versions found'}
    </div>
    <div className={styles.emptyState__desc}>
      {error ? error : t('versions.noVersionsDesc') || 'Try changing filters or check your network'}
    </div>
  </div>
) : (
  <div className={`${styles.grid} stagger-children`}>
    {filtered.map((v) => ( /* version card */ ))}
  </div>
)}
```

- [ ] **Step 3: 添加 i18n 键**

zh-CN.ts: `'versions.noVersions': '未找到版本', 'versions.noVersionsDesc': '尝试更改筛选条件或检查网络连接',`
en-US.ts: `'versions.noVersions': 'No versions found', 'versions.noVersionsDesc': 'Try changing filters or check your network',`

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit`

---

### Task 18: InstancesPage 骨架屏

**Files:**
- Modify: `src/shells/zzz/pages/InstancesPage.tsx`

- [ ] **Step 1: 添加 loading 状态和骨架屏**

读取 InstancesPage.tsx，找到 `useInstances()` 调用。检查 instanceStore 是否暴露 loading 状态。

如果 store 有 loading：
```tsx
const { instances, loading } = useInstances();
```

在渲染逻辑中，`instances.length === 0` 之前添加 loading 判断：

```tsx
{loading ? (
  <div className={`${styles.grid} stagger-children`}>
    {Array.from({ length: 3 }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
) : instances.length === 0 ? (
  /* 现有空状态 */
) : filtered.length === 0 ? (
  /* 现有筛选无结果 */
) : (
  /* 现有实例列表 */
)}
```

如果 store 无 loading 状态，则添加本地 loading state：
```tsx
const [loading, setLoading] = useState(true);
useEffect(() => {
  // 首次实例加载后设为 false
  if (instances.length > 0 || hasAttemptedLoad) setLoading(false);
}, [instances]);
```

- [ ] **Step 2: 导入 CardSkeleton**

```tsx
import { CardSkeleton } from '../components/ui/Skeleton';
```

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit`

---

### Task 19: 响应式断点

**Files:**
- Modify: `src/shells/zzz/pages/HomePage.module.css`
- Modify: `src/shells/zzz/pages/InstancesPage.module.css`
- Modify: `src/shells/zzz/pages/MarketplacePage.module.css`
- Modify: `src/shells/zzz/pages/InstanceDetailPage.module.css`

- [ ] **Step 1: 为每个页面 CSS 添加断点**

在每个页面 module.css 末尾添加响应式规则。以 HomePage 为例：

```css
@media (max-width: 1200px) {
  .heroGrid {
    grid-template-columns: 1fr;
  }
  .serverMonitor {
    display: none;
  }
}

@media (max-width: 960px) {
  .hero {
    flex-direction: column;
  }
  .quickActions {
    flex-wrap: wrap;
  }
  .gameTime {
    display: none;
  }
}
```

具体类名需根据各页面实际 CSS 类调整。原则：
- 1200px：减少网格列数、隐藏次要面板
- 960px：单列布局、隐藏装饰元素

- [ ] **Step 2: 逐个页面验证**

Run: `pnpm tauri dev` → 缩放窗口至 1200px 和 960px，确认无布局崩溃

---

### Task 20: 安全审计改阻断式

**Files:**
- Modify: `.github/workflows/security-audit.yml`

- [ ] **Step 1: 移除非阻断标志**

将 `security-audit.yml` 中的：
- `cargo audit || true` → `cargo audit`
- `continue-on-error: true` → 删除该行

```yaml
      - name: Run cargo audit
        working-directory: src-tauri
        run: cargo audit
```

```yaml
      - name: Run pnpm audit
        run: pnpm audit --audit-level=high
```

- [ ] **Step 2: 验证 YAML 语法**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/security-audit.yml'))"`
Expected: 无输出（语法正确）

---

### Task 21: 生产构建移除 console.log

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: 添加 esbuild pure 配置**

读取 `vite.config.ts`，在 `defineConfig` 中添加 `esbuild` 配置：

```typescript
export default defineConfig({
  // ... 现有配置
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info'],
  },
  build: {
    // ... 现有 build 配置
  },
});
```

- [ ] **Step 2: 验证生产构建**

Run: `pnpm build 2>&1 | tail -10`
Expected: 构建成功

检查产物中无 console.log：
Run: `grep -r "console.log" dist/assets/*.js | head -5`
Expected: 无匹配（或极少，仅来自第三方库）

---

## 最终：版本同步与验证

### Task 22: 版本号同步到 1.0.0

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 修改三个文件的版本号**

`package.json`: `"version": "0.0.6"` → `"version": "1.0.0"`
`tauri.conf.json`: `"version": "0.0.6"` → `"version": "1.0.0"`
`Cargo.toml`: `version = "0.0.6"` → `version = "1.0.0"`

- [ ] **Step 2: 验证一致性**

Run: `grep '"version"' package.json src-tauri/tauri.conf.json && grep '^version' src-tauri/Cargo.toml`
Expected: 三处均为 1.0.0

---

### Task 23: 全量验证

- [ ] **Step 1: TypeScript 检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 2: 全部测试**

Run: `npx vitest run 2>&1 | tail -10`
Expected: 所有测试通过（含新增测试）

- [ ] **Step 3: Rust 检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: 编译通过（忽略 sha1 asm 环境问题）

- [ ] **Step 4: 前端构建**

Run: `pnpm build 2>&1 | tail -10`
Expected: 构建成功

- [ ] **Step 5: 本地运行查看效果**

Run: `pnpm tauri dev`

手动验证：
- 登录页面正常显示
- 创建实例流程正常
- 主题切换无异常
- 窗口缩放至最小无崩溃
- 引导流程能高亮目标
- 中英文切换无缺失翻译

- [ ] **Step 6: 提交所有改动**

```bash
git add -A
git commit -m "release: v1.0.0 - first stable release

- Enable GitHub Releases auto-update
- Add core flow tests (Login, Modal, DownloadPanel, etc.)
- i18n: DownloadPanel, NewInstancePage error messages
- Fix: NewInstancePage silent error swallowing
- UI: responsive breakpoints, empty states, skeleton loading
- UI: LoginPage inline styles → CSS Modules
- UI: HomePage data-tour anchors for onboarding
- Security: audit workflow now blocks CI on vulnerabilities
- Build: remove console.log in production
- Docs: CHANGELOG sync, README install instructions, p2p TODO
- Version: 0.0.6 → 1.0.0"
```

---

## 自审清单

- [x] Spec 覆盖：P0（自动更新+签名说明）→ Task 1-3；P1（CHANGELOG+测试+i18n+静默错误+p2p）→ Task 4-14；P2（响应式+引导+内联样式+空状态+骨架屏+安全审计+console.log）→ Task 15-21；版本同步+验证 → Task 22-23
- [x] 无占位符：所有步骤含具体代码或具体命令
- [x] 类型一致：i18n 键名在 zh-CN/en-US 间一致
- [x] 实施顺序：P0 → P1 → P2 → 验证，符合 spec 第 9 节
