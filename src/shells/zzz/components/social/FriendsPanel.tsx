import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocial } from '../../../../shared/stores/socialStore';
import { useChat } from '../../../../shared/stores/chatStore';
import { useI18n } from '../../../../shared/i18n';
import ChatWindow from './ChatWindow';
import styles from './FriendsPanel.module.css';

interface FriendsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsPanel({ isOpen, onClose }: FriendsPanelProps) {
  const { t } = useI18n();
  const {
    friends,
    discoveredPeers,
    isDiscovering,
    myPeerId,
    addFriend,
    removeFriend,
    startDiscovery,
    stopDiscovery,
    scanPeers,
  } = useSocial();
  const { openChat, unreadCounts, activeChat } = useChat();
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');

  useEffect(() => {
    if (isDiscovering) {
      const interval = setInterval(() => scanPeers(), 10000);
      return () => clearInterval(interval);
    }
  }, [isDiscovering, scanPeers]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className={styles.header}>
              <span className={styles.title}>{myPeerId || 'Social'}</span>
              <button className={styles.closeBtn} onClick={onClose}>
                ✕
              </button>
            </div>

            {!activeChat ? (
              <>
                <div className={styles.discoverySection}>
                  <button
                    className={`${styles.discoveryBtn} ${isDiscovering ? styles.active : ''}`}
                    onClick={() => (isDiscovering ? stopDiscovery() : startDiscovery(myPeerId || 'BonNext User'))}
                  >
                    {isDiscovering ? '\u{1F7E2} ' + t('sidebar.signalOnAir') : '\u{26AA} ' + 'OFFLINE'}
                  </button>
                  {isDiscovering && discoveredPeers.length > 0 && (
                    <div className={styles.discoveredSection}>
                      <div className={styles.sectionLabel}>{t('social.nearby')}</div>
                      {discoveredPeers.map((peer) => (
                        <div key={peer.peer_id} className={styles.peerItem}>
                          <span>{peer.display_name}</span>
                          <button onClick={() => addFriend(peer.peer_id, peer.display_name)}>+</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.addFriendForm}>
                  <input
                    placeholder={t('sidebar.friendsAddId')}
                    value={addId}
                    onChange={(e) => setAddId(e.target.value)}
                  />
                  <input
                    placeholder={t('sidebar.friendsAddName')}
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      addFriend(addId, addName);
                      setAddId('');
                      setAddName('');
                    }}
                    disabled={!addId || !addName}
                  >
                    {t('sidebar.friendsAdd')}
                  </button>
                </div>

                <div className={styles.friendList}>
                  {friends.length === 0 && <div className={styles.empty}>{t('sidebar.friendsEmpty')}</div>}
                  {friends.map((friend) => (
                    <div key={friend.id} className={styles.friendItem} onClick={() => openChat(friend.id)}>
                      <div className={styles.friendStatus}>
                        <span className={`${styles.dot} ${styles[friend.status] || styles.offline}`} />
                        <span>{friend.name}</span>
                      </div>
                      <div className={styles.friendActions}>
                        {unreadCounts[friend.id] > 0 && (
                          <span className={styles.unreadBadge}>{unreadCounts[friend.id]}</span>
                        )}
                        <button
                          className={styles.removeBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFriend(friend.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <ChatWindow />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
