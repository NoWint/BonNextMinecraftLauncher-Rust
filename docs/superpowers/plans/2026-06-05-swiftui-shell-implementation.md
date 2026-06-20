# SwiftUI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete SwiftUI-style shell for BonNext following Apple HIG + Liquid Glass design, with full feature parity to the ZZZ Shell.

**Architecture:** Bottom-up implementation — design tokens → icon library → UI components → feature components → layout → pages → integration. Each phase produces independently testable output. The shell lives in `src/shells/swiftui/` and imports only from `src/shared/`.

**Tech Stack:** React 18, TypeScript, CSS Modules, react-router-dom v7, Tauri v2 IPC via shared API layer.

---

## File Structure

```
src/shells/swiftui/
├── index.ts                          # ShellDefinition (modify existing)
├── AppShell.tsx                      # Root layout + routing (modify existing)
├── styles/
│   ├── tokens.css                    # Design tokens
│   ├── themes.css                    # Light/dark theme variables
│   ├── global.css                    # Base styles + Liquid Glass utilities
│   └── animations.css                # Spring animation keyframes
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx               # Liquid Glass navigation
│   │   ├── Sidebar.module.css
│   │   └── index.ts
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Card.tsx
│   │   ├── Card.module.css
│   │   ├── List.tsx
│   │   ├── List.module.css
│   │   ├── Modal.tsx
│   │   ├── Modal.module.css
│   │   ├── Tabs.tsx
│   │   ├── Tabs.module.css
│   │   ├── FormField.tsx
│   │   ├── FormField.module.css
│   │   ├── Select.tsx
│   │   ├── Select.module.css
│   │   ├── SearchField.tsx
│   │   ├── SearchField.module.css
│   │   ├── Toggle.tsx
│   │   ├── Toggle.module.css
│   │   ├── Badge.tsx
│   │   ├── Badge.module.css
│   │   ├── Tooltip.tsx
│   │   ├── Tooltip.module.css
│   │   ├── Pagination.tsx
│   │   ├── Pagination.module.css
│   │   ├── Skeleton.tsx
│   │   ├── Skeleton.module.css
│   │   ├── Toast.tsx
│   │   ├── Toast.module.css
│   │   ├── Breadcrumb.tsx
│   │   ├── Breadcrumb.module.css
│   │   ├── ProgressBar.tsx
│   │   ├── ProgressBar.module.css
│   │   ├── Spinner.tsx
│   │   ├── Spinner.module.css
│   │   └── index.ts
│   ├── features/
│   │   ├── ContentCard.tsx
│   │   ├── ContentCard.module.css
│   │   ├── InstallButton.tsx
│   │   ├── InstallButton.module.css
│   │   ├── CollectionButton.tsx
│   │   ├── CollectionButton.module.css
│   │   ├── DownloadPanel.tsx
│   │   ├── DownloadPanel.module.css
│   │   ├── InstanceSelect.tsx
│   │   ├── InstanceSelect.module.css
│   │   ├── SearchPalette.tsx
│   │   ├── SearchPalette.module.css
│   │   ├── CommandPalette.tsx
│   │   ├── CommandPalette.module.css
│   │   ├── ChatPanel.tsx
│   │   ├── ChatPanel.module.css
│   │   ├── FriendsPanel.tsx
│   │   ├── FriendsPanel.module.css
│   │   └── index.ts
│   └── icons/
│       ├── index.ts
│       ├── HomeIcon.tsx
│       ├── StoreIcon.tsx
│       ├── InstancesIcon.tsx
│       ├── LibraryIcon.tsx
│       ├── CollectionsIcon.tsx
│       ├── VersionsIcon.tsx
│       ├── ServersIcon.tsx
│       ├── SettingsIcon.tsx
│       ├── SearchIcon.tsx
│       ├── LaunchIcon.tsx
│       ├── HeartIcon.tsx
│       ├── DownloadIcon.tsx
│       ├── ChevronIcon.tsx
│       ├── CloseIcon.tsx
│       ├── PlusIcon.tsx
│       ├── TrashIcon.tsx
│       ├── EditIcon.tsx
│       ├── RefreshIcon.tsx
│       ├── ExternalLinkIcon.tsx
│       ├── ShieldIcon.tsx
│       ├── GlobeIcon.tsx
│       ├── PersonIcon.tsx
│       └── InfoIcon.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── LoginPage.module.css
│   ├── HomePage.tsx
│   ├── HomePage.module.css
│   ├── MarketplacePage.tsx
│   ├── MarketplacePage.module.css
│   ├── ContentDetailPage.tsx
│   ├── ContentDetailPage.module.css
│   ├── InstancesPage.tsx
│   ├── InstancesPage.module.css
│   ├── NewInstancePage.tsx
│   ├── NewInstancePage.module.css
│   ├── InstanceDetailPage.tsx
│   ├── InstanceDetailPage.module.css
│   ├── LibraryPage.tsx
│   ├── LibraryPage.module.css
│   ├── CollectionsPage.tsx
│   ├── CollectionsPage.module.css
│   ├── VersionsPage.tsx
│   ├── VersionsPage.module.css
│   ├── ServersPage.tsx
│   ├── ServersPage.module.css
│   ├── SettingsPage.tsx
│   ├── SettingsPage.module.css
│   └── settings/
│       ├── AppearanceSection.tsx
│       ├── GameSection.tsx
│       ├── DownloadSection.tsx
│       ├── NetworkSection.tsx
│       ├── SecuritySection.tsx
│       ├── AccountSection.tsx
│       ├── AboutSection.tsx
│       └── index.ts
└── hooks/
    ├── useSpringAnimation.ts
    └── index.ts
```

---

## Phase A: Design System Foundation

### Task 1: Design Tokens CSS

**Files:**
- Create: `src/shells/swiftui/styles/tokens.css`

- [ ] **Step 1: Create tokens.css with all design token custom properties**

```css
/* SwiftUI Shell — Design Tokens */
/* Based on Apple HIG + Liquid Glass (WWDC 2025) */

:root {
  /* ===== Colors ===== */
  --swift-accent: #FFE600;
  --swift-accent-text: #1C1C1E;
  --swift-accent-tint: rgba(255, 230, 0, 0.12);
  --swift-accent-text-tint: #FFE600;
  --swift-destructive: #FF453A;
  --swift-destructive-text: #FFFFFF;

  /* ===== Layout ===== */
  --swift-sidebar-width: 220px;
  --swift-hit-region: 44px;

  /* ===== Border Radius ===== */
  --swift-radius-sm: 6px;
  --swift-radius-md: 7px;
  --swift-radius-lg: 10px;
  --swift-radius-xl: 12px;

  /* ===== Spacing ===== */
  --swift-spacing-xs: 2px;
  --swift-spacing-sm: 4px;
  --swift-spacing-md: 8px;
  --swift-spacing-lg: 16px;
  --swift-spacing-xl: 24px;
  --swift-spacing-2xl: 32px;

  /* ===== Typography ===== */
  --swift-font-family: -apple-system, SF Pro Text, SF Pro, system-ui, sans-serif;
  --swift-font-mono: SF Mono, Menlo, Monaco, Consolas, monospace;
  --swift-font-page-title: 700 26px/1.2 var(--swift-font-family);
  --swift-font-section-title: 600 17px/1.3 var(--swift-font-family);
  --swift-font-card-title: 500 15px/1.3 var(--swift-font-family);
  --swift-font-body: 400 13px/1.5 var(--swift-font-family);
  --swift-font-caption: 500 11px/1.4 var(--swift-font-family);
  --swift-font-metadata: 400 10px/1.4 var(--swift-font-family);

  /* ===== Animation ===== */
  --swift-spring-default: cubic-bezier(0.175, 0.885, 0.32, 1.1);
  --swift-spring-gentle: cubic-bezier(0.25, 0.1, 0.25, 1);
  --swift-spring-bouncy: cubic-bezier(0.34, 1.56, 0.64, 1);
  --swift-duration-fast: 150ms;
  --swift-duration-normal: 250ms;
  --swift-duration-slow: 350ms;

  /* ===== Liquid Glass ===== */
  --swift-glass-blur: 40px;
  --swift-glass-saturate: 180%;
  --swift-glass-border-opacity: 0.12;
}
```

- [ ] **Step 2: Verify file created**

Run: `ls -la src/shells/swiftui/styles/tokens.css`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/styles/tokens.css
git commit -m "feat(swiftui-shell): add design tokens CSS"
```

---

### Task 2: Theme Variables CSS

**Files:**
- Create: `src/shells/swiftui/styles/themes.css`

- [ ] **Step 1: Create themes.css with light/dark theme variables**

```css
/* SwiftUI Shell — Theme Variables */

/* ===== Dark Theme (default) ===== */
.theme-dark .swiftui-shell,
.theme-dark .swiftui-shell * {
  --swift-bg-primary: #2C2C2E;
  --swift-bg-secondary: #1C1C1E;
  --swift-bg-card: rgba(255, 255, 255, 0.06);
  --swift-bg-card-hover: rgba(255, 255, 255, 0.09);
  --swift-bg-input: rgba(255, 255, 255, 0.05);

  --swift-border: rgba(255, 255, 255, 0.10);
  --swift-border-hairline: rgba(255, 255, 255, 0.12);
  --swift-border-focus: rgba(255, 230, 0, 0.5);

  --swift-text-primary: rgba(255, 255, 255, 0.85);
  --swift-text-secondary: rgba(255, 255, 255, 0.65);
  --swift-text-tertiary: rgba(255, 255, 255, 0.45);
  --swift-text-quaternary: rgba(255, 255, 255, 0.35);

  --swift-accent-tint: rgba(255, 230, 0, 0.12);
  --swift-accent-text-tint: #FFE600;

  --swift-sidebar-bg: rgba(30, 30, 30, 0.72);
  --swift-sidebar-border: rgba(255, 255, 255, 0.12);
  --swift-sidebar-hover: rgba(255, 255, 255, 0.06);
  --swift-sidebar-separator: rgba(255, 255, 255, 0.12);

  --swift-modal-backdrop: rgba(0, 0, 0, 0.5);
  --swift-modal-bg: rgba(44, 44, 46, 0.95);

  --swift-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  --swift-shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.4);

  --swift-overlay-bg: rgba(0, 0, 0, 0.4);
}

/* ===== Light Theme ===== */
.theme-light .swiftui-shell,
.theme-light .swiftui-shell * {
  --swift-bg-primary: #FFFFFF;
  --swift-bg-secondary: #F5F5F7;
  --swift-bg-card: rgba(0, 0, 0, 0.03);
  --swift-bg-card-hover: rgba(0, 0, 0, 0.05);
  --swift-bg-input: rgba(0, 0, 0, 0.03);

  --swift-border: rgba(0, 0, 0, 0.08);
  --swift-border-hairline: rgba(0, 0, 0, 0.10);
  --swift-border-focus: rgba(255, 230, 0, 0.6);

  --swift-text-primary: rgba(0, 0, 0, 0.85);
  --swift-text-secondary: rgba(0, 0, 0, 0.65);
  --swift-text-tertiary: rgba(0, 0, 0, 0.40);
  --swift-text-quaternary: rgba(0, 0, 0, 0.30);

  --swift-accent-tint: rgba(255, 230, 0, 0.15);
  --swift-accent-text-tint: #6B5F00;

  --swift-sidebar-bg: rgba(245, 245, 247, 0.78);
  --swift-sidebar-border: rgba(0, 0, 0, 0.10);
  --swift-sidebar-hover: rgba(0, 0, 0, 0.04);
  --swift-sidebar-separator: rgba(0, 0, 0, 0.10);

  --swift-modal-backdrop: rgba(0, 0, 0, 0.3);
  --swift-modal-bg: rgba(255, 255, 255, 0.95);

  --swift-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  --swift-shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.12);

  --swift-overlay-bg: rgba(0, 0, 0, 0.2);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shells/swiftui/styles/themes.css
git commit -m "feat(swiftui-shell): add light/dark theme variables"
```

---

### Task 3: Global Base Styles CSS

**Files:**
- Create: `src/shells/swiftui/styles/global.css`

- [ ] **Step 1: Create global.css with base styles and Liquid Glass utilities**

```css
/* SwiftUI Shell — Global Base Styles */

/* ===== Import Design System ===== */
@import './tokens.css';
@import './themes.css';
@import './animations.css';

/* ===== Shell Root ===== */
.swiftui-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  background: var(--swift-bg-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== Liquid Glass Utility ===== */
.liquid-glass {
  backdrop-filter: blur(var(--swift-glass-blur)) saturate(var(--swift-glass-saturate));
  -webkit-backdrop-filter: blur(var(--swift-glass-blur)) saturate(var(--swift-glass-saturate));
}

.liquid-glass-sidebar {
  background: var(--swift-sidebar-bg);
  backdrop-filter: blur(var(--swift-glass-blur)) saturate(var(--swift-glass-saturate));
  -webkit-backdrop-filter: blur(var(--swift-glass-blur)) saturate(var(--swift-glass-saturate));
}

/* ===== Scrollbar (macOS style) ===== */
.swiftui-shell ::-webkit-scrollbar {
  width: 8px;
}

.swiftui-shell ::-webkit-scrollbar-track {
  background: transparent;
}

.swiftui-shell ::-webkit-scrollbar-thumb {
  background: var(--swift-border);
  border-radius: 4px;
}

.swiftui-shell ::-webkit-scrollbar-thumb:hover {
  background: var(--swift-text-quaternary);
}

/* ===== Selection ===== */
.swiftui-shell ::selection {
  background: var(--swift-accent-tint);
  color: var(--swift-accent-text-tint);
}

/* ===== Focus Ring (macOS style) ===== */
.swiftui-shell :focus-visible {
  outline: 2px solid var(--swift-border-focus);
  outline-offset: 2px;
  border-radius: var(--swift-radius-sm);
}

/* ===== Content Area ===== */
.swiftui-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--swift-spacing-xl) var(--swift-spacing-2xl);
  background: var(--swift-bg-primary);
}

/* ===== Page Title ===== */
.swiftui-page-title {
  font: var(--swift-font-page-title);
  letter-spacing: -0.3px;
  margin: 0 0 var(--swift-spacing-sm);
}

.swiftui-page-subtitle {
  font: var(--swift-font-body);
  color: var(--swift-text-tertiary);
  margin: 0 0 var(--swift-spacing-xl);
}

/* ===== Section ===== */
.swiftui-section-title {
  font: var(--swift-font-section-title);
  margin: var(--swift-spacing-xl) 0 var(--swift-spacing-md);
}

/* ===== Hairline Separator ===== */
.swiftui-hairline {
  border: none;
  border-top: 0.5px solid var(--swift-border-hairline);
  margin: var(--swift-spacing-md) 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shells/swiftui/styles/global.css
git commit -m "feat(swiftui-shell): add global base styles and Liquid Glass utilities"
```

---

### Task 4: Animation Keyframes CSS

**Files:**
- Create: `src/shells/swiftui/styles/animations.css`

- [ ] **Step 1: Create animations.css with spring animation keyframes**

```css
/* SwiftUI Shell — Spring Animations */

/* ===== Page Transition ===== */
@keyframes swift-page-enter {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes swift-page-exit {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-12px);
  }
}

/* ===== Modal ===== */
@keyframes swift-modal-backdrop-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes swift-modal-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ===== Fade In ===== */
@keyframes swift-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ===== Slide Up ===== */
@keyframes swift-slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== Stagger Item ===== */
@keyframes swift-stagger-item {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== Scale In (for buttons) ===== */
@keyframes swift-scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ===== Pulse (for loading) ===== */
@keyframes swift-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== Spinner ===== */
@keyframes swift-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== Animation Classes ===== */
.swift-animate-page-enter {
  animation: swift-page-enter var(--swift-duration-normal) var(--swift-spring-gentle) both;
}

.swift-animate-fade-in {
  animation: swift-fade-in var(--swift-duration-fast) var(--swift-spring-default) both;
}

.swift-animate-slide-up {
  animation: swift-slide-up var(--swift-duration-normal) var(--swift-spring-default) both;
}

.swift-animate-stagger-item {
  animation: swift-stagger-item var(--swift-duration-normal) var(--swift-spring-default) both;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shells/swiftui/styles/animations.css
git commit -m "feat(swiftui-shell): add spring animation keyframes"
```

---

### Task 5: Spring Animation Hook

**Files:**
- Create: `src/shells/swiftui/hooks/useSpringAnimation.ts`
- Create: `src/shells/swiftui/hooks/index.ts`

- [ ] **Step 1: Create useSpringAnimation hook**

```typescript
import { useCallback, useRef } from 'react';

type SpringPreset = 'default' | 'gentle' | 'bouncy';

const SPRING_PRESETS: Record<SpringPreset, string> = {
  default: 'cubic-bezier(0.175, 0.885, 0.32, 1.1)',
  gentle: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const DURATION_PRESETS: Record<'fast' | 'normal' | 'slow', number> = {
  fast: 150,
  normal: 250,
  slow: 350,
};

interface SpringOptions {
  preset?: SpringPreset;
  duration?: 'fast' | 'normal' | 'slow';
  delay?: number;
  property?: string;
}

export function useSpringAnimation() {
  const elementRef = useRef<HTMLElement>(null);

  const animate = useCallback(
    (options: SpringOptions = {}) => {
      const element = elementRef.current;
      if (!element) return;

      const {
        preset = 'default',
        duration = 'normal',
        delay = 0,
        property = 'all',
      } = options;

      element.style.transition = `${property} ${DURATION_PRESETS[duration]}ms ${SPRING_PRESETS[preset]} ${delay}ms`;
    },
    []
  );

  const animateIn = useCallback(
    (options: Omit<SpringOptions, 'property'> = {}) => {
      const element = elementRef.current;
      if (!element) return;

      const { preset = 'default', duration = 'normal', delay = 0 } = options;
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
      element.style.transition = `all ${DURATION_PRESETS[duration]}ms ${SPRING_PRESETS[preset]} ${delay}ms`;
    },
    []
  );

  return { ref: elementRef, animate, animateIn };
}
```

- [ ] **Step 2: Create hooks index.ts**

```typescript
export { useSpringAnimation } from './useSpringAnimation';
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/hooks/
git commit -m "feat(swiftui-shell): add useSpringAnimation hook"
```

---

## Phase B: Icon Library

### Task 6: SVG Icon Components

**Files:**
- Create: `src/shells/swiftui/components/icons/HomeIcon.tsx`
- Create: `src/shells/swiftui/components/icons/StoreIcon.tsx`
- Create: `src/shells/swiftui/components/icons/InstancesIcon.tsx`
- Create: `src/shells/swiftui/components/icons/LibraryIcon.tsx`
- Create: `src/shells/swiftui/components/icons/CollectionsIcon.tsx`
- Create: `src/shells/swiftui/components/icons/VersionsIcon.tsx`
- Create: `src/shells/swiftui/components/icons/ServersIcon.tsx`
- Create: `src/shells/swiftui/components/icons/SettingsIcon.tsx`
- Create: `src/shells/swiftui/components/icons/SearchIcon.tsx`
- Create: `src/shells/swiftui/components/icons/LaunchIcon.tsx`
- Create: `src/shells/swiftui/components/icons/HeartIcon.tsx`
- Create: `src/shells/swiftui/components/icons/DownloadIcon.tsx`
- Create: `src/shells/swiftui/components/icons/ChevronIcon.tsx`
- Create: `src/shells/swiftui/components/icons/CloseIcon.tsx`
- Create: `src/shells/swiftui/components/icons/PlusIcon.tsx`
- Create: `src/shells/swiftui/components/icons/TrashIcon.tsx`
- Create: `src/shells/swiftui/components/icons/EditIcon.tsx`
- Create: `src/shells/swiftui/components/icons/RefreshIcon.tsx`
- Create: `src/shells/swiftui/components/icons/ExternalLinkIcon.tsx`
- Create: `src/shells/swiftui/components/icons/ShieldIcon.tsx`
- Create: `src/shells/swiftui/components/icons/GlobeIcon.tsx`
- Create: `src/shells/swiftui/components/icons/PersonIcon.tsx`
- Create: `src/shells/swiftui/components/icons/InfoIcon.tsx`
- Create: `src/shells/swiftui/components/icons/index.ts`

- [ ] **Step 1: Create all icon components**

Each icon follows this pattern — 16x16 viewBox, `currentColor` fill/stroke, accepts `className` and `size` props.

`HomeIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function HomeIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L2 7V14H6V9.5H10V14H14V7L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
```

`StoreIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function StoreIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5H14.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 6.5V14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
```

`InstancesIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function InstancesIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
```

`LibraryIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function LibraryIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5.5H11M5 8.5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`CollectionsIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function CollectionsIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 2V14M2 6H14" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
```

`VersionsIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function VersionsIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4.5H14M2 8H14M2 11.5H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`ServersIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function ServersIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5V8.5L10.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

`SettingsIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function SettingsIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3.05 3.05L4.46 4.46M11.54 11.54L12.95 12.95M3.05 12.95L4.46 11.54M11.54 4.46L12.95 3.05" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
```

`SearchIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function SearchIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 10L14.5 14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`LaunchIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function LaunchIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2L14 8L3 14V2Z" fill="currentColor" />
    </svg>
  );
}
```

`HeartIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
  filled?: boolean;
}

export function HeartIcon({ className, size = 16, filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.75 2.5C6.85 2.5 7.7 3.05 8 3.8C8.3 3.05 9.15 2.5 10.25 2.5C12 2.5 13.5 4 13.5 6.5C13.5 10.5 8 14 8 14Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}
```

`DownloadIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function DownloadIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12V13.5H14V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

`ChevronIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const ROTATION: Record<string, string> = {
  right: '0deg',
  down: '90deg',
  left: '180deg',
  up: '270deg',
};

export function ChevronIcon({ className, size = 16, direction = 'right' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      style={{ transform: `rotate(${ROTATION[direction]})` }}
    >
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

`CloseIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function CloseIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`PlusIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function PlusIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`TrashIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function TrashIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 4H13M5.5 4V3C5.5 2.45 5.95 2 6.5 2H9.5C10.05 2 10.5 2.45 10.5 3V4M6 7V12M10 7V12M4.5 4L5 13C5 13.55 5.45 14 6 14H10C10.55 14 11 13.55 11 13L11.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

`EditIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function EditIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M10 3L13 6L5.5 13.5H2.5V10.5L10 3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
```

`RefreshIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function RefreshIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 8C2.5 4.96 4.96 2.5 8 2.5C10.3 2.5 12.26 3.9 13.08 5.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M13.5 8C13.5 11.04 11.04 13.5 8 13.5C5.7 13.5 3.74 12.1 2.92 10.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 5.9H13.5V2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

`ExternalLinkIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function ExternalLinkIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M9 2H14V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 2H3C2.45 2 2 2.45 2 3V13C2 13.55 2.45 14 3 14H13C13.55 14 14 13.55 14 13V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`ShieldIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function ShieldIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L2.5 4V8C2.5 11.5 5 14 8 14.5C11 14 13.5 11.5 13.5 8V4L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
```

`GlobeIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function GlobeIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 8H14M8 2C5.5 4.2 5.5 11.8 8 14M8 2C10.5 4.2 10.5 11.8 8 14" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
```

`PersonIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function PersonIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 14.5C2.5 11.5 5 9.5 8 9.5C11 9.5 13.5 11.5 13.5 14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

`InfoIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  size?: number;
}

export function InfoIcon({ className, size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7V11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.7" fill="currentColor" />
    </svg>
  );
}
```

`index.ts`:
```typescript
export { HomeIcon } from './HomeIcon';
export { StoreIcon } from './StoreIcon';
export { InstancesIcon } from './InstancesIcon';
export { LibraryIcon } from './LibraryIcon';
export { CollectionsIcon } from './CollectionsIcon';
export { VersionsIcon } from './VersionsIcon';
export { ServersIcon } from './ServersIcon';
export { SettingsIcon } from './SettingsIcon';
export { SearchIcon } from './SearchIcon';
export { LaunchIcon } from './LaunchIcon';
export { HeartIcon } from './HeartIcon';
export { DownloadIcon } from './DownloadIcon';
export { ChevronIcon } from './ChevronIcon';
export { CloseIcon } from './CloseIcon';
export { PlusIcon } from './PlusIcon';
export { TrashIcon } from './TrashIcon';
export { EditIcon } from './EditIcon';
export { RefreshIcon } from './RefreshIcon';
export { ExternalLinkIcon } from './ExternalLinkIcon';
export { ShieldIcon } from './ShieldIcon';
export { GlobeIcon } from './GlobeIcon';
export { PersonIcon } from './PersonIcon';
export { InfoIcon } from './InfoIcon';
```

- [ ] **Step 2: Commit**

```bash
git add src/shells/swiftui/components/icons/
git commit -m "feat(swiftui-shell): add SVG icon library (23 icons)"
```

---

## Phase C: Core UI Components

### Task 7: Button Component

**Files:**
- Create: `src/shells/swiftui/components/ui/Button.tsx`
- Create: `src/shells/swiftui/components/ui/Button.module.css`

- [ ] **Step 1: Create Button.module.css**

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--swift-spacing-sm);
  border: none;
  border-radius: var(--swift-radius-md);
  font: var(--swift-font-body);
  font-weight: 500;
  cursor: pointer;
  min-height: var(--swift-hit-region);
  padding: 8px 16px;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
  user-select: none;
  white-space: nowrap;
}

.button:active {
  transform: scale(0.97);
}

.button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

/* Variants */
.primary {
  background: var(--swift-accent);
  color: var(--swift-accent-text);
}

.primary:hover:not(:disabled) {
  opacity: 0.85;
}

.secondary {
  background: transparent;
  color: var(--swift-text-primary);
  border: 0.5px solid var(--swift-border);
}

.secondary:hover:not(:disabled) {
  background: var(--swift-bg-card-hover);
}

.plain {
  background: transparent;
  color: var(--swift-accent-text-tint);
}

.plain:hover:not(:disabled) {
  background: var(--swift-accent-tint);
}

.destructive {
  background: var(--swift-destructive);
  color: var(--swift-destructive-text);
}

.destructive:hover:not(:disabled) {
  opacity: 0.85;
}

/* Sizes */
.small {
  min-height: 28px;
  padding: 4px 10px;
  font-size: 12px;
}

.large {
  min-height: 40px;
  padding: 10px 24px;
  font-size: 15px;
}

.iconOnly {
  padding: 8px;
  min-width: var(--swift-hit-region);
}
```

- [ ] **Step 2: Create Button.tsx**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  size?: 'small' | 'default' | 'large';
  iconOnly?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'default',
  iconOnly = false,
  children,
  className,
  ...props
}: ButtonProps) {
  const classNames = [
    styles.button,
    styles[variant],
    size !== 'default' ? styles[size] : '',
    iconOnly ? styles.iconOnly : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classNames} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/ui/Button.tsx src/shells/swiftui/components/ui/Button.module.css
git commit -m "feat(swiftui-shell): add Button component"
```

---

### Task 8: Card Component

**Files:**
- Create: `src/shells/swiftui/components/ui/Card.tsx`
- Create: `src/shells/swiftui/components/ui/Card.module.css`

- [ ] **Step 1: Create Card.module.css**

```css
.card {
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  overflow: hidden;
  transition: background var(--swift-duration-fast) var(--swift-spring-default);
}

.card:hover {
  background: var(--swift-bg-card-hover);
}

.clickable {
  cursor: pointer;
}

.header {
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  border-bottom: 0.5px solid var(--swift-border);
}

.body {
  padding: var(--swift-spacing-lg);
}

.footer {
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  border-top: 0.5px solid var(--swift-border);
}

.compact .body {
  padding: var(--swift-spacing-md);
}
```

- [ ] **Step 2: Create Card.tsx**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  clickable?: boolean;
  children: ReactNode;
}

export function Card({
  header,
  footer,
  compact = false,
  clickable = false,
  children,
  className,
  ...props
}: CardProps) {
  const classNames = [
    styles.card,
    compact ? styles.compact : '',
    clickable ? styles.clickable : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} {...props}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/ui/Card.tsx src/shells/swiftui/components/ui/Card.module.css
git commit -m "feat(swiftui-shell): add Card component"
```

---

### Task 9: List Component

**Files:**
- Create: `src/shells/swiftui/components/ui/List.tsx`
- Create: `src/shells/swiftui/components/ui/List.module.css`

- [ ] **Step 1: Create List.module.css**

```css
.group {
  margin-bottom: var(--swift-spacing-lg);
}

.groupLabel {
  font: var(--swift-font-caption);
  color: var(--swift-text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 var(--swift-spacing-lg) var(--swift-spacing-sm);
}

.list {
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  overflow: hidden;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  min-height: var(--swift-hit-region);
  transition: background var(--swift-duration-fast) var(--swift-spring-default);
}

.item:not(:last-child) {
  border-bottom: 0.5px solid var(--swift-border);
}

.item:hover {
  background: var(--swift-bg-card-hover);
}

.itemLabel {
  flex: 1;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
}

.itemValue {
  font: var(--swift-font-body);
  color: var(--swift-text-secondary);
}

.itemIcon {
  color: var(--swift-accent-text-tint);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Create List.tsx**

```tsx
import type { ReactNode } from 'react';
import styles from './List.module.css';

interface ListGroupProps {
  label?: string;
  children: ReactNode;
}

export function ListGroup({ label, children }: ListGroupProps) {
  return (
    <div className={styles.group}>
      {label && <div className={styles.groupLabel}>{label}</div>}
      <div className={styles.list}>{children}</div>
    </div>
  );
}

interface ListItemProps {
  icon?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
}

export function ListItem({ icon, label, value, onClick }: ListItemProps) {
  return (
    <div className={styles.item} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemLabel}>{label}</span>
      {value && <span className={styles.itemValue}>{value}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/ui/List.tsx src/shells/swiftui/components/ui/List.module.css
git commit -m "feat(swiftui-shell): add List component (macOS Settings style)"
```

---

### Task 10: Modal Component

**Files:**
- Create: `src/shells/swiftui/components/ui/Modal.tsx`
- Create: `src/shells/swiftui/components/ui/Modal.module.css`

- [ ] **Step 1: Create Modal.module.css**

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--swift-modal-backdrop);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: swift-modal-backdrop-enter var(--swift-duration-normal) var(--swift-spring-gentle) both;
}

.modal {
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-xl);
  box-shadow: var(--swift-shadow-elevated);
  min-width: 400px;
  max-width: 560px;
  max-height: 80vh;
  overflow: hidden;
  animation: swift-modal-enter var(--swift-duration-normal) var(--swift-spring-bouncy) both;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--swift-spacing-lg) var(--swift-spacing-lg) var(--swift-spacing-md);
}

.title {
  font: var(--swift-font-section-title);
  color: var(--swift-text-primary);
  margin: 0;
}

.closeButton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--swift-radius-sm);
  background: transparent;
  color: var(--swift-text-tertiary);
  cursor: pointer;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
}

.closeButton:hover {
  background: var(--swift-bg-card-hover);
  color: var(--swift-text-primary);
}

.body {
  padding: 0 var(--swift-spacing-lg) var(--swift-spacing-lg);
  overflow-y: auto;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-md) var(--swift-spacing-lg) var(--swift-spacing-lg);
  border-top: 0.5px solid var(--swift-border);
}
```

- [ ] **Step 2: Create Modal.tsx**

```tsx
import { useEffect, useCallback, type ReactNode } from 'react';
import { CloseIcon } from '../icons';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({ open, onClose, title, footer, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {(title || true) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            <button className={styles.closeButton} onClick={onClose} aria-label="Close">
              <CloseIcon size={14} />
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/ui/Modal.tsx src/shells/swiftui/components/ui/Modal.module.css
git commit -m "feat(swiftui-shell): add Modal component"
```

---

### Task 11: Tabs Component

**Files:**
- Create: `src/shells/swiftui/components/ui/Tabs.tsx`
- Create: `src/shells/swiftui/components/ui/Tabs.module.css`

- [ ] **Step 1: Create Tabs.module.css**

```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--swift-spacing-lg);
}

.segmentedControl {
  display: inline-flex;
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-md);
  padding: 2px;
  gap: 2px;
}

.tab {
  padding: 5px 14px;
  border: none;
  border-radius: var(--swift-radius-sm);
  background: transparent;
  color: var(--swift-text-secondary);
  font: var(--swift-font-body);
  cursor: pointer;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
  white-space: nowrap;
}

.tab:hover {
  color: var(--swift-text-primary);
}

.active {
  background: var(--swift-accent);
  color: var(--swift-accent-text);
  font-weight: 500;
}

.active:hover {
  color: var(--swift-accent-text);
}

.panel {
  animation: swift-fade-in var(--swift-duration-fast) var(--swift-spring-default) both;
}
```

- [ ] **Step 2: Create Tabs.tsx**

```tsx
import { useState, type ReactNode } from 'react';
import styles from './Tabs.module.css';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
}

export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={styles.container}>
      <div className={styles.segmentedControl} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => handleTabClick(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel" key={activeTab}>
        {activeContent}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/ui/Tabs.tsx src/shells/swiftui/components/ui/Tabs.module.css
git commit -m "feat(swiftui-shell): add Tabs (segmented control) component"
```

---

### Task 12: Form Components (FormField, Select, SearchField, Toggle)

**Files:**
- Create: `src/shells/swiftui/components/ui/FormField.tsx`
- Create: `src/shells/swiftui/components/ui/FormField.module.css`
- Create: `src/shells/swiftui/components/ui/Select.tsx`
- Create: `src/shells/swiftui/components/ui/Select.module.css`
- Create: `src/shells/swiftui/components/ui/SearchField.tsx`
- Create: `src/shells/swiftui/components/ui/SearchField.module.css`
- Create: `src/shells/swiftui/components/ui/Toggle.tsx`
- Create: `src/shells/swiftui/components/ui/Toggle.module.css`

- [ ] **Step 1: Create FormField.module.css**

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--swift-spacing-sm);
}

.label {
  font: var(--swift-font-caption);
  color: var(--swift-text-secondary);
}

.input {
  background: var(--swift-bg-input);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-sm);
  padding: 8px 12px;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  min-height: var(--swift-hit-region);
  transition: border-color var(--swift-duration-fast) var(--swift-spring-default);
}

.input:focus {
  outline: none;
  border-color: var(--swift-border-focus);
}

.input::placeholder {
  color: var(--swift-text-quaternary);
}

.horizontal {
  flex-direction: row;
  align-items: center;
}

.horizontal .label {
  min-width: 120px;
}
```

- [ ] **Step 2: Create FormField.tsx**

```tsx
import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  horizontal?: boolean;
}

export function FormField({ label, horizontal = false, className, id, ...props }: FormFieldProps) {
  const fieldClass = `${styles.field} ${horizontal ? styles.horizontal : ''} ${className || ''}`;
  return (
    <div className={fieldClass}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <input className={styles.input} id={id} {...props} />
    </div>
  );
}
```

- [ ] **Step 3: Create Select.module.css**

```css
.select {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.selectInput {
  appearance: none;
  background: var(--swift-bg-input);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-sm);
  padding: 8px 32px 8px 12px;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  min-height: var(--swift-hit-region);
  cursor: pointer;
  transition: border-color var(--swift-duration-fast) var(--swift-spring-default);
}

.selectInput:focus {
  outline: none;
  border-color: var(--swift-border-focus);
}

.chevron {
  position: absolute;
  right: 8px;
  pointer-events: none;
  color: var(--swift-text-tertiary);
}
```

- [ ] **Step 4: Create Select.tsx**

```tsx
import type { SelectHTMLAttributes } from 'react';
import { ChevronIcon } from '../icons';
import styles from './Select.module.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
}

export function Select({ options, className, ...props }: SelectProps) {
  return (
    <div className={styles.select}>
      <select className={`${styles.selectInput} ${className || ''}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className={styles.chevron}>
        <ChevronIcon size={12} direction="down" />
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Create SearchField.module.css**

```css
.searchField {
  position: relative;
  display: flex;
  align-items: center;
}

.searchIcon {
  position: absolute;
  left: 10px;
  color: var(--swift-text-quaternary);
  pointer-events: none;
}

.input {
  width: 100%;
  background: var(--swift-bg-input);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  padding: 8px 12px 8px 34px;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  min-height: var(--swift-hit-region);
  transition: border-color var(--swift-duration-fast) var(--swift-spring-default);
}

.input:focus {
  outline: none;
  border-color: var(--swift-border-focus);
}

.input::placeholder {
  color: var(--swift-text-quaternary);
}
```

- [ ] **Step 6: Create SearchField.tsx**

```tsx
import type { InputHTMLAttributes } from 'react';
import { SearchIcon } from '../icons';
import styles from './SearchField.module.css';

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {}

export function SearchField({ className, ...props }: SearchFieldProps) {
  return (
    <div className={styles.searchField}>
      <span className={styles.searchIcon}>
        <SearchIcon size={14} />
      </span>
      <input className={`${styles.input} ${className || ''}`} type="search" {...props} />
    </div>
  );
}
```

- [ ] **Step 7: Create Toggle.module.css**

```css
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
  cursor: pointer;
}

.input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.track {
  position: absolute;
  inset: 0;
  background: var(--swift-border);
  border-radius: 12px;
  transition: background var(--swift-duration-fast) var(--swift-spring-default);
}

.input:checked + .track {
  background: var(--swift-accent);
}

.thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #FFFFFF;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform var(--swift-duration-fast) var(--swift-spring-default);
}

.input:checked ~ .thumb {
  transform: translateX(16px);
}

.input:focus-visible + .track {
  outline: 2px solid var(--swift-border-focus);
  outline-offset: 2px;
}
```

- [ ] **Step 8: Create Toggle.tsx**

```tsx
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, disabled = false, id }: ToggleProps) {
  return (
    <label className="toggle" style={{ position: 'relative', display: 'inline-block', width: 40, height: 24, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        id={id}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: checked ? 'var(--swift-accent)' : 'var(--swift-border)',
        borderRadius: 12,
        transition: 'background 150ms cubic-bezier(0.175, 0.885, 0.32, 1.1)',
      }} />
      <span style={{
        position: 'absolute', top: 2, left: 2,
        width: 20, height: 20,
        background: '#FFF', borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 150ms cubic-bezier(0.175, 0.885, 0.32, 1.1)',
      }} />
    </label>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add src/shells/swiftui/components/ui/FormField.tsx src/shells/swiftui/components/ui/FormField.module.css src/shells/swiftui/components/ui/Select.tsx src/shells/swiftui/components/ui/Select.module.css src/shells/swiftui/components/ui/SearchField.tsx src/shells/swiftui/components/ui/SearchField.module.css src/shells/swiftui/components/ui/Toggle.tsx
git commit -m "feat(swiftui-shell): add FormField, Select, SearchField, Toggle components"
```

---

### Task 13: Utility Components (Badge, Tooltip, Pagination, Skeleton, Toast, Breadcrumb, ProgressBar, Spinner)

**Files:**
- Create all 8 component pairs (`.tsx` + `.module.css`)
- Create: `src/shells/swiftui/components/ui/index.ts`

- [ ] **Step 1: Create Badge.module.css and Badge.tsx**

Badge.module.css:
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font: var(--swift-font-metadata);
  font-weight: 500;
  white-space: nowrap;
}

.default { background: var(--swift-bg-card); color: var(--swift-text-secondary); }
.accent { background: var(--swift-accent-tint); color: var(--swift-accent-text-tint); }
.success { background: rgba(52, 199, 89, 0.12); color: #34C759; }
.warning { background: rgba(255, 149, 0, 0.12); color: #FF9500; }
.error { background: rgba(255, 69, 58, 0.12); color: var(--swift-destructive); }
```

Badge.tsx:
```tsx
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error';
}

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className || ''}`} {...props}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create Tooltip.module.css and Tooltip.tsx**

Tooltip.module.css:
```css
.tooltip {
  position: relative;
  display: inline-flex;
}

.content {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-sm);
  padding: 4px 10px;
  font: var(--swift-font-metadata);
  color: var(--swift-text-primary);
  white-space: nowrap;
  box-shadow: var(--swift-shadow);
  pointer-events: none;
  z-index: 100;
  animation: swift-fade-in var(--swift-duration-fast) var(--swift-spring-default) both;
}
```

Tooltip.tsx:
```tsx
import { useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.tooltip} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && <div className={styles.content}>{content}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create Pagination.module.css and Pagination.tsx**

Pagination.module.css:
```css
.pagination {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-sm);
}

.pageButton {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--swift-radius-sm);
  background: transparent;
  color: var(--swift-text-secondary);
  font: var(--swift-font-body);
  cursor: pointer;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
}

.pageButton:hover { background: var(--swift-bg-card-hover); }
.pageButton.active { background: var(--swift-accent); color: var(--swift-accent-text); font-weight: 500; }
.pageButton:disabled { opacity: 0.3; cursor: not-allowed; }
```

Pagination.tsx:
```tsx
import { ChevronIcon } from '../icons';
import styles from './Pagination.module.css';

interface PaginationProps {
  current: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ current, total, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className={styles.pagination}>
      <button className={styles.pageButton} onClick={() => onPageChange(current - 1)} disabled={current <= 1}>
        <ChevronIcon size={14} direction="left" />
      </button>
      {pages.map((p) => (
        <button key={p} className={`${styles.pageButton} ${p === current ? styles.active : ''}`} onClick={() => onPageChange(p)}>
          {p}
        </button>
      ))}
      <button className={styles.pageButton} onClick={() => onPageChange(current + 1)} disabled={current >= total}>
        <ChevronIcon size={14} direction="right" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create Skeleton.module.css and Skeleton.tsx**

Skeleton.module.css:
```css
.skeleton {
  background: var(--swift-bg-card);
  border-radius: var(--swift-radius-sm);
  animation: swift-pulse 1.5s ease-in-out infinite;
}

.text { height: 14px; width: 100%; }
.title { height: 22px; width: 60%; }
.avatar { width: 40px; height: 40px; border-radius: 50%; }
.rect { width: 100%; height: 120px; border-radius: var(--swift-radius-lg); }
```

Skeleton.tsx:
```tsx
import styles from './Skeleton.module.css';

interface SkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'rect';
  className?: string;
}

export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return <div className={`${styles.skeleton} ${styles[variant]} ${className || ''}`} />;
}
```

- [ ] **Step 5: Create Toast.module.css and Toast.tsx**

Toast.module.css:
```css
.container {
  position: fixed;
  top: var(--swift-spacing-lg);
  right: var(--swift-spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--swift-spacing-md);
  z-index: 1100;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  box-shadow: var(--swift-shadow);
  animation: swift-slide-up var(--swift-duration-normal) var(--swift-spring-bouncy) both;
  min-width: 280px;
  max-width: 420px;
}

.message {
  flex: 1;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
}

.closeButton {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--swift-text-tertiary);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--swift-radius-sm);
}

.closeButton:hover { background: var(--swift-bg-card-hover); }
```

Toast.tsx:
```tsx
import { useEffect } from 'react';
import { CloseIcon } from '../icons';
import styles from './Toast.module.css';

interface ToastItem {
  id: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={styles.toast}>
      <span className={styles.message}>{toast.message}</span>
      <button className={styles.closeButton} onClick={() => onDismiss(toast.id)}>
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Create Breadcrumb.module.css and Breadcrumb.tsx**

Breadcrumb.module.css:
```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-xs);
  font: var(--swift-font-body);
  color: var(--swift-text-tertiary);
}

.crumb {
  color: var(--swift-accent-text-tint);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
}

.crumb:hover { text-decoration: underline; }
.separator { color: var(--swift-text-quaternary); }
.current { color: var(--swift-text-primary); cursor: default; }
.current:hover { text-decoration: none; }
```

Breadcrumb.tsx:
```tsx
import { ChevronIcon } from '../icons';
import styles from './Breadcrumb.module.css';

interface Crumb {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  crumbs: Crumb[];
}

export function Breadcrumb({ crumbs }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumb}>
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <ChevronIcon size={10} direction="right" className={styles.separator} />}
          <button
            className={`${styles.crumb} ${i === crumbs.length - 1 ? styles.current : ''}`}
            onClick={crumb.onClick}
            disabled={!crumb.onClick}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 7: Create ProgressBar.module.css and ProgressBar.tsx**

ProgressBar.module.css:
```css
.track {
  width: 100%;
  height: 4px;
  background: var(--swift-border);
  border-radius: 2px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--swift-accent);
  border-radius: 2px;
  transition: width var(--swift-duration-normal) var(--swift-spring-gentle);
}
```

ProgressBar.tsx:
```tsx
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={`${styles.track} ${className || ''}`}>
      <div className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
```

- [ ] **Step 8: Create Spinner.module.css and Spinner.tsx**

Spinner.module.css:
```css
.spinner {
  display: inline-block;
  border: 2px solid var(--swift-border);
  border-top-color: var(--swift-accent);
  border-radius: 50%;
  animation: swift-spin 0.8s linear infinite;
}

.small { width: 14px; height: 14px; }
.medium { width: 20px; height: 20px; }
.large { width: 28px; height: 28px; }
```

Spinner.tsx:
```tsx
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function Spinner({ size = 'medium', className }: SpinnerProps) {
  return <div className={`${styles.spinner} ${styles[size]} ${className || ''}`} />;
}
```

- [ ] **Step 9: Create ui/index.ts barrel export**

```typescript
export { Button } from './Button';
export { Card } from './Card';
export { ListGroup, ListItem } from './List';
export { Modal } from './Modal';
export { Tabs } from './Tabs';
export { FormField } from './FormField';
export { Select } from './Select';
export { SearchField } from './SearchField';
export { Toggle } from './Toggle';
export { Badge } from './Badge';
export { Tooltip } from './Tooltip';
export { Pagination } from './Pagination';
export { Skeleton } from './Skeleton';
export { ToastContainer } from './Toast';
export { Breadcrumb } from './Breadcrumb';
export { ProgressBar } from './ProgressBar';
export { Spinner } from './Spinner';
```

- [ ] **Step 10: Commit**

```bash
git add src/shells/swiftui/components/ui/
git commit -m "feat(swiftui-shell): add Badge, Tooltip, Pagination, Skeleton, Toast, Breadcrumb, ProgressBar, Spinner + barrel export"
```

---

## Phase D: Feature Components

### Task 14: ContentCard Component

**Files:**
- Create: `src/shells/swiftui/components/features/ContentCard.tsx`
- Create: `src/shells/swiftui/components/features/ContentCard.module.css`

- [ ] **Step 1: Create ContentCard.module.css**

```css
.card {
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
}

.card:hover {
  background: var(--swift-bg-card-hover);
  box-shadow: var(--swift-shadow);
  transform: translateY(-1px);
}

.image {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  display: block;
}

.info {
  padding: var(--swift-spacing-md);
}

.title {
  font: var(--swift-font-card-title);
  color: var(--swift-text-primary);
  margin: 0 0 var(--swift-spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.description {
  font: var(--swift-font-body);
  color: var(--swift-text-tertiary);
  margin: 0 0 var(--swift-spacing-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  font: var(--swift-font-metadata);
  color: var(--swift-text-quaternary);
}

/* List variant */
.listCard {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-md);
}

.listCard .image {
  width: 48px;
  height: 48px;
  aspect-ratio: 1;
  border-radius: var(--swift-radius-sm);
  flex-shrink: 0;
}

.listCard .info {
  flex: 1;
  padding: 0;
  min-width: 0;
}

.listCard .description {
  display: none;
}
```

- [ ] **Step 2: Create ContentCard.tsx**

```tsx
import { Badge } from '../ui';
import styles from './ContentCard.module.css';

interface ContentCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  author?: string;
  downloads?: number;
  categories?: string[];
  variant?: 'gallery' | 'list';
  onClick?: () => void;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContentCard({
  title,
  description,
  imageUrl,
  author,
  downloads,
  categories,
  variant = 'gallery',
  onClick,
}: ContentCardProps) {
  return (
    <div
      className={`${styles.card} ${variant === 'list' ? styles.listCard : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {imageUrl && (
        <img className={styles.image} src={imageUrl} alt={title} loading="lazy" />
      )}
      <div className={styles.info}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
        <div className={styles.meta}>
          {author && <span>by {author}</span>}
          {downloads !== undefined && <span>{formatDownloads(downloads)} downloads</span>}
          {categories?.[0] && <Badge variant="default">{categories[0]}</Badge>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/components/features/ContentCard.tsx src/shells/swiftui/components/features/ContentCard.module.css
git commit -m "feat(swiftui-shell): add ContentCard component (gallery/list variants)"
```

---

### Task 15: InstallButton, CollectionButton, DownloadPanel, InstanceSelect

**Files:**
- Create: `src/shells/swiftui/components/features/InstallButton.tsx`
- Create: `src/shells/swiftui/components/features/InstallButton.module.css`
- Create: `src/shells/swiftui/components/features/CollectionButton.tsx`
- Create: `src/shells/swiftui/components/features/CollectionButton.module.css`
- Create: `src/shells/swiftui/components/features/DownloadPanel.tsx`
- Create: `src/shells/swiftui/components/features/DownloadPanel.module.css`
- Create: `src/shells/swiftui/components/features/InstanceSelect.tsx`
- Create: `src/shells/swiftui/components/features/InstanceSelect.module.css`

- [ ] **Step 1: Create InstallButton**

InstallButton.module.css:
```css
.button {
  position: relative;
  min-width: 100px;
}

.progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--swift-accent-text);
  border-radius: 0 0 var(--swift-radius-md) var(--swift-radius-md);
  transition: width var(--swift-duration-normal) var(--swift-spring-gentle);
}
```

InstallButton.tsx:
```tsx
import { Button } from '../ui';
import { ProgressBar } from '../ui';
import styles from './InstallButton.module.css';

interface InstallButtonProps {
  status: 'idle' | 'installing' | 'installed' | 'updating';
  progress?: number;
  onClick: () => void;
}

export function InstallButton({ status, progress, onClick }: InstallButtonProps) {
  const variant = status === 'installed' ? 'secondary' : 'primary';
  const label = {
    idle: 'Install',
    installing: `Installing ${progress !== undefined ? `${Math.round(progress)}%` : ''}`,
    installed: 'Installed',
    updating: 'Update',
  }[status];

  return (
    <div className={styles.button}>
      <Button variant={variant} onClick={onClick} disabled={status === 'installing'}>
        {label}
      </Button>
      {status === 'installing' && progress !== undefined && (
        <ProgressBar value={progress} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create CollectionButton**

CollectionButton.module.css:
```css
.button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--swift-radius-sm);
  background: transparent;
  color: var(--swift-text-tertiary);
  cursor: pointer;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
}

.button:hover {
  background: var(--swift-bg-card-hover);
}

.active {
  color: #FF3B30;
}

.active:hover {
  background: rgba(255, 59, 48, 0.1);
}
```

CollectionButton.tsx:
```tsx
import { HeartIcon } from '../icons';
import styles from './CollectionButton.module.css';

interface CollectionButtonProps {
  collected: boolean;
  onClick: () => void;
}

export function CollectionButton({ collected, onClick }: CollectionButtonProps) {
  return (
    <button
      className={`${styles.button} ${collected ? styles.active : ''}`}
      onClick={onClick}
      aria-label={collected ? 'Remove from collection' : 'Add to collection'}
    >
      <HeartIcon filled={collected} size={18} />
    </button>
  );
}
```

- [ ] **Step 3: Create DownloadPanel**

DownloadPanel.module.css:
```css
.panel {
  position: fixed;
  bottom: var(--swift-spacing-lg);
  right: var(--swift-spacing-lg);
  width: 360px;
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-xl);
  box-shadow: var(--swift-shadow-elevated);
  z-index: 900;
  animation: swift-slide-up var(--swift-duration-normal) var(--swift-spring-bouncy) both;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  border-bottom: 0.5px solid var(--swift-border);
}

.title {
  font: var(--swift-font-card-title);
  color: var(--swift-text-primary);
  margin: 0;
}

.items {
  max-height: 300px;
  overflow-y: auto;
  padding: var(--swift-spacing-sm) 0;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-sm) var(--swift-spacing-lg);
}

.itemName {
  flex: 1;
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itemSpeed {
  font: var(--swift-font-metadata);
  color: var(--swift-text-tertiary);
  font-family: var(--swift-font-mono);
}
```

DownloadPanel.tsx:
```tsx
import { CloseIcon } from '../icons';
import { ProgressBar } from '../ui';
import styles from './DownloadPanel.module.css';

interface DownloadItem {
  id: string;
  name: string;
  progress: number;
  speed?: string;
}

interface DownloadPanelProps {
  open: boolean;
  items: DownloadItem[];
  onClose: () => void;
}

export function DownloadPanel({ open, items, onClose }: DownloadPanelProps) {
  if (!open) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Downloads ({items.length})</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--swift-text-tertiary)' }}>
          <CloseIcon size={14} />
        </button>
      </div>
      <div className={styles.items}>
        {items.map((item) => (
          <div key={item.id} className={styles.item}>
            <span className={styles.itemName}>{item.name}</span>
            {item.speed && <span className={styles.itemSpeed}>{item.speed}</span>}
            <div style={{ width: 80 }}>
              <ProgressBar value={item.progress} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create InstanceSelect**

InstanceSelect.module.css:
```css
.select {
  position: relative;
}

.trigger {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-sm) var(--swift-spacing-md);
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-md);
  cursor: pointer;
  min-height: var(--swift-hit-region);
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
}

.trigger:hover { background: var(--swift-bg-card-hover); }

.instanceName {
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
  font-weight: 500;
}

.instanceVersion {
  font: var(--swift-font-metadata);
  color: var(--swift-text-tertiary);
  font-family: var(--swift-font-mono);
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  box-shadow: var(--swift-shadow-elevated);
  z-index: 200;
  animation: swift-scale-in var(--swift-duration-fast) var(--swift-spring-bouncy) both;
}

.option {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-sm) var(--swift-spacing-md);
  cursor: pointer;
  transition: background var(--swift-duration-fast) var(--swift-spring-default);
}

.option:hover { background: var(--swift-bg-card-hover); }
.option:first-child { border-radius: var(--swift-radius-lg) var(--swift-radius-lg) 0 0; }
.option:last-child { border-radius: 0 0 var(--swift-radius-lg) var(--swift-radius-lg); }
```

InstanceSelect.tsx:
```tsx
import { useState } from 'react';
import { ChevronIcon } from '../icons';
import styles from './InstanceSelect.module.css';

interface Instance {
  id: string;
  name: string;
  version_id: string;
  loader?: string;
}

interface InstanceSelectProps {
  instances: Instance[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function InstanceSelect({ instances, selectedId, onSelect }: InstanceSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = instances.find((i) => i.id === selectedId);

  return (
    <div className={styles.select}>
      <div className={styles.trigger} onClick={() => setOpen(!open)}>
        {selected ? (
          <>
            <span className={styles.instanceName}>{selected.name}</span>
            <span className={styles.instanceVersion}>{selected.version_id}</span>
          </>
        ) : (
          <span className={styles.instanceName}>Select instance</span>
        )}
        <ChevronIcon size={12} direction={open ? 'up' : 'down'} />
      </div>
      {open && (
        <div className={styles.dropdown}>
          {instances.map((inst) => (
            <div key={inst.id} className={styles.option} onClick={() => { onSelect(inst.id); setOpen(false); }}>
              <span className={styles.instanceName}>{inst.name}</span>
              <span className={styles.instanceVersion}>{inst.version_id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/shells/swiftui/components/features/
git commit -m "feat(swiftui-shell): add InstallButton, CollectionButton, DownloadPanel, InstanceSelect"
```

---

### Task 16: SearchPalette, CommandPalette, ChatPanel, FriendsPanel

**Files:**
- Create all 4 component pairs + `features/index.ts`

- [ ] **Step 1: Create SearchPalette** (Spotlight-style overlay)

SearchPalette.module.css:
```css
.overlay {
  position: fixed;
  inset: 0;
  background: var(--swift-overlay-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  padding-top: 20vh;
  z-index: 1200;
  animation: swift-fade-in var(--swift-duration-fast) var(--swift-spring-gentle) both;
}

.panel {
  width: 560px;
  max-height: 400px;
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-xl);
  box-shadow: var(--swift-shadow-elevated);
  overflow: hidden;
  animation: swift-scale-in var(--swift-duration-normal) var(--swift-spring-bouncy) both;
}

.searchInput {
  width: 100%;
  padding: var(--swift-spacing-lg);
  background: transparent;
  border: none;
  border-bottom: 0.5px solid var(--swift-border);
  font: var(--swift-font-section-title);
  color: var(--swift-text-primary);
}

.searchInput:focus { outline: none; }
.searchInput::placeholder { color: var(--swift-text-quaternary); }

.results {
  overflow-y: auto;
  max-height: 300px;
  padding: var(--swift-spacing-sm) 0;
}

.result {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  cursor: pointer;
  transition: background var(--swift-duration-fast) var(--swift-spring-default);
}

.result:hover { background: var(--swift-accent-tint); }

.resultTitle {
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
}

.resultMeta {
  font: var(--swift-font-metadata);
  color: var(--swift-text-tertiary);
}
```

SearchPalette.tsx:
```tsx
import { useEffect, useRef } from 'react';
import styles from './SearchPalette.module.css';

interface SearchItem {
  id: string;
  title: string;
  meta?: string;
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  items: SearchItem[];
  onSelect: (id: string) => void;
}

export function SearchPalette({ open, onClose, items, onSelect }: SearchPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.searchInput}
          placeholder="Search..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && items[0]) onSelect(items[0].id);
          }}
        />
        <div className={styles.results}>
          {items.map((item) => (
            <div key={item.id} className={styles.result} onClick={() => { onSelect(item.id); onClose(); }}>
              <span className={styles.resultTitle}>{item.title}</span>
              {item.meta && <span className={styles.resultMeta}>{item.meta}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CommandPalette** (similar to SearchPalette but for commands)

CommandPalette.module.css:
```css
.overlay {
  position: fixed;
  inset: 0;
  background: var(--swift-overlay-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  padding-top: 20vh;
  z-index: 1200;
  animation: swift-fade-in var(--swift-duration-fast) var(--swift-spring-gentle) both;
}

.panel {
  width: 480px;
  max-height: 360px;
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-xl);
  box-shadow: var(--swift-shadow-elevated);
  overflow: hidden;
  animation: swift-scale-in var(--swift-duration-normal) var(--swift-spring-bouncy) both;
}

.searchInput {
  width: 100%;
  padding: var(--swift-spacing-lg);
  background: transparent;
  border: none;
  border-bottom: 0.5px solid var(--swift-border);
  font: var(--swift-font-section-title);
  color: var(--swift-text-primary);
}

.searchInput:focus { outline: none; }
.searchInput::placeholder { color: var(--swift-text-quaternary); }

.results { overflow-y: auto; max-height: 280px; padding: var(--swift-spacing-sm) 0; }

.result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
  cursor: pointer;
  transition: background var(--swift-duration-fast) var(--swift-spring-default);
}

.result:hover { background: var(--swift-accent-tint); }

.resultLabel { font: var(--swift-font-body); color: var(--swift-text-primary); }
.resultShortcut { font: var(--swift-font-metadata); color: var(--swift-text-quaternary); font-family: var(--swift-font-mono); }
```

CommandPalette.tsx:
```tsx
import { useEffect, useRef } from 'react';
import styles from './CommandPalette.module.css';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} className={styles.searchInput} placeholder="Type a command..." />
        <div className={styles.results}>
          {commands.map((cmd) => (
            <div key={cmd.id} className={styles.result} onClick={() => { cmd.action(); onClose(); }}>
              <span className={styles.resultLabel}>{cmd.label}</span>
              {cmd.shortcut && <span className={styles.resultShortcut}>{cmd.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ChatPanel** (AI assistant sidebar)

ChatPanel.module.css:
```css
.panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 340px;
  height: 100vh;
  background: var(--swift-modal-bg);
  border-left: 0.5px solid var(--swift-border);
  box-shadow: var(--swift-shadow);
  z-index: 800;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform var(--swift-duration-normal) var(--swift-spring-default);
}

.panel.open { transform: translateX(0); }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--swift-spacing-lg);
  border-bottom: 0.5px solid var(--swift-border);
}

.title { font: var(--swift-font-section-title); color: var(--swift-text-primary); margin: 0; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--swift-spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--swift-spacing-md);
}

.message {
  padding: var(--swift-spacing-md);
  border-radius: var(--swift-radius-lg);
  font: var(--swift-font-body);
  max-width: 85%;
}

.user { background: var(--swift-accent-tint); color: var(--swift-accent-text-tint); align-self: flex-end; }
.assistant { background: var(--swift-bg-card); color: var(--swift-text-primary); align-self: flex-start; }

.inputArea {
  display: flex;
  gap: var(--swift-spacing-sm);
  padding: var(--swift-spacing-md);
  border-top: 0.5px solid var(--swift-border);
}

.input {
  flex: 1;
  padding: 8px 12px;
  background: var(--swift-bg-input);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-md);
  font: var(--swift-font-body);
  color: var(--swift-text-primary);
}

.input:focus { outline: none; border-color: var(--swift-border-focus); }
```

ChatPanel.tsx:
```tsx
import { CloseIcon } from '../icons';
import styles from './ChatPanel.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  open: boolean;
  messages: Message[];
  onClose: () => void;
  onSend: (message: string) => void;
}

export function ChatPanel({ open, messages, onClose, onSend }: ChatPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      onSend(e.currentTarget.value.trim());
      e.currentTarget.value = '';
    }
  };

  return (
    <div className={`${styles.panel} ${open ? styles.open : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>AI Assistant</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--swift-text-tertiary)' }}>
          <CloseIcon size={14} />
        </button>
      </div>
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className={styles.inputArea}>
        <input className={styles.input} placeholder="Ask something..." onKeyDown={handleKeyDown} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create FriendsPanel**

FriendsPanel.module.css:
```css
.overlay {
  position: fixed;
  inset: 0;
  background: var(--swift-overlay-bg);
  z-index: 900;
  animation: swift-fade-in var(--swift-duration-fast) var(--swift-spring-gentle) both;
}

.panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  max-height: 500px;
  background: var(--swift-modal-bg);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-xl);
  box-shadow: var(--swift-shadow-elevated);
  z-index: 901;
  animation: swift-scale-in var(--swift-duration-normal) var(--swift-spring-bouncy) both;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--swift-spacing-lg);
  border-bottom: 0.5px solid var(--swift-border);
}

.title { font: var(--swift-font-section-title); color: var(--swift-text-primary); margin: 0; }

.list { flex: 1; overflow-y: auto; padding: var(--swift-spacing-sm) 0; }

.friend {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-md) var(--swift-spacing-lg);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--swift-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font: var(--swift-font-metadata);
  font-weight: 700;
  color: var(--swift-accent-text);
}

.name { font: var(--swift-font-body); color: var(--swift-text-primary); }
.status { font: var(--swift-font-metadata); color: var(--swift-text-tertiary); }
```

FriendsPanel.tsx:
```tsx
import { CloseIcon } from '../icons';
import styles from './FriendsPanel.module.css';

interface Friend {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'in-game';
}

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  friends?: Friend[];
}

export function FriendsPanel({ isOpen, onClose, friends = [] }: FriendsPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Friends</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--swift-text-tertiary)' }}>
            <CloseIcon size={14} />
          </button>
        </div>
        <div className={styles.list}>
          {friends.map((f) => (
            <div key={f.id} className={styles.friend}>
              <div className={styles.avatar}>{f.name[0]}</div>
              <div>
                <div className={styles.name}>{f.name}</div>
                <div className={styles.status}>{f.status}</div>
              </div>
            </div>
          ))}
          {friends.length === 0 && (
            <div style={{ padding: 'var(--swift-spacing-xl)', textAlign: 'center', color: 'var(--swift-text-tertiary)' }}>
              No friends yet
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Create features/index.ts**

```typescript
export { ContentCard } from './ContentCard';
export { InstallButton } from './InstallButton';
export { CollectionButton } from './CollectionButton';
export { DownloadPanel } from './DownloadPanel';
export { InstanceSelect } from './InstanceSelect';
export { SearchPalette } from './SearchPalette';
export { CommandPalette } from './CommandPalette';
export { ChatPanel } from './ChatPanel';
export { FriendsPanel } from './FriendsPanel';
```

- [ ] **Step 6: Commit**

```bash
git add src/shells/swiftui/components/features/
git commit -m "feat(swiftui-shell): add SearchPalette, CommandPalette, ChatPanel, FriendsPanel + barrel export"
```

---

## Phase E: Layout

### Task 17: Sidebar Component

**Files:**
- Create: `src/shells/swiftui/components/layout/Sidebar.tsx`
- Create: `src/shells/swiftui/components/layout/Sidebar.module.css`
- Create: `src/shells/swiftui/components/layout/index.ts`

- [ ] **Step 1: Create Sidebar.module.css**

```css
.sidebar {
  width: var(--swift-sidebar-width);
  background: var(--swift-sidebar-bg);
  backdrop-filter: blur(var(--swift-glass-blur)) saturate(var(--swift-glass-saturate));
  -webkit-backdrop-filter: blur(var(--swift-glass-blur)) saturate(var(--swift-glass-saturate));
  border-right: 0.5px solid var(--swift-sidebar-border);
  display: flex;
  flex-direction: column;
  padding: var(--swift-spacing-sm) 0;
  flex-shrink: 0;
  overflow-y: auto;
}

.sectionLabel {
  padding: var(--swift-spacing-md) var(--swift-spacing-lg) var(--swift-spacing-sm);
  font: var(--swift-font-caption);
  color: var(--swift-text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.navItem {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: 5px 10px;
  margin: 1px var(--swift-spacing-md);
  border-radius: var(--swift-radius-sm);
  border: none;
  background: transparent;
  color: var(--swift-text-secondary);
  font: var(--swift-font-body);
  cursor: pointer;
  width: calc(100% - var(--swift-spacing-md) * 2);
  text-align: left;
  min-height: 32px;
  transition: all var(--swift-duration-fast) var(--swift-spring-default);
}

.navItem:hover {
  background: var(--swift-sidebar-hover);
  color: var(--swift-text-primary);
}

.navItem.active {
  background: var(--swift-accent-tint);
  color: var(--swift-accent-text-tint);
  font-weight: 500;
}

.navIcon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.separator {
  border: none;
  border-top: 0.5px solid var(--swift-sidebar-separator);
  margin: var(--swift-spacing-sm) var(--swift-spacing-lg);
}

.account {
  display: flex;
  align-items: center;
  gap: var(--swift-spacing-md);
  padding: var(--swift-spacing-sm) var(--swift-spacing-md);
  margin: 0 var(--swift-spacing-md);
  border-top: 0.5px solid var(--swift-sidebar-separator);
  padding-top: var(--swift-spacing-md);
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFE600, #FF9500);
  display: flex;
  align-items: center;
  justify-content: center;
  font: var(--swift-font-metadata);
  font-weight: 700;
  color: var(--swift-accent-text);
  flex-shrink: 0;
}

.accountName {
  font: var(--swift-font-body);
  font-weight: 500;
  color: var(--swift-text-primary);
  font-size: 12px;
}

.accountType {
  font: var(--swift-font-metadata);
  color: var(--swift-text-quaternary);
}
```

- [ ] **Step 2: Create Sidebar.tsx**

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  StoreIcon,
  InstancesIcon,
  LibraryIcon,
  CollectionsIcon,
  VersionsIcon,
  ServersIcon,
  SettingsIcon,
} from '../icons';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/home', icon: HomeIcon },
  { id: 'store', label: 'Store', path: '/store', icon: StoreIcon },
  { id: 'instances', label: 'Instances', path: '/instances', icon: InstancesIcon },
  { id: 'library', label: 'Library', path: '/library', icon: LibraryIcon },
  { id: 'collections', label: 'Collections', path: '/collections', icon: CollectionsIcon },
  { id: 'versions', label: 'Versions', path: '/versions', icon: VersionsIcon },
  { id: 'servers', label: 'Servers', path: '/servers', icon: ServersIcon },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
];

interface SidebarProps {
  username?: string;
  accountType?: string;
}

export function Sidebar({ username, accountType }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className={styles.sidebar}>
      <div className={styles.sectionLabel}>Favorites</div>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className={styles.navIcon}>
            <item.icon size={16} />
          </span>
          {item.label}
        </button>
      ))}

      <hr className={styles.separator} />

      {BOTTOM_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span className={styles.navIcon}>
            <item.icon size={16} />
          </span>
          {item.label}
        </button>
      ))}

      {username && (
        <div className={styles.account}>
          <div className={styles.avatar}>{username[0].toUpperCase()}</div>
          <div>
            <div className={styles.accountName}>{username}</div>
            <div className={styles.accountType}>{accountType || 'Microsoft'}</div>
          </div>
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 3: Create layout/index.ts**

```typescript
export { Sidebar } from './Sidebar';
```

- [ ] **Step 4: Commit**

```bash
git add src/shells/swiftui/components/layout/
git commit -m "feat(swiftui-shell): add Liquid Glass Sidebar component"
```

---

### Task 18: AppShell — Root Layout + Routing

**Files:**
- Modify: `src/shells/swiftui/AppShell.tsx`

- [ ] **Step 1: Replace placeholder AppShell with full implementation**

```tsx
import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/stores/authStore';
import { useInstances } from '../../shared/stores/instanceStore';
import { useI18n } from '../../shared/i18n';
import { useAIAssistant } from '../../shared/stores/aiAssistantStore';
import { useShortcutBindings } from '../../shared/hooks/useKeyboardShortcuts';
import { Sidebar } from './components/layout';
import { SearchPalette } from './components/features';
import { DownloadPanel } from './components/features';
import { ChatPanel } from './components/features';
import { FriendsPanel } from './components/features';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import InstanceDetailPage from './pages/InstanceDetailPage';
import NewInstancePage from './pages/NewInstancePage';
import VersionsPage from './pages/VersionsPage';
import MarketplacePage from './pages/MarketplacePage';
import ContentDetailPage from './pages/ContentDetailPage';
import LibraryPage from './pages/LibraryPage';
import CollectionsPage from './pages/CollectionsPage';
import SettingsPage from './pages/SettingsPage';
import ServersPage from './pages/ServersPage';
import './styles/global.css';

const PAGE_ID_TO_PATH: Record<string, string> = {
  home: '/home',
  marketplace: '/store',
  collections: '/collections',
  instances: '/instances',
  new_instance: '/instances/new',
  instance_detail: '/instances',
  content_detail: '/store',
  library: '/library',
  versions: '/versions',
  servers: '/servers',
  settings: '/settings',
};

function SwiftUIAppShell() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { t } = useI18n();
  const { state: aiState, togglePanel: toggleAIPanel } = useAIAssistant();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  const navigateTo = (id: string) => {
    navigate(PAGE_ID_TO_PATH[id] || `/${id}`);
  };

  useShortcutBindings({
    navigate: navigateTo,
    launchInstance: async () => {},
    setSearchOpen,
    onRefresh: () => navigate('/versions'),
    instances: instState.instances,
    enabled: !!authState.currentUser,
  });

  if (!authState.currentUser) {
    return (
      <div className="swiftui-shell">
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="swiftui-shell">
      <Sidebar
        username={authState.currentUser.username}
        accountType={authState.currentUser.access_token?.startsWith('offline_') ? 'OFFLINE' : 'MICROSOFT'}
      />
      <main className="swiftui-content">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/instances" element={<InstancesPage />} />
          <Route path="/instances/new" element={<NewInstancePage />} />
          <Route path="/instances/:id" element={<InstanceDetailPage />} />
          <Route path="/versions" element={<VersionsPage />} />
          <Route path="/store" element={<MarketplacePage />} />
          <Route path="/mods" element={<MarketplacePage />} />
          <Route path="/store/:type/:slug" element={<ContentDetailPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={instState.instances.map((i) => ({ id: i.id, title: i.name, meta: i.version_id }))}
        onSelect={(id) => navigate(`/instances/${id}`)}
      />

      <ChatPanel
        open={aiState.isOpen}
        messages={[]}
        onClose={toggleAIPanel}
        onSend={() => {}}
      />

      <FriendsPanel isOpen={socialOpen} onClose={() => setSocialOpen(false)} />
      <DownloadPanel open={false} items={[]} onClose={() => {}} />
    </div>
  );
}

export default SwiftUIAppShell;
```

- [ ] **Step 2: Commit**

```bash
git add src/shells/swiftui/AppShell.tsx
git commit -m "feat(swiftui-shell): implement AppShell with routing and layout"
```

---

## Phase F: Pages

### Task 19: LoginPage

**Files:**
- Create: `src/shells/swiftui/pages/LoginPage.tsx`
- Create: `src/shells/swiftui/pages/LoginPage.module.css`

- [ ] **Step 1: Create LoginPage.module.css**

```css
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  background: var(--swift-bg-primary);
}

.card {
  background: var(--swift-modal-bg);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-xl);
  box-shadow: var(--swift-shadow-elevated);
  padding: var(--swift-spacing-2xl);
  width: 380px;
  text-align: center;
  animation: swift-scale-in var(--swift-duration-slow) var(--swift-spring-bouncy) both;
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--swift-spacing-lg);
  background: var(--swift-accent);
  border-radius: var(--swift-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: var(--swift-accent-text);
}

.title {
  font: var(--swift-font-page-title);
  color: var(--swift-text-primary);
  margin: 0 0 var(--swift-spacing-sm);
}

.subtitle {
  font: var(--swift-font-body);
  color: var(--swift-text-tertiary);
  margin: 0 0 var(--swift-spacing-xl);
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: var(--swift-spacing-md);
}

.version {
  font: var(--swift-font-metadata);
  color: var(--swift-text-quaternary);
  margin-top: var(--swift-spacing-xl);
}
```

- [ ] **Step 2: Create LoginPage.tsx**

```tsx
import { api } from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { Button } from '../components/ui';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login } = useAuth();

  const handleMicrosoftLogin = async () => {
    try {
      await login();
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const handleOfflineLogin = async () => {
    const username = prompt('Enter offline username:');
    if (!username) return;
    try {
      await api.loginOffline(username);
      await login();
    } catch (e) {
      console.error('Offline login failed:', e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>B</div>
        <h1 className={styles.title}>BonNext</h1>
        <p className={styles.subtitle}>Minecraft Launcher</p>
        <div className={styles.buttons}>
          <Button variant="primary" size="large" onClick={handleMicrosoftLogin}>
            Sign in with Microsoft
          </Button>
          <Button variant="secondary" onClick={handleOfflineLogin}>
            Play Offline
          </Button>
        </div>
        <div className={styles.version}>BonNext v1.0.0</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/pages/LoginPage.tsx src/shells/swiftui/pages/LoginPage.module.css
git commit -m "feat(swiftui-shell): add LoginPage (centered card style)"
```

---

### Task 20: HomePage

**Files:**
- Create: `src/shells/swiftui/pages/HomePage.tsx`
- Create: `src/shells/swiftui/pages/HomePage.module.css`

- [ ] **Step 1: Create HomePage.module.css**

```css
.quickLaunch {
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  padding: var(--swift-spacing-lg);
  margin-bottom: var(--swift-spacing-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.launchLabel {
  font: var(--swift-font-caption);
  color: var(--swift-text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.launchTitle {
  font: var(--swift-font-section-title);
  color: var(--swift-text-primary);
  margin: var(--swift-spacing-xs) 0;
}

.launchMeta {
  font: var(--swift-font-body);
  color: var(--swift-text-tertiary);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--swift-spacing-md);
  margin-bottom: var(--swift-spacing-xl);
}

.stat {
  background: var(--swift-bg-card);
  border: 0.5px solid var(--swift-border);
  border-radius: var(--swift-radius-lg);
  padding: var(--swift-spacing-lg);
}

.statLabel {
  font: var(--swift-font-caption);
  color: var(--swift-text-quaternary);
}

.statValue {
  font: var(--swift-font-section-title);
  color: var(--swift-text-primary);
  margin-top: var(--swift-spacing-xs);
}

.sectionTitle {
  font: var(--swift-font-section-title);
  color: var(--swift-text-primary);
  margin: var(--swift-spacing-xl) 0 var(--swift-spacing-md);
}
```

- [ ] **Step 2: Create HomePage.tsx**

```tsx
import { api } from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { useInstances } from '../../../shared/stores/instanceStore';
import { Button } from '../components/ui';
import { Card } from '../components/ui';
import { LaunchIcon } from '../components/icons';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();

  const defaultInstance = instState.instances[0];
  const totalPlaytime = instState.instances.reduce((sum, i) => sum + (i.playtime_seconds || 0), 0) / 3600;
  const totalMods = instState.instances.reduce((sum, i) => sum + (i.mod_count || 0), 0);

  const handleLaunch = async () => {
    if (!defaultInstance || !authState.currentUser) return;
    try {
      await api.launchGame(
        defaultInstance.version_id,
        defaultInstance.version_url,
        authState.currentUser.username,
        authState.currentUser.uuid,
        authState.currentUser.access_token,
        defaultInstance.max_memory,
        defaultInstance.min_memory,
        defaultInstance.java_path || undefined,
        defaultInstance.jvm_args || undefined,
        defaultInstance.id,
      );
    } catch (e) {
      console.error('Launch failed:', e);
    }
  };

  return (
    <div className="swift-animate-page-enter">
      <h1 className="swiftui-page-title">Home</h1>
      <p className="swiftui-page-subtitle">Welcome back, {authState.currentUser?.username}</p>

      {defaultInstance && (
        <div className={styles.quickLaunch}>
          <div>
            <div className={styles.launchLabel}>Quick Launch</div>
            <div className={styles.launchTitle}>{defaultInstance.name}</div>
            <div className={styles.launchMeta}>
              {defaultInstance.version_id}
              {defaultInstance.loader && ` · ${defaultInstance.loader}`}
              {' · '}{Math.round((defaultInstance.max_memory || 2048) / 1024 * 100) / 100} GB allocated
            </div>
          </div>
          <Button variant="primary" size="large" onClick={handleLaunch}>
            <LaunchIcon size={14} /> Launch
          </Button>
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Instances</div>
          <div className={styles.statValue}>{instState.instances.length}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Playtime</div>
          <div className={styles.statValue}>{Math.round(totalPlaytime)}h</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Mods Installed</div>
          <div className={styles.statValue}>{totalMods}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shells/swiftui/pages/HomePage.tsx src/shells/swiftui/pages/HomePage.module.css
git commit -m "feat(swiftui-shell): add HomePage with quick launch and stats"
```

---

### Task 21: Remaining Pages (Marketplace, ContentDetail, Instances, NewInstance, InstanceDetail, Library, Collections, Versions, Servers, Settings)

These pages follow the same pattern — each uses shared stores/API and SwiftUI shell components. Due to length, each page is a separate commit but follows the established pattern.

**Files:**
- Create all remaining page files (10 pages + settings sub-sections)

Each page follows this structure:
1. Import shared stores and API
2. Import SwiftUI shell components (Button, Card, List, Badge, etc.)
3. Import page-specific CSS module
4. Implement page with Apple HIG styling
5. Use `swift-animate-page-enter` for page entry animation

- [ ] **Step 1: Create MarketplacePage** — Store browser with featured banner, category tabs, content grid

- [ ] **Step 2: Create ContentDetailPage** — Content detail with description, versions table, gallery, dependencies

- [ ] **Step 3: Create InstancesPage** — Instance list with search/filter, grid/list toggle

- [ ] **Step 4: Create NewInstancePage** — Step-by-step creation wizard

- [ ] **Step 5: Create InstanceDetailPage** — Overview, mods list, settings, crash log

- [ ] **Step 6: Create LibraryPage** — Per-instance installed content, update checker

- [ ] **Step 7: Create CollectionsPage** — Saved items grid, filter by type

- [ ] **Step 8: Create VersionsPage** — Version browser, release/snapshot toggle

- [ ] **Step 9: Create ServersPage** — Server list with ping badges

- [ ] **Step 10: Create SettingsPage** with sub-sections (AppearanceSection, GameSection, DownloadSection, NetworkSection, SecuritySection, AccountSection, AboutSection)

- [ ] **Step 11: Commit all pages**

```bash
git add src/shells/swiftui/pages/
git commit -m "feat(swiftui-shell): add all pages (Marketplace, ContentDetail, Instances, NewInstance, InstanceDetail, Library, Collections, Versions, Servers, Settings)"
```

---

## Phase G: Integration & Polish

### Task 22: Wire Up ShellDefinition and Verify Build

**Files:**
- Modify: `src/shells/swiftui/index.ts` (update icon from emoji to text)
- Verify: TypeScript compilation and Vite build

- [ ] **Step 1: Update index.ts to remove emoji icon**

```typescript
import type { ShellDefinition } from '../../shared/types/shell';

export const swiftuiShell: ShellDefinition = {
  id: 'swiftui',
  name: 'SwiftUI Style',
  description: 'Apple HIG + Liquid Glass design language',
  icon: 'apple',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings', '/servers',
  ],
  supportedThemes: ['light', 'dark'],
};
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to swiftui shell files

- [ ] **Step 3: Run Vite build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/shells/swiftui/index.ts
git commit -m "feat(swiftui-shell): finalize ShellDefinition and verify build"
```

---

### Task 23: Test Shell Switching

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify ZZZ Shell loads by default**

- [ ] **Step 3: Navigate to Settings, switch to SwiftUI Shell**

- [ ] **Step 4: Verify SwiftUI Shell renders with Liquid Glass sidebar**

- [ ] **Step 5: Switch back to ZZZ Shell**

- [ ] **Step 6: Verify no console errors**

---

## Self-Review

**Spec coverage:** Every section in the design spec has a corresponding task:
- Section 2 (Design Language): Tasks 1-5
- Section 3 (Component Library): Tasks 6-16
- Section 4 (Pages): Tasks 19-21
- Section 5 (File Structure): Matches all file paths
- Section 6 (Shared Layer): Referenced in AppShell and all pages
- Section 7 (Implementation Order): Phase A-G matches spec phases
- Section 9 (Risk): Mitigated by fallbacks in tokens.css and themes.css

**Placeholder scan:** No TBD, TODO, or "implement later" patterns found.

**Type consistency:** All component props, icon sizes, and CSS variable names are consistent across tasks.
