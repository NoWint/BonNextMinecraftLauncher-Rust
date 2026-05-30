# MD3 Layout Plugin — Full Material Design 3 Restructuring

**Date**: 2026-05-29
**Status**: Draft
**Depends on**: Plugin System & MD3 Theme (already implemented)

## 1. Overview

The MD3 Theme plugin currently only overrides CSS styles (colors, border-radius, clip-path). This spec defines a **full layout restructuring** that replaces the entire visual shell when MD3 theme is active — Navigation Rail, Top App Bar, typography, and all page content components — while leaving the original ZZZ Neo-Tokyo layout completely untouched.

**Core principle**: The MD3 plugin is a **plugin**. Activating it restructures the entire layout. Deactivating it restores the original ZZZ layout. Zero modifications to existing ZZZ layout code.

## 2. Architecture

### 2.1 New Extension Point: `bonnext:layout`

A single extension point that carries all layout replacement components:

```typescript
interface LayoutContribution {
  NavigationRail: React.ComponentType<NavigationRailProps>;
  TopAppBar: React.ComponentType<TopAppBarProps>;
  FAB: React.ComponentType<FABProps>;
  components: {
    Button: React.ComponentType<MD3ButtonProps>;
    Card: React.ComponentType<MD3CardProps>;
    Dialog: React.ComponentType<MD3DialogProps>;
    TextField: React.ComponentType<MD3TextFieldProps>;
    Select: React.ComponentType<MD3SelectProps>;
    Switch: React.ComponentType<MD3SwitchProps>;
    Checkbox: React.ComponentType<MD3CheckboxProps>;
    Tabs: React.ComponentType<MD3TabsProps>;
    Chip: React.ComponentType<MD3ChipProps>;
    Badge: React.ComponentType<MD3BadgeProps>;
    List: React.ComponentType<MD3ListProps>;
    Snackbar: React.ComponentType<MD3SnackbarProps>;
    Icon: React.ComponentType<MD3IconProps>;
    Divider: React.ComponentType<MD3DividerProps>;
  };
  typography: MD3TypographyScale;
  themeTokens: Record<string, string>;
}
```

### 2.2 AppShell Consumption

```typescript
function AppShell() {
  const layoutExt = useExtensionPoint<LayoutContribution>('bonnext:layout');
  const layout = layoutExt?.contributions[0];

  if (layout) {
    return <MD3AppShell layout={layout} />;
  }
  return <ZZZAppShell />;
}
```

`ZZZAppShell` is the current AppShell code extracted verbatim — zero changes.

### 2.3 Page Conditional Rendering

Each page component uses `useLayout()` hook:

```typescript
function HomePage() {
  const layout = useLayout();
  if (layout) {
    return <MD3HomePage layout={layout} />;
  }
  return <ZZZHomePage />;
}
```

Business logic is extracted into shared custom Hooks (e.g., `useHomeData()`). Both `MD3HomePage` and `ZZZHomePage` consume the same hook; only the rendering differs.

## 3. Component Library: @material/web + React Wrappers

### 3.1 Package

Install `@material/web` (Google's official MD3 Web Components library). No MUI, no Material Components Web.

### 3.2 React Wrapper Pattern

Each wrapper encapsulates a `@material/web` Custom Element, handling:

- **Ref forwarding** to the underlying element
- **Event mapping** (Web Component `CustomEvent` → React `onXxx` props)
- **Property synchronization** (React props → element properties via `useEffect`)
- **TypeScript types** for all props

Example:

```typescript
export function MD3Button({
  variant = 'filled',
  children,
  onClick,
  disabled,
  icon,
  ...props
}: MD3ButtonProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClick) return;
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onClick]);

  const Tag = variant === 'filled' ? 'md-filled-button'
    : variant === 'outlined' ? 'md-outlined-button'
    : variant === 'text' ? 'md-text-button'
    : variant === 'elevated' ? 'md-elevated-button'
    : 'md-filled-tonal-button';

  return <Tag ref={ref} disabled={disabled || undefined}>{icon}{children}</Tag>;
}
```

### 3.3 Wrapper Component Inventory (15 components)

| Wrapper             | @material/web Elements                                                                                     | Usage                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `MD3Button`         | `md-filled-button`, `md-outlined-button`, `md-text-button`, `md-elevated-button`, `md-filled-tonal-button` | All buttons            |
| `MD3FAB`            | `md-fab`                                                                                                   | Floating action button |
| `MD3Card`           | `md-elevated-card`, `md-filled-card`, `md-outlined-card`                                                   | Card containers        |
| `MD3Dialog`         | `md-dialog`                                                                                                | Dialogs/modals         |
| `MD3TextField`      | `md-filled-text-field`, `md-outlined-text-field`                                                           | Text inputs            |
| `MD3Select`         | `md-outlined-select`, `md-filled-select`                                                                   | Dropdown selects       |
| `MD3Switch`         | `md-switch`                                                                                                | Toggle switches        |
| `MD3Checkbox`       | `md-checkbox`                                                                                              | Checkboxes             |
| `MD3Tabs`           | `md-primary-tab`, `md-secondary-tab` + `tab-bar`                                                           | Tab bars               |
| `MD3Chip`           | `md-assist-chip`, `md-filter-chip`, `md-input-chip`, `md-suggestion-chip`                                  | Chips/tags             |
| `MD3Badge`          | `md-badge`                                                                                                 | Notification badges    |
| `MD3List`           | `md-list`, `md-list-item`                                                                                  | Lists                  |
| `MD3NavigationRail` | `md-navigation-rail` + `md-navigation-tab`                                                                 | Navigation rail        |
| `MD3TopAppBar`      | `md-elevated-app-bar`, `md-filled-app-bar`                                                                 | Top app bar            |
| `MD3Divider`        | `md-divider`                                                                                               | Dividers               |

### 3.4 @material/web Loading Strategy

Loaded dynamically in MD3ThemePlugin's `activate()`:

```typescript
async activate(context: PluginContextType) {
  await import('@material/web/all.js');
  // ... rest of activation
}
```

This ensures `@material/web` is only loaded when the MD3 plugin is active. When ZZZ theme is active, zero MD3 code is in the bundle.

### 3.5 Color System Integration

`@material/web` components consume `--md-sys-color-*` CSS custom properties. The MD3 theme maps its HCT-derived tokens to these variables:

```css
html[class*='theme-md3'] {
  --md-sys-color-primary: var(--md3-primary);
  --md-sys-color-on-primary: var(--md3-on-primary);
  --md-sys-color-primary-container: var(--md3-primary-container);
  --md-sys-color-on-primary-container: var(--md3-on-primary-container);
  --md-sys-color-secondary: var(--md3-secondary);
  --md-sys-color-surface: var(--md3-surface);
  --md-sys-color-on-surface: var(--md3-on-surface);
  --md-sys-color-surface-variant: var(--md3-surface-variant);
  --md-sys-color-on-surface-variant: var(--md3-on-surface-variant);
  --md-sys-color-outline: var(--md3-outline);
  --md-sys-color-outline-variant: var(--md3-outline-variant);
  --md-sys-color-error: var(--md3-error);
  --md-sys-color-shadow: var(--md3-shadow);
  /* ... all MD3 system colors */
}
```

This mapping is generated dynamically by `colorSystem.ts` alongside the existing `--md3-*` variables.

## 4. MD3 Layout Structure

### 4.1 MD3AppShell

```
┌──────────────────────────────────────────────────┐
│ TopAppBar (md-elevated-app-bar, 64px)            │
│ [☰] Page Title                    [🔍] [⚙️]     │
├──────┬───────────────────────────────────────────┤
│ Nav  │                                           │
│ Rail │  Content Area                             │
│ 80px │                                           │
│      │  (conditional page rendering)             │
│      │                                           │
│      │                                           │
│      │                                           │
│ [FAB]│                                           │
├──────┴───────────────────────────────────────────┤
└──────────────────────────────────────────────────┘
```

### 4.2 Navigation Rail

- Width: 80px (MD3 spec default)
- Items: Home, Store, Mods, Instances, Versions, Library, Collections, Settings
- Each item: icon (lucide-react) + label below
- Active item: pill-shaped indicator with `--md-sys-color-secondary-container` background
- FAB at bottom: primary action (context-dependent per page)
- No Friends list (moved to a dedicated dialog accessible from TopAppBar)

### 4.3 Top App Bar

- Height: 64px (MD3 small top app bar)
- Left: Navigation icon (optional menu trigger) + page headline
- Right: Search icon + settings icon
- Window controls integration:
  - macOS: Traffic lights render in the top-left 70px, TopAppBar starts after
  - Windows/Linux: Min/Max/Close buttons render in the top-right, TopAppBar ends before

### 4.4 Content Area

- Padding: 16px (MD3 spec for desktop)
- No decorative rectangles (ZZZ-specific)
- No noise/scanline overlays (ZZZ-specific)
- Background: `--md-sys-color-surface`

## 5. Typography System

### 5.1 Font

Roboto (loaded via Google Fonts when MD3 plugin activates):

- Weights: 300 (Light), 400 (Regular), 500 (Medium), 700 (Bold)
- Replaces Bebas Neue (headings) and Inter (body) in MD3 mode

### 5.2 Type Scale

Mapped to CSS custom properties:

| Token                             | Size | Weight | Tracking | Usage         |
| --------------------------------- | ---- | ------ | -------- | ------------- |
| `--md3-typescale-display-large`   | 57px | 400    | -0.25px  | Hero          |
| `--md3-typescale-display-medium`  | 45px | 400    | —        | —             |
| `--md3-typescale-display-small`   | 36px | 400    | —        | —             |
| `--md3-typescale-headline-large`  | 32px | 400    | —        | Page title    |
| `--md3-typescale-headline-medium` | 28px | 400    | —        | Section title |
| `--md3-typescale-headline-small`  | 24px | 400    | —        | Card title    |
| `--md3-typescale-title-large`     | 22px | 500    | —        | List title    |
| `--md3-typescale-title-medium`    | 16px | 500    | 0.15px   | Subtitle      |
| `--md3-typescale-title-small`     | 14px | 500    | 0.1px    | Small title   |
| `--md3-typescale-body-large`      | 16px | 400    | 0.5px    | Body text     |
| `--md3-typescale-body-medium`     | 14px | 400    | 0.25px   | —             |
| `--md3-typescale-body-small`      | 12px | 400    | 0.4px    | Caption       |
| `--md3-typescale-label-large`     | 14px | 500    | 0.1px    | Button text   |
| `--md3-typescale-label-medium`    | 12px | 500    | 0.5px    | —             |
| `--md3-typescale-label-small`     | 11px | 500    | 0.5px    | Badge text    |

### 5.3 Existing Variable Mapping

```css
html[class*='theme-md3'] {
  --font-heading: 'Roboto', sans-serif;
  --font-body: 'Roboto', sans-serif;
  --font-mono: 'Roboto Mono', monospace;
}
```

## 6. Plugin Activation Flow

```
1. ZZZThemePlugin.activate()
   → Register ThemeService as 'bonnext:theme' service
   → Register 3 ZZZ themes (zzz-dark, zzz-light, zzz-oled)
   → Switch to stored theme (default zzz-dark)

2. MD3ThemePlugin.activate()
   → Dynamic import @material/web/all.js (registers Custom Elements)
   → Load Roboto font via <link> to Google Fonts
   → Register 2 MD3 themes (md3-dark, md3-light)
   → Create LayoutContribution with 15 React Wrappers + typography + tokens
   → Contribute to 'bonnext:layout' extension point

3. AppShell detects bonnext:layout contribution
   → Render MD3AppShell (NavigationRail + TopAppBar)
   → Pages use useLayout() to get MD3 components
   → Conditional rendering: MD3 variant of each page

4. User switches to ZZZ theme
   → ThemeService.switchTheme('zzz-dark') fires onThemeChange
   → LayoutExtensionPoint listener detects theme is no longer MD3
   → MD3 plugin retracts its LayoutContribution from bonnext:layout
   → AppShell detects no layout contribution → renders ZZZAppShell
   → Pages useLayout() returns null → conditional rendering: ZZZ variant

5. User switches back to MD3 theme
   → ThemeService.switchTheme('md3-dark') fires onThemeChange
   → MD3 plugin re-contributes LayoutContribution to bonnext:layout
   → AppShell detects layout contribution → renders MD3AppShell
   → Pages useLayout() returns layout → conditional rendering: MD3 variant
```

## 7. File Structure

```
src/plugins/
  core/
    PluginProvider.tsx          (modified: register bonnext:layout extension point)
  extensions/
    LayoutExtensionPoint.ts     (NEW: ExtensionPointBase<LayoutContribution>)
  builtins/
    md3-theme/
      MD3ThemePlugin.ts         (modified: contribute to bonnext:layout)
      contributions.ts          (modified: add LayoutContribution generation)
      colorSystem.ts            (modified: add --md-sys-color-* mapping)
      wrappers/                 (NEW: 15 React Wrapper components)
        MD3Button.tsx
        MD3FAB.tsx
        MD3Card.tsx
        MD3Dialog.tsx
        MD3TextField.tsx
        MD3Select.tsx
        MD3Switch.tsx
        MD3Checkbox.tsx
        MD3Tabs.tsx
        MD3Chip.tsx
        MD3Badge.tsx
        MD3List.tsx
        MD3NavigationRail.tsx
        MD3TopAppBar.tsx
        MD3Divider.tsx
        index.ts               (barrel export)
      layout/                   (NEW: MD3 layout components)
        MD3AppShell.tsx
        MD3NavigationRail.tsx
        MD3TopAppBar.tsx
        useLayout.ts            (hook for pages to get layout contribution)
      pages/                    (NEW: MD3 variants of each page)
        MD3HomePage.tsx
        MD3StorePage.tsx
        MD3ModsPage.tsx
        MD3InstancesPage.tsx
        MD3InstanceDetailPage.tsx
        MD3NewInstancePage.tsx
        MD3VersionsPage.tsx
        MD3LibraryPage.tsx
        MD3CollectionsPage.tsx
        MD3SettingsPage.tsx
        MD3ContentDetailPage.tsx
      tokens/
        md3-typography.css      (NEW: MD3 type scale CSS variables)
        md3-sys-colors.css      (NEW: --md-sys-color-* mapping)
  components/
    layout/
      AppShell.tsx              (modified: extract ZZZAppShell, add layout switching)
```

## 8. ZZZ Layout Preservation

The following files are **never modified**:

- `src/components/layout/Sidebar.tsx` — ZZZ sidebar stays as-is
- `src/components/layout/TitleBar.tsx` — ZZZ title bar stays as-is
- `src/components/layout/Decorations.tsx` — ZZZ decorations stay as-is
- `src/styles/tokens.css` — ZZZ design tokens stay as-is
- `src/styles/themes.css` — ZZZ theme definitions stay as-is
- `src/styles/ux-delight.css` — ZZZ animations stay as-is
- All existing page components — their ZZZ rendering path is untouched

The only modification to existing files is:

1. `App.tsx` / `AppShell` — extract current code into `ZZZAppShell`, add layout switching logic
2. Each page component — add conditional rendering at the top level (if layout → MD3 variant)

## 9. Dependencies

New npm package:

- `@material/web` — Google's official MD3 Web Components (~60KB gzip)

No other new dependencies. React 18, TypeScript, CSS Modules remain as-is.

## 10. Scope and Phasing

This is a large change. Recommended implementation phases:

**Phase 1 — Foundation** (extension point + wrappers + NavigationRail + TopAppBar):

- LayoutExtensionPoint
- @material/web integration + 15 React Wrappers
- MD3AppShell with NavigationRail + TopAppBar
- useLayout() hook
- Color system integration (--md-sys-color-\*)

**Phase 2 — Core Pages** (Home + Settings + Instances):

- MD3HomePage
- MD3SettingsPage
- MD3InstancesPage
- MD3InstanceDetailPage

**Phase 3 — Content Pages** (Store + Mods + Library + Collections):

- MD3StorePage / MD3ModsPage
- MD3ContentDetailPage
- MD3LibraryPage
- MD3CollectionsPage

**Phase 4 — Remaining Pages + Polish**:

- MD3VersionsPage
- MD3NewInstancePage
- Typography fine-tuning
- Animation polish
- Seed color runtime change UI
