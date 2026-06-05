import { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { api } from '../api';
import type { DownloadProgressEvent, ContentDownloadProgress } from '../api/types';
import type { DownloadTask, DownloadState } from './downloadTypes';
import { downloadReducer as reducer } from './downloadReducer';

export { downloadReducer } from './downloadReducer';
export type { DownloadTask, DownloadState, DownloadAction } from './downloadTypes';

interface DownloadContextValue {
  state: DownloadState;
  addTask: (task: DownloadTask) => void;
  updateTask: (
    id: string,
    status: DownloadTask['status'],
    error?: string,
    progress?: number,
    speed?: number,
    eta?: number,
  ) => void;
  removeTask: (id: string) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  clearCompleted: () => void;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tasks: [] });

  const addTask = useCallback((task: DownloadTask) => dispatch({ type: 'ADD_TASK', task }), []);
  const updateTask = useCallback(
    (id: string, status: DownloadTask['status'], error?: string, progress?: number, speed?: number, eta?: number) =>
      dispatch({ type: 'UPDATE_TASK', id, status, error, progress, speed, eta }),
    [],
  );
  const removeTask = useCallback((id: string) => dispatch({ type: 'REMOVE_TASK', id }), []);
  const pauseTask = useCallback((id: string) => dispatch({ type: 'PAUSE_TASK', id }), []);
  const resumeTask = useCallback((id: string) => dispatch({ type: 'RESUME_TASK', id }), []);
  const cancelTask = useCallback((id: string) => dispatch({ type: 'CANCEL_TASK', id }), []);
  const clearCompleted = useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), []);

  const versionTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unlistenPromise = api.onDownloadProgress((progress: DownloadProgressEvent) => {
      let taskId = versionTaskIdRef.current;
      if (!taskId) {
        taskId = `version-${Date.now()}`;
        versionTaskIdRef.current = taskId;
        dispatch({
          type: 'ADD_TASK',
          task: {
            id: taskId,
            title: `Version Download`,
            filename: progress.current_url?.split('/').pop() || 'version files',
            status: 'downloading',
            startedAt: Date.now(),
          },
        });
      }
      const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : undefined;
      dispatch({
        type: 'UPDATE_TASK',
        id: taskId,
        status: progress.finished ? 'complete' : 'downloading',
        progress: pct,
        speed: progress.speed_bytes_per_sec,
        eta: progress.eta_seconds,
      });
      if (progress.finished) {
        versionTaskIdRef.current = null;
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = api.onContentDownloadProgress((p: ContentDownloadProgress) => {
      const matchId = state.tasks.find((t) => t.status === 'downloading' && t.filename === p.filename)?.id;
      if (matchId) {
        dispatch({
          type: 'UPDATE_TASK',
          id: matchId,
          status: p.finished ? 'complete' : 'downloading',
          progress: Math.round(p.progress),
          speed: p.speed_bytes_per_sec,
          eta: p.eta_seconds,
        });
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [state.tasks]);

  const contextValue = useMemo(
    () => ({
      state,
      addTask,
      updateTask,
      removeTask,
      pauseTask,
      resumeTask,
      cancelTask,
      clearCompleted,
    }),
    [state, addTask, updateTask, removeTask, pauseTask, resumeTask, cancelTask, clearCompleted],
  );

  return <DownloadContext.Provider value={contextValue}>{children}</DownloadContext.Provider>;
}

export function useDownloads() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownloads must be used within DownloadProvider');
  return ctx;
}
