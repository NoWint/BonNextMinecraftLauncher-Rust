# Custom Shell Import — Design Spec

**Date**: 2026-06-06
**Status**: Approved
**Author**: Brainstorming session

## Overview

Allow users to write custom Shell UIs (full React components calling BonNext's Tauri API) and import them into the launcher. Custom shells appear alongside built-in shells (zzz, swiftui) in the ShellSwitcher and can be freely switched.

## 1. Theme Package Specification

### 1.1 Directory Structure

Custom shells live in `{data_dir}/shells/{shell-id}/`:

```
~/.local/share/bonnext/shells/my-custom-shell/
├── manifest.json          # Metadata (required)
├── shell.js               # Bundled React component (required)
├── shell.css              # Styles (optional)
└── assets/                # Images and resources (optional)
    ├── icon.svg
    └── bg.png
```

### 1.2 manifest.json Schema

```json
{
  "id": "my-custom-shell",
  "name": "My Custom Shell",
  "version": "1.0.0",
  "description": "A custom shell for BonNext",
  "author": "username",
  "icon": "assets/icon.svg",
  "entry": "shell.js",
  "style": "shell.css",
  "preview": "assets/preview.png",
  "minAppVersion": "0.1.0",
  "supportedThemes": ["dark", "light"],
  "supportedRoutes": ["/home", "/instances", "/settings"],
  "permissions": ["versions", "instances", "launch", "config"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier, must match directory name, alphanumeric + hyphens |
| `name` | Yes | Display name |
| `version` | Yes | Semver version string |
| `description` | No | Short description |
| `author` | No | Author name |
| `icon` | No | Relative path to icon (SVG/PNG) |
| `entry` | Yes | Relative path to JS bundle entry |
| `style` | No | Relative path to CSS file |
| `preview` | No | Relative path to preview screenshot |
| `minAppVersion` | No | Minimum compatible BonNext version |
| `supportedThemes` | Yes | Array of supported theme modes |
| `supportedRoutes` | Yes | Array of supported route paths |
| `permissions` | No | API categories the shell intends to use (reserved, not enforced in v1) |

### 1.3 Shell Component Contract

The JS bundle's default export must be a React component accepting `ShellProps`:

```typescript
interface ShellProps {
  api: typeof import('@/api').api;
  stores: {
    useAuth: typeof useAuth;
    useConfig: typeof useConfig;
    useInstance: typeof useInstance;
    useTheme: typeof useTheme;
    useToast: typeof useToast;
    useDownload: typeof useDownload;
  };
  currentRoute: string;
  onNavigate: (route: string) => void;
}
```

## 2. Loading & Registration

### 2.1 Backend Commands (Rust)

New Tauri commands in `commands/shell.rs`:

| Command | Signature | Description |
|---------|-----------|-------------|
| `scan_custom_shells` | `() -> Vec<CustomShellMeta>` | Scan `{data_dir}/shells/`, parse each `manifest.json` |
| `import_custom_shell` | `(path: String) -> CustomShellMeta` | Copy folder/zip to `{data_dir}/shells/{id}/` |
| `remove_custom_shell` | `(id: String) -> ()` | Delete custom shell directory |
| `get_custom_shell_entry` | `(id: String) -> String` | Return absolute path to `shell.js` for frontend loading |

`CustomShellMeta` mirrors the manifest.json fields plus a `path` field for the local directory.

### 2.2 Frontend Loading Flow

```
1. App startup → invoke scan_custom_shells()
2. For each custom shell, register into shell-registry Map:
   - id: manifest.id
   - name: manifest.name
   - loader: () => dynamicImport(shellJsUrl)
   - supportedRoutes: manifest.supportedRoutes
   - supportedThemes: manifest.supportedThemes
3. ShellSwitcher dropdown shows all registered shells (built-in + custom)
4. User selects custom shell → shellStore switches → React.lazy renders
```

### 2.3 Dynamic Import of Local Files

Use Tauri v2's `convertFileSrc()` to convert local file paths to asset protocol URLs, then load via `import()`:

```typescript
const shellJsPath = await api.getCustomShellEntry(shellId);
const shellUrl = convertFileSrc(shellJsPath);
const module = await import(/* @vite-ignore */ shellUrl);
```

### 2.4 CSS Injection

- On shell activation: create `<link rel="stylesheet" href={convertFileSrc(cssPath)}>` with `data-shell-id` attribute
- On shell deactivation: remove the `<link>` element matching the previous shell's ID
- Built-in shells continue using CSS Modules as before

## 3. Shell SDK & Developer Experience

### 3.1 defineShell() API

```typescript
import { defineShell, api, useAuth, useConfig } from '@bonnext/shell-sdk';

export default defineShell({
  id: 'my-shell',
  name: 'My Shell',
  supportedRoutes: ['/home', '/instances'],
  supportedThemes: ['dark', 'light'],

  render({ api, stores, currentRoute, onNavigate }) {
    return <MyShellLayout api={api} stores={stores} currentRoute={currentRoute} onNavigate={onNavigate} />;
  }
});
```

`defineShell()` provides full TypeScript type safety for the shell definition and ShellProps.

### 3.2 SDK Package Contents

- `defineShell()` — type-safe shell definition helper
- Re-exports of `api`, all store hooks, common types
- Type definitions for manifest.json (via JSON schema)

### 3.3 Development Template

A `create-bonnext-shell` scaffold providing:
- Vite config with `rollupOptions.external` for `react`, `react-dom`, `@bonnext/shell-sdk`
- TypeScript config
- Example shell component with basic layout
- HMR dev mode that connects to a running BonNext instance

### 3.4 Build Configuration

Users build with Vite, externalizing dependencies provided by the host:

```js
// vite.config.ts
export default defineConfig({
  build: {
    lib: { entry: 'src/index.tsx', formats: ['es'] },
    rollupOptions: {
      external: ['react', 'react-dom', '@bonnext/shell-sdk'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM' } }
    }
  }
});
```

At runtime, BonNext provides React and SDK globals via import maps or window globals.

## 4. Import UI & Error Handling

### 4.1 Shell Management UI

New section in Settings page (or dedicated page):

1. **Installed shells list** — shows built-in + custom shells with name, author, version, enable/disable toggle
2. **Import button** — opens Tauri file dialog, supports:
   - `.zip` archive (auto-extract to shells directory)
   - Folder (copy to shells directory)
3. **Delete button** — removes custom shell (built-in shells cannot be deleted)
4. **Shell preview** — optional preview image from manifest `preview` field

### 4.2 Error Handling

| Scenario | Handling |
|----------|----------|
| Missing or malformed manifest.json | Skip during scan, toast notification |
| shell.js load failure (syntax error) | Fallback to default shell, toast with error message |
| Shell component render crash | ErrorBoundary catches, shows error panel + "Switch to default" button |
| minAppVersion incompatible | Reject load, prompt user to update BonNext or use compatible version |
| Duplicate ID | Reject import, notify ID conflict |
| Shell doesn't support current route | Fallback to default shell for that route |

### 4.3 Fallback Mechanism

When a custom shell fails:
1. Shell component wrapped in ErrorBoundary
2. On error, shellStore auto-switches to `zzz` (default)
3. Toast notification: "Custom shell failed to load, switched to default shell"

## 5. Future Considerations (Out of Scope for v1)

- **Online marketplace**: Browse and one-click install community shells (similar to Modrinth/CurseForge)
- **Visual shell editor**: Drag-and-drop shell builder generating shell packages
- **Permission enforcement**: Restrict custom shells to declared API categories
- **Shell signing**: Verify shell package integrity and author identity
- **Shell versioning**: Auto-update checking for installed shells
