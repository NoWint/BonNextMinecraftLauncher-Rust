import React from 'react';
import { StatusDot } from '../ui/Status';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  label: string;
}

interface SidebarProps {
  navItems: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  username?: string;
  accountType?: string;
  playtimeHours?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  navItems,
  activeId,
  onNavigate,
  username = 'Player',
  accountType = 'OFFLINE',
  playtimeHours = 0,
}) => {
  const mainItems = navItems.filter((item) => !['settings'].includes(item.id));
  const settingsItem = navItems.find((item) => item.id === 'settings');

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebar__logo}>
        <div className={styles.sidebar__logoIcon} />
        <span className={styles.sidebar__logoText}>BONNEXT</span>
        <span className={styles.sidebar__logoVersion}>v0.1</span>
      </div>

      <div className={styles.sidebar__signal}>
        <StatusDot status="ready" />
        <span className={styles.sidebar__signalText}>SIGNAL · ON AIR</span>
      </div>

      <nav className={styles.sidebar__nav}>
        {mainItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.sidebar__navItem} ${
              activeId === item.id ? styles['sidebar__navItem--active'] : ''
            }`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}

        {settingsItem && (
          <>
            <div className={styles.sidebar__navDivider} />
            <button
              className={`${styles.sidebar__navItem} ${
                activeId === settingsItem.id ? styles['sidebar__navItem--active'] : ''
              }`}
              onClick={() => onNavigate(settingsItem.id)}
            >
              {settingsItem.label}
            </button>
          </>
        )}
      </nav>

      <div className={styles.sidebar__spacer} />

      <div className={styles.sidebar__playtime}>
        <div className={styles.sidebar__playtimeLabel}>TODAY</div>
        <div>
          <span className={styles.sidebar__playtimeValue}>{playtimeHours.toFixed(1)}</span>
          <span className={styles.sidebar__playtimeUnit}>小时</span>
        </div>
      </div>

      <div className={styles.sidebar__bottom}>
        <div className={styles.sidebar__user}>
          <div className={styles.sidebar__userAvatar}>👤</div>
          <div>
            <div className={styles.sidebar__userName}>{username}</div>
            <div className={styles.sidebar__userType}>{accountType}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
