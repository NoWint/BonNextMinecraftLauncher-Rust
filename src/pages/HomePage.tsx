import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatError } from '../shared/utils/errorMapping';
import {
  api,
  type DownloadProgressEvent,
  type LaunchState,
  type RunningGameInfo,
  type GameInstance,
  type SystemInfo,
  type JreDownloadProgress,
  type MinecraftNewsEntry,
} from '../shared/api';
import { useAuth } from '../shared/stores/authStore';
import { useInstances } from '../shared/stores/instanceStore';
import { useToast } from '../shared/stores/toastStore';
import { useI18n } from '../shared/i18n';
import { useGreeting } from '../shared/hooks/useGreeting';
import { Heading, SubLabel, AccentCorner, Ticker } from '../components/layout';
import { StatusDot, Badge, ProgressBar, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import type { IconName } from '../components/ui/Icon';
import { CardSkeleton } from '../components/ui/Skeleton';
import GameConsole from '../components/ui/GameConsole';
import { relativeTime } from '../shared/utils/time';
import styles from './HomePage.module.css';

const BANNER_SLIDES = [
  {
    label: 'Featured',
    title: 'Minecraft 1.21 Tricky Trials',
    desc: 'Explore trial chambers, battle the breeze, and craft with new copper blocks.',
    theme: 1,
  },
  {
    label: 'Performance',
    title: 'Sodium 0.7 Released',
    desc: 'Up to 40% FPS improvement. Now on Fabric, Quilt, and NeoForge.',
    theme: 2,
  },
  {
    label: 'Community',
    title: 'Create Mod 6.0',
    desc: 'Mechanical marvels expanded. New logistics, trains, and contraptions.',
    theme: 3,
  },
  {
    label: 'BonNext',
    title: 'One Click to Play',
    desc: 'Auto-detect Java, best version, optimal settings. Zero config needed.',
    theme: 4,
  },
  {
    label: 'Technology',
    title: 'VulkanMod for Minecraft',
    desc: 'Native Vulkan rendering. Smoother frametimes on modern GPUs.',
    theme: 5,
  },
  {
    label: 'Updates',
    title: 'Fabric 1.0 Milestone',
    desc: 'Stable API, better mod compat, 30% faster loader.',
    theme: 6,
  },
];

const NEWS_ITEMS = [
  'Minecraft Live 2026 . New biome & mob reveal',
  'Sodium 0.7 released . Up to 40% FPS improvement',
  'Fabric 1.0 milestone . Stable API for modders',
  'TerraFirmaCraft returns . Hardcore survival revival',
  'Complementary Shaders v5 . Ray tracing for all GPUs',
  'Create Mod 6.0 . Mechanical marvels expanded',
];

function usePollLaunchState(interval = 2000) {
  const [runningGames, setRunningGames] = useState<RunningGameInfo[]>([]);
  useEffect(() => {
    const poll = async () => {
      try {
        setRunningGames(await api.getRunningGames());
      } catch {
        /* empty */
      }
    };
    poll();
    const timer = setInterval(poll, interval);

    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ state: string; instance_id?: string }>('launch-state-changed', () => {
        poll();
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      clearInterval(timer);
      unlisten?.();
    };
  }, [interval]);
  return { runningGames };
}

function getInstanceLaunchState(runningGames: RunningGameInfo[], instanceId: string | null): LaunchState {
  if (!instanceId) return 'idle';
  const game = runningGames.find((g) => g.instance_id === instanceId);
  return game ? game.state : 'idle';
}

function getLoaderIcon(loaderType: string | null): IconName {
  switch (loaderType) {
    case 'fabric':
      return 'fabric';
    case 'forge':
      return 'forge';
    case 'quilt':
      return 'quilt';
    case 'neoforge':
      return 'neoforge';
    default:
      return 'vanilla';
  }
}

function getLoaderLabel(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return 'Fabric';
    case 'forge':
      return 'Forge';
    case 'quilt':
      return 'Quilt';
    case 'neoforge':
      return 'NeoForge';
    default:
      return 'Vanilla';
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
  onSelect,
}: {
  instance: GameInstance;
  isActive: boolean;
  isReady: boolean | null;
  onLaunch: (inst: GameInstance) => void;
  onSelect: (inst: GameInstance) => void;
}) {
  const loaderLabel = getLoaderLabel(instance.loader_type);
  const playtimeLabel = formatPlaytime(instance.playtime_seconds);

  return (
    <div
      className={`${styles.card} ${isActive ? styles['card--active'] : styles['card--default']} card-hover-glow`}
      onClick={() => onSelect(instance)}
    >
      {isActive && <div className={styles.card__accent} />}
      <div className={styles.card__body}>
        <Tooltip content={`${loaderLabel}${instance.loader_version ? ` ${instance.loader_version}` : ''}`}>
          <div
            className={`${styles.card__icon} ${isActive ? styles['card__icon--active'] : styles['card__icon--default']}`}
          >
            <Icon name={getLoaderIcon(instance.loader_type)} size={12} />
          </div>
        </Tooltip>
        <div className={styles.card__info}>
          <div className={styles.card__nameRow}>
            <span
              className={`${styles.card__name} ${isActive ? styles['card__name--active'] : styles['card__name--default']}`}
            >
              {instance.name}
            </span>
            <Badge variant="accent">{instance.version_id}</Badge>
            {instance.loader_type && <Badge variant="muted">{instance.loader_type}</Badge>}
          </div>
          <div className={styles.card__meta}>
            <span className={styles.card__metaItem}>Last played: {relativeTime(instance.last_played)}</span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>{playtimeLabel}</span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>
              {isReady === null ? (
                <Icon name="hourglass" size={12} />
              ) : isReady ? (
                <>
                  <Icon name="checkCircle" size={12} /> Ready
                </>
              ) : (
                <>
                  <Icon name="warning" size={12} /> Needs download
                </>
              )}
            </span>
          </div>
        </div>
        <div className={styles.card__actions}>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onLaunch(instance);
            }}
          >
            <Icon name="play" size={14} /> START
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
  sysInfo,
  onLaunch,
  onReset,
  t,
}: {
  instance: GameInstance | null;
  isBusy: boolean;
  launchState: LaunchState;
  javaVersion: number | null;
  sysInfo: SystemInfo | null;
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
    idle: 'START',
    checking: 'CHECKING',
    downloading: 'DOWNLOADING',
    validating: 'VALIDATING',
    launching: 'LAUNCHING',
    running: 'RUNNING',
    exited: 'EXITED',
    crashed: 'CRASHED',
    error: 'ERROR',
  };

  const isError = launchState === 'crashed' || launchState === 'error';
  const canClick = (instance && !isBusy && !showCountdown) || launchState === 'exited' || isError;

  const handleClick = () => {
    if (showCountdown) return;
    if (launchState === 'exited' || isError) {
      onReset();
      setShowCountdown(false);
      setCountdown(null);
      if (!isBusy && instance) {
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
            <div
              className={`${styles.playArea__stateText} ${isBusy ? styles['playArea__stateText--busy'] : styles['playArea__stateText--idle']}`}
            >
              {stateLabel[launchState]}
            </div>
          ) : (
            <>
              <div className={`${styles.playArea__playIcon} play-pulse`}>
                <Icon name="play" size={14} />
              </div>
              <div className={styles.playArea__startWord}>{t('home.playArea.start')}</div>
              <div className={styles.playArea__startWord}>{t('home.playArea.game')}</div>
            </>
          )}

          {instance ? (
            <div className={styles.playArea__instanceInfo}>
              <div className={styles.playArea__version}>{instance.version_id}</div>
              <div className={styles.playArea__details}>
                {instance.loader_type ? `${getLoaderLabel(instance.loader_type)} . ` : ''}
                {Math.round(instance.max_memory / 1024)}GB
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
            {instance
              ? `${Math.round(instance.max_memory / 1024)}GB`
              : sysInfo
                ? `${Math.round(sysInfo.total_ram_mb / 1024)}GB`
                : '—'}
          </div>
          <div className={styles.statCard__label}>{t('home.playArea.ram')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCard__value}>
            {javaVersion ? `Java ${javaVersion}` : sysInfo?.java_version || '—'}
          </div>
          <div className={styles.statCard__label}>{t('home.playArea.jdk')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCard__value}>{sysInfo ? `${sysInfo.cpu_count}c` : '—'}</div>
          <div className={styles.statCard__label}>CPU</div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();
  const greeting = useGreeting(t);
  const auth = authState.currentUser;
  const instances = instState.instances;
  const recentInstances = useMemo(
    () =>
      [...instances]
        .sort((a, b) => {
          if (!a.last_played && !b.last_played) return 0;
          if (!a.last_played) return 1;
          if (!b.last_played) return -1;
          return b.last_played.localeCompare(a.last_played);
        })
        .slice(0, 3),
    [instances],
  );
  const { runningGames } = usePollLaunchState();
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [jreDownload, setJreDownload] = useState<JreDownloadProgress | null>(null);
  const [javaVersion, setJavaVersion] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [newsIndex, setNewsIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [newsEntries, setNewsEntries] = useState<MinecraftNewsEntry[]>([]);
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const activeInstance =
    recentInstances.find((i) => i.id === selectedInstanceId) ||
    (recentInstances.length > 0 ? recentInstances[0] : null);
  const launchState = getInstanceLaunchState(runningGames, activeInstance?.id ?? null);
  const activeInstanceRunning = activeInstance
    ? runningGames.some(
        (g) =>
          g.instance_id === activeInstance.id &&
          g.state !== 'exited' &&
          g.state !== 'crashed' &&
          g.state !== 'error' &&
          g.state !== 'idle',
      )
    : false;
  const isBusy = activeInstanceRunning;
  const anyGameRunning = runningGames.some(
    (g) =>
      g.state === 'running' ||
      g.state === 'launching' ||
      g.state === 'checking' ||
      g.state === 'downloading' ||
      g.state === 'validating',
  );
  const loading = instState.loading;

  // Check ready state for recent instances
  useEffect(() => {
    const checkAll = async () => {
      const states: Record<string, boolean | null> = {};
      for (const inst of recentInstances) {
        try {
          states[inst.id] = await api.checkInstanceReady(inst.id);
        } catch {
          states[inst.id] = null;
        }
      }
      setReadyStates(states);
    };
    if (recentInstances.length > 0) checkAll();
  }, [recentInstances]);

  useEffect(() => {
    const unlisten = api.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      if (progress.finished) setTimeout(() => setDownloadProgress(null), 2000);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = api.onJreDownloadProgress((p) => {
      setJreDownload(p);
      if (p.downloaded >= p.total && p.total > 0) {
        setTimeout(() => setJreDownload(null), 3000);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    api
      .findJava()
      .then((path) => api.checkJavaVersion(path).then(setJavaVersion))
      .catch(() => {});
    api
      .getSystemInfo()
      .then(setSysInfo)
      .catch(() => {});
  }, []);

  // Fetch Minecraft news
  useEffect(() => {
    api
      .getMinecraftNews()
      .then(setNewsEntries)
      .catch(() => {});
  }, []);

  // Rotate news items
  useEffect(() => {
    const count = newsEntries.length > 0 ? newsEntries.length : NEWS_ITEMS.length;
    const timer = setInterval(() => setNewsIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(timer);
  }, [newsEntries.length]);

  // Rotate banner carousel
  useEffect(() => {
    const count = newsEntries.length > 0 ? newsEntries.length : BANNER_SLIDES.length;
    const timer = setInterval(() => setBannerIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [newsEntries.length]);

  const handleLaunch = useCallback(
    async (instance: GameInstance) => {
      setError('');
      try {
        await api.launchGame(
          instance.version_id,
          instance.version_url,
          auth?.username || 'Player',
          auth?.uuid || '',
          auth?.access_token || '',
          instance.max_memory,
          instance.min_memory,
          instance.java_path || undefined,
          instance.jvm_args || undefined,
          instance.id,
        );
        addToast({ type: 'success', title: 'Game launched', message: `${instance.name} is starting...` });
      } catch (e: unknown) {
        const msg = formatError(e) || 'Launch failed';
        setError(msg);
        addToast({ type: 'error', title: 'Launch failed', message: msg });
        setTimeout(() => setError(''), 8000);
      }
    },
    [auth, addToast],
  );

  const handleQuickStart = useCallback(async () => {
    setError('');
    try {
      await api.quickStart();
      addToast({ type: 'success', title: 'Quick start', message: 'Launching latest Minecraft...' });
    } catch (e: unknown) {
      const msg = formatError(e) || 'Quick start failed';
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
                {isBusy ? (
                  'DOWNLOADING...'
                ) : (
                  <>
                    <Icon name="bolt" size={14} /> {t('home.quickStart')}
                  </>
                )}
              </Button>
              <Button variant="secondary-highlight" size="lg" onClick={() => navigate('/instances/new')}>
                + {t('home.newInstance')}
              </Button>
            </div>
            <p className={styles.emptyHero__hint}>{t('home.welcomeNewHint')}</p>
          </div>
        </div>
      )}

      {/* Banner carousel */}
      <div className={styles.bannerCarousel}>
        <div className={styles.bannerTrack} style={{ transform: `translateX(-${bannerIndex * 100}%)` }}>
          {newsEntries.length > 0
            ? newsEntries.map((news, i) => (
                <div key={news.id || i} className={`${styles.bannerSlide} ${styles[`bannerSlide--${(i % 6) + 1}`]}`}>
                  <div className={styles.bannerAccent} />
                  <div className={styles.bannerContent}>
                    <div className={styles.bannerLabel}>{news.category || 'Minecraft'}</div>
                    <div className={styles.bannerTitle}>{news.title}</div>
                    <div className={styles.bannerDesc}>{news.text}</div>
                  </div>
                  {news.image_url ? (
                    <div className={styles.bannerSlide__rightCover}>
                      <img
                        src={news.image_url}
                        alt={news.title}
                        className={styles.bannerSlide__coverImg}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className={styles.bannerSlide__rightCover}>
                      <div className={styles.bannerSlide__coverPlaceholder}>
                        <span className={styles.bannerSlide__coverIcon}>&#9670;</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            : BANNER_SLIDES.map((slide, i) => (
                <div key={i} className={`${styles.bannerSlide} ${styles[`bannerSlide--${slide.theme}`]}`}>
                  <div className={styles.bannerAccent} />
                  <div className={styles.bannerContent}>
                    <div className={styles.bannerLabel}>{slide.label}</div>
                    <div className={styles.bannerTitle}>{slide.title}</div>
                    <div className={styles.bannerDesc}>{slide.desc}</div>
                  </div>
                  <div className={styles.bannerSlide__rightCover}>
                    <div className={styles.bannerSlide__coverPlaceholder}>
                      <span className={styles.bannerSlide__coverIcon}>&#9670;</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
        <div className={styles.bannerDots}>
          {(newsEntries.length > 0 ? newsEntries : BANNER_SLIDES).map((_, i) => (
            <button
              key={i}
              className={`${styles.bannerDot} ${i === bannerIndex ? styles['bannerDot--active'] : ''}`}
              onClick={() => setBannerIndex(i)}
            />
          ))}
        </div>
        <button
          className={`${styles.bannerArrow} ${styles['bannerArrow--left']}`}
          onClick={() =>
            setBannerIndex(
              (i) =>
                (i - 1 + (newsEntries.length > 0 ? newsEntries.length : BANNER_SLIDES.length)) %
                (newsEntries.length > 0 ? newsEntries.length : BANNER_SLIDES.length),
            )
          }
        >
          <Icon name="chevronLeft" size={14} />
        </button>
        <button
          className={`${styles.bannerArrow} ${styles['bannerArrow--right']}`}
          onClick={() =>
            setBannerIndex((i) => (i + 1) % (newsEntries.length > 0 ? newsEntries.length : BANNER_SLIDES.length))
          }
        >
          <Icon name="play" size={14} />
        </button>
      </div>

      {/* Download overlay */}
      {downloadProgress && !downloadProgress.finished && (
        <div className={styles.downloadOverlay}>
          <div className={styles.downloadPanel}>
            <Heading level="md">
              {downloadProgress.phase === 'assets' ? t('home.downloadingAssets') : t('home.downloading')}
            </Heading>
            <div style={{ marginTop: 16 }}>
              <ProgressBar
                progress={
                  downloadProgress.total > 0
                    ? Math.round((downloadProgress.completed / downloadProgress.total) * 100)
                    : 0
                }
                done={false}
              />
            </div>
            <div className={styles.downloadStats}>
              <span className={styles.downloadStatItem}>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#FFE600' }}>
                  {downloadProgress.completed}/{downloadProgress.total}
                </span>
                {' . '}
                {downloadProgress.phase}
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

      {/* JRE download overlay */}
      {jreDownload && jreDownload.downloaded < jreDownload.total && (
        <div className={styles.downloadOverlay}>
          <div className={styles.downloadPanel}>
            <Heading level="md">DOWNLOADING JAVA RUNTIME</Heading>
            <div style={{ marginTop: 8, fontSize: '0.6em', color: '#888' }}>
              Java {jreDownload.version} from Adoptium
            </div>
            <div style={{ marginTop: 16 }}>
              <ProgressBar
                progress={jreDownload.total > 0 ? Math.round((jreDownload.downloaded / jreDownload.total) * 100) : 0}
                done={false}
              />
            </div>
            <div className={styles.downloadStats}>
              <span className={styles.downloadStatItem}>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#FFE600' }}>
                  {(jreDownload.downloaded / 1_048_576).toFixed(1)} MB / {(jreDownload.total / 1_048_576).toFixed(1)} MB
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && <div className={styles.errorToast}>{error}</div>}

      {/* Top bar */}
      <div className={styles.topBar}>
        <div>
          <Heading level="xl">{greeting.title}</Heading>
          <div className={styles.topBar__stats}>
            <span className={styles.topBar__username}>{auth?.username}</span>
            <div className={styles.topBar__statSep} />
            <span className={styles.topBar__statText}>
              {instances.length} {t('home.instances')}
            </span>
          </div>
        </div>
        <div className={styles.topBar__right}>
          <div className={styles.topBar__sysStatus}>
            <StatusDot status={isBusy ? 'processing' : anyGameRunning ? 'processing' : 'ready'} />
            <span className={styles.topBar__sysText}>
              {anyGameRunning
                ? `${runningGames.filter((g) => g.state === 'running').length} RUNNING`
                : launchState.toUpperCase()}
            </span>
          </div>
          <button
            onClick={() => setShowConsole((v) => !v)}
            style={{
              background: showConsole ? 'var(--color-accent-10)' : 'transparent',
              border: `1px solid ${showConsole ? 'var(--color-accent-30)' : 'var(--color-border)'}`,
              color: showConsole ? 'var(--color-accent)' : 'var(--color-text-dim)',
              padding: '3px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.42em',
              letterSpacing: 1,
              transition: 'all 0.15s',
            }}
          >
            {showConsole ? (
              <>
                <Icon name="chevronUp" size={12} /> CONSOLE
              </>
            ) : (
              <>
                <Icon name="chevronDown" size={12} /> CONSOLE
              </>
            )}
          </button>
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
                <span className={styles.instanceList__count}>{String(instances.length).padStart(2, '0')}</span>
              </div>
              <Button variant="primary" size="sm" onClick={() => navigate('/instances/new')}>
                + {t('home.newInstance')}
              </Button>
            </div>

            {instances.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyState__bar} />
                <div className={styles.emptyState__title}>{t('home.noInstancesTitle')}</div>
                <div className={styles.emptyState__desc}>{t('home.noInstancesDesc')}</div>
                <Button variant="primary" size="md" onClick={() => navigate('/instances/new')}>
                  + {t('home.newInstance')}
                </Button>
              </div>
            ) : (
              recentInstances.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  isActive={inst.id === (selectedInstanceId || recentInstances[0]?.id)}
                  isReady={readyStates[inst.id] ?? null}
                  onLaunch={handleLaunch}
                  onSelect={(inst) => setSelectedInstanceId(inst.id)}
                />
              ))
            )}

            {/* News panel */}
            <div className={styles.newsPanel}>
              <div className={styles.newsPanel__label}>{t('home.news')}</div>
              <div className={styles.newsItem} key={newsIndex}>
                <span className={styles.newsItem__bullet}>
                  <Icon name="bulletRight" size={10} />
                </span>
                {newsEntries.length > 0 ? newsEntries[newsIndex]?.title : NEWS_ITEMS[newsIndex]}
              </div>
              <div className={styles.newsPanel__dots}>
                {(newsEntries.length > 0 ? newsEntries : NEWS_ITEMS).map((_, i) => (
                  <div
                    key={i}
                    className={`${styles.newsPanel__dot} ${i === newsIndex ? styles['newsPanel__dot--active'] : ''}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <Ticker messages={NEWS_ITEMS} />
            </div>
          </div>

          {/* Right: PLAY area + quick actions */}
          <div
            style={{
              flex: 0.7,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              height: '100%',
              minHeight: 0,
              minWidth: 0,
              overflowY: 'auto',
            }}
          >
            <PlayArea
              instance={activeInstance}
              isBusy={isBusy}
              launchState={launchState}
              javaVersion={javaVersion}
              sysInfo={sysInfo}
              onLaunch={() => activeInstance && handleLaunch(activeInstance)}
              onReset={() =>
                activeInstance ? api.resetInstanceLaunchState(activeInstance.id) : api.resetLaunchState()
              }
              t={t}
            />

            {/* Quick actions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => navigate('/instances/new')}
              >
                + {t('home.quickActions.newInstance')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => navigate('/mods')}
              >
                <Icon name="download" size={14} /> {t('home.quickActions.browseMods')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => navigate('/versions')}
              >
                <Icon name="hexagon" size={14} /> {t('home.quickActions.versions')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ justifyContent: 'center', fontSize: '0.55em' }}
                onClick={() => navigate('/settings')}
              >
                <Icon name="settings" size={14} /> {t('home.quickActions.settings')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <GameConsole visible={showConsole} />
    </div>
  );
}
