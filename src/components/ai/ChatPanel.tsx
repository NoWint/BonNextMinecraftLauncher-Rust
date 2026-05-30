import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAIAssistant } from '../../stores/aiAssistantStore';
import { ChatMessage } from './ChatMessage';
import styles from './ChatPanel.module.css';

export const ChatPanel: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state, sendMessage, setPanelOpen, confirmTask, cancelTask, retryTask, clearMessages } = useAIAssistant();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleSend = async () => {
    if (!input.trim() || state.isLoading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setPanelOpen(false);
  };

  const handleOpenSettings = () => {
    navigate('/settings');
    setPanelOpen(false);
  };

  return (
    <>
      {/* Full-window rainbow edge */}
      <div className={`${styles.rainbowEdge} ${state.isOpen ? styles['rainbowEdge--visible'] : ''}`} />
      <div className={`${styles.rainbowGlow} ${state.isOpen ? styles['rainbowGlow--visible'] : ''}`} />

      <div
        className={`${styles.panel__overlay} ${state.isOpen ? styles['panel__overlay--visible'] : ''}`}
        onClick={handleClose}
      />
      <div className={`${styles.panel} ${state.isOpen ? styles['panel--open'] : ''}`}>
        <div className={styles.panel__header}>
          <span className={styles.panel__title}>{t('ai.title')}</span>
          <div className={styles.panel__actions}>
            <button className={styles.panel__actionBtn} onClick={clearMessages} title={t('ai.clear')}>
              {t('ai.clear')}
            </button>
            <button className={styles.panel__actionBtn} onClick={handleOpenSettings} title={t('ai.settings')}>
              {t('ai.settings')}
            </button>
            <button className={styles.panel__actionBtn} onClick={handleClose} title={t('ai.close')}>
              {t('ai.close')}
            </button>
          </div>
        </div>

        <div className={styles.panel__messages}>
          {state.messages.length === 0 && (
            <div className={styles.panel__empty}>
              <div className={styles.panel__emptyIcon}>AI</div>
              <div className={styles.panel__emptyText}>
                {t('ai.empty.line1')}
                <br />
                {t('ai.empty.line2')}
              </div>
            </div>
          )}
          {state.messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              tasks={state.tasks}
              onConfirm={confirmTask}
              onCancel={cancelTask}
              onRetry={retryTask}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {state.error && <div className={styles.panel__error}>{state.error}</div>}

        <div className={styles.panel__inputArea}>
          <div className={styles.panel__inputWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.panel__input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={state.config.enabled ? t('ai.placeholder.enabled') : t('ai.placeholder.disabled')}
              disabled={state.isLoading || !state.config.enabled}
              rows={1}
            />
            <button
              className={styles.panel__sendBtn}
              onClick={handleSend}
              disabled={state.isLoading || !input.trim() || !state.config.enabled}
            >
              {t('ai.send')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
