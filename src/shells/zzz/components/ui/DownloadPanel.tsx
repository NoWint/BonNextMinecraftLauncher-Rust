import { useState, useMemo } from 'react';
import { useDownloads } from '../../../../shared/stores/downloadStore';
import { api } from '../../../../shared/api';
import { useI18n } from '../../../../shared/i18n';
import styles from './DownloadPanel.module.css';

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec >= 1_048_576) return `${(bytesPerSec / 1_048_576).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSec} B/s`;
}

export function DownloadPanel() {
  const { t } = useI18n();
  const { state, removeTask, pauseTask, resumeTask, cancelTask, clearCompleted } = useDownloads();
  const [open, setOpen] = useState(false);

  const STATUS_LABELS: Record<string, string> = {
    pending: t('downloadPanel.status.waiting'),
    downloading: t('downloadPanel.status.downloading'),
    paused: t('downloadPanel.status.paused'),
    complete: t('downloadPanel.status.completed'),
    failed: t('downloadPanel.status.failed'),
    cancelled: t('downloadPanel.status.cancelled'),
  };

  function formatEta(seconds?: number): string {
    if (!seconds || seconds <= 0) return '';
    if (seconds < 60) return t('downloadPanel.eta.seconds', { seconds: String(Math.round(seconds)) });
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return t('downloadPanel.eta.minutes', { m: String(m), s: String(s) });
  }

  const active = useMemo(
    () => state.tasks.filter((t) => t.status === 'pending' || t.status === 'downloading' || t.status === 'paused'),
    [state.tasks],
  );
  const completed = useMemo(
    () => state.tasks.filter((t) => t.status === 'complete' || t.status === 'failed' || t.status === 'cancelled'),
    [state.tasks],
  );
  const display = useMemo(() => [...active, ...completed.slice(0, 5)], [active, completed]);

  const handlePause = async (taskId: string) => {
    pauseTask(taskId);
    try {
      await api.pauseDownload();
    } catch {
      /* empty */
    }
  };

  const handleResume = async (taskId: string) => {
    resumeTask(taskId);
    try {
      await api.resumeDownload();
    } catch {
      /* empty */
    }
  };

  const handleCancel = async (taskId: string, url?: string) => {
    cancelTask(taskId);
    if (url) {
      try {
        await api.cancelDownload(url);
      } catch {
        /* empty */
      }
    }
  };

  if (state.tasks.length === 0 && !open) return null;

  return (
    <>
      <button
        className={styles.toggle}
        onClick={() => setOpen(!open)}
        title={t('downloadPanel.title')}
        aria-label={t('downloadPanel.toggleAriaLabel')}
      >
        {'\u{2B07}'}
        {active.length > 0 && <span className={styles.toggle__badge}>{active.length}</span>}
      </button>

      {open && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <div className={styles.header}>
              <div className={styles.header__title}>
                {t('downloadPanel.header')}
                {active.length > 0 && <span className={styles.header__count}>{t('downloadPanel.activeCount', { count: String(active.length) })}</span>}
              </div>
              <div className={styles.header__actions}>
                {completed.length > 0 && (
                  <button className={styles.header__btn} onClick={clearCompleted}>
                    {t('downloadPanel.clearDone')}
                  </button>
                )}
                <button className={styles.header__btn} onClick={() => setOpen(false)}>
                  {t('downloadPanel.hide')}
                </button>
              </div>
            </div>

            {display.length === 0 ? (
              <div className={styles.empty}>{t('downloadPanel.empty')}</div>
            ) : (
              <div className={styles.list}>
                {display.map((task) => (
                  <div key={task.id} className={styles.task}>
                    <div
                      className={`${styles.task__icon} ${
                        task.status === 'pending'
                          ? styles['task__icon--pending']
                          : task.status === 'downloading'
                            ? styles['task__icon--downloading']
                            : task.status === 'paused'
                              ? styles['task__icon--paused']
                              : task.status === 'complete'
                                ? styles['task__icon--complete']
                                : task.status === 'cancelled'
                                  ? styles['task__icon--cancelled']
                                  : styles['task__icon--failed']
                      }`}
                    />
                    <div className={styles.task__info}>
                      <div className={styles.task__title}>{task.title}</div>
                      <div className={styles.task__filename}>{task.filename}</div>
                      <div
                        className={`${styles.task__status} ${
                          task.status === 'failed'
                            ? styles['task__status--failed']
                            : task.status === 'cancelled'
                              ? styles['task__status--cancelled']
                              : task.status === 'paused'
                                ? styles['task__status--paused']
                                : ''
                        }`}
                      >
                        {task.status === 'failed' && task.error ? task.error.slice(0, 60) : STATUS_LABELS[task.status]}
                        {task.status === 'downloading' && task.progress != null && <> &middot; {task.progress}%</>}
                        {task.status === 'paused' && task.progress != null && <> &middot; {task.progress}%</>}
                      </div>
                      {(task.status === 'downloading' || task.status === 'paused') &&
                        (task.speed != null || task.eta != null) && (
                          <div className={styles.task__progress}>
                            {task.speed != null && <span>{formatSpeed(task.speed)}</span>}
                            {task.speed != null && task.eta != null && ' '}
                            {task.eta != null && <span>{formatEta(task.eta)}</span>}
                          </div>
                        )}
                    </div>
                    <div className={styles.task__actions}>
                      {task.status === 'downloading' && (
                        <button
                          className={styles.task__control}
                          onClick={() => handlePause(task.id)}
                          aria-label={t('downloadPanel.pauseAriaLabel')}
                          title={t('downloadPanel.pause')}
                        >
                          {'\u{23F8}'}
                        </button>
                      )}
                      {task.status === 'paused' && (
                        <button
                          className={styles.task__control}
                          onClick={() => handleResume(task.id)}
                          aria-label={t('downloadPanel.resumeAriaLabel')}
                          title={t('downloadPanel.resume')}
                        >
                          {'\u{25B6}'}
                        </button>
                      )}
                      {(task.status === 'downloading' || task.status === 'paused' || task.status === 'pending') && (
                        <button
                          className={styles.task__control}
                          onClick={() => handleCancel(task.id, task.url)}
                          aria-label={t('downloadPanel.cancelAriaLabel')}
                          title={t('downloadPanel.cancel')}
                        >
                          {'\u{2715}'}
                        </button>
                      )}
                      {(task.status === 'complete' || task.status === 'failed' || task.status === 'cancelled') && (
                        <button
                          className={styles.task__dismiss}
                          onClick={() => removeTask(task.id)}
                          aria-label={t('downloadPanel.dismissAriaLabel')}
                        >
                          {'\u{2715}'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
