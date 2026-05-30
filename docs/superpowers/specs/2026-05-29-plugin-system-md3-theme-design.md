# Plugin System & MD3 Theme Design

**Date**: 2026-05-29
**Status**: Approved
**Sub-project**: A (Core Framework + Theme Plugin + MD3 Implementation)

## Overview

Design an extensible plugin system for BonNext that modularizes application features into independent plugins, with a theme plugin as the first concrete implementation and Material Design 3 as the first third-party theme.

## Key Decisions

| Decision        | Choice                                 | Rationale                                                              |
| --------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Plugin scope    | Frontend + Tauri IPC bridging          | Plugins run in React layer, access backend via existing Tauri commands |
| MD3 positioning | Parallel theme (replacement)           | MD3 completely replaces ZZZ visual style when active                   |
| Loading mode    | Hybrid (built-in + external directory) | Built-in plugins compiled in, external plugins loaded from directory   |
| Communication   | Service Registry                       | Type-safe, traceable inter-plugin communication                        |
| Architecture    | Layered (Core → Extension → Plugin)    | Best balance of flexibility and complexity for a mid-size desktop app  |

## Architecture: Layered Design

### Layer 1: Core Framework

```
PluginManager (singleton)
├── PluginRegistry    — plugin registration and state tracking
├── ServiceRegistry   — service provide/consume API
├── PluginLoader      — hybrid loading (built-in + external)
├── DependencyResolver — topological sort, circular detection
└── PluginContext      — runtime context for each plugin
```

### Layer 2: Extension Points

```
ExtensionPoint<T>
├── id: string
├── name: string
├── schema: T
├── onContribute(contribution: T): void
└── onRetract(contribution: T): void
```

First extension point: `bonnext:theme`

Future extension points: `bonnext:sidebar-item`, `bonnext:settings-section`, `bonnext:content-source`

### Layer 3: Plugins

```
Plugin
├── id: string
├── name: string
├── version: string
├── description?: string
├── dependencies?: PluginDependency[]
├── activate(context: PluginContext): Promise<void>
└── deactivate(): Promise<void>
```

## Plugin Interface Specification

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: PluginDependency[];
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

interface PluginDependency {
  id: string;
  version?: string;
}

interface PluginContext {
  pluginId: string;
  provideService(id: string, service: unknown): void;
  consumeService(id: string): unknown;
  registerExtensionPoint(point: ExtensionPoint): void;
  contributeExtension(pointId: string, contribution: unknown): void;
  storage: PluginStorage;
  logger: PluginLogger;
}

interface PluginStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

PluginStorage persists data via Tauri IPC to `{config_dir}/plugins/{pluginId}/storage.json`. Each plugin gets an isolated storage namespace.

interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

## Plugin Lifecycle

```
Registered → Activating → Active → Deactivating → Inactive
```

- **Activating**: Resolve dependencies → call `activate(context)` → register services → register extensions
- **Deactivating**: Retract extensions → revoke services → call `deactivate()` → release resources

State transitions are managed by PluginManager. Invalid transitions throw errors.

## Service Registry

```typescript
interface ServiceRegistry {
  provide(id: string, service: unknown, providerPluginId: string): void;
  consume(id: string): unknown;
  revoke(id: string, providerPluginId: string): void;
  isAvailable(id: string): boolean;
}
```

Services are identified by string IDs (e.g., `bonnext:theme`). When a plugin is deactivated, all services it provided are automatically revoked. The ThemeService is created by the ZZZ theme plugin during activation and registered as `bonnext:theme` service. Other plugins (like MD3) consume this service to contribute themes.

## Theme Extension Point

```typescript
interface ThemeContribution {
  id: string;
  name: string;
  cssVariables: Record<string, string>;
  componentOverrides?: ComponentStyleMap;
  fonts?: FontDefinition[];
  mode: 'light' | 'dark' | 'auto';
}

interface ComponentStyleMap {
  [componentName: string]: {
    cssModulePath: string;
  };
}

For built-in plugins, `cssModulePath` references CSS Module files compiled by Vite. For external plugins, styles are loaded from the plugin's `styles.css` file and applied via `html.theme-{id}` class selector overrides.

interface FontDefinition {
  family: string;
  src: string;
  weight?: number;
  style?: string;
}
```

## Theme Service

```typescript
interface ThemeService {
  getCurrentTheme(): ThemeInfo;
  getAvailableThemes(): ThemeInfo[];
  switchTheme(themeId: string, options?: SwitchOptions): Promise<void>;
  onThemeChange(callback: ThemeChangeCallback): Unsubscribe;

  addRule(rule: ThemeRule): void;
  removeRule(ruleId: string): void;
  getActiveRules(): ThemeRule[];
}

interface ThemeInfo {
  id: string;
  name: string;
  mode: 'light' | 'dark' | 'auto';
  pluginId: string;
}

interface SwitchOptions {
  animate?: boolean;
  seedColor?: string;
}

interface ThemeRule {
  id: string;
  name: string;
  priority: number;
  condition: RuleCondition;
  targetTheme: string;
  enabled: boolean;
}

type RuleCondition =
  | { type: 'time'; from: string; to: string }
  | { type: 'system'; preference: 'dark' | 'light' }
  | { type: 'instance'; instanceId: string }
  | { type: 'custom'; check: () => boolean };
```

## Theme Transition

The existing `.theme-transition` mechanism is preserved and enhanced:

1. Save current CSS variable snapshot
2. Inject `.theme-transition` class on `<html>`
3. Apply new theme CSS variable set
4. Browser auto-transitions (300ms) for color/bg/border/shadow properties
5. Remove transition class after 350ms
6. Notify all ThemeService listeners

Anti-flicker guarantees:

- Double-buffer: compute new variables first, apply atomically
- Transition only covers color properties, not layout
- Existing components continue using `useTheme()` with zero changes

## MD3 Theme Plugin

### Dynamic Color System

Based on HCT (Hue-Chroma-Tone) color space. From a seed color, generate 6 tonal palettes × 13 tones = 78 colors, then map to semantic roles. The HCT algorithm is implemented in `colorSystem.ts` following the Material Color Utilities specification (no external dependency — the algorithm is ~500 lines of pure TypeScript math).

```typescript
interface MD3ColorSystem {
  generateFromSeed(seedColor: string): MD3ThemeTokens;
  generateFromImage(imageData: ImageData): MD3ThemeTokens;
  getTokensForMode(tokens: MD3ThemeTokens, mode: 'light' | 'dark'): CSSVariableMap;
}

interface MD3ThemeTokens {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
}

type TonalPalette = Record<Tone, string>;
type Tone = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 | 99 | 100;
```

### Preset Seed Colors

| Name   | Seed Color    | Description  |
| ------ | ------------- | ------------ |
| Violet | `#6750A4`     | Default MD3  |
| Blue   | `#0061A4`     | Ocean blue   |
| Green  | `#006E17`     | Nature green |
| Red    | `#BA1A1A`     | Passion red  |
| Rose   | `#984061`     | Rose pink    |
| Amber  | `#7C5800`     | Amber orange |
| Custom | User-selected | Color picker |

### CSS Variable Mapping

MD3 theme maps to existing variable system so components work without modification:

```css
--bg-primary: var(--md3-surface);
--bg-secondary: var(--md3-surface-container);
--bg-card: var(--md3-surface-container-high);
--text-primary: var(--md3-on-surface);
--text-secondary: var(--md3-on-surface-variant);
--accent: var(--md3-primary);
--border: var(--md3-outline);
--danger: var(--md3-error);
--success: var(--md3-tertiary);
```

### Component Style Overrides

When MD3 theme is active, `html.theme-md3` class is added. MD3 CSS Modules override component defaults:

- **Button**: Rounded corners (20px), filled/outlined/text variants, MD3 elevation
- **TextInput**: Rounded corners (4px), filled outline variant, floating label
- **Card**: Rounded corners (12px), elevation shadow, surface-container background
- **Modal**: Rounded corners (28px), scrim overlay
- **Sidebar**: Navigation rail style, rounded active indicator
- **Tabs**: Underline indicator, no clip-path
- **Badge**: Rounded pill shape, MD3 colors
- **Toggle/Switch**: MD3 switch with thumb track

Override pattern: `html.theme-md3 .button { border-radius: 20px; clip-path: none; }`

### MD3 Plugin File Structure

```
src/plugins/builtins/md3-theme/
├── index.ts
├── MD3ThemePlugin.ts
├── colorSystem.ts
├── tokens/
│   ├── md3-dark.css
│   ├── md3-light.css
│   └── md3-shared.css
├── components/
│   ├── md3-button.module.css
│   ├── md3-input.module.css
│   ├── md3-card.module.css
│   ├── md3-modal.module.css
│   ├── md3-sidebar.module.css
│   ├── md3-tabs.module.css
│   └── ...
└── rules/
    └── systemPreference.ts
```

## Integration Strategy

### Provider Nesting Change

```
HashRouter
└── PluginProvider          ← NEW: initializes PluginManager
    └── ThemeProvider       ← REFACTORED: binds to ThemeService
        └── I18nProvider
            └── AuthProvider
                └── ConfigProvider
                    └── InstanceProvider
                        └── ToastProvider
                            └── DownloadProvider
                                └── AppShell
```

### ThemeProvider Refactoring

ThemeProvider becomes a React binding layer for ThemeService:

- Internally calls `ThemeService.getCurrentTheme()` for state
- `switchTheme()` delegates to `ThemeService.switchTheme()`
- `useTheme()` API unchanged — existing components require zero modification
- ThemeProvider subscribes to `ThemeService.onThemeChange()` for reactive updates

### ZZZ Theme Plugin

Existing dark/light/oled themes are wrapped as ZZZThemePlugin:

- Registers 3 ThemeContributions to `bonnext:theme` extension point
- Behavior identical to current implementation
- themes.css remains the source of truth for ZZZ CSS variables

## External Plugin Loading

### Directory Structure

```
{config_dir}/plugins/
├── plugin-manifest.json
├── my-custom-theme/
│   ├── manifest.json
│   ├── index.js
│   ├── styles.css
│   └── assets/
└── another-plugin/
    ├── manifest.json
    └── index.js
```

### manifest.json Schema

```json
{
  "id": "com.example.my-theme",
  "name": "My Custom Theme",
  "version": "1.0.0",
  "description": "...",
  "entry": "index.js",
  "dependencies": {
    "bonnext:theme": "^1.0.0"
  },
  "permissions": ["theme:read", "theme:write"],
  "minAppVersion": "0.0.3"
}
```

### Loading Flow

1. Scan plugin directory
2. Parse manifest.json
3. Validate permissions and version compatibility
4. `import()` dynamic load entry
5. Verify Plugin interface implementation
6. Register to PluginRegistry
7. Resolve dependencies, then activate

### Security Constraints

- External plugins must declare required permissions; undeclared operations are denied
- Plugins run in sandboxed context; cannot directly access DOM (must use ThemeService API)
- Plugins cannot modify services registered by other plugins
- Plugin load failure does not affect app startup (degrades to Inactive state)

## File Structure

```
src/
├── plugins/
│   ├── core/
│   │   ├── PluginManager.ts
│   │   ├── PluginRegistry.ts
│   │   ├── ServiceRegistry.ts
│   │   ├── PluginLoader.ts
│   │   ├── DependencyResolver.ts
│   │   ├── PluginContext.ts
│   │   ├── types.ts
│   │   └── PluginProvider.tsx
│   ├── extensions/
│   │   ├── ExtensionPoint.ts
│   │   └── ThemeExtensionPoint.ts
│   └── builtins/
│       ├── zzz-theme/
│       │   ├── index.ts
│       │   ├── ZZZThemePlugin.ts
│       │   └── contributions.ts
│       └── md3-theme/
│           ├── index.ts
│           ├── MD3ThemePlugin.ts
│           ├── colorSystem.ts
│           ├── tokens/
│           │   ├── md3-dark.css
│           │   ├── md3-light.css
│           │   └── md3-shared.css
│           ├── components/
│           │   ├── md3-button.module.css
│           │   ├── md3-input.module.css
│           │   ├── md3-card.module.css
│           │   └── ...
│           └── rules/
│               └── systemPreference.ts
├── stores/
│   ├── themeStore.tsx        ← REFACTORED: binds to ThemeService
│   └── ...
└── styles/
    ├── tokens.css             ← UNCHANGED
    ├── themes.css             ← UNCHANGED
    └── ...
```

## Non-Goals

- Rust-side plugin system (plugins are frontend-only)
- Hot-reloading of plugins during development
- Plugin marketplace or auto-update mechanism
- MD3 components as separate React components (only CSS overrides)
- Replacing the ZZZ aesthetic as default theme
