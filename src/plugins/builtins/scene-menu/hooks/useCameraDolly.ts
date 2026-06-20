// src/plugins/builtins/scene-menu/hooks/useCameraDolly.ts
// SHARP 单图只支持附近视角，相机移动必须 clamp 在安全范围。
import { useEffect, useRef, useState } from 'react';

export interface CameraOffset {
  x: number; // 水平平移（米）
  y: number; // 垂直平移（米）
  z: number; // 推进（米，正值靠近场景）
}

export const SAFE_RANGE = {
  translate: 0.4,
  push: 0.8,
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
    x: 0.2 * Math.sin(phase * twoPi),
    y: 0.1 * Math.sin(phase * twoPi),
    z: 0.05 * Math.sin(phase * Math.PI),
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
      const par = parallaxOffset(mouseRef.current.x, mouseRef.current.y, 0.25);
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
