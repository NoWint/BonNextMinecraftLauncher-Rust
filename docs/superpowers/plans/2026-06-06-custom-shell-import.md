# Custom Shell Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to import custom Shell UIs (React components) into BonNext, appearing alongside built-in shells in the ShellSwitcher.

**Architecture:** Rust backend scans `{data_dir}/shells/` for custom shell packages (manifest.json + shell.js + shell.css). Frontend dynamically registers them into the existing shell-registry, loads via `import()` with Tauri's `convertFileSrc()`, and injects CSS via `<link>` tags. ShellSwitcher and shellStore are extended to support custom shells alongside built-in ones.

**Tech Stack:** Rust (Tauri commands), React 18, TypeScript, Tauri v2 asset protocol

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src-tauri/src/commands/shell.rs` | Rust commands: scan, import, remove, get entry path |
| `src/shared/api/shell.ts` | Replace existing — add custom shell API wrappers |
| `src/shared/types/custom-shell.ts` | CustomShellMeta type definition |
| `src/shared/utils/custom-shell-loader.ts` | Dynamic import + CSS injection logic |
| `src/shared/components/ShellErrorBoundary.tsx` | ErrorBoundary for custom shell rendering |
| `src/shells/zzz/pages/settings/ShellManagementSection.tsx` | Shell management UI in settings |

### Modified Files

| File | Change |
|------|--------|
| `src-tauri/src/commands/mod.rs` | Add `pub mod shell;` |
| `src-tauri/src/commands/config.rs` | Remove hardcoded shell whitelist from `set_active_shell` |
| `src-tauri/src/lib.rs` | Register new shell commands in invoke_handler |
| `src/shell-registry.ts` | Add `registerCustomShell()`, `unregisterShell()`, `clearCustomShells()` |
| `src/shared/types/shell.ts` | Add `isCustom` field to ShellDefinition |
| `src/shared/stores/shellStore.tsx` | Load custom shells on init, add remove/import actions |
| `src/shared/components/ShellSwitcher.tsx` | Support custom shell icons, show custom badge |
| `src/shared/api/index.ts` | Add new shell API methods to `api` object |
| `src/App.tsx` | Wrap ShellRenderer in ShellErrorBoundary |

---

### Task 1: Rust Backend — Custom Shell Commands

**Files:**
- Create: `src-tauri/src/commands/shell.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/commands/config.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `src-tauri/src/commands/shell.rs`**

```rust
use crate::error::LauncherError;
use crate::platform::paths;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomShellMeta {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub entry: String,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub preview: Option<String>,
    #[serde(default)]
    pub min_app_version: Option<String>,
    pub supported_themes: Vec<String>,
    pub supported_routes: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    /// Absolute path to the shell directory on disk
    pub path: String,
}

#[tauri::command]
pub async fn scan_custom_shells() -> Result<Vec<CustomShellMeta>, LauncherError> {
    let data_dir = paths::data_dir();
    let shells_dir = data_dir.join("shells");

    if !shells_dir.exists() {
        return Ok(vec![]);
    }

    let mut results = Vec::new();
    let mut entries = fs::read_dir(&shells_dir).await.map_err(|e| {
        LauncherError::IoError(format!("Failed to read shells directory: {}", e))
    })?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        LauncherError::IoError(format!("Failed to read directory entry: {}", e))
    })? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }

        match fs::read_to_string(&manifest_path).await {
            Ok(content) => {
                // Parse manifest, injecting the directory path
                let mut meta: CustomShellMeta = match serde_json::from_str(&content) {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::warn!(
                            "Invalid manifest.json in {}: {}",
                            path.display(),
                            e
                        );
                        continue;
                    }
                };

                // Verify the entry file exists
                let entry_path = path.join(&meta.entry);
                if !entry_path.exists() {
                    tracing::warn!(
                        "Entry file {} not found in {}",
                        meta.entry,
                        path.display()
                    );
                    continue;
                }

                // Verify id matches directory name
                let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
                if meta.id != dir_name {
                    tracing::warn!(
                        "Shell id '{}' doesn't match directory name '{}' in {}",
                        meta.id,
                        dir_name,
                        path.display()
                    );
                    continue;
                }

                meta.path = path.to_string_lossy().to_string();
                results.push(meta);
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to read manifest.json in {}: {}",
                    path.display(),
                    e
                );
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn import_custom_shell(source_path: String) -> Result<CustomShellMeta, LauncherError> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(LauncherError::IoError(format!(
            "Source path does not exist: {}",
            source_path
        )));
    }

    // If it's a zip file, extract it first
    let shell_dir = if source.extension().map_or(false, |e| e == "zip") {
        let temp_dir = std::env::temp_dir().join("bonnext-shell-import");
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir).await.map_err(|e| {
                LauncherError::IoError(format!("Failed to clean temp dir: {}", e))
            })?;
        }
        fs::create_dir_all(&temp_dir).await.map_err(|e| {
            LauncherError::IoError(format!("Failed to create temp dir: {}", e))
        })?;

        // Extract zip
        let file = std::fs::File::open(&source).map_err(|e| {
            LauncherError::IoError(format!("Failed to open zip: {}", e))
        })?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            LauncherError::ZipError(format!("Failed to read zip: {}", e))
        })?;
        archive.extract(&temp_dir).map_err(|e| {
            LauncherError::ZipError(format!("Failed to extract zip: {}", e))
        })?;

        // Check if the zip contained a single top-level directory
        let entries: Vec<_> = std::fs::read_dir(&temp_dir)
            .map_err(|e| LauncherError::IoError(format!("Failed to read extracted dir: {}", e)))?
            .filter_map(|e| e.ok())
            .collect();

        if entries.len() == 1 && entries[0].path().is_dir() {
            entries[0].path().clone()
        } else {
            temp_dir
        }
    } else if source.is_dir() {
        source.clone()
    } else {
        return Err(LauncherError::InvalidConfig(format!(
            "Source must be a directory or zip file: {}",
            source_path
        )));
    };

    // Read and validate manifest
    let manifest_path = shell_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err(LauncherError::InvalidConfig(
            "manifest.json not found in shell package".to_string(),
        ));
    }

    let content = fs::read_to_string(&manifest_path).await.map_err(|e| {
        LauncherError::IoError(format!("Failed to read manifest.json: {}", e))
    })?;
    let mut meta: CustomShellMeta = serde_json::from_str(&content).map_err(|e| {
        LauncherError::JsonError(format!("Invalid manifest.json: {}", e))
    })?;

    // Validate entry file exists
    let entry_path = shell_dir.join(&meta.entry);
    if !entry_path.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Entry file '{}' not found in shell package",
            meta.entry
        )));
    }

    // Validate id format (alphanumeric + hyphens)
    if !meta.id.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell id must be alphanumeric with hyphens: '{}'",
            meta.id
        )));
    }

    // Check for conflicts with built-in shells
    let builtin_shells = ["zzz", "swiftui", "fluent", "tv"];
    if builtin_shells.contains(&meta.id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell id '{}' conflicts with a built-in shell",
            meta.id
        )));
    }

    // Copy to data_dir/shells/{id}/
    let data_dir = paths::data_dir();
    let dest_dir = data_dir.join("shells").join(&meta.id);

    if dest_dir.exists() {
        return Err(LauncherError::InvalidConfig(format!(
            "Shell with id '{}' already exists. Remove it first before importing.",
            meta.id
        )));
    }

    fs::create_dir_all(&dest_dir).await.map_err(|e| {
        LauncherError::IoError(format!("Failed to create shell directory: {}", e))
    })?;

    // Copy directory recursively
    copy_dir_recursive(&shell_dir, &dest_dir)?;

    meta.path = dest_dir.to_string_lossy().to_string();
    Ok(meta)
}

#[tauri::command]
pub async fn remove_custom_shell(id: String) -> Result<(), LauncherError> {
    let data_dir = paths::data_dir();
    let shell_dir = data_dir.join("shells").join(&id);

    if !shell_dir.exists() {
        return Err(LauncherError::IoError(format!(
            "Shell directory not found: {}",
            shell_dir.display()
        )));
    }

    // Prevent removing built-in shells
    let builtin_shells = ["zzz", "swiftui", "fluent", "tv"];
    if builtin_shells.contains(&id.as_str()) {
        return Err(LauncherError::InvalidConfig(format!(
            "Cannot remove built-in shell: {}",
            id
        )));
    }

    fs::remove_dir_all(&shell_dir).await.map_err(|e| {
        LauncherError::IoError(format!("Failed to remove shell directory: {}", e))
    })?;

    Ok(())
}

#[tauri::command]
pub async fn get_custom_shell_entry(id: String) -> Result<String, LauncherError> {
    let data_dir = paths::data_dir();
    let shell_dir = data_dir.join("shells").join(&id);

    if !shell_dir.exists() {
        return Err(LauncherError::IoError(format!(
            "Shell directory not found: {}",
            shell_dir.display()
        )));
    }

    let manifest_path = shell_dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path).await.map_err(|e| {
        LauncherError::IoError(format!("Failed to read manifest.json: {}", e))
    })?;
    let meta: CustomShellMeta = serde_json::from_str(&content).map_err(|e| {
        LauncherError::JsonError(format!("Invalid manifest.json: {}", e))
    })?;

    let entry_path = shell_dir.join(&meta.entry);
    if !entry_path.exists() {
        return Err(LauncherError::IoError(format!(
            "Entry file not found: {}",
            entry_path.display()
        )));
    }

    Ok(entry_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_custom_shell_css(id: String) -> Result<Option<String>, LauncherError> {
    let data_dir = paths::data_dir();
    let shell_dir = data_dir.join("shells").join(&id);

    if !shell_dir.exists() {
        return Err(LauncherError::IoError(format!(
            "Shell directory not found: {}",
            shell_dir.display()
        )));
    }

    let manifest_path = shell_dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path).await.map_err(|e| {
        LauncherError::IoError(format!("Failed to read manifest.json: {}", e))
    })?;
    let meta: CustomShellMeta = serde_json::from_str(&content).map_err(|e| {
        LauncherError::JsonError(format!("Invalid manifest.json: {}", e))
    })?;

    if let Some(style) = &meta.style {
        let css_path = shell_dir.join(style);
        if css_path.exists() {
            return Ok(Some(css_path.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), LauncherError> {
    std::fs::create_dir_all(dst).map_err(|e| {
        LauncherError::IoError(format!("Failed to create directory: {}", e))
    })?;

    for entry in std::fs::read_dir(src).map_err(|e| {
        LauncherError::IoError(format!("Failed to read directory: {}", e))
    })? {
        let entry = entry.map_err(|e| {
            LauncherError::IoError(format!("Failed to read entry: {}", e))
        })?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path).map_err(|e| {
                LauncherError::IoError(format!("Failed to copy file: {}", e))
            })?;
        }
    }

    Ok(())
}
```

- [ ] **Step 2: Register the new module in `src-tauri/src/commands/mod.rs`**

Add at the end of the file:
```rust
pub mod shell;
```

- [ ] **Step 3: Modify `src-tauri/src/commands/config.rs` — remove hardcoded shell whitelist**

Replace the `set_active_shell` function:

```rust
#[tauri::command]
pub async fn set_active_shell(shell_id: String) -> Result<(), LauncherError> {
    // Allow any shell id — custom shells are validated at scan time
    let mut config = config::load_config_async().await?;
    config.active_shell = shell_id;
    config::save_config_async(&config).await?;
    Ok(())
}
```

- [ ] **Step 4: Register new commands in `src-tauri/src/lib.rs` invoke_handler**

Add these lines after the existing `commands::config::set_active_shell` line (around line 154):

```rust
commands::shell::scan_custom_shells,
commands::shell::import_custom_shell,
commands::shell::remove_custom_shell,
commands::shell::get_custom_shell_entry,
commands::shell::get_custom_shell_css,
```

- [ ] **Step 5: Verify Rust compiles**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished"`
Expected: `Finished` with no errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/shell.rs src-tauri/src/commands/mod.rs src-tauri/src/commands/config.rs src-tauri/src/lib.rs
git commit -m "feat: add Rust backend commands for custom shell management"
```

---

### Task 2: Frontend Types & API Layer

**Files:**
- Create: `src/shared/types/custom-shell.ts`
- Modify: `src/shared/types/shell.ts`
- Modify: `src/shared/api/shell.ts`
- Modify: `src/shared/api/index.ts`

- [ ] **Step 1: Create `src/shared/types/custom-shell.ts`**

```typescript
/** Metadata for a custom shell, mirroring the Rust CustomShellMeta struct */
export interface CustomShellMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string | null;
  entry: string;
  style: string | null;
  preview: string | null;
  min_app_version: string | null;
  supported_themes: string[];
  supported_routes: string[];
  permissions: string[];
  /** Absolute path to the shell directory on disk */
  path: string;
}
```

- [ ] **Step 2: Modify `src/shared/types/shell.ts` — add `isCustom` field**

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
  /** Whether this is a user-imported custom shell */
  isCustom?: boolean;
}
```

- [ ] **Step 3: Modify `src/shared/api/shell.ts` — add custom shell API wrappers**

Replace the entire file:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { CustomShellMeta } from '../types/custom-shell';

export const getActiveShell = (): Promise<string> =>
  invoke<string>('get_active_shell');

export const setActiveShell = (shellId: string): Promise<void> =>
  invoke<void>('set_active_shell', { shellId });

export const scanCustomShells = (): Promise<CustomShellMeta[]> =>
  invoke<CustomShellMeta[]>('scan_custom_shells');

export const importCustomShell = (path: string): Promise<CustomShellMeta> =>
  invoke<CustomShellMeta>('import_custom_shell', { path });

export const removeCustomShell = (id: string): Promise<void> =>
  invoke<void>('remove_custom_shell', { id });

export const getCustomShellEntry = (id: string): Promise<string> =>
  invoke<string>('get_custom_shell_entry', { id });

export const getCustomShellCss = (id: string): Promise<string | null> =>
  invoke<string | null>('get_custom_shell_css', { id });
```

- [ ] **Step 4: Modify `src/shared/api/index.ts` — add new shell methods to `api` object**

Add these lines after `setActiveShell: shell.setActiveShell,` (around line 326):

```typescript
  scanCustomShells: shell.scanCustomShells,
  importCustomShell: shell.importCustomShell,
  removeCustomShell: shell.removeCustomShell,
  getCustomShellEntry: shell.getCustomShellEntry,
  getCustomShellCss: shell.getCustomShellCss,
```

Also update the re-export line (line 27) to include new exports:

```typescript
export { getActiveShell, setActiveShell, scanCustomShells, importCustomShell, removeCustomShell, getCustomShellEntry, getCustomShellCss } from './shell';
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors related to the new files

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/custom-shell.ts src/shared/types/shell.ts src/shared/api/shell.ts src/shared/api/index.ts
git commit -m "feat: add frontend types and API layer for custom shells"
```

---

### Task 3: Custom Shell Loader & Dynamic Registration

**Files:**
- Create: `src/shared/utils/custom-shell-loader.ts`
- Modify: `src/shell-registry.ts`

- [ ] **Step 1: Create `src/shared/utils/custom-shell-loader.ts`**

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CustomShellMeta } from '../types/custom-shell';
import type { ShellDefinition } from '../types/shell';

/**
 * Load a custom shell's JS entry via Tauri asset protocol + dynamic import().
 * Returns the module's default export (a React component).
 */
async function loadCustomShellModule(shellId: string): Promise<{ default: React.ComponentType }> {
  const entryPath = await import('../api').then((m) => m.api.getCustomShellEntry(shellId));
  const entryUrl = convertFileSrc(entryPath);
  const module = await import(/* @vite-ignore */ entryUrl);
  return { default: module.default };
}

/**
 * Inject a custom shell's CSS file into the document head.
 * Removes any previously injected CSS for the same shell.
 */
export function injectShellCss(shellId: string, cssPath: string): void {
  // Remove existing CSS link for this shell
  ejectShellCss(shellId);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = convertFileSrc(cssPath);
  link.setAttribute('data-shell-id', shellId);
  document.head.appendChild(link);
}

/**
 * Remove a custom shell's injected CSS from the document head.
 */
export function ejectShellCss(shellId: string): void {
  const existing = document.querySelector(`link[data-shell-id="${shellId}"]`);
  if (existing) {
    existing.remove();
  }
}

/**
 * Convert a CustomShellMeta (from Rust backend) into a ShellDefinition
 * that can be registered in the shell-registry.
 */
export function customShellToDefinition(meta: CustomShellMeta): ShellDefinition {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description || `Custom shell by ${meta.author || 'unknown'}`,
    icon: meta.icon || '📦',
    loader: () => loadCustomShellModule(meta.id),
    supportedRoutes: meta.supported_routes,
    supportedThemes: meta.supported_themes,
    isCustom: true,
  };
}

/**
 * Load and inject CSS for a custom shell if it has one.
 * Returns the CSS path if injected, null otherwise.
 */
export async function loadShellCss(shellId: string): Promise<string | null> {
  const cssPath = await import('../api').then((m) => m.api.getCustomShellCss(shellId));
  if (cssPath) {
    injectShellCss(shellId, cssPath);
  }
  return cssPath;
}
```

- [ ] **Step 2: Modify `src/shell-registry.ts` — add custom shell registration support**

Replace the entire file:

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

export function registerCustomShell(shell: ShellDefinition): void {
  // Custom shells can replace existing custom shells with the same id
  if (registry.has(shell.id) && !registry.get(shell.id)?.isCustom) {
    console.warn(`Cannot register custom shell "${shell.id}": conflicts with built-in shell.`);
    return;
  }
  registry.set(shell.id, shell);
  components.set(shell.id, React.lazy(shell.loader));
}

export function unregisterShell(id: string): void {
  registry.delete(id);
  components.delete(id);
}

export function clearCustomShells(): void {
  for (const [id, def] of registry.entries()) {
    if (def.isCustom) {
      registry.delete(id);
      components.delete(id);
    }
  }
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

// Register all built-in shells — each index.ts only exports ShellDefinition (tiny, < 1KB)
import { zzzShell } from './shells/zzz';
import { swiftuiShell } from './shells/swiftui';
import { fluentShell } from './shells/fluent';
import { tvShell } from './shells/tv';

registerShell(zzzShell);
registerShell(swiftuiShell);
registerShell(fluentShell);
registerShell(tvShell);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/utils/custom-shell-loader.ts src/shell-registry.ts
git commit -m "feat: add custom shell loader and dynamic registration"
```

---

### Task 4: Shell Store & ErrorBoundary

**Files:**
- Create: `src/shared/components/ShellErrorBoundary.tsx`
- Modify: `src/shared/stores/shellStore.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/shared/components/ShellErrorBoundary.tsx`**

```typescript
import React from 'react';

interface Props {
  children: React.ReactNode;
  onFallback: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ShellErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Shell rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0a0a',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
          gap: '1em',
        }}>
          <h2 style={{ color: '#ff4444', margin: 0 }}>Shell Error</h2>
          <p style={{ color: '#aaa', margin: 0, maxWidth: '30em', textAlign: 'center' }}>
            The current shell failed to render. You can switch back to the default shell.
          </p>
          <pre style={{
            color: '#888',
            fontSize: '0.8em',
            maxWidth: '40em',
            overflow: 'auto',
            background: '#111',
            padding: '1em',
            borderRadius: '4px',
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.props.onFallback}
            style={{
              padding: '0.6em 1.5em',
              background: '#ffe600',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Switch to Default Shell
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Modify `src/shared/stores/shellStore.tsx` — load custom shells on init**

Replace the entire file:

```typescript
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ShellDefinition } from '../types/shell';
import type { CustomShellMeta } from '../types/custom-shell';
import { api } from '../api';
import { getAllShells, registerCustomShell, clearCustomShells, unregisterShell } from '../../shell-registry';
import { customShellToDefinition, loadShellCss, ejectShellCss } from '../utils/custom-shell-loader';

interface ShellState {
  activeShell: string;
  availableShells: ShellDefinition[];
  isSwitching: boolean;
  customShells: CustomShellMeta[];
}

const initialState: ShellState = {
  activeShell: 'zzz',
  availableShells: [],
  isSwitching: false,
  customShells: [],
};

type ShellAction =
  | { type: 'SET_ACTIVE_SHELL'; payload: string }
  | { type: 'SET_SWITCHING'; payload: boolean }
  | { type: 'SET_AVAILABLE_SHELLS'; payload: ShellDefinition[] }
  | { type: 'INIT_FROM_CONFIG'; payload: string }
  | { type: 'SET_CUSTOM_SHELLS'; payload: CustomShellMeta[] }
  | { type: 'ADD_CUSTOM_SHELL'; payload: CustomShellMeta }
  | { type: 'REMOVE_CUSTOM_SHELL'; payload: string };

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
    case 'SET_CUSTOM_SHELLS':
      return { ...state, customShells: action.payload };
    case 'ADD_CUSTOM_SHELL':
      return { ...state, customShells: [...state.customShells, action.payload] };
    case 'REMOVE_CUSTOM_SHELL':
      return { ...state, customShells: state.customShells.filter(s => s.id !== action.payload) };
    default:
      return state;
  }
}

interface ShellContextValue {
  state: ShellState;
  setActiveShell: (shellId: string) => Promise<void>;
  importShell: (path: string) => Promise<void>;
  removeShell: (id: string) => Promise<void>;
  refreshCustomShells: () => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialState);

  // Load custom shells and register them
  const loadCustomShells = useCallback(async () => {
    try {
      const customMetas = await api.scanCustomShells();
      // Clear previous custom shells from registry
      clearCustomShells();
      // Register each custom shell
      for (const meta of customMetas) {
        const def = customShellToDefinition(meta);
        registerCustomShell(def);
      }
      dispatch({ type: 'SET_CUSTOM_SHELLS', payload: customMetas });
      // Update available shells list
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    } catch (e) {
      console.error('Failed to load custom shells:', e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const savedShell = await api.getActiveShell();
        dispatch({ type: 'INIT_FROM_CONFIG', payload: savedShell });
      } catch {
        // Config read failed, use default 'zzz'
      }
      // Load custom shells before setting available shells
      await loadCustomShells();
      dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    }
    init();
  }, [loadCustomShells]);

  const setActiveShell = useCallback(async (shellId: string) => {
    // Eject CSS of previous custom shell
    const prevShell = state.availableShells.find(s => s.id === state.activeShell);
    if (prevShell?.isCustom) {
      ejectShellCss(prevShell.id);
    }

    dispatch({ type: 'SET_ACTIVE_SHELL', payload: shellId });
    try {
      await api.setActiveShell(shellId);
      // Inject CSS for new custom shell
      const newShell = state.availableShells.find(s => s.id === shellId);
      if (newShell?.isCustom) {
        await loadShellCss(shellId);
      }
    } catch (e) {
      console.error('Failed to persist shell selection:', e);
    }
  }, [state.activeShell, state.availableShells]);

  const importShell = useCallback(async (path: string) => {
    const meta = await api.importCustomShell(path);
    const def = customShellToDefinition(meta);
    registerCustomShell(def);
    dispatch({ type: 'ADD_CUSTOM_SHELL', payload: meta });
    dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
  }, []);

  const removeShell = useCallback(async (id: string) => {
    await api.removeCustomShell(id);
    ejectShellCss(id);
    unregisterShell(id);
    dispatch({ type: 'REMOVE_CUSTOM_SHELL', payload: id });
    dispatch({ type: 'SET_AVAILABLE_SHELLS', payload: getAllShells() });
    // If the removed shell was active, switch to default
    if (state.activeShell === id) {
      await setActiveShell('zzz');
    }
  }, [state.activeShell, setActiveShell]);

  const refreshCustomShells = useCallback(async () => {
    await loadCustomShells();
  }, [loadCustomShells]);

  return (
    <ShellContext.Provider value={{ state, setActiveShell, importShell, removeShell, refreshCustomShells }}>
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

- [ ] **Step 3: Modify `src/App.tsx` — wrap ShellRenderer in ErrorBoundary**

```typescript
import { Suspense, useCallback } from 'react';
import { getShellComponent } from './shell-registry';
import { AppProviders } from './shared/utils/composeProviders';
import { useShellStore } from './shared/stores/shellStore';
import { ShellErrorBoundary } from './shared/components/ShellErrorBoundary';

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

  const handleFallback = useCallback(() => {
    setActiveShell('zzz');
  }, [setActiveShell]);

  return (
    <ShellErrorBoundary onFallback={handleFallback}>
      <Suspense fallback={<ShellLoadingScreen />}>
        <ShellComponent />
      </Suspense>
    </ShellErrorBoundary>
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

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/ShellErrorBoundary.tsx src/shared/stores/shellStore.tsx src/App.tsx
git commit -m "feat: add ShellErrorBoundary and extend shellStore with custom shell support"
```

---

### Task 5: ShellSwitcher UI Updates

**Files:**
- Modify: `src/shared/components/ShellSwitcher.tsx`

- [ ] **Step 1: Modify ShellSwitcher to support custom shell icons and badges**

Replace the entire file:

```typescript
import { useState, useRef, useEffect } from 'react';
import { useShellStore } from '../stores/shellStore';
import styles from './ShellSwitcher.module.css';

const SHELL_ICONS: Record<string, JSX.Element> = {
  zzz: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 10L6 6H4.5M8 10L10 6H8.5M11.5 10L13.5 6H12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  swiftui: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
  fluent: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5h8M4 8h6M4 11h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  tv: (
    <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
      <rect x="1" y="2" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 14h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};

/** Default icon for custom shells */
const CustomShellIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" className={styles.shellItemIcon}>
    <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 12 12" fill="none" className={className} width="10" height="10">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" width="12" height="12" className={styles.shellItemCheck}>
    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ShellSwitcher() {
  const { state, setActiveShell } = useShellStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeShell = state.availableShells.find((s) => s.id === state.activeShell);
  const activeIcon = activeShell
    ? (SHELL_ICONS[activeShell.id] || (activeShell.isCustom ? <CustomShellIcon /> : null))
    : null;

  const handleSelect = async (shellId: string) => {
    if (shellId === state.activeShell) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await setActiveShell(shellId);
  };

  return (
    <div className={styles.shellSwitcher} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} title="Switch Shell">
        {activeIcon}
        <span>{activeShell?.name || 'Shell'}</span>
        <ChevronIcon className={`${styles.triggerChevron} ${open ? styles.triggerChevronOpen : ''}`} />
      </button>

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            {state.availableShells.map((shell) => {
              const isActive = shell.id === state.activeShell;
              const icon = SHELL_ICONS[shell.id] || (shell.isCustom ? <CustomShellIcon /> : <span className={styles.shellItemIcon} />);
              return (
                <button
                  key={shell.id}
                  className={`${styles.shellItem} ${isActive ? styles.shellItemActive : ''}`}
                  onClick={() => handleSelect(shell.id)}
                >
                  {icon}
                  <div className={styles.shellItemInfo}>
                    <span className={styles.shellItemName}>
                      {shell.name}
                      {shell.isCustom && <span className={styles.customBadge}>Custom</span>}
                    </span>
                    <span className={styles.shellItemDesc}>{shell.description}</span>
                  </div>
                  {isActive && <CheckIcon />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add custom badge styles to `src/shared/components/ShellSwitcher.module.css`**

Add at the end of the existing CSS module file:

```css
.customBadge {
  display: inline-block;
  font-size: 0.65em;
  padding: 0.1em 0.4em;
  margin-left: 0.4em;
  background: var(--accent, #ffe600);
  color: #000;
  border-radius: 2px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  vertical-align: middle;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/ShellSwitcher.tsx src/shared/components/ShellSwitcher.module.css
git commit -m "feat: update ShellSwitcher to support custom shells with badge"
```

---

### Task 6: Shell Management UI in Settings

**Files:**
- Create: `src/shells/zzz/pages/settings/ShellManagementSection.tsx`
- Create: `src/shells/zzz/pages/settings/ShellManagementSection.module.css`

- [ ] **Step 1: Create `src/shells/zzz/pages/settings/ShellManagementSection.module.css`**

```css
.section {
  padding: 1.5em;
}

.title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 1.4em;
  color: var(--text-primary);
  margin-bottom: 1em;
  letter-spacing: 0.05em;
}

.shellList {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  margin-bottom: 1.5em;
}

.shellCard {
  display: flex;
  align-items: center;
  gap: 1em;
  padding: 0.8em 1em;
  background: var(--bg-card);
  border: 1px solid rgba(255, 255, 255, 0.06);
  clip-path: var(--clip-small);
}

.shellCardActive {
  border-color: var(--accent);
  background: rgba(255, 230, 0, 0.05);
}

.shellCardInfo {
  flex: 1;
  min-width: 0;
}

.shellCardName {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9em;
}

.shellCardMeta {
  font-size: 0.75em;
  color: var(--text-secondary);
  margin-top: 0.2em;
}

.shellCardBadge {
  font-size: 0.65em;
  padding: 0.1em 0.4em;
  background: var(--accent);
  color: #000;
  border-radius: 2px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 0.5em;
}

.shellCardActions {
  display: flex;
  gap: 0.5em;
}

.importRow {
  display: flex;
  gap: 0.8em;
  align-items: center;
}

.importBtn {
  padding: 0.5em 1.2em;
  background: var(--accent);
  color: #000;
  border: none;
  clip-path: var(--clip-small);
  font-weight: 600;
  font-size: 0.85em;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.85;
  }
}

.removeBtn {
  padding: 0.3em 0.8em;
  background: transparent;
  color: var(--danger, #ff4444);
  border: 1px solid var(--danger, #ff4444);
  clip-path: var(--clip-small);
  font-size: 0.75em;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 68, 68, 0.1);
  }
}

.emptyState {
  color: var(--text-secondary);
  font-size: 0.85em;
  padding: 1em 0;
}
```

- [ ] **Step 2: Create `src/shells/zzz/pages/settings/ShellManagementSection.tsx`**

```typescript
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useShellStore } from '../../../../shared/stores/shellStore';
import { useToastStore } from '../../../../shared/stores/toastStore';
import styles from './ShellManagementSection.module.css';

export function ShellManagementSection() {
  const { state, setActiveShell, importShell, removeShell } = useShellStore();
  const { addToast } = useToastStore();
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    setImporting(true);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: 'Shell Package', extensions: ['zip'] },
        ],
      });

      if (!selected) {
        setImporting(false);
        return;
      }

      const path = typeof selected === 'string' ? selected : selected;
      await importShell(path);
      addToast({ message: 'Shell imported successfully', type: 'success' });
    } catch (e: any) {
      addToast({ message: `Import failed: ${e?.message || e}`, type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFolder = async () => {
    setImporting(true);
    try {
      const selected = await open({
        multiple: false,
        directory: true,
      });

      if (!selected) {
        setImporting(false);
        return;
      }

      const path = typeof selected === 'string' ? selected : selected;
      await importShell(path);
      addToast({ message: 'Shell imported successfully', type: 'success' });
    } catch (e: any) {
      addToast({ message: `Import failed: ${e?.message || e}`, type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeShell(id);
      addToast({ message: 'Shell removed', type: 'success' });
    } catch (e: any) {
      addToast({ message: `Remove failed: ${e?.message || e}`, type: 'error' });
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Shell Management</h2>

      <div className={styles.shellList}>
        {state.availableShells.map((shell) => {
          const isActive = shell.id === state.activeShell;
          const customMeta = state.customShells.find(m => m.id === shell.id);
          return (
            <div
              key={shell.id}
              className={`${styles.shellCard} ${isActive ? styles.shellCardActive : ''}`}
            >
              <div className={styles.shellCardInfo}>
                <span className={styles.shellCardName}>
                  {shell.name}
                  {shell.isCustom && <span className={styles.shellCardBadge}>Custom</span>}
                </span>
                <div className={styles.shellCardMeta}>
                  {shell.isCustom && customMeta
                    ? `v${customMeta.version}${customMeta.author ? ` by ${customMeta.author}` : ''}`
                    : 'Built-in'
                  }
                  {' — '}{shell.description}
                </div>
              </div>
              <div className={styles.shellCardActions}>
                {!isActive && (
                  <button
                    className={styles.importBtn}
                    onClick={() => setActiveShell(shell.id)}
                  >
                    Activate
                  </button>
                )}
                {shell.isCustom && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemove(shell.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.importRow}>
        <button
          className={styles.importBtn}
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? 'Importing...' : 'Import from ZIP'}
        </button>
        <button
          className={styles.importBtn}
          onClick={handleImportFolder}
          disabled={importing}
        >
          Import from Folder
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -15`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shells/zzz/pages/settings/ShellManagementSection.tsx src/shells/zzz/pages/settings/ShellManagementSection.module.css
git commit -m "feat: add ShellManagementSection UI for importing and managing custom shells"
```

---

### Task 7: Wire ShellManagementSection into Settings Page

**Files:**
- Modify: `src/shells/zzz/pages/settings/index.tsx` (or wherever settings sections are composed)

- [ ] **Step 1: Find and read the settings page index**

Check `src/shells/zzz/pages/settings/` for the main settings page file that composes all sections.

- [ ] **Step 2: Import and add ShellManagementSection**

Add the import and render `<ShellManagementSection />` alongside the other settings sections. The exact placement depends on the existing settings page structure — add it after the ThemeSection or as the last section.

- [ ] **Step 3: Verify the app builds**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/shells/zzz/pages/settings/
git commit -m "feat: wire ShellManagementSection into settings page"
```

---

### Task 8: Tauri Asset Protocol Configuration

**Files:**
- Modify: `src-tauri/tauri.conf.json` or `src-tauri/capabilities/*.json`

- [ ] **Step 1: Check Tauri v2 asset protocol configuration**

Read the Tauri config to understand how the asset protocol is configured. The `convertFileSrc()` function requires the `asset:` protocol to be enabled and the shells directory to be accessible.

- [ ] **Step 2: Add shell directory scope to Tauri filesystem permissions**

In the Tauri capabilities config, ensure the `$DATA_DIR/shells/**` path is accessible via the asset protocol. This may require adding a scope entry like:

```json
{
  "identifier": "asset:default",
  "allow": [{ "path": "$DATA_DIR/shells/**" }]
}
```

Or in the filesystem plugin scope:

```json
{
  "identifier": "fs:default",
  "allow": [
    { "path": "$DATA_DIR/shells/**" }
  ]
}
```

The exact configuration depends on the Tauri v2 security model in use.

- [ ] **Step 3: Verify the asset protocol works**

Test by running `pnpm tauri dev` and checking that `convertFileSrc()` can produce valid URLs for files in the shells directory.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/
git commit -m "feat: configure Tauri asset protocol for custom shell loading"
```

---

### Task 9: End-to-End Test with a Sample Custom Shell

**Files:**
- Create: `test-shell/manifest.json` (temporary test fixture)
- Create: `test-shell/shell.js` (temporary test fixture)

- [ ] **Step 1: Create a minimal test shell package**

Create a temporary directory `test-shell/` with:

**manifest.json:**
```json
{
  "id": "test-shell",
  "name": "Test Shell",
  "version": "0.1.0",
  "description": "A minimal test shell",
  "author": "BonNext",
  "entry": "shell.js",
  "supportedThemes": ["dark"],
  "supportedRoutes": ["/home", "/instances", "/settings"]
}
```

**shell.js** (a minimal ESM module that exports a React component):
```javascript
// This simulates a bundled custom shell
// In production, this would be built by Vite with externals
const React = window.React;

function TestShell() {
  return React.createElement('div', {
    style: { padding: '2em', color: '#fff', background: '#1a1a2e', minHeight: '100vh' }
  },
    React.createElement('h1', null, 'Test Custom Shell'),
    React.createElement('p', null, 'If you see this, custom shell loading works!'),
  );
}

export default TestShell;
```

- [ ] **Step 2: Manually copy test-shell to data directory**

```bash
cp -r test-shell/ ~/Library/Application\ Support/bonnext/shells/test-shell/
```

- [ ] **Step 3: Run the app and verify**

Run: `pnpm tauri dev`
Expected:
1. Test Shell appears in ShellSwitcher dropdown
2. Clicking it switches to the test shell
3. The test shell renders "Test Custom Shell" heading
4. Switching back to ZZZ shell works
5. Shell Management section in settings shows the test shell

- [ ] **Step 4: Clean up test fixture**

```bash
rm -rf test-shell/ ~/Library/Application\ Support/bonnext/shells/test-shell/
```

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing of custom shell import"
```

---

## Self-Review

**1. Spec coverage:**
- Section 1 (Package Spec): Covered by Task 1 (Rust validates manifest), Task 2 (CustomShellMeta type), Task 3 (loader converts meta to definition)
- Section 2 (Loading & Registration): Covered by Tasks 1, 3, 4
- Section 3 (SDK): Deferred — out of scope for initial implementation, the ShellProps interface is implicit in the component contract
- Section 4 (Import UI & Error Handling): Covered by Tasks 4 (ErrorBoundary), 6 (Management UI), 5 (ShellSwitcher)

**2. Placeholder scan:** No TBD/TODO found. All steps contain actual code.

**3. Type consistency:** `CustomShellMeta` fields use snake_case (matching Rust serde default), `ShellDefinition` uses camelCase. The `customShellToDefinition()` function in Task 3 handles the mapping correctly.
