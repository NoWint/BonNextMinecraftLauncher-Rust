import React, { useMemo } from 'react';
import { useI18n } from '../../shared/i18n';
import type { ChatMessage as ChatMessageType, Task } from '../../shared/ai/types';
import styles from './ChatMessage.module.css';

interface ChatMessageProps {
  message: ChatMessageType;
  tasks: Record<string, Task>;
  onConfirm: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRetry: (taskId: string) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const GLITCH_RATE = 0.12;

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, tasks, onConfirm, onCancel, onRetry }) => {
  const isUser = message.role === 'user';
  const messageTasks = Object.values(tasks).filter((t) => t.messageId === message.id);

  const glitch = useMemo(() => Math.random() < GLITCH_RATE, []);

  return (
    <div className={`${styles.message} ${isUser ? styles['message--user'] : styles['message--assistant']}`}>
      <div className={`${styles.message__bubble} ${glitch ? styles['message__bubble--glitch'] : ''}`}>
        {message.content}
        {message.isStreaming && (
          <span className={styles.typingDots}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </span>
        )}
      </div>

      {message.commands.length > 0 && (
        <div className={styles.message__commands}>
          {message.commands.map((cmd, i) => {
            const task = messageTasks[i];
            return (
              <CommandCard
                key={`${cmd.command}-${i}`}
                command={cmd}
                task={task}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onRetry={onRetry}
              />
            );
          })}
        </div>
      )}

      <div className={styles.message__time}>{formatTime(message.timestamp)}</div>
    </div>
  );
};

interface CommandCardProps {
  command: { command: string; params: Record<string, unknown>; risk_level: 'low' | 'high' };
  task?: Task;
  onConfirm: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRetry: (taskId: string) => void;
}

const CMD_LABELS: Record<string, string> = {
  search_mods: 'Search',
  install_mod: 'Install',
  launch_game: 'Launch',
  update_settings: 'Settings',
  get_instances: 'Instances',
  get_config: 'Config',
  search_versions: 'Versions',
};

const CommandCard: React.FC<CommandCardProps> = ({ command, task, onRetry }) => {
  const { t } = useI18n();
  const status = task?.status || 'pending';
  const label = CMD_LABELS[command.command] || command.command;

  return (
    <div className={`${styles.commandCard} ${styles[`commandCard--${status}`]}`}>
      <div className={styles.commandCard__main}>
        <div className={styles.commandCard__iconWrap}>
          {status === 'executing' ? (
            <span className={styles.spinner} />
          ) : status === 'completed' ? (
            <span className={styles.checkmark}>✓</span>
          ) : status === 'failed' ? (
            <span className={styles.crossmark}>✗</span>
          ) : (
            <span className={styles.dot} />
          )}
        </div>
        <div className={styles.commandCard__body}>
          <div className={styles.commandCard__label}>{label}</div>
          {Object.keys(command.params).length > 0 && (
            <div className={styles.commandCard__params}>
              {Object.entries(command.params).map(([key, val]) => (
                <span key={key} className={styles.commandCard__param}>
                  <span className={styles.commandCard__paramKey}>{key}</span>
                  <span className={styles.commandCard__paramVal}>{String(val)}</span>
                </span>
              ))}
            </div>
          )}
          <div className={`${styles.commandCard__status} ${styles[`commandCard__status--${status}`]}`}>
            {status === 'executing' && (task?.result?.message || t('ai.status.running'))}
            {status === 'completed' && (task?.result?.message || t('ai.status.done'))}
            {status === 'failed' && (task?.result?.error || t('ai.status.failed'))}
            {status === 'confirmed' && t('ai.status.queued')}
          </div>
        </div>
      </div>

      {status === 'failed' && (
        <button className={styles.commandCard__retryBtn} onClick={() => onRetry(task!.id)}>
          {t('ai.action.retry')}
        </button>
      )}
    </div>
  );
};
