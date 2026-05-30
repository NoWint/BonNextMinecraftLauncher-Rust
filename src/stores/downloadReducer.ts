import type { DownloadState, DownloadAction } from './downloadTypes';

export function downloadReducer(state: DownloadState, action: DownloadAction): DownloadState {
  switch (action.type) {
    case 'ADD_TASK':
      return { tasks: [action.task, ...state.tasks.slice(0, 49)] };
    case 'UPDATE_TASK':
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                status: action.status,
                ...(action.error !== undefined ? { error: action.error } : {}),
                ...(action.progress !== undefined ? { progress: action.progress } : {}),
                ...(action.speed !== undefined ? { speed: action.speed } : {}),
                ...(action.eta !== undefined ? { eta: action.eta } : {}),
              }
            : t,
        ),
      };
    case 'REMOVE_TASK':
      return { tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'PAUSE_TASK':
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id && t.status === 'downloading' ? { ...t, status: 'paused' as const } : t,
        ),
      };
    case 'RESUME_TASK':
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id && t.status === 'paused' ? { ...t, status: 'downloading' as const } : t,
        ),
      };
    case 'CANCEL_TASK':
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id && (t.status === 'downloading' || t.status === 'paused' || t.status === 'pending')
            ? { ...t, status: 'cancelled' as const }
            : t,
        ),
      };
    case 'CLEAR_COMPLETED':
      return {
        tasks: state.tasks.filter((t) => t.status === 'pending' || t.status === 'downloading' || t.status === 'paused'),
      };
    default:
      return state;
  }
}
