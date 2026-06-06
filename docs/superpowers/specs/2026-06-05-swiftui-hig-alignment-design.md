# SwiftUI Shell HIG 全面对齐优化设计规范

> 日期: 2026-06-05
> 状态: 已批准
> 范围: `src/shells/swiftui/` 全部组件、页面、样式
> 策略: 分层递进（Layer 1→2→3→4），每层独立可验证

---

## 1. 背景与目标

### 1.1 现状问题

SwiftUI Shell 当前存在 5 大类与 Apple HIG 不符的问题：

| 类别 | 严重程度 | 关键问题 |
|------|---------|---------|
| 设计令牌 | 高 | 缺少 30+ HIG 标准令牌（语义颜色、字体层级、断点、z-index、阴影） |
| 可访问性 | P0 | 22 个图标缺 aria-hidden、Modal 无焦点陷阱、Toggle 无 ARIA、ProgressBar/Spinner/Toast 无 ARIA |
| 动画 | 中 | 2/3 Spring 曲线与 Apple HIG 偏差大、无 prefers-reduced-motion 支持 |
| 响应式 | 高 | 完全缺失，窄屏 UI 溢出 |
| 性能 | 中 | 缺 React.memo、内联对象/函数导致重渲染、any 类型滥用 |

### 1.2 优化目标

1. **HIG 合规**: 所有组件满足 Apple HIG 设计标准（交互目标 44pt、对比度 4.5:1、Spring 动画参数匹配）
2. **WCAG AA**: 零 A/AA 级违规，所有交互元素可通过键盘操作
3. **响应式**: 768px–1280px 窗口宽度范围内 UI 不溢出、不丢失功能
4. **性能**: 列表 100+ 项时无明显卡顿，无 TypeScript any 类型
5. **代码质量**: 所有样式使用 CSS Module，无内联样式（动态值除外）

### 1.3 执行策略

**分层递进**：按依赖关系分 4 层，每层完成后才进入下一层。

```
Layer 1: 设计令牌 + Spring 校准 (基础)
    ↓
Layer 2: 可访问性修复 (P0→P1)
    ↓
Layer 3: 交互模式 + 响应式布局
    ↓
Layer 4: 性能优化
```

---

## 2. Layer 1: 设计令牌补全 + Spring 动画校准

### 2.1 令牌补全

#### 2.1.1 语义颜色（6 项）

```css
/* tokens.css — 新增 */
--swift-color-success: #34C759;        /* Light: #34C759, Dark: #30D158 */
--swift-color-warning: #FF9500;        /* Light: #FF9500, Dark: #FF9F0A */
--swift-color-info: #007AFF;           /* Light: #007AFF, Dark: #0A84FF */
--swift-color-separator: rgba(60, 60, 67, 0.12);  /* Light, Dark: rgba(84, 84, 88, 0.36) */
--swift-fill-primary: rgba(120, 120, 128, 0.2);    /* Light, Dark: rgba(120, 120, 128, 0.32) */
--swift-fill-secondary: rgba(120, 120, 128, 0.16); /* Light, Dark: rgba(120, 120, 128, 0.24) */
--swift-fill-tertiary: rgba(120, 120, 128, 0.12);  /* Light, Dark: rgba(120, 120, 128, 0.18) */
```

#### 2.1.2 字体层级（5 项）

```css
--swift-font-large-title: 600 2.125rem/1.15 'SF Pro Display', var(--swift-font-family);
--swift-font-headline: 600 1.0625rem/1.3 'SF Pro Text', var(--swift-font-family);
--swift-font-subheadline: 400 0.9375rem/1.3 'SF Pro Text', var(--swift-font-family);
--swift-font-footnote: 400 0.8125rem/1.35 'SF Pro Text', var(--swift-font-family);
--swift-weight-regular: 400;
--swift-weight-medium: 500;
--swift-weight-semibold: 600;
--swift-weight-bold: 700;
```

#### 2.1.3 间距 / 圆角 / 阴影（7 项）

```css
--swift-radius-full: 9999px;
--swift-spacing-3xl: 3rem;    /* 48px */
--swift-spacing-4xl: 4rem;    /* 64px */
--swift-shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--swift-shadow-md: 0 4px 8px rgba(0,0,0,0.12);
--swift-shadow-lg: 0 8px 16px rgba(0,0,0,0.16);
--swift-shadow-xl: 0 16px 32px rgba(0,0,0,0.2);
```

#### 2.1.4 z-index 体系（6 项）

```css
--swift-z-sidebar: 200;
--swift-z-dropdown: 800;
--swift-z-overlay: 900;
--swift-z-modal: 1000;
--swift-z-popover: 1100;
--swift-z-toast: 1200;
```

#### 2.1.5 断点（3 项）

```css
--swift-breakpoint-sm: 768px;
--swift-breakpoint-md: 1024px;
--swift-breakpoint-lg: 1280px;
```

#### 2.1.6 过渡曲线（3 项）

```css
--swift-ease-standard: cubic-bezier(0.2, 0, 0, 1);     /* Apple 标准过渡 */
--swift-ease-in: cubic-bezier(0.4, 0, 1, 1);           /* 元素出现 */
--swift-ease-out: cubic-bezier(0, 0, 0.2, 1);          /* 元素消失 */
```

### 2.2 Spring 动画校准

| 令牌 | 当前值 | 修正值 | Apple HIG 参考 |
|------|--------|--------|---------------|
| `--swift-spring-default` | `cubic-bezier(0.175, 0.885, 0.32, 1.1)` | `cubic-bezier(0.2, 0, 0, 1)` | spring(response:0.55, dampingFraction:0.75) |
| `--swift-spring-gentle` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | `cubic-bezier(0.2, 0, 0.1, 1)` | spring(response:0.5, dampingFraction:0.85) |
| `--swift-spring-bouncy` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 保持不变 | spring(response:0.4, dampingFraction:0.6) — 已匹配 |

### 2.3 prefers-reduced-motion

在 `global.css` 添加：

```css
@media (prefers-reduced-motion: reduce) {
  .swiftui-shell *,
  .swiftui-shell *::before,
  .swiftui-shell *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 2.4 验收标准

- [ ] 所有令牌在 `tokens.css` 中定义，`themes.css` 中提供 light/dark 变体
- [ ] Spring 曲线与 Apple HIG 匹配（误差 < 5%）
- [ ] `prefers-reduced-motion: reduce` 时所有动画被抑制
- [ ] TypeScript 编译零错误，Vite 构建成功

---

## 3. Layer 2: 可访问性全面修复

### 3.1 P0 — WCAG A 级违规

#### 3.1.1 图标 aria-hidden（22 个文件）

所有 `components/icons/*.tsx` 的 `<svg>` 根元素添加 `aria-hidden="true"`。

修改方式：在每个图标组件的 SVG 上添加 `aria-hidden="true"` 属性。

示例：
```tsx
// HomeIcon.tsx
export function HomeIcon({ className, size = 16 }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} width={size} height={size} aria-hidden="true">
      ...
    </svg>
  );
}
```

#### 3.1.2 Modal 焦点陷阱

在 `Modal.tsx` 中实现：

1. 打开时：焦点移入对话框（首个可聚焦元素）
2. Trap Tab/Shift+Tab 在对话框内循环
3. 关闭时：焦点返回触发元素
4. 添加 `aria-labelledby` 指向标题元素

实现方案：使用 `useRef` + `useEffect` 管理焦点，无需第三方库。

```tsx
// 核心逻辑
const modalRef = useRef<HTMLDivElement>(null);
const previousFocusRef = useRef<HTMLElement | null>(null);

useEffect(() => {
  if (open) {
    previousFocusRef.current = document.activeElement as HTMLElement;
    // 移入焦点
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
  } else {
    // 恢复焦点
    previousFocusRef.current?.focus();
  }
}, [open]);

// Tab trap handler
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Tab') {
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};
```

#### 3.1.3 Toggle ARIA

- 添加 `role="switch"` + `aria-checked={checked}` + `aria-label`
- 将内联样式迁移到 CSS Module (`Toggle.module.css`)

#### 3.1.4 ProgressBar / Spinner / Skeleton ARIA

| 组件 | 添加属性 |
|------|---------|
| ProgressBar | `role="progressbar"` + `aria-valuenow` + `aria-valuemin={0}` + `aria-valuemax={100}` |
| Spinner | `role="status"` + 内部 `<span className="visually-hidden">Loading</span>` |
| Skeleton | `aria-hidden="true"` + 父容器 `aria-busy="true"` |

#### 3.1.5 Toast aria-live

ToastContainer 添加 `aria-live="polite"` + `role="status"`。

### 3.2 P1 — WCAG AA 级修复

#### 3.2.1 键盘导航

| 组件 | 键盘行为 |
|------|---------|
| Tabs | ← → 切换 tab，Home/End 跳首尾 |
| ListItem | Enter/Space 激活 |
| ContentCard | Enter/Space 激活 |
| InstanceSelect | ↑ ↓ 选择选项，Enter 确认，Escape 关闭，点击外部关闭 |
| SearchPalette | ↑ ↓ 导航结果，Enter 选择 |
| CommandPalette | ↑ ↓ 导航结果，Enter 选择 |

#### 3.2.2 ARIA 补全

| 组件 | 缺失属性 |
|------|---------|
| InstanceSelect | `aria-expanded` + `role="listbox"` / `role="option"` |
| SearchPalette | `role="dialog"` + `aria-modal="true"` |
| CommandPalette | `role="dialog"` + `aria-modal="true"` |
| Breadcrumb | `aria-label="Breadcrumb"` + 末项 `aria-current="page"` |
| Sidebar `<nav>` | `aria-label="Main navigation"` |
| SearchField | `aria-label="Search"` |
| Pagination | 各按钮 `aria-label` (如 "Page 3", "Next", "Previous") |

#### 3.2.3 Tooltip 键盘触发

- 焦点时显示（`onFocus`/`onBlur`）
- 添加 `role="tooltip"` + `aria-describedby` 关联触发元素

### 3.3 验收标准

- [ ] 所有交互元素可通过 Tab 导航 + Enter/Space 激活
- [ ] Modal 焦点完全被困在对话框内
- [ ] 屏幕阅读器可正确识别所有组件角色和状态
- [ ] 无 WCAG A/AA 级违规

---

## 4. Layer 3: 交互模式 + 响应式布局

### 4.1 响应式布局

#### 4.1.1 断点策略

| 断点 | 宽度 | 布局变化 |
|------|------|---------|
| `< 768px` | 窄屏 | Sidebar 折叠为图标模式（48px），Modal 全屏，面板自适应宽度 |
| `768–1024px` | 中屏 | Sidebar 折叠为图标模式，Grid 列数 -1，Modal 90% 宽 |
| `≥ 1024px` | 宽屏 | 当前布局不变 |

#### 4.1.2 Sidebar 折叠模式

- 窄屏时 Sidebar 宽度从 220px 缩至 48px，仅显示图标
- 悬浮图标时显示 tooltip 文字标签
- 使用 CSS `@media` + `data-collapsed` 属性切换
- 折叠时导航项隐藏文字标签，仅保留图标

```css
/* Sidebar.module.css */
@media (max-width: var(--swift-breakpoint-md)) {
  .sidebar {
    width: 48px;
  }
  .navItem span:not(.navIcon) {
    display: none;
  }
  .sectionLabel,
  .account {
    display: none;
  }
}
```

#### 4.1.3 Grid 自适应

- InstancesPage / MarketplacePage 的 `auto-fill` 增加 `min-width` 保护
- 窄屏时 `min-width` 从 280px 降为 200px

#### 4.1.4 Modal / 面板自适应

| 组件 | 当前 | 修正 |
|------|------|------|
| Modal | `min-width: 400px` | `max-width: min(90vw, 480px)` |
| SearchPalette | `width: 560px` | `max-width: min(90vw, 560px)` |
| CommandPalette | `width: 480px` | `max-width: min(90vw, 480px)` |
| ChatPanel | `width: 340px` | 窄屏时全宽 |
| DownloadPanel | `width: 360px` | 窄屏时全宽 |

### 4.2 缺失交互模式补全

#### 4.2.1 InstanceSelect 点击外部关闭

添加 `useEffect` + `ref` 监听外部点击：

```tsx
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!open) return;
  const handler = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [open]);
```

#### 4.2.2 原生弹窗替换

| 当前 | 替换为 |
|------|--------|
| LoginPage `prompt()` | 自定义 Modal 输入框 |
| InstanceDetailPage `confirm()` | 自定义确认 Modal |

#### 4.2.3 统一状态组件

创建 `StateView` 组件：统一处理 loading / empty / error 三种状态。

```tsx
interface StateViewProps {
  loading?: boolean;
  empty?: boolean;
  error?: string | null;
  emptyMessage?: string;
  children: React.ReactNode;
}

function StateView({ loading, empty, error, emptyMessage, children }: StateViewProps) {
  if (loading) return <Skeleton count={3} />;
  if (error) return <div role="alert">{error}</div>;
  if (empty) return <div>{emptyMessage || 'No items found'}</div>;
  return <>{children}</>;
}
```

#### 4.2.4 表单验证反馈

- FormField 添加 `error` prop + `aria-invalid` + `aria-describedby`
- NewInstancePage 添加实时验证（名称非空、版本已选择）

### 4.3 内联样式迁移

| 组件 | 迁移内容 |
|------|---------|
| Toggle.tsx | 全部内联样式 → `Toggle.module.css` |
| DownloadPanel.tsx | 关闭按钮内联样式 → CSS Module |
| ChatPanel.tsx | 关闭按钮内联样式 → CSS Module |
| FriendsPanel.tsx | 关闭按钮 + 空状态内联样式 → CSS Module |
| ContentDetailPage.tsx | 部分内联 → CSS Module |
| InstancesPage.tsx | 部分内联 → CSS Module |

### 4.4 验收标准

- [ ] 窗口缩至 768px 时 Sidebar 自动折叠为图标模式
- [ ] 所有 Modal/面板在窄屏不溢出
- [ ] 无原生 `alert()` / `confirm()` / `prompt()` 调用
- [ ] 所有内联样式迁移到 CSS Module
- [ ] 统一的 loading / empty / error 状态展示

---

## 5. Layer 4: 性能优化

### 5.1 React.memo

| 组件 | 原因 |
|------|------|
| ContentCard | 列表项，数量多，props 稳定 |
| ListItem | 列表项 |
| Badge | 高频使用 |
| Pagination | 页码按钮 |
| InstallButton | 列表中使用 |
| CollectionButton | 列表中使用 |

### 5.2 内联对象/函数优化

| 位置 | 修复方式 |
|------|---------|
| VersionsPage `tabs` prop | 提取为模块级常量 `const TABS = [...]` |
| MarketplacePage `tabs` prop | 同上 |
| AppShell 空函数 `() => {}` | 提取为 `const NOOP = () => {}` 模块级常量 |
| ContentDetailPage 空函数 | 同上 |

### 5.3 列表虚拟化

- VersionsPage / MarketplacePage：当列表项 > 50 时做分页截断（暂不引入虚拟滚动库）
- Pagination：当 total > 10 时显示省略号逻辑（1 2 3 ... 98 99 100）

### 5.4 any 类型清理

| 文件 | 修复 |
|------|------|
| VersionsPage.tsx | `any[]` → 使用 `api/types.ts` 中的 Version 类型 |
| MarketplacePage.tsx | `any[]` → 使用 ModResult 类型 |
| ContentDetailPage.tsx | `any` → 使用 ModProjectFull / ModVersion 类型 |
| CollectionsPage.tsx | `any` → 使用 CollectionItem 类型 |

### 5.5 验收标准

- [ ] 列表组件在 100+ 项数据时无明显卡顿
- [ ] 无 `any` 类型（TypeScript strict 模式无警告）
- [ ] React DevTools 中列表组件不因父组件渲染而重渲染

---

## 6. Apple HIG 关键参数参考

### 6.1 交互目标

| 参数 | 值 |
|------|---|
| 最小可点击区域 | 44 × 44 pt |
| 正文对比度 | ≥ 4.5:1 (WCAG AA) |
| 大文字对比度 | ≥ 3:1 |
| 交互元素对比度 | ≥ 3:1 |

### 6.2 Spring 动画参数

| 场景 | response | dampingFraction | CSS 近似 |
|------|----------|----------------|---------|
| 标准系统弹簧 | 0.55 | 0.75 | `cubic-bezier(0.2, 0, 0, 1)` |
| 轻快弹簧 | 0.35 | 0.7 | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| 平滑弹簧 | 0.5 | 0.85 | `cubic-bezier(0.2, 0, 0.1, 1)` |
| 交互弹簧 | 0.4 | 0.6 | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### 6.3 动画时长

| 类型 | 时长 |
|------|------|
| 微交互 | 100–200ms |
| 标准过渡 | 250–350ms |
| 复杂过渡 | 350–500ms |
| 强调动画 | 500–1000ms |

### 6.4 系统颜色 (Light / Dark)

| 颜色 | Light | Dark |
|------|-------|------|
| Blue (主操作) | #007AFF | #0A84FF |
| Green (成功) | #34C759 | #30D158 |
| Red (错误) | #FF3B30 | #FF453A |
| Orange (警告) | #FF9500 | #FF9F0A |
| Yellow (提醒) | #FFCC00 | #FFD60A |

### 6.5 字体层级

| 样式 | 大小 | 字重 |
|------|------|------|
| Large Title | 34pt | Semibold (600) |
| Title 1 | 28pt | Semibold (600) |
| Title 2 | 22pt | Semibold (600) |
| Title 3 | 20pt | Semibold (600) |
| Headline | 17pt | Semibold (600) |
| Body | 17pt | Regular (400) |
| Callout | 16pt | Regular (400) |
| Subheadline | 15pt | Regular (400) |
| Footnote | 13pt | Regular (400) |
| Caption 1 | 12pt | Regular (400) |
| Caption 2 | 11pt | Regular (400) |

### 6.6 Liquid Glass (WWDC 2025)

| 参数 | 值 |
|------|---|
| 模糊核半径 | 20–40pt (动态) |
| 饱和度增强 | 180% |
| 边框不透明度 | 0.3–0.5 (0.5px hairline) |
| 材质层级 | ultraThin / thin / regular / thick / ultraThick |

---

## 7. 文件变更清单

### Layer 1

| 文件 | 变更类型 |
|------|---------|
| `styles/tokens.css` | 修改 — 新增 30+ 令牌 |
| `styles/themes.css` | 修改 — 新增 light/dark 变体 |
| `styles/global.css` | 修改 — 新增 prefers-reduced-motion |
| `styles/animations.css` | 修改 — 校准 Spring 曲线 |

### Layer 2

| 文件 | 变更类型 |
|------|---------|
| `components/icons/*.tsx` (22 个) | 修改 — 添加 aria-hidden |
| `components/ui/Modal.tsx` | 修改 — 焦点陷阱 + aria-labelledby |
| `components/ui/Toggle.tsx` + 新增 `Toggle.module.css` | 修改 — ARIA + 样式迁移 |
| `components/ui/ProgressBar.tsx` | 修改 — ARIA |
| `components/ui/Spinner.tsx` | 修改 — ARIA |
| `components/ui/Skeleton.tsx` | 修改 — ARIA |
| `components/ui/Toast.tsx` | 修改 — aria-live |
| `components/ui/Tabs.tsx` | 修改 — 键盘导航 + aria-controls |
| `components/ui/Tooltip.tsx` | 修改 — 键盘触发 + ARIA |
| `components/ui/Breadcrumb.tsx` | 修改 — ARIA |
| `components/ui/Pagination.tsx` | 修改 — ARIA |
| `components/ui/SearchField.tsx` | 修改 — aria-label |
| `components/ui/Select.tsx` | 修改 — aria-label |
| `components/features/InstanceSelect.tsx` | 修改 — ARIA + 键盘导航 + 点击外部关闭 |
| `components/features/SearchPalette.tsx` | 修改 — ARIA + 键盘导航 |
| `components/features/CommandPalette.tsx` | 修改 — ARIA + 键盘导航 |
| `components/features/ContentCard.tsx` | 修改 — 键盘激活 |
| `components/layout/Sidebar.tsx` | 修改 — aria-label |
| `components/ui/List.tsx` | 修改 — 键盘激活 |

### Layer 3

| 文件 | 变更类型 |
|------|---------|
| `components/layout/Sidebar.tsx` + `Sidebar.module.css` | 修改 — 响应式折叠 |
| `components/ui/Modal.tsx` + `Modal.module.css` | 修改 — 自适应宽度 |
| `components/features/SearchPalette.tsx` + CSS | 修改 — 自适应宽度 |
| `components/features/CommandPalette.tsx` + CSS | 修改 — 自适应宽度 |
| `components/features/ChatPanel.tsx` + CSS | 修改 — 自适应宽度 + 内联样式迁移 |
| `components/features/DownloadPanel.tsx` + CSS | 修改 — 自适应宽度 + 内联样式迁移 |
| `components/features/FriendsPanel.tsx` + CSS | 修改 — 内联样式迁移 |
| `pages/LoginPage.tsx` | 修改 — prompt() → Modal |
| `pages/InstanceDetailPage.tsx` | 修改 — confirm() → Modal |
| `pages/InstancesPage.tsx` | 修改 — 内联样式迁移 |
| `pages/ContentDetailPage.tsx` | 修改 — 内联样式迁移 |
| 新增 `components/ui/StateView.tsx` + `StateView.module.css` | 新建 — 统一状态组件 |
| `components/ui/FormField.tsx` | 修改 — 错误状态 + aria-invalid |
| `pages/NewInstancePage.tsx` | 修改 — 实时验证 |

### Layer 4

| 文件 | 变更类型 |
|------|---------|
| `components/features/ContentCard.tsx` | 修改 — React.memo |
| `components/ui/List.tsx` | 修改 — React.memo (ListItem) |
| `components/ui/Badge.tsx` | 修改 — React.memo |
| `components/ui/Pagination.tsx` | 修改 — React.memo + 省略号逻辑 |
| `components/features/InstallButton.tsx` | 修改 — React.memo |
| `components/features/CollectionButton.tsx` | 修改 — React.memo |
| `pages/VersionsPage.tsx` | 修改 — tabs 常量化 + any 清理 + 分页 |
| `pages/MarketplacePage.tsx` | 修改 — tabs 常量化 + any 清理 + 分页 |
| `pages/ContentDetailPage.tsx` | 修改 — any 清理 + NOOP |
| `pages/CollectionsPage.tsx` | 修改 — any 清理 |
| `AppShell.tsx` | 修改 — NOOP 常量化 |

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| Spring 曲线校准可能影响现有动画观感 | 逐组件验证，保留 bouncy 曲线不变 |
| 响应式折叠可能影响 Sidebar 交互 | 折叠模式下 tooltip 提供文字标签 |
| Modal 焦点陷阱可能与第三方组件冲突 | 使用 `data-focus-trap` 标记管理 |
| any 类型清理可能暴露隐藏 bug | 逐文件清理，每文件独立验证 |
