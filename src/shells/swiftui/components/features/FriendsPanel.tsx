import { CloseIcon } from '../icons';
import styles from './FriendsPanel.module.css';

interface Friend { id: string; name: string; status: 'online' | 'offline' | 'in-game'; }
interface FriendsPanelProps { isOpen: boolean; onClose: () => void; friends?: Friend[]; }

export function FriendsPanel({ isOpen, onClose, friends = [] }: FriendsPanelProps) {
  if (!isOpen) return null;
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Friends</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--swift-text-tertiary)' }}><CloseIcon size={14} /></button>
        </div>
        <div className={styles.list}>
          {friends.map((f) => (
            <div key={f.id} className={styles.friend}>
              <div className={styles.avatar}>{f.name[0]}</div>
              <div><div className={styles.name}>{f.name}</div><div className={styles.status}>{f.status}</div></div>
            </div>
          ))}
          {friends.length === 0 && <div style={{ padding: 'var(--swift-spacing-xl)', textAlign: 'center', color: 'var(--swift-text-tertiary)' }}>No friends yet</div>}
        </div>
      </div>
    </>
  );
}
