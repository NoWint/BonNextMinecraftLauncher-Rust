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

// 各菜单项转场推进方向 — 对应按钮在屏幕上的位置（2x2 grid）：
// 启动(左上) 实例(右上) / 商店(左下) 设置(右下)
// x正=右, y正=上, z正=推进
const TRANSITION_TARGETS: Record<Exclude<MenuAction, 'launch'>, CameraOffset> = {
  instances: { x: 0.4, y: 0.2, z: 1.5 },   // 右上 → 相机右上方推进
  store: { x: -0.4, y: -0.2, z: 1.5 },      // 左下 → 相机左下方推进
  settings: { x: 0.4, y: -0.2, z: 1.5 },    // 右下 → 相机右下方推进
};

export function SceneOverlay({ ctx, plyUrl = null }: SceneOverlayProps) {
  const { visible } = useOverlayVisibility(ctx);
  const [transitionTarget, setTransitionTarget] = useState<CameraOffset | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const launch = useLaunchLastInstance(ctx);
  // 不传 onTransitionEnd — 转场结束后保持特写位置，不闪回
  const offset = useCameraDolly(visible && !fadingOut, transitionTarget);

  const handleAction = useCallback(
    (action: MenuAction) => {
      if (action === 'launch') {
        // 一键启动：相机大幅推进
        setTransitionTarget({ x: 0, y: 0, z: 1.8 });
        void launch.launch();
        return;
      }
      // 运镜推进 1000ms → 停留特写 500ms → 淡出 300ms → 导航 1800ms
      setTransitionTarget(TRANSITION_TARGETS[action]);
      window.setTimeout(() => setFadingOut(true), 1500);
      window.setTimeout(() => {
        const hash = action === 'instances' ? '#/instances' : action === 'store' ? '#/store' : '#/settings';
        window.location.hash = hash;
        setFadingOut(false);
        setTransitionTarget(null);
      }, 1800);
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
        offset={offset}
      />
    </div>
  );
}
