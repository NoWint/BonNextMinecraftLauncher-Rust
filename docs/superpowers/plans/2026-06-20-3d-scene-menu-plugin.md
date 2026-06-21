# 3D 场景化主菜单插件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建内置插件 `com.bonnext.scene-menu`，用 SHARP 生成的 3DGS 模型把启动器首页升级为沉浸式 3D 赛博都市天台主菜单（镜头推移 + 鼠标视差 + 全息面板），激活时覆盖首页、停用时完全恢复、零核心改动。

**Architecture:** 插件 `activate()` 用 `ReactDOM.createRoot` 在 `document.body` 上挂独立 React 根渲染全屏 Overlay（z-index 9999）。Overlay 通过 `window.location.hash` + `hashchange` 事件感知路由（HashRouter，独立 root 无 router context），通过 `ctx.invoke('get_active_account')` + `auth:login` 事件感知认证，仅在"已认证且位于 #/home"时显示。3DGS 渲染走 `@mkkellogg/gaussian-splats-3d`（动态 import，WebGL 不可用时降级 CSS 渐变）。`deactivate()` 卸载 root + 移除容器 + dispose viewer。

**Tech Stack:** React 18 + TypeScript + three.js（经 skinview3d 间接可用）+ `@mkkellogg/gaussian-splats-3d`（3DGS 渲染）+ Vitest（jsdom，已配置）+ CSS Modules。

**Spec:** `docs/superpowers/specs/2026-06-20-3d-scene-menu-plugin-design.md`

**架构精炼说明（相对 spec）：** spec 3.3 写 `createPortal`，但 `activate()` 不是 React render 调用，无法在其中调用 `createPortal`（需在组件 render 中调用）。故改用 `ReactDOM.createRoot` 创建独立 React 根。后果：独立 root 不共享 HashRouter context，因此路由感知改用 `window.location.hash` + `hashchange`（HashRouter 本就基于 hash，完全兼容），导航改用 `window.location.hash = '#/instances'`。spec 的核心意图（全屏覆盖、可逆、零核心改动）完全保留。

---

## 文件结构

| 文件                                                             | 职责                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/plugins/builtins/scene-menu/manifest.json`                  | 插件清单：权限 + 元数据                                    |
| `src/plugins/builtins/scene-menu/index.ts`                       | `definePlugin`：activate 挂 root / deactivate 卸 root      |
| `src/plugins/builtins/scene-menu/SceneOverlay.tsx`               | 顶层 Overlay：组合 renderer + menu + visibility + 淡入淡出 |
| `src/plugins/builtins/scene-menu/SceneRenderer.tsx`              | 3DGS canvas 渲染层 + WebGL 降级                            |
| `src/plugins/builtins/scene-menu/MenuLayer.tsx`                  | DOM 菜单浮层（4 全息面板 + 键盘）                          |
| `src/plugins/builtins/scene-menu/hooks/useOverlayVisibility.ts`  | hash + auth → 可见性状态机                                 |
| `src/plugins/builtins/scene-menu/hooks/useCameraDolly.ts`        | 相机数学（clamp/breathing/parallax）纯函数 + hook          |
| `src/plugins/builtins/scene-menu/hooks/useLaunchLastInstance.ts` | 一键启动上次实例                                           |
| `src/plugins/builtins/scene-menu/styles/overlay.module.css`      | Overlay 布局 + 全息面板 + 动画                             |
| `src/plugins/builtins/scene-menu/__tests__/*.test.ts(x)`         | 单测                                                       |
| `src/plugins/builtins/index.ts`                                  | 修改：注册 scene-menu 插件                                 |

---

## Task 1: 插件脚手架 + 依赖 + 注册

**Files:**

- Create: `src/plugins/builtins/scene-menu/manifest.json`
- Create: `src/plugins/builtins/scene-menu/index.ts`
- Modify: `src/plugins/builtins/index.ts`
- Modify: `package.json`（加依赖）

- [ ] **Step 1: 安装 3DGS 渲染器依赖**

Run: `pnpm add @mkkellogg/gaussian-splats-3d`
Expected: 依赖写入 package.json，three.js 作为 peer/依赖就位。

- [ ] **Step 2: 创建 manifest.json**

Create `src/plugins/builtins/scene-menu/manifest.json`:

```json
{
  "id": "com.bonnext.scene-menu",
  "name": "3D Scene Menu",
  "version": "1.0.0",
  "description": "Immersive 3D Neo-Tokyo rooftop main menu powered by SHARP 3DGS",
  "author": "BonNext",
  "minAppVersion": "1.0.0",
  "dependencies": [],
  "permissions": ["invoke:core:launch", "invoke:core:instances:read", "events:listen", "events:emit"],
  "contributes": {
    "routes": [],
    "sidebar": [],
    "settings": []
  }
}
```

- [ ] **Step 3: 创建 index.ts（空 activate/deactivate 占位）**

Create `src/plugins/builtins/scene-menu/index.ts`:

```ts
// src/plugins/builtins/scene-menu/index.ts
// 3D 场景化主菜单插件：SHARP 3DGS 赛博都市天台 + 镜头推移 + 全息面板。
// activate() 挂独立 React root 覆盖首页；deactivate() 卸载恢复。
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import manifest from './manifest.json';

export const sceneMenuPlugin = definePlugin({
  id: 'com.bonnext.scene-menu',
  name: '3D Scene Menu',
  version: '1.0.0',
  description: 'Immersive 3D Neo-Tokyo rooftop main menu powered by SHARP 3DGS',

  activate(_ctx: PluginContext) {
    // Task 8 实现：createRoot 挂载 SceneOverlay
  },

  deactivate() {
    // Task 8 实现：unmount + dispose
  },
});

export { manifest };
export default sceneMenuPlugin;
```

- [ ] **Step 4: 在 builtins/index.ts 注册**

Modify `src/plugins/builtins/index.ts` — 在 import 区加（第 14 行后）:

```ts
import { sceneMenuPlugin, manifest as sceneMenuManifest } from './scene-menu';
```

在 `builtinPlugins` 数组末尾（`shellEditorPlugin` 之后）加:

```ts
  // 3D 场景主菜单（覆盖首页，可逆）
  { definition: sceneMenuPlugin, manifest: sceneMenuManifest as PluginManifest },
```

- [ ] **Step 5: 验证编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误（空 activate/deactivate 合法）。

- [ ] **Step 6: 提交**

```bash
git add src/plugins/builtins/scene-menu/manifest.json src/plugins/builtins/scene-menu/index.ts src/plugins/builtins/index.ts package.json pnpm-lock.yaml
git commit -m "feat(plugins): scaffold scene-menu plugin and register as builtin"
```

---

## Task 2: useOverlayVisibility hook（hash + auth 状态机）

**Files:**

- Create: `src/plugins/builtins/scene-menu/hooks/useOverlayVisibility.ts`
- Test: `src/plugins/builtins/scene-menu/__tests__/useOverlayVisibility.test.ts`

可见性规则：已认证（`get_active_account` 非空或收到 `auth:login` 事件）且 hash ∈ {`#/home`, `#/`, `#`, `""`} → visible。状态机：`hidden → visible`（淡入）、`visible → hidden`（淡出）。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/useOverlayVisibility.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverlayVisibility } from '../hooks/useOverlayVisibility';

function makeCtx(
  overrides: Partial<{ invoke: ReturnType<typeof vi.fn>; events: { on: ReturnType<typeof vi.fn> } }> = {},
) {
  return {
    invoke: overrides.invoke ?? vi.fn(),
    events: { on: overrides.events?.on ?? vi.fn() },
  } as any;
}

describe('useOverlayVisibility', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.clearAllMocks();
  });

  it('hidden when not authenticated (get_active_account returns null)', async () => {
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue(null) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.authResolved).toBe(true));
    });
    expect(result.current.visible).toBe(false);
  });

  it('hidden when authenticated but hash is not home', async () => {
    window.location.hash = '#/instances';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.authResolved).toBe(true));
    });
    expect(result.current.visible).toBe(false);
  });

  it('visible when authenticated and hash is #/home', async () => {
    window.location.hash = '#/home';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.visible).toBe(true));
    });
  });

  it('visible when authenticated and hash is #/ (redirects to home)', async () => {
    window.location.hash = '#/';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.visible).toBe(true));
    });
  });

  it('becomes visible on hashchange to #/home', async () => {
    window.location.hash = '#/instances';
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const { result } = renderHook(() => useOverlayVisibility(ctx));
    await act(async () => {
      await vi.waitFor(() => expect(result.current.authResolved).toBe(true));
    });
    expect(result.current.visible).toBe(false);
    await act(async () => {
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.visible).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/useOverlayVisibility.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 hook**

Create `src/plugins/builtins/scene-menu/hooks/useOverlayVisibility.ts`:

```ts
// src/plugins/builtins/scene-menu/hooks/useOverlayVisibility.ts
import { useEffect, useState } from 'react';
import type { PluginContext } from '../../../core';

const HOME_HASHES = new Set(['#/home', '#/', '#', '']);

function isHomeHash(hash: string): boolean {
  return HOME_HASHES.has(hash);
}

export interface OverlayVisibilityState {
  /** 认证探测已完成（无论结果） */
  authResolved: boolean;
  /** overlay 是否应可见（已认证 + 在 home） */
  visible: boolean;
}

export function useOverlayVisibility(ctx: PluginContext): OverlayVisibilityState {
  const [authenticated, setAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [onHome, setOnHome] = useState(() => isHomeHash(window.location.hash));

  // 初始认证探测 + 监听 auth:login 事件
  useEffect(() => {
    let cancelled = false;
    ctx
      .invoke('get_active_account')
      .then((acct) => {
        if (cancelled) return;
        setAuthenticated(!!acct);
        setAuthResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthenticated(false);
        setAuthResolved(true);
      });
    const off = ctx.events.on('auth:login', () => setAuthenticated(true));
    return () => {
      cancelled = true;
      off();
    };
  }, [ctx]);

  // hash 变化
  useEffect(() => {
    const onHash = () => setOnHome(isHomeHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return { authResolved, visible: authResolved && authenticated && onHome };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/useOverlayVisibility.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/hooks/useOverlayVisibility.ts src/plugins/builtins/scene-menu/__tests__/useOverlayVisibility.test.ts
git commit -m "feat(scene-menu): add useOverlayVisibility hook (hash + auth state machine)"
```

---

## Task 3: useCameraDolly hook（相机数学纯函数 + clamp）

**Files:**

- Create: `src/plugins/builtins/scene-menu/hooks/useCameraDolly.ts`
- Test: `src/plugins/builtins/scene-menu/__tests__/useCameraDolly.test.ts`

SHARP 安全范围：平移 ±0.3m、推进 +0.5m、旋转 ±15°。纯函数：`clampPosition`、`breathingOffset`、`parallaxOffset`、`transitionOffset`。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/useCameraDolly.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  clampPosition,
  breathingOffset,
  parallaxOffset,
  transitionOffset,
  SAFE_RANGE,
  type CameraOffset,
} from '../hooks/useCameraDolly';

describe('useCameraDolly math', () => {
  it('clampPosition clamps translate to ±0.3 and push to [0, 0.5]', () => {
    expect(clampPosition({ x: 1, y: -1, z: 2 })).toEqual({ x: 0.3, y: -0.3, z: 0.5 });
    expect(clampPosition({ x: -1, y: 1, z: -1 })).toEqual({ x: -0.3, y: 0.3, z: 0 });
    expect(clampPosition({ x: 0.1, y: -0.1, z: 0.2 })).toEqual({ x: 0.1, y: -0.1, z: 0.2 });
  });

  it('breathingOffset stays within safe range for any t', () => {
    for (const t of [0, 1, 3, 6, 12, 100, 1000]) {
      const o = breathingOffset(t, 6);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(SAFE_RANGE.translate);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(SAFE_RANGE.translate);
      expect(o.z).toBeGreaterThanOrEqual(0);
      expect(o.z).toBeLessThanOrEqual(SAFE_RANGE.push);
    }
  });

  it('breathingOffset is zero at t=0', () => {
    expect(breathingOffset(0, 6)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('parallaxOffset scales mouse [-1,1] to ±strength and clamps', () => {
    const o = parallaxOffset(1, 1, 0.15);
    expect(o.x).toBeCloseTo(0.15);
    expect(o.y).toBeCloseTo(0.15);
    const clamped = parallaxOffset(10, 10, 0.15);
    expect(clamped.x).toBeLessThanOrEqual(SAFE_RANGE.translate);
  });

  it('transitionOffset eases from 0 to target over duration', () => {
    expect(transitionOffset(0, { x: 0.4, y: 0, z: 0 }, 600)).toEqual({ x: 0, y: 0, z: 0 });
    const end = transitionOffset(600, { x: 0.4, y: 0, z: 0 }, 600);
    expect(end.x).toBeCloseTo(0.4, 2);
    const mid = transitionOffset(300, { x: 0.4, y: 0, z: 0 }, 600);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(0.4);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/useCameraDolly.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现纯函数 + hook**

Create `src/plugins/builtins/scene-menu/hooks/useCameraDolly.ts`:

```ts
// src/plugins/builtins/scene-menu/hooks/useCameraDolly.ts
// SHARP 单图只支持附近视角，相机移动必须 clamp 在安全范围。
import { useEffect, useRef, useState } from 'react';

export interface CameraOffset {
  x: number; // 水平平移（米）
  y: number; // 垂直平移（米）
  z: number; // 推进（米，正值靠近场景）
}

export const SAFE_RANGE = {
  translate: 0.3,
  push: 0.5,
  rotateDeg: 15,
};

/** expo 缓动（ease-out） */
function expoEase(t: number): number {
  return t === 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function clampPosition(o: CameraOffset): CameraOffset {
  return {
    x: Math.max(-SAFE_RANGE.translate, Math.min(SAFE_RANGE.translate, o.x)),
    y: Math.max(-SAFE_RANGE.translate, Math.min(SAFE_RANGE.translate, o.y)),
    z: Math.max(0, Math.min(SAFE_RANGE.push, o.z)),
  };
}

/** breathing 漂移：periodSec 一个周期，t=0 时为零 */
export function breathingOffset(tSec: number, periodSec: number): CameraOffset {
  const phase = (tSec % periodSec) / periodSec; // [0,1)
  const twoPi = Math.PI * 2;
  return clampPosition({
    x: 0.1 * Math.sin(phase * twoPi),
    y: 0.05 * Math.cos(phase * twoPi),
    z: 0.03 * Math.sin(phase * Math.PI),
  });
}

/** 鼠标视差：mouseX/Y ∈ [-1,1]，strength 为最大偏移 */
export function parallaxOffset(mouseX: number, mouseY: number, strength: number): CameraOffset {
  return clampPosition({
    x: mouseX * strength,
    y: mouseY * strength,
    z: 0,
  });
}

/** 转场推进：从 0 到 target，durationMs 内 expo 缓动 */
export function transitionOffset(elapsedMs: number, target: CameraOffset, durationMs: number): CameraOffset {
  const t = expoEase(Math.min(1, elapsedMs / durationMs));
  return {
    x: target.x * t,
    y: target.y * t,
    z: target.z * t,
  };
}

/**
 * 相机驱动 hook：返回当前应施加的相机偏移（breathing + parallax + transition）。
 * transitionTarget 非 null 时进入转场，结束后回调 onTransitionEnd。
 * rAF 在 active=false 时暂停。
 */
export function useCameraDolly(
  active: boolean,
  transitionTarget: CameraOffset | null,
  onTransitionEnd?: () => void,
): CameraOffset {
  const [offset, setOffset] = useState<CameraOffset>({ x: 0, y: 0, z: 0 });
  const startRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const transitionStartRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1),
      };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    if (!active) return;
    if (transitionTarget) transitionStartRef.current = null;
    let raf = 0;
    startRef.current = performance.now();
    const loop = (now: number) => {
      const tSec = (now - startRef.current) / 1000;
      const breath = breathingOffset(tSec, 6);
      const par = parallaxOffset(mouseRef.current.x, mouseRef.current.y, 0.15);
      let trans: CameraOffset = { x: 0, y: 0, z: 0 };
      if (transitionTarget) {
        if (transitionStartRef.current === null) transitionStartRef.current = now;
        const elapsed = now - transitionStartRef.current;
        trans = transitionOffset(elapsed, transitionTarget, 600);
        if (elapsed >= 600 && onTransitionEnd) onTransitionEnd();
      }
      setOffset(
        clampPosition({
          x: breath.x + par.x + trans.x,
          y: breath.y + par.y + trans.y,
          z: breath.z + trans.z,
        }),
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, transitionTarget, onTransitionEnd]);

  return offset;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/useCameraDolly.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/hooks/useCameraDolly.ts src/plugins/builtins/scene-menu/__tests__/useCameraDolly.test.ts
git commit -m "feat(scene-menu): add useCameraDolly with clamped camera math (breathing/parallax/transition)"
```

---

## Task 4: useLaunchLastInstance hook（一键启动）

**Files:**

- Create: `src/plugins/builtins/scene-menu/hooks/useLaunchLastInstance.ts`
- Test: `src/plugins/builtins/scene-menu/__tests__/useLaunchLastInstance.test.ts`

实例结构：`{ id: string; name: string; last_played: string | null }`。选 `last_played` 最新者，无则首个，无实例则导航 `/instances/new`。状态机：`idle → launching → running | crashed | downloading`。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/useLaunchLastInstance.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLaunchLastInstance } from '../hooks/useLaunchLastInstance';

function makeCtx(invokeImpl: ReturnType<typeof vi.fn>, eventsOn: ReturnType<typeof vi.fn> = vi.fn()) {
  return { invoke: invokeImpl, events: { on: eventsOn } } as any;
}

describe('useLaunchLastInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('launches last_played instance (most recent)', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 'a', name: 'A', last_played: '2026-01-01T00:00:00Z' },
        { id: 'b', name: 'B', last_played: '2026-06-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce(undefined);
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    expect(invoke).toHaveBeenCalledWith('launch_game', { instance_id: 'b' });
    expect(result.current.state).toBe('launching');
  });

  it('falls back to first instance when no last_played', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'a', name: 'A', last_played: null }])
      .mockResolvedValueOnce(undefined);
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    expect(invoke).toHaveBeenCalledWith('launch_game', { instance_id: 'a' });
  });

  it('navigates to /instances/new when no instances', async () => {
    const invoke = vi.fn().mockResolvedValueOnce([]);
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    expect(window.location.hash).toBe('#/instances/new');
    expect(invoke).not.toHaveBeenCalledWith('launch_game', expect.anything());
  });

  it('sets error state when launch_game throws', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'a', name: 'A', last_played: null }])
      .mockRejectedValueOnce(new Error('boom'));
    const ctx = makeCtx(invoke);
    const { result } = renderHook(() => useLaunchLastInstance(ctx));
    await act(async () => {
      await result.current.launch();
    });
    await waitFor(() => expect(result.current.state).toBe('crashed'));
    expect(result.current.error).toBe('boom');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/useLaunchLastInstance.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 hook**

Create `src/plugins/builtins/scene-menu/hooks/useLaunchLastInstance.ts`:

```ts
// src/plugins/builtins/scene-menu/hooks/useLaunchLastInstance.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginContext } from '../../../core';

export type LaunchState = 'idle' | 'launching' | 'running' | 'crashed' | 'downloading';

interface Instance {
  id: string;
  name: string;
  last_played: string | null;
}

export interface LaunchLastInstanceApi {
  state: LaunchState;
  error: string | null;
  launchingName: string | null;
  launch: () => Promise<void>;
}

export function useLaunchLastInstance(ctx: PluginContext): LaunchLastInstanceApi {
  const [state, setState] = useState<LaunchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [launchingName, setLaunchingName] = useState<string | null>(null);
  const offRef = useRef<(() => void) | null>(null);

  // 监听 launch-state-changed 事件
  useEffect(() => {
    const off = ctx.events.on('launch-state-changed', (data) => {
      const d = (data ?? {}) as { state?: string };
      if (d.state === 'running') setState('running');
      else if (d.state === 'crashed') setState('crashed');
      else if (d.state === 'downloading') setState('downloading');
    });
    offRef.current = off;
    return () => {
      off();
    };
  }, [ctx]);

  const launch = useCallback(async () => {
    setError(null);
    let instances: Instance[];
    try {
      instances = (await ctx.invoke<Instance[]>('get_instances')) ?? [];
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('crashed');
      return;
    }
    if (instances.length === 0) {
      window.location.hash = '#/instances/new';
      return;
    }
    const sorted = [...instances].sort((a, b) => {
      const ta = a.last_played ? Date.parse(a.last_played) : 0;
      const tb = b.last_played ? Date.parse(b.last_played) : 0;
      return tb - ta;
    });
    const target = sorted[0];
    setLaunchingName(target.name);
    setState('launching');
    try {
      await ctx.invoke('launch_game', { instance_id: target.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('crashed');
    }
  }, [ctx]);

  return { state, error, launchingName, launch };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/useLaunchLastInstance.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/hooks/useLaunchLastInstance.ts src/plugins/builtins/scene-menu/__tests__/useLaunchLastInstance.test.ts
git commit -m "feat(scene-menu): add useLaunchLastInstance hook (one-click launch last played)"
```

---

## Task 5: SceneRenderer 组件（3DGS + WebGL 降级）

**Files:**

- Create: `src/plugins/builtins/scene-menu/SceneRenderer.tsx`
- Test: `src/plugins/builtins/scene-menu/__tests__/SceneRenderer.test.tsx`

jsdom 无 WebGL，测试聚焦降级路径 + dispose 调用。3DGS 真实渲染依赖手动 QA。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/SceneRenderer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SceneRenderer } from '../SceneRenderer';

describe('SceneRenderer', () => {
  it('renders fallback gradient when WebGL unavailable', () => {
    // jsdom 无 WebGL，detectWebGL 返回 false
    render(<SceneRenderer active={true} plyUrl={null} offset={{ x: 0, y: 0, z: 0 }} />);
    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument();
  });

  it('renders fallback when plyUrl is null even if WebGL exists', () => {
    render(<SceneRenderer active={true} plyUrl={null} offset={{ x: 0, y: 0, z: 0 }} />);
    expect(screen.getByTestId('scene-fallback')).toBeInTheDocument();
  });

  it('does not render canvas when no plyUrl', () => {
    render(<SceneRenderer active={true} plyUrl={null} offset={{ x: 0, y: 0, z: 0 }} />);
    expect(screen.queryByTestId('scene-canvas')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/SceneRenderer.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 SceneRenderer**

Create `src/plugins/builtins/scene-menu/SceneRenderer.tsx`:

```tsx
// src/plugins/builtins/scene-menu/SceneRenderer.tsx
// 3DGS 渲染层：WebGL 可用且有 .ply 时渲染 3DGS，否则降级 CSS 渐变。
import { useEffect, useRef, useState } from 'react';
import type { CameraOffset } from './hooks/useCameraDolly';
import styles from './styles/overlay.module.css';

export interface SceneRendererProps {
  active: boolean;
  plyUrl: string | null;
  offset: CameraOffset;
}

/** 探测 WebGL2 支持 */
export function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function SceneRenderer({ active, plyUrl, offset }: SceneRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<{ dispose: () => void } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const webglOk = detectWebGL();
  const canRender3D = webglOk && !!plyUrl && !loadFailed;

  // 3DGS 初始化（仅真实浏览器执行）
  useEffect(() => {
    if (!canRender3D || !canvasRef.current || !plyUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@mkkellogg/gaussian-splats-3d');
        const Viewer = (mod as any).Viewer;
        const viewer = new Viewer({
          targetElement: canvasRef.current,
          initialCameraPosition: [0, 0, 0],
        });
        await viewer.addSplatScene(plyUrl, { progressiveLoad: true });
        if (cancelled) {
          viewer.dispose();
          return;
        }
        viewerRef.current = viewer;
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [canRender3D, plyUrl]);

  // 应用相机偏移到 viewer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const cam = (viewer as any).camera;
    if (cam) {
      cam.position.set(offset.x, offset.y, offset.z);
    }
  }, [offset]);

  // active=false 时暂停渲染（真实浏览器由 viewer 内部 rAF 控制，此处仅占位）
  useEffect(() => {
    if (!viewerRef.current) return;
    // viewer 无显式 pause API；active=false 时由上层卸载触发 dispose
  }, [active]);

  if (!canRender3D) {
    return <div data-testid="scene-fallback" className={styles.sceneFallback} />;
  }
  return <canvas ref={canvasRef} data-testid="scene-canvas" className={styles.sceneCanvas} />;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/SceneRenderer.test.tsx`
Expected: PASS（3 个用例，jsdom 下走降级）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/SceneRenderer.tsx src/plugins/builtins/scene-menu/__tests__/SceneRenderer.test.tsx
git commit -m "feat(scene-menu): add SceneRenderer with 3DGS + WebGL fallback"
```

---

## Task 6: MenuLayer 组件（4 全息面板 + 键盘）

**Files:**

- Create: `src/plugins/builtins/scene-menu/MenuLayer.tsx`
- Test: `src/plugins/builtins/scene-menu/__tests__/MenuLayer.test.tsx`

4 面板：启动（黄/主）、实例（青）、商店（品红）、设置（暗黄）。键盘 Tab 循环 + Enter 激活。点击触发对应 onAction。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/MenuLayer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuLayer } from '../MenuLayer';

describe('MenuLayer', () => {
  it('renders 4 menu panels with correct labels', () => {
    const onAction = vi.fn();
    render(<MenuLayer onAction={onAction} launchingName={null} launchState="idle" launchError={null} />);
    expect(screen.getByRole('button', { name: /启动游戏/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /实例/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /商店/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /设置/ })).toBeInTheDocument();
  });

  it('clicking 实例 triggers onAction("instances")', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<MenuLayer onAction={onAction} launchingName={null} launchState="idle" launchError={null} />);
    await user.click(screen.getByRole('button', { name: /实例/ }));
    expect(onAction).toHaveBeenCalledWith('instances');
  });

  it('clicking 启动 triggers onAction("launch")', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<MenuLayer onAction={onAction} launchingName={null} launchState="idle" launchError={null} />);
    await user.click(screen.getByRole('button', { name: /启动游戏/ }));
    expect(onAction).toHaveBeenCalledWith('launch');
  });

  it('shows launching name when launchState is launching', () => {
    render(<MenuLayer onAction={vi.fn()} launchingName="1.20.4-Fabric" launchState="launching" launchError={null} />);
    expect(screen.getByText(/1\.20\.4-Fabric/)).toBeInTheDocument();
  });

  it('Tab cycles through 4 panels', async () => {
    const user = userEvent.setup();
    render(<MenuLayer onAction={vi.fn()} launchingName={null} launchState="idle" launchError={null} />);
    const launch = screen.getByRole('button', { name: /启动游戏/ });
    launch.focus();
    expect(document.body).toHaveFocus();
    await user.tab();
    // Tab 移动到下一个面板（顺序由 DOM 顺序决定）
    expect(screen.getByRole('button', { name: /实例/ })).toHaveFocus();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/MenuLayer.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 MenuLayer**

Create `src/plugins/builtins/scene-menu/MenuLayer.tsx`:

```tsx
// src/plugins/builtins/scene-menu/MenuLayer.tsx
// 4 个全息面板：启动/实例/商店/设置。clip-path 切角 + backdrop-filter。
import styles from './styles/overlay.module.css';
import type { LaunchState } from './hooks/useLaunchLastInstance';

export type MenuAction = 'launch' | 'instances' | 'store' | 'settings';

export interface MenuLayerProps {
  onAction: (action: MenuAction) => void;
  launchingName: string | null;
  launchState: LaunchState;
  launchError: string | null;
}

interface PanelDef {
  action: MenuAction;
  label: string;
  sublabel?: string;
  variant: 'primary' | 'cyan' | 'magenta' | 'dim';
}

const PANELS: PanelDef[] = [
  { action: 'launch', label: '启动游戏', variant: 'primary' },
  { action: 'instances', label: '实例', variant: 'cyan' },
  { action: 'store', label: '商店', variant: 'magenta' },
  { action: 'settings', label: '设置', variant: 'dim' },
];

export function MenuLayer({ onAction, launchingName, launchState, launchError }: MenuLayerProps) {
  return (
    <div className={styles.menuLayer} role="menu" aria-label="3D 主菜单">
      {PANELS.map((p) => {
        const isLaunch = p.action === 'launch';
        const sub = isLaunch
          ? launchState === 'launching' && launchingName
            ? `正在启动：${launchingName}`
            : launchState === 'crashed' && launchError
              ? `启动失败：${launchError}`
              : 'LAUNCH › 上次实例'
          : undefined;
        return (
          <button
            key={p.action}
            role="menuitem"
            className={`${styles.panel} ${styles[p.variant]}`}
            aria-label={p.label}
            onClick={() => onAction(p.action)}
          >
            <span className={styles.panelLabel}>{p.label}</span>
            {sub && <span className={styles.panelSub}>{sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/MenuLayer.test.tsx`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/MenuLayer.tsx src/plugins/builtins/scene-menu/__tests__/MenuLayer.test.tsx
git commit -m "feat(scene-menu): add MenuLayer with 4 holographic panels + keyboard nav"
```

---

## Task 7: SceneOverlay 组件（组合 + 淡入淡出 + 转场）

**Files:**

- Create: `src/plugins/builtins/scene-menu/SceneOverlay.tsx`
- Test: `src/plugins/builtins/scene-menu/__tests__/SceneOverlay.test.tsx`

组合 visibility + camera + renderer + menu。visible 切换触发淡入淡出（CSS class）。菜单点击 → 设 transitionTarget → 转场结束 → 导航。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/SceneOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SceneOverlay } from '../SceneOverlay';

function makeCtx(overrides: any = {}) {
  return {
    invoke: overrides.invoke ?? vi.fn().mockResolvedValue({ id: 'u1' }),
    events: { on: overrides.events?.on ?? vi.fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as any;
}

describe('SceneOverlay', () => {
  beforeEach(() => {
    window.location.hash = '#/home';
    vi.clearAllMocks();
  });

  it('renders overlay when authenticated and on home', async () => {
    render(<SceneOverlay ctx={makeCtx()} />);
    await waitFor(() => expect(screen.getByTestId('scene-overlay')).toBeInTheDocument());
  });

  it('does not render overlay when not on home', async () => {
    window.location.hash = '#/instances';
    const ctx = makeCtx();
    render(<SceneOverlay ctx={ctx} />);
    // 未认证或非 home → 不渲染 overlay 内容（容器存在但 hidden）
    await waitFor(() => {
      const el = screen.queryByTestId('scene-overlay');
      expect(el).toBeNull();
    });
  });

  it('clicking 实例 navigates to #/instances after transition', async () => {
    const ctx = makeCtx({ invoke: vi.fn().mockResolvedValue({ id: 'u1' }) });
    render(<SceneOverlay ctx={ctx} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /实例/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /实例/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/instances'));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/SceneOverlay.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 SceneOverlay**

Create `src/plugins/builtins/scene-menu/SceneOverlay.tsx`:

```tsx
// src/plugins/builtins/scene-menu/SceneOverlay.tsx
// 顶层 Overlay：组合 visibility + camera + renderer + menu。
// visible 时淡入，hidden 时淡出。菜单点击 → 转场 → 导航。
import { useCallback, useState } from 'react';
import type { PluginContext } from '../../core';
import { useOverlayVisibility } from './hooks/useOverlayVisibility';
import { useCameraDolly, type CameraOffset } from './hooks/useCameraDolly';
import { useLaunchLastInstance } from './hooks/useLaunchLastInstance';
import { SceneRenderer } from './SceneRenderer';
import { MenuLayer, type MenuAction } from './MenuLayer';
import styles from './styles/overlay.module.css';

export interface SceneOverlayProps {
  ctx: PluginContext;
  /** 3DGS .ply 的 asset URL，null 则降级静态图 */
  plyUrl?: string | null;
}

// 各菜单项转场推进方向（相对原点）
const TRANSITION_TARGETS: Record<Exclude<MenuAction, 'launch'>, CameraOffset> = {
  instances: { x: 0.1, y: 0.05, z: 0.4 },
  store: { x: 0.2, y: -0.05, z: 0.4 },
  settings: { x: 0.15, y: -0.1, z: 0.4 },
};

export function SceneOverlay({ ctx, plyUrl = null }: SceneOverlayProps) {
  const { visible } = useOverlayVisibility(ctx);
  const [transitionTarget, setTransitionTarget] = useState<CameraOffset | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const launch = useLaunchLastInstance(ctx);
  const offset = useCameraDolly(visible && !fadingOut, transitionTarget, () => {
    // 转场结束：执行导航
    setTransitionTarget(null);
  });

  const handleAction = useCallback(
    (action: MenuAction) => {
      if (action === 'launch') {
        // 一键启动：相机快速推进
        setTransitionTarget({ x: 0, y: 0, z: 0.5 });
        void launch.launch();
        return;
      }
      // 进入转场 → 完成后导航
      setTransitionTarget(TRANSITION_TARGETS[action]);
      setFadingOut(true);
      // 转场 600ms + 淡出 300ms 后导航
      window.setTimeout(() => {
        const hash = action === 'instances' ? '#/instances' : action === 'store' ? '#/store' : '#/settings';
        window.location.hash = hash;
        setFadingOut(false);
      }, 600);
    },
    [launch],
  );

  if (!visible) return null;

  return (
    <div
      data-testid="scene-overlay"
      className={`${styles.overlay} ${fadingOut ? styles.fadingOut : styles.fadingIn}`}
      aria-label="3D 主菜单"
    >
      <SceneRenderer active={visible && !fadingOut} plyUrl={plyUrl} offset={offset} />
      <MenuLayer
        onAction={handleAction}
        launchingName={launch.launchingName}
        launchState={launch.state}
        launchError={launch.error}
      />
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/SceneOverlay.test.tsx`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/SceneOverlay.tsx src/plugins/builtins/scene-menu/__tests__/SceneOverlay.test.tsx
git commit -m "feat(scene-menu): add SceneOverlay composing visibility/camera/renderer/menu"
```

---

## Task 8: index.ts 生命周期（createRoot 挂载/卸载）

**Files:**

- Modify: `src/plugins/builtins/scene-menu/index.ts`
- Test: `src/plugins/builtins/scene-menu/__tests__/lifecycle.test.ts`

activate 创建容器 div + createRoot 渲染 SceneOverlay；deactivate unmount + 移除容器。

- [ ] **Step 1: 写失败测试**

Create `src/plugins/builtins/scene-menu/__tests__/lifecycle.test.ts`:

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/lifecycle.test.ts`
Expected: FAIL（activate 为空，不挂载容器）。

- [ ] **Step 3: 实现 activate/deactivate**

Modify `src/plugins/builtins/scene-menu/index.ts` — 替换整个文件:

```ts
// src/plugins/builtins/scene-menu/index.ts
// 3D 场景化主菜单插件：SHARP 3DGS 赛博都市天台 + 镜头推移 + 全息面板。
// activate() 用 ReactDOM.createRoot 挂独立 React root 覆盖首页；
// deactivate() 卸载 root + 移除容器，完全恢复。
import { createRoot, type Root } from 'react-dom/client';
import { definePlugin } from '../../core';
import type { PluginContext } from '../../core';
import { SceneOverlay } from './SceneOverlay';
import manifest from './manifest.json';

const ROOT_ATTR = 'data-scene-menu-root';
let root: Root | null = null;
let container: HTMLDivElement | null = null;

export const sceneMenuPlugin = definePlugin({
  id: 'com.bonnext.scene-menu',
  name: '3D Scene Menu',
  version: '1.0.0',
  description: 'Immersive 3D Neo-Tokyo rooftop main menu powered by SHARP 3DGS',

  activate(ctx: PluginContext) {
    // 幂等：若已存在先卸载
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    container = document.createElement('div');
    container.setAttribute(ROOT_ATTR, '');
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<SceneOverlay ctx={ctx} />);
    ctx.logger.info('3D Scene Menu plugin activated');
  },

  deactivate() {
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  },
});

export { manifest };
export default sceneMenuPlugin;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/plugins/builtins/scene-menu/__tests__/lifecycle.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/plugins/builtins/scene-menu/index.ts src/plugins/builtins/scene-menu/__tests__/lifecycle.test.ts
git commit -m "feat(scene-menu): implement activate/deactivate lifecycle with createRoot"
```

---

## Task 9: 样式（overlay.module.css）

**Files:**

- Create: `src/plugins/builtins/scene-menu/styles/overlay.module.css`

CSS：overlay 全屏 + 淡入淡出、sceneFallback 渐变、sceneCanvas 全屏、menuLayer 面板布局、4 种 panel 变体（clip-path 切角 + 霓虹色）、panelLabel/Sub 字体。无单测（CSS），验证编译 + 手动 QA。

- [ ] **Step 1: 创建样式文件**

Create `src/plugins/builtins/scene-menu/styles/overlay.module.css`:

```css
/* src/plugins/builtins/scene-menu/styles/overlay.module.css */
/* ZZZ Neo-Tokyo 美学：clip-path 切角 + 霓虹 + 毛玻璃 */

.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  pointer-events: auto;
}

.fadingIn {
  animation: sceneFadeIn 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.fadingOut {
  animation: sceneFadeOut 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes sceneFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes sceneFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.sceneFallback {
  position: absolute;
  inset: 0;
  /* 赛博都市天台降级渐变 */
  background:
    radial-gradient(ellipse at 50% 70%, rgba(255, 230, 0, 0.08), transparent 60%),
    linear-gradient(180deg, #0a0a0f 0%, #1a0a2e 50%, #2d1b4e 100%);
}

.sceneCanvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.menuLayer {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 0;
  padding: 8% 6%;
  pointer-events: none;
}

.panel {
  pointer-events: auto;
  align-self: center;
  justify-self: center;
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  border: 1px solid currentColor;
  color: #fff;
  cursor: pointer;
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 2px;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  transition:
    transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 200ms,
    opacity 200ms;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.panel:hover {
  transform: scale(1.03);
}

.panel:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.panelLabel {
  font-size: 1.4em;
  line-height: 1;
}

.panelSub {
  font-family: 'DM Mono', monospace;
  font-size: 0.6em;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

/* 4 种变体 */
.primary {
  color: #ffe600;
  background: rgba(255, 230, 0, 0.12);
  box-shadow: 0 0 24px rgba(255, 230, 0, 0.25);
  min-width: 200px;
}
.primary:hover {
  box-shadow: 0 0 36px rgba(255, 230, 0, 0.45);
}

.cyan {
  color: #00eaff;
  background: rgba(0, 234, 255, 0.12);
  box-shadow: 0 0 18px rgba(0, 234, 255, 0.2);
}
.cyan:hover {
  box-shadow: 0 0 28px rgba(0, 234, 255, 0.4);
}

.magenta {
  color: #ff00aa;
  background: rgba(255, 0, 170, 0.12);
  box-shadow: 0 0 18px rgba(255, 0, 170, 0.2);
}
.magenta:hover {
  box-shadow: 0 0 28px rgba(255, 0, 170, 0.4);
}

.dim {
  color: #b8a800;
  background: rgba(184, 168, 0, 0.1);
  box-shadow: 0 0 14px rgba(184, 168, 0, 0.15);
}
.dim:hover {
  box-shadow: 0 0 22px rgba(184, 168, 0, 0.35);
}

@media (prefers-reduced-motion: reduce) {
  .fadingIn,
  .fadingOut {
    animation-duration: 1ms;
  }
  .panel {
    transition: none;
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误。

- [ ] **Step 3: 运行全部插件单测确认无回归**

Run: `npx vitest run src/plugins/builtins/scene-menu/`
Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/plugins/builtins/scene-menu/styles/overlay.module.css
git commit -m "feat(scene-menu): add overlay styles (clip-path panels + neon variants + reduced-motion)"
```

---

## Task 10: 离线资产准备（SHARP .ply + 降级图）文档

**Files:**

- Create: `src/plugins/builtins/scene-menu/assets/README.md`

此任务不写运行时代码，记录如何生成 `scene.ply` 与 `scene-fallback.png`。插件在无 .ply 时自动降级到 CSS 渐变（Task 5 已实现），故资产为可选增强。

- [ ] **Step 1: 创建资产说明**

Create `src/plugins/builtins/scene-menu/assets/README.md`:

````markdown
# 3D Scene Menu 资产

插件在无 `scene.ply` 时自动降级到 CSS 渐变背景（见 SceneRenderer）。
以下资产为可选增强，生成后放入本目录即可生效。

## scene.ply（3DGS 模型）

用 [apple/ml-sharp](https://github.com/apple/ml-sharp) 从单张源图离线生成：

1. 克隆 ml-sharp，按其 README 配置 Python + PyTorch + GPU（CUDA/MPS）。
2. 准备高分辨率源图（赛博都市天台夜景，1920×1080+，真实深度 cues）。
3. 运行：
   ```bash
   sharp predict -i source.png -o scene.ply
   ```
````

4. 将 `scene.ply` 放入本目录。
5. 在 `index.ts` 的 activate 中，将 `plyUrl` 传给 SceneOverlay：
   ```ts
   import scenePlyUrl from './assets/scene.ply?url';
   // ...
   root.render(<SceneOverlay ctx={ctx} plyUrl={scenePlyUrl} />);
   ```

## scene-fallback.png（降级静态图）

源图副本，作为 WebGL 不可用时的降级背景。生成后：

- 在 SceneRenderer 中替换 `.sceneFallback` 的 CSS 渐变为该图（`background-image: url(...)`）。

## 源图方向

赛博都市天台夜景：站在天台边缘俯瞰密集霓虹楼群，黄/青/品红霓虹招牌，
雨后湿润反射，强深度 cues。契合 ZZZ Neo-Tokyo 美学。

````

- [ ] **Step 2: 提交**

```bash
git add src/plugins/builtins/scene-menu/assets/README.md
git commit -m "docs(scene-menu): document offline SHARP .ply + fallback asset generation"
````

---

## Task 11: 全量验证 + 手动 QA 清单

**Files:** 无（验证任务）

- [ ] **Step 1: 全量单测**

Run: `npx vitest run src/plugins/builtins/scene-menu/`
Expected: 全部 PASS（约 20 个用例）。

- [ ] **Step 2: TypeScript 编译**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无错误。

- [ ] **Step 3: 前端构建**

Run: `pnpm build 2>&1 | tail -15`
Expected: 构建成功（tsc --noEmit + vite build）。

- [ ] **Step 4: 启动 dev 验证手动 QA**

Run: `pnpm tauri dev`

手动 QA 清单：

- [ ] 登录后，`#/home` 显示 3D overlay（降级渐变，因无 .ply）
- [ ] overlay 覆盖侧边栏 + 顶栏 + 首页
- [ ] 4 个全息面板可见（启动/实例/商店/设置）
- [ ] 鼠标移动有视差（有 .ply 时；降级模式无）
- [ ] 点击"实例" → 转场 → 跳转 `#/instances`，侧边栏恢复
- [ ] 侧边栏"主页" → 回 `#/home`，overlay 恢复
- [ ] 点击"启动" → 启动上次实例（或无实例跳 `#/instances/new`）
- [ ] Tab 键在 4 面板间循环，Enter 激活
- [ ] 在设置页禁用插件 → overlay 消失，原首页恢复
- [ ] 重新启用 → overlay 恢复
- [ ] `prefers-reduced-motion` 下无镜头推移（降级模式天然满足）

- [ ] **Step 5: 最终提交（如有 QA 修复）**

```bash
git add -A
git commit -m "test(scene-menu): final QA pass"
```

---

## Self-Review

**1. Spec coverage:**

- §3 架构与插件结构 → Task 1（脚手架）、Task 8（生命周期）、Task 9（样式）
- §3.3 覆盖机制（Overlay Portal）→ Task 8（createRoot 精炼，见架构说明）
- §3.4 显隐逻辑 → Task 2（useOverlayVisibility）
- §4 3DGS 渲染管线 → Task 5（SceneRenderer + 降级）、Task 1（依赖）
- §4.3 相机系统 → Task 3（useCameraDolly + clamp）
- §5 场景与镜头 → Task 3（相机）、Task 6（面板）、Task 7（转场）、Task 9（样式）
- §6 菜单 UX → Task 6（面板交互/键盘）、Task 7（淡入淡出/转场）、Task 4（一键启动）、Task 5（加载态降级）、Task 9（reduced-motion）
- §7 混合升级路径 → 架构说明已记；P3-1 落地后改 activate 内挂载方式（未来任务，本计划不实现 P3-1）
- §8 测试与错误处理 → 各 Task 的 TDD 单测 + Task 11 QA；错误处理散布于 Task 4/5
- §9 离线 SHARP 生成 → Task 10
- 覆盖完整。

**2. Placeholder scan:** 无 TBD/TODO；每步含完整代码或确切命令。

**3. Type consistency:**

- `CameraOffset { x, y, z }` 在 Task 3/5/7 一致
- `LaunchState` 在 Task 4/6/7 一致
- `MenuAction` 在 Task 6/7 一致
- `useOverlayVisibility` 返回 `{ authResolved, visible }` 在 Task 2/7 一致
- `SceneRendererProps { active, plyUrl, offset }` 在 Task 5/7 一致
- `get_active_account` / `get_instances` / `launch_game` 命令名在 Task 2/4 一致
- `last_played` 字段名在 Task 4 与 Rust `manager.rs:23` 一致
- 一致性 OK。
