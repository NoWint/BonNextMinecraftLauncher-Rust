# BonNext SwiftUI Shell — Apple HIG Design Spec

> **Date**: 2026-06-06
> **Scope**: 升级 `src/shells/swiftui/` 全套 UI，使其符合 macOS 26 Apple Human Interface Guidelines + Liquid Glass 设计语言
> **Status**: Approved

---

## 1. Design Direction Summary

| Decision | Value |
|---|---|
| 视觉语言 | macOS 26 Liquid Glass (毛玻璃/液态玻璃) |
| 布局灵感 | IDE 三栏结构（参考 Cursor/VS Code 截图） |
| 改造范围 | 仅升级 swiftui shell（zzz shell 不动） |
| 强调色 | #FFE600 黄色（克制使用：仅 active 状态、CTA 按钮） |
| 图标规范 | **全部使用 SVG，禁止 Emoji** |
| 字体 | SF Pro Text (系统字体) + SF Mono (代码/数据) |
| 系统栏 | 无独立 titlebar，traffic lights 内嵌侧边栏左上角 |

---

## 2. Layout Architecture

### 2.1 整体结构：三栏 + 融入式工具栏

```
┌─────────────────────────────────────────────────────────┐
│ ●●● ← traffic lights 浮在 sidebar 左上角               │
├──────────┬──────────────────────────┬───────────────────┤
│          │ [◀▶][Badge][...toolbar]  │                   │
│  Thick   ├──────────────────────────┤   File Tree       │
│  Glass   │ main → origin/main ▼     │   Panel           │
│  Sidebar │                          │   (thin material)  │
│  210px   │    Content Area          │   240px           │
│          │    (flex-1)              │                   │
│          │                          │                   │
└──────────┴──────────────────────────┴───────────────────┘
```

### 2.2 各区域职责

| 区域 | 宽度 | 材质 | 内容 |
|---|---|---|---|
| 左侧 Sidebar | 210px (可折叠至 52px) | **Thick Glass** (`rgba(44,44,46,0.92)` + blur 60px) | 导航项、项目树、用户信息、设置入口 |
| 中间 Content | flex-1 | Primary Material (`rgba(30,30,30,0.72)`) | 页面内容、面包屑、输入区 |
| 右侧 Panel | 240px (可隐藏) | Thin Material (`rgba(30,30,30,0.55)` + blur 20px) | Activity、下载进度、文件树 |

### 2.3 工具栏规则

- **不是独立系统栏**，融入 content 区顶部第一行
- 包含：导航按钮、badge pill、下拉菜单、分支信息、操作图标组
- 高度：36px，padding: 6px 16px
- 背景：与 content 区融合（无独立背景色或用 ultra-thin material）

### 2.4 Traffic Lights

- 使用 Tauri `titleBarStyle: Overlay`
- Traffic lights 通过 CSS 绝对定位浮在 sidebar 左上角 `(top:10px; left:10px)`
- sidebar 顶部预留 36px 避免遮挡导航项
- sidebar 顶部区域同时作为窗口拖拽区域 (`-webkit-app-region: drag`)

---

## 3. Design Tokens

### 3.1 Liquid Glass 两层架构 (Apple HIG)

#### Layer 1: Liquid Glass 层（导航/控件层）

```css
/* Thick variant — Sidebar */
--swift-glass-thick-bg:       rgba(44, 44, 46, 0.92);
--swift-glass-thick-blur:     60px;
--swift-glass-thick-saturate: 200%;
--swift-glass-thick-border:   rgba(255, 255, 255, 0.06);

/* Regular variant — Toolbar / Popover */
--swift-glass-regular-bg:       rgba(255, 255, 255, 0.12);
--swift-glass-regular-blur:     40px;
--swift-glass-regular-saturate: 180%;
--swift-glass-regular-border:   rgba(255, 255, 255, 0.18);

/* Clear variant — Media overlay / Tooltip */
--swift-glass-clear-bg:       rgba(255, 255, 255, 0.06);
--swift-glass-clear-blur:     20px;
--swift-glass-clear-saturate: 150%;
--swift-glass-clear-border:   rgba(255, 255, 255, 0.10);
```

#### Layer 2: Content 层（标准材质）

```css
/* Primary — Main background */
--swift-bg-primary: rgba(30, 30, 30, 0.72);

/* Secondary — Section backgrounds */
--swift-bg-secondary: rgba(20, 20, 22, 0.78);

/* Card — Content cards */
--swift-bg-card: rgba(255, 255, 255, 0.05);
--swift-bg-card-hover: rgba(255, 255, 255, 0.08);

/* Input — Form inputs */
--swift-bg-input: rgba(255, 255, 255, 0.04);

/* Modal — Dialog backgrounds */
--swift-bg-modal: rgba(44, 44, 46, 0.95);
--swift-bg-modal-backdrop: rgba(0, 0, 0, 0.5);
```

### 3.2 圆角系统 (Concentric Rounding)

Apple HIG 原则：「硬件形态决定控件曲率」

| Token | 值 | 用途 |
|---|---|---|
| `--swift-radius-xs` | 6px | 小按钮、图标按钮 |
| `--swift-radius-sm` | 10px | 输入框、小卡片、select |
| `--swift-radius-md` | 12px | 卡片容器、面板 |
| `--swift-radius-lg` | 16px | 大卡片、对话框 |
| `--swift-radius-xl` | 20px | 侧边栏外框 |
| `--swift-radius-pill` | 9999px | **导航项、按钮、徽章**（默认控件形状） |

### 3.3 排版层级 (SF Pro Typography)

| Token | 规格 | 用途 |
|---|---|---|
| Page Title | 700 26px / 1.2 | 页面主标题 |
| Section Title | 600 17px / 1.3 | 区块标题 |
| Card Title | 500 15px / 1.3 | 卡片名称 |
| Body | 400 13px / 1.5 | 正文（默认） |
| Caption Label | 500 11px / 1.4 uppercase + tracking 0.8px | 分组标签（置顶、项目等） |
| Metadata | 400 10px / 1.4 SF Mono | 数据、快捷键、代码 |

**字体栈**：
- Body/UI: `-apple-system, 'SF Pro Text', SF Pro, system-ui, sans-serif`
- Code/Data: `'SF Mono', Menlo, Monaco, Consolas, monospace`

### 3.4 颜色系统 (Dark Theme)

#### 文字透明度阶梯 (Vibrant Text on Materials)

| Level | Opacity | 用途 |
|---|---|---|
| Primary | 85% | 标题、重要文字 |
| Secondary | 65% | 次要文字、描述 |
| Tertiary | 45% | 辅助文字、placeholder |
| Quaternary | 35% | 极弱文字、禁用状态 |

#### 语义色

| 名称 | 值 | 用途 |
|---|---|---|
| Accent | `#FFE600` | 品牌强调色（克制使用） |
| Destructive | `#FF453A` | 删除、危险操作 |
| Success | `#30D158` | 成功、在线状态 |
| Warning | `#FF9F0A` | 警告、待处理 |
| Info | `#0A84FF` | 信息、链接、新标记 |

#### Accent Tint 变体（黄色）

| Variant | Background | 文字色 | 场景 |
|---|---|---|---|
| tint-06 | `rgba(255,230,0, 0.06)` | `rgba(255,230,0, 0.7)` | 微弱提示 |
| tint-10 | `rgba(255,230,0, 0.10)` | `rgba(255,230,0, 0.75)` | 默认 hover |
| **tint-15** | `rgba(255,230,0, 0.15)` | **`#FFE600`** | **Active 选中态** |
| tint-20 | `rgba(255,230,0, 0.20)` | `#FFE600` | 强 hover |
| Solid | `#FFE600` | `#1C1C1E` | CTA 主按钮 |

#### 边框

| 用途 | 值 |
|---|---|
| Default border | `rgba(255, 255, 255, 0.06)` |
| Hairline (分隔线) | `rgba(255, 255, 255, 0.08)` |
| Hover border | `rgba(255, 255, 255, 0.12)` |
| Focus ring | `rgba(255, 230, 0, 0.4)` + box-shadow 0 0 0 3px `rgba(255,230,0,0.08)` |

### 3.5 间距系统

| Token | 值 | 用途 |
|---|---|---|
| xs | 2px | 紧凑间距 |
| sm | 4px | 元素内部间隙 |
| md | 8px | 组件内间距 |
| lg | 16px | 区块间标准间距 |
| xl | 24px | 大区块间距 |
| 2xl | 32px | 页面级间距 |

### 3.6 动画 (Apple Spring)

| Token | 值 | 用途 |
|---|---|---|
| Spring Default | `cubic-bezier(0.2, 0, 0, 1)` | 默认过渡 |
| Spring Gentle | `cubic-bezier(0.2, 0, 0.1, 1)` | 柔和交互 |
| Duration Fast | 150ms | hover/focus |
| Duration Normal | 250ms | 展开/收起 |
| Duration Slow | 350ms | 页面切换 |

**Reduced motion**: 所有 duration 归零。

---

## 4. Component Specifications

### 4.1 Sidebar Navigation Item (Capsule)

```
形状:    border-radius: pill (9999px)
尺寸:    height: 34px, padding: 7px 12px
间隙:    gap: 8px (icon ↔ label)
图标:    SVG, 15x15px, width: 20px 容器居中
文字:    13px, font-weight: 500

Default:     bg: transparent, text: secondary (65%)
Hover:       bg: rgba(255,255,255, 0.05), text: primary (85%)
Active:      bg: accent-tint-15, text: #FFE600, weight: 500
```

### 4.2 Button System

#### Primary (CTA)

```
形状:    pill (9999px)
尺寸:    padding: 8px 20px, min-height: 34px
背景:    #FFE600 (solid)
文字:    #1C1C1E, 13px, weight: 600
边框:    none
变体:    蓝 (#0A84FF)、红 (#FF453A) 用于特定语义场景
```

#### Secondary

```
形状:    pill
背景:    rgba(255,255,255, 0.08)
文字:    primary (85%), 13px, weight: 500
边框:    0.5px solid rgba(255,255,255, 0.12)
```

#### Ghost/Tertiary

```
背景:    transparent
文字:    tertiary (45%), 13px
边框:    none
```

#### Icon Button (Toolbar)

```
形状:    8px 圆角
尺寸:    28×28px
背景:    default: transparent, hover: rgba(255,255,255, 0.06)
文字:    quaternary (35%), 13-14px SVG icon
```

### 4.3 Card

```
圆角:    --swift-radius-md (12px)
背景:    --swift-bg-card (rgba(255,255,255, 0.05))
边框:    0.5px solid rgba(255,255,255, 0.06)
Padding: 14px (紧凑) / 16px (标准)
Shadow:  无硬阴影（依赖 glass blur 层次）
Hover:   bg → card-hover, border → rgba(255,255,255, 0.10)
```

**卡片类型**：
- Instance Card：图标 + 名称 + 版本标签 + Play 按钮
- Mod Card：封面区域 + 名称 + 作者 + 标签组
- Compact List Card：单行，含进度条

### 4.4 Input

```
圆角:    --swift-radius-sm (10px)
背景:    --swift-bg-input (rgba(255,255,255, 0.04))
边框:    0.5px solid rgba(255,255,255, 0.08)
Padding: 8px 12px
文字:    13px, primary (85%)
Placeholder: tertiary (45%)

Focus:
  边框:  0.5px solid rgba(255,230,0, 0.4)
  阴影:  0 0 0 3px rgba(255,230,0, 0.08)
```

**Search Input**: 前置搜索 SVG icon + placeholder + 后置 ⌘K badge pill

### 4.5 Badge

```
形状:    pill (9999px)
文字:    10-11px, weight: 500/600
Padding: 2px 9px (文字) / 3px 12px (pill button)

语义色:
  New:        bg: accent-tint-12, text: #FFE600
  Update:     bg: rgba(10,132,255,0.15), text: #0A84FF
  Stable:     bg: rgba(48,209,88,0.12), text: #30D158
  Beta:       bg: rgba(255,159,10,0.12), text: #FF9F0A
  Version:    bg: rgba(255,255,255,0.08), text: 45%
  Count:      bg: semantic color solid, text: white
```

### 4.6 Toggle Switch (iOS Style)

```
轨道:    40×22px, radius: 11px
  ON:     bg: #30D158
  OFF:    bg: rgba(255,255,255, 0.12)
滑块:    18×18px, radius: 50%, white
  ON:     right: 2px
  OFF:    left: 2px
动画:    spring-default, 250ms
```

### 4.7 Tabs

```
形状:    底部指示条 (2px height, pill shape)
选中:    文字 primary (85%) + accent 色指示条
未选:    文字 tertiary (45%)
间距:    item gap 16px, padding: 8px 4px
```

### 4.8 Progress Bar

```
高度:    3px (compact) / 4px (standard)
轨道:    bg: rgba(255,255,255, 0.06), radius: 2px
填充:    gradient(90deg, #FFE600, #F0C000), radius: 2px
动画:    transition width 300ms ease-out
```

### 4.9 Tooltip

```
背景:    thick glass (rgba(44,44,46,0.95)) + blur 40px
圆角:    8px
Padding: 6px 10px
文字:    11px, secondary (65%)
箭头:   CSS triangle, 6px
延迟:    显示 500ms, 隐藏立即
```

### 4.10 Modal / Dialog

```
背景:    modal material (rgba(44,44,46,0.95))
圆角:   --swift-radius-lg (14px)
阴影:    0 8px 32px rgba(0,0,0,0.4)
最大宽度: 480px
Padding: 24px
遮罩:    backdrop rgba(0,0,0,0.5)
```

---

## 5. Icon System

### 5.1 核心规则

- **全部使用 SVG 内联图标，禁止任何 Emoji**
- Icon 尺寸统一：导航 15px、按钮 14-16px、小图标 12px
- Stroke width 统一：1.5px（细线条风格，符合 macOS 26）
- Color: 当前 `currentColor`，支持继承父元素颜色
- 推荐使用 [SF Symbols](https://developer.apple.com/sf-symbols/) 风格的图标

### 5.2 图标来源优先级

1. **SF Symbols** (通过 `@sfymbols/sf-symbols` 或手写 SVG) — 首选
2. **Lucide Icons** (lucide-react) — 备选开源方案
3. **自定义 SVG** — 仅当以上两者都不满足时

### 5.3 必需图标清单（导航+功能）

| 位置 | Icon | SF Symbol 名 |
|---|---|---|
| Home | 房子 | house |
| Store/Marketplace | 商店 | store / bag |
| Instances | 方块/立方体 | cube.box |
| Library | 书架 | books.vertical |
| Versions | 时钟/历史 | clock / arrow.counterclockwise |
| Collections | 心形/收藏 | heart / star |
| Settings | 齿轮 | gearshape |
| Search | 放大镜 | magnifyingglass |
| Download | 下载箭头 | arrow.down.circle |
| Play | 三角播放 | play.fill |
| Plus | 加号 | plus |
| Close | X | xmark |
| Chevron | 折叠箭头 | chevron.down / chevron.right |
| External Link | 外链 | arrow.up.right |
| Info | 信息圈 | info.circle |
| Warning | 警告三角 | exclamationmark.triangle |
| Check | 对勾 | checkmark |
| Trash | 垃圾桶 | trash |
| Edit | 编辑铅笔 | pencil |
| Copy | 复制 | doc.on.doc |
| Folder | 文件夹 | folder |
| File | 文件 | doc |
| User | 用户 | person |
| Server | 服务器 | server.rack |
| Refresh | 刷新 | arrow.clockwise |
| Filter | 过滤 | line.3.horizontal.decrease.circle |
| Sort | 排序 | arrow.up.arrow.down |

---

## 6. Interaction Patterns

### 6.1 Hover 状态

所有可交互元素必须响应 hover：
- 按钮/链接：背景加深 + 可选微缩放 (scale 1.02)
- 卡片：bg card-hover + border 加深
- 导航项：bg rgba(255,255,255,0.05) + 文字提升一级
- 行列表项：整行高亮

### 6.2 Focus 状态

键盘焦点必须清晰可见：
- 输入框：accent 色边框 + 外发光环
- 按钮：accent 色 outline (offset 2px)
- 导航项：同 active 态但更淡

### 6.3 Active/Selected 状态

- 导航项：accent-tint-15 背景 + accent 色文字
- Tabs：底部 accent 色指示条
- 列表行：左侧 2px accent 色竖线 + 淡背景

### 6.4 Disabled 状态

-Opacity 降至 35%（quaternary level）
- cursor: not-allowed
- 移除所有 hover 效果

### 6.5 Loading 状态

- 按钮：spinner 替换文字 + 禁用点击
- 卡片：skeleton shimmer 动画
- 列表：骨架屏占位
- 页面：全屏 spinner 或 progress bar

---

## 7. Scrollbar

```css
/* 自定义滚动条（暗色主题） */
scrollbar-width: thin;
scrollbar-color: rgba(255,255,255,0.10) transparent;

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.10);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.18);
}
```

Sidebar 滚动时应用 scroll edge effect（顶部/底部渐隐遮罩）。

---

## 8. Implementation Priority

### Phase 1: Foundation (tokens.css + themes.css + global.css)
1. 重写 `tokens.css` — 全部 token 按 3.x 规范更新
2. 重写 `themes.css` — dark/light 双主题变量
3. 更新 `global.css` — reset, scrollbar, base styles

### Phase 2: Layout Shell
4. 重写 `AppShell.tsx` — 三栏布局 + 融入式工具栏
5. 重写 `Sidebar.tsx` + `Sidebar.module.css` — Thick Glass + Capsule nav
6. 实现 traffic lights 定位 + drag region

### Phase 3: Core Components (按使用频率排序)
7. Button + Button.module.css
8. Card + ContentCard
9. Input / SearchField / Select
10. Badge
11. Toggle
12. Tabs
13. Modal
14. Toast
15. Pagination
16. Skeleton / Spinner
17. ProgressBar
18. Tooltip
19. Breadcrumb
20. CommandPalette / SearchPalette

### Phase 4: Feature Components
21. InstallButton
22. CollectionButton
23. InstanceSelect
24. DownloadPanel
25. ChatPanel
26. FriendsPanel
27. ErrorBoundary

### Phase 5: Pages (逐页迁移样式)
28. HomePage
29. LoginPage
30. MarketplacePage
31. ContentDetailPage
32. InstancesPage
33. InstanceDetailPage
34. NewInstancePage
35. LibraryPage
36. CollectionsPage
37. VersionsPage
38. ServersPage
39. SettingsPage

---

## 9. Constraints & Rules

1. **CSS Modules only** — 所有组件样式使用 `*.module.css`，禁止 inline style（除动态值）
2. **SVG only** — 所有图标必须是 SVG，绝对不用 Emoji
3. **em 单位** — 尺寸基于 html { font-size: 16px } 的 em 值（保持现有约定）
4. **CSS Variables first** — 所有 token 通过 CSS 自定义属性定义，支持主题切换
5. **No clip-path corners** — 移除 zzz shell 的切角效果，改用标准 border-radius
6. **No noise/scanline overlays** — 移除 CRT 效果
7. **No Bebas Neue** — 移除装饰性标题字体，统一 SF Pro
8. **Responsive** — 最小宽度 768px（桌面应用基准）
9. **Accessibility** — WCAG AA 对比度（accent #FFE600 on dark = 11.5:1 ✅）
10. **macOS 26+ Native Glass** — 当检测到原生 Vibrancy 支持时，禁用 CSS fallback blur

---

## 10. File Structure (After Migration)

```
src/shells/swiftui/
├── AppShell.tsx                    # 三栏布局 shell
├── hooks/
│   └── useLiquidGlass.ts           # 原生玻璃检测
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Thick Glass 侧边栏
│   │   ├── Sidebar.module.css
│   │   └── index.ts
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Card.tsx
│   │   ├── Card.module.css
│   │   ├── Input.tsx
│   │   ├── Input.module.css
│   │   ├── Badge.tsx
│   │   ├── Badge.module.css
│   │   ├── Toggle.tsx
│   │   ├── Toggle.module.css
│   │   ├── Tabs.tsx
│   │   ├── Tabs.module.css
│   │   ├── Modal.tsx
│   │   ├── Modal.module.css
│   │   ├── Toast.tsx
│   │   ├── Toast.module.css
│   │   ├── ... (其余组件)
│   │   └── icons/                  # SVG 图标目录
│   │       ├── IconHome.tsx
│   │       ├── IconStore.tsx
│   │       └── ...
│   └── features/
│       ├── CommandPalette.tsx
│       ├── DownloadPanel.tsx
│       ├── ChatPanel.tsx
│       ├── FriendsPanel.tsx
│       └── SearchPalette.tsx
├── pages/
│   └── ... (各页面)
└── styles/
    ├── tokens.css                  # Design tokens (重写)
    ├── themes.css                  # Dark/Light theme vars (重写)
    ├── global.css                  # Base styles + reset (重写)
    └── animations.css              # Transition/animation utils
```
