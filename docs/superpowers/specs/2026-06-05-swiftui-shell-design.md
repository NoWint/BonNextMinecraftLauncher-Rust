# SwiftUI Shell Design Specification

**Date:** 2026-06-05
**Status:** Draft
**Parent:** Multi-Shell Architecture (`docs/superpowers/plans/2026-06-05-multi-shell-architecture.md`)

---

## 1. Overview

SwiftUI Shell is a native macOS-style UI shell for BonNext, strictly following Apple Human Interface Guidelines (HIG) and the new Liquid Glass design system introduced at WWDC 2025. It provides the same feature set as the ZZZ Shell but with a completely independent component library and visual language.

### Design Decisions Summary

| Decision | Choice |
|----------|--------|
| Design positioning | Native macOS style, strict Apple HIG compliance |
| Navigation layout | Two-column NavigationSplitView + system-level blur |
| Accent color | Brand yellow #FFE600 |
| Page scope | Full parity with ZZZ Shell |
| Component strategy | Completely independent component library |
| Animation | Apple spring animations via CSS |
| Font | SF Pro (`-apple-system, SF Pro Text, system-ui`) |
| Icons | SVG inline (SF Symbols style) |
| Liquid Glass tech | CSS `backdrop-filter: blur() saturate()` |
| Shell switching | Settings page only |
| Login page | Centered card style |
| Implementation strategy | Bottom-up: tokens → components → pages |

---

## 2. Design Language

### 2.1 Liquid Glass (WWDC 2025)

Apple's Liquid Glass is a translucent material that reflects and refracts its surroundings. In our web implementation:

- **Sidebar:** `regular` variant — `backdrop-filter: blur(40px) saturate(180%)`
- **Content layer:** Standard materials (no Liquid Glass in content area per HIG)
- **Border:** `0.5px solid` at 8-12% opacity (Apple standard hairline)
- **Sidebar floats above content** — not anchored to window edges
- **Content extends beneath sidebar** — reinforces floating appearance

CSS implementation:
```css
.sidebar {
  background: rgba(30, 30, 30, 0.72); /* dark mode */
  background: rgba(245, 245, 247, 0.78); /* light mode */
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-right: 0.5px solid rgba(255, 255, 255, 0.12); /* dark */
  border-right: 0.5px solid rgba(0, 0, 0, 0.10); /* light */
}
```

### 2.2 Color System

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `--accent` | `#FFE600` | `#FFE600` | Buttons, active states, links |
| `--accent-text` | `#1C1C1E` | `#1C1C1E` | Text on accent backgrounds |
| `--accent-tint` | `rgba(255,230,0,0.12)` | `rgba(255,230,0,0.15)` | Active item background |
| `--accent-text-tint` | `#FFE600` | `#6B5F00` | Active item text |
| `--bg-primary` | `#2C2C2E` | `#FFFFFF` | Content area background |
| `--bg-secondary` | `#1C1C1E` | `#F5F5F7` | Sidebar background base |
| `--bg-card` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.03)` | Card backgrounds |
| `--border` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.08)` | Card/item borders |
| `--border-hairline` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.10)` | Sidebar separator |
| `--text-primary` | `rgba(255,255,255,0.85)` | `rgba(0,0,0,0.85)` | Primary text |
| `--text-secondary` | `rgba(255,255,255,0.65)` | `rgba(0,0,0,0.65)` | Secondary text |
| `--text-tertiary` | `rgba(255,255,255,0.45)` | `rgba(0,0,0,0.40)` | Tertiary text |
| `--text-quaternary` | `rgba(255,255,255,0.35)` | `rgba(0,0,0,0.30)` | Label text |
| `--destructive` | `#FF453A` | `#FF3B30` | Destructive actions |

### 2.3 Typography

Following Apple HIG macOS specifications:

| Style | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| Page title | 26px | Bold (700) | -0.3px | Page heading |
| Section title | 17px | Semibold (600) | 0 | Section heading |
| Card title | 15px | Medium (500) | 0 | Card heading |
| Body | 13px | Regular (400) | 0 | Body text |
| Caption | 11px | Medium (500) | 0.5px | Section labels, uppercase |
| Metadata | 10px | Regular (400) | 0 | Subtitle, account info |

Font stack: `-apple-system, SF Pro Text, SF Pro, system-ui, sans-serif`

Monospace (for data): `SF Mono, Menlo, Monaco, Consolas, monospace`

### 2.4 Layout & Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-width` | 220px | NavigationSplitView sidebar |
| `--radius-sm` | 6px | Sidebar items, small buttons |
| `--radius-md` | 7px | Primary buttons |
| `--radius-lg` | 10px | Cards, panels |
| `--radius-xl` | 12px | Large cards, modals |
| `--spacing-xs` | 2px | Tight spacing |
| `--spacing-sm` | 4px | Between related items |
| `--spacing-md` | 8px | Standard item gap |
| `--spacing-lg` | 16px | Section gap |
| `--spacing-xl` | 24px | Page padding |
| `--hit-region` | 44px | Minimum touch/click target |

### 2.5 Animation

Apple spring animation via CSS:

```css
:root {
  --spring-default: cubic-bezier(0.175, 0.885, 0.32, 1.1);
  --spring-gentle: cubic-bezier(0.25, 0.1, 0.25, 1);
  --spring-bouncy: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
}
```

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Hover state | 150ms | spring-default | Button/item hover |
| Page transition | 250ms | spring-gentle | Route change (slide + fade) |
| Sidebar item | 200ms | spring-default | Selection change |
| Modal appear | 300ms | spring-bouncy | Sheet/modal presentation |
| List stagger | 50ms delay | spring-default | List item appear |

---

## 3. Component Library

### 3.1 Component Inventory

All components are in `src/shells/swiftui/components/`. Each component has a `.tsx` and `.module.css` file.

#### Layout Components (`layout/`)

| Component | Description |
|-----------|-------------|
| `Sidebar` | Liquid Glass navigation sidebar with SF Symbols-style SVG icons |
| `AppShell` | Root layout: Sidebar + content area with Routes |
| `TitleBar` | Optional: macOS-style traffic light area |

#### UI Components (`ui/`)

| Component | Description |
|-----------|-------------|
| `Button` | Push button: primary (accent fill), secondary (bordered), plain (text only) |
| `Modal` | Sheet-style modal with backdrop blur |
| `Tabs` | Segmented control style tabs |
| `Card` | Rounded rect card with optional header/footer |
| `List` | macOS Settings-style grouped list |
| `FormField` | Label + input group |
| `Select` | Pop-up button style dropdown |
| `SearchField` | Rounded search input with magnifying glass icon |
| `Toggle` | macOS-style switch |
| `Badge` | Small status indicator |
| `Tooltip` | Hover tooltip (macOS standard) |
| `Pagination` | Page navigation |
| `Skeleton` | Loading placeholder |
| `Toast` | Notification banner |
| `Breadcrumb` | Path navigation |
| `ProgressBar` | Determinate progress |
| `Spinner` | Indeterminate loading indicator |

#### Feature Components (`features/`)

| Component | Description |
|-----------|-------------|
| `ContentCard` | Mod/texture pack card (gallery/list variants) |
| `InstallButton` | Install flow with progress |
| `CollectionButton` | Heart toggle for wishlist |
| `DownloadPanel` | Floating download manager |
| `InstanceSelect` | Instance picker with version/loader badges |
| `SearchPalette` | Spotlight-style search overlay |
| `CommandPalette` | Command palette overlay |
| `ChatPanel` | AI assistant panel |
| `FriendsPanel` | Social panel |

### 3.2 Button Specifications

Following Apple HIG macOS push button specs:

| Variant | Background | Text Color | Border | Corner Radius |
|---------|-----------|------------|--------|---------------|
| Primary | `var(--accent)` | `var(--accent-text)` | none | 7px |
| Secondary | transparent | `var(--text-primary)` | `0.5px solid var(--border)` | 7px |
| Plain | transparent | `var(--accent)` | none | 7px |
| Destructive | `var(--destructive)` | `#FFFFFF` | none | 7px |

States: default → hover (opacity 0.85) → pressed (scale 0.97) → disabled (opacity 0.4)

### 3.3 Sidebar Specifications

Following Apple HIG Sidebar guidelines:

- **Floats above content** — not anchored to edges
- **Content extends beneath** — visual continuity
- **Row height:** 28px (compact), 32px (default)
- **Icon size:** 16px, SVG inline
- **Active state:** accent tint background + accent text
- **Hover state:** subtle background highlight
- **Section headers:** 11px uppercase, 0.5px tracking
- **Separator:** 0.5px hairline
- **Account area:** Bottom of sidebar, avatar + name + account type

Navigation items (top to bottom):
1. Home
2. Store
3. Instances
4. Library
5. Collections
6. Versions
7. Servers
8. --- separator ---
9. Settings
10. --- separator ---
11. Account (avatar + name)

---

## 4. Pages

All pages in `src/shells/swiftui/pages/`. Each page uses shared stores and API from `src/shared/`.

| Page | Route | Key Features |
|------|-------|-------------|
| LoginPage | (no auth) | Centered card, Liquid Glass background, Microsoft OAuth + offline |
| HomePage | `/home` | Quick launch card, stats grid, news feed |
| MarketplacePage | `/store` | Featured banner, category tabs, content grid |
| ContentDetailPage | `/store/:type/:slug` | Description, versions table, gallery, dependencies |
| InstancesPage | `/instances` | Instance list with search/filter, grid/list toggle |
| NewInstancePage | `/instances/new` | Step-by-step creation wizard |
| InstanceDetailPage | `/instances/:id` | Overview, mods list, settings, crash log |
| LibraryPage | `/library` | Per-instance installed content, update checker |
| CollectionsPage | `/collections` | Saved items grid, filter by type |
| VersionsPage | `/versions` | Version browser, release/snapshot toggle |
| ServersPage | `/servers` | Server list with ping badges |
| SettingsPage | `/settings` | Grouped list sections (macOS Settings style), Shell switcher |

### 4.1 Settings Page Structure

macOS Settings-style grouped list with sections:

1. **Appearance** — Theme (Light/Dark), Shell switcher
2. **Game** — Java path, memory allocation, JVM args
3. **Downloads** — Concurrent downloads, mirror preference
4. **Network** — Proxy settings
5. **Security** — Sandbox mode, audit log
6. **Account** — Login status, account management
7. **About** — Version, links

### 4.2 Login Page

Centered card on blurred background:

- Liquid Glass card (blur + vibrancy)
- BonNext logo + name
- "Sign in with Microsoft" primary button
- "Play Offline" secondary button
- Version info at bottom

---

## 5. File Structure

```
src/shells/swiftui/
├── index.ts                    # ShellDefinition export
├── AppShell.tsx                # Root layout + routing
├── styles/
│   ├── tokens.css              # Design tokens (colors, spacing, radius, animation)
│   ├── themes.css              # Light/dark theme variables
│   ├── global.css              # Base styles, SF Pro font, Liquid Glass utilities
│   └── animations.css          # Spring animation keyframes
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Sidebar.module.css
│   │   └── index.ts
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Modal.tsx
│   │   ├── Modal.module.css
│   │   ├── Tabs.tsx
│   │   ├── Tabs.module.css
│   │   ├── Card.tsx
│   │   ├── Card.module.css
│   │   ├── List.tsx
│   │   ├── List.module.css
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
│       ├── index.ts            # SVG icon components
│       ├── HomeIcon.tsx
│       ├── StoreIcon.tsx
│       ├── InstancesIcon.tsx
│       ├── LibraryIcon.tsx
│       ├── CollectionsIcon.tsx
│       ├── VersionsIcon.tsx
│       ├── ServersIcon.tsx
│       ├── SettingsIcon.tsx
│       └── ...                 # More SF Symbols-style icons
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
    ├── useSpringAnimation.ts   # Spring animation helper
    └── index.ts
```

---

## 6. Shared Layer Dependencies

SwiftUI Shell imports from `src/shared/` only — never from `src/shells/zzz/`:

| Shared Module | Usage |
|---------------|-------|
| `shared/api` | All Tauri IPC calls |
| `shared/stores/authStore` | Auth state, login/logout |
| `shared/stores/configStore` | App config |
| `shared/stores/instanceStore` | Instance CRUD |
| `shared/stores/toastStore` | Toast notifications |
| `shared/stores/themeStore` | Theme switching |
| `shared/stores/downloadStore` | Download queue |
| `shared/stores/shellStore` | Shell switching |
| `shared/i18n` | Internationalization |
| `shared/hooks/useKeyboardShortcuts` | Keyboard shortcuts |
| `shared/utils/errorMapping` | Error display |
| `shared/utils/logger` | Logging |
| `shared/types/shell` | ShellDefinition type |

---

## 7. Implementation Order (Bottom-Up)

### Phase A: Design System Foundation
1. `tokens.css` — All CSS custom properties
2. `themes.css` — Light/dark theme variables
3. `global.css` — Base styles, font, Liquid Glass utilities
4. `animations.css` — Spring animation keyframes

### Phase B: Icon Library
5. `icons/` — SVG inline icon components (Home, Store, Instances, etc.)

### Phase C: Core UI Components
6. `Button` — Primary, secondary, plain, destructive
7. `Card` — Standard card with header/body/footer
8. `List` — Grouped list (macOS Settings style)
9. `Modal` — Sheet-style modal with backdrop blur
10. `Tabs` — Segmented control
11. `FormField`, `Select`, `SearchField`, `Toggle`
12. `Badge`, `Tooltip`, `Pagination`, `Skeleton`, `Toast`
13. `ProgressBar`, `Spinner`, `Breadcrumb`

### Phase D: Feature Components
14. `ContentCard` — Mod/texture card (gallery/list)
15. `InstallButton` — Install flow with progress
16. `CollectionButton` — Wishlist toggle
17. `DownloadPanel` — Floating download manager
18. `InstanceSelect` — Instance picker
19. `SearchPalette` — Spotlight-style search
20. `CommandPalette` — Command palette
21. `ChatPanel`, `FriendsPanel`

### Phase E: Layout
22. `Sidebar` — Liquid Glass navigation
23. `AppShell` — Root layout + routing

### Phase F: Pages
24. `LoginPage` — Centered card login
25. `HomePage` — Quick launch + stats
26. `MarketplacePage` — Store browser
27. `ContentDetailPage` — Content detail
28. `InstancesPage` — Instance list
29. `NewInstancePage` — Creation wizard
30. `InstanceDetailPage` — Instance management
31. `LibraryPage` — Installed content
32. `CollectionsPage` — Saved items
33. `VersionsPage` — Version browser
34. `ServersPage` — Server list
35. `SettingsPage` — Grouped settings + Shell switcher

### Phase G: Integration & Polish
36. Wire up `index.ts` ShellDefinition
37. Replace placeholder `AppShell.tsx`
38. Test ZZZ ↔ SwiftUI switching
39. Build verification

---

## 8. Key Differences from ZZZ Shell

| Aspect | ZZZ Shell | SwiftUI Shell |
|--------|-----------|---------------|
| Visual style | Cyberpunk, clip-path corners | Native macOS, rounded corners |
| Overlay effects | Noise + scanline (CRT) | Liquid Glass (blur + vibrancy) |
| Heading font | Bebas Neue | SF Pro Bold |
| Accent color | #FFE600 (same) | #FFE600 (same) |
| Card shape | Angled clip-path corners | Standard rounded rect |
| Sidebar | Dark solid + decorative rects | Liquid Glass floating |
| Animations | Clip-path reveal, stagger | Spring (slide + fade) |
| Icons | Custom SVG (cyberpunk) | SF Symbols-style SVG |
| Login | Full-screen immersive | Centered card |
| Settings | Tab-based sections | Grouped list (macOS style) |
| Theme variants | dark, light, oled | dark, light |

---

## 9. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| `backdrop-filter` not supported in older WebViews | Graceful fallback: solid background with slight transparency |
| SF Pro font not available on non-macOS | CSS font stack falls back to `system-ui, sans-serif` |
| Large component count (~35 components) | Bottom-up approach, each component independently testable |
| Shell switching requires app restart | Document clearly; future: hot-reload via React.lazy |
| Brand yellow (#FFE600) contrast issues in light mode | Light mode uses darker tint `#6B5F00` for text on white backgrounds |

---

## 10. Testing Strategy

- **Visual testing:** Each component rendered in isolation with both themes
- **Build verification:** `pnpm build` after each phase
- **TypeScript check:** `npx tsc --noEmit` after each phase
- **Shell switching:** Verify ZZZ → SwiftUI → ZZZ round-trip
- **Cross-theme:** Verify all pages in both light and dark mode
