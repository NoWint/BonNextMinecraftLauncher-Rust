import React from 'react';
import { useI18n } from '../../i18n';
import type { ChatMessage as ChatMessageType, Task } from '../../ai/types';
import { Icon } from '../ui/Icon';
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

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, tasks, onConfirm, onCancel, onRetry }) => {
  const isUser = message.role === 'user';
  const messageTasks = Object.values(tasks).filter((t) => t.messageId === message.id);

  return (
    <div className={`${styles.message} ${isUser ? styles['message--user'] : styles['message--assistant']}`}>
      <div className={styles.message__bubble}>
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

const CommandCard: React.FC<CommandCardProps> = ({ command, task, onConfirm, onCancel, onRetry }) => {
  const { t } = useI18n();
  const riskLevel = command.risk_level;
  const status = task?.status || 'pending';

  const statusLabels: Record<string, string> = {
    pending: t('ai.status.pending'),
    confirmed: t('ai.status.queued'),
    executing: t('ai.status.running'),
    completed: t('ai.status.done'),
    failed: t('ai.status.failed'),
  };

  return (
    <div className={`${styles.commandCard} ${styles[`commandCard--${riskLevel}`]}`}>
      <div className={styles.commandCard__header}>
        <div className={styles.commandCard__icon}>
          {status === 'executing' ? (
            <Icon name="hourglass" size={12} />
          ) : status === 'completed' ? (
            <Icon name="check" size={12} />
          ) : status === 'failed' ? (
            <Icon name="cross" size={12} />
          ) : (
            <Icon name="bulletRight" size={10} />
          )}
        </div>
        <span className={styles.commandCard__name}>{command.command}</span>
        <span className={`${styles.commandCard__risk} ${styles[`commandCard__risk--${riskLevel}`]}`}>
          {riskLevel === 'high' ? t('ai.risk.high') : t('ai.risk.low')}
        </span>
      </div>

      <div className={styles.commandCard__params}>
        {Object.entries(command.params).map(([key, val]) => (
          <span key={key} className={styles.commandCard__param}>
            <span className={styles.commandCard__paramKey}>{key}</span>
            <span className={styles.commandCard__paramVal}>{String(val)}</span>
          </span>
        ))}
      </div>

      {task && (
        <div className={styles.commandCard__status}>
          <span className={`${styles.commandCard__statusDot} ${styles[`commandCard__statusDot--${status}`]}`} />
          <span className={styles.commandCard__statusText}>{statusLabels[status] || status}</span>
        </div>
      )}

      {task?.result && (
        <div
          className={`${styles.commandCard__result} ${styles[`commandCard__result--${task.result.success ? 'success' : 'error'}`]}`}
        >
          {task.result.success ? task.result.message : task.result.error}
        </div>
      )}

      {task && status === 'pending' && riskLevel === 'high' && (
        <div className={styles.commandCard__actions}>
          <button
            className={`${styles.commandCard__btn} ${styles['commandCard__btn--confirm']}`}
            onClick={() => onConfirm(task.id)}
          >
            {t('ai.action.confirm')}
          </button>
          <button
            className={`${styles.commandCard__btn} ${styles['commandCard__btn--cancel']}`}
            onClick={() => onCancel(task.id)}
          >
            {t('ai.action.cancel')}
          </button>
        </div>
      )}

      {task && status === 'failed' && (
        <div className={styles.commandCard__actions}>
          <button
            className={`${styles.commandCard__btn} ${styles['commandCard__btn--retry']}`}
            onClick={() => onRetry(task.id)}
          >
            {t('ai.action.retry')}
          </button>
        </div>
      )}
    </div>
  );
};
