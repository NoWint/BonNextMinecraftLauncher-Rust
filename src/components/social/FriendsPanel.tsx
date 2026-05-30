import { useState, useEffect } from 'react';
import { useSocial } from '../../stores/socialStore';
import { useChat } from '../../stores/chatStore';
import { useI18n } from '../../i18n';
import styles from './FriendsPanel.module.css';

export default function FriendsPanel() {
  const { t } = useI18n();
  const { friends, discoveredPeers, isDiscovering, startDiscovery, stopDiscovery, scanPeers, addFriend, myPeerId } =
    useSocial();
  const { openChat, unreadCounts } = useChat();
  const [addId, setAddId] = useState('');
  const [addName, setAddName] = useState('');

  useEffect(() => {
    if (isDiscovering) {
      const interval = setInterval(() => scanPeers(), 10000);
      return () => clearInterval(interval);
    }
  }, [isDiscovering, scanPeers]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{t('sidebar.friends')}</span>
        <span className={styles.myId}>{myPeerId}</span>
      </div>

      <div className={styles.discoverySection}>
        <button
          className={`${styles.discoveryBtn} ${isDiscovering ? styles.active : ''}`}
          onClick={() => (isDiscovering ? stopDiscovery() : startDiscovery(myPeerId || 'BonNext User'))}
        >
          {isDiscovering ? '\u{1F7E2} ' + t('sidebar.signalOnAir') : '⚪ ' + 'OFFLINE'}
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
        <input placeholder={t('sidebar.friendsAddId')} value={addId} onChange={(e) => setAddId(e.target.value)} />
        <input placeholder={t('sidebar.friendsAddName')} value={addName} onChange={(e) => setAddName(e.target.value)} />
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
            {unreadCounts[friend.id] > 0 && <span className={styles.unreadBadge}>{unreadCounts[friend.id]}</span>}
            {friend.current_game && <div className={styles.currentGame}>{friend.current_game}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
