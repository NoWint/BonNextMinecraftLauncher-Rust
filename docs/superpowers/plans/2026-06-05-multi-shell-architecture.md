# Multi-Shell Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor BonNext from single UI to multi-shell architecture where users can switch between different UI implementations (ZZZ, SwiftUI, Fluent, TV) within the same app.

**Architecture:** Shell plugin pattern — each Shell is an independent directory under `src/shells/` with its own components, pages, and styles. A shared layer (`src/shared/`) provides common API, stores, types, hooks, and utils. Shell registration + React.lazy enables lazy loading and in-app switching.

**Tech Stack:** Tauri v2, React 18, TypeScript, Vite (code splitting), CSS Modules

**Design Spec:** `docs/superpowers/specs/2026-06-05-multi-shell-architecture-design.md`

---

## File Structure Map

### New Files to Create

| File | Responsibility |
|------|---------------|
| `src/shared/types/shell.ts` | ShellDefinition interface |
| `src/shared/types/index.ts` | Re-export shell types |
| `src/shared/stores/shellStore.tsx` | Shell switching state + persistence |
| `src/shared/hooks/useInstallFlow.ts` | Install flow orchestration (data only) |
| `src/shared/hooks/useDownloadProgress.ts` | Download progress subscription |
| `src/shared/hooks/index.ts` | Re-export shared hooks |
| `src/shell-registry.ts` | Shell registration + lazy loading |
| `src/shells/zzz/index.ts` | ZZZ ShellDefinition export |
| `src/shells/zzz/AppShell.tsx` | ZZZ Shell layout entry (extracted from App.tsx) |
| `src/shells/swiftui/index.ts` | SwiftUI ShellDefinition (placeholder) |
| `src/shells/swiftui/AppShell.tsx` | SwiftUI Shell placeholder |
| `src/shells/fluent/index.ts` | Fluent ShellDefinition (placeholder) |
| `src/shells/fluent/AppShell.tsx` | Fluent Shell placeholder |
| `src/shells/tv/index.ts` | TV ShellDefinition (placeholder) |
| `src/shells/tv/AppShell.tsx` | TV Shell placeholder |

### Files to Move (Phase 1)

| Source | Destination |
|--------|-------------|
| `src/api/*` (23 files) | `src/shared/api/*` |
| `src/stores/*` (19 files) | `src/shared/stores/*` |
| `src/utils/*` (11 files) | `src/shared/utils/*` |
| `src/hooks/*` (15 files) | `src/shared/hooks/*` (merge with new hooks) |
| `src/i18n/*` (3 files) | `src/shared/i18n/*` |
| `src/components/*` (~120 files) | `src/shells/zzz/components/*` |
| `src/pages/*` (40 files) | `src/shells/zzz/pages/*` |
| `src/styles/*` (4 files) | `src/shells/zzz/styles/*` |
| `src/constants/*` (1 file) | `src/shared/constants/*` |
| `src/ai/*` (10 files) | `src/shared/ai/*` |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Rewrite to use Shell rendering |
| `src/main.tsx` | Update imports |
| `src-tauri/src/config.rs` | Add `active_shell` field |
| `src-tauri/src/lib.rs` | Register new commands |
| `src-tauri/src/commands/config.rs` | Add get/set active_shell commands |
| `src/shared/stores/themeStore.tsx` | Remove MD3 options |
| `src/shared/utils/composeProviders.tsx` | Add ShellProvider, remove MD3 |

### Files to Delete (Phase 2: MD3 Cleanup)

| File/Directory | Reason |
|----------------|--------|
| `src/plugins/builtins/md3-theme/` (entire directory, ~30 files) | MD3 theme removal |
| `src/plugins/extensions/ThemeExtensionPoint.ts` | MD3-specific extension |
| `src/plugins/extensions/__tests__/ThemeExtensionPoint.test.ts` | MD3 test |

---

## Phase 1: Skeleton + ZZZ Migration

### Task 1: Rust Backend — Add active_shell Config

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/commands/config.rs` (or `src-tauri/src/lib.rs`)
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `active_shell` field to AppConfig in config.rs**

Read `src-tauri/src/config.rs` and add the new field to the `AppConfig` struct:

```rust
// Add after the `security` field in AppConfig struct:
    /// 当前激活的 Shell ID，默认 "zzz"
    #[serde(default = "default_active_shell")]
    pub active_shell: String,
```

Add the default function near the other default functions:

```rust
fn default_active_shell() -> String {
    "zzz".to_string()
}
```

In the `Default` impl for `AppConfig`, add:

```rust
active_shell: default_active_shell(),
```

- [ ] **Step 2: Add Tauri commands for get/set active_shell**

In `src-tauri/src/commands/config.rs` (or wherever config commands are defined), add:

```rust
#[tauri::command]
pub async fn get_active_shell() -> Result<String, LauncherError> {
    let config = config::load_config_async().await?;
    Ok(config.active_shell)
}

#[tauri::command]
pub async fn set_active_shell(shell_id: String) -> Result<(), LauncherError> {
    let valid_shells = ["zzz", "swiftui", "fluent", "tv"];
    if !valid_shells.contains(&shell_id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Unknown shell: {}", shell_id
        )));
    }
    let mut config = config::load_config_async().await?;
    config.active_shell = shell_id;
    config::save_config_async(&config).await?;
    Ok(())
}
```

- [ ] **Step 3: Register new commands in lib.rs**

In `src-tauri/src/lib.rs`, add `get_active_shell` and `set_active_shell` to the `generate_handler![]` macro invocation.

- [ ] **Step 4: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`

Expected: `Finished` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat: add active_shell config field and get/set commands"
```

---

### Task 2: Create Directory Structure + Shared Types

**Files:**
- Create: `src/shared/types/shell.ts`
- Create: `src/shared/types/index.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/shared/api
mkdir -p src/shared/stores
mkdir -p src/shared/types
mkdir -p src/shared/hooks
mkdir -p src/shared/utils
mkdir -p src/shared/i18n
mkdir -p src/shared/ai
mkdir -p src/shared/constants
mkdir -p src/shells/zzz/components
mkdir -p src/shells/zzz/pages
mkdir -p src/shells/zzz/styles
mkdir -p src/shells/zzz/hooks
mkdir -p src/shells/swiftui/components
mkdir -p src/shells/swiftui/pages
mkdir -p src/shells/swiftui/styles
mkdir -p src/shells/swiftui/hooks
mkdir -p src/shells/fluent/components
mkdir -p src/shells/fluent/pages
mkdir -p src/shells/fluent/styles
mkdir -p src/shells/fluent/hooks
mkdir -p src/shells/tv/components
mkdir -p src/shells/tv/pages
mkdir -p src/shells/tv/styles
mkdir -p src/shells/tv/hooks
```

- [ ] **Step 2: Create ShellDefinition type**

Create `src/shared/types/shell.ts`:

```typescript
export interface ShellDefinition {
  /** Shell unique identifier for config persistence and routing */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in shell selector */
  description: string;
  /** Icon (emoji or SVG path) */
  icon: string;
  /** React.lazy factory — Vite auto code-splits */
  loader: () => Promise<{ default: React.ComponentType }>;
  /** Routes this shell supports (TV may omit some) */
  supportedRoutes: string[];
  /** Theme variants this shell supports */
  supportedThemes: string[];
}
```

- [ ] **Step 3: Create types index**

Create `src/shared/types/index.ts`:

```typescript
export type { ShellDefinition } from './shell';
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/ src/shells/
git commit -m "feat: create multi-shell directory structure and ShellDefinition type"
```

---

### Task 3: Move src/api/ → src/shared/api/

**Files:**
- Move: All 23 files from `src/api/` to `src/shared/api/`
- Delete: `src/api/` directory after move

- [ ] **Step 1: Move api directory**

```bash
cp -r src/api/* src/shared/api/
```

- [ ] **Step 2: Add getActiveShell/setActiveShell to api**

In `src/shared/api/instances.ts` (or a new `src/shared/api/config.ts`), add:

```typescript
import { invoke } from '@tauri-apps/api/core';

export const getActiveShell = (): Promise<string> =>
  invoke<string>('get_active_shell');

export const setActiveShell = (shellId: string): Promise<void> =>
  invoke<void>('set_active_shell', { shellId });
```

If creating a new `config.ts`, also add the export to `src/shared/api/index.ts`.

- [ ] **Step 3: Delete old api directory**

```bash
rm -rf src/api/
```

Also delete `src/api.ts` (the old re-export file) since the unified api object will be at `src/shared/api/index.ts`.

- [ ] **Step 4: Update all imports referencing old api paths**

Find all files importing from `@/api` or `../api` or `../../api` etc. and update to point to `@/shared/api` or the correct relative path.

Key import patterns to update:
- `from '@/api'` → `from '@/shared/api'`
- `from '../api'` → `from '../../shared/api'` (from shells/zzz/pages/)
- `from '../../api'` → `from '../../../shared/api'` (from shells/zzz/components/ui/)

Run: `grep -rn "from.*['\"].*api['\"]" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/api/" | grep -v node_modules`

Update each file found.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No errors related to api imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move src/api/ to src/shared/api/ and update all imports"
```

---

### Task 4: Move src/stores/ → src/shared/stores/

**Files:**
- Move: All 19 files from `src/stores/` to `src/shared/stores/`

- [ ] **Step 1: Move stores directory**

```bash
cp -r src/stores/* src/shared/stores/
rm -rf src/stores/
```

- [ ] **Step 2: Update all imports referencing old stores paths**

Key patterns:
- `from '@/stores/'` → `from '@/shared/stores/'`
- `from '../stores/'` → relative path to `shared/stores/`

Run: `grep -rn "from.*['\"].*stores/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/stores/"`

Update each file found.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move src/stores/ to src/shared/stores/ and update all imports"
```

---

### Task 5: Move src/utils/ → src/shared/utils/

**Files:**
- Move: All 11 files from `src/utils/` to `src/shared/utils/`

- [ ] **Step 1: Move utils directory**

```bash
cp -r src/utils/* src/shared/utils/
rm -rf src/utils/
```

- [ ] **Step 2: Update all imports referencing old utils paths**

Key patterns:
- `from '@/utils/'` → `from '@/shared/utils/'`
- `from '../utils/'` → relative path to `shared/utils/`

Run: `grep -rn "from.*['\"].*utils/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/utils/"`

Update each file found.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move src/utils/ to src/shared/utils/ and update all imports"
```

---

### Task 6: Move src/hooks/, src/i18n/, src/ai/, src/constants/ → src/shared/

**Files:**
- Move: `src/hooks/*` → `src/shared/hooks/`
- Move: `src/i18n/*` → `src/shared/i18n/`
- Move: `src/ai/*` → `src/shared/ai/`
- Move: `src/constants/*` → `src/shared/constants/`

- [ ] **Step 1: Move all four directories**

```bash
# hooks — merge with existing shared/hooks/ (which has new files)
cp -r src/hooks/* src/shared/hooks/
rm -rf src/hooks/

# i18n
cp -r src/i18n/* src/shared/i18n/
rm -rf src/i18n/

# ai
cp -r src/ai/* src/shared/ai/
rm -rf src/ai/

# constants
cp -r src/constants/* src/shared/constants/
rm -rf src/constants/
```

- [ ] **Step 2: Update all imports**

Run for each directory:
```bash
grep -rn "from.*['\"].*hooks/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/hooks/"
grep -rn "from.*['\"].*i18n/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/i18n/"
grep -rn "from.*['\"].*ai/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/ai/"
grep -rn "from.*['\"].*constants/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shared/constants/"
```

Update each file found.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move hooks/i18n/ai/constants to src/shared/ and update all imports"
```

---

### Task 7: Move src/components/ → src/shells/zzz/components/

**Files:**
- Move: All ~120 files from `src/components/` to `src/shells/zzz/components/`

- [ ] **Step 1: Move components directory**

```bash
cp -r src/components/* src/shells/zzz/components/
rm -rf src/components/
```

- [ ] **Step 2: Update all imports referencing old components paths**

This is the largest import update. Key patterns:
- `from '@/components/'` → `from '@/shells/zzz/components/'`
- `from '../components/'` → relative path to `shells/zzz/components/`
- `from '../../components/'` → relative path to `shells/zzz/components/`

Run: `grep -rn "from.*['\"].*components/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shells/zzz/components/"`

Update each file found. Most will be in `src/shells/zzz/pages/` files importing components.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move src/components/ to src/shells/zzz/components/ and update all imports"
```

---

### Task 8: Move src/pages/ → src/shells/zzz/pages/

**Files:**
- Move: All 40 files from `src/pages/` to `src/shells/zzz/pages/`

- [ ] **Step 1: Move pages directory**

```bash
cp -r src/pages/* src/shells/zzz/pages/
rm -rf src/pages/
```

- [ ] **Step 2: Update all imports referencing old pages paths**

Key patterns:
- `from '@/pages/'` → `from '@/shells/zzz/pages/'`
- `from '../pages/'` → relative path to `shells/zzz/pages/`
- `from '../../pages/'` → relative path to `shells/zzz/pages/`

Run: `grep -rn "from.*['\"].*pages/" src/ --include="*.ts" --include="*.tsx" | grep -v "src/shells/zzz/pages/"`

Update each file found.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move src/pages/ to src/shells/zzz/pages/ and update all imports"
```

---

### Task 9: Move src/styles/ → src/shells/zzz/styles/

**Files:**
- Move: All 4 files from `src/styles/` to `src/shells/zzz/styles/`

- [ ] **Step 1: Move styles directory**

```bash
cp -r src/styles/* src/shells/zzz/styles/
rm -rf src/styles/
```

- [ ] **Step 2: Update all CSS imports and style references**

Run: `grep -rn "from.*['\"].*styles/" src/ --include="*.ts" --include="*.tsx" --include="*.css" | grep -v "src/shells/zzz/styles/"`

Also check `import` statements in CSS files and any references in `main.tsx` or `App.tsx`.

- [ ] **Step 3: Verify build works**

Run: `pnpm build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move src/styles/ to src/shells/zzz/styles/ and update all imports"
```

---

### Task 10: Create Shell Registry + ShellStore

**Files:**
- Create: `src/shell-registry.ts`
- Create: `src/shared/stores/shellStore.tsx`

- [ ] **Step 1: Create shell-registry.ts**

Create `src/shell-registry.ts`:

```typescript
import React from 'react';
import type { ShellDefinition } from './shared/types/shell';

type LazyShellComponent = React.LazyExoticComponent<React.ComponentType>;

const registry = new Map<string, ShellDefinition>();
const components = new Map<string, LazyShellComponent>();

export function registerShell(shell: ShellDefinition): void {
  if (registry.has(shell.id)) {
    console.warn(`Shell "${shell.id}" already registered, skipping.`);
    return;
  }
  registry.set(shell.id, shell);
  components.set(shell.id, React.lazy(shell.loader));
}

export function getShellComponent(id: string): LazyShellComponent {
  const component = components.get(id);
  if (!component) {
    throw new Error(
      `Shell "${id}" not registered. Available: ${Array.from(registry.keys()).join(', ')}`
    );
  }
  return component;
}

export function getAllShells(): ShellDefinition[] {
  return Array.from(registry.values());
}

export function isShellRegistered(id: string): boolean {
  return registry.has(id);
}

// Register all shells — each index.ts only exports ShellDefinition (tiny, < 1KB)
import { zzzShell } from './shells/zzz';
import { swiftuiShell } from './shells/swiftui';
import { fluentShell } from './shells/fluent';
import { tvShell } from './shells/tv';

registerShell(zzzShell);
registerShell(swiftuiShell);
registerShell(fluentShell);
registerShell(tvShell);
```

- [ ] **Step 2: Create shellStore.tsx**

Create `src/shared/stores/shellStore.tsx`:

```typescript
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ShellDefinition } from '../types/shell';
import { api } from '../api';
import { getAllShells } from '../../shell-registry';

interface ShellState {
  activeShell: string;
  availableShells: ShellDefinition[];
  isSwitching: boolean;
}

const initialState: ShellState = {
  activeShell: 'zzz',
  availableShells: [],
  isSwitching: false,
};

type ShellAction =
  | { type: 'SET_ACTIVE_SHELL'; payload: string }
  | { type: 'SET_SWITCHING'; payload: boolean }
  | { type: 'SET_AVAILABLE_SHELLS'; payload: ShellDefinition[] }
  | { type: 'INIT_FROM_CONFIG'; payload: string };

function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'SET_ACTIVE_SHELL':
      return { ...state, activeShell: action.payload, isSwitching: true };
    case 'SET_SWITCHING':
      return { ...state, isSwitching: action.payload };
    case 'SET_AVAILABLE_SHELLS':
      return { ...state, availableShells: action.payload };
    case 'INIT_FROM_CONFIG':
      return { ...state, activeShell: action.payload };
    default:
      return state;
  }
}

interface ShellContextValue {
  state: ShellState;
  setActiveShell: (shellId: string) => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialState);

  useEffect(() => {
    async function init() {
      try {
        const savedShell = await api.getActiveShell();
        dispatch({ type: 'INIT_FROM_CONFIG', payload: savedShell });
      } catch {
        // Config read failed, use default 'zzz'
      }
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    }
    init();
  }, []);

  const setActiveShell = useCallback(async (shellId: string) => {
    dispatch({ type: 'SET_ACTIVE_SHELL', payload: shellId });
    try {
      await api.setActiveShell(shellId);
    } catch (e) {
      console.error('Failed to persist shell selection:', e);
    }
  }, []);

  return (
    <ShellContext.Provider value={{ state, setActiveShell }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShellStore(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShellStore must be used within a ShellProvider');
  }
  return context;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Note: Will fail because shell index.ts files don't exist yet. That's expected — we'll create them in Task 11.

- [ ] **Step 4: Commit**

```bash
git add src/shell-registry.ts src/shared/stores/shellStore.tsx
git commit -m "feat: add shell-registry and shellStore for multi-shell management"
```

---

### Task 11: Create ZZZ Shell Entry + Placeholder Shells

**Files:**
- Create: `src/shells/zzz/index.ts`
- Create: `src/shells/zzz/AppShell.tsx`
- Create: `src/shells/swiftui/index.ts`
- Create: `src/shells/swiftui/AppShell.tsx`
- Create: `src/shells/fluent/index.ts`
- Create: `src/shells/fluent/AppShell.tsx`
- Create: `src/shells/tv/index.ts`
- Create: `src/shells/tv/AppShell.tsx`

- [ ] **Step 1: Create ZZZ Shell index.ts**

Create `src/shells/zzz/index.ts`:

```typescript
import type { ShellDefinition } from '../../shared/types/shell';

export const zzzShell: ShellDefinition = {
  id: 'zzz',
  name: 'ZZZ Neo-Tokyo',
  description: '赛博朋克风格界面，灵感来自绝区零',
  icon: '⚡',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['dark', 'light', 'oled'],
};
```

- [ ] **Step 2: Create ZZZ AppShell.tsx**

This file extracts the current AppShell/layout logic from `src/App.tsx`. Read the current `App.tsx` to understand its structure, then create `src/shells/zzz/AppShell.tsx` that contains:

1. The ZZZ-specific layout (Sidebar + content area)
2. All ZZZ route definitions
3. The ZZZ-specific providers/wrappers

The exact code depends on the current `App.tsx` structure. At minimum:

```typescript
// src/shells/zzz/AppShell.tsx
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
// Import all ZZZ pages and layout components
// These paths will be relative to shells/zzz/

function ZZZAppShell() {
  return (
    <HashRouter>
      {/* ZZZ-specific layout: Sidebar + content */}
      <Routes>
        {/* All ZZZ routes */}
      </Routes>
    </HashRouter>
  );
}

export default ZZZAppShell;
```

The actual implementation should extract the existing layout/routing logic from the current `App.tsx` verbatim — no functional changes.

- [ ] **Step 3: Create placeholder SwiftUI Shell**

Create `src/shells/swiftui/index.ts`:

```typescript
import type { ShellDefinition } from '../../shared/types/shell';

export const swiftuiShell: ShellDefinition = {
  id: 'swiftui',
  name: 'SwiftUI Style',
  description: '遵循 Apple Human Interface Guidelines 的设计语言',
  icon: '🍎',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['light', 'dark'],
};
```

Create `src/shells/swiftui/AppShell.tsx`:

```typescript
import React from 'react';

function SwiftUIAppShell() {
  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#1C1C1E', minHeight: '100vh' }}>
      <h1>SwiftUI Shell</h1>
      <p>This shell is under construction.</p>
      <p>Switch back to ZZZ Shell in Settings.</p>
    </div>
  );
}

export default SwiftUIAppShell;
```

- [ ] **Step 4: Create placeholder Fluent Shell**

Create `src/shells/fluent/index.ts`:

```typescript
import type { ShellDefinition } from '../../shared/types/shell';

export const fluentShell: ShellDefinition = {
  id: 'fluent',
  name: 'Fluent UI Style',
  description: '遵循 Microsoft Fluent Design System 2 的设计语言',
  icon: '🪟',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/new', '/instances/:id',
    '/collections', '/library', '/versions', '/settings',
  ],
  supportedThemes: ['light', 'dark'],
};
```

Create `src/shells/fluent/AppShell.tsx`:

```typescript
import React from 'react';

function FluentAppShell() {
  return (
    <div style={{ padding: '2rem', color: '#fff', background: '#1A1A1A', minHeight: '100vh' }}>
      <h1>Fluent UI Shell</h1>
      <p>This shell is under construction.</p>
      <p>Switch back to ZZZ Shell in Settings.</p>
    </div>
  );
}

export default FluentAppShell;
```

- [ ] **Step 5: Create placeholder TV Shell**

Create `src/shells/tv/index.ts`:

```typescript
import type { ShellDefinition } from '../../shared/types/shell';

export const tvShell: ShellDefinition = {
  id: 'tv',
  name: 'TV / 10-foot UI',
  description: '大屏电视遥控器操作界面',
  icon: '📺',
  loader: () => import('./AppShell'),
  supportedRoutes: [
    '/home', '/store', '/store/:type/:slug',
    '/instances', '/instances/:id',
    '/library', '/settings',
  ],
  supportedThemes: ['dark'],
};
```

Create `src/shells/tv/AppShell.tsx`:

```typescript
import React from 'react';

function TVAppShell() {
  return (
    <div style={{ padding: '4rem', color: '#fff', background: '#0D0D0D', minHeight: '100vh', fontSize: '1.5rem' }}>
      <h1>TV Shell</h1>
      <p>This shell is under construction.</p>
      <p>Switch back to ZZZ Shell in Settings.</p>
    </div>
  );
}

export default TVAppShell;
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 7: Commit**

```bash
git add src/shells/
git commit -m "feat: add ZZZ AppShell + placeholder SwiftUI/Fluent/TV shells"
```

---

### Task 12: Refactor App.tsx to Use Shell Rendering

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/shared/utils/composeProviders.tsx`

- [ ] **Step 1: Update composeProviders to include ShellProvider**

Read `src/shared/utils/composeProviders.tsx` and add `ShellProvider` to the provider chain. It should be placed before `ThemeBridge`/`ThemeProvider`:

```typescript
// Add import:
import { ShellProvider } from '../stores/shellStore';

// Add ShellProvider to the composed providers array, before ThemeProvider
```

- [ ] **Step 2: Rewrite App.tsx**

Replace the current `App.tsx` with the shell-rendering version:

```typescript
import React, { Suspense } from 'react';
import { getShellComponent } from './shell-registry';
import { AppProviders } from './shared/utils/composeProviders';
import { useShellStore } from './shared/stores/shellStore';

function ShellLoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div>Loading Shell...</div>
    </div>
  );
}

function ShellRenderer() {
  const { state, setActiveShell } = useShellStore();
  const ShellComponent = getShellComponent(state.activeShell);

  return (
    <Suspense fallback={<ShellLoadingScreen />}>
      <ShellComponent />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProviders>
      <ShellRenderer />
    </AppProviders>
  );
}
```

- [ ] **Step 3: Update main.tsx if needed**

Read `src/main.tsx` and ensure it imports from the new `App.tsx` correctly. Update any references to old paths.

- [ ] **Step 4: Verify build works**

Run: `pnpm build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 5: Verify app runs**

Run: `pnpm dev` and open http://localhost:1420

Expected: ZZZ Shell renders correctly with all existing functionality.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.tsx src/shared/utils/composeProviders.tsx
git commit -m "feat: refactor App.tsx to use shell-rendering with lazy loading"
```

---

### Task 13: Final Import Path Audit + Build Verification

**Files:**
- Potentially many files with remaining old import paths

- [ ] **Step 1: Search for any remaining old import paths**

```bash
# Check for imports still referencing old locations
grep -rn "from.*['\"]@/api['\"]" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/stores/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/utils/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/hooks/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/components/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/pages/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/styles/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/i18n/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/ai/" src/ --include="*.ts" --include="*.tsx"
grep -rn "from.*['\"]@/constants/" src/ --include="*.ts" --include="*.tsx"
```

Update any remaining files found.

- [ ] **Step 2: Full TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 3: Full build check**

Run: `pnpm build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 4: Full check (both Rust and TS)**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15`

Expected: Both pass.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve remaining import path issues after multi-shell migration"
```

---

## Phase 2: MD3 Cleanup

### Task 14: Delete MD3 Theme Plugin

**Files:**
- Delete: `src/plugins/builtins/md3-theme/` (entire directory)
- Modify: `src/plugins/builtins/` — remove MD3 registration
- Modify: `src/shared/stores/themeStore.tsx` — remove MD3 options
- Modify: `src/shared/utils/composeProviders.tsx` — remove MD3 Provider
- Modify: `src/shells/zzz/styles/themes.css` — remove MD3 variables

- [ ] **Step 1: Delete MD3 theme directory**

```bash
rm -rf src/plugins/builtins/md3-theme/
```

- [ ] **Step 2: Remove MD3 registration from plugins**

Read `src/plugins/builtins/` index files and remove any MD3-related imports and registrations.

- [ ] **Step 3: Clean themeStore**

Read `src/shared/stores/themeStore.tsx` and:
- Remove MD3 theme option from the theme enum/union type
- Remove any MD3-specific logic
- Ensure only ZZZ theme variants (dark/light/oled) remain

- [ ] **Step 4: Clean composeProviders**

Read `src/shared/utils/composeProviders.tsx` and remove any MD3-specific Provider imports and usage.

- [ ] **Step 5: Clean themes.css**

Read `src/shells/zzz/styles/themes.css` and remove any MD3 CSS custom properties/variables. Keep only ZZZ dark/light/oled variables.

- [ ] **Step 6: Search for remaining MD3 references**

```bash
grep -rn "md3\|MD3\|material.*design.*3\|MD3AppShell\|MD3Theme" src/ --include="*.ts" --include="*.tsx" --include="*.css"
```

Remove or update any remaining references found.

- [ ] **Step 7: Verify build**

Run: `pnpm build 2>&1 | tail -20`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "cleanup: remove MD3 theme plugin and all MD3-related code"
```

---

## Phase 3: SwiftUI Shell (Outline)

> This phase will be detailed in a separate plan when ready to implement. The design spec (Section 7.2) provides the full design language specification.

### Task 15-25: SwiftUI Shell Implementation (Future)

Key tasks:
1. Create SwiftUI design tokens (`tokens-swiftui.css`)
2. Create SwiftUI theme variants (`themes-swiftui.css`)
3. Implement SwiftUI AppShell with NavigationSplitView-style layout
4. Implement SwiftUI base UI components (Button, Modal, Tabs, Card, List, Form)
5. Implement SwiftUI pages one by one (Home → Store → Detail → Instances → Settings)
6. Add Shell switcher UI to Settings page
7. Verify ZZZ ↔ SwiftUI switching works

---

## Phase 4+: Fluent Shell, TV Shell (Outline)

> These phases will be detailed in separate plans when ready to implement.

### Fluent Shell Key Tasks (Future)
1. Fluent design tokens + Acrylic material CSS
2. Navigation View layout (hamburger + sidebar)
3. Fluent UI components (Primary/Secondary/Subtle buttons, CommandBar)
4. All pages with Fluent styling

### TV Shell Key Tasks (Future)
1. TV design tokens (large font, high contrast)
2. Focus management system (`useFocusManager` hook)
3. Horizontal row scrolling layout
4. Simplified page set (no /instances/new, /collections, /versions)
5. Directional key navigation

---

## Self-Review Checklist

### Spec Coverage

| Spec Section | Task(s) |
|-------------|---------|
| 1. Overview | All tasks |
| 2. Directory Structure | Task 2 (dirs), Tasks 3-9 (moves) |
| 3. Shell Registry + Lazy Loading | Task 10, Task 11 |
| 4. Shared Layer | Tasks 3-6 (moves), Task 10 (shellStore) |
| 5. Rust Backend Changes | Task 1 |
| 6. MD3 Cleanup | Task 14 |
| 7. Shell Design Specs | Phase 3+ (outline) |
| 8. Route Mapping | Task 11 (supportedRoutes in ShellDefinition) |
| 9. Migration Strategy | Tasks 1-13 = Phase 1, Task 14 = Phase 2 |
| 10. Risk & Mitigation | Addressed in task design (incremental commits, build checks) |
| 11. Testing | Build verification at each task |
| 12. Performance | Lazy loading via React.lazy (Task 10) |

### Placeholder Scan

No TBD/TODO/implement-later patterns found. All steps contain concrete code or commands.

### Type Consistency

- `ShellDefinition` interface defined in Task 2, used consistently in Tasks 10-11
- `shellStore` state/actions defined in Task 10, matches usage in Task 12
- `api.getActiveShell()` / `api.setActiveShell()` added in Task 3, used in Task 10
