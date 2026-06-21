// src/plugins/builtins/scene-menu/hooks/useLaunchLastInstance.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginContext } from '../../../core';

export type LaunchState = 'idle' | 'launching' | 'running' | 'crashed' | 'downloading';

interface Instance {
  id: string;
  name: string;
  last_played: string | null;
}

export interface LaunchLastInstanceApi {
  state: LaunchState;
  error: string | null;
  launchingName: string | null;
  launch: () => Promise<void>;
}

export function useLaunchLastInstance(ctx: PluginContext): LaunchLastInstanceApi {
  const [state, setState] = useState<LaunchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [launchingName, setLaunchingName] = useState<string | null>(null);
  const offRef = useRef<(() => void) | null>(null);

  // 监听 launch-state-changed 事件
  useEffect(() => {
    const off = ctx.events.on('launch-state-changed', (data) => {
      const d = (data ?? {}) as { state?: string };
      if (d.state === 'running') setState('running');
      else if (d.state === 'crashed') setState('crashed');
      else if (d.state === 'downloading') setState('downloading');
    });
    offRef.current = off;
    return () => {
      if (typeof off === 'function') off();
    };
  }, [ctx]);

  const launch = useCallback(async () => {
    setError(null);
    let instances: Instance[];
    try {
      instances = (await ctx.invoke<Instance[]>('list_instances')) ?? [];
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('crashed');
      return;
    }
    if (instances.length === 0) {
      window.location.hash = '#/instances/new';
      return;
    }
    const sorted = [...instances].sort((a, b) => {
      const ta = a.last_played ? Date.parse(a.last_played) : 0;
      const tb = b.last_played ? Date.parse(b.last_played) : 0;
      return tb - ta;
    });
    const target = sorted[0];
    setLaunchingName(target.name);
    setState('launching');
    try {
      await ctx.invoke('launch_game', { instance_id: target.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('crashed');
    }
  }, [ctx]);

  return { state, error, launchingName, launch };
}
