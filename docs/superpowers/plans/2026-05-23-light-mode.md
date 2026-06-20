# Light Mode & Theme Transition Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the light mode with a clean modern aesthetic, add a clip-reveal theme transition animation, and remove the particle background globally.

**Architecture:** CSS variable system with theme-class overrides on `<html>`. The clip-reveal animation uses a temporary overlay div with `clip-path: circle()` animated via Web Animations API, expanding from the click origin. Hardcoded colors in 27 `.module.css` files are replaced with CSS variable references so theme switching actually works.

**Tech Stack:** React 18, TypeScript, CSS Modules, CSS Custom Properties, Web Animations API

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/styles/tokens.css` | Add new CSS variables for shadows, overlays, accent-action |
| Modify | `src/styles/themes.css` | Rewrite `.theme-light` with new color palette + new variable overrides |
| Modify | `src/styles/global.css` | Light-mode-aware overlays, scrollbar, selection highlight |
| Modify | `src/stores/themeStore.tsx` | Add `switchThemeWithAnimation()` with clip-reveal overlay |
| Modify | `src/pages/SettingsPage.tsx` | Pass click event to animated theme switch |
| Modify | `src/App.tsx` | Remove `ParticleBackground` component |
| Modify | 27 `.module.css` files | Replace hardcoded hex/rgba with CSS variable references |

---

### Task 1: Add new CSS variables to tokens.css

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add new variables to `:root` block**

Add these variables after the existing `--color-text-faint` line (line 19), before `--font-heading`:

```css
  --color-accent-action: var(--color-accent);
  --color-accent-action-text: #1A1A1A;
  --color-accent-15: rgba(255, 230, 0, 0.15);
  --color-accent-30: rgba(255, 230, 0, 0.3);
  --color-overlay-50: rgba(0, 0, 0, 0.5);
  --color-overlay-80: rgba(0, 0, 0, 0.8);
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.2);
  --selection-bg: rgba(255, 230, 0, 0.3);
  --selection-color: #FFFFFF;
  --scrollbar-thumb-color: var(--color-border-light);
  --scrollbar-thumb-hover: var(--color-text-muted);
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors related to tokens.css

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(tokens): add light-mode CSS variables for shadows, overlays, accent-action"
```

---

### Task 2: Rewrite .theme-light in themes.css

**Files:**
- Modify: `src/styles/themes.css`

- [ ] **Step 1: Replace the entire `.theme-light` block**

Replace the `.theme-light` block (lines 39-68) with:

```css
.theme-light {
  --bg-primary: #FAFAFA;
  --bg-secondary: #F0F0F0;
  --bg-card: #FFFFFF;
  --text-primary: #1A1A1A;
  --text-secondary: #555555;
  --text-muted: #888888;
  --accent: #FFE600;
  --border: #E5E5E5;
  --border-hover: #B0B0B0;
  --danger: #CC2222;
  --success: #00AA55;

  --color-bg: var(--bg-primary);
  --color-panel: var(--bg-secondary);
  --color-panel-alt: var(--bg-card);
  --color-sidebar: #F0F0F0;
  --color-border: var(--border);
  --color-border-mid: #D0D0D0;
  --color-border-light: var(--border-hover);
  --color-accent: var(--accent);
  --color-success: var(--success);
  --color-error: var(--danger);
  --color-text: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-text-tertiary: #999999;
  --color-text-dim: #BBBBBB;
  --color-text-faint: #CCCCCC;

  --color-accent-action: #1A1A1A;
  --color-accent-action-text: #FFE600;
  --color-accent-15: rgba(255, 230, 0, 0.2);
  --color-accent-30: rgba(255, 230, 0, 0.35);
  --color-overlay-50: rgba(0, 0, 0, 0.3);
  --color-overlay-80: rgba(0, 0, 0, 0.6);
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.12);
  --selection-bg: rgba(255, 230, 0, 0.25);
  --selection-color: #1A1A1A;
  --scrollbar-thumb-color: rgba(0, 0, 0, 0.2);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.css
git commit -m "feat(theme): rewrite .theme-light with clean modern palette"
```

---

### Task 3: Update global.css for light-mode awareness

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Replace hardcoded `::selection` with variables**

Replace lines 23-26:

```css
::selection {
  background: rgba(255, 230, 0, 0.3);
  color: #FFF;
}
```

With:

```css
::selection {
  background: var(--selection-bg);
  color: var(--selection-color);
}
```

- [ ] **Step 2: Replace scrollbar styles with variables**

Replace lines 32-43:

```css
::-webkit-scrollbar-track {
  background: var(--color-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-light);
  border-radius: 0;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
```

With:

```css
::-webkit-scrollbar-track {
  background: var(--color-bg);
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb-color);
  border-radius: 0;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

- [ ] **Step 3: Add light-mode overlay hiding**

Add after the `.scanline-overlay` block (after line 74), before `.app-layout`:

```css
.theme-light .noise-overlay,
.theme-light .scanline-overlay {
  display: none;
}
```

- [ ] **Step 4: Update decorative-rect for light mode**

Replace line 110:

```css
  border: 1px solid rgba(255, 230, 0, 0.03);
```

With:

```css
  border: 1px solid var(--color-accent-15);
```

Replace line 128:

```css
  border-color: rgba(255, 255, 255, 0.02);
```

With:

```css
  border-color: var(--color-accent-15);
```

- [ ] **Step 5: Verify**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(global): use CSS variables for selection, scrollbar, overlays; hide overlays in light mode"
```

---

### Task 4: Add clip-reveal theme transition animation to themeStore.tsx

**Files:**
- Modify: `src/stores/themeStore.tsx`

- [ ] **Step 1: Add `switchThemeWithAnimation` function**

Add this function after the `THEME_CYCLE` constant (after line 29), before the `ThemeProvider` component:

```typescript
export function switchThemeWithAnimation(
  newTheme: Theme,
  clickEvent: React.MouseEvent
) {
  const root = document.documentElement;
  const currentClass = THEME_CLASS_MAP[newTheme === 'dark' ? 'light' : newTheme === 'light' ? 'dark' : 'dark'];

  const x = clickEvent.clientX;
  const y = clickEvent.clientY;
  const maxDim = Math.max(
    window.innerWidth,
    window.innerHeight
  );
  const endRadius = Math.ceil(Math.sqrt(maxDim * maxDim + maxDim * maxDim));

  const overlay = document.createElement('div');
  const isLight = newTheme === 'light';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: ${isLight ? '#FAFAFA' : '#0D0D0D'};
    clip-path: circle(0% at ${x}px ${y}px);
    z-index: 99999;
    pointer-events: none;
  `;
  root.appendChild(overlay);

  const animation = overlay.animate(
    [
      { clipPath: `circle(0% at ${x}px ${y}px)` },
      { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
    ],
    {
      duration: 500,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards',
    }
  );

  animation.onfinish = () => {
    root.classList.remove('theme-dark', 'theme-light', 'theme-oled');
    root.classList.add(THEME_CLASS_MAP[newTheme]);
    overlay.remove();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
  };
}
```

- [ ] **Step 2: Update ThemeContextValue interface**

Add `switchThemeWithAnimation` to the interface:

```typescript
interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchThemeWithAnimation: (newTheme: Theme, clickEvent: React.MouseEvent) => void;
}
```

- [ ] **Step 3: Add the function to the Provider value**

Update the Provider value to include the new function:

```tsx
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, switchThemeWithAnimation }}>
      {children}
    </ThemeContext.Provider>
  );
```

Note: `switchThemeWithAnimation` is a standalone exported function, not a context method. But we also need to update the theme state after the animation finishes. Let me revise — the function should also update React state.

- [ ] **Step 4: Revise switchThemeWithAnimation to accept a state setter**

Replace the function from Step 1 with this version that also updates React state:

```typescript
export function createThemeSwitcher(setThemeState: React.Dispatch<React.SetStateAction<Theme>>) {
  return function switchThemeWithAnimation(
    newTheme: Theme,
    clickEvent: React.MouseEvent
  ) {
    const root = document.documentElement;
    const x = clickEvent.clientX;
    const y = clickEvent.clientY;
    const maxDim = Math.max(window.innerWidth, window.innerHeight);
    const endRadius = Math.ceil(Math.sqrt(maxDim * maxDim + maxDim * maxDim));

    const overlay = document.createElement('div');
    const isLight = newTheme === 'light';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: ${isLight ? '#FAFAFA' : '#0D0D0D'};
      clip-path: circle(0% at ${x}px ${y}px);
      z-index: 99999;
      pointer-events: none;
    `;
    root.appendChild(overlay);

    const animation = overlay.animate(
      [
        { clipPath: `circle(0% at ${x}px ${y}px)` },
        { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
      ],
      {
        duration: 500,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards',
      }
    );

    animation.onfinish = () => {
      root.classList.remove('theme-dark', 'theme-light', 'theme-oled');
      root.classList.add(THEME_CLASS_MAP[newTheme]);
      overlay.remove();
      setThemeState(newTheme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {}
    };
  };
}
```

- [ ] **Step 5: Use the factory in ThemeProvider**

Inside `ThemeProvider`, create the function and expose it:

```tsx
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const applyThemeClass = useCallback((t: Theme) => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-oled');
    root.classList.add(THEME_CLASS_MAP[t]);
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme, applyThemeClass]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  }, []);

  const switchWithAnimation = useCallback(
    (newTheme: Theme, clickEvent: React.MouseEvent) => {
      createThemeSwitcher(setThemeState)(newTheme, clickEvent);
    },
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, switchThemeWithAnimation: switchWithAnimation }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -15`
Expected: No errors related to themeStore.tsx

- [ ] **Step 7: Commit**

```bash
git add src/stores/themeStore.tsx
git commit -m "feat(theme): add clip-reveal theme transition animation"
```

---

### Task 5: Update SettingsPage.tsx to use animated theme switch

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Update the theme switching buttons**

Replace the `onClick` handler on line 270:

```tsx
onClick={() => setTheme(val)}
```

With:

```tsx
onClick={(e) => switchThemeWithAnimation(val, e)}
```

- [ ] **Step 2: Update the useTheme destructuring**

Replace line 43:

```tsx
const { theme, setTheme } = useTheme();
```

With:

```tsx
const { theme, switchThemeWithAnimation } = useTheme();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -15`

- [ ] **Step 4: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(settings): use animated clip-reveal theme switch"
```

---

### Task 6: Remove ParticleBackground from App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove the ParticleBackground import**

Remove line 12:

```tsx
import { ParticleBackground } from './components/ParticleBackground';
```

- [ ] **Step 2: Remove the ParticleBackground component from JSX**

Remove line 185:

```tsx
                  <ParticleBackground />
```

- [ ] **Step 3: Verify the app compiles and runs**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -15`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: remove ParticleBackground component from app"
```

---

### Task 7: Replace hardcoded colors in Sidebar.module.css

**Files:**
- Modify: `src/components/layout/Sidebar.module.css`

- [ ] **Step 1: Replace all hardcoded colors**

Mapping:
- `#111` → `var(--color-sidebar)`
- `#555` → `var(--color-text-muted)`
- `#666` → `var(--color-text-muted)`
- `#444` → `var(--color-text-dim)`
- `#888` → `var(--color-text-tertiary)`
- `#AAA` → `var(--color-text-secondary)`
- `rgba(255, 230, 0, 0.15)` → `var(--color-accent-15)`

Read the file, find each hardcoded value, and replace with the corresponding CSS variable.

- [ ] **Step 2: Verify**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.module.css
git commit -m "fix(sidebar): replace hardcoded colors with CSS variables"
```

---

### Task 8: Replace hardcoded colors in Button.module.css

**Files:**
- Modify: `src/components/ui/Button.module.css`

- [ ] **Step 1: Replace all hardcoded colors**

Mapping:
- `#333` → `var(--color-text-dim)` or `var(--color-bg)` depending on context (read file to determine)
- `#999` → `var(--color-text-tertiary)`
- `#555` → `var(--color-text-muted)`
- `#CCC` → `var(--color-text-dim)`
- `#888` → `var(--color-text-tertiary)`
- `#BBB` → `var(--color-text-dim)`
- `rgba(255, 255, 255, 0.15)` → `var(--color-overlay-50)` or keep as-is if it's a white overlay (read context)
- `rgba(255, 230, 0, 0.06)` → `var(--color-accent-15)` (closest match, or add `--color-accent-06`)
- `rgba(255, 230, 0, 0.12)` → `var(--color-accent-15)` (closest match)
- `rgba(255, 68, 68, 0.08)` → `var(--color-overlay-50)` or keep (read context)
- `rgba(255, 68, 68, 0.15)` → `var(--color-overlay-50)` or keep (read context)

For primary button background: replace hardcoded `var(--color-accent)` usage with `var(--color-accent-action)` and text color with `var(--color-accent-action-text)`.

- [ ] **Step 2: Verify**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.module.css
git commit -m "fix(button): replace hardcoded colors with CSS variables, use accent-action"
```

---

### Task 9: Replace hardcoded colors in Modal.module.css

**Files:**
- Modify: `src/components/ui/Modal.module.css`

- [ ] **Step 1: Replace hardcoded colors**

Mapping:
- `#141414` → `var(--color-panel)`
- `#2A2A2A` → `var(--color-border-light)`
- `#888` → `var(--color-text-tertiary)`
- `rgba(0, 0, 0, 0.75)` → `var(--color-overlay-80)`

- [ ] **Step 2: Verify**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Modal.module.css
git commit -m "fix(modal): replace hardcoded colors with CSS variables"
```

---

### Task 10: Replace hardcoded colors in CommandPalette.module.css

**Files:**
- Modify: `src/components/CommandPalette.module.css`

- [ ] **Step 1: Replace hardcoded colors**

Mapping:
- `#1A1A1A` → `var(--color-panel-alt)`
- `#2A2A2A` → `var(--color-border-light)`
- `#222` → `var(--color-panel-alt)`
- `#FFF` → `var(--color-text)`
- `#555` → `var(--color-text-muted)`
- `#444` → `var(--color-text-dim)`
- `#333` → `var(--color-text-dim)`
- `#252525` → `var(--color-panel-alt)`
- `#666` → `var(--color-text-muted)`
- `rgba(0, 0, 0, 0.6)` → `var(--color-overlay-50)`
- `rgba(0, 0, 0, 0.5)` → `var(--color-overlay-50)`

- [ ] **Step 2: Verify & Commit**

```bash
git add src/components/CommandPalette.module.css
git commit -m "fix(command-palette): replace hardcoded colors with CSS variables"
```

---

### Task 11: Replace hardcoded colors in ContextMenu.module.css

**Files:**
- Modify: `src/components/ContextMenu.module.css`

- [ ] **Step 1: Replace hardcoded colors**

Mapping:
- `#1A1A1A` → `var(--color-panel-alt)`
- `#2A2A2A` → `var(--color-border-light)`
- `#AAA` → `var(--color-text-secondary)`
- `#252525` → `var(--color-panel-alt)`
- `#FFF` → `var(--color-text)`
- `#555` → `var(--color-text-muted)`
- `#222` → `var(--color-panel-alt)`
- `rgba(0, 0, 0, 0.4)` → `var(--color-overlay-50)`

- [ ] **Step 2: Verify & Commit**

```bash
git add src/components/ContextMenu.module.css
git commit -m "fix(context-menu): replace hardcoded colors with CSS variables"
```

---

### Task 12: Replace hardcoded colors in remaining UI component CSS files

**Files:**
- Modify: `src/components/ui/Tooltip.module.css`
- Modify: `src/components/ui/Skeleton.module.css`
- Modify: `src/components/ui/Toast.module.css`
- Modify: `src/components/ui/Pagination.module.css`
- Modify: `src/components/ui/Breadcrumb.module.css`
- Modify: `src/components/ui/Tabs.module.css`
- Modify: `src/components/ui/Status.module.css`
- Modify: `src/components/ui/Inputs.module.css`
- Modify: `src/components/ui/StatBadge.module.css`
- Modify: `src/components/ui/CategoryCard.module.css`
- Modify: `src/components/ui/DownloadPanel.module.css`
- Modify: `src/components/ErrorBoundary.module.css`

- [ ] **Step 1: Replace hardcoded colors in each file**

General mapping for common values:
- `#0D0D0D` / `#0d0d0d` → `var(--color-bg)`
- `#111` → `var(--color-sidebar)` or `var(--color-bg)`
- `#141414` → `var(--color-panel)`
- `#1A1A1A` → `var(--color-panel-alt)`
- `#1C1C1C` / `#1C1C1C` → `var(--color-panel-alt)`
- `#222` / `#252525` → `var(--color-panel-alt)`
- `#2A2A2A` → `var(--color-border-light)`
- `#333` → `var(--color-text-dim)` or `var(--color-panel-alt)` depending on context
- `#444` → `var(--color-text-dim)`
- `#555` → `var(--color-text-muted)`
- `#666` → `var(--color-text-muted)`
- `#888` → `var(--color-text-tertiary)`
- `#999` → `var(--color-text-tertiary)`
- `#AAA` → `var(--color-text-secondary)`
- `#BBB` → `var(--color-text-dim)`
- `#CCC` → `var(--color-text-dim)`
- `#FFF` / `#FFFFFF` → `var(--color-text)`
- `#FFE600` → `var(--color-accent)`
- `#FF4444` → `var(--color-error)`
- `#00FF88` → `var(--color-success)`
- `#FFA500` → `var(--color-error)` or keep (warning color, read context)
- `rgba(255, 230, 0, ...)` → `var(--color-accent-15)` or `var(--color-accent-30)` depending on opacity
- `rgba(0, 0, 0, ...)` → `var(--color-overlay-50)` or `var(--color-overlay-80)` depending on opacity
- `rgba(255, 255, 255, ...)` → keep as-is if used for subtle white overlays, or map to appropriate variable

For each file, read it first, identify each hardcoded value, and replace with the correct variable based on context (background vs text vs border).

- [ ] **Step 2: Verify & Commit**

```bash
git add src/components/ui/Tooltip.module.css src/components/ui/Skeleton.module.css src/components/ui/Toast.module.css src/components/ui/Pagination.module.css src/components/ui/Breadcrumb.module.css src/components/ui/Tabs.module.css src/components/ui/Status.module.css src/components/ui/Inputs.module.css src/components/ui/StatBadge.module.css src/components/ui/CategoryCard.module.css src/components/ui/DownloadPanel.module.css src/components/ErrorBoundary.module.css
git commit -m "fix(ui): replace hardcoded colors with CSS variables across all UI components"
```

---

### Task 13: Replace hardcoded colors in page CSS files

**Files:**
- Modify: `src/pages/HomePage.module.css`
- Modify: `src/pages/SettingsPage.module.css`
- Modify: `src/pages/InstancesPage.module.css`
- Modify: `src/pages/ContentDetailPage.module.css`
- Modify: `src/pages/InstanceDetailPage.module.css`
- Modify: `src/pages/NewInstancePage.module.css`
- Modify: `src/pages/VersionsPage.module.css`
- Modify: `src/pages/LibraryPage.module.css`
- Modify: `src/pages/ModsPage.module.css`
- Modify: `src/pages/LoginPage.module.css`
- Modify: `src/components/layout/Decorations.module.css`

- [ ] **Step 1: Replace hardcoded colors in each file**

Use the same mapping as Task 12. Special attention for:

**HomePage.module.css** (most complex — 60+ hardcoded values):
- The many `#0a0a1a`, `#1a0a0a`, `#0a1a0a`, `#1a1a0a` etc. are tinted background variants. Replace with `var(--color-panel-alt)` or add new variables if they need to differ between themes.
- `rgba(255, 230, 0, ...)` variants: map to `var(--color-accent-15)` or `var(--color-accent-30)` based on closest opacity.
- `rgba(0, 0, 0, 0.85)` → `var(--color-overlay-80)`

**SettingsPage.module.css**:
- `#FFF` → `var(--color-text)`
- `#141414` → `var(--color-panel)`
- `#1C1C1C` → `var(--color-panel-alt)`
- `#FFE600` → `var(--color-accent)`
- `#888` → `var(--color-text-tertiary)`
- `#555` → `var(--color-text-muted)`
- `#666` → `var(--color-text-muted)`
- `#FF4444` → `var(--color-error)`

**InstancesPage.module.css**:
- `#4CAF50` → `var(--color-success)`
- `#FF9800` → keep as-is (warning/orange, no existing variable) or add `--color-warning`
- The tinted hex values (`#1a1a0a`, etc.) → `var(--color-panel-alt)`

For each file, read it first, identify each hardcoded value, and replace with the correct variable based on context.

- [ ] **Step 2: Verify & Commit**

```bash
git add src/pages/HomePage.module.css src/pages/SettingsPage.module.css src/pages/InstancesPage.module.css src/pages/ContentDetailPage.module.css src/pages/InstanceDetailPage.module.css src/pages/NewInstancePage.module.css src/pages/VersionsPage.module.css src/pages/LibraryPage.module.css src/pages/ModsPage.module.css src/pages/LoginPage.module.css src/components/layout/Decorations.module.css
git commit -m "fix(pages): replace hardcoded colors with CSS variables across all page styles"
```

---

### Task 14: Visual verification and final polish

**Files:**
- Potentially any file from Tasks 7-13 if adjustments needed

- [ ] **Step 1: Run the dev server**

Run: `cd /Users/xiatian/Desktop/BonNext && pnpm dev`

- [ ] **Step 2: Test dark mode (should be unchanged)**

Open the app, verify dark mode looks identical to before:
- Noise overlay visible
- Scanline overlay visible
- All colors correct
- No regressions

- [ ] **Step 3: Test light mode**

Switch to light mode via Settings:
- Clip-reveal animation plays from click position
- Background is #FAFAFA (near white)
- Sidebar is #F0F0F0
- Cards are #FFFFFF with subtle shadow
- Primary buttons have dark background with yellow text
- Noise and scanline overlays are hidden
- All text is readable (dark text on light backgrounds)
- No hardcoded dark colors visible on light backgrounds

- [ ] **Step 4: Test OLED mode**

Switch to OLED mode:
- Pure black background
- All colors correct
- Noise and scanline overlays visible

- [ ] **Step 5: Test animation between all theme pairs**

Test transitions: dark→light, light→oled, oled→dark, dark→oled, oled→light, light→dark
- Animation should be smooth in all directions
- No flash of wrong colors
- Overlay color should match the destination theme's background

- [ ] **Step 6: Fix any issues found**

If any hardcoded colors are still visible in light mode, find and fix them.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "fix: polish light mode visual consistency"
```

---

### Task 15: Full build verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/xiatian/Desktop/BonNext && npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 2: Run Vite build**

Run: `cd /Users/xiatian/Desktop/BonNext && pnpm build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Run Rust check**

Run: `cd /Users/xiatian/Desktop/BonNext && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: "Finished" with no errors
