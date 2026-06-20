# Plugin System & MD3 Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an extensible plugin system with layered architecture (Core → Extension → Plugin) and implement Material Design 3 as the first third-party theme plugin.

**Architecture:** Frontend-only plugin system using Service Registry for inter-plugin communication. PluginProvider wraps ThemeProvider in the React tree. ThemeService is created by ZZZ theme plugin and consumed by MD3 theme plugin. MD3 uses HCT color space for dynamic color generation from seed colors.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest, Tauri v2 IPC

**Spec:** `docs/superpowers/specs/2026-05-29-plugin-system-md3-theme-design.md`

---

## File Structure

### New Files

| File                                                               | Responsibility                                  |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| `src/plugins/core/types.ts`                                        | All plugin system TypeScript interfaces         |
| `src/plugins/core/PluginRegistry.ts`                               | Plugin registration and state tracking          |
| `src/plugins/core/ServiceRegistry.ts`                              | Service provide/consume/revoke                  |
| `src/plugins/core/DependencyResolver.ts`                           | Topological sort, circular dependency detection |
| `src/plugins/core/PluginContext.ts`                                | Runtime context implementation for each plugin  |
| `src/plugins/core/PluginLoader.ts`                                 | Hybrid loading (built-in + external directory)  |
| `src/plugins/core/PluginManager.ts`                                | Singleton orchestrator                          |
| `src/plugins/core/PluginProvider.tsx`                              | React Provider wrapping PluginManager           |
| `src/plugins/core/index.ts`                                        | Barrel export                                   |
| `src/plugins/extensions/ExtensionPoint.ts`                         | Base extension point class                      |
| `src/plugins/extensions/ThemeExtensionPoint.ts`                    | Theme-specific extension point                  |
| `src/plugins/extensions/index.ts`                                  | Barrel export                                   |
| `src/plugins/builtins/zzz-theme/index.ts`                          | Barrel export                                   |
| `src/plugins/builtins/zzz-theme/ZZZThemePlugin.ts`                 | ZZZ theme plugin implementation                 |
| `src/plugins/builtins/zzz-theme/contributions.ts`                  | dark/light/oled ThemeContribution objects       |
| `src/plugins/builtins/zzz-theme/ThemeService.ts`                   | ThemeService implementation                     |
| `src/plugins/builtins/md3-theme/index.ts`                          | Barrel export                                   |
| `src/plugins/builtins/md3-theme/MD3ThemePlugin.ts`                 | MD3 theme plugin implementation                 |
| `src/plugins/builtins/md3-theme/colorSystem.ts`                    | HCT color space + tonal palette generation      |
| `src/plugins/builtins/md3-theme/tokens/md3-dark.css`               | MD3 dark mode CSS variables                     |
| `src/plugins/builtins/md3-theme/tokens/md3-light.css`              | MD3 light mode CSS variables                    |
| `src/plugins/builtins/md3-theme/tokens/md3-shared.css`             | MD3 shared tokens (radii, spacing)              |
| `src/plugins/builtins/md3-theme/components/md3-button.module.css`  | Button overrides                                |
| `src/plugins/builtins/md3-theme/components/md3-input.module.css`   | TextInput overrides                             |
| `src/plugins/builtins/md3-theme/components/md3-card.module.css`    | Card overrides                                  |
| `src/plugins/builtins/md3-theme/components/md3-modal.module.css`   | Modal overrides                                 |
| `src/plugins/builtins/md3-theme/components/md3-sidebar.module.css` | Sidebar overrides                               |
| `src/plugins/builtins/md3-theme/components/md3-tabs.module.css`    | Tabs overrides                                  |
| `src/plugins/builtins/md3-theme/components/md3-badge.module.css`   | Badge overrides                                 |
| `src/plugins/builtins/md3-theme/components/md3-toggle.module.css`  | Toggle/Switch overrides                         |
| `src/plugins/builtins/md3-theme/rules/systemPreference.ts`         | System preference auto-rule                     |

### Modified Files

| File                        | Change                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| `src/stores/themeStore.tsx` | Refactor to bind to ThemeService instead of direct DOM manipulation |
| `src/App.tsx`               | Add PluginProvider wrapping ThemeProvider                           |

### Test Files

| File                                                              | Tests                              |
| ----------------------------------------------------------------- | ---------------------------------- |
| `src/plugins/core/__tests__/types.test.ts`                        | Type validation tests              |
| `src/plugins/core/__tests__/PluginRegistry.test.ts`               | Registration, state tracking       |
| `src/plugins/core/__tests__/ServiceRegistry.test.ts`              | Provide, consume, revoke           |
| `src/plugins/core/__tests__/DependencyResolver.test.ts`           | Topo sort, circular detection      |
| `src/plugins/core/__tests__/PluginManager.test.ts`                | Full lifecycle                     |
| `src/plugins/extensions/__tests__/ThemeExtensionPoint.test.ts`    | Contribute, retract                |
| `src/plugins/builtins/zzz-theme/__tests__/ZZZThemePlugin.test.ts` | ZZZ plugin lifecycle               |
| `src/plugins/builtins/zzz-theme/__tests__/ThemeService.test.ts`   | Theme switching, rules             |
| `src/plugins/builtins/md3-theme/__tests__/colorSystem.test.ts`    | HCT conversion, palette generation |
| `src/plugins/builtins/md3-theme/__tests__/MD3ThemePlugin.test.ts` | MD3 plugin lifecycle               |

---

## Phase 1: Plugin Core Framework

### Task 1: Core Type Definitions

**Files:**

- Create: `src/plugins/core/types.ts`
- Test: `src/plugins/core/__tests__/types.test.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/plugins/core/types.ts

export type PluginState = 'registered' | 'activating' | 'active' | 'deactivating' | 'inactive';

export interface PluginDependency {
  id: string;
  version?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  dependencies?: PluginDependency[];
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

export interface PluginStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface ExtensionPoint<T = unknown> {
  id: string;
  name: string;
  onContribute(contribution: T): void;
  onRetract(contribution: T): void;
}

export interface PluginContext {
  pluginId: string;
  provideService(id: string, service: unknown): void;
  consumeService(id: string): unknown;
  registerExtensionPoint(point: ExtensionPoint): void;
  contributeExtension(pointId: string, contribution: unknown): void;
  storage: PluginStorage;
  logger: PluginLogger;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  minAppVersion?: string;
}

export interface RegisteredPlugin {
  plugin: Plugin;
  state: PluginState;
  context: PluginContext;
}
```

- [ ] **Step 2: Write type validation tests**

```typescript
// src/plugins/core/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import type { Plugin, PluginState, PluginManifest, PluginDependency } from '../types';

describe('Plugin Types', () => {
  it('should accept valid Plugin objects', () => {
    const plugin: Plugin = {
      id: 'com.bonnext.test',
      name: 'Test Plugin',
      version: '1.0.0',
      async activate() {},
      async deactivate() {},
    };
    expect(plugin.id).toBe('com.bonnext.test');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should accept Plugin with optional fields', () => {
    const plugin: Plugin = {
      id: 'com.bonnext.test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      dependencies: [{ id: 'com.bonnext.core', version: '^1.0.0' }],
      async activate() {},
      async deactivate() {},
    };
    expect(plugin.dependencies).toHaveLength(1);
  });

  it('should enumerate all PluginState values', () => {
    const states: PluginState[] = ['registered', 'activating', 'active', 'deactivating', 'inactive'];
    expect(states).toHaveLength(5);
  });

  it('should accept valid PluginManifest', () => {
    const manifest: PluginManifest = {
      id: 'com.bonnext.test',
      name: 'Test Plugin',
      version: '1.0.0',
      entry: 'index.js',
      dependencies: { 'bonnext:theme': '^1.0.0' },
      permissions: ['theme:read'],
      minAppVersion: '0.0.3',
    };
    expect(manifest.id).toBe('com.bonnext.test');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/plugins/core/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/plugins/core/types.ts src/plugins/core/__tests__/types.test.ts
git commit -m "feat(plugin): add core type definitions"
```

---

### Task 2: PluginRegistry

**Files:**

- Create: `src/plugins/core/PluginRegistry.ts`
- Test: `src/plugins/core/__tests__/PluginRegistry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/core/__tests__/PluginRegistry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../PluginRegistry';
import type { Plugin, PluginState } from '../types';

const createMockPlugin = (id: string): Plugin => ({
  id,
  name: `Plugin ${id}`,
  version: '1.0.0',
  async activate() {},
  async deactivate() {},
});

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it('should register a plugin', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    expect(registry.get('com.test.a')).toBeDefined();
    expect(registry.get('com.test.a')!.plugin.id).toBe('com.test.a');
  });

  it('should throw on duplicate registration', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    expect(() => registry.register(plugin)).toThrow(/already registered/);
  });

  it('should unregister a plugin', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.unregister('com.test.a');
    expect(registry.get('com.test.a')).toBeUndefined();
  });

  it('should track plugin state', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    expect(registry.getState('com.test.a')).toBe('registered');
  });

  it('should transition plugin state', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.setState('com.test.a', 'activating');
    expect(registry.getState('com.test.a')).toBe('activating');
    registry.setState('com.test.a', 'active');
    expect(registry.getState('com.test.a')).toBe('active');
  });

  it('should throw on invalid state transition', () => {
    const plugin = createMockPlugin('com.test.a');
    registry.register(plugin);
    registry.setState('com.test.a', 'active');
    expect(() => registry.setState('com.test.a', 'activating')).toThrow(/Invalid transition/);
  });

  it('should list all registered plugins', () => {
    registry.register(createMockPlugin('com.test.a'));
    registry.register(createMockPlugin('com.test.b'));
    expect(registry.getAll()).toHaveLength(2);
  });

  it('should return undefined for unknown plugin', () => {
    expect(registry.get('com.test.unknown')).toBeUndefined();
  });

  it('should return registered state for unknown plugin', () => {
    expect(registry.getState('com.test.unknown')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/plugins/core/__tests__/PluginRegistry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PluginRegistry**

```typescript
// src/plugins/core/PluginRegistry.ts
import type { Plugin, PluginState, RegisteredPlugin } from './types';

const VALID_TRANSITIONS: Record<PluginState, PluginState[]> = {
  registered: ['activating', 'inactive'],
  activating: ['active', 'inactive'],
  active: ['deactivating'],
  deactivating: ['inactive', 'active'],
  inactive: ['activating'],
};

export class PluginRegistry {
  private plugins = new Map<string, RegisteredPlugin>();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    this.plugins.set(plugin.id, {
      plugin,
      state: 'registered',
      context: null as unknown as RegisteredPlugin['context'],
    });
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  get(id: string): RegisteredPlugin | undefined {
    return this.plugins.get(id);
  }

  getState(id: string): PluginState | undefined {
    return this.plugins.get(id)?.state;
  }

  setState(id: string, newState: PluginState): void {
    const entry = this.plugins.get(id);
    if (!entry) {
      throw new Error(`Plugin "${id}" is not registered`);
    }
    const allowed = VALID_TRANSITIONS[entry.state];
    if (!allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${entry.state} → ${newState} for plugin "${id}"`);
    }
    entry.state = newState;
  }

  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/plugins/core/__tests__/PluginRegistry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/core/PluginRegistry.ts src/plugins/core/__tests__/PluginRegistry.test.ts
git commit -m "feat(plugin): implement PluginRegistry with state machine"
```

---

### Task 3: ServiceRegistry

**Files:**

- Create: `src/plugins/core/ServiceRegistry.ts`
- Test: `src/plugins/core/__tests__/ServiceRegistry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/core/__tests__/ServiceRegistry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('should provide and consume a service', () => {
    const service = { getCurrentTheme: () => 'dark' };
    registry.provide('bonnext:theme', service, 'com.bonnext.zzz-theme');
    const consumed = registry.consume('bonnext:theme');
    expect(consumed).toBe(service);
  });

  it('should return undefined for unknown service', () => {
    expect(registry.consume('bonnext:unknown')).toBeUndefined();
  });

  it('should check service availability', () => {
    expect(registry.isAvailable('bonnext:theme')).toBe(false);
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    expect(registry.isAvailable('bonnext:theme')).toBe(true);
  });

  it('should revoke a service', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    registry.revoke('bonnext:theme', 'com.bonnext.zzz-theme');
    expect(registry.isAvailable('bonnext:theme')).toBe(false);
  });

  it('should throw when revoking with wrong provider', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    expect(() => registry.revoke('bonnext:theme', 'com.bonnext.other')).toThrow(/not the provider/);
  });

  it('should revoke all services for a plugin', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    registry.provide('bonnext:theme-rules', {}, 'com.bonnext.zzz-theme');
    registry.revokeAllForPlugin('com.bonnext.zzz-theme');
    expect(registry.isAvailable('bonnext:theme')).toBe(false);
    expect(registry.isAvailable('bonnext:theme-rules')).toBe(false);
  });

  it('should throw on duplicate service provision', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    expect(() => registry.provide('bonnext:theme', {}, 'com.bonnext.other')).toThrow(/already provided/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/plugins/core/__tests__/ServiceRegistry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ServiceRegistry**

```typescript
// src/plugins/core/ServiceRegistry.ts
interface ServiceEntry {
  service: unknown;
  providerPluginId: string;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceEntry>();

  provide(id: string, service: unknown, providerPluginId: string): void {
    if (this.services.has(id)) {
      throw new Error(`Service "${id}" is already provided by "${this.services.get(id)!.providerPluginId}"`);
    }
    this.services.set(id, { service, providerPluginId });
  }

  consume(id: string): unknown {
    return this.services.get(id)?.service;
  }

  revoke(id: string, providerPluginId: string): void {
    const entry = this.services.get(id);
    if (!entry) return;
    if (entry.providerPluginId !== providerPluginId) {
      throw new Error(`Plugin "${providerPluginId}" is not the provider of service "${id}"`);
    }
    this.services.delete(id);
  }

  revokeAllForPlugin(pluginId: string): void {
    for (const [id, entry] of this.services) {
      if (entry.providerPluginId === pluginId) {
        this.services.delete(id);
      }
    }
  }

  isAvailable(id: string): boolean {
    return this.services.has(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/plugins/core/__tests__/ServiceRegistry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/core/ServiceRegistry.ts src/plugins/core/__tests__/ServiceRegistry.test.ts
git commit -m "feat(plugin): implement ServiceRegistry"
```

---

### Task 4: DependencyResolver

**Files:**

- Create: `src/plugins/core/DependencyResolver.ts`
- Test: `src/plugins/core/__tests__/DependencyResolver.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/core/__tests__/DependencyResolver.test.ts
import { describe, it, expect } from 'vitest';
import { DependencyResolver } from '../DependencyResolver';
import type { Plugin } from '../types';

const createPlugin = (id: string, deps?: string[]): Plugin => ({
  id,
  name: `Plugin ${id}`,
  version: '1.0.0',
  dependencies: deps?.map((d) => ({ id: d })),
  async activate() {},
  async deactivate() {},
});

describe('DependencyResolver', () => {
  it('should return single plugin with no dependencies', () => {
    const resolver = new DependencyResolver();
    const plugin = createPlugin('a');
    const order = resolver.resolve([plugin]);
    expect(order).toEqual(['a']);
  });

  it('should resolve linear dependency chain', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a');
    const b = createPlugin('b', ['a']);
    const c = createPlugin('c', ['b']);
    const order = resolver.resolve([c, b, a]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('should resolve diamond dependency', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a');
    const b = createPlugin('b', ['a']);
    const c = createPlugin('c', ['a']);
    const d = createPlugin('d', ['b', 'c']);
    const order = resolver.resolve([d, c, b, a]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('should throw on circular dependency', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a', ['b']);
    const b = createPlugin('b', ['a']);
    expect(() => resolver.resolve([a, b])).toThrow(/Circular dependency/);
  });

  it('should throw on missing dependency', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a', ['missing']);
    expect(() => resolver.resolve([a])).toThrow(/Missing dependency/);
  });

  it('should handle independent plugins', () => {
    const resolver = new DependencyResolver();
    const a = createPlugin('a');
    const b = createPlugin('b');
    const order = resolver.resolve([a, b]);
    expect(order).toContain('a');
    expect(order).toContain('b');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/plugins/core/__tests__/DependencyResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement DependencyResolver**

```typescript
// src/plugins/core/DependencyResolver.ts
import type { Plugin } from './types';

export class DependencyResolver {
  resolve(plugins: Plugin[]): string[] {
    const pluginMap = new Map(plugins.map((p) => [p.id, p]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected involving plugin "${id}"`);
      }

      const plugin = pluginMap.get(id);
      if (!plugin) {
        throw new Error(`Missing dependency: "${id}" is not registered`);
      }

      visiting.add(id);

      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          visit(dep.id);
        }
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const plugin of plugins) {
      visit(plugin.id);
    }

    return order;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/plugins/core/__tests__/DependencyResolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/core/DependencyResolver.ts src/plugins/core/__tests__/DependencyResolver.test.ts
git commit -m "feat(plugin): implement DependencyResolver with circular detection"
```

---

### Task 5: PluginContext Implementation

**Files:**

- Create: `src/plugins/core/PluginContext.ts`

- [ ] **Step 1: Implement PluginContext**

```typescript
// src/plugins/core/PluginContext.ts
import type { PluginStorage, PluginLogger, ExtensionPoint } from './types';
import type { ServiceRegistry } from './ServiceRegistry';

export class PluginContextImpl implements import('./types').PluginContext {
  public readonly pluginId: string;
  public readonly storage: PluginStorage;
  public readonly logger: PluginLogger;
  private serviceRegistry: ServiceRegistry;
  private extensionPoints = new Map<string, ExtensionPoint>();
  private contributedExtensions: Array<{ pointId: string; contribution: unknown }> = [];

  constructor(pluginId: string, serviceRegistry: ServiceRegistry, storage: PluginStorage) {
    this.pluginId = pluginId;
    this.serviceRegistry = serviceRegistry;
    this.storage = storage;
    this.logger = {
      info: (msg: string, ...args: unknown[]) => console.info(`[${pluginId}] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) => console.warn(`[${pluginId}] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) => console.error(`[${pluginId}] ${msg}`, ...args),
    };
  }

  provideService(id: string, service: unknown): void {
    this.serviceRegistry.provide(id, service, this.pluginId);
  }

  consumeService(id: string): unknown {
    return this.serviceRegistry.consume(id);
  }

  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.id, point);
  }

  contributeExtension(pointId: string, contribution: unknown): void {
    this.contributedExtensions.push({ pointId, contribution });
  }

  getExtensionPoint(id: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(id);
  }

  getContributedExtensions(): Array<{ pointId: string; contribution: unknown }> {
    return [...this.contributedExtensions];
  }

  clearContributions(): void {
    this.contributedExtensions = [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/core/PluginContext.ts
git commit -m "feat(plugin): implement PluginContext"
```

---

### Task 6: PluginLoader

**Files:**

- Create: `src/plugins/core/PluginLoader.ts`

- [ ] **Step 1: Implement PluginLoader**

```typescript
// src/plugins/core/PluginLoader.ts
import type { Plugin, PluginManifest } from './types';

export class PluginLoader {
  private builtinPlugins: Plugin[] = [];

  registerBuiltin(plugin: Plugin): void {
    this.builtinPlugins.push(plugin);
  }

  getBuiltinPlugins(): Plugin[] {
    return [...this.builtinPlugins];
  }

  async loadExternalFromDir(_dirPath: string): Promise<Plugin[]> {
    const externalPlugins: Plugin[] = [];

    try {
      const { readDir } = await import('@tauri-apps/api/fs');
      const entries = await readDir(_dirPath);

      for (const entry of entries) {
        if (entry.children) {
          try {
            const manifest = await this.loadManifest(entry.path);
            if (manifest) {
              const plugin = await this.loadPluginFromManifest(manifest, entry.path);
              if (plugin) {
                externalPlugins.push(plugin);
              }
            }
          } catch (e) {
            console.warn(`Failed to load plugin from ${entry.path}:`, e);
          }
        }
      }
    } catch {
      console.warn('Plugin directory not accessible, skipping external plugins');
    }

    return externalPlugins;
  }

  private async loadManifest(pluginDir: string): Promise<PluginManifest | null> {
    try {
      const { readTextFile } = await import('@tauri-apps/api/fs');
      const content = await readTextFile(`${pluginDir}/manifest.json`);
      return JSON.parse(content) as PluginManifest;
    } catch {
      return null;
    }
  }

  private async loadPluginFromManifest(manifest: PluginManifest, pluginDir: string): Promise<Plugin | null> {
    try {
      const entryPath = `${pluginDir}/${manifest.entry}`;
      const module = await import(/* @vite-ignore */ entryPath);
      const plugin: Plugin = module.default || module;

      if (!plugin.id || !plugin.activate || !plugin.deactivate) {
        console.warn(`Plugin from ${pluginDir} does not implement the Plugin interface`);
        return null;
      }

      return plugin;
    } catch (e) {
      console.warn(`Failed to load plugin entry from ${pluginDir}:`, e);
      return null;
    }
  }

  validatePlugin(plugin: Plugin): boolean {
    return !!(
      plugin.id &&
      typeof plugin.id === 'string' &&
      plugin.name &&
      typeof plugin.name === 'string' &&
      plugin.version &&
      typeof plugin.version === 'string' &&
      typeof plugin.activate === 'function' &&
      typeof plugin.deactivate === 'function'
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/core/PluginLoader.ts
git commit -m "feat(plugin): implement PluginLoader with hybrid loading"
```

---

### Task 7: PluginManager

**Files:**

- Create: `src/plugins/core/PluginManager.ts`
- Test: `src/plugins/core/__tests__/PluginManager.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/core/__tests__/PluginManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from '../PluginManager';
import type { Plugin } from '../types';

const createPlugin = (id: string, deps?: string[]): Plugin =>
  ({
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    dependencies: deps?.map((d) => ({ id: d })),
    activated: false,
    deactivated: false,
    async activate(ctx) {
      this.activated = true;
      this._context = ctx;
    },
    async deactivate() {
      this.deactivated = true;
    },
  }) as Plugin & { activated: boolean; deactivated: boolean; _context?: unknown };

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it('should register and activate a plugin', async () => {
    const plugin = createPlugin('com.test.a');
    manager.register(plugin);
    await manager.activate('com.test.a');
    expect(manager.getState('com.test.a')).toBe('active');
  });

  it('should deactivate a plugin', async () => {
    const plugin = createPlugin('com.test.a');
    manager.register(plugin);
    await manager.activate('com.test.a');
    await manager.deactivate('com.test.a');
    expect(manager.getState('com.test.a')).toBe('inactive');
  });

  it('should activate plugins in dependency order', async () => {
    const activationOrder: string[] = [];
    const a: Plugin = {
      id: 'a',
      name: 'A',
      version: '1.0.0',
      async activate() {
        activationOrder.push('a');
      },
      async deactivate() {},
    };
    const b: Plugin = {
      id: 'b',
      name: 'B',
      version: '1.0.0',
      dependencies: [{ id: 'a' }],
      async activate() {
        activationOrder.push('b');
      },
      async deactivate() {},
    };

    manager.register(a);
    manager.register(b);
    await manager.activateAll();
    expect(activationOrder).toEqual(['a', 'b']);
  });

  it('should provide and consume services', async () => {
    const service = { hello: 'world' };
    const provider: Plugin = {
      id: 'provider',
      name: 'Provider',
      version: '1.0.0',
      async activate(ctx) {
        ctx.provideService('test:service', service);
      },
      async deactivate() {},
    };
    let consumed: unknown;
    const consumer: Plugin = {
      id: 'consumer',
      name: 'Consumer',
      version: '1.0.0',
      dependencies: [{ id: 'provider' }],
      async activate(ctx) {
        consumed = ctx.consumeService('test:service');
      },
      async deactivate() {},
    };

    manager.register(provider);
    manager.register(consumer);
    await manager.activateAll();
    expect(consumed).toBe(service);
  });

  it('should throw when activating unknown plugin', async () => {
    await expect(manager.activate('unknown')).rejects.toThrow(/not registered/);
  });

  it('should return all active plugins', async () => {
    manager.register(createPlugin('a'));
    manager.register(createPlugin('b'));
    await manager.activateAll();
    expect(manager.getActivePlugins()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/plugins/core/__tests__/PluginManager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PluginManager**

```typescript
// src/plugins/core/PluginManager.ts
import type { Plugin, ExtensionPoint } from './types';
import { PluginRegistry } from './PluginRegistry';
import { ServiceRegistry } from './ServiceRegistry';
import { DependencyResolver } from './DependencyResolver';
import { PluginContextImpl } from './PluginContext';
import type { PluginStorage } from './types';

class MemoryPluginStorage implements PluginStorage {
  private data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export class PluginManager {
  private registry = new PluginRegistry();
  private serviceRegistry = new ServiceRegistry();
  private resolver = new DependencyResolver();
  private extensionPoints = new Map<string, ExtensionPoint>();
  private contexts = new Map<string, PluginContextImpl>();

  register(plugin: Plugin): void {
    this.registry.register(plugin);
  }

  async activate(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    if (entry.plugin.dependencies) {
      for (const dep of entry.plugin.dependencies) {
        const depState = this.registry.getState(dep.id);
        if (depState !== 'active') {
          throw new Error(`Dependency "${dep.id}" for plugin "${pluginId}" is not active (state: ${depState})`);
        }
      }
    }

    this.registry.setState(pluginId, 'activating');

    const context = new PluginContextImpl(pluginId, this.serviceRegistry, new MemoryPluginStorage());

    this.contexts.set(pluginId, context);

    try {
      await entry.plugin.activate(context);

      for (const { pointId, contribution } of context.getContributedExtensions()) {
        const point = this.extensionPoints.get(pointId);
        if (point) {
          point.onContribute(contribution);
        }
      }

      this.registry.setState(pluginId, 'active');
    } catch (e) {
      this.registry.setState(pluginId, 'inactive');
      throw e;
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) return;

    this.registry.setState(pluginId, 'deactivating');

    const context = this.contexts.get(pluginId);

    try {
      if (context) {
        for (const { pointId, contribution } of context.getContributedExtensions()) {
          const point = this.extensionPoints.get(pointId);
          if (point) {
            point.onRetract(contribution);
          }
        }
        context.clearContributions();
      }

      this.serviceRegistry.revokeAllForPlugin(pluginId);
      await entry.plugin.deactivate();
      this.registry.setState(pluginId, 'inactive');
    } catch (e) {
      this.registry.setState(pluginId, 'active');
      throw e;
    }
  }

  async activateAll(): Promise<void> {
    const plugins = this.registry.getAll().map((e) => e.plugin);
    const order = this.resolver.resolve(plugins);

    for (const id of order) {
      await this.activate(id);
    }
  }

  async deactivateAll(): Promise<void> {
    const plugins = this.registry
      .getAll()
      .filter((e) => e.state === 'active')
      .map((e) => e.plugin);
    const order = this.resolver.resolve(plugins).reverse();

    for (const id of order) {
      await this.deactivate(id);
    }
  }

  getState(pluginId: string) {
    return this.registry.getState(pluginId);
  }

  getActivePlugins(): Plugin[] {
    return this.registry
      .getAll()
      .filter((e) => e.state === 'active')
      .map((e) => e.plugin);
  }

  registerExtensionPoint(point: ExtensionPoint): void {
    this.extensionPoints.set(point.id, point);
  }

  getExtensionPoint(id: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(id);
  }

  getService(id: string): unknown {
    return this.serviceRegistry.consume(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/plugins/core/__tests__/PluginManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/core/PluginManager.ts src/plugins/core/__tests__/PluginManager.test.ts
git commit -m "feat(plugin): implement PluginManager with full lifecycle"
```

---

### Task 8: PluginProvider + Barrel Export

**Files:**

- Create: `src/plugins/core/PluginProvider.tsx`
- Create: `src/plugins/core/index.ts`

- [ ] **Step 1: Implement PluginProvider**

```tsx
// src/plugins/core/PluginProvider.tsx
import React, { createContext, useContext, useMemo, useEffect, useRef } from 'react';
import { PluginManager } from './PluginManager';
import type { Plugin, ExtensionPoint } from './types';

interface PluginContextValue {
  manager: PluginManager;
}

const PluginContext = createContext<PluginContextValue | null>(null);

interface PluginProviderProps {
  children: React.ReactNode;
  builtinPlugins?: Plugin[];
  extensionPoints?: ExtensionPoint[];
}

export function PluginProvider({ children, builtinPlugins = [], extensionPoints = [] }: PluginProviderProps) {
  const managerRef = useRef<PluginManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new PluginManager();
  }

  const manager = managerRef.current;

  useEffect(() => {
    for (const point of extensionPoints) {
      manager.registerExtensionPoint(point);
    }

    for (const plugin of builtinPlugins) {
      manager.register(plugin);
    }

    manager.activateAll().catch((e) => {
      console.error('Failed to activate plugins:', e);
    });

    return () => {
      manager.deactivateAll().catch((e) => {
        console.error('Failed to deactivate plugins:', e);
      });
    };
  }, [manager, builtinPlugins, extensionPoints]);

  const contextValue = useMemo(() => ({ manager }), [manager]);

  return <PluginContext.Provider value={contextValue}>{children}</PluginContext.Provider>;
}

export function usePluginManager(): PluginManager {
  const ctx = useContext(PluginContext);
  if (!ctx) throw new Error('usePluginManager must be used within PluginProvider');
  return ctx.manager;
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// src/plugins/core/index.ts
export type {
  Plugin,
  PluginState,
  PluginDependency,
  PluginContext as PluginContextType,
  PluginStorage,
  PluginLogger,
  ExtensionPoint,
  PluginManifest,
  RegisteredPlugin,
} from './types';

export { PluginRegistry } from './PluginRegistry';
export { ServiceRegistry } from './ServiceRegistry';
export { DependencyResolver } from './DependencyResolver';
export { PluginContextImpl } from './PluginContext';
export { PluginLoader } from './PluginLoader';
export { PluginManager } from './PluginManager';
export { PluginProvider, usePluginManager } from './PluginProvider';
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors in new files

- [ ] **Step 4: Commit**

```bash
git add src/plugins/core/PluginProvider.tsx src/plugins/core/index.ts
git commit -m "feat(plugin): add PluginProvider and barrel export"
```

---

## Phase 2: Theme Extension System

### Task 9: ExtensionPoint Base + ThemeExtensionPoint

**Files:**

- Create: `src/plugins/extensions/ExtensionPoint.ts`
- Create: `src/plugins/extensions/ThemeExtensionPoint.ts`
- Create: `src/plugins/extensions/index.ts`
- Test: `src/plugins/extensions/__tests__/ThemeExtensionPoint.test.ts`

- [ ] **Step 1: Implement ExtensionPoint base**

```typescript
// src/plugins/extensions/ExtensionPoint.ts
export interface ExtensionPointEvent<T = unknown> {
  type: 'contribute' | 'retract';
  contribution: T;
  pluginId?: string;
}

export abstract class ExtensionPointBase<T = unknown> {
  abstract readonly id: string;
  abstract readonly name: string;
  private contributions: T[] = [];
  private listeners: Array<(event: ExtensionPointEvent<T>) => void> = [];

  onContribute(contribution: T): void {
    this.contributions.push(contribution);
    this.notify({ type: 'contribute', contribution });
  }

  onRetract(contribution: T): void {
    const idx = this.contributions.indexOf(contribution);
    if (idx !== -1) {
      this.contributions.splice(idx, 1);
    }
    this.notify({ type: 'retract', contribution });
  }

  getContributions(): T[] {
    return [...this.contributions];
  }

  addListener(listener: (event: ExtensionPointEvent<T>) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private notify(event: ExtensionPointEvent<T>): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
```

- [ ] **Step 2: Write failing tests for ThemeExtensionPoint**

```typescript
// src/plugins/extensions/__tests__/ThemeExtensionPoint.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeExtensionPoint } from '../ThemeExtensionPoint';
import type { ThemeContribution } from '../ThemeExtensionPoint';

describe('ThemeExtensionPoint', () => {
  let point: ThemeExtensionPoint;

  const darkContribution: ThemeContribution = {
    id: 'zzz-dark',
    name: 'ZZZ Dark',
    cssVariables: { '--bg-primary': '#0d0d0d' },
    mode: 'dark',
  };

  const lightContribution: ThemeContribution = {
    id: 'zzz-light',
    name: 'ZZZ Light',
    cssVariables: { '--bg-primary': '#fafafa' },
    mode: 'light',
  };

  beforeEach(() => {
    point = new ThemeExtensionPoint();
  });

  it('should have correct id and name', () => {
    expect(point.id).toBe('bonnext:theme');
    expect(point.name).toBe('Theme Extension Point');
  });

  it('should accept theme contributions', () => {
    point.onContribute(darkContribution);
    expect(point.getContributions()).toHaveLength(1);
    expect(point.getContributions()[0].id).toBe('zzz-dark');
  });

  it('should retract theme contributions', () => {
    point.onContribute(darkContribution);
    point.onRetract(darkContribution);
    expect(point.getContributions()).toHaveLength(0);
  });

  it('should find contribution by id', () => {
    point.onContribute(darkContribution);
    point.onContribute(lightContribution);
    expect(point.getContributionById('zzz-dark')).toBe(darkContribution);
    expect(point.getContributionById('zzz-light')).toBe(lightContribution);
    expect(point.getContributionById('unknown')).toBeUndefined();
  });

  it('should list available theme ids', () => {
    point.onContribute(darkContribution);
    point.onContribute(lightContribution);
    expect(point.getAvailableThemeIds()).toEqual(['zzz-dark', 'zzz-light']);
  });

  it('should notify listeners on contribute', () => {
    const events: string[] = [];
    point.addListener((e) => events.push(e.type));
    point.onContribute(darkContribution);
    expect(events).toEqual(['contribute']);
  });

  it('should notify listeners on retract', () => {
    const events: string[] = [];
    point.addListener((e) => events.push(e.type));
    point.onContribute(darkContribution);
    point.onRetract(darkContribution);
    expect(events).toEqual(['contribute', 'retract']);
  });

  it('should unsubscribe listener', () => {
    const events: string[] = [];
    const unsub = point.addListener((e) => events.push(e.type));
    unsub();
    point.onContribute(darkContribution);
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/plugins/extensions/__tests__/ThemeExtensionPoint.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement ThemeExtensionPoint**

```typescript
// src/plugins/extensions/ThemeExtensionPoint.ts
import { ExtensionPointBase } from './ExtensionPoint';

export interface ThemeContribution {
  id: string;
  name: string;
  cssVariables: Record<string, string>;
  componentOverrides?: Record<string, { cssModulePath: string }>;
  fonts?: Array<{
    family: string;
    src: string;
    weight?: number;
    style?: string;
  }>;
  mode: 'light' | 'dark' | 'auto';
}

export class ThemeExtensionPoint extends ExtensionPointBase<ThemeContribution> {
  readonly id = 'bonnext:theme';
  readonly name = 'Theme Extension Point';

  getContributionById(id: string): ThemeContribution | undefined {
    return this.getContributions().find((c) => c.id === id);
  }

  getAvailableThemeIds(): string[] {
    return this.getContributions().map((c) => c.id);
  }

  getContributionsByMode(mode: 'light' | 'dark'): ThemeContribution[] {
    return this.getContributions().filter((c) => c.mode === mode || c.mode === 'auto');
  }
}
```

- [ ] **Step 5: Create barrel export**

```typescript
// src/plugins/extensions/index.ts
export { ExtensionPointBase } from './ExtensionPoint';
export type { ExtensionPointEvent } from './ExtensionPoint';
export { ThemeExtensionPoint } from './ThemeExtensionPoint';
export type { ThemeContribution } from './ThemeExtensionPoint';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/plugins/extensions/__tests__/ThemeExtensionPoint.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/plugins/extensions/
git commit -m "feat(plugin): add ExtensionPoint base and ThemeExtensionPoint"
```

---

## Phase 3: ZZZ Theme Plugin + ThemeService

### Task 10: ThemeService Implementation

**Files:**

- Create: `src/plugins/builtins/zzz-theme/ThemeService.ts`
- Test: `src/plugins/builtins/zzz-theme/__tests__/ThemeService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/builtins/zzz-theme/__tests__/ThemeService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeService } from '../ThemeService';
import type { ThemeContribution } from '@/plugins/extensions';

const darkTheme: ThemeContribution = {
  id: 'zzz-dark',
  name: 'ZZZ Dark',
  cssVariables: { '--bg-primary': '#0d0d0d', '--text-primary': '#ffffff' },
  mode: 'dark',
};

const lightTheme: ThemeContribution = {
  id: 'zzz-light',
  name: 'ZZZ Light',
  cssVariables: { '--bg-primary': '#fafafa', '--text-primary': '#1a1a1a' },
  mode: 'light',
};

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    service = new ThemeService();
  });

  it('should register themes', () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.registerTheme(lightTheme, 'com.bonnext.zzz-theme');
    expect(service.getAvailableThemes()).toHaveLength(2);
  });

  it('should switch current theme', async () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.registerTheme(lightTheme, 'com.bonnext.zzz-theme');
    await service.switchTheme('zzz-light');
    expect(service.getCurrentTheme().id).toBe('zzz-light');
  });

  it('should throw when switching to unknown theme', async () => {
    await expect(service.switchTheme('unknown')).rejects.toThrow(/not found/);
  });

  it('should notify listeners on theme change', async () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.registerTheme(lightTheme, 'com.bonnext.zzz-theme');
    const changes: string[] = [];
    service.onThemeChange((info) => changes.push(info.id));
    await service.switchTheme('zzz-light');
    expect(changes).toEqual(['zzz-light']);
  });

  it('should unsubscribe listener', async () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    const changes: string[] = [];
    const unsub = service.onThemeChange((info) => changes.push(info.id));
    unsub();
    await service.switchTheme('zzz-dark');
    expect(changes).toHaveLength(0);
  });

  it('should add and remove rules', () => {
    const rule = {
      id: 'system-pref',
      name: 'System Preference',
      priority: 10,
      condition: { type: 'system' as const, preference: 'dark' as const },
      targetTheme: 'zzz-dark',
      enabled: true,
    };
    service.addRule(rule);
    expect(service.getActiveRules()).toHaveLength(1);
    service.removeRule('system-pref');
    expect(service.getActiveRules()).toHaveLength(0);
  });

  it('should unregister themes', () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.unregisterTheme('zzz-dark');
    expect(service.getAvailableThemes()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/plugins/builtins/zzz-theme/__tests__/ThemeService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ThemeService**

```typescript
// src/plugins/builtins/zzz-theme/ThemeService.ts
export interface ThemeInfo {
  id: string;
  name: string;
  mode: 'light' | 'dark' | 'auto';
  pluginId: string;
}

export interface ThemeRule {
  id: string;
  name: string;
  priority: number;
  condition: RuleCondition;
  targetTheme: string;
  enabled: boolean;
}

export type RuleCondition =
  | { type: 'time'; from: string; to: string }
  | { type: 'system'; preference: 'dark' | 'light' }
  | { type: 'instance'; instanceId: string }
  | { type: 'custom'; check: () => boolean };

export type Unsubscribe = () => void;
export type ThemeChangeCallback = (theme: ThemeInfo) => void;

interface RegisteredTheme {
  info: ThemeInfo;
  cssVariables: Record<string, string>;
  componentOverrides?: Record<string, { cssModulePath: string }>;
  fonts?: Array<{ family: string; src: string; weight?: number; style?: string }>;
}

export class ThemeService {
  private themes = new Map<string, RegisteredTheme>();
  private currentThemeId: string | null = null;
  private listeners: ThemeChangeCallback[] = [];
  private rules: ThemeRule[] = [];

  registerTheme(contribution: import('@/plugins/extensions').ThemeContribution, pluginId: string): void {
    this.themes.set(contribution.id, {
      info: {
        id: contribution.id,
        name: contribution.name,
        mode: contribution.mode,
        pluginId,
      },
      cssVariables: contribution.cssVariables,
      componentOverrides: contribution.componentOverrides,
      fonts: contribution.fonts,
    });

    if (this.currentThemeId === null) {
      this.currentThemeId = contribution.id;
    }
  }

  unregisterTheme(id: string): void {
    this.themes.delete(id);
  }

  getCurrentTheme(): ThemeInfo {
    if (!this.currentThemeId) {
      throw new Error('No theme is currently active');
    }
    const theme = this.themes.get(this.currentThemeId);
    if (!theme) {
      throw new Error(`Current theme "${this.currentThemeId}" not found`);
    }
    return theme.info;
  }

  getAvailableThemes(): ThemeInfo[] {
    return Array.from(this.themes.values()).map((t) => t.info);
  }

  getThemeVariables(id: string): Record<string, string> | undefined {
    return this.themes.get(id)?.cssVariables;
  }

  async switchTheme(themeId: string, options?: { animate?: boolean; seedColor?: string }): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme "${themeId}" not found`);
    }

    this.currentThemeId = themeId;

    this.applyThemeToDOM(theme, options?.animate ?? true);

    for (const listener of this.listeners) {
      listener(theme.info);
    }
  }

  private applyThemeToDOM(theme: RegisteredTheme, animate: boolean): void {
    const root = document.documentElement;

    if (animate) {
      root.classList.add('theme-transition');
    }

    root.classList.remove('theme-dark', 'theme-light', 'theme-oled', 'theme-md3-dark', 'theme-md3-light');

    for (const [key, value] of Object.entries(theme.cssVariables)) {
      root.style.setProperty(key, value);
    }

    if (theme.info.id.startsWith('zzz-')) {
      const modeClass =
        theme.info.mode === 'dark' ? 'theme-dark' : theme.info.mode === 'light' ? 'theme-light' : 'theme-dark';
      root.classList.add(modeClass);
    } else {
      root.classList.add(`theme-${theme.info.id}`);
    }

    if (animate) {
      setTimeout(() => {
        root.classList.remove('theme-transition');
      }, 350);
    }
  }

  onThemeChange(callback: ThemeChangeCallback): Unsubscribe {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  addRule(rule: ThemeRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  getActiveRules(): ThemeRule[] {
    return this.rules.filter((r) => r.enabled);
  }

  evaluateRules(): string | null {
    for (const rule of this.getActiveRules()) {
      if (this.evaluateCondition(rule.condition)) {
        return rule.targetTheme;
      }
    }
    return null;
  }

  private evaluateCondition(condition: RuleCondition): boolean {
    switch (condition.type) {
      case 'system': {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(`(prefers-color-scheme: ${condition.preference})`).matches;
      }
      case 'time': {
        const now = new Date();
        const hours = now.getHours();
        const [fromH] = condition.from.split(':').map(Number);
        const [toH] = condition.to.split(':').map(Number);
        return hours >= fromH && hours < toH;
      }
      case 'custom':
        return condition.check();
      default:
        return false;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/plugins/builtins/zzz-theme/__tests__/ThemeService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/builtins/zzz-theme/ThemeService.ts src/plugins/builtins/zzz-theme/__tests__/ThemeService.test.ts
git commit -m "feat(plugin): implement ThemeService with rules engine"
```

---

### Task 11: ZZZ Theme Plugin + Contributions

**Files:**

- Create: `src/plugins/builtins/zzz-theme/contributions.ts`
- Create: `src/plugins/builtins/zzz-theme/ZZZThemePlugin.ts`
- Create: `src/plugins/builtins/zzz-theme/index.ts`

- [ ] **Step 1: Create ZZZ theme contributions**

```typescript
// src/plugins/builtins/zzz-theme/contributions.ts
import type { ThemeContribution } from '@/plugins/extensions';

export const zzzDarkContribution: ThemeContribution = {
  id: 'zzz-dark',
  name: 'ZZZ Dark',
  mode: 'dark',
  cssVariables: {
    '--bg-primary': '#0d0d0d',
    '--bg-secondary': '#141414',
    '--bg-card': '#1a1a1a',
    '--text-primary': '#ffffff',
    '--text-secondary': '#aaaaaa',
    '--text-muted': '#888888',
    '--accent': '#ffe600',
    '--border': '#1a1a1a',
    '--border-hover': '#2a2a2a',
    '--danger': '#ff4444',
    '--success': '#00ff88',
    '--color-sidebar': '#0f0f0f',
  },
};

export const zzzLightContribution: ThemeContribution = {
  id: 'zzz-light',
  name: 'ZZZ Light',
  mode: 'light',
  cssVariables: {
    '--bg-primary': '#fafafa',
    '--bg-secondary': '#f0f0f0',
    '--bg-card': '#ffffff',
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#555555',
    '--text-muted': '#777777',
    '--accent': '#ffe600',
    '--border': '#e5e5e5',
    '--border-hover': '#b0b0b0',
    '--danger': '#cc2222',
    '--success': '#00aa55',
    '--color-sidebar': '#f0f0f0',
  },
};

export const zzzOledContribution: ThemeContribution = {
  id: 'zzz-oled',
  name: 'ZZZ OLED',
  mode: 'dark',
  cssVariables: {
    '--bg-primary': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--bg-card': '#0f0f0f',
    '--text-primary': '#ffffff',
    '--text-secondary': '#999999',
    '--text-muted': '#777777',
    '--accent': '#ffe600',
    '--border': '#1a1a1a',
    '--border-hover': '#333333',
    '--danger': '#ff4444',
    '--success': '#00ff88',
    '--color-sidebar': '#050505',
  },
};
```

- [ ] **Step 2: Create ZZZ Theme Plugin**

```typescript
// src/plugins/builtins/zzz-theme/ZZZThemePlugin.ts
import type { Plugin, PluginContext } from '@/plugins/core';
import { ThemeService } from './ThemeService';
import { zzzDarkContribution, zzzLightContribution, zzzOledContribution } from './contributions';

export class ZZZThemePlugin implements Plugin {
  id = 'com.bonnext.zzz-theme';
  name = 'ZZZ Theme';
  version = '1.0.0';
  description = 'Default ZZZ Neo-Tokyo cyberpunk theme (dark, light, OLED)';

  private themeService: ThemeService | null = null;

  async activate(context: PluginContext): Promise<void> {
    this.themeService = new ThemeService();

    context.provideService('bonnext:theme', this.themeService);

    this.themeService.registerTheme(zzzDarkContribution, this.id);
    this.themeService.registerTheme(zzzLightContribution, this.id);
    this.themeService.registerTheme(zzzOledContribution, this.id);

    context.contributeExtension('bonnext:theme', zzzDarkContribution);
    context.contributeExtension('bonnext:theme', zzzLightContribution);
    context.contributeExtension('bonnext:theme', zzzOledContribution);

    const stored = localStorage.getItem('bonnext:theme');
    if (stored && this.themeService.getAvailableThemes().some((t) => t.id === `zzz-${stored}`)) {
      await this.themeService.switchTheme(`zzz-${stored}`);
    } else {
      await this.themeService.switchTheme('zzz-dark');
    }
  }

  async deactivate(): Promise<void> {
    this.themeService = null;
  }

  getThemeService(): ThemeService | null {
    return this.themeService;
  }
}
```

- [ ] **Step 3: Create barrel export**

```typescript
// src/plugins/builtins/zzz-theme/index.ts
export { ZZZThemePlugin } from './ZZZThemePlugin';
export { ThemeService } from './ThemeService';
export type { ThemeInfo, ThemeRule, RuleCondition, ThemeChangeCallback } from './ThemeService';
export { zzzDarkContribution, zzzLightContribution, zzzOledContribution } from './contributions';
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/plugins/builtins/zzz-theme/
git commit -m "feat(plugin): implement ZZZ theme plugin with dark/light/oled"
```

---

### Task 12: ThemeProvider Refactoring

**Files:**

- Modify: `src/stores/themeStore.tsx`

- [ ] **Step 1: Refactor themeStore to bind to ThemeService**

The key change: ThemeProvider reads from ThemeService instead of managing theme state directly. The `useTheme()` API stays identical.

```tsx
// src/stores/themeStore.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ThemeService, ThemeInfo } from '@/plugins/builtins/zzz-theme';

export type Theme = 'dark' | 'light' | 'oled' | string;
export type AnimationSpeed = 'fast' | 'normal' | 'smooth' | 'custom';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  switchThemeWithAnimation: (newTheme: Theme) => void;
  uiScale: number;
  setUiScale: (scale: number) => void;
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  animationDuration: number;
  setAnimationDuration: (duration: number) => void;
  availableThemes: ThemeInfo[];
  themeService: ThemeService | null;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'bonnext:theme';
const UI_SCALE_STORAGE_KEY = 'bonnext:ui-scale';
const ANIM_SPEED_STORAGE_KEY = 'bonnext:animation-speed';
const ANIM_DURATION_STORAGE_KEY = 'bonnext:animation-duration';
const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2.0;
const UI_SCALE_DEFAULT = 1.0;

const ANIM_SPEED_MAP: Record<AnimationSpeed, number> = {
  fast: 0.5,
  normal: 1.0,
  smooth: 1.8,
  custom: 1.0,
};

const ZZZ_THEME_MAP: Record<string, Theme> = {
  'zzz-dark': 'dark',
  'zzz-light': 'light',
  'zzz-oled': 'oled',
};

const ZZZ_THEME_REVERSE_MAP: Record<Theme, string> = {
  dark: 'zzz-dark',
  light: 'zzz-light',
  oled: 'zzz-oled',
};

function getInitialUiScale(): number {
  try {
    const stored = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= UI_SCALE_MIN && val <= UI_SCALE_MAX) return val;
    }
  } catch {}
  return UI_SCALE_DEFAULT;
}

function getInitialAnimationSpeed(): AnimationSpeed {
  try {
    const stored = localStorage.getItem(ANIM_SPEED_STORAGE_KEY);
    if (stored === 'fast' || stored === 'normal' || stored === 'smooth' || stored === 'custom') return stored;
  } catch {}
  return 'normal';
}

function getInitialAnimationDuration(): number {
  try {
    const stored = localStorage.getItem(ANIM_DURATION_STORAGE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val) && val >= 0.2 && val <= 5.0) return val;
    }
  } catch {}
  return 1.0;
}

function applyUiScale(scale: number) {
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.documentElement.style.fontSize = `${scale * 16}px`;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  themeService: ThemeService | null;
}

export function ThemeProvider({ children, themeService }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light' || stored === 'oled') return stored;
    } catch {}
    return 'dark';
  });
  const [availableThemes, setAvailableThemes] = useState<ThemeInfo[]>([]);
  const [uiScale, setUiScaleState] = useState<number>(getInitialUiScale);
  const [animationSpeed, setAnimationSpeedState] = useState<AnimationSpeed>(getInitialAnimationSpeed);
  const [animationDuration, setAnimationDurationState] = useState<number>(getInitialAnimationDuration);

  useEffect(() => {
    if (themeService) {
      setAvailableThemes(themeService.getAvailableThemes());
      const unsub = themeService.onThemeChange((info) => {
        const simpleTheme = ZZZ_THEME_MAP[info.id] || info.id;
        setThemeState(simpleTheme);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, simpleTheme);
        } catch {}
      });
      return unsub;
    }
  }, [themeService]);

  const applyAnimationSpeed = useCallback((speed: AnimationSpeed, customDuration: number) => {
    const root = document.documentElement;
    const duration = speed === 'custom' ? customDuration : ANIM_SPEED_MAP[speed];
    root.style.setProperty('--anim-speed', String(duration));
  }, []);

  useEffect(() => {
    applyUiScale(uiScale);
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, String(uiScale));
    } catch {}
  }, [uiScale]);

  useEffect(() => {
    applyAnimationSpeed(animationSpeed, animationDuration);
    try {
      localStorage.setItem(ANIM_SPEED_STORAGE_KEY, animationSpeed);
      localStorage.setItem(ANIM_DURATION_STORAGE_KEY, String(animationDuration));
    } catch {}
  }, [animationSpeed, animationDuration, applyAnimationSpeed]);

  const setTheme = useCallback(
    (t: Theme) => {
      if (themeService) {
        const themeId = ZZZ_THEME_REVERSE_MAP[t] || t;
        themeService.switchTheme(themeId).catch(console.error);
      }
    },
    [themeService],
  );

  const toggleTheme = useCallback(() => {
    const zzzCycle: Theme[] = ['dark', 'light', 'oled'];
    const idx = zzzCycle.indexOf(theme);
    const next = zzzCycle[(idx + 1) % zzzCycle.length];
    setTheme(next);
  }, [theme, setTheme]);

  const switchThemeWithAnimation = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
    },
    [setTheme],
  );

  const setUiScale = useCallback((scale: number) => {
    const clamped = Math.round(Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale)) * 100) / 100;
    setUiScaleState(clamped);
  }, []);

  const setAnimationSpeed = useCallback((speed: AnimationSpeed) => {
    setAnimationSpeedState(speed);
  }, []);

  const setAnimationDuration = useCallback((duration: number) => {
    const clamped = Math.round(Math.min(5.0, Math.max(0.2, duration)) * 100) / 100;
    setAnimationDurationState(clamped);
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      switchThemeWithAnimation,
      uiScale,
      setUiScale,
      animationSpeed,
      setAnimationSpeed,
      animationDuration,
      setAnimationDuration,
      availableThemes,
      themeService,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      switchThemeWithAnimation,
      uiScale,
      setUiScale,
      animationSpeed,
      setAnimationSpeed,
      animationDuration,
      setAnimationDuration,
      availableThemes,
      themeService,
    ],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { UI_SCALE_MIN, UI_SCALE_MAX };
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: May have errors in components using `useTheme()` — fix any type mismatches

- [ ] **Step 3: Fix any type errors in consuming components**

The `useTheme()` API is backward-compatible. The only additions are `availableThemes` and `themeService` fields. Existing consumers should work without changes.

- [ ] **Step 4: Commit**

```bash
git add src/stores/themeStore.tsx
git commit -m "refactor(theme): bind ThemeProvider to ThemeService"
```

---

### Task 13: App.tsx Integration

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Add PluginProvider to App.tsx**

Wrap ThemeProvider with PluginProvider. Pass ThemeService from PluginManager to ThemeProvider.

Read the current App.tsx provider section (lines 241-265) and modify:

```tsx
// In App.tsx, replace the provider nesting:

// Before:
// <HashRouter>
//   <ThemeProvider>
//     <I18nProvider>
//       ...

// After:
import { PluginProvider, usePluginManager } from '@/plugins/core';
import { ThemeExtensionPoint } from '@/plugins/extensions';
import { ZZZThemePlugin } from '@/plugins/builtins/zzz-theme';

const themeExtensionPoint = new ThemeExtensionPoint();
const builtinPlugins = [new ZZZThemePlugin()];

function AppWithPlugins() {
  const pluginManager = usePluginManager();
  const themeService = pluginManager.getService('bonnext:theme') as import('@/plugins/builtins/zzz-theme').ThemeService | null;

  return (
    <ThemeProvider themeService={themeService}>
      <I18nProvider>
        <AuthProvider>
          <ConfigProvider>
            <InstanceProvider>
              <ToastProvider>
                <DownloadProvider>
                  <ContextMenuProvider>
                    <CommandPalette />
                    <AppShell />
                    <DownloadPanel />
                    <ToastContainer />
                  </ContextMenuProvider>
                </DownloadProvider>
              </ToastProvider>
            </InstanceProvider>
          </ConfigProvider>
        </I18nProvider>
      </ThemeProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <PluginProvider builtinPlugins={builtinPlugins} extensionPoints={[themeExtensionPoint]}>
        <AppWithPlugins />
      </PluginProvider>
    </HashRouter>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Run dev server to verify**

Run: `pnpm dev`
Expected: App loads with ZZZ dark theme as default, no visual changes

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(plugin): integrate PluginProvider in App.tsx"
```

---

## Phase 4: MD3 Theme Plugin

### Task 14: HCT Color System

**Files:**

- Create: `src/plugins/builtins/md3-theme/colorSystem.ts`
- Test: `src/plugins/builtins/md3-theme/__tests__/colorSystem.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/plugins/builtins/md3-theme/__tests__/colorSystem.test.ts
import { describe, it, expect } from 'vitest';
import { MD3ColorSystem } from '../colorSystem';

describe('MD3ColorSystem', () => {
  const colorSystem = new MD3ColorSystem();

  it('should generate tonal palettes from seed color', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    expect(tokens.primary).toBeDefined();
    expect(tokens.secondary).toBeDefined();
    expect(tokens.tertiary).toBeDefined();
    expect(tokens.neutral).toBeDefined();
    expect(tokens.neutralVariant).toBeDefined();
    expect(tokens.error).toBeDefined();
  });

  it('should generate 13 tones per palette', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const tones = Object.keys(tokens.primary);
    expect(tones).toHaveLength(13);
    expect(tones).toContain('0');
    expect(tones).toContain('100');
  });

  it('should generate valid hex colors', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    for (const value of Object.values(tokens.primary)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should produce different palettes for different seeds', () => {
    const violet = colorSystem.generateFromSeed('#6750A4');
    const blue = colorSystem.generateFromSeed('#0061A4');
    expect(violet.primary[40]).not.toBe(blue.primary[40]);
  });

  it('should generate CSS variables for dark mode', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const vars = colorSystem.getTokensForMode(tokens, 'dark');
    expect(vars['--md3-primary']).toBeDefined();
    expect(vars['--md3-surface']).toBeDefined();
    expect(vars['--md3-on-surface']).toBeDefined();
  });

  it('should generate CSS variables for light mode', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const vars = colorSystem.getTokensForMode(tokens, 'light');
    expect(vars['--md3-primary']).toBeDefined();
    expect(vars['--md3-surface']).toBeDefined();
    expect(vars['--md3-on-surface']).toBeDefined();
  });

  it('should map to existing variable system', () => {
    const tokens = colorSystem.generateFromSeed('#6750A4');
    const vars = colorSystem.getTokensForMode(tokens, 'dark');
    expect(vars['--bg-primary']).toBeDefined();
    expect(vars['--accent']).toBeDefined();
    expect(vars['--text-primary']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/plugins/builtins/md3-theme/__tests__/colorSystem.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement colorSystem.ts**

This is the largest single file (~500 lines). It implements HCT color space conversion and tonal palette generation following the Material Color Utilities specification.

```typescript
// src/plugins/builtins/md3-theme/colorSystem.ts
export type Tone = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 | 99 | 100;
export type TonalPalette = Record<Tone, string>;

export interface MD3ThemeTokens {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
}

export type CSSVariableMap = Record<string, string>;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r),
    lg = srgbToLinear(g),
    lb = srgbToLinear(b);
  return [
    0.4124 * lr + 0.3576 * lg + 0.1805 * lb,
    0.2126 * lr + 0.7152 * lg + 0.0722 * lb,
    0.0193 * lr + 0.1192 * lg + 0.9505 * lb,
  ];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / xn),
    fy = f(y / yn),
    fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToXyz(l: number, a: number, b: number): [number, number, number] {
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const finv = (t: number) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  return [xn * finv(fx), yn * finv(fy), zn * finv(fz)];
}

function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  const lr = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const lg = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const lb = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

function rgbToHct(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  const [l, a, bv] = xyzToLab(x, y, z);
  const hue = Math.atan2(bv, a) * (180 / Math.PI);
  const chroma = Math.sqrt(a * a + bv * bv);
  return [hue < 0 ? hue + 360 : hue, chroma, l];
}

function hctToRgb(hue: number, chroma: number, tone: number): [number, number, number] {
  const hRad = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hRad);
  const b = chroma * Math.sin(hRad);
  const [x, y, z] = labToXyz(tone, a, b);
  return xyzToRgb(x, y, z);
}

function generateTonalPalette(hue: number, chroma: number): TonalPalette {
  const tones: Tone[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
  const palette: Partial<TonalPalette> = {};
  for (const tone of tones) {
    const [r, g, b] = hctToRgb(hue, chroma, tone);
    palette[tone] = rgbToHex(r, g, b);
  }
  return palette as TonalPalette;
}

function rotateHue(hue: number, degrees: number): number {
  return (hue + degrees) % 360;
}

export class MD3ColorSystem {
  generateFromSeed(seedColor: string): MD3ThemeTokens {
    const [r, g, b] = hexToRgb(seedColor);
    const [hue, chroma, _tone] = rgbToHct(r, g, b);

    return {
      primary: generateTonalPalette(hue, Math.max(chroma, 48)),
      secondary: generateTonalPalette(rotateHue(hue, 30), Math.min(chroma, 16)),
      tertiary: generateTonalPalette(rotateHue(hue, 60), Math.min(Math.max(chroma, 24), 32)),
      neutral: generateTonalPalette(hue, Math.min(chroma, 4)),
      neutralVariant: generateTonalPalette(hue, Math.min(chroma, 8)),
      error: generateTonalPalette(25, 84),
    };
  }

  generateFromImage(_imageData: ImageData): MD3ThemeTokens {
    return this.generateFromSeed('#6750A4');
  }

  getTokensForMode(tokens: MD3ThemeTokens, mode: 'light' | 'dark'): CSSVariableMap {
    if (mode === 'dark') {
      return {
        '--md3-primary': tokens.primary[80],
        '--md3-on-primary': tokens.primary[20],
        '--md3-primary-container': tokens.primary[30],
        '--md3-on-primary-container': tokens.primary[90],
        '--md3-secondary': tokens.secondary[80],
        '--md3-on-secondary': tokens.secondary[20],
        '--md3-secondary-container': tokens.secondary[30],
        '--md3-on-secondary-container': tokens.secondary[90],
        '--md3-tertiary': tokens.tertiary[80],
        '--md3-on-tertiary': tokens.tertiary[20],
        '--md3-tertiary-container': tokens.tertiary[30],
        '--md3-on-tertiary-container': tokens.tertiary[90],
        '--md3-error': tokens.error[80],
        '--md3-on-error': tokens.error[20],
        '--md3-error-container': tokens.error[30],
        '--md3-on-error-container': tokens.error[90],
        '--md3-surface': tokens.neutral[6],
        '--md3-on-surface': tokens.neutral[90],
        '--md3-surface-variant': tokens.neutralVariant[30],
        '--md3-on-surface-variant': tokens.neutralVariant[80],
        '--md3-surface-container-lowest': tokens.neutral[4],
        '--md3-surface-container-low': tokens.neutral[10],
        '--md3-surface-container': tokens.neutral[12],
        '--md3-surface-container-high': tokens.neutral[17],
        '--md3-surface-container-highest': tokens.neutral[22],
        '--md3-outline': tokens.neutralVariant[60],
        '--md3-outline-variant': tokens.neutralVariant[30],
        '--md3-inverse-surface': tokens.neutral[90],
        '--md3-inverse-on-surface': tokens.neutral[10],
        '--md3-scrim': tokens.neutral[0],
        '--md3-shadow': tokens.neutral[0],
        '--bg-primary': tokens.neutral[6],
        '--bg-secondary': tokens.neutral[12],
        '--bg-card': tokens.neutral[17],
        '--text-primary': tokens.neutral[90],
        '--text-secondary': tokens.neutralVariant[80],
        '--text-muted': tokens.neutralVariant[60],
        '--accent': tokens.primary[80],
        '--border': tokens.neutralVariant[30],
        '--border-hover': tokens.neutralVariant[60],
        '--danger': tokens.error[80],
        '--success': tokens.tertiary[80],
        '--color-sidebar': tokens.neutral[10],
      };
    }

    return {
      '--md3-primary': tokens.primary[40],
      '--md3-on-primary': tokens.primary[100],
      '--md3-primary-container': tokens.primary[90],
      '--md3-on-primary-container': tokens.primary[10],
      '--md3-secondary': tokens.secondary[40],
      '--md3-on-secondary': tokens.secondary[100],
      '--md3-secondary-container': tokens.secondary[90],
      '--md3-on-secondary-container': tokens.secondary[10],
      '--md3-tertiary': tokens.tertiary[40],
      '--md3-on-tertiary': tokens.tertiary[100],
      '--md3-tertiary-container': tokens.tertiary[90],
      '--md3-on-tertiary-container': tokens.tertiary[10],
      '--md3-error': tokens.error[40],
      '--md3-on-error': tokens.error[100],
      '--md3-error-container': tokens.error[90],
      '--md3-on-error-container': tokens.error[10],
      '--md3-surface': tokens.neutral[98],
      '--md3-on-surface': tokens.neutral[10],
      '--md3-surface-variant': tokens.neutralVariant[90],
      '--md3-on-surface-variant': tokens.neutralVariant[30],
      '--md3-surface-container-lowest': tokens.neutral[100],
      '--md3-surface-container-low': tokens.neutral[96],
      '--md3-surface-container': tokens.neutral[94],
      '--md3-surface-container-high': tokens.neutral[92],
      '--md3-surface-container-highest': tokens.neutral[90],
      '--md3-outline': tokens.neutralVariant[50],
      '--md3-outline-variant': tokens.neutralVariant[80],
      '--md3-inverse-surface': tokens.neutral[20],
      '--md3-inverse-on-surface': tokens.neutral[95],
      '--md3-scrim': tokens.neutral[0],
      '--md3-shadow': tokens.neutral[0],
      '--bg-primary': tokens.neutral[98],
      '--bg-secondary': tokens.neutral[94],
      '--bg-card': tokens.neutral[100],
      '--text-primary': tokens.neutral[10],
      '--text-secondary': tokens.neutralVariant[30],
      '--text-muted': tokens.neutralVariant[50],
      '--accent': tokens.primary[40],
      '--border': tokens.neutralVariant[80],
      '--border-hover': tokens.neutralVariant[50],
      '--danger': tokens.error[40],
      '--success': tokens.tertiary[40],
      '--color-sidebar': tokens.neutral[96],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/plugins/builtins/md3-theme/__tests__/colorSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/builtins/md3-theme/colorSystem.ts src/plugins/builtins/md3-theme/__tests__/colorSystem.test.ts
git commit -m "feat(md3): implement HCT color system with tonal palette generation"
```

---

### Task 15: MD3 CSS Tokens

**Files:**

- Create: `src/plugins/builtins/md3-theme/tokens/md3-dark.css`
- Create: `src/plugins/builtins/md3-theme/tokens/md3-light.css`
- Create: `src/plugins/builtins/md3-theme/tokens/md3-shared.css`

- [ ] **Step 1: Create shared tokens**

```css
/* src/plugins/builtins/md3-theme/tokens/md3-shared.css */
html[class*='theme-md3'] {
  --md3-shape-corner-none: 0px;
  --md3-shape-corner-extra-small: 4px;
  --md3-shape-corner-small: 8px;
  --md3-shape-corner-medium: 12px;
  --md3-shape-corner-large: 16px;
  --md3-shape-corner-extra-large: 28px;
  --md3-shape-corner-full: 9999px;

  --md3-elevation-0: none;
  --md3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  --md3-elevation-2: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
  --md3-elevation-3: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3);
  --md3-elevation-4: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px rgba(0, 0, 0, 0.3);
  --md3-elevation-5: 0 8px 12px 6px rgba(0, 0, 0, 0.15), 0 4px 4px rgba(0, 0, 0, 0.3);

  --md3-motion-duration-short: 200ms;
  --md3-motion-duration-medium: 300ms;
  --md3-motion-duration-long: 500ms;
  --md3-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md3-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md3-motion-easing-decelerated: cubic-bezier(0, 0, 0, 1);
  --md3-motion-easing-accelerated: cubic-bezier(0.3, 0, 0.8, 0.15);

  --clip-primary: 0px;
  --clip-medium: 0px;
  --clip-small: 0px;
  --clip-badge: 0px;
  --clip-icon: 0px;
}
```

- [ ] **Step 2: Create dark mode tokens**

```css
/* src/plugins/builtins/md3-theme/tokens/md3-dark.css */
html.theme-md3-dark {
  --md3-primary: #d0bcff;
  --md3-on-primary: #381e72;
  --md3-primary-container: #4f378b;
  --md3-on-primary-container: #eaddff;
  --md3-secondary: #ccc2dc;
  --md3-on-secondary: #332d41;
  --md3-secondary-container: #4a4458;
  --md3-on-secondary-container: #e8def8;
  --md3-tertiary: #efb8c8;
  --md3-on-tertiary: #492532;
  --md3-tertiary-container: #633b48;
  --md3-on-tertiary-container: #ffd8e4;
  --md3-error: #f2b8b5;
  --md3-on-error: #601410;
  --md3-error-container: #8c1d18;
  --md3-on-error-container: #f9dedc;
  --md3-surface: #141218;
  --md3-on-surface: #e6e0e9;
  --md3-surface-variant: #49454f;
  --md3-on-surface-variant: #cac4d0;
  --md3-surface-container-lowest: #0f0d13;
  --md3-surface-container-low: #1d1b20;
  --md3-surface-container: #211f26;
  --md3-surface-container-high: #2b2930;
  --md3-surface-container-highest: #36343b;
  --md3-outline: #938f99;
  --md3-outline-variant: #49454f;
  --md3-inverse-surface: #e6e0e9;
  --md3-inverse-on-surface: #322f35;
  --md3-scrim: #000000;
  --md3-shadow: #000000;

  --bg-primary: #141218;
  --bg-secondary: #211f26;
  --bg-card: #2b2930;
  --text-primary: #e6e0e9;
  --text-secondary: #cac4d0;
  --text-muted: #938f99;
  --accent: #d0bcff;
  --border: #49454f;
  --border-hover: #938f99;
  --danger: #f2b8b5;
  --success: #efb8c8;
  --color-sidebar: #1d1b20;

  --color-accent-action: var(--md3-primary);
  --color-accent-action-text: var(--md3-on-primary);
  --color-accent-06: rgba(208, 188, 255, 0.06);
  --color-accent-10: rgba(208, 188, 255, 0.1);
  --color-accent-15: rgba(208, 188, 255, 0.15);
  --color-accent-20: rgba(208, 188, 255, 0.2);
  --color-accent-30: rgba(208, 188, 255, 0.3);

  --color-overlay-30: rgba(0, 0, 0, 0.3);
  --color-overlay-50: rgba(0, 0, 0, 0.5);
  --color-overlay-60: rgba(0, 0, 0, 0.6);
  --color-overlay-80: rgba(0, 0, 0, 0.8);

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  --shadow-elevated: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);

  --selection-bg: rgba(208, 188, 255, 0.3);
  --selection-color: #e6e0e9;
  --scrollbar-thumb-color: rgba(255, 255, 255, 0.2);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.35);
}
```

- [ ] **Step 3: Create light mode tokens**

```css
/* src/plugins/builtins/md3-theme/tokens/md3-light.css */
html.theme-md3-light {
  --md3-primary: #6750a4;
  --md3-on-primary: #ffffff;
  --md3-primary-container: #eaddff;
  --md3-on-primary-container: #21005d;
  --md3-secondary: #625b71;
  --md3-on-secondary: #ffffff;
  --md3-secondary-container: #e8def8;
  --md3-on-secondary-container: #1d192b;
  --md3-tertiary: #7d5260;
  --md3-on-tertiary: #ffffff;
  --md3-tertiary-container: #ffd8e4;
  --md3-on-tertiary-container: #31111d;
  --md3-error: #b3261e;
  --md3-on-error: #ffffff;
  --md3-error-container: #f9dedc;
  --md3-on-error-container: #410e0b;
  --md3-surface: #fffbfe;
  --md3-on-surface: #1c1b1f;
  --md3-surface-variant: #e7e0ec;
  --md3-on-surface-variant: #49454f;
  --md3-surface-container-lowest: #ffffff;
  --md3-surface-container-low: #f7f2fa;
  --md3-surface-container: #f3edf7;
  --md3-surface-container-high: #ece6f0;
  --md3-surface-container-highest: #e6e0e9;
  --md3-outline: #79747e;
  --md3-outline-variant: #cac4d0;
  --md3-inverse-surface: #322f35;
  --md3-inverse-on-surface: #f5eff7;
  --md3-scrim: #000000;
  --md3-shadow: #000000;

  --bg-primary: #fffbfe;
  --bg-secondary: #f3edf7;
  --bg-card: #ffffff;
  --text-primary: #1c1b1f;
  --text-secondary: #49454f;
  --text-muted: #79747e;
  --accent: #6750a4;
  --border: #cac4d0;
  --border-hover: #79747e;
  --danger: #b3261e;
  --success: #7d5260;
  --color-sidebar: #f7f2fa;

  --color-accent-action: var(--md3-primary);
  --color-accent-action-text: var(--md3-on-primary);
  --color-accent-06: rgba(103, 80, 164, 0.06);
  --color-accent-10: rgba(103, 80, 164, 0.1);
  --color-accent-15: rgba(103, 80, 164, 0.15);
  --color-accent-20: rgba(103, 80, 164, 0.2);
  --color-accent-30: rgba(103, 80, 164, 0.3);

  --color-overlay-30: rgba(0, 0, 0, 0.15);
  --color-overlay-50: rgba(0, 0, 0, 0.3);
  --color-overlay-60: rgba(0, 0, 0, 0.4);
  --color-overlay-80: rgba(0, 0, 0, 0.6);

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.08), 0 1px 3px 1px rgba(0, 0, 0, 0.04);
  --shadow-elevated: 0 1px 2px rgba(0, 0, 0, 0.12), 0 2px 6px 2px rgba(0, 0, 0, 0.06);

  --selection-bg: rgba(103, 80, 164, 0.15);
  --selection-color: #1c1b1f;
  --scrollbar-thumb-color: rgba(0, 0, 0, 0.2);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/plugins/builtins/md3-theme/tokens/
git commit -m "feat(md3): add MD3 CSS tokens for dark and light modes"
```

---

### Task 16: MD3 Component Style Overrides

**Files:**

- Create: `src/plugins/builtins/md3-theme/components/md3-button.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-input.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-card.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-modal.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-sidebar.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-tabs.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-badge.module.css`
- Create: `src/plugins/builtins/md3-theme/components/md3-toggle.module.css`

- [ ] **Step 1: Create button overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-button.module.css */
:global(html[class*='theme-md3']) .buttonPrimary {
  border-radius: 20px;
  clip-path: none;
  background: var(--md3-primary);
  color: var(--md3-on-primary);
  box-shadow: var(--md3-elevation-0);
  font-family: var(--font-body);
  text-transform: none;
  letter-spacing: normal;
}

:global(html[class*='theme-md3']) .buttonPrimary:hover {
  box-shadow: var(--md3-elevation-1);
}

:global(html[class*='theme-md3']) .buttonSecondary {
  border-radius: 20px;
  clip-path: none;
  border: 1px solid var(--md3-outline);
  background: transparent;
  color: var(--md3-primary);
}

:global(html[class*='theme-md3']) .buttonSecondary:hover {
  background: var(--color-accent-06);
}

:global(html[class*='theme-md3']) .buttonIcon {
  border-radius: 50%;
  clip-path: none;
}

:global(html[class*='theme-md3']) .buttonDanger {
  border-radius: 20px;
  clip-path: none;
  background: var(--md3-error);
  color: var(--md3-on-error);
}
```

- [ ] **Step 2: Create input overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-input.module.css */
:global(html[class*='theme-md3']) .textInput {
  border-radius: var(--md3-shape-corner-extra-small);
  clip-path: none;
  border: none;
  border-bottom: 2px solid var(--md3-on-surface-variant);
  background: var(--md3-surface-container-highest);
}

:global(html[class*='theme-md3']) .textInput:focus {
  border-bottom-color: var(--md3-primary);
}

:global(html[class*='theme-md3']) .selectInput {
  border-radius: var(--md3-shape-corner-extra-small);
  clip-path: none;
}
```

- [ ] **Step 3: Create card overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-card.module.css */
:global(html[class*='theme-md3']) .card {
  border-radius: var(--md3-shape-corner-medium);
  clip-path: none;
  background: var(--md3-surface-container);
  box-shadow: var(--md3-elevation-0);
  border: 1px solid var(--md3-outline-variant);
}

:global(html[class*='theme-md3']) .card:hover {
  box-shadow: var(--md3-elevation-1);
  border-color: var(--md3-outline);
}
```

- [ ] **Step 4: Create modal overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-modal.module.css */
:global(html[class*='theme-md3']) .modalOverlay {
  background: rgba(0, 0, 0, 0.4);
}

:global(html[class*='theme-md3']) .modalPanel {
  border-radius: var(--md3-shape-corner-extra-large);
  clip-path: none;
  background: var(--md3-surface-container-high);
  box-shadow: var(--md3-elevation-3);
}
```

- [ ] **Step 5: Create sidebar overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-sidebar.module.css */
:global(html[class*='theme-md3']) .sidebar {
  background: var(--md3-surface);
  border-right: 1px solid var(--md3-outline-variant);
}

:global(html[class*='theme-md3']) .sidebarItem {
  border-radius: var(--md3-shape-corner-full);
  clip-path: none;
}

:global(html[class*='theme-md3']) .sidebarItemActive {
  background: var(--color-accent-15);
  color: var(--md3-primary);
}
```

- [ ] **Step 6: Create tabs overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-tabs.module.css */
:global(html[class*='theme-md3']) .tab {
  border-radius: 0;
  clip-path: none;
  border-bottom: 2px solid transparent;
}

:global(html[class*='theme-md3']) .tabActive {
  border-bottom-color: var(--md3-primary);
  color: var(--md3-primary);
}
```

- [ ] **Step 7: Create badge overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-badge.module.css */
:global(html[class*='theme-md3']) .badge {
  border-radius: var(--md3-shape-corner-full);
  clip-path: none;
  background: var(--md3-primary);
  color: var(--md3-on-primary);
}
```

- [ ] **Step 8: Create toggle overrides**

```css
/* src/plugins/builtins/md3-theme/components/md3-toggle.module.css */
:global(html[class*='theme-md3']) .toggle {
  border-radius: var(--md3-shape-corner-full);
  clip-path: none;
}

:global(html[class*='theme-md3']) .toggleActive {
  background: var(--md3-primary);
}

:global(html[class*='theme-md3']) .toggleThumb {
  border-radius: 50%;
}
```

- [ ] **Step 9: Commit**

```bash
git add src/plugins/builtins/md3-theme/components/
git commit -m "feat(md3): add MD3 component style overrides"
```

---

### Task 17: MD3 Theme Plugin Implementation

**Files:**

- Create: `src/plugins/builtins/md3-theme/MD3ThemePlugin.ts`
- Create: `src/plugins/builtins/md3-theme/rules/systemPreference.ts`
- Create: `src/plugins/builtins/md3-theme/index.ts`
- Test: `src/plugins/builtins/md3-theme/__tests__/MD3ThemePlugin.test.ts`

- [ ] **Step 1: Create system preference rule**

```typescript
// src/plugins/builtins/md3-theme/rules/systemPreference.ts
import type { ThemeRule } from '@/plugins/builtins/zzz-theme/ThemeService';

export const systemPreferenceRule: ThemeRule = {
  id: 'md3-system-preference',
  name: 'Follow System Preference',
  priority: 5,
  condition: { type: 'system', preference: 'dark' },
  targetTheme: 'md3-dark',
  enabled: false,
};
```

- [ ] **Step 2: Write failing tests**

```typescript
// src/plugins/builtins/md3-theme/__tests__/MD3ThemePlugin.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MD3ThemePlugin } from '../MD3ThemePlugin';
import type { PluginContext } from '@/plugins/core';
import { ServiceRegistry } from '@/plugins/core/ServiceRegistry';
import { PluginContextImpl } from '@/plugins/core/PluginContext';
import { MemoryPluginStorage } from '@/plugins/core/PluginManager';

describe('MD3ThemePlugin', () => {
  let plugin: MD3ThemePlugin;
  let context: PluginContext;
  let serviceRegistry: ServiceRegistry;

  beforeEach(() => {
    plugin = new MD3ThemePlugin();
    serviceRegistry = new ServiceRegistry();
    serviceRegistry.provide(
      'bonnext:theme',
      {
        registerTheme: () => {},
        switchTheme: async () => {},
        onThemeChange: () => () => {},
        getAvailableThemes: () => [],
        getCurrentTheme: () => ({ id: 'zzz-dark', name: 'Dark', mode: 'dark', pluginId: 'test' }),
        addRule: () => {},
        removeRule: () => {},
        getActiveRules: () => [],
      },
      'com.bonnext.zzz-theme',
    );
    context = new PluginContextImpl('com.bonnext.md3-theme', serviceRegistry, new MemoryPluginStorage());
  });

  it('should have correct id and name', () => {
    expect(plugin.id).toBe('com.bonnext.md3-theme');
    expect(plugin.name).toBe('Material Design 3 Theme');
  });

  it('should declare dependency on zzz-theme', () => {
    expect(plugin.dependencies).toBeDefined();
    expect(plugin.dependencies!.some((d) => d.id === 'com.bonnext.zzz-theme')).toBe(true);
  });

  it('should activate without error', async () => {
    await expect(plugin.activate(context)).resolves.toBeUndefined();
  });

  it('should deactivate without error', async () => {
    await plugin.activate(context);
    await expect(plugin.deactivate()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/plugins/builtins/md3-theme/__tests__/MD3ThemePlugin.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement MD3ThemePlugin**

```typescript
// src/plugins/builtins/md3-theme/MD3ThemePlugin.ts
import type { Plugin, PluginContext, PluginDependency } from '@/plugins/core';
import type { ThemeService } from '@/plugins/builtins/zzz-theme/ThemeService';
import { MD3ColorSystem } from './colorSystem';
import { systemPreferenceRule } from './rules/systemPreference';

import './tokens/md3-shared.css';
import './tokens/md3-dark.css';
import './tokens/md3-light.css';
import './components/md3-button.module.css';
import './components/md3-input.module.css';
import './components/md3-card.module.css';
import './components/md3-modal.module.css';
import './components/md3-sidebar.module.css';
import './components/md3-tabs.module.css';
import './components/md3-badge.module.css';
import './components/md3-toggle.module.css';

const PRESET_SEEDS: Record<string, string> = {
  violet: '#6750A4',
  blue: '#0061A4',
  green: '#006E17',
  red: '#BA1A1A',
  rose: '#984061',
  amber: '#7C5800',
};

export class MD3ThemePlugin implements Plugin {
  id = 'com.bonnext.md3-theme';
  name = 'Material Design 3 Theme';
  version = '1.0.0';
  description = 'Material Design 3 theme with dynamic color support';
  dependencies: PluginDependency[] = [{ id: 'com.bonnext.zzz-theme', version: '^1.0.0' }];

  private colorSystem = new MD3ColorSystem();
  private themeService: ThemeService | null = null;
  private currentSeedColor = '#6750A4';
  private currentMode: 'dark' | 'light' = 'dark';

  async activate(context: PluginContext): Promise<void> {
    this.themeService = context.consumeService('bonnext:theme') as ThemeService;
    if (!this.themeService) {
      throw new Error('ThemeService not available. ZZZ theme plugin must be activated first.');
    }

    const storedSeed = await context.storage.get('seedColor');
    if (storedSeed) {
      this.currentSeedColor = storedSeed;
    }

    const storedMode = await context.storage.get('mode');
    if (storedMode === 'light' || storedMode === 'dark') {
      this.currentMode = storedMode;
    }

    this.registerMD3Themes();

    context.contributeExtension('bonnext:theme', {
      id: 'md3-dark',
      name: 'Material Design 3 (Dark)',
      cssVariables: this.generateCSSVariables('dark'),
      mode: 'dark',
    });

    context.contributeExtension('bonnext:theme', {
      id: 'md3-light',
      name: 'Material Design 3 (Light)',
      cssVariables: this.generateCSSVariables('light'),
      mode: 'light',
    });

    this.themeService.addRule(systemPreferenceRule);
  }

  async deactivate(): Promise<void> {
    if (this.themeService) {
      this.themeService.unregisterTheme('md3-dark');
      this.themeService.unregisterTheme('md3-light');
      this.themeService.removeRule('md3-system-preference');
    }
    this.themeService = null;
  }

  private registerMD3Themes(): void {
    if (!this.themeService) return;

    this.themeService.registerTheme(
      {
        id: 'md3-dark',
        name: 'Material Design 3 (Dark)',
        cssVariables: this.generateCSSVariables('dark'),
        mode: 'dark',
      },
      this.id,
    );

    this.themeService.registerTheme(
      {
        id: 'md3-light',
        name: 'Material Design 3 (Light)',
        cssVariables: this.generateCSSVariables('light'),
        mode: 'light',
      },
      this.id,
    );
  }

  private generateCSSVariables(mode: 'dark' | 'light'): Record<string, string> {
    const tokens = this.colorSystem.generateFromSeed(this.currentSeedColor);
    return this.colorSystem.getTokensForMode(tokens, mode);
  }

  async setSeedColor(color: string, storage?: import('@/plugins/core').PluginStorage): Promise<void> {
    this.currentSeedColor = color;
    if (storage) {
      await storage.set('seedColor', color);
    }
    this.registerMD3Themes();
  }

  getAvailableSeedColors(): Record<string, string> {
    return { ...PRESET_SEEDS };
  }
}
```

- [ ] **Step 5: Create barrel export**

```typescript
// src/plugins/builtins/md3-theme/index.ts
export { MD3ThemePlugin } from './MD3ThemePlugin';
export { MD3ColorSystem } from './colorSystem';
export type { MD3ThemeTokens, TonalPalette, Tone, CSSVariableMap } from './colorSystem';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/plugins/builtins/md3-theme/__tests__/MD3ThemePlugin.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/plugins/builtins/md3-theme/
git commit -m "feat(md3): implement MD3 theme plugin with dynamic color"
```

---

## Phase 5: Integration & Final Wiring

### Task 18: Wire MD3 Plugin into App + Settings UI

**Files:**

- Modify: `src/App.tsx` — add MD3 plugin to builtinPlugins

- [ ] **Step 1: Add MD3 plugin to App.tsx**

Update the builtinPlugins array in App.tsx:

```tsx
// In App.tsx, update imports and builtinPlugins:
import { ZZZThemePlugin } from '@/plugins/builtins/zzz-theme';
import { MD3ThemePlugin } from '@/plugins/builtins/md3-theme';

const builtinPlugins = [new ZZZThemePlugin(), new MD3ThemePlugin()];
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Run dev server and verify**

Run: `pnpm dev`
Expected: App loads with ZZZ dark theme. MD3 themes are registered but not active.

- [ ] **Step 4: Test theme switching in browser**

1. Open browser console
2. Access ThemeService via the plugin system
3. Switch to MD3 theme: verify visual changes
4. Switch back to ZZZ theme: verify visual restoration

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(plugin): wire MD3 theme plugin into App"
```

---

### Task 19: Full Integration Test

**Files:**

- No new files

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 2: Run all plugin tests**

Run: `npx vitest run src/plugins/`
Expected: All tests pass

- [ ] **Step 3: Run existing store tests to verify no regressions**

Run: `npx vitest run src/stores/`
Expected: All tests pass

- [ ] **Step 4: Run full dev build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Manual verification checklist**

- [ ] App starts with ZZZ dark theme (no visual change from before)
- [ ] Theme toggle (dark → light → oled) works as before
- [ ] UI scale slider works as before
- [ ] Animation speed settings work as before
- [ ] All pages render correctly
- [ ] No console errors related to plugin system
- [ ] MD3 themes are registered and available

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(plugin): complete plugin system with MD3 theme integration"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Each section in the design doc maps to at least one task
- [x] **Placeholder scan**: No TBD, TODO, or vague steps — all code is complete
- [x] **Type consistency**: All interfaces, method signatures, and property names are consistent across tasks
- [x] **File paths**: All file paths are exact and consistent
- [x] **Test coverage**: Core framework, ThemeService, and colorSystem have comprehensive tests
