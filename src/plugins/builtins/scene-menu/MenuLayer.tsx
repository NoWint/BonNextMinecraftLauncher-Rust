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
