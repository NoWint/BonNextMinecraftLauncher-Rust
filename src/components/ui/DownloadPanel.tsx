import { useState, useMemo } from 'react';
import { useDownloads } from '../../stores/downloadStore';
import { api } from '../../api';
import styles from './DownloadPanel.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting...',
  downloading: 'Downloading...',
  paused: 'Paused',
  complete: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec >= 1_048_576) return `${(bytesPerSec / 1_048_576).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSec} B/s`;
}

function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s left`;
}

export function DownloadPanel() {
  const { state, removeTask, pauseTask, resumeTask, cancelTask, clearCompleted } = useDownloads();
  const [open, setOpen] = useState(false);

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
        title="Downloads"
        aria-label="Toggle downloads panel"
      >
        {'\u{2B07}'}
        {active.length > 0 && <span className={styles.toggle__badge}>{active.length}</span>}
      </button>

      {open && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <div className={styles.header}>
              <div className={styles.header__title}>
                DOWNLOADS
                {active.length > 0 && <span className={styles.header__count}>{active.length} active</span>}
              </div>
              <div className={styles.header__actions}>
                {completed.length > 0 && (
                  <button className={styles.header__btn} onClick={clearCompleted}>
                    CLEAR DONE
                  </button>
                )}
                <button className={styles.header__btn} onClick={() => setOpen(false)}>
                  HIDE
                </button>
              </div>
            </div>

            {display.length === 0 ? (
              <div className={styles.empty}>No downloads</div>
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
                          aria-label="Pause download"
                          title="Pause"
                        >
                          {'\u{23F8}'}
                        </button>
                      )}
                      {task.status === 'paused' && (
                        <button
                          className={styles.task__control}
                          onClick={() => handleResume(task.id)}
                          aria-label="Resume download"
                          title="Resume"
                        >
                          {'\u{25B6}'}
                        </button>
                      )}
                      {(task.status === 'downloading' || task.status === 'paused' || task.status === 'pending') && (
                        <button
                          className={styles.task__control}
                          onClick={() => handleCancel(task.id, task.url)}
                          aria-label="Cancel download"
                          title="Cancel"
                        >
                          {'\u{2715}'}
                        </button>
                      )}
                      {(task.status === 'complete' || task.status === 'failed' || task.status === 'cancelled') && (
                        <button
                          className={styles.task__dismiss}
                          onClick={() => removeTask(task.id)}
                          aria-label="Dismiss download"
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
