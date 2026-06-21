// src/plugins/builtins/scene-menu/MenuLayer.tsx
// 4 个全息面板：启动/实例/商店/设置。clip-path 切角 + backdrop-filter。
// 面板跟随相机 dolly 一起移动，仿佛嵌入 3D 场景中。
import styles from './styles/overlay.module.css';
import type { LaunchState } from './hooks/useLaunchLastInstance';
import type { CameraOffset } from './hooks/useCameraDolly';

export type MenuAction = 'launch' | 'instances' | 'store' | 'settings';

export interface MenuLayerProps {
  onAction: (action: MenuAction) => void;
  launchingName: string | null;
  launchState: LaunchState;
  launchError: string | null;
  /** 相机偏移，用于面板视差跟随 */
  offset?: CameraOffset;
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

export function MenuLayer({ onAction, launchingName, launchState, launchError, offset }: MenuLayerProps) {
  // 面板视差 + 3D 透视：按钮默认在远处（translateZ 负值），
  // 运镜推进时拉近（translateZ 增大），模拟按钮在 3D 场景中
  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 0;
  const oz = offset?.z ?? 0;
  // perspective 1200px + translateZ(-500→-100) 使按钮从远处拉近
  const tz = -500 + oz * 400;
  const transform = `perspective(1200px) translate3d(${ox * 50}px, ${oy * 50}px, ${tz}px) scale(${1 + oz * 0.25})`;

  return (
    <div className={styles.menuLayer} role="menu" aria-label="3D 主菜单" style={{ transform }}>
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
