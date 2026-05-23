import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, type DownloadProgressEvent, type LaunchState, type GameInstance, type SystemInfo, type JreDownloadProgress, type MinecraftNewsEntry } from '../api';
import { NewsArticleModal } from '../components/ui/NewsArticleModal';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { useGreeting } from '../hooks/useGreeting';
import { Heading, SubLabel, AccentCorner, Ticker } from '../components/layout';
import { StatusDot, Badge, ProgressBar, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import { OnboardingWizard, isOnboardingSkipped, isOnboardingCompleted, isOnboardingForceShow, clearForceShow } from '../components/ui';
import { CardSkeleton } from '../components/ui/Skeleton';
import GameConsole from '../components/ui/GameConsole';
import { relativeTime } from '../utils/time';
import styles from './HomePage.module.css';

function usePollLaunchState(interval = 2000) {
  const [s, setS] = useState<LaunchState>('idle');
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const poll = async () => {
      if (document.hidden) return;
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

function formatPlaytime(seconds: number, t: (key: string, params?: Record<string, string>) => string): string {
  if (seconds < 60) return t('home.playtimeLessMin');
  if (seconds < 3600) return t('home.playtimeMinutes', { mins: String(Math.round(seconds / 60)) });
  return t('home.playtimeHours', { hrs: (seconds / 3600).toFixed(1) });
}

function InstanceCard({
  instance,
  isActive,
  isReady,
  onLaunch,
  onSelect,
  t,
}: {
  instance: GameInstance;
  isActive: boolean;
  isReady: boolean | null;
  onLaunch: (inst: GameInstance) => void;
  onSelect: (inst: GameInstance) => void;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const loaderLabel = instance.loader_type ? t(`common.${instance.loader_type}`) : t('common.vanilla');
  const playtimeLabel = formatPlaytime(instance.playtime_seconds, t);

  return (
    <div
      className={`${styles.card} ${isActive ? styles['card--active'] : styles['card--default']} card-hover-glow`}
      onClick={() => onSelect(instance)}
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
              {t('home.lastPlayed')}: {relativeTime(instance.last_played)}
            </span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>{playtimeLabel}</span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>
              {isReady === null ? '⏳' : isReady ? '✅ ' + t('home.ready') : '⚠️ ' + t('home.needsDownload')}
            </span>
          </div>
        </div>
        <div className={styles.card__actions}>
          <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onLaunch(instance); }}>
            {'▶ ' + t('home.startBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlayArea({
  instance,
  instances,
  isBusy,
  launchState,
  javaVersion,
  sysInfo,
  onLaunch,
  onReset,
  onSelectInstance,
  t,
}: {
  instance: GameInstance | null;
  instances: GameInstance[];
  isBusy: boolean;
  launchState: LaunchState;
  javaVersion: number | null;
  sysInfo: SystemInfo | null;
  onLaunch: () => void;
  onReset: () => void;
  onSelectInstance: (inst: GameInstance) => void;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showInstanceSwitcher, setShowInstanceSwitcher] = useState(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

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
      setShowInstanceSwitcher(false);
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

  const handleInstanceSwitch = (inst: GameInstance) => {
    onSelectInstance(inst);
    setShowInstanceSwitcher(false);
  };

  return (
    <div className={styles.playArea}>
      <div
        className={`${styles.playArea__panel} ${canClick ? styles['playArea__panel--clickable'] : ''} ${isError ? styles['playArea__panel--error'] : ''} ${showCountdown ? styles['playArea__panel--countdown'] : ''}`}
        onClick={handleClick}
        data-tour="home-play"
      >
        <AccentCorner position="topRight" />
        <AccentCorner position="bottomLeft" />
        <div className={styles.playArea__inner} />
        <div className={styles.playArea__decorLine} />

        {showCountdown && (
          <div className={styles.countdownRing}>
            <div className={styles.countdownRingInner} />
          </div>
        )}

        <div className={styles.playArea__content}>
          {showCountdown ? (
            <div className={styles.countdownText}>
              <div className={styles.countdownLabel}>{t('home.launchingIn')}</div>
              <div className={styles.countdownNumber}>{countdown}</div>
            </div>
          ) : isBusy || launchState !== 'idle' ? (
            <div className={`${styles.playArea__stateText} ${isBusy ? styles['playArea__stateText--busy'] : styles['playArea__stateText--idle']}`}>
              {stateLabel[launchState]}
            </div>
          ) : (
            <>
              <div className={`${styles.playArea__playIcon} play-pulse`}>▶</div>
              <div className={styles.playArea__startWord}>{t('home.playArea.start')}</div>
              <div className={styles.playArea__startWord}>{t('home.playArea.game')}</div>
            </>
          )}

          {instance ? (
            <div className={styles.playArea__instanceInfo}>
              <div className={styles.playArea__instanceRow}>
                <div className={styles.playArea__version}>{instance.version_id}</div>
                {instances.length > 1 && !isBusy && !showCountdown && (
                  <button
                    className={styles.playArea__switchBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInstanceSwitcher((v) => !v);
                    }}
                    title="Switch instance"
                  >
                    ▾
                  </button>
                )}
              </div>
              <div className={styles.playArea__details}>
                {instance.loader_type ? `${t(`common.${instance.loader_type}`)} . ` : ''}{Math.round(instance.max_memory / 1024)}GB
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

        {showInstanceSwitcher && instances.length > 1 && (
          <div className={styles.instanceSwitcher} onClick={(e) => e.stopPropagation()}>
            {instances.map((inst) => (
              <button
                key={inst.id}
                className={`${styles.instanceSwitcher__item} ${inst.id === instance?.id ? styles['instanceSwitcher__item--active'] : ''}`}
                onClick={() => handleInstanceSwitch(inst)}
              >
                <span className={styles.instanceSwitcher__icon}>{getLoaderIcon(inst.loader_type)}</span>
                <span className={styles.instanceSwitcher__name}>{inst.name}</span>
                <span className={styles.instanceSwitcher__version}>{inst.version_id}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.quickStats}>
        <div className={styles.statCard}>
          <div className={styles.statCard__value}>
            {instance ? `${Math.round(instance.max_memory / 1024)}GB` : sysInfo ? `${Math.round(sysInfo.total_ram_mb / 1024)}GB` : '—'}
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
          <div className={styles.statCard__value}>
            {sysInfo ? `${sysInfo.cpu_count}c` : '—'}
          </div>
          <div className={styles.statCard__label}>CPU</div>
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
  const greeting = useGreeting(t);
  const auth = authState.currentUser!;
  const instances = instState.instances;
  const launchState = usePollLaunchState();
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [jreDownload, setJreDownload] = useState<JreDownloadProgress | null>(null);
  const [javaVersion, setJavaVersion] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [newsIndex, setNewsIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [instanceCoverImage, setInstanceCoverImage] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [newsEntries, setNewsEntries] = useState<MinecraftNewsEntry[]>([]);
  const [articleUrl, setArticleUrl] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleImageUrl, setArticleImageUrl] = useState<string | null>(null);
  const [showArticle, setShowArticle] = useState(false);

  const openArticle = useCallback((url: string, title?: string, imageUrl?: string | null) => {
    if (!url) return;
    setArticleUrl(url);
    setArticleTitle(title || '');
    setArticleImageUrl(imageUrl || null);
    setShowArticle(true);
  }, []);

  const lastDownloadUpdateRef = useRef(0);
  const lastJreUpdateRef = useRef(0);

  const FALLBACK_SLIDES = useMemo(() => [
    { label: t('home.bannerFeatured'), title: t('home.bannerSlide1Title'), desc: t('home.bannerSlide1Desc'), theme: 1, url: null as string | null, imageUrl: null as string | null },
    { label: t('home.bannerPerformance'), title: t('home.bannerSlide2Title'), desc: t('home.bannerSlide2Desc'), theme: 2, url: null as string | null, imageUrl: null as string | null },
    { label: t('home.bannerCommunity'), title: t('home.bannerSlide3Title'), desc: t('home.bannerSlide3Desc'), theme: 3, url: null as string | null, imageUrl: null as string | null },
    { label: t('home.bannerBonNext'), title: t('home.bannerSlide4Title'), desc: t('home.bannerSlide4Desc'), theme: 4, url: null as string | null, imageUrl: null as string | null },
    { label: t('home.bannerTechnology'), title: t('home.bannerSlide5Title'), desc: t('home.bannerSlide5Desc'), theme: 5, url: null as string | null, imageUrl: null as string | null },
    { label: t('home.bannerUpdates'), title: t('home.bannerSlide6Title'), desc: t('home.bannerSlide6Desc'), theme: 6, url: null as string | null, imageUrl: null as string | null },
  ], [t]);

  const BANNER_SLIDES = useMemo(() => {
    if (newsEntries.length > 0) {
      return newsEntries.slice(0, 6).map((entry, i) => ({
        label: entry.tag || entry.category,
        title: entry.title,
        desc: entry.text,
        theme: (i % 6) + 1,
        url: entry.read_more_link,
        imageUrl: entry.image_url,
      }));
    }
    return FALLBACK_SLIDES;
  }, [newsEntries, FALLBACK_SLIDES]);

  const NEWS_ITEMS = useMemo(() => {
    if (newsEntries.length > 0) {
      return newsEntries.slice(0, 6).map((entry) => ({
        title: entry.title,
        url: entry.read_more_link,
      }));
    }
    return [
      { title: t('home.news1'), url: null },
      { title: t('home.news2'), url: null },
      { title: t('home.news3'), url: null },
      { title: t('home.news4'), url: null },
      { title: t('home.news5'), url: null },
      { title: t('home.news6'), url: null },
    ];
  }, [newsEntries, t]);

  const recentInstances = useMemo(() =>
    [...instances]
      .sort((a, b) => {
        const aTime = a.last_played ? new Date(a.last_played).getTime() : 0;
        const bTime = b.last_played ? new Date(b.last_played).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 3),
    [instances]
  );

  const activeInstance = recentInstances.find((i) => i.id === selectedInstanceId)
    || (recentInstances.length > 0 ? recentInstances[0] : null);
  const isBusy = launchState !== 'idle' && launchState !== 'exited' && launchState !== 'crashed' && launchState !== 'error';
  const loading = instState.loading;

  // Check ready state for all instances
  useEffect(() => {
    const checkAll = async () => {
      const results = await Promise.allSettled(
        instances.map(inst => api.checkInstanceReady(inst.id))
      );
      const states: Record<string, boolean | null> = {};
      results.forEach((result, i) => {
        states[instances[i].id] = result.status === 'fulfilled' ? result.value : null;
      });
      setReadyStates(states);
    };
    if (instances.length > 0) checkAll();
  }, [instances]);

  useEffect(() => {
    const unlisten = api.onDownloadProgress((progress) => {
      const now = Date.now();
      if (progress.finished || now - lastDownloadUpdateRef.current >= 200) {
        lastDownloadUpdateRef.current = now;
        setDownloadProgress(progress);
      }
      if (progress.finished) setTimeout(() => setDownloadProgress(null), 2000);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = api.onJreDownloadProgress((p) => {
      const now = Date.now();
      const isDone = p.downloaded >= p.total && p.total > 0;
      if (isDone || now - lastJreUpdateRef.current >= 200) {
        lastJreUpdateRef.current = now;
        setJreDownload(p);
      }
      if (isDone) {
        setTimeout(() => setJreDownload(null), 3000);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    api.findJava().then((path) => api.checkJavaVersion(path).then(setJavaVersion)).catch(() => {});
    api.getSystemInfo().then(setSysInfo).catch(() => {});
  }, []);

  useEffect(() => {
    api.getMinecraftNews().then(setNewsEntries).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeInstance) {
      api.getInstanceCoverImage(activeInstance.id).then(setInstanceCoverImage).catch(() => setInstanceCoverImage(null));
    } else {
      setInstanceCoverImage(null);
    }
  }, [activeInstance]);

  useEffect(() => {
    const forceShow = isOnboardingForceShow();
    const shouldShow = !loading && !isOnboardingSkipped() && !isOnboardingCompleted()
      && (instances.length === 0 || forceShow);
    if (shouldShow) {
      if (forceShow) clearForceShow();
      setShowWizard(true);
    }
  }, [loading, instances.length]);

  // Rotate news items
  useEffect(() => {
    const timer = setInterval(() => setNewsIndex((i) => (i + 1) % NEWS_ITEMS.length), 5000);
    return () => clearInterval(timer);
  }, [NEWS_ITEMS.length]);

  // Rotate banner carousel
  useEffect(() => {
    const total = BANNER_SLIDES.length + 1;
    const timer = setInterval(() => setBannerIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(timer);
  }, [BANNER_SLIDES.length]);

  const handleLaunch = useCallback(async (instance: GameInstance) => {
    setError('');
    try {
      await api.launchGame(
        instance.version_id, instance.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', instance.max_memory, instance.min_memory,
        instance.java_path || undefined, instance.jvm_args || undefined,
        instance.id,
      );
      addToast({ type: 'success', title: t('home.gameLaunched'), message: t('instances.isStarting', { name: instance.name }) });
    } catch (e: any) {
      const msg = e?.toString() || t('instances.launchFailed');
      setError(msg);
      addToast({ type: 'error', title: t('instances.launchFailed'), message: msg });
      setTimeout(() => setError(''), 8000);
    }
  }, [auth, addToast, t]);

  return (
    <div className={`page-enter ${styles.page}`}>

      {/* Banner carousel */}
      <div className={styles.bannerCarousel}>
        <div className={styles.bannerTrack} style={{ transform: `translateX(-${bannerIndex * 100}%)` }}>
          {/* First slide: instance cover */}
          <div className={`${styles.bannerSlide} ${styles['bannerSlide--instance']}`}>
            <div className={styles.bannerAccent} />
            <div className={styles.bannerSlide__leftContent}>
              <div className={styles.bannerLabel}>
                {activeInstance ? (activeInstance.loader_type ? t(`common.${activeInstance.loader_type}`).toUpperCase() : t('home.bannerVanilla')) : t('home.bannerReady')}
              </div>
              <div className={styles.bannerTitle}>
                {activeInstance ? activeInstance.name : t('home.welcomeNew')}
              </div>
              <div className={styles.bannerDesc}>
                {activeInstance
                  ? `${activeInstance.version_id}${activeInstance.loader_version ? ` · ${activeInstance.loader_version}` : ''} · ${Math.round(activeInstance.max_memory / 1024)}GB · ${formatPlaytime(activeInstance.playtime_seconds, t)}`
                  : t('home.welcomeNewDesc')
                }
              </div>
            </div>
            <div className={styles.bannerSlide__rightCover}>
              {instanceCoverImage ? (
                <img
                  src={instanceCoverImage}
                  alt="World preview"
                  className={styles.bannerSlide__coverImg}
                />
              ) : (
                <div className={styles.bannerSlide__coverPlaceholder}>
                  <span className={styles.bannerSlide__coverIcon}>◈</span>
                </div>
              )}
            </div>
          </div>

          {/* Other slides */}
          {BANNER_SLIDES.map((slide, i) => (
            <div
              key={i}
              className={`${styles.bannerSlide} ${styles[`bannerSlide--${slide.theme}`]}`}
              style={{
                cursor: slide.url ? 'pointer' : 'default',
                ...(slide.imageUrl ? { backgroundImage: `url(${slide.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
              }}
              onClick={() => { if (slide.url) openArticle(slide.url, slide.title, slide.imageUrl); }}
            >
              <div className={styles.bannerAccent} />
              <div className={styles.bannerContent}>
                <div className={styles.bannerLabel}>{slide.label}</div>
                <div className={styles.bannerTitle}>{slide.title}</div>
                <div className={styles.bannerDesc}>{slide.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.bannerDots}>
          {[null, ...BANNER_SLIDES].map((_, i) => (
            <button key={i} className={`${styles.bannerDot} ${i === bannerIndex ? styles['bannerDot--active'] : ''}`} onClick={() => setBannerIndex(i)} />
          ))}
        </div>
        <button className={`${styles.bannerArrow} ${styles['bannerArrow--left']}`} onClick={() => setBannerIndex((i) => (i - 1 + (BANNER_SLIDES.length + 1)) % (BANNER_SLIDES.length + 1))}>◀</button>
        <button className={`${styles.bannerArrow} ${styles['bannerArrow--right']}`} onClick={() => setBannerIndex((i) => (i + 1) % (BANNER_SLIDES.length + 1))}>▶</button>
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

      {/* JRE download overlay */}
      {jreDownload && jreDownload.downloaded < jreDownload.total && (
        <div className={styles.downloadOverlay}>
          <div className={styles.downloadPanel}>
            <Heading level="md">{t('home.downloadingJava')}</Heading>
            <div style={{ marginTop: 8, fontSize: '0.6em', color: '#888' }}>
              {t('home.javaFromAdoptium', { version: String(jreDownload.version) })}
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
          <button
            onClick={() => setShowConsole((v) => !v)}
            style={{
              background: showConsole ? 'rgba(255,230,0,0.1)' : 'transparent',
              border: `1px solid ${showConsole ? 'rgba(255,230,0,0.3)' : '#1F1F1F'}`,
              color: showConsole ? '#FFE600' : '#555',
              padding: '3px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '0.42em',
              letterSpacing: 1, transition: 'all 0.15s',
            }}
          >
            {showConsole ? '▲ ' + t('home.console') : '▼ ' + t('home.console')}
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
          {/* Left: recent instances */}
          <div className={styles.instanceList}>
            <div className={styles.instanceList__header}>
              <div className={styles.instanceList__title}>
                <SubLabel>{t('home.instancesHeader')}</SubLabel>
                <span className={styles.instanceList__count}>
                  {String(recentInstances.length).padStart(2, '0')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {instances.length > 3 && (
                  <Button variant="secondary" size="sm" onClick={() => window.location.hash = '#/instances'}>
                    {t('home.viewAll')}
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => window.location.hash = '#/instances/new'} data-tour="home-new-instance">
                  + {t('home.newInstance')}
                </Button>
              </div>
            </div>

            {recentInstances.length > 0 && (
              recentInstances.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  isActive={inst.id === (selectedInstanceId || recentInstances[0]?.id)}
                  isReady={readyStates[inst.id] ?? null}
                  onLaunch={handleLaunch}
                  onSelect={(inst) => setSelectedInstanceId(inst.id)}
                  t={t}
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
                  cursor: NEWS_ITEMS[newsIndex]?.url ? 'pointer' : 'default',
                }}
                onClick={() => {
                  const item = NEWS_ITEMS[newsIndex];
                  if (item?.url) openArticle(item.url, item.title);
                }}
              >
                <span style={{ color: '#FFE600', marginRight: 6 }}>{'▸'}</span>
                {NEWS_ITEMS[newsIndex]?.title}
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
              <Ticker messages={NEWS_ITEMS.map(item => item.title)} />
            </div>
          </div>

          {/* Right: PLAY area + quick actions */}
          <div style={{ flex: 0.7, display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
            <PlayArea
              instance={activeInstance}
              instances={recentInstances}
              isBusy={isBusy}
              launchState={launchState}
              javaVersion={javaVersion}
              sysInfo={sysInfo}
              onLaunch={() => activeInstance && handleLaunch(activeInstance)}
              onReset={() => api.resetLaunchState()}
              onSelectInstance={(inst) => setSelectedInstanceId(inst.id)}
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

      <GameConsole visible={showConsole} />

      <OnboardingWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
      />

      <NewsArticleModal
        open={showArticle}
        onClose={() => setShowArticle(false)}
        articleUrl={articleUrl}
        articleTitle={articleTitle}
        articleImageUrl={articleImageUrl}
      />
    </div>
  );
}
