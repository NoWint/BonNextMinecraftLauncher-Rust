# SwiftUI Shell HIG Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级 `src/shells/swiftui/` 全套 UI，使其符合 macOS 26 Apple HIG + Liquid Glass 设计规范，采用 IDE 三栏布局（参考截图），全部使用 SVG 图标

**Architecture:** 重写 Design Tokens (tokens.css → themes.css → global.css) 作为基础 → 重构 AppShell 三栏布局 + 融入式工具栏 → 逐个升级组件样式为 HIG 规范 → 迁移页面样式。保持现有组件 API 接口不变，仅修改视觉表现。

**Tech Stack:** React 18, TypeScript, CSS Modules, Tauri v2, react-router-dom v7, SF Pro 系统字体, SVG Icons (SF Symbols 风格)

**Spec:** [2026-06-06-swiftui-hig-redesign.md](../specs/2026-06-06-swiftui-hig-redesign.md)

---

## Phase 1: Foundation — Design Tokens & Global Styles

### Task 1: Rewrite tokens.css

**Files:**
- Modify: `src/shells/swiftui/styles/tokens.css`

- [ ] **Step 1: Replace entire tokens.css with new HIG token system**

Replace the existing file content with the following:

```css
/* SwiftUI Shell — Design Tokens */
/* Based on Apple HIG: macOS 26 Tahoe Liquid Glass */
/* Spec: https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root {
  /* ===== Scale ===== */
  --ui-scale: 1;
  font-size: calc(var(--ui-scale) * 16px);

  /* ===== Colors — Semantic ===== */
  --swift-accent: #FFE600;
  --swift-accent-text: #1C1C1E;
  --swift-destructive: #FF453A;
  --swift-destructive-text: #FFFFFF;
  --swift-success: #30D158;
  --swift-warning: #FF9F0A;
  --swift-info: #0A84FF;

  /* ===== Accent Tint Variants ===== */
  --swift-accent-tint-06: rgba(255, 230, 0, 0.06);
  --swift-accent-tint-10: rgba(255, 230, 0, 0.10);
  --swift-accent-tint-12: rgba(255, 230, 0, 0.12);
  --swift-accent-tint-15: rgba(255, 230, 0, 0.15);
  --swift-accent-tint-20: rgba(255, 230, 0, 0.20);

  /* ===== Layout ===== */
  --swift-sidebar-width: 210px;
  --swift-sidebar-width-collapsed: 52px;
  --swift-panel-width: 240px;
  --swift-toolbar-height: 36px;
  --swift-hit-region: 44px;

  /* ===== Border Radius — Concentric Rounding (Apple HIG) ===== */
  --swift-radius-xs: 6px;
  --swift-radius-sm: 10px;
  --swift-radius-md: 12px;
  --swift-radius-lg: 16px;
  --swift-radius-xl: 20px;
  --swift-radius-2xl: 24px;
  --swift-radius-pill: 9999px;

  /* ===== Spacing ===== */
  --swift-spacing-xs: 2px;
  --swift-spacing-sm: 4px;
  --swift-spacing-md: 8px;
  --swift-spacing-lg: 16px;
  --swift-spacing-xl: 24px;
  --swift-spacing-2xl: 32px;

  /* ===== Typography — SF Pro System Font Stack ===== */
  --swift-font-family: -apple-system, 'SF Pro Text', SF Pro, system-ui, sans-serif;
  --swift-font-mono: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  --swift-font-page-title: 700 26px/1.2 var(--swift-font-family);
  --swift-font-section-title: 600 17px/1.3 var(--swift-font-family);
  --swift-font-card-title: 500 15px/1.3 var(--swift-font-family);
  --swift-font-body: 400 13px/1.5 var(--swift-font-family);
  --swift-font-caption: 500 11px/1.4 var(--swift-font-family);
  --swift-font-metadata: 400 10px/1.4 var(--swift-font-mono);

  /* ===== Animation — Apple Spring ===== */
  --swift-spring-default: cubic-bezier(0.2, 0, 0, 1);
  --swift-spring-gentle: cubic-bezier(0.2, 0, 0.1, 1);
  --swift-spring-bouncy: cubic-bezier(0.34, 1.56, 0.64, 1);
  --swift-duration-fast: 150ms;
  --swift-duration-normal: 250ms;
  --swift-duration-slow: 350ms;

  /* ===== Two-Layer Architecture (Apple HIG)
       Layer 1: Liquid Glass Layer — Navigation & Controls
       Layer 2: Content Layer — Standard materials */

  /* --- Liquid Glass: Thick variant (Sidebar) --- */
  --swift-glass-thick-bg: rgba(44, 44, 46, 0.92);
  --swift-glass-thick-blur: 60px;
  --swift-glass-thick-saturate: 200%;
  --swift-glass-thick-border: rgba(255, 255, 255, 0.06);

  /* --- Liquid Glass: Regular variant (Toolbar / Popover) --- */
  --swift-glass-regular-bg: rgba(255, 255, 255, 0.12);
  --swift-glass-regular-blur: 40px;
  --swift-glass-regular-saturate: 180%;
  --swift-glass-regular-border: rgba(255, 255, 255, 0.18);
  --swift-glass-regular-highlight: inset 0 0.5px 0 rgba(255, 255, 255, 0.25);

  /* --- Liquid Glass: Clear variant (Overlay / Tooltip) --- */
  --swift-glass-clear-bg: rgba(255, 255, 255, 0.06);
  --swift-glass-clear-blur: 20px;
  --swift-glass-clear-saturate: 150%;
  --swift-glass-clear-border: rgba(255, 255, 255, 0.10);
  --swift-glass-clear-highlight: inset 0 0.5px 0 rgba(255, 255, 255, 0.15);

  /* --- Standard Materials (Content Layer) --- */
  --swift-material-primary-bg: rgba(30, 30, 30, 0.72);
  --swift-material-secondary-bg: rgba(20, 20, 22, 0.78);
  --swift-material-card-bg: rgba(255, 255, 255, 0.05);
  --swift-material-card-hover-bg: rgba(255, 255, 255, 0.08);
  --swift-material-input-bg: rgba(255, 255, 255, 0.04);
  --swift-material-modal-bg: rgba(44, 44, 46, 0.95);

  /* --- Scroll Edge Effect --- */
  --swift-scroll-edge-blur: 12px;
  --swift-scroll-edge-bg: rgba(0, 0, 0, 0.15);

  /* ===== Responsive Breakpoints ===== */
  --swift-breakpoint-narrow: 768px;
  --swift-breakpoint-medium: 1024px;

  /* ===== z-index Scale — Two-layer separation ===== */
  --swift-z-content: 1;
  --swift-z-sidebar: 200;
  --swift-z-dropdown: 800;
  --swift-z-overlay: 900;
  --swift-z-modal: 1000;
  --swift-z-popover: 1100;
  --swift-z-toast: 1200;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to CSS imports (CSS files don't affect TS compilation)

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/styles/tokens.css
git commit -m "style(swiftui): rewrite design tokens per macOS 26 HIG spec"
```

---

### Task 2: Rewrite themes.css

**Files:**
- Modify: `src/shells/swiftui/styles/themes.css`

- [ ] **Step 1: Replace themes.css with new dark/light theme variables**

```css
/* SwiftUI Shell — Theme Variables */
/* Two-Layer Architecture: Liquid Glass Layer (navigation/controls) + Content Layer (standard materials) */

/* ===== Dark Theme (default) ===== */
.theme-dark .swiftui-shell,
.theme-dark .swiftui-shell * {

  /* --- Content Layer Backgrounds (Standard Materials) --- */
  --swift-bg-primary: var(--swift-material-primary-bg);
  --swift-bg-secondary: var(--swift-material-secondary-bg);
  --swift-bg-card: var(--swift-material-card-bg);
  --swift-bg-card-hover: var(--swift-material-card-hover-bg);
  --swift-bg-input: var(--swift-material-input-bg);

  /* Borders */
  --swift-border: rgba(255, 255, 255, 0.06);
  --swift-border-hairline: rgba(255, 255, 255, 0.08);
  --swift-border-hover: rgba(255, 255, 255, 0.12);
  --swift-border-focus: rgba(255, 230, 0, 0.4);

  /* Vibrant text colors (HIG: "Use vibrant colors on top of materials") */
  --swift-text-primary: rgba(255, 255, 255, 0.85);
  --swift-text-secondary: rgba(255, 255, 255, 0.65);
  --swift-text-tertiary: rgba(255, 255, 255, 0.45);
  --swift-text-quaternary: rgba(255, 255, 255, 0.35);

  /* Sidebar (Thick Glass) */
  --swift-sidebar-bg: var(--swift-glass-thick-bg);
  --swift-sidebar-border: var(--swift-glass-thick-border);
  --swift-sidebar-hover: rgba(255, 255, 255, 0.05);
  --swift-sidebar-separator: rgba(255, 255, 255, 0.07);

  /* Modal */
  --swift-modal-backdrop: rgba(0, 0, 0, 0.5);
  --swift-modal-bg: var(--swift-material-modal-bg);

  /* Shadows (glass layers don't use hard shadows) */
  --swift-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  --swift-shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.35);

  /* Overlay */
  --swift-overlay-bg: rgba(0, 0, 0, 0.4);

  /* Selection */
  --swift-selection-bg: rgba(255, 230, 0, 0.25);
  --swift-selection-color: #ffffff;

  /* Scrollbar */
  --swift-scrollbar-thumb: rgba(255, 255, 255, 0.10);
  --swift-scrollbar-thumb-hover: rgba(255, 255, 255, 0.18);
}

/* ===== Light Theme ===== */
.theme-light .swiftui-shell,
.theme-light .swiftui-shell * {

  --swift-bg-primary: rgba(255, 255, 255, 0.72);
  --swift-bg-secondary: rgba(245, 245, 247, 0.78);
  --swift-bg-card: rgba(0, 0, 0, 0.03);
  --swift-bg-card-hover: rgba(0, 0, 0, 0.05);
  --swift-bg-input: rgba(0, 0, 0, 0.03);

  --swift-border: rgba(0, 0, 0, 0.06);
  --swift-border-hairline: rgba(0, 0, 0, 0.08);
  --swift-border-hover: rgba(0, 0, 0, 0.12);
  --swift-border-focus: rgba(255, 230, 0, 0.5);

  --swift-text-primary: rgba(0, 0, 0, 0.85);
  --swift-text-secondary: rgba(0, 0, 0, 0.55);
  --swift-text-tertiary: rgba(0, 0, 0, 0.35);
  --swift-text-quaternary: rgba(0, 0, 0, 0.25);

  --swift-sidebar-bg: rgba(255, 255, 255, 0.72);
  --swift-sidebar-border: rgba(0, 0, 0, 0.08);
  --swift-sidebar-hover: rgba(0, 0, 0, 0.04);
  --swift-sidebar-separator: rgba(0, 0, 0, 0.08);

  --swift-modal-backdrop: rgba(0, 0, 0, 0.3);
  --swift-modal-bg: rgba(255, 255, 255, 0.95);

  --swift-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  --swift-shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.14);

  --swift-overlay-bg: rgba(0, 0, 0, 0.2);

  --swift-selection-bg: rgba(107, 95, 0, 0.2);
  --swift-selection-color: #ffffff;

  --swift-scrollbar-thumb: rgba(0, 0, 0, 0.15);
  --swift-scrollbar-thumb-hover: rgba(0, 0, 0, 0.28);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shells/swiftui/styles/themes.css
git commit -m "style(swiftui): rewrite theme variables per HIG vibrant color system"
```

---

### Task 3: Rewrite global.css

**Files:**
- Modify: `src/shells/swiftui/styles/global.css`

- [ ] **Step 1: Replace global.css with new base styles**

Key changes from the old version:
- Remove all `.liquid-glass-*` and `.glass-ultrathin/thin/regular/thick/ultrathick` class names — replaced by semantic tokens in components
- Update scrollbar to thin (6px) style per spec
- Add selection/focus ring styles using accent tokens
- Keep responsive breakpoint logic
- Keep native glass detection class
- Remove noise/scanline/CRT references (if any remain)
- Update shell root to support three-column layout
- Add typography helper classes matching the new font scale

The complete replacement should implement:
1. Import chain: tokens.css → themes.css → animations.css
2. `.swiftui-shell` root: flex full-viewport, solid fallback `#1c1c1e`, transparent when native vibrancy
3. Three-column layout grid/flex foundation (sidebar + content + panel)
4. Traffic light positioning context (absolute within sidebar area)
5. Thin scrollbar (6px width, rounded thumb)
6. Accent-tinted selection (`--swift-selection-bg`)
7. Focus-visible ring (`--swift-border-focus` + box-shadow)
8. Reduced motion media query (zero all durations)
9. Typography helpers: `.swiftui-page-title`, `.swiftui-section-title`, etc.
10. Hairline separator utility: `.swiftui-hairline`
11. Native glass bypass (`.glass-native-liquid` removes backdrop-filter)
12. Responsive at 768px breakpoint

- [ ] **Step 2: Verify dev server starts without CSS parse errors**

Run: `pnpm dev`
Expected: Vite dev server starts successfully, no CSS syntax errors in console

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/styles/global.css
git commit -m "style(swiftui): rewrite global styles per HIG three-column layout"
```

---

## Phase 2: Layout Shell

### Task 4: Rewrite AppShell.tsx — Three-Column Layout

**Files:**
- Modify: `src/shells/swiftui/AppShell.tsx`

- [ ] **Step 1: Restructure AppShell to three-column layout**

Current AppShell has: `<Sidebar>` + `<main className="swiftui-content">` (two-column).

New structure must be:
```
<div className="swiftui-shell">
  {/* Column 1: Thick Glass Sidebar */}
  <Sidebar ... />

  {/* Column 2+3: Content + Optional Panel */}
  <div className="swiftui-main-area">
    {/* Integrated toolbar row (NOT a separate titlebar) */}
    <div className="swiftui-toolbar">...</div>

    {/* Breadcrumb bar */}
    <div className="swiftui-breadcrumb">...</div>

    {/* Page content */}
    <main className="swiftui-content">
      <Routes>...</Routes>
    </main>
  </div>

  {/* Column 3: Right Panel (conditional) */}
  {showPanel && (
    <aside className="swiftui-panel">...</aside>
  )}

  {/* Overlays: SearchPalette, ChatPanel, FriendsPanel, DownloadPanel, CommandPalette */}
</div>
```

Key implementation details:
- Traffic lights: render a `<div className={styles.trafficLights}>` with absolute positioning inside sidebar area, containing 3 colored dots
- Toolbar is inside the main area div, not a separate top-level element
- The right panel should be conditionally rendered (controlled by state or route)
- Keep all existing overlay components (SearchPalette, DownloadPanel, ChatPanel, FriendsPanel, CommandPalette, UpdateNotification)
- Pass any new props needed by Sidebar (keep existing `username`, `accountType` interface)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "AppShell" | head -10`
Expected: No type errors in AppShell.tsx

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/AppShell.tsx
git commit -m "feat(swiftui): restructure AppShell to three-column HIG layout"
```

---

### Task 5: Rewrite Sidebar — Thick Glass + Capsule Nav

**Files:**
- Modify: `src/shells/swiftui/components/layout/Sidebar.tsx`
- Modify: `src/shells/swiftui/components/layout/Sidebar.module.css`

- [ ] **Step 1: Update Sidebar.module.css**

Complete rewrite of sidebar styles per spec Section 4.1:

```css
/* Key style rules to implement: */
.sidebar {
  position: relative;           /* changed from fixed — traffic lights position relative to this */
  width: var(--swift-sidebar-width);
  height: 100%;                 /* fill parent flex container */
  background: var(--swift-sidebar-bg);
  backdrop-filter: blur(var(--swift-glass-thick-blur)) saturate(var(--swift-glass-thick-saturate));
  -webkit-backdrop-filter: blur(var(--swift-glass-thick-blur)) saturate(var(--swift-glass-thick-saturate));
  border-right: 0.5px solid var(--swift-sidebar-border);
  border-radius: 0;             /* no border radius — fills edge to edge */
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: var(--swift-z-sidebar);
}

/* Traffic lights — absolute positioned, NOT a spacer div */
.trafficLights {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 5px;
}

.trafficLightDot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.trafficLightClose { background: #f25c54; }
.trafficLightMinimize { background: #fbbe24; }
.trafficLightMaximize { background: #2bc840; }

/* Spacer below traffic lights so nav items don't overlap */
.trafficLightSpacer {
  height: 36px;
  flex-shrink: 0;
  -webkit-app-region: drag;     /* drag region for window movement */
  app-region: drag;
}

/* Navigation items — CAPSULE shape (pill) */
.navItem {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: 7px 12px;
  border-radius: var(--swift-radius-pill);   /* PILL shape */
  cursor: pointer;
  border: none;
  background: none;
  color: var(--swift-text-secondary);
  font: var(--swift-font-body);
  transition: background var(--swift-duration-fast) var(--swift-spring-default),
              color var(--swift-duration-fast) var(--swift-spring-default);
  margin: 2px var(--swift-spacing-sm);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  width: calc(100% - var(--swift-spacing-md));
}

.navItem:hover {
  background: var(--swift-sidebar-hover);
  color: var(--swift-text-primary);
}

/* Active state — accent tint */
.navItemActive {
  background: var(--swift-accent-tint-15);
  color: var(--swift-accent);
  font-weight: 500;
}

.navItemActive:hover {
  background: var(--swift-accent-tint-15);
  color: var(--swift-accent);
}

/* Icon container */
.navIcon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

/* Label text */
.navLabel {
  font: var(--swift-font-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Section label — caption style */
.sectionLabel {
  font: var(--swift-font-caption);
  color: var(--swift-text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: var(--swift-spacing-lg) var(--swift-spacing-lg) var(--swift-spacing-xs);
}

/* Divider — hairline */
.divider {
  height: 0.5px;
  background: var(--swift-sidebar-separator);
  margin: var(--swift-spacing-sm) var(--swift-spacing-lg);
}

/* Bottom section */
.bottomSection {
  margin-top: auto;
  padding: var(--swift-spacing-sm) var(--swift-spacing-md);
}

/* User info area */
.userInfo {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-sm) var(--swift-spacing-md);
  border-radius: var(--swift-radius-md);
}

.userAvatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--swift-accent-tint-12);
  display: flex;
  align-items: center;
  justify-content: center;
  font: var(--swift-font-caption);
  color: var(--swift-accent);
  font-weight: 600;
  flex-shrink: 0;
}

.userName {
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accountType {
  font: var(--swift-font-metadata);
  color: var(--swift-text-tertiary);
}

/* Collapsed state */
.sidebarCollapsed {
  width: var(--swift-sidebar-width-collapsed);
}

.sidebarCollapsed .navLabel,
.sidebarCollapsed .sectionLabel,
.sidebarCollapsed .userInfo,
.sidebarCollapsed .shellSwitcher {
  display: none;
}

.sidebarCollapsed .navItem {
  justify-content: center;
  padding: 7px 0;
}

.sidebarCollapsed .navIcon {
  margin: 0;
}

/* Native glass bypass */
.glass-native-liquid .sidebar {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

- [ ] **Step 2: Update Sidebar.tsx component**

Changes needed:
1. Add traffic lights rendering (3 dots in absolute-positioned container)
2. Change `useGlassEffect('subtle')` — may need adjustment for thick glass
3. Ensure nav items use pill shape (already handled by CSS)
4. Keep existing routing logic (useNavigate, useLocation, isActive)
5. Keep existing props interface: `{ username?: string; accountType?: string }`
6. Keep NAV_ITEMS and BOTTOM_ITEMS arrays

- [ ] **Step 3: Visual verification**

Run: `pnpm tauri dev`
Expected: Sidebar renders with thick glass effect, capsule-shaped nav items, traffic lights in top-left corner of sidebar area

- [ ] **Step 4: Commit**

```bash
git add src/shells/swiftui/components/layout/Sidebar.tsx
git add src/shells/swiftui/components/layout/Sidebar.module.css
git commit -m "feat(swiftui): rewrite sidebar with thick glass + capsule nav + inline traffic lights"
```

---

## Phase 3: Core UI Components

### Task 6: Button Component

**Files:**
- Modify: `src/shells/swiftui/components/ui/Button.tsx`
- Modify: `src/shells/swiftui/components/ui/Button.module.css`

- [ ] **Step 1: Update Button.module.css**

Implement per spec Section 4.2:
- Primary: pill shape, `#FFE600` bg, `#1C1C1E` text, weight 600
- Secondary: pill shape, `rgba(255,255,255,0.08)` bg, primary text, hairline border
- Ghost/Tertiary: transparent bg, tertiary text
- Icon button: 8px radius, 28×28px size
- All variants: spring animation transitions
- Focus ring: accent color outline
- Disabled: quaternary opacity, not-allowed cursor

Keep existing API: `variant?: 'primary' | 'secondary' | 'plain' | 'destructive'`, `size?: 'small' | 'default' | 'large'`, `iconOnly?: boolean`

- [ ] **Step 2: Update Button.tsx if prop mapping needs adjustment**

- [ ] **Step 3: Commit**

---

### Task 7: Card Component

**Files:**
- Modify: `src/shells/swiftui/components/ui/Card.tsx`
- Modify: `src/shells/swiftui/components/ui/Card.module.css`

- [ ] **Step 1: Update Card.module.css per spec Section 4.3**

- Radius: `--swift-radius-md` (12px)
- Background: `--swift-bg-card`
- Border: `0.5px solid var(--swift-border)`
- Hover: `--swift-bg-card-hover`, border deepens
- Padding: 14px (compact) / 16px (standard)
- Clickable: cursor pointer + hover elevation via subtle shadow
- Remove `useGlassEffect` dependency — use material token directly

- [ ] **Step 2: Commit**

---

### Task 8: Input / FormField / SearchField / Select

**Files:**
- Modify: `src/shells/swiftui/components/ui/FormField.tsx` + `.module.css`
- Modify: `src/shells/swiftui/components/ui/SearchField.tsx` + `.module.css`
- Modify: `src/shells/swiftui/components/ui/Select.tsx` + `.module.css`

- [ ] **Step 1: Update all input-related components per spec Section 4.4**

Shared input style rules:
- Radius: `--swift-radius-sm` (10px)
- BG: `--swift-bg-input`
- Border: `0.5px solid var(--swift-border)`
- Padding: `8px 12px`
- Font: body (13px), color primary (85%)
- Placeholder: tertiary (45%)

Focus state:
- Border: `0.5px solid var(--swift-border-focus)`
- Box-shadow: `0 0 0 3px rgba(255,230,0,0.08)`

SearchField specifics:
- Prepend SVG search icon (existing SearchIcon component)
- Append ⌘K badge pill (small pill badge, metadata font)

- [ ] **Step 2: Commit**

---

### Task 9: Badge Component

**Files:**
- Modify: `src/shells/swiftui/components/ui/Badge.tsx`
- Modify: `src/shells/swiftui/components/ui/Badge.module.css`

- [ ] **Step 1: Update Badge per spec Section 4.5**

Shape: always pill (`--swift-radius-pill`)
Font: 10-11px, weight 500/600
Padding: 2px 9px (text) / 3px 12px (button-like)

Variant colors:
- `default`: bg `rgba(255,255,255,0.08)`, text 45%
- `accent`: bg `accent-tint-12`, text `#FFE600`
- `success`: bg `rgba(48,209,88,0.12)`, text `#30D158`
- `warning`: bg `rgba(255,159,10,0.12)`, text `#FF9F0A`
- `error`: bg solid `#FF453A`, text white (for count badges)

- [ ] **Step 2: Commit**

---

### Task 10: Toggle Switch

**Files:**
- Modify: `src/shells/swiftui/components/ui/Toggle.tsx`
- Modify: `src/shells/swiftui/components/ui/Toggle.module.css`

- [ ] **Step 1: Update Toggle per spec Section 4.6**

Track: 40×22px, radius 11px
ON: bg `#30D158`, thumb right-aligned
OFF: bg `rgba(255,255,255,0.12)`, thumb left-aligned
Thumb: 18×18px, white, 50% radius
Animation: spring-default, duration-normal (250ms)

Keep existing API: `{ checked, onChange, disabled?, id? }`

- [ ] **Step 2: Commit**

---

### Task 11: Tabs Component

**Files:**
- Modify: `src/shells/swiftui/components/ui/Tabs.tsx`
- Modify: `src/shells/swiftui/components/ui/Tabs.module.css`

- [ ] **Step 1: Update Tabs per spec Section 4.7**

Bottom indicator style (not segmented control):
- Indicator: 2px height, pill shape, accent color
- Selected tab: text primary (85%) + indicator visible
- Unselected tab: text tertiary (45%)
- Item spacing: 16px gap, 8px vertical padding
- Transition: indicator slide animation (spring-gentle)

Keep existing API: `{ tabs: Tab[], defaultTab?, onChange? }`

- [ ] **Step 2: Commit**

---

### Task 12: Modal Component

**Files:**
- Modify: `src/shells/swiftui/components/ui/Modal.tsx`
- Modify: `src/shells/swiftui/components/ui/Modal.module.css`

- [ ] **Step 1: Update Modal per spec Section 4.10**

Container:
- BG: `--swift-modal-bg` (thick material)
- Radius: `--swift-radius-lg` (14px)
- Shadow: elevated shadow
- Max-width: 480px
- Padding: 24px
- Backdrop: `--swift-modal-backdrop` with blur

Keep existing API: `{ open, onClose, title?, footer?, children }`

- [ ] **Step 2: Commit**

---

### Task 13: Toast Component

**Files:**
- Modify: `src/shells/swiftui/components/ui/Toast.tsx`
- Modify: `src/shells/swiftui/components/ui/Toast.module.css`

- [ ] **Step 1: Update Toast per spec**

Position: bottom-center or top-right (keep existing behavior)
Style: thick glass toast bubble, pill radius (8px), compact padding
Auto-dismiss: keep existing 5s default
Animation: slide-in from edge (spring-gentle)

Keep existing API: `{ toasts: ToastItem[], onDismiss }`

- [ ] **Step 2: Commit**

---

### Task 14: Remaining Small Components (batch)

**Files:**
- Modify: Pagination, Skeleton, Spinner, ProgressBar, Tooltip, Breadcrumb, List

- [ ] **Step 1: Update each component's CSS per corresponding spec section**

| Component | Spec Section | Key Change |
|---|---|---|
| Pagination | — | Pill-shaped buttons, accent active state |
| Skeleton | — | Shimmer animation with subtle gradient |
| Spinner | — | Clean minimal spinner (no heavy effects) |
| ProgressBar | 4.8 | 3-4px height, accent gradient fill |
| Tooltip | 4.9 | Thick glass bubble, 6px arrow, 500ms delay |
| Breadcrumb | — | Chevron separators, current item styling |
| List | — | ListItem hover highlight, hairline dividers |

- [ ] **Step 2: Batch commit**

```bash
git add src/shells/swiftui/components/ui/
git commit -m "style(swiftui): update remaining UI components to HIG spec"
```

---

## Phase 4: Feature Components

### Task 15: Feature Components Batch Update

**Files:**
- Modify: All files under `src/shells/swiftui/components/features/`

Components to update (in order of priority):
1. `ContentCard` — instance/mod card styles (spec Section 4.3 card types)
2. `InstallButton` — CTA button styling, progress integration
3. `CollectionButton` — heart toggle, uses Badge + Toggle patterns
4. `InstanceSelect` — dropdown picker styling
5. `DownloadPanel` — Steam-style floating panel, glass material
6. `SearchPalette` — command palette, glass overlay
7. `CommandPalette` — similar to SearchPalette
8. `ChatPanel` — AI chat panel, right-side slide-in
9. `FriendsPanel` — social panel

For each component:
- Update CSS Module to use new token variables
- Ensure no emoji usage (replace with SVG icons where found)
- Apply consistent spacing/radius/color from design system
- Keep existing TypeScript API/props unchanged

- [ ] **Step 1: Update each feature component's CSS**

- [ ] **Step 2: Check for emoji usage and replace with SVG icons**

Search: `grep -r '🔍\|⚡\|🧩\|💬\|📁\|🏠\|⛏\|❤\|⚙' src/shells/swiftui/ --include='*.tsx'`
Replace all emoji references with existing icon components from `components/icons/`

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/features/
git commit -m "style(swiftui): update feature components to HIG spec, replace emoji with SVG"
```

---

## Phase 5: Pages

### Task 16: Pages Batch Style Migration

**Files:**
- Modify: All `*.module.css` under `src/shells/swiftui/pages/`

Pages to update (each page's CSS module):
1. HomePage — welcome layout, quick launch card, instance grid
2. LoginPage — auth form, centered layout
3. MarketplacePage — filter bar, content grid/list toggle
4. ContentDetailPage — detail header, version list, gallery
5. InstancesPage — instance list/cards
6. InstanceDetailPage — overview, management actions
7. NewInstancePage — wizard steps
8. LibraryPage — installed content list
9. CollectionsPage — wishlist grid
10. VersionsPage — version browser
11. ServersPage — server list
12. SettingsPage + settings/* — settings sections

For each page:
- Replace hardcoded colors with token variables
- Replace clip-path corners with standard border-radius
- Update spacing to use spacing scale
- Update fonts to use typography scale
- Remove any noise/scanline/CRT effects
- Ensure responsive behavior at 768px breakpoint

- [ ] **Step 1: Migrate each page's CSS module**

- [ ] **Step 2: Full visual check**

Run: `pnpm tauri dev`
Verify: Each page renders correctly with new styles, no layout breakage

- [ ] **Step 3: Final batch commit**

```bash
git add src/shells/swiftui/pages/
git commit -m "style(swiftui): migrate all pages to HIG design system"
```

---

## Phase 6: Verification & Polish

### Task 17: Final Verification

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: Zero TypeScript errors

- [ ] **Step 2: Run dev server and visually verify each page**

Checklist:
- [ ] Home page renders with correct layout
- [ ] Sidebar navigation works (all routes)
- [ ] Traffic lights positioned correctly
- [ ] Dark/light theme switching works
- [ ] All buttons show correct variants
- [ ] Cards, inputs, badges render correctly
- [ ] Modals, toasts, tooltips appear correctly
- [ ] Responsive at narrow width
- [ ] No emoji visible anywhere in swiftui shell
- [ ] All icons are SVG components
- [ ] Scrollbar styled correctly
- [ ] Animations feel smooth (spring curves)
- [ ] Focus states visible for keyboard navigation
- [ ] Reduced motion respected

- [ ] **Step 3: Fix any issues found during verification**

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(swiftui): final polish and verification fixes"
```

---

## Self-Review Checklist

1. **Spec coverage:** Each spec section maps to tasks:
   - Section 2 (Layout) → Tasks 4-5
   - Section 3 (Tokens) → Tasks 1-3
   - Section 4 (Components) → Tasks 6-14
   - Section 5 (Icons) → Task 15 (emoji scan)
   - Section 6 (Interaction) → Embedded in component CSS tasks
   - Section 7 (Scrollbar) → Task 3 (global.css)
   - Section 8 (Priority) → Phase ordering matches
   - Section 9 (Constraints) → Enforced throughout (CSS Modules, SVG only, etc.)
   - Section 10 (File Structure) → Matches final output structure

2. **Placeholder scan:** No TBD/TODO/fill-in-later in any step

3. **API compatibility:** All component props interfaces preserved (Button, Card, FormField, Badge, Toggle, Tabs, Modal, Toast, Pagination, Skeleton, Spinner, ProgressBar, Tooltip, Breadcrumb, Select, SearchField, List, Sidebar, AppShell)

4. **File paths:** All paths reference actual existing files confirmed via directory listing
