import { useEffect } from 'react';

/**
 * 专注模式 hook:在需要专注阅读/编辑的页面调用,
 * 挂载时暂停全局 noise-overlay / scanline-overlay 动画,卸载时恢复。
 * 用于 LogViewer / ConfigEditor / AuditLogViewer 等组件。
 */
export function useFocusMode(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--overlay-animation-state', 'paused');
    return () => {
      root.style.removeProperty('--overlay-animation-state');
    };
  }, []);
}
