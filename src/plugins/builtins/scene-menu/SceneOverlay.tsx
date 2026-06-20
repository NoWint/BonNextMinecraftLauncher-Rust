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
