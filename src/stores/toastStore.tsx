import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${++toastId}_${Date.now()}`;
    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 3500);
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    // Play sound for success/error toasts
    try {
      import('../utils/sound').then(({ sound }) => {
        if (toast.type === 'success') sound.success();
        else if (toast.type === 'error') sound.error();
      }).catch(() => {});
    } catch {}
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column-reverse', gap: 8, maxWidth: 380,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-enter"
            style={{
              background: '#141414',
              border: `1px solid ${
                t.type === 'error' ? '#FF4444' :
                t.type === 'success' ? '#4CAF50' :
                t.type === 'warning' ? '#FF9800' : '#2A2A2A'
              }`,
              padding: '12px 16px',
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
            onClick={() => removeToast(t.id)}
          >
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.55em',
              color: t.type === 'error' ? '#FF4444' :
                     t.type === 'success' ? '#4CAF50' :
                     t.type === 'warning' ? '#FF9800' : '#FFF',
              fontWeight: 700, letterSpacing: 1, marginBottom: 2,
            }}>
              {t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : 'ℹ'} {t.title}
            </div>
            {t.message && (
              <div style={{ fontSize: '0.5em', color: '#888', lineHeight: 1.4, marginTop: 4 }}>
                {t.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
