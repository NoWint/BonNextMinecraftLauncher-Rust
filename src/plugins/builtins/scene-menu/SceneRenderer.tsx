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
