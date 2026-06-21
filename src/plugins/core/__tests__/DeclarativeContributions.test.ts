import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyDeclarativeContributions } from '../DeclarativeContributions';
import { componentRegistry } from '../ComponentRegistry';
import type { PluginManifest, PluginContext, PluginLabel } from '../types';

function createMockCtx() {
  const calls: string[] = [];
  const sidebarLabels: PluginLabel[] = [];
  const ctx = {
    pluginId: 'test',
    registerRoute: (path: string) => calls.push(`route:${path}`),
    addSidebarItem: (item: { id: string; label: PluginLabel }) => {
      calls.push(`sidebar:${item.id}`);
      sidebarLabels.push(item.label);
    },
    addSettingsSection: (s: { id: string }) => calls.push(`settings:${s.id}`),
    addContextMenuItem: (i: { id: string }) => calls.push(`context:${i.id}`),
    addInstanceTab: (t: { id: string }) => calls.push(`tab:${t.id}`),
    registerTheme: (t: { id: string }) => calls.push(`theme:${t.id}`),
    invoke: vi.fn(),
    http: {} as never,
    fs: {} as never,
    events: {} as never,
    storage: {} as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as PluginContext;
  return { ctx, calls, sidebarLabels };
}

describe('DeclarativeContributions', () => {
  beforeEach(() => {
    componentRegistry.clear();
  });

  it('should register routes from manifest.contributes', () => {
    componentRegistry.register('TestPage', () => Promise.resolve({ default: () => null as never }));
    const { ctx, calls } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        routes: [{ path: '/test', component: 'TestPage' }],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toContain('route:/test');
  });

  it('should register sidebar items', () => {
    const { ctx, calls } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        sidebar: [{ id: 'test', label: 'Test', icon: '🧪', route: '/test', order: 1 }],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toContain('sidebar:test');
  });

  it('should skip routes with unregistered components', () => {
    const { ctx, calls } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        routes: [{ path: '/missing', component: 'MissingPage' }],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).not.toContain('route:/missing');
  });

  it('should register themes with cssVariables', () => {
    const { ctx, calls } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        themes: [{
          id: 'custom',
          name: 'Custom',
          mode: 'dark',
          cssVariables: { '--accent': '#ff0000' },
        }],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toContain('theme:custom');
  });

  it('should do nothing when manifest has no contributes', () => {
    const { ctx, calls } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test',
      version: '1.0.0',
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toHaveLength(0);
  });

  it('should absolutize relative i18nKey for sidebar labels', () => {
    const { ctx, calls, sidebarLabels } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'com.test.plugin',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        sidebar: [
          { id: 'i18n-item', label: { i18nKey: 'sidebar.store' }, icon: '🛒', route: '/store', order: 1 },
        ],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toContain('sidebar:i18n-item');
    expect(sidebarLabels[0]).toEqual({ i18nKey: 'plugin:com.test.plugin:sidebar.store' });
  });

  it('should keep absolute i18nKey (plugin: prefix) unchanged', () => {
    const { ctx, calls, sidebarLabels } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'com.test.plugin',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        sidebar: [
          { id: 'abs-item', label: { i18nKey: 'plugin:other:sidebar.x' }, icon: '🛒', route: '/x', order: 1 },
        ],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toContain('sidebar:abs-item');
    expect(sidebarLabels[0]).toEqual({ i18nKey: 'plugin:other:sidebar.x' });
  });

  it('should keep string labels unchanged', () => {
    const { ctx, calls, sidebarLabels } = createMockCtx();
    const manifest: PluginManifest = {
      id: 'com.test.plugin',
      name: 'Test',
      version: '1.0.0',
      contributes: {
        sidebar: [
          { id: 'str-item', label: 'Plain String', icon: '🛒', route: '/s', order: 1 },
        ],
      },
    };
    applyDeclarativeContributions(manifest, ctx);
    expect(calls).toContain('sidebar:str-item');
    expect(sidebarLabels[0]).toBe('Plain String');
  });
});
