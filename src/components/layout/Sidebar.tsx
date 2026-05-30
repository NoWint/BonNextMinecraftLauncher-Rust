import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, User, X, Bot, Users } from 'lucide-react';
import { useI18n } from '../../i18n';
import { StatusDot } from '../ui/Status';
import { useSocial } from '../../stores/socialStore';
import { useChat } from '../../stores/chatStore';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  label: string;
  shortcut?: string;
  path: string;
}

interface SidebarProps {
  navItems: NavItem[];
  username?: string;
  accountType?: string;
  playtimeHours?: number;
  totalPlaytimeHours?: number;
  onAIToggle?: () => void;
  onSocialToggle?: () => void;
  onSocialOpen?: () => void;
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
  totalPlaytimeHours = 0,
  onAIToggle,
  onSocialToggle,
  onSocialOpen,
}) => {
  const { t } = useI18n();
  const location = useLocation();
  const { friends, addFriend, removeFriend, load } = useSocial();
  const { openChat, unreadCounts } = useChat();
  const mainItems = navItems.filter((item) => !['settings'].includes(item.id));
  const settingsItem = navItems.find((item) => item.id === 'settings');

  const getIsActive = (path: string) => {
    const current = location.pathname;
    if (path === '/store' || path === '/mods') {
      return current === '/store' || current === '/mods' || current.startsWith('/store/');
    }
    return current === path || current.startsWith(path + '/');
  };

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFriendId, setNewFriendId] = useState('');
  const [newFriendName, setNewFriendName] = useState('');

  useEffect(() => {
    load();
  }, [load]);

  const handleAddFriend = async () => {
    if (!newFriendId.trim() || !newFriendName.trim()) return;
    try {
      await addFriend(newFriendId.trim(), newFriendName.trim());
      setNewFriendId('');
      setNewFriendName('');
      setShowAddForm(false);
    } catch {
      // silently fail
    }
  };

  const handleRemoveFriend = async (id: string) => {
    try {
      await removeFriend(id);
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

      <nav className={styles.sidebar__nav} aria-label="Main navigation">
        {mainItems.map((item) => {
          const isActive = getIsActive(item.path);
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`${styles.sidebar__navItem} ${isActive ? styles['sidebar__navItem--active'] : ''}`}
              title={item.shortcut ? `Ctrl+${item.shortcut}` : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  className={styles.sidebar__activeIndicator}
                  layoutId="sidebar-active-indicator"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span>{item.label}</span>
              {item.shortcut && <span className={styles.sidebar__navShortcut}>^{item.shortcut}</span>}
            </NavLink>
          );
        })}

        {settingsItem && (
          <>
            <div className={styles.sidebar__navDivider} />
            <NavLink
              to={settingsItem.path}
              className={`${styles.sidebar__navItem} ${
                getIsActive(settingsItem.path) ? styles['sidebar__navItem--active'] : ''
              }`}
              title={settingsItem.shortcut ? `Ctrl+${settingsItem.shortcut}` : undefined}
            >
              {getIsActive(settingsItem.path) && (
                <motion.div
                  className={styles.sidebar__activeIndicator}
                  layoutId="sidebar-active-indicator"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span>{settingsItem.label}</span>
              {settingsItem.shortcut && <span className={styles.sidebar__navShortcut}>^{settingsItem.shortcut}</span>}
            </NavLink>
          </>
        )}
      </nav>

      <div className={styles.sidebar__spacer} />

      <div className={styles.sidebar__friends}>
        <button className={styles.sidebar__friendsHeader} onClick={() => setFriendsOpen(!friendsOpen)}>
          <span
            className={`${styles.sidebar__friendsCaret} ${friendsOpen ? styles['sidebar__friendsCaret--open'] : ''}`}
          >
            <ChevronRight size={10} />
          </span>
          <span className={styles.sidebar__friendsTitle}>{t('sidebar.friends')}</span>
          <span className={styles.sidebar__friendsCount}>{friends.length}</span>
        </button>

        {friendsOpen && (
          <div className={styles.sidebar__friendsList}>
            {friends.map((friend) => (
              <div
                key={friend.id}
                className={styles.sidebar__friendItem}
                onClick={() => {
                  openChat(friend.id);
                  onSocialOpen?.();
                }}
                title={t('social.startChat')}
                style={{ cursor: 'pointer' }}
              >
                <span
                  className={styles.sidebar__friendDot}
                  style={{ backgroundColor: STATUS_COLORS[friend.status] || STATUS_COLORS.offline }}
                />
                <div className={styles.sidebar__friendInfo}>
                  <span className={styles.sidebar__friendName}>{friend.name}</span>
                  {friend.current_game && <span className={styles.sidebar__friendGame}>{friend.current_game}</span>}
                  {!friend.current_game && (
                    <span className={styles.sidebar__friendStatus}>
                      {STATUS_LABELS[friend.status] || friend.status}
                    </span>
                  )}
                </div>
                {unreadCounts[friend.id] > 0 && (
                  <span className={styles.sidebar__unreadBadge}>{unreadCounts[friend.id]}</span>
                )}
                <button
                  className={styles.sidebar__friendRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFriend(friend.id);
                  }}
                  title={t('sidebar.friendsRemove')}
                  aria-label={t('sidebar.friendsRemove')}
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {friends.length === 0 && <div className={styles.sidebar__friendsEmpty}>{t('sidebar.friendsEmpty')}</div>}

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
                    onClick={() => {
                      setShowAddForm(false);
                      setNewFriendId('');
                      setNewFriendName('');
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.sidebar__addFriendBtn} onClick={() => setShowAddForm(true)}>
                + {t('sidebar.friendsAdd')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.sidebar__playtime}>
        <div className={styles.sidebar__playtimeLabel}>{t('sidebar.total')}</div>
        <div>
          <span className={styles.sidebar__playtimeValue}>{totalPlaytimeHours.toFixed(1)}</span>
          <span className={styles.sidebar__playtimeUnit}>{t('common.unit.hours')}</span>
        </div>
      </div>

      {onSocialToggle && (
        <button className={styles.sidebar__aiBtn} onClick={onSocialToggle} title="Social Panel">
          <Users size={14} />
          <span className={styles.sidebar__aiBtnText}>{t('social.peerIdLabel') || 'SOCIAL'}</span>
        </button>
      )}

      {onAIToggle && (
        <button className={styles.sidebar__aiBtn} onClick={onAIToggle} title="AI Assistant">
          <Bot size={14} />
          <span className={styles.sidebar__aiBtnText}>AI ASSISTANT</span>
        </button>
      )}

      <div className={styles.sidebar__bottom}>
        <div className={styles.sidebar__user}>
          <div className={styles.sidebar__userAvatar}>
            <User size={14} />
          </div>
          <div>
            <div className={styles.sidebar__userName}>{username}</div>
            <div className={styles.sidebar__userType}>{accountType}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
