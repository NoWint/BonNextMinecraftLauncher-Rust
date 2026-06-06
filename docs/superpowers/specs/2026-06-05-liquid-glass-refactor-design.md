# macOS 26 Liquid Glass 全量重构设计规范

**日期**: 2026-06-05
**状态**: 已批准
**方案**: CSS 材质令牌驱动 (方案 A)
**执行方式**: Subagent-Driven

---

## 1. 概述

对 SwiftUI Shell 的 17 个 UI 组件 + 9 个功能组件 + 布局系统进行全面重构，使其符合 macOS 26 Liquid Glass 设计规范。包括材质令牌系统、浮动侧边栏、响应式布局、Spring 动画校准、无障碍补全。

## 2. 材质令牌系统

### 2.1 五层材质

| 层级 | 用途 | blur (CSS fallback) | 背景 (dark) | 背景 (light) |
|------|------|---------------------|-------------|-------------|
| ultraThin | Tooltip, Popover | 20px | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.02)` |
| thin | Toolbar, Tabs, Badge, Toast | 30px | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.04)` |
| regular | Sidebar, Card | 40px | `rgba(30,30,30,0.45)` | `rgba(245,245,247,0.45)` |
| thick | Modal, DownloadPanel | 50px | `rgba(44,44,46,0.92)` | `rgba(255,255,255,0.92)` |
| ultraThick | 全屏遮罩 | 60px | `rgba(44,44,46,0.95)` | `rgba(255,255,255,0.95)` |

### 2.2 CSS Class 映射

```css
.glass-ultrathin { backdrop-filter: blur(var(--swift-material-ultrathin-blur)) saturate(180%); background: var(--swift-material-ultrathin-bg); }
.glass-thin      { backdrop-filter: blur(var(--swift-material-thin-blur)) saturate(180%);      background: var(--swift-material-thin-bg); }
.glass-regular   { backdrop-filter: blur(var(--swift-material-regular-blur)) saturate(180%);   background: var(--swift-material-regular-bg); }
.glass-thick     { backdrop-filter: blur(var(--swift-material-thick-blur)) saturate(180%);     background: var(--swift-material-thick-bg); }
.glass-ultrathick{ backdrop-filter: blur(var(--swift-material-ultrathick-blur)) saturate(180%); background: var(--swift-material-ultrathick-bg); }
```

### 2.3 原生 Liquid Glass 覆盖

macOS 26+ 时 `.glass-native-liquid` class 激活，所有 `.glass-*` 禁用 CSS backdrop-filter，只保留 tint 背景。

### 2.4 浏览器降级

```css
@supports not (backdrop-filter: blur(20px)) {
  .glass-ultrathin, .glass-thin, .glass-regular { background: rgba(44,44,46,0.92); }
  .glass-thick, .glass-ultrathick { background: rgba(44,44,46,0.95); }
}
```

## 3. 浮动侧边栏

- Sidebar: `position: fixed; left: 0; top: 0; bottom: 0; width: 220px; z-index: 200`
- Content: `margin-left: 220px`（背景延伸到全宽）
- 窄屏 (<768px): Sidebar 48px 图标模式，Content `margin-left: 48px`

## 4. 响应式断点

| 断点 | 宽度 | Sidebar | Grid 列数 | Modal |
|------|------|---------|----------|-------|
| 窄屏 | <768px | 48px 图标 | 1-2 列 | 全屏 |
| 中屏 | 768-1024px | 220px | 2-3 列 | 90% 宽 |
| 宽屏 | >=1024px | 220px | 3-4 列 | 标准 |

## 5. Spring 动画校准

| 场景 | 校准后 |
|------|--------|
| Default | `cubic-bezier(0.2, 0, 0, 1)` (response:0.55, damping:0.75) |
| Gentle | `cubic-bezier(0.2, 0, 0.1, 1)` (response:0.5, damping:0.85) |
| Bouncy | `cubic-bezier(0.34, 1.56, 0.64, 1)` (保持) |

`prefers-reduced-motion: reduce` 全局降级。

## 6. 无障碍补全

| 组件 | 添加属性 |
|------|---------|
| ProgressBar | `role="progressbar"`, `aria-valuenow/min/max` |
| Spinner | `role="status"`, `aria-label="Loading"` |
| Toast | `role="alert"`, `aria-live="polite"` |
| Tooltip | `role="tooltip"`, `aria-describedby` |
| Skeleton | `aria-busy="true"`, `aria-label` |
| InstanceSelect | `role="listbox/option"`, `aria-expanded` |
| SearchPalette | `role="combobox"`, `aria-expanded` |
| CommandPalette | `role="combobox"`, `aria-expanded` |
| DownloadPanel | `role="region"`, `aria-label` |
| ChatPanel | `role="log"`, `aria-label` |

## 7. 组件材质分配

| 组件 | 材质 | Glass Class |
|------|------|-------------|
| Sidebar | regular | `.glass-regular` |
| Card | regular | `.glass-regular` |
| Modal backdrop | thick | `.glass-thick` |
| Modal dialog | thick | `.glass-thick` |
| DownloadPanel | thick | `.glass-thick` |
| SearchPalette | thin | `.glass-thin` |
| CommandPalette | thin | `.glass-thin` |
| Tooltip | ultraThin | `.glass-ultrathin` |
| Toast | thin | `.glass-thin` |
| Tabs | thin | `.glass-thin` |
| Badge | ultraThin | `.glass-ultrathin` |
| Button | 无 | — |
| Input/Select | 无 | — |

## 8. Fallback 策略

```
macOS 26+ → 原生 NSGlassEffectView → CSS: backdrop-filter: none
macOS <26 → CSS backdrop-filter blur → 半透明背景
不支持 backdrop-filter → @supports 降级 → 接近不透明纯色
prefers-reduced-motion → 禁用所有动画
```

## 9. 文件变更清单

### CSS 文件 (6 个)
- `styles/tokens.css` — 新增材质令牌 + 响应式断点
- `styles/themes.css` — 新增材质背景色 (light/dark)
- `styles/global.css` — 重写 Liquid Glass class 系统 + 响应式 + reduced-motion
- `styles/animations.css` — 校准 Spring 曲线 + reduced-motion
- `components/layout/Sidebar.module.css` — 浮动布局 + 响应式
- 所有组件 `.module.css` — 添加材质 class + 响应式

### TSX 文件 (17 UI + 9 Feature)
- 所有组件 — 添加材质 class + 无障碍属性 + 响应式支持
- `AppShell.tsx` — 浮动布局重构

### Hooks
- `useLiquidGlass.ts` — 已完成
- `useResponsive.ts` — 新增响应式 hook
