import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../shared/stores/chatStore';
import { useSocial } from '../../shared/stores/socialStore';
import styles from './ChatWindow.module.css';

export default function ChatWindow() {
  const { activeChat, messages, closeChat, sendMessage } = useChat();
  const { friends } = useSocial();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const friend = friends.find((f) => f.id === activeChat);
  const chatMessages = activeChat ? messages[activeChat] || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!activeChat) return null;

  return (
    <div className={styles.window}>
      <div className={styles.header}>
        <span className={styles.peerName}>{friend?.name || activeChat}</span>
        <button className={styles.closeBtn} onClick={closeChat}>
          ✕
        </button>
      </div>

      <div className={styles.messages}>
        {chatMessages.length === 0 && <div className={styles.empty}>Start chatting!</div>}
        {chatMessages.map((msg, i) => (
          <div key={msg.id || i} className={`${styles.bubble} ${msg.sent_by_me ? styles.me : styles.them}`}>
            <div className={styles.content}>{msg.content}</div>
            <div className={styles.time}>
              {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBar}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              sendMessage(activeChat, input.trim());
              setInput('');
            }
          }}
          placeholder="Type a message..."
        />
        <button
          onClick={() => {
            if (input.trim()) {
              sendMessage(activeChat, input.trim());
              setInput('');
            }
          }}
          disabled={!input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
