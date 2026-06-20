// src/plugins/builtins/scene-menu/hooks/useOverlayVisibility.ts
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { PluginContext } from '../../../core';

const HOME_HASHES = new Set(['#/home', '#/', '#', '']);

function isHomeHash(hash: string): boolean {
  return HOME_HASHES.has(hash);
}

export interface OverlayVisibilityState {
  /** 认证探测已完成（无论结果） */
  authResolved: boolean;
  /** overlay 是否应可见（已认证 + 在 home） */
  visible: boolean;
}

export function useOverlayVisibility(ctx: PluginContext): OverlayVisibilityState {
  const [authenticated, setAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [onHome, setOnHome] = useState(() => isHomeHash(window.location.hash));

  // 初始认证探测 + 监听 auth:login 事件。
  // 使用 flushSync 强制同步刷新状态，确保在测试 act 作用域外触发的
  // Promise 回调中的状态更新能被 React 立即处理。
  useEffect(() => {
    let cancelled = false;
    ctx
      .invoke('get_active_account')
      .then((acct) => {
        if (cancelled) return;
        flushSync(() => {
          setAuthenticated(!!acct);
          setAuthResolved(true);
        });
      })
      .catch(() => {
        if (cancelled) return;
        flushSync(() => {
          setAuthenticated(false);
          setAuthResolved(true);
        });
      });
    const off = ctx.events.on('auth:login', () => setAuthenticated(true));
    return () => {
      cancelled = true;
      if (typeof off === 'function') off();
    };
  }, [ctx]);

  // hash 变化
  useEffect(() => {
    const onHash = () => setOnHome(isHomeHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return { authResolved, visible: authResolved && authenticated && onHome };
}
