import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type DownloadProgressEvent, type LaunchState, type GameInstance } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { Heading, SubLabel, AccentCorner, Ticker } from '../components/layout';
import { StatusDot, Badge, ProgressBar, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import { relativeTime } from '../utils/time';
import styles from './HomePage.module.css';

const NEWS_ITEMS = [
  'Minecraft Live 2026 . New biome & mob reveal',
  'Sodium 0.7 released . Up to 40% FPS improvement',
  'Fabric 1.0 milestone . Stable API for modders',
  'TerraFirmaCraft returns . Hardcore survival revival',
  'Complementary Shaders v5 . Ray tracing for all GPUs',
  'Create Mod 6.0 . Mechanical marvels expanded',
];

function usePollLaunchState(interval = 2000) {
  const [s, setS] = useState<LaunchState>('idle');
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const poll = async () => {
      try { setS(await api.getLaunchState()); } catch {}
    };
    poll();
    timer = setInterval(poll, interval);
    return () => clearInterval(timer);
  }, [interval]);
  return s;
}

function getLoaderIcon(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric': return '\u{1F9F5}';
    case 'forge': return '\u{2692}';
    default: return '\u{1F4E6}';
  }
}

function getLoaderLabel(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric': return 'Fabric';
    case 'forge': return 'Forge';
    default: return 'Vanilla';
  }
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return '< 1m played';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m played`;
  return `${(seconds / 3600).toFixed(1)} hrs played`;
}

function InstanceCard({
  instance,
  isActive,
  isReady,
  onLaunch,
}: {
  instance: GameInstance;
  isActive: boolean;
  isReady: boolean | null;
  onLaunch: (inst: GameInstance) => void;
}) {
  const loaderLabel = getLoaderLabel(instance.loader_type);
  const playtimeLabel = formatPlaytime(instance.playtime_seconds);

  return (
    <div
      className={`${styles.card} ${isActive ? styles['card--active'] : styles['card--default']}`}
    >
      {isActive && <div className={styles.card__accent} />}
      <div className={styles.card__body}>
        <Tooltip
          content={`${loaderLabel}${instance.loader_version ? ` ${instance.loader_version}` : ''}`}
        >
          <div
            className={`${styles.card__icon} ${isActive ? styles['card__icon--active'] : styles['card__icon--default']}`}
          >
            {getLoaderIcon(instance.loader_type)}
          </div>
        </Tooltip>
        <div className={styles.card__info}>
          <div className={styles.card__nameRow}>
            <span className={`${styles.card__name} ${isActive ? styles['card__name--active'] : styles['card__name--default']}`}>
              {instance.name}
            </span>
            <Badge variant="accent">{instance.version_id}</Badge>
            {instance.loader_type && (
              <Badge variant="muted">{instance.loader_type}</Badge>
            )}
          </div>
          <div className={styles.card__meta}>
            <span className={styles.card__metaItem}>
              Last played: {relativeTime(instance.last_played)}
            </span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>{playtimeLabel}</span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>
              {isReady === null ? '⏳' : isReady ? '✅ Ready' : '⚠️ Needs download'}
            </span>
          </div>
        </div>
        <div className={styles.card__actions}>
          <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onLaunch(instance); }}>
            ▶ START
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlayArea({
  instance,
  isBusy,
  launchState,
  javaVersion,
  onLaunch,
  onReset,
  t,
}: {
  instance: GameInstance | null;
  isBusy: boolean;
  launchState: LaunchState;
  javaVersion: number | null;
  onLaunch: () => void;
  onReset: () => void;
  t: (key: string) => string;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up countdown timer
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const stateLabel: Record<LaunchState, string> = {
    idle: 'START', checking: 'CHECKING', downloading: 'DOWNLOADING',
    validating: 'VALIDATING', launching: 'LAUNCHING', running: 'RUNNING',
    exited: 'EXITED', crashed: 'CRASHED', error: 'ERROR',
  };

  const isError = launchState === 'crashed' || launchState === 'error';
  const canClick = (instance && !isBusy && !showCountdown) || launchState === 'exited' || isError;

  const handleClick = () => {
    if (showCountdown) return;
    if (launchState === 'exited' || isError) {
      onReset();
      setShowCountdown(false);
      setCountdown(null);
      return;
    }
    if (!isBusy && instance) {
      // Start countdown animation, then launch
      setShowCountdown(true);
      setCountdown(3);
      let tick = 3;
      countdownTimerRef.current = setInterval(() => {
        tick -= 1;
        if (tick <= 0) {
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
          setCountdown(0);
          setShowCountdown(false);
          onLaunch();
        } else {
          setCountdown(tick);
        }
      }, 1000);
    }
  };

  return (
    <div className={styles.playArea}>
      <div
        className={`${styles.playArea__panel} ${canClick ? styles['playArea__panel--clickable'] : ''} ${isError ? styles['playArea__panel--error'] : ''} ${showCountdown ? styles['playArea__panel--countdown'] : ''}`}
        onClick={handleClick}
      >
        <AccentCorner position="topRight" />
        <AccentCorner position="bottomLeft" />
        <div className={styles.playArea__inner} />
        <div className={styles.playArea__decorLine} />

        {/* Countdown ring animation */}
        {showCountdown && (
          <div className={styles.countdownRing}>
            <div className={styles.countdownRingInner} />
          </div>
        )}

        <div className={styles.playArea__content}>
          {showCountdown ? (
            <div className={styles.countdownText}>
              <div className={styles.countdownLabel}>LAUNCHING IN</div>
              <div className={styles.countdownNumber}>{countdown}</div>
            </div>
          ) : isBusy || launchState !== 'idle' ? (
            <div className={`${styles.playArea__stateText} ${isBusy ? styles['playArea__stateText--busy'] : styles['playArea__stateText--idle']}`}>
              {stateLabel[launchState]}
            </div>
          ) : (
            <>
              <div className={styles.playArea__playIcon}>▶</div>
              <div className={styles.playArea__startWord}>{t('home.playArea.start')}</div>
              <div className={styles.playArea__startWord}>{t('home.playArea.game')}</div>
            </>
          )}

          {instance ? (
            <div className={styles.playArea__instanceInfo}>
              <div className={styles.playArea__version}>{instance.version_id}</div>
              <div className={styles.playArea__details}>
                {instance.loader_type ? `${getLoaderLabel(instance.loader_type)} . ` : ''}{Math.round(instance.max_memory / 1024)}GB
              </div>
            </div>
          ) : (
            <div className={styles.playArea__noInstance}>{t('home.noInstances')}</div>
          )}

          <div className={styles.playArea__sysRow}>
            <StatusDot status={isBusy ? 'processing' : instance ? 'ready' : 'inactive'} />
            <span className={styles.playArea__sysText}>
              {isBusy ? t('home.playArea.busy') : t('home.playArea.sysReady')}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.quickStats}>
        <div className={styles.statCard}>
          <div className={styles.statCard__value}>
            {instance ? `${Math.round(instance.max_memory / 1024)}GB` : '—'}
          </div>
          <div className={styles.statCard__label}>{t('home.playArea.ram')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCard__value}>
            {javaVersion ? `J${javaVersion}` : '—'}
          </div>
          <div className={styles.statCard__label}>{t('home.playArea.jdk')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCard__value}>FHD</div>
          <div className={styles.statCard__label}>{t('home.playArea.res')}</div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();
  const auth = authState.currentUser!;
  const instances = instState.instances;
  const launchState = usePollLaunchState();
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [javaVersion, setJavaVersion] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [newsIndex, setNewsIndex] = useState(0);
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const activeInstance = instances.length > 0 ? instances[0] : null;
  const isBusy = launchState !== 'idle' && launchState !== 'exited' && launchState !== 'crashed' && launchState !== 'error';
  const loading = instState.loading;

  // Check ready state for all instances
  useEffect(() => {
    const checkAll = async () => {
      const states: Record<string, boolean | null> = {};
      for (const inst of instances) {
        try {
          states[inst.id] = await api.checkInstanceReady(inst.id);
        } catch {
          states[inst.id] = null;
        }
      }
      setReadyStates(states);
    };
    if (instances.length > 0) checkAll();
  }, [instances]);

  useEffect(() => {
    const unlisten = api.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      if (progress.finished) setTimeout(() => setDownloadProgress(null), 2000);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    api.findJava().then((path) => api.checkJavaVersion(path).then(setJavaVersion)).catch(() => {});
  }, []);

  // Rotate news items
  useEffect(() => {
    const timer = setInterval(() => setNewsIndex((i) => (i + 1) % NEWS_ITEMS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLaunch = useCallback(async (instance: GameInstance) => {
    setError('');
    try {
      await api.launchGame(
        instance.version_id, instance.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', instance.max_memory, instance.min_memory,
        instance.java_path || undefined, instance.jvm_args || undefined,
      );
      addToast({ type: 'success', title: 'Game launched', message: `${instance.name} is starting...` });
    } catch (e: any) {
      const msg = e?.toString() || 'Launch failed';
      setError(msg);
      addToast({ type: 'error', title: 'Launch failed', message: msg });
      setTimeout(() => setError(''), 8000);
    }
  }, [auth, addToast]);

  const handleQuickStart = useCallback(async () => {
    setError('');
    try {
      await api.quickStart();
      addToast({ type: 'success', title: 'Quick start', message: 'Launching latest Minecraft...' });
    } catch (e: any) {
      const msg = e?.toString() || 'Quick start failed';
      setError(msg);
      addToast({ type: 'error', title: 'Quick start failed', message: msg });
    }
  }, [addToast]);

  return (
    <div className={`page-enter ${styles.page}`}>
      {/* New user hero */}
      {instances.length === 0 && !loading && (
        <div className={styles.emptyHero}>
          <div className={styles.emptyHero__glimmer} />
          <div className={styles.emptyHero__content}>
            <h2 className={styles.emptyHero__title}>{t('home.welcomeNew')}</h2>
            <p className={styles.emptyHero__desc}>{t('home.welcomeNewDesc')}</p>
            <div className={styles.emptyHero__actions}>
              <Button variant="primary" size="lg" onClick={handleQuickStart} disabled={isBusy}>
                {isBusy ? 'DOWNLOADING...' : '⚡ ' + t('home.quickStart')}
              </Button>
              <Button variant="secondary-highlight" size="lg" onClick={() => window.location.hash = '#/instances/new'}>
                + {t('home.newInstance')}
              </Button>
            </div>
            <p className={styles.emptyHero__hint}>{t('home.welcomeNewHint')}</p>
          </div>
        </div>
      )}

      {/* Download overlay */}
      {downloadProgress && !downloadProgress.finished && (
        <div className={styles.downloadOverlay}>
          <div className={styles.downloadPanel}>
            <Heading level="md">
              {downloadProgress.phase === 'assets' ? t('home.downloadingAssets') : t('home.downloading')}
            </Heading>
            <div style={{ marginTop: 16 }}>
              <ProgressBar
                progress={downloadProgress.total > 0 ? Math.round((downloadProgress.completed / downloadProgress.total) * 100) : 0}
                done={false}
              />
            </div>
            <div className={styles.downloadStats}>
              <span className={styles.downloadStatItem}>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#FFE600' }}>
                  {downloadProgress.completed}/{downloadProgress.total}
                </span>
                {' . '}{downloadProgress.phase}
              </span>
            </div>
            {downloadProgress.current_url && (
              <div className={styles.downloadFile} style={{ marginTop: 4 }}>
                {downloadProgress.current_url.split('/').pop()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && <div className={styles.errorToast}>{error}</div>}

      {/* Top bar */}
      <div className={styles.topBar}>
        <div>
          <Heading level="xl">{t('home.welcome')}</Heading>
          <div className={styles.topBar__stats}>
            <span className={styles.topBar__username}>{auth.username}</span>
            <div className={styles.topBar__statSep} />
            <span className={styles.topBar__statText}>{instances.length} {t('home.instances')}</span>
          </div>
        </div>
        <div className={styles.topBar__right}>
          <div className={styles.topBar__sysStatus}>
            <StatusDot status={isBusy ? 'processing' : 'ready'} />
            <span className={styles.topBar__sysText}>{launchState.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {loading && instances.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className={styles.mainGrid}>
          {/* Left: instance list */}
          <div className={styles.instanceList}>
            <div className={styles.instanceList__header}>
              <div className={styles.instanceList__title}>
                <SubLabel>{t('home.instancesHeader')}</SubLabel>
                <span className={styles.instanceList__count}>
                  {String(instances.length).padStart(2, '0')}
                </span>
              </div>
              <Button variant="primary" size="sm" onClick={() => window.location.hash = '#/instances/new'}>
                + {t('home.newInstance')}
              </Button>
            </div>

            {instances.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyState__bar} />
                <div className={styles.emptyState__title}>{t('home.noInstancesTitle')}</div>
                <div className={styles.emptyState__desc}>{t('home.noInstancesDesc')}</div>
                <Button variant="primary" size="md" onClick={() => window.location.hash = '#/instances/new'}>
                  + {t('home.newInstance')}
                </Button>
              </div>
            ) : (
              instances.map((inst, i) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  isActive={i === 0}
                  isReady={readyStates[inst.id] ?? null}
                  onLaunch={handleLaunch}
                />
              ))
            )}

            {/* News panel */}
            <div style={{
              marginTop: 'auto',
              background: '#141414',
              border: '1px solid #1C1C1C',
              padding: 12,
            }}>
              <div style={{
                fontSize: '0.45em', color: '#555',
                letterSpacing: 2, fontWeight: 700, marginBottom: 8,
              }}>
                {t('home.news')}
              </div>
              <div
                className={styles.newsItem}
                key={newsIndex}
                style={{
                  fontSize: '0.55em', color: '#AAA',
                  lineHeight: 1.5, transition: 'opacity 0.3s ease',
                }}
              >
                <span style={{ color: '#FFE600', marginRight: 6 }}>{'▸'}</span>
                {NEWS_ITEMS[newsIndex]}
              </div>
              <div style={{
                display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center',
              }}>
                {NEWS_ITEMS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4, height: 4,
                      background: i === newsIndex ? '#FFE600' : '#333',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Ticker messages={NEWS_ITEMS} />
            </div>
          </div>

          {/* Right: PLAY area + quick actions */}
          <div style={{ flex: 0.7, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PlayArea
              instance={activeInstance}
              isBusy={isBusy}
              launchState={launchState}
              javaVersion={javaVersion}
              onLaunch={() => activeInstance && handleLaunch(activeInstance)}
              onReset={() => api.resetLaunchState()}
              t={t}
            />

            {/* Quick actions */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
            }}>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => window.location.hash = '#/instances/new'}
              >
                + {t('home.quickActions.newInstance')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => window.location.hash = '#/mods'}
              >
                {'⬇'} {t('home.quickActions.browseMods')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => window.location.hash = '#/versions'}
              >
                {'⬡'} {t('home.quickActions.versions')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => window.location.hash = '#/settings'}
              >
                {'⚙'} {t('home.quickActions.settings')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
