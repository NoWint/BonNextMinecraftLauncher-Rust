import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, StoreIcon, InstancesIcon, LibraryIcon, CollectionsIcon, VersionsIcon, ServersIcon, SettingsIcon } from '../icons';
import { ShellSwitcher } from '../../../../shared/components/ShellSwitcher';
import { useResponsive } from '../../hooks/useResponsive';
import { useGlassEffect } from '../../hooks/useGlassEffect';
import styles from './Sidebar.module.css';

interface NavItem { id: string; label: string; path: string; icon: React.ComponentType<{ className?: string; size?: number }>; }

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/home', icon: HomeIcon },
  { id: 'store', label: 'Store', path: '/store', icon: StoreIcon },
  { id: 'instances', label: 'Instances', path: '/instances', icon: InstancesIcon },
  { id: 'library', label: 'Library', path: '/library', icon: LibraryIcon },
  { id: 'collections', label: 'Collections', path: '/collections', icon: CollectionsIcon },
  { id: 'versions', label: 'Versions', path: '/versions', icon: VersionsIcon },
  { id: 'servers', label: 'Servers', path: '/servers', icon: ServersIcon },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
];

interface SidebarProps { username?: string; accountType?: string; }

export function Sidebar({ username, accountType }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isNarrow, sidebarWidth } = useResponsive();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const sidebarRef = useGlassEffect<HTMLElement>('strong');

  return (
    <nav ref={sidebarRef} className={`${styles.sidebar} ${isNarrow ? styles.sidebarCollapsed : ''}`} style={{ width: sidebarWidth }}>
      {/* Drag region for window movement — traffic lights are handled by Tauri natively */}
      <div className={styles.dragRegion} data-tauri-drag-region />
      <div className={styles.sectionLabel}>Favorites</div>
      {NAV_ITEMS.map((item) => (
        <button key={item.id} className={`${styles.navItem} ${isActive(item.path) ? styles.navItemActive : ''}`} onClick={() => navigate(item.path)}>
          <span className={styles.navIcon}><item.icon size={16} /></span>
          <span className={styles.navLabel}>{item.label}</span>
        </button>
      ))}
      <div className={styles.divider} />
      {BOTTOM_ITEMS.map((item) => (
        <button key={item.id} className={`${styles.navItem} ${isActive(item.path) ? styles.navItemActive : ''}`} onClick={() => navigate(item.path)}>
          <span className={styles.navIcon}><item.icon size={16} /></span>
          <span className={styles.navLabel}>{item.label}</span>
        </button>
      ))}
      {username && (
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>{username[0].toUpperCase()}</div>
          <div><div className={styles.userName}>{username}</div><div className={styles.accountType}>{accountType || 'Microsoft'}</div></div>
        </div>
      )}
      <div className={styles.shellSwitcher}>
        <ShellSwitcher />
      </div>
    </nav>
  );
}
