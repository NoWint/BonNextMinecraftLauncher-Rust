/// <reference types="vite/client" />

interface Window {
  __bonnext_logs?: {
    getEntries: () => import('./utils/logger').LogEntry[];
    clear: () => void;
  };
}
