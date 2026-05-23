import { useState, useMemo } from 'react';
import { useDownloads } from '../../stores/downloadStore';
import styles from './DownloadPanel.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting...',
  downloading: 'Downloading...',
  complete: 'Completed',
  failed: 'Failed',
};

export function DownloadPanel() {
  const { state, removeTask, clearCompleted } = useDownloads();
  const [open, setOpen] = useState(false);

  const active = useMemo(() =>
    state.tasks.filter(
      (t) => t.status === 'pending' || t.status === 'downloading'
    ),
    [state.tasks]
  );
  const completed = useMemo(() =>
    state.tasks.filter(
      (t) => t.status === 'complete' || t.status === 'failed'
    ),
    [state.tasks]
  );
  const display = useMemo(() =>
    [...active, ...completed.slice(0, 5)],
    [active, completed]
  );

  if (state.tasks.length === 0 && !open) return null;

  return (
    <>
      {/* Floating toggle button */}
      <button
        className={styles.toggle}
        onClick={() => setOpen(!open)}
        title="Downloads"
      >
        {'\u{2B07}'}
        {active.length > 0 && (
          <span className={styles.toggle__badge}>{active.length}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <div className={styles.header}>
              <div className={styles.header__title}>
                DOWNLOADS
                {active.length > 0 && (
                  <span className={styles.header__count}>{active.length} active</span>
                )}
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
                        task.status === 'pending' ? styles['task__icon--pending'] :
                        task.status === 'downloading' ? styles['task__icon--downloading'] :
                        task.status === 'complete' ? styles['task__icon--complete'] :
                        styles['task__icon--failed']
                      }`}
                    />
                    <div className={styles.task__info}>
                      <div className={styles.task__title}>{task.title}</div>
                      <div className={styles.task__filename}>{task.filename}</div>
                      <div
                        className={`${styles.task__status} ${
                          task.status === 'failed' ? styles['task__status--failed'] : ''
                        }`}
                      >
                        {task.status === 'failed' && task.error
                          ? task.error.slice(0, 60)
                          : STATUS_LABELS[task.status]}
                      </div>
                    </div>
                    {(task.status === 'complete' || task.status === 'failed') && (
                      <button
                        className={styles.task__dismiss}
                        onClick={() => removeTask(task.id)}
                      >
                        {'\u{2715}'}
                      </button>
                    )}
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
