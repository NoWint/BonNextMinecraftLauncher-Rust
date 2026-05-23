import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { StatusDot } from '../ui/Status';
import { api } from '../../api';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  label: string;
  shortcut?: string;
}

interface SidebarProps {
  navItems: NavItem[];
  username?: string;
  accountType?: string;
  playtimeHours?: number;
  totalPlaytimeHours?: number;
}

const NAV_ID_TO_PATH: Record<string, string> = {
  home: '/home',
  marketplace: '/store',
  collections: '/collections',
  instances: '/instances',
  library: '/library',
  versions: '/versions',
  settings: '/settings',
};

function getActiveNavId(pathname: string): string {
  if (pathname === '/home' || pathname === '/') return 'home';
  if (pathname.startsWith('/store') || pathname === '/mods') return 'marketplace';
  if (pathname.startsWith('/instances')) return 'instances';
  if (pathname === '/collections') return 'collections';
  if (pathname === '/library') return 'library';
  if (pathname === '/versions') return 'versions';
  if (pathname === '/settings') return 'settings';
  return 'home';
}

interface FriendEntry {
  id: string;
  name: string;
  status: string;
  current_game: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--color-success)',
  offline: 'var(--color-text-dim)',
  gaming: 'var(--color-info)',
  away: 'var(--color-warning)',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'ON',
  offline: 'OFF',
  gaming: 'PLAY',
  away: 'AWAY',
};

export const Sidebar: React.FC<SidebarProps> = ({
  navItems,
  username = 'Player',
  accountType = 'OFFLINE',
  playtimeHours = 0,
  totalPlaytimeHours = 0,
}) => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = getActiveNavId(location.pathname);
  const mainItems = navItems.filter((item) => !['settings'].includes(item.id));
  const settingsItem = navItems.find((item) => item.id === 'settings');

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFriendId, setNewFriendId] = useState('');
  const [newFriendName, setNewFriendName] = useState('');

  const loadFriends = useCallback(async () => {
    try {
      const list = await api.listFriends();
      setFriends(list);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleAddFriend = async () => {
    if (!newFriendId.trim() || !newFriendName.trim()) return;
    try {
      await api.addFriend(newFriendId.trim(), newFriendName.trim());
      setNewFriendId('');
      setNewFriendName('');
      setShowAddForm(false);
      await loadFriends();
    } catch {
      // silently fail
    }
  };

  const handleRemoveFriend = async (id: string) => {
    try {
      await api.removeFriend(id);
      await loadFriends();
    } catch {
      // silently fail
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={`${styles.sidebar__logo} float-subtle`}>
        <div className={`${styles.sidebar__logoIcon} neon-flicker`} />
        <span className={styles.sidebar__logoText}>BONNEXT</span>
        <span className={styles.sidebar__logoVersion}>{t('app.version')}</span>
      </div>

      <div className={styles.sidebar__signal}>
        <StatusDot status="ready" />
        <span className={`${styles.sidebar__signalText} cursor-blink`}>{t('sidebar.signalOnAir')}</span>
      </div>

      <nav className={styles.sidebar__nav}>
        {mainItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.sidebar__navItem} ${
              activeId === item.id ? styles['sidebar__navItem--active'] : ''
            }`}
            onClick={() => navigate(NAV_ID_TO_PATH[item.id] || `/${item.id}`)}
            title={item.shortcut ? `Ctrl+${item.shortcut}` : undefined}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className={styles.sidebar__navShortcut}>^{item.shortcut}</span>
            )}
          </button>
        ))}

        {settingsItem && (
          <>
            <div className={styles.sidebar__navDivider} />
            <button
              className={`${styles.sidebar__navItem} ${
                activeId === settingsItem.id ? styles['sidebar__navItem--active'] : ''
              }`}
              onClick={() => navigate(NAV_ID_TO_PATH[settingsItem.id] || `/${settingsItem.id}`)}
              title={settingsItem.shortcut ? `Ctrl+${settingsItem.shortcut}` : undefined}
            >
              <span>{settingsItem.label}</span>
              {settingsItem.shortcut && (
                <span className={styles.sidebar__navShortcut}>^{settingsItem.shortcut}</span>
              )}
            </button>
          </>
        )}
      </nav>

      <div className={styles.sidebar__spacer} />

      <div className={styles.sidebar__friends}>
        <button
          className={styles.sidebar__friendsHeader}
          onClick={() => setFriendsOpen(!friendsOpen)}
        >
          <span className={`${styles.sidebar__friendsCaret} ${friendsOpen ? styles['sidebar__friendsCaret--open'] : ''}`}>▶</span>
          <span className={styles.sidebar__friendsTitle}>{t('sidebar.friends')}</span>
          <span className={styles.sidebar__friendsCount}>{friends.length}</span>
        </button>

        {friendsOpen && (
          <div className={styles.sidebar__friendsList}>
            {friends.map((friend) => (
              <div key={friend.id} className={styles.sidebar__friendItem}>
                <span
                  className={styles.sidebar__friendDot}
                  style={{ backgroundColor: STATUS_COLORS[friend.status] || STATUS_COLORS.offline }}
                />
                <div className={styles.sidebar__friendInfo}>
                  <span className={styles.sidebar__friendName}>{friend.name}</span>
                  {friend.current_game && (
                    <span className={styles.sidebar__friendGame}>{friend.current_game}</span>
                  )}
                  {!friend.current_game && (
                    <span className={styles.sidebar__friendStatus}>
                      {STATUS_LABELS[friend.status] || friend.status}
                    </span>
                  )}
                </div>
                <button
                  className={styles.sidebar__friendRemove}
                  onClick={() => handleRemoveFriend(friend.id)}
                  title={t('sidebar.friendsRemove')}
                >
                  ×
                </button>
              </div>
            ))}

            {friends.length === 0 && (
              <div className={styles.sidebar__friendsEmpty}>{t('sidebar.friendsEmpty')}</div>
            )}

            {showAddForm ? (
              <div className={styles.sidebar__addForm}>
                <input
                  className={styles.sidebar__addInput}
                  placeholder={t('sidebar.friendsAddId')}
                  value={newFriendId}
                  onChange={(e) => setNewFriendId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                />
                <input
                  className={styles.sidebar__addInput}
                  placeholder={t('sidebar.friendsAddName')}
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                />
                <div className={styles.sidebar__addActions}>
                  <button className={styles.sidebar__addBtn} onClick={handleAddFriend}>
                    {t('sidebar.friendsAdd')}
                  </button>
                  <button
                    className={styles.sidebar__addBtnCancel}
                    onClick={() => { setShowAddForm(false); setNewFriendId(''); setNewFriendName(''); }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={styles.sidebar__addFriendBtn}
                onClick={() => setShowAddForm(true)}
              >
                + {t('sidebar.friendsAdd')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.sidebar__playtime}>
        <div className={styles.sidebar__playtimeLabel}>{t('sidebar.today')}</div>
        <div>
          <span className={styles.sidebar__playtimeValue}>{playtimeHours.toFixed(1)}</span>
          <span className={styles.sidebar__playtimeUnit}>{t('common.unit.hours')}</span>
        </div>
        <div className={styles.sidebar__playtimeLabel} style={{ marginTop: 8 }}>{t('sidebar.total')}</div>
        <div>
          <span className={styles.sidebar__playtimeValue}>{totalPlaytimeHours.toFixed(1)}</span>
          <span className={styles.sidebar__playtimeUnit}>{t('common.unit.hours')}</span>
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
