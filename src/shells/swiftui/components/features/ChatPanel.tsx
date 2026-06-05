import { CloseIcon } from '../icons';
import styles from './ChatPanel.module.css';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }
interface ChatPanelProps { open: boolean; messages: Message[]; onClose: () => void; onSend: (message: string) => void; }

export function ChatPanel({ open, messages, onClose, onSend }: ChatPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) { onSend(e.currentTarget.value.trim()); e.currentTarget.value = ''; }
  };
  return (
    <div className={`${styles.panel} ${open ? styles.open : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>AI Assistant</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--swift-text-tertiary)' }}><CloseIcon size={14} /></button>
      </div>
      <div className={styles.messages}>
        {messages.map((msg) => <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>{msg.content}</div>)}
      </div>
      <div className={styles.inputArea}>
        <input className={styles.input} placeholder="Ask something..." onKeyDown={handleKeyDown} />
      </div>
    </div>
  );
}
