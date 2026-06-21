import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sceneMenuPlugin } from '../index';

function makeCtx(overrides: any = {}) {
  return {
    invoke: overrides.invoke ?? vi.fn().mockResolvedValue({ id: 'u1' }),
    events: { on: overrides.events?.on ?? vi.fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as any;
}

describe('scene-menu plugin lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('activate mounts overlay container to document.body', () => {
    sceneMenuPlugin.activate(makeCtx());
    const container = document.querySelector('[data-scene-menu-root]');
    expect(container).not.toBeNull();
    expect(container?.parentElement).toBe(document.body);
  });

  it('deactivate unmounts and removes container', () => {
    sceneMenuPlugin.activate(makeCtx());
    expect(document.querySelector('[data-scene-menu-root]')).not.toBeNull();
    sceneMenuPlugin.deactivate?.();
    expect(document.querySelector('[data-scene-menu-root]')).toBeNull();
  });

  it('activate is idempotent-safe (second activate replaces container)', () => {
    sceneMenuPlugin.activate(makeCtx());
    sceneMenuPlugin.activate(makeCtx());
    const containers = document.querySelectorAll('[data-scene-menu-root]');
    expect(containers.length).toBe(1);
  });
});
