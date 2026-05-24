import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { api, type LaunchState } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import styles from './MiniMode.module.css';

const MINI_WIDTH = 320;
const MINI_HEIGHT = 220;
const FULL_MIN_WIDTH = 960;
const FULL_MIN_HEIGHT = 640;

function getLoaderIcon(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric': return '\u{1F9F5}';
    case 'forge': return '\u{2692}';
    default: return '\u{1F4E6}';
  }
}

export const MiniMode: React.FC<{
  onExpand: () => void;
}> = ({ onExpand }) => {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();

  const instances = instState.instances;
  const recentInstances = useMemo(() =>
    [...instances]
      .sort((a, b) => {
        const aTime = a.last_played ? new Date(a.last_played).getTime() : 0;
        const bTime = b.last_played ? new Date(b.last_played).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5),
    [instances]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [launchState, setLaunchState] = useState<LaunchState>('idle');
  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const activeInstance = recentInstances.find((i) => i.id === selectedId)
    || (recentInstances.length > 0 ? recentInstances[0] : null);

  const isBusy = launchState !== 'idle' && launchState !== 'exited' && launchState !== 'crashed' && launchState !== 'error';
  const isError = launchState === 'crashed' || launchState === 'error';

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const poll = async () => {
      try { setLaunchState(await api.getLaunchState()); } catch {}
    };
    poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLaunch = useCallback(async () => {
    if (!activeInstance || !authState.currentUser) return;
    if (isBusy) return;

    if (isError || launchState === 'exited') {
      try { await api.resetLaunchState(); } catch {}
      setLaunchState('idle');
      return;
    }

    try {
      await api.launchGame(
        activeInstance.version_id, activeInstance.version_url,
        authState.currentUser.username, authState.currentUser.uuid,
        authState.currentUser.access_token, activeInstance.max_memory, activeInstance.min_memory,
        activeInstance.java_path || undefined, activeInstance.jvm_args || undefined,
        activeInstance.id,
      );
      addToast({ type: 'success', title: t('home.gameLaunched'), message: t('instances.isStarting', { name: activeInstance.name }) });
    } catch (e: any) {
      addToast({ type: 'error', title: t('instances.launchFailed'), message: e?.toString() || t('instances.launchFailed') });
    }
  }, [activeInstance, authState, isBusy, isError, launchState, addToast, t]);

  const statusDotClass = isError
    ? styles['miniMode__statusDot--error']
    : isBusy
      ? styles['miniMode__statusDot--busy']
      : styles['miniMode__statusDot--idle'];

  const stateLabel: Record<LaunchState, string> = {
    idle: t('home.playArea.start'),
    checking: t('home.state.checking'),
    downloading: t('home.downloading'),
    validating: t('home.state.validating'),
    launching: t('home.state.launching'),
    running: t('home.state.running'),
    exited: t('home.state.exited'),
    crashed: t('home.state.crashed'),
    error: t('home.state.error'),
  };

  const launchBtnClass = isError
    ? styles['miniMode__launchBtn--error']
    : isBusy
      ? styles['miniMode__launchBtn--busy']
      : styles.miniMode__launchBtn;

  return (
    <div className={styles.miniMode}>
      <div className={styles.miniMode__cornerTL} />
      <div className={styles.miniMode__cornerBR} />

      <div className={styles.miniMode__dragBar}>
        <div className={styles.miniMode__brand}>
          <div className={styles.miniMode__brandIcon} />
          <span className={styles.miniMode__brandText}>BONNEXT</span>
        </div>
        <span className={styles.miniMode__dragHint}>{t('miniMode.dragToMove')}</span>
        <button className={styles.miniMode__expandBtn} onClick={onExpand} title={t('miniMode.expand')} aria-label={t('miniMode.expand')}>
          ⤢
        </button>
      </div>

      <div className={styles.miniMode__body}>
        {activeInstance ? (
          <>
            <div
              className={styles.miniMode__instance}
              onClick={() => recentInstances.length > 1 && setShowSwitcher((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (recentInstances.length > 1) setShowSwitcher((v) => !v); } }}
            >
              <div className={styles.miniMode__instanceIcon}>
                {getLoaderIcon(activeInstance.loader_type)}
              </div>
              <div className={styles.miniMode__instanceInfo}>
                <div className={styles.miniMode__instanceName}>{activeInstance.name}</div>
                <div className={styles.miniMode__instanceMeta}>
                  {activeInstance.version_id}
                  {activeInstance.loader_type ? ` · ${t(`common.${activeInstance.loader_type}`)}` : ''}
                  {recentInstances.length > 1 ? ' · ▾' : ''}
                </div>
              </div>
            </div>

            {showSwitcher && recentInstances.length > 1 && (
              <div className={styles.miniMode__switcher} ref={switcherRef}>
                {recentInstances.map((inst) => (
                  <button
                    key={inst.id}
                    className={`${styles.miniMode__switcherItem} ${inst.id === activeInstance.id ? styles['miniMode__switcherItem--active'] : ''}`}
                    onClick={() => { setSelectedId(inst.id); setShowSwitcher(false); }}
                  >
                    <span className={styles.miniMode__switcherIcon}>{getLoaderIcon(inst.loader_type)}</span>
                    <span className={styles.miniMode__switcherName}>{inst.name}</span>
                    <span className={styles.miniMode__switcherVersion}>{inst.version_id}</span>
                  </button>
                ))}
              </div>
            )}

            <button className={launchBtnClass} onClick={handleLaunch}>
              {isBusy
                ? stateLabel[launchState].toUpperCase()
                : isError
                  ? stateLabel[launchState].toUpperCase()
                  : launchState === 'exited'
                    ? t('miniMode.clickToReset')
                    : '▶ ' + t('home.playArea.start').toUpperCase()
              }
            </button>
          </>
        ) : (
          <div className={styles.miniMode__noInstance}>
            <div className={styles.miniMode__noInstanceIcon}>◈</div>
            <div className={styles.miniMode__noInstanceText}>{t('home.noInstances')}</div>
          </div>
        )}

        <div className={styles.miniMode__statusBar}>
          <div className={styles.miniMode__statusLeft}>
            <div className={`${styles.miniMode__statusDot} ${statusDotClass}`} />
            <span className={styles.miniMode__statusText}>
              {isBusy ? stateLabel[launchState] : isError ? stateLabel[launchState] : t('miniMode.ready')}
            </span>
          </div>
          <span className={styles.miniMode__statusRight}>
            {activeInstance ? `${Math.round(activeInstance.max_memory / 1024)}GB` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export async function enterMiniMode() {
  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(MINI_WIDTH, MINI_HEIGHT));
  await win.setMinSize(new LogicalSize(MINI_WIDTH, MINI_HEIGHT));
  await win.setMaxSize(new LogicalSize(MINI_WIDTH * 2, MINI_HEIGHT * 2));
  await win.setDecorations(false);
  await win.setAlwaysOnTop(true);
  localStorage.setItem('bonnext_mini_mode', 'true');
}

export async function exitMiniMode() {
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(false);
  await win.setDecorations(true);
  await win.setMaxSize(null);
  await win.setMinSize(new LogicalSize(FULL_MIN_WIDTH, FULL_MIN_HEIGHT));
  await win.setSize(new LogicalSize(1200, 800));
  localStorage.setItem('bonnext_mini_mode', 'false');
}
