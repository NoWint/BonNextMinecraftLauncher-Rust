import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react';

export interface DownloadTask {
  id: string;
  title: string;
  filename: string;
  status: 'pending' | 'downloading' | 'complete' | 'failed';
  error?: string;
  startedAt: number;
}

interface DownloadState {
  tasks: DownloadTask[];
}

type DownloadAction =
  | { type: 'ADD_TASK'; task: DownloadTask }
  | { type: 'UPDATE_TASK'; id: string; status: DownloadTask['status']; error?: string }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'CLEAR_COMPLETED' };

function reducer(state: DownloadState, action: DownloadAction): DownloadState {
  switch (action.type) {
    case 'ADD_TASK':
      return { tasks: [action.task, ...state.tasks.slice(0, 49)] }; // max 50
    case 'UPDATE_TASK':
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, status: action.status, error: action.error }
            : t
        ),
      };
    case 'REMOVE_TASK':
      return { tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'CLEAR_COMPLETED':
      return { tasks: state.tasks.filter((t) => t.status !== 'complete' && t.status !== 'failed') };
    default:
      return state;
  }
}

interface DownloadContextValue {
  state: DownloadState;
  addTask: (task: DownloadTask) => void;
  updateTask: (id: string, status: DownloadTask['status'], error?: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tasks: [] });

  const addTask = useCallback((task: DownloadTask) => dispatch({ type: 'ADD_TASK', task }), []);
  const updateTask = useCallback((id: string, status: DownloadTask['status'], error?: string) =>
    dispatch({ type: 'UPDATE_TASK', id, status, error }), []);
  const removeTask = useCallback((id: string) => dispatch({ type: 'REMOVE_TASK', id }), []);
  const clearCompleted = useCallback(() => dispatch({ type: 'CLEAR_COMPLETED' }), []);

  const contextValue = useMemo(() => ({
    state, addTask, updateTask, removeTask, clearCompleted,
  }), [state, addTask, updateTask, removeTask, clearCompleted]);

  return (
    <DownloadContext.Provider value={contextValue}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownloads must be used within DownloadProvider');
  return ctx;
}
