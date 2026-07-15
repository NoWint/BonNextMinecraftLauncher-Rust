import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatError, handleAuthExpired } from '../../../shared/utils/errorMapping';
import {
  api,
  type DownloadProgressEvent,
  type LaunchState,
  type RunningGameInfo,
  type GameInstance,
  type SystemInfo,
  type JreDownloadProgress,
  type MinecraftNewsEntry,
} from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useToast } from '../../../shared/stores/toastStore';
import { useI18n } from '../../../shared/i18n';
import { useGreeting } from '../../../shared/hooks/useGreeting';
import { usePluginManager } from '../../../app/hooks/usePluginManager';
import { Heading, SubLabel, AccentCorner, Ticker } from '../components/layout';
import { StatusDot, Badge, ProgressBar, Tooltip, Modal } from '../components/ui';
import { Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { getLoaderIcon, getLoaderLabel } from '../../../shared/utils/loader';
import { formatPlaytime } from '../../../shared/utils/playtime';
import { useTheme } from '../../../shared/stores/themeStore';
import { CardSkeleton } from '../components/ui/Skeleton';
import GameConsole from '../components/ui/GameConsole';
import { SkinViewer3D } from '../components/ui';
import { relativeTime } from '../../../shared/utils/time';
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
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    let listenResolveCount = 0;

    const poll = async () => {
      try {
        if (cancelled) return;
        setRunningGames(await api.getRunningGames());
      } catch {
        /* empty */
      }
    };

    // 首次拉取一次（延迟 1.5s 避开启动期 IPC 竞争），之后改为事件驱动。
    // 之前每 2s 轮询 + 事件双轨，后台挂机 1 小时 = 1800 次冗余 IPC；
    // 且 listen() 异步未 resolve 时组件卸载会泄漏 listener（unlisten 仍为 null）。
    const initialTimer = setTimeout(poll, 1500);

    // 兜底心跳：仅在事件丢失时补偿（拉长到 30s，避免完全依赖事件）。
    const heartbeatTimer = setInterval(poll, Math.max(interval, 30000));

    import('@tauri-apps/api/event').then(({ listen }) => {
      // 组件已卸载则不注册，避免泄漏。
      if (cancelled) return;
      listen<{ state: string; instance_id?: string }>('launch-state-changed', () => {
        poll();
      }).then((fn) => {
        // 注册完成；若期间已卸载，立即取消注册。
        listenResolveCount += 1;
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(heartbeatTimer);
      unlisten?.();
      // listen() 可能在 cleanup 后才 resolve，无法在此清理；
      // 上面 cancelled 标志使 then 回调内自调用 fn() 兜底卸载。
      void listenResolveCount;
    };
  }, [interval]);
  return { runningGames };
}

function getInstanceLaunchState(runningGames: RunningGameInfo[], instanceId: string | null): LaunchState {
  if (!instanceId) return 'idle';
  const game = runningGames.find((g) => g.instance_id === instanceId);
  return game ? game.state : 'idle';
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
  const { t } = useI18n();
  const loaderLabel = getLoaderLabel(instance.loader_type);
  const playtimeLabel = formatPlaytime(instance.playtime_seconds, 'played');

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
            <span className={styles.card__metaItem}>
              {t('instances.lastPlayed')}: {relativeTime(instance.last_played)}
            </span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>{playtimeLabel}</span>
            <span className={styles.card__metaSep}>.</span>
            <span className={styles.card__metaItem}>
              {isReady === null ? (
                <Icon name="hourglass" size={12} />
              ) : isReady ? (
                <>
                  <Icon name="checkCircle" size={12} /> {t('common.ready')}
                </>
              ) : (
                <>
                  <Icon name="warning" size={12} /> {t('common.needsDownload')}
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
            <Icon name="play" size={14} /> {t('home.playArea.start')}
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
    idle: t('home.stateLabel.idle'),
    checking: t('home.stateLabel.checking'),
    downloading: t('home.stateLabel.downloading'),
    validating: t('home.stateLabel.validating'),
    launching: t('home.stateLabel.launching'),
    running: t('home.stateLabel.running'),
    exited: t('home.stateLabel.exited'),
    crashed: t('home.stateLabel.crashed'),
    error: t('home.stateLabel.error'),
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
              <div className={styles.countdownLabel}>{t('home.countdown.launchingIn')}</div>
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
  const pluginManager = usePluginManager();
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
  const { homeMode, setHomeMode, homeBackground, setHomeBackground, homeBlurEnabled, setHomeBlurEnabled } = useTheme();
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressEvent | null>(null);
  const [jreDownload, setJreDownload] = useState<JreDownloadProgress | null>(null);
  const [javaVersion, setJavaVersion] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [newsIndex, setNewsIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [newsEntries, setNewsEntries] = useState<MinecraftNewsEntry[]>([]);
  const [selectedNews, setSelectedNews] = useState<MinecraftNewsEntry | null>(null);
  const [readyStates, setReadyStates] = useState<Record<string, boolean | null>>({});
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [showBgPopover, setShowBgPopover] = useState(false);
  const [showVersionPopup, setShowVersionPopup] = useState(false);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [skinModel, setSkinModel] = useState<'default' | 'slim' | 'auto-detect'>('auto-detect');
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

  // Check ready state for recent instances — 延迟 2 秒避免与启动期 IPC 竞争
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const checkAll = async () => {
        const states: Record<string, boolean | null> = {};
        for (const inst of recentInstances) {
          if (cancelled) return;
          try {
            states[inst.id] = await api.checkInstanceReady(inst.id);
          } catch {
            states[inst.id] = null;
          }
        }
        if (!cancelled) setReadyStates(states);
      };
      if (recentInstances.length > 0) checkAll();
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recentInstances]);

  useEffect(() => {
    let cancelled = false;
    const unlisten = api.onDownloadProgress((progress) => {
      if (cancelled) return;
      setDownloadProgress(progress);
      if (progress.finished)
        setTimeout(() => {
          if (!cancelled) setDownloadProgress(null);
        }, 2000);
    });
    return () => {
      cancelled = true;
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unlisten = api.onJreDownloadProgress((p) => {
      if (cancelled) return;
      setJreDownload(p);
      if (p.downloaded >= p.total && p.total > 0) {
        setTimeout(() => {
          if (!cancelled) setJreDownload(null);
        }, 3000);
      }
    });
    return () => {
      cancelled = true;
      unlisten.then((fn) => fn());
    };
  }, []);

  // Java 检测和系统信息：延迟到首屏渲染后执行，避免 macOS 上
  // /usr/libexec/java_home 串行 spawn 11 个子进程阻塞启动。
  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .findJava()
        .then((path) => api.checkJavaVersion(path).then(setJavaVersion))
        .catch(() => {});
      api
        .getSystemInfo()
        .then(setSysInfo)
        .catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch Minecraft news — 延迟 2.5 秒，新闻非首屏关键内容
  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .getMinecraftNews()
        .then(setNewsEntries)
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // 获取当前账号的玩家皮肤 URL（极简模式左侧展示）
  useEffect(() => {
    if (homeMode !== 'minimalist') return;
    let cancelled = false;
    const loadSkin = async () => {
      try {
        const accounts = await api.listAccounts();
        const active = await api.getActiveAccount();
        const account = accounts.find((a) => a.id === active?.id) || active;
        if (!account || cancelled) return;
        // 优先使用本地皮肤
        if (account.local_skin_path) {
          const b64 = await api.readSkinFile(account.local_skin_path);
          if (cancelled) return;
          setSkinUrl(`data:image/png;base64,${b64}`);
          setSkinModel(account.local_skin_model === 'slim' ? 'slim' : 'default');
          return;
        }
        // Microsoft 账号：尝试获取在线皮肤
        if (
          account.access_token &&
          !account.access_token.startsWith('offline_') &&
          !account.access_token.startsWith('yggdrasil_')
        ) {
          try {
            const profile = await api.microsoftGetSkinProfile(account.access_token);
            if (cancelled) return;
            const activeSkin = profile.skins?.find((s) => s.state === 'ACTIVE');
            if (activeSkin?.url) {
              setSkinUrl(activeSkin.url);
              setSkinModel(activeSkin.variant === 'SLIM' ? 'slim' : 'default');
              return;
            }
          } catch {
            // token 可能过期，忽略
          }
        }
        // 回退：Crafatar 渲染服务
        if (account.uuid) {
          const cleanUuid = account.uuid.replace(/-/g, '');
          setSkinUrl(`https://crafatar.com/renders/body/${cleanUuid}?overlay&scale=6`);
          setSkinModel('auto-detect');
        }
      } catch {
        // 忽略错误
      }
    };
    const timer = setTimeout(loadSkin, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [homeMode, auth?.uuid]);

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

      // beforeInstanceLaunch 钩子（可拦截）
      const beforeResult = await pluginManager.emitLifecycleHook('beforeInstanceLaunch', {
        instanceId: instance.id,
        instanceName: instance.name,
        versionId: instance.version_id,
      });
      if (!beforeResult.allow) {
        const msg = beforeResult.reason ?? 'Launch blocked by plugin';
        setError(msg);
        addToast({ type: 'warning', title: 'Launch blocked', message: msg });
        return;
      }

      let launchSuccess = false;
      let launchError: string | undefined;
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
        launchSuccess = true;
        addToast({ type: 'success', title: t('home.gameLaunched'), message: `${instance.name} is starting...` });
      } catch (e: unknown) {
        // 后端 ensure_fresh_token 通常透明刷新 token，但并发场景或网络分区下
        // 仍可能返回 AUTH_EXPIRED。此处做一次兜底：刷新成功后重试一次启动。
        const refreshed = await handleAuthExpired(e);
        if (refreshed) {
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
            launchSuccess = true;
            addToast({ type: 'success', title: t('home.gameLaunched'), message: `${instance.name} is starting...` });
          } catch (e2: unknown) {
            const msg = formatError(e2) || 'Launch failed';
            launchError = msg;
            setError(msg);
            addToast({ type: 'error', title: 'Launch failed', message: msg });
            setTimeout(() => setError(''), 8000);
          }
        } else {
          const msg = formatError(e) || 'Launch failed';
          launchError = msg;
          setError(msg);
          addToast({ type: 'error', title: 'Launch failed', message: msg });
          setTimeout(() => setError(''), 8000);
        }
      } finally {
        // afterInstanceLaunch 钩子（fire-and-forget）
        await pluginManager.emitLifecycleHook('afterInstanceLaunch', {
          instanceId: instance.id,
          instanceName: instance.name,
          versionId: instance.version_id,
          success: launchSuccess,
          error: launchError,
        });
      }
    },
    [auth, addToast, pluginManager],
  );

  const handleQuickStart = useCallback(async () => {
    setError('');
    try {
      await api.quickStart();
      addToast({ type: 'success', title: t('home.quickStart.title'), message: t('home.quickStart.launching') });
    } catch (e: unknown) {
      const msg = formatError(e) || t('home.quickStart.failed');
      setError(msg);
      addToast({ type: 'error', title: t('home.quickStart.failed'), message: msg });
    }
  }, [addToast]);

  // 背景图上传：仪表盘与极简模式共用
  const handleBackgroundUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          setHomeBackground(result);
          addToast({ type: 'success', title: t('home.minimalist.backgroundSettings'), message: file.name });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [setHomeBackground, addToast, t],
  );

  // 根据模糊开关切换 body class（影响全局极简模式样式）
  useEffect(() => {
    if (homeMode === 'minimalist' && !homeBlurEnabled) {
      document.body.classList.add('home-blur-disabled');
    } else {
      document.body.classList.remove('home-blur-disabled');
    }
    return () => {
      document.body.classList.remove('home-blur-disabled');
    };
  }, [homeMode, homeBlurEnabled]);

  const handleClearBackground = useCallback(() => {
    setHomeBackground(null);
    setShowBgPopover(false);
  }, [setHomeBackground]);

  // 切换主页模式
  const handleToggleHomeMode = useCallback(() => {
    setHomeMode(homeMode === 'dashboard' ? 'minimalist' : 'dashboard');
    setShowBgPopover(false);
    setShowVersionPopup(false);
  }, [homeMode, setHomeMode]);

  return (
    <>
      {homeMode === 'minimalist' ? (
        <div className={`page-enter ${styles.minimalistPage}`}>
          {/* 左侧玩家皮肤模型（背景透明） */}
          <div className={styles.minimalistSkin}>
            <SkinViewer3D
              skinUrl={skinUrl}
              model={skinModel}
              width={240}
              height={360}
              className={styles.minimalistSkin__viewer}
            />
            <div className={styles.minimalistSkin__name}>{auth?.username || 'Player'}</div>
          </div>

          {/* 左上角账号信息 */}
          <div className={styles.minimalistAccount}>
            <div className={styles.minimalistAccount__avatar}>{(auth?.username || '?').charAt(0).toUpperCase()}</div>
            <span className={styles.minimalistAccount__name}>{auth?.username || 'Player'}</span>
            <span>·</span>
            <span>
              {instances.length} {t('home.instances')}
            </span>
          </div>

          {/* 左上角用户名下方的大标题招呼语（纯文字） */}
          <h1 className={styles.minimalistGreeting}>
            {anyGameRunning ? t('home.minimalist.continueGame') : greeting.title}
          </h1>

          {/* 右上角工具栏 */}
          <div className={styles.minimalistToolbar}>
            <div className={styles.topBar__sysStatus} style={{ marginRight: 4 }}>
              <StatusDot status={isBusy ? 'processing' : anyGameRunning ? 'processing' : 'ready'} />
              <span className={styles.topBar__sysText}>
                {anyGameRunning
                  ? t('home.topbar.runningCount', {
                      count: String(runningGames.filter((g) => g.state === 'running').length),
                    })
                  : launchState.toUpperCase()}
              </span>
            </div>
            <button
              onClick={handleToggleHomeMode}
              title={t('home.minimalist.modeToggle')}
              className={styles.minimalistBtn}
            >
              <Icon name="grid" size={12} /> {t('home.minimalist.dashboardMode')}
            </button>
            <button
              onClick={() => setShowBgPopover((v) => !v)}
              title={t('home.minimalist.backgroundSettings')}
              className={`${styles.minimalistBtn} ${showBgPopover ? styles['minimalistBtn--active'] : ''}`}
            >
              <Icon name="palette" size={12} /> {t('home.topbar.customize')}
            </button>
            <button
              onClick={() => setShowConsole((v) => !v)}
              className={`${styles.minimalistBtn} ${showConsole ? styles['minimalistBtn--active'] : ''}`}
            >
              <Icon name={showConsole ? 'chevronUp' : 'chevronDown'} size={12} /> {t('home.topbar.console')}
            </button>
          </div>

          {/* 背景设置浮层 */}
          {showBgPopover && (
            <div className={styles.bgPopover}>
              <div className={styles.bgPopover__title}>{t('home.minimalist.backgroundSettings')}</div>
              <div className={styles.bgPopover__hint}>{t('home.minimalist.backgroundHint')}</div>
              <div className={styles.bgPopover__actions}>
                <label className={styles.bgPopover__btn} title={t('home.topbar.uploadBackground')}>
                  <Icon name="upload" size={12} /> {t('home.minimalist.uploadBackground')}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBackgroundUpload} />
                </label>
                {homeBackground && (
                  <button
                    onClick={handleClearBackground}
                    className={`${styles.bgPopover__btn} ${styles['bgPopover__btn--danger']}`}
                    title={t('home.topbar.clearBackground')}
                  >
                    <Icon name="cross" size={12} /> {t('home.minimalist.clearBackground')}
                  </button>
                )}
              </div>
              {/* 模糊效果开关 */}
              <div className={styles.bgPopover__toggleRow}>
                <span className={styles.bgPopover__toggleLabel}>{t('home.minimalist.blurEnabled')}</span>
                <button
                  onClick={() => setHomeBlurEnabled(!homeBlurEnabled)}
                  className={`${styles.bgPopover__toggle} ${homeBlurEnabled ? styles['bgPopover__toggle--on'] : ''}`}
                  role="switch"
                  aria-checked={homeBlurEnabled}
                  title={t('home.minimalist.blurEnabledDesc')}
                >
                  <span className={styles.bgPopover__toggleKnob} />
                </button>
              </div>
            </div>
          )}

          {/* 实例切换弹出菜单 */}
          {showVersionPopup && (
            <div className={styles.versionPopup}>
              <div className={styles.versionPopup__header}>{t('home.minimalist.switchVersion')}</div>
              {instances.length === 0 ? (
                <div className={styles.versionPopup__empty}>{t('home.minimalist.noInstance')}</div>
              ) : (
                instances.map((inst) => (
                  <div
                    key={inst.id}
                    className={`${styles.versionPopup__item} ${inst.id === activeInstance?.id ? styles['versionPopup__item--active'] : ''}`}
                    onClick={() => {
                      setSelectedInstanceId(inst.id);
                      setShowVersionPopup(false);
                    }}
                  >
                    <div className={styles.versionPopup__icon}>{(inst.name || '?').charAt(0).toUpperCase()}</div>
                    <div className={styles.versionPopup__info}>
                      <div className={styles.versionPopup__name}>{inst.name}</div>
                      <div className={styles.versionPopup__meta}>
                        {inst.version_id}
                        {inst.loader_type ? ` · ${inst.loader_type}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 下载进度浮层 */}
          {downloadProgress && !downloadProgress.finished && (
            <div className={styles.minimalistOverlay}>
              <div className={styles.minimalistOverlay__title}>
                {downloadProgress.phase === 'assets' ? t('home.downloadingAssets') : t('home.downloading')}
              </div>
              <ProgressBar
                progress={
                  downloadProgress.total > 0
                    ? Math.round((downloadProgress.completed / downloadProgress.total) * 100)
                    : 0
                }
                done={false}
              />
              <div className={styles.minimalistOverlay__stats}>
                {downloadProgress.completed}/{downloadProgress.total} · {downloadProgress.phase}
              </div>
            </div>
          )}

          {/* JRE 下载浮层 */}
          {jreDownload && jreDownload.downloaded < jreDownload.total && (
            <div className={styles.minimalistOverlay}>
              <div className={styles.minimalistOverlay__title}>{t('home.jreDownload.title')}</div>
              <div className={styles.bgPopover__hint}>
                {t('home.jreDownload.subtitle', { version: String(jreDownload.version) })}
              </div>
              <ProgressBar
                progress={jreDownload.total > 0 ? Math.round((jreDownload.downloaded / jreDownload.total) * 100) : 0}
                done={false}
              />
              <div className={styles.minimalistOverlay__stats}>
                {(jreDownload.downloaded / 1_048_576).toFixed(1)} MB / {(jreDownload.total / 1_048_576).toFixed(1)} MB
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && <div className={styles.minimalistError}>{error}</div>}

          {/* 右下角启动按钮（HMCL 风格胶囊） */}
          <div className={styles.launchPane}>
            <button
              className={styles.launchPane__main}
              onClick={() => activeInstance && handleLaunch(activeInstance)}
              disabled={!activeInstance || isBusy}
              title={activeInstance ? t('home.minimalist.launch') : t('home.minimalist.launchHint')}
            >
              <span className={styles.launchPane__mainLabel}>
                {activeInstance ? t('home.minimalist.launch') : t('home.minimalist.launchNoVersion')}
              </span>
              {activeInstance && <span className={styles.launchPane__subLabel}>{activeInstance.name}</span>}
            </button>
            <button
              className={styles.launchPane__menu}
              onClick={() => setShowVersionPopup((v) => !v)}
              title={t('home.minimalist.switchVersion')}
            >
              <Icon name="chevronUp" size={16} />
            </button>
          </div>

          {/* 空实例时的新手引导 */}
          {instances.length === 0 && !loading && (
            <div className={styles.minimalistOverlay} style={{ maxWidth: 400 }}>
              <div className={styles.minimalistOverlay__title}>{t('home.welcomeNew')}</div>
              <div className={styles.bgPopover__hint} style={{ marginBottom: 12 }}>
                {t('home.welcomeNewDesc')}
              </div>
              <div className={styles.bgPopover__actions}>
                <Button variant="primary" size="md" onClick={handleQuickStart} disabled={isBusy}>
                  <Icon name="bolt" size={14} /> {t('home.quickStart')}
                </Button>
                <Button variant="secondary" size="md" onClick={() => navigate('/instances/new')}>
                  + {t('home.newInstance')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
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
                      t('home.quickStart.downloading')
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
                    <div
                      key={news.id || i}
                      className={`${styles.bannerSlide} ${styles[`bannerSlide--${(i % 6) + 1}`]}`}
                      onClick={() => setSelectedNews(news)}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedNews(news);
                        }
                      }}
                    >
                      <div className={styles.bannerAccent} />
                      <div className={styles.bannerContent}>
                        <div className={styles.bannerLabel}>{news.category || t('home.banner.defaultCategory')}</div>
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
                <Heading level="md">{t('home.jreDownload.title')}</Heading>
                <div style={{ marginTop: 8, fontSize: '0.6em', color: '#888' }}>
                  {t('home.jreDownload.subtitle', { version: String(jreDownload.version) })}
                </div>
                <div style={{ marginTop: 16 }}>
                  <ProgressBar
                    progress={
                      jreDownload.total > 0 ? Math.round((jreDownload.downloaded / jreDownload.total) * 100) : 0
                    }
                    done={false}
                  />
                </div>
                <div className={styles.downloadStats}>
                  <span className={styles.downloadStatItem}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#FFE600' }}>
                      {(jreDownload.downloaded / 1_048_576).toFixed(1)} MB /{' '}
                      {(jreDownload.total / 1_048_576).toFixed(1)} MB
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
            <div className={styles.topBar__right} style={{ position: 'relative' }}>
              <div className={styles.topBar__sysStatus}>
                <StatusDot status={isBusy ? 'processing' : anyGameRunning ? 'processing' : 'ready'} />
                <span className={styles.topBar__sysText}>
                  {anyGameRunning
                    ? t('home.topbar.runningCount', {
                        count: String(runningGames.filter((g) => g.state === 'running').length),
                      })
                    : launchState.toUpperCase()}
                </span>
              </div>
              {/* 模式切换按钮：仪表盘 ↔ 极简 */}
              <button
                onClick={handleToggleHomeMode}
                title={t('home.minimalist.modeToggle')}
                className={styles.topBar__btn}
              >
                <Icon name="grid" size={12} /> {t('home.minimalist.minimalistMode')}
              </button>
              {/* 自定义按钮：打开背景设置浮层（两种模式都可用） */}
              <button
                onClick={() => setShowBgPopover((v) => !v)}
                title={t('home.minimalist.backgroundSettings')}
                className={`${styles.topBar__btn} ${showBgPopover ? styles['topBar__btn--active'] : ''}`}
              >
                <Icon name="palette" size={12} /> {t('home.topbar.customize')}
              </button>
              {showBgPopover && (
                <div className={styles.topBar__bgPopover}>
                  <div className={styles.topBar__bgPopoverTitle}>{t('home.minimalist.backgroundSettings')}</div>
                  <div className={styles.topBar__bgPopoverHint}>{t('home.minimalist.backgroundHint')}</div>
                  <div className={styles.topBar__bgPopoverActions}>
                    <label className={styles.topBar__bgPopoverBtn} title={t('home.topbar.uploadBackground')}>
                      <Icon name="upload" size={12} /> {t('home.minimalist.uploadBackground')}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleBackgroundUpload}
                      />
                    </label>
                    {homeBackground && (
                      <button
                        onClick={handleClearBackground}
                        className={`${styles.topBar__bgPopoverBtn} ${styles['topBar__bgPopoverBtn--danger']}`}
                        title={t('home.topbar.clearBackground')}
                      >
                        <Icon name="cross" size={12} /> {t('home.minimalist.clearBackground')}
                      </button>
                    )}
                  </div>
                </div>
              )}
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

          {/* 资讯文章弹窗：点击 banner 打开 */}
          <Modal open={!!selectedNews} onClose={() => setSelectedNews(null)} title={selectedNews?.title || ''}>
            {selectedNews && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflow: 'auto' }}>
                {selectedNews.image_url && (
                  <img
                    src={selectedNews.image_url}
                    alt={selectedNews.title}
                    style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 4 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectedNews.category && <Badge variant="accent">{selectedNews.category}</Badge>}
                  {selectedNews.tag && <Badge variant="default">{selectedNews.tag}</Badge>}
                  {selectedNews.date && (
                    <span
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55em', color: 'var(--color-text-muted)' }}
                    >
                      {selectedNews.date}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.7em', lineHeight: 1.6, color: 'var(--color-text)' }}>
                  {selectedNews.text}
                </div>
                {selectedNews.read_more_link && (
                  <a
                    href={selectedNews.read_more_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: '0.65em',
                      color: 'var(--color-accent)',
                      textDecoration: 'none',
                      padding: '6px 12px',
                      border: '1px solid var(--color-accent)',
                      clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                    }}
                  >
                    {t('home.news.readMore')} →
                  </a>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}
    </>
  );
}
