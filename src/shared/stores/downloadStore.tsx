import { createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { api } from '../api';
import type { DownloadProgressEvent, ContentDownloadProgress, ModpackImportProgress } from '../api/types';
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
  // 使用 ref 存储 tasks，避免 useEffect 依赖 state.tasks 导致监听器频繁重注册。
  // 之前的 bug：依赖 [state.tasks]，每次进度更新都重注册监听器，异步卸载/注册间隙丢失事件。
  const tasksRef = useRef(state.tasks);
  tasksRef.current = state.tasks;

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
    // 依赖 [] 只注册一次监听器，通过 tasksRef.current 读取最新 tasks。
    const unlistenPromise = api.onContentDownloadProgress((p: ContentDownloadProgress) => {
      const matchId = tasksRef.current.find((t) => t.status === 'downloading' && t.filename === p.filename)?.id;
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
  }, []);

  // 整合包导入进度：Rust 端 import_modpack 发射 modpack-import-progress 事件
  // 在 DownloadPanel 中显示为单个任务，进度 = completed/total
  const modpackTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    const unlistenPromise = api.onModpackImportProgress((p: ModpackImportProgress) => {
      if (p.stage === 'downloading') {
        const total = p.total ?? 0;
        const completed = p.completed ?? 0;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (!modpackTaskIdRef.current) {
          const taskId = `modpack-${Date.now()}`;
          modpackTaskIdRef.current = taskId;
          dispatch({
            type: 'ADD_TASK',
            task: {
              id: taskId,
              title: p.name ? `Modpack: ${p.name}` : 'Modpack Import',
              filename: p.current_file || `${completed}/${total} files`,
              status: 'downloading',
              startedAt: Date.now(),
              progress: pct,
            },
          });
        } else {
          dispatch({
            type: 'UPDATE_TASK',
            id: modpackTaskIdRef.current,
            status: 'downloading',
            progress: pct,
          });
        }
      } else if (p.stage === 'completed') {
        if (modpackTaskIdRef.current) {
          dispatch({
            type: 'UPDATE_TASK',
            id: modpackTaskIdRef.current,
            status: 'complete',
            progress: 100,
          });
          modpackTaskIdRef.current = null;
        }
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // 自动清理：每 60s 扫描一次，移除 5 分钟前已完成/失败/取消的任务。
  // 之前 bug：completed/failed/cancelled 任务永久驻留，长时间运行会堆满 50 条上限，
  // 新下载任务被挤出可见区域。
  // 用 tasksRef.current 读取最新状态，避免在每次进度更新时重置 interval。
  useEffect(() => {
    const CLEANUP_AGE_MS = 5 * 60 * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      const stale = tasksRef.current.filter(
        (t) =>
          (t.status === 'complete' || t.status === 'failed' || t.status === 'cancelled') &&
          now - t.startedAt > CLEANUP_AGE_MS,
      );
      for (const t of stale) {
        dispatch({ type: 'REMOVE_TASK', id: t.id });
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

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
