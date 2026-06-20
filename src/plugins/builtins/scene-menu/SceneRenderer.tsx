// src/plugins/builtins/scene-menu/SceneRenderer.tsx
// 3DGS 渲染层：WebGL 可用且有 .ply 时渲染 3DGS，否则降级 CSS 渐变。
// SHARP 使用 OpenCV 约定（y 朝下、z 朝前），three.js 使用 OpenGL 约定（y 朝上、z 朝观察者）。
// 通过 180° X 轴旋转四元数 [1,0,0,0] 翻转 Y 轴，使模型在 three.js 中正向显示。
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CameraOffset } from './hooks/useCameraDolly';
import styles from './styles/overlay.module.css';

export interface SceneRendererProps {
  active: boolean;
  plyUrl: string | null;
  offset: CameraOffset;
}

/** 相机基础位置（three.js 坐标系，z 朝观察者） */
const BASE_CAM_POS: readonly [number, number, number] = [0, 0.2, 2];
/** 相机注视点 */
const CAM_LOOK_AT: readonly [number, number, number] = [0, 0, 0];
/** 相机 FOV（度）— 窄 FOV 减少边缘畸变 + 让模型填满屏幕 */
const CAM_FOV = 40;
/** 加载超时（毫秒） */
const LOAD_TIMEOUT_MS = 30_000;

/** 探测 WebGL2 支持（释放 context 避免泄漏） */
export function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('webgl2');
    if (ctx) {
      const lose = ctx.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
    return !!ctx;
  } catch {
    return false;
  }
}

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

export function SceneRenderer({ active, plyUrl, offset }: SceneRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ dispose: () => void; camera: any } | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const webglOk = useMemo(() => detectWebGL(), []);
  const canRender3D = webglOk && !!plyUrl && loadState !== 'failed';

  // 3DGS 初始化（仅真实浏览器执行）
  useEffect(() => {
    if (!canRender3D || !containerRef.current || !plyUrl) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setLoadState('loading');
    setErrorDetail('');

    (async () => {
      try {
        console.info('[SceneMenu] loading gaussian-splats-3d...');
        const mod = await import('@mkkellogg/gaussian-splats-3d');
        const Viewer = (mod as any).Viewer;
        if (!Viewer) throw new Error('Viewer export not found in gaussian-splats-3d');
        console.info('[SceneMenu] creating Viewer instance...');
        // 检测 Cross-Origin Isolation：vite 配置了 COOP/COEP 头时，
        // self.crossOriginIsolated === true，SharedArrayBuffer 可用，使用最优配置。
        // 否则降级到非共享内存模式（库已 patch 为使用 NonShared WASM 变体）。
        const crossIsolated = typeof self !== 'undefined' && (self as any).crossOriginIsolated === true;
        console.info('[SceneMenu] crossOriginIsolated:', crossIsolated);
        const viewer = new Viewer({
          rootElement: containerRef.current,
          initialCameraPosition: [...BASE_CAM_POS] as [number, number, number],
          initialCameraLookAt: [...CAM_LOOK_AT] as [number, number, number],
          cameraUp: [0, 1, 0],
          selfDrivenMode: true,
          useBuiltInControls: false,
          sharedMemoryForWorkers: crossIsolated,
          enableSIMDInSort: crossIsolated,
          gpuAcceleratedSort: false,
          // 画质提升
          antialiased: true,
          integerBasedSort: false,
          halfPrecisionCovariancesOnGPU: false,
          sceneFadeInRateMultiplier: 5.0,
          sphericalHarmonicsDegree: 2,
        });

        // 调整相机 FOV（库默认 50°，改为 45° 减少边缘畸变）
        const cam = (viewer as any).camera;
        if (cam && cam.isPerspectiveCamera) {
          cam.fov = CAM_FOV;
          cam.updateProjectionMatrix();
        }

        // 启动 self-driven rAF 渲染循环（addSplatScene 不会自动调用 start）
        console.info('[SceneMenu] starting viewer rAF loop...');
        viewer.start();

        console.info('[SceneMenu] loading .ply from', plyUrl);
        // 超时检测
        timeoutId = setTimeout(() => {
          if (!cancelled && viewerRef.current === null) {
            console.error('[SceneMenu] load timed out after', LOAD_TIMEOUT_MS, 'ms');
            try { viewer.dispose(); } catch {}
            if (!cancelled) {
              setLoadState('failed');
              setErrorDetail('Load timed out');
            }
          }
        }, LOAD_TIMEOUT_MS);

        console.info('[SceneMenu] calling addSplatScene...');
        await viewer.addSplatScene(plyUrl, {
          progressiveLoad: false,
          // SHARP OpenCV → OpenGL：180° X 轴旋转翻转 Y 轴
          rotation: [1, 0, 0, 0],
          showLoadingUI: false,
        });
        console.info('[SceneMenu] addSplatScene resolved');
        // 诊断：容器尺寸 + 场景范围
        const el = containerRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          console.info('[SceneMenu] container size:', rect.width, 'x', rect.height);
          const canvas = el.querySelector('canvas');
          if (canvas) {
            console.info('[SceneMenu] inner canvas size:', canvas.width, 'x', canvas.height);
          }
        }
        const splatMesh = (viewer as any).splatMesh;
        if (splatMesh && splatMesh.getSceneCenter) {
          const center = splatMesh.getSceneCenter();
          console.info('[SceneMenu] scene center:', center);
        }

        if (cancelled) {
          viewer.dispose();
          return;
        }
        if (timeoutId) clearTimeout(timeoutId);
        viewerRef.current = viewer;
        setLoadState('ready');
        console.info('[SceneMenu] 3DGS scene loaded successfully');
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error('[SceneMenu] 3DGS load failed:', err);
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) {
          setLoadState('failed');
          setErrorDetail(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [canRender3D, plyUrl]);

  // 应用相机偏移到 viewer：在基础位置上叠加 breathing + parallax + transition
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const cam = (viewer as any).camera;
    if (!cam) return;
    // offset.z 正值 = 推进（靠近场景）= three.js 中 z 减小
    cam.position.set(
      BASE_CAM_POS[0] + offset.x,
      BASE_CAM_POS[1] + offset.y,
      BASE_CAM_POS[2] - offset.z,
    );
    cam.lookAt(CAM_LOOK_AT[0], CAM_LOOK_AT[1], CAM_LOOK_AT[2]);
  }, [offset]);

  // active=false 时暂停渲染（真实浏览器由 viewer 内部 rAF 控制，此处仅占位）
  useEffect(() => {
    if (!viewerRef.current) return;
    // viewer 无显式 pause API；active=false 时由上层卸载触发 dispose
  }, [active]);

  if (!webglOk || !plyUrl || loadState === 'failed') {
    return (
      <div data-testid="scene-fallback" className={styles.sceneFallback}>
        {loadState === 'failed' && errorDetail && (
          <div className={styles.errorOverlay}>
            <span className={styles.errorLabel}>3D LOAD FAILED</span>
            <span className={styles.errorDetail}>{errorDetail}</span>
          </div>
        )}
        {!webglOk && (
          <div className={styles.errorOverlay}>
            <span className={styles.errorLabel}>WEBGL2 UNAVAILABLE</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} data-testid="scene-canvas" className={styles.sceneCanvas} />
      {loadState === 'loading' && (
        <div className={styles.loadingIndicator}>
          <span className={styles.loadingText}>LOADING 3D SCENE</span>
        </div>
      )}
    </>
  );
}
