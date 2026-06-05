export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'complete' | 'failed' | 'cancelled';

export interface DownloadTask {
  id: string;
  title: string;
  filename: string;
  url?: string;
  status: DownloadStatus;
  progress?: number;
  speed?: number;
  eta?: number;
  error?: string;
  startedAt: number;
}

export interface DownloadState {
  tasks: DownloadTask[];
}

export type DownloadAction =
  | { type: 'ADD_TASK'; task: DownloadTask }
  | {
      type: 'UPDATE_TASK';
      id: string;
      status: DownloadStatus;
      error?: string;
      progress?: number;
      speed?: number;
      eta?: number;
    }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'PAUSE_TASK'; id: string }
  | { type: 'RESUME_TASK'; id: string }
  | { type: 'CANCEL_TASK'; id: string }
  | { type: 'CLEAR_COMPLETED' };
