import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { mapError } from '../utils/errorMapping';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  createdAt?: number;
}

const DEFAULT_DURATIONS: Record<Toast['type'], number> = {
  error: 0,
  warning: 5000,
  success: 3500,
  info: 3500,
};

export function errorToast(error: unknown, fallbackTitle?: string): Omit<Toast, 'id'> {
  const mapped = mapError(error);
  const message = mapped.suggestion
    ? `${mapped.message}\n💡 ${mapped.suggestion}`
    : mapped.message;
  return {
    type: 'error',
    title: fallbackTitle || mapped.message,
    message,
  };
}

interface ToastState {
  toasts: Toast[];
  history: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<Toast[]>([]);
  const historyRef = useRef<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast_${++toastId}_${Date.now()}`;
      const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];
      const fullToast: Toast = { ...toast, id, createdAt: Date.now() };
      setToasts((prev) => [...prev.slice(-4), fullToast]);

      historyRef.current = [fullToast, ...historyRef.current].slice(0, 50);
      setHistory(historyRef.current);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
      try {
        import('../utils/sound')
          .then(({ sound }) => {
            if (toast.type === 'success') sound.success();
            else if (toast.type === 'error') sound.error();
          })
          .catch(() => {});
      } catch {
        /* sound import is optional */
      }
    },
    [removeToast],
  );

  return <ToastContext.Provider value={{ toasts, history, addToast, removeToast }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
