import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  api,
  type GameInstance,
  type InstalledModInfo,
  type WorldInfo,
  type LogFileInfo,
  type OptimizationPreset,
  type VersionEntry,
} from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { Badge, Tabs, Modal, Breadcrumb as BreadcrumbComp, TextInput, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import GameConsole from '../components/ui/GameConsole';
import { relativeTime } from '../utils/time';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import styles from './InstanceDetailPage.module.css';
import presetStyles from '../components/ui/OptimizationPresets.module.css';

type SnapshotInfo = {
  id: string;
  name: string;
  created_at: string;
  size_bytes: number;
};

function getLoaderIcon(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return '\u{1F9F5}';
    case 'forge':
      return '\u{2692}';
    default:
      return '\u{1F4E6}';
  }
}

function getLoaderLabel(loaderType: string | null): string {
  switch (loaderType) {
    case 'fabric':
      return 'Fabric';
    case 'forge':
      return 'Forge';
    default:
      return 'Vanilla';
  }
}

function useDetailTabs(t: (key: string) => string, modCount: number) {
  return [
    { id: 'overview', label: t('instanceDetail.overview') },
    { id: 'mods', label: `${t('instanceDetail.mods')} (${modCount})` },
    { id: 'multiplayer', label: t('instanceDetail.multiplayer') },
    { id: 'optimize', label: t('instanceDetail.optimize') },
    { id: 'migrate', label: t('instanceDetail.migrate') },
    { id: 'profile', label: t('instanceDetail.profile') },
    { id: 'fps', label: t('instanceDetail.fps') },
    { id: 'saves', label: t('instanceDetail.saves') },
    { id: 'logs', label: t('instanceDetail.logs') },
    { id: 'snapshots', label: t('instanceDetail.snapshots') },
  ];
}

export default function InstanceDetailPage() {
  const { state: authState } = useAuth();
  const { state, deleteInstance, reloadInstances } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = authState.currentUser;
  const [instance, setInstance] = useState<GameInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [installedMods, setInstalledMods] = useState<InstalledModInfo[]>([]);
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [loadingLog, setLoadingLog] = useState(false);

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [mpInstalled, setMpInstalled] = useState(false);
  const [mpRunning, setMpRunning] = useState(false);
  const [mpState, setMpState] = useState<string>('idle');
  const [mpRoomCode, setMpRoomCode] = useState('');
  const [mpJoinCode, setMpJoinCode] = useState('');
  const [mpLoading, setMpLoading] = useState(false);

  const [presets, setPresets] = useState<OptimizationPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [applyResults, setApplyResults] = useState<
    Record<string, { succeeded: number; failed: number; errors: string[] } | null>
  >({});
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [migrationTarget, setMigrationTarget] = useState('');
  const [migrationResults, setMigrationResults] = useState<Array<{
    mod_slug: string;
    mod_name: string;
    status: string;
    detail: string;
  }> | null>(null);
  const [checkingMigration, setCheckingMigration] = useState(false);
  const [smartMemory, setSmartMemory] = useState<number | null>(null);
  const [tuningMemory, setTuningMemory] = useState(false);

  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconStatus, setIconStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [profilingData, setProfilingData] = useState<Array<{
    stage: string;
    duration_ms: number;
    details: string;
  }> | null>(null);
  const [loadingProfiling, setLoadingProfiling] = useState(false);

  const [fpsData, setFpsData] = useState<{
    avg_fps: number;
    min_fps: number;
    max_fps: number;
    frame_times_ms: number[];
    stutter_count: number;
    analysis: string;
  } | null>(null);
  const [loadingFps, setLoadingFps] = useState(false);

  const instanceId = routeId || '';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const inst = await api.getInstance(instanceId);
        setInstance(inst);
      } catch {
        const found = state.instances.find((i) => i.id === instanceId);
        setInstance(found || null);
      }
      setLoading(false);
    };
    load();
  }, [instanceId]);

  useEffect(() => {
    if (instanceId) {
      api
        .getGameDir()
        .then((gameDir) => {
          const iconPath = `${gameDir}/instances/${instanceId}/icon.png`;
          setIconUrl(convertFileSrc(iconPath));
        })
        .catch(() => {});
    }
  }, [instanceId]);

  useEffect(() => {
    if (instanceId) {
      Promise.allSettled([
        api.checkInstanceReady(instanceId),
        api.listInstanceMods(instanceId),
        api.listInstanceSaves(instanceId),
        api.listInstanceLogs(instanceId),
      ]).then(([readyRes, modsRes, savesRes, logsRes]) => {
        setIsReady(readyRes.status === 'fulfilled' ? readyRes.value : null);
        setInstalledMods(modsRes.status === 'fulfilled' ? modsRes.value : []);
        setWorlds(savesRes.status === 'fulfilled' ? savesRes.value : []);
        setLogFiles(logsRes.status === 'fulfilled' ? logsRes.value : []);
      });
    }
  }, [instanceId]);

  useEffect(() => {
    if (selectedLog && instanceId) {
      setLoadingLog(true);
      api
        .readLogFile(instanceId, selectedLog, 500)
        .then(setLogContent)
        .catch(() => setLogContent('Failed to load log file'))
        .finally(() => setLoadingLog(false));
    }
  }, [selectedLog, instanceId]);

  useEffect(() => {
    if (activeTab === 'snapshots' && instanceId) {
      loadSnapshots();
    }
    if (activeTab === 'multiplayer') {
      api
        .isTerracottaInstalled()
        .then(setMpInstalled)
        .catch(() => setMpInstalled(false));
      api
        .getTerracottaState()
        .then((s) => {
          setMpRunning(true);
          setMpState(s.state);
          setMpRoomCode(String(s.invitation_code || s.room_code || ''));
        })
        .catch(() => {
          setMpRunning(false);
        });
    }
  }, [activeTab, instanceId]);

  useEffect(() => {
    if (activeTab === 'optimize' && instanceId && presets.length === 0) {
      setPresetsLoading(true);
      api
        .getOptimizationPresets()
        .then(setPresets)
        .catch(() => setPresets([]))
        .finally(() => setPresetsLoading(false));
    }
  }, [activeTab, instanceId, presets.length]);

  useEffect(() => {
    if (activeTab === 'migrate' && instanceId && versions.length === 0) {
      api
        .getVersions()
        .then(setVersions)
        .catch(() => setVersions([]));
    }
  }, [activeTab, instanceId, versions.length]);

  useEffect(() => {
    if (activeTab === 'profile' && instanceId && profilingData === null) {
      setLoadingProfiling(true);
      api
        .getLaunchProfilingData(instanceId)
        .then((data) => setProfilingData(data.length > 0 ? data : null))
        .catch(() => setProfilingData(null))
        .finally(() => setLoadingProfiling(false));
    }
  }, [activeTab, instanceId, profilingData]);

  useEffect(() => {
    if (activeTab === 'fps' && instanceId && fpsData === null) {
      setLoadingFps(true);
      api
        .getFrameTimeData(instanceId)
        .then((data) => setFpsData(data))
        .catch(() => setFpsData(null))
        .finally(() => setLoadingFps(false));
    }
  }, [activeTab, instanceId, fpsData]);

  const handleApplyPreset = async (presetId: string) => {
    if (!instanceId) return;
    setApplyingPreset(presetId);
    try {
      const result = await api.applyOptimizationPreset(instanceId, presetId);
      setApplyResults((prev) => ({ ...prev, [presetId]: result }));
      addToast({
        type: 'success',
        title: 'Preset Applied',
        message: `${result.succeeded} succeeded, ${result.failed} failed`,
      });
      api
        .listInstanceMods(instanceId)
        .then(setInstalledMods)
        .catch(() => {});
    } catch (e: any) {
      addToast({ type: 'error', title: 'Apply Failed', message: e?.toString() || 'Failed to apply preset' });
    } finally {
      setApplyingPreset(null);
    }
  };

  const handleCheckMigration = async () => {
    if (!instanceId || !migrationTarget) return;
    setCheckingMigration(true);
    setMigrationResults(null);
    try {
      const results = await api.checkMigrationReadiness(instanceId, migrationTarget);
      setMigrationResults(results);
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Migration Check Failed',
        message: e?.toString() || 'Failed to check migration',
      });
    } finally {
      setCheckingMigration(false);
    }
  };

  const handleSmartTune = async () => {
    if (!instanceId) return;
    setTuningMemory(true);
    try {
      const mem = await api.smartTuneMemory(instanceId);
      setSmartMemory(mem);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Smart Tune Failed', message: e?.toString() || 'Failed to tune memory' });
    } finally {
      setTuningMemory(false);
    }
  };

  const loadSnapshots = async () => {
    try {
      const list = await api.listSnapshots(instanceId);
      setSnapshots(list);
    } catch {
      setSnapshots([]);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!instanceId) return;
    const name =
      snapshotName.trim() ||
      `Snapshot ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    setSnapshotLoading(true);
    try {
      await api.createSnapshot(instanceId, name);
      setSnapshotName('');
      await loadSnapshots();
      addToast({ type: 'success', title: 'Snapshot created', message: name });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Snapshot failed', message: e?.toString() || 'Failed to create snapshot' });
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleMpInstall = async () => {
    setMpLoading(true);
    try {
      await api.downloadTerracotta();
      setMpInstalled(true);
      addToast({ type: 'success', title: t('instanceDetail.mpInstallSuccess'), message: '' });
    } catch (e: any) {
      addToast({ type: 'error', title: t('instanceDetail.mpInstallFailed'), message: e?.toString() || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpStart = async () => {
    setMpLoading(true);
    try {
      await api.startTerracotta();
      setMpRunning(true);
      const s = await api.getTerracottaState();
      setMpState(s.state);
      addToast({ type: 'success', title: t('instanceDetail.mpStarted'), message: '' });
    } catch (e: any) {
      addToast({ type: 'error', title: t('instanceDetail.mpStartFailed'), message: e?.toString() || '' });
      setMpRunning(false);
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpStop = async () => {
    setMpLoading(true);
    try {
      await api.stopTerracotta();
      setMpRunning(false);
      setMpState('idle');
      setMpRoomCode('');
      addToast({ type: 'success', title: t('instanceDetail.mpStopped'), message: '' });
    } catch (e: any) {
      addToast({ type: 'error', title: t('instanceDetail.mpStopFailed'), message: e?.toString() || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpHost = async () => {
    setMpLoading(true);
    try {
      await api.terracottaSetHost();
      const s = await api.getTerracottaState();
      setMpState(s.state);
      setMpRoomCode(String((s as any).invitation_code || (s as any).room_code || ''));
      addToast({ type: 'success', title: t('instanceDetail.mpHosting'), message: '' });
    } catch (e: any) {
      addToast({ type: 'error', title: t('instanceDetail.mpHostFailed'), message: e?.toString() || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpJoin = async () => {
    if (!mpJoinCode.trim()) return;
    setMpLoading(true);
    try {
      await api.terracottaSetGuest(mpJoinCode.trim());
      const s = await api.getTerracottaState();
      setMpState(s.state);
      addToast({ type: 'success', title: t('instanceDetail.mpJoining'), message: '' });
    } catch (e: any) {
      addToast({ type: 'error', title: t('instanceDetail.mpJoinFailed'), message: e?.toString() || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleMpDisconnect = async () => {
    setMpLoading(true);
    try {
      await api.terracottaSetIdle();
      setMpState('idle');
      setMpRoomCode('');
      addToast({ type: 'success', title: t('instanceDetail.mpDisconnected'), message: '' });
    } catch (e: any) {
      addToast({ type: 'error', title: '', message: e?.toString() || '' });
    } finally {
      setMpLoading(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string, name: string) => {
    if (!instanceId) return;
    if (!confirm(`Restore snapshot "${name}"? This will overwrite current mods, configs, and saves.`)) return;
    try {
      await api.restoreSnapshot(instanceId, snapshotId);
      await loadSnapshots();
      addToast({ type: 'success', title: 'Restored', message: `Snapshot "${name}" restored` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Restore failed', message: e?.toString() || 'Failed to restore snapshot' });
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string, name: string) => {
    if (!instanceId) return;
    if (!confirm(`Delete snapshot "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteSnapshot(instanceId, snapshotId);
      await loadSnapshots();
      addToast({ type: 'success', title: 'Deleted', message: `Snapshot "${name}" deleted` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Delete failed', message: e?.toString() || 'Failed to delete snapshot' });
    }
  };

  const handleLaunch = useCallback(async () => {
    if (!instance) return;
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
      addToast({
        type: 'success',
        title: t('instances.launching'),
        message: t('instances.isStarting', { name: instance.name }),
      });
    } catch (e: any) {
      setError(e?.toString() || t('instances.launchFailed'));
      addToast({
        type: 'error',
        title: t('instances.launchFailed'),
        message: e?.toString() || t('instances.launchFailed'),
      });
      setTimeout(() => setError(''), 8000);
    }
  }, [instance, auth, addToast, t]);

  const handlePickIcon = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }],
      });
      if (selected && typeof selected === 'string') {
        setIconStatus('loading');
        await api.setInstanceIcon(instanceId, selected);
        setIconUrl(convertFileSrc(selected));
        setIconStatus('success');
        addToast({ type: 'success', title: 'Icon Updated', message: 'Instance icon has been set' });
        setTimeout(() => setIconStatus('idle'), 2500);
      }
    } catch (e: any) {
      setIconStatus('error');
      addToast({ type: 'error', title: 'Icon Failed', message: e?.toString() || 'Failed to set icon' });
      setTimeout(() => setIconStatus('idle'), 2500);
    }
  };

  const handleDelete = async () => {
    if (!instance) return;
    await deleteInstance(instance.id);
    addToast({ type: 'success', title: 'Deleted', message: `Instance "${instance.name}" deleted` });
    navigate('/instances');
  };

  const handleDuplicate = async () => {
    if (!instance) return;
    setDuplicateName(`${instance.name} (Copy)`);
    setDuplicateOpen(true);
  };

  const confirmDuplicate = async () => {
    if (!instance || !duplicateName.trim()) return;
    try {
      await api.duplicateInstance(instance.id, duplicateName.trim());
      addToast({ type: 'success', title: 'Duplicated', message: `Instance "${duplicateName}" created` });
      setDuplicateOpen(false);
      await reloadInstances();
      navigate('/instances');
    } catch (e: any) {
      addToast({ type: 'error', title: 'Duplicate failed', message: e?.toString() || 'Failed to duplicate' });
    }
  };

  const handleExport = async () => {
    if (!instance) return;
    setExporting(true);
    try {
      const gameDir = await api.getGameDir();
      const safeName = instance.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const outputPath = `${gameDir}/${safeName}_${instance.version_id}.mrpack`;
      await api.exportMrpack(instance.id, outputPath);
      addToast({ type: 'success', title: 'Exported', message: `${safeName}.mrpack saved` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Export failed', message: e?.toString() || 'Failed to export' });
    } finally {
      setExporting(false);
    }
  };

  const handleUpdateInstance = useCallback(
    async (updates: Partial<GameInstance>) => {
      if (!instance) return;
      try {
        const updated = { ...instance, ...updates };
        await api.updateInstance(updated);
        setInstance(updated);
      } catch (e: any) {
        addToast({ type: 'error', title: 'Update failed', message: e?.toString() || 'Failed to update instance' });
      }
    },
    [instance, addToast],
  );

  const DETAIL_TABS = useMemo(() => useDetailTabs(t, installedMods.length), [t, installedMods.length]);

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!instance) {
    return <div className={styles.notFound}>{t('instanceDetail.notFound')}</div>;
  }

  const memoryGB = Math.round(instance.max_memory / 1024);
  const playtimeH = instance.playtime_seconds > 0 ? (instance.playtime_seconds / 3600).toFixed(1) : '0';

  return (
    <div className={styles.page}>
      <BreadcrumbComp items={[{ label: t('instances.title'), href: '#/instances' }, { label: instance.name }]} />

      {/* Top info bar */}
      <div className={styles.topBar}>
        <div
          className={`${styles.topBarIcon} ${iconStatus === 'success' ? styles.topBarIconSuccess : ''} ${iconStatus === 'error' ? styles.topBarIconError : ''} ${iconStatus === 'loading' ? styles.topBarIconLoading : ''}`}
          onClick={handlePickIcon}
          title={t('instanceDetail.clickChangeIcon')}
        >
          {iconUrl ? (
            <img src={iconUrl} alt={instance.name} className={styles.topBarIconImg} onError={() => setIconUrl(null)} />
          ) : (
            <span className={styles.topBarIconEmoji}>{getLoaderIcon(instance.loader_type)}</span>
          )}
          {iconStatus === 'loading' && <span className={styles.iconStatusOverlay}>⏳</span>}
          {iconStatus === 'success' && <span className={styles.iconStatusOverlay}>✓</span>}
          {iconStatus === 'error' && <span className={styles.iconStatusOverlay}>✗</span>}
        </div>
        <div className={styles.topBarInfo}>
          <div className={styles.topBarNameRow}>
            <span className={styles.topBarName}>{instance.name.toUpperCase()}</span>
            <Badge variant="accent">{instance.version_id}</Badge>
            {instance.loader_type && <Badge variant="muted">{instance.loader_type}</Badge>}
            {isReady !== null && <span style={{ fontSize: '0.6em' }}>{isReady ? '✅' : '⚠️'}</span>}
          </div>
          <div className={styles.topBarMeta}>
            <span className={styles.topBarMetaText}>
              {getLoaderLabel(instance.loader_type)}
              {instance.loader_version ? ` ${instance.loader_version}` : ''}
            </span>
            <div className={styles.topBarMetaSep} />
            <span className={styles.topBarRam}>{memoryGB}GB</span>
            <div className={styles.topBarMetaSep} />
            <span className={styles.topBarMetaText}>
              {t('instances.lastPlayed')}: {relativeTime(instance.last_played)}
            </span>
          </div>
        </div>
        <div className={styles.topBarActions}>
          <Tooltip content={t('common.launch')}>
            <Button variant="primary" size="md" onClick={handleLaunch}>
              ▶ {t('instanceDetail.launch')}
            </Button>
          </Tooltip>
          <Tooltip content={t('instances.exportAsMrpack')}>
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
              📤 {exporting ? t('instanceDetail.exporting') : t('instanceDetail.export')}
            </Button>
          </Tooltip>
          <Tooltip content={t('instances.duplicateInstanceTooltip')}>
            <Button variant="secondary" size="sm" onClick={handleDuplicate}>
              📋 {t('instanceDetail.duplicate')}
            </Button>
          </Tooltip>
          <Tooltip content={t('instanceDetail.delete')}>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              {t('instanceDetail.delete')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Tabs */}
      <Tabs tabs={DETAIL_TABS} activeId={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className={styles.tabContent}>
          {/* Left column */}
          <div className={styles.leftCol}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>{t('instanceDetail.versionInfo').toUpperCase()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <InfoRow label="Minecraft" value={instance.version_id} />
                <InfoRow
                  label="Loader"
                  value={
                    instance.loader_type
                      ? `${getLoaderLabel(instance.loader_type)} ${instance.loader_version || ''}`
                      : t('common.vanilla')
                  }
                />
                <InfoRow label="Java" value={instance.java_path || t('instanceDetail.autoDetect')} />
                <InfoRow label="Created" value={new Date(instance.created_at).toLocaleDateString()} />
                <InfoRow
                  label={t('instanceDetail.status')}
                  value={
                    isReady === null ? t('common.checking') : isReady ? t('common.ready') : t('common.needsDownload')
                  }
                  mono
                />
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>{t('instanceDetail.launchConfig').toUpperCase()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.infoRowLabel}>{t('instanceDetail.allocatedMemory')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="range"
                      min={1}
                      max={16}
                      step={1}
                      value={memoryGB}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleUpdateInstance({ max_memory: val * 1024 });
                      }}
                      style={{ width: 120, accentColor: 'var(--color-accent)' }}
                    />
                    <span className={styles.infoRowValueMono}>{memoryGB} GB</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.infoRowLabel}>{t('instanceDetail.minMemory')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="range"
                      min={256}
                      max={4096}
                      step={256}
                      value={instance.min_memory}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        handleUpdateInstance({ min_memory: val });
                      }}
                      style={{ width: 120, accentColor: 'var(--color-accent)' }}
                    />
                    <span className={styles.infoRowValueMono}>{Math.round(instance.min_memory / 1024)} GB</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.infoRowLabel}>{t('settings.jvmArgs')}</span>
                  <input
                    type="text"
                    value={instance.jvm_args || ''}
                    placeholder={t('instanceDetail.default')}
                    onChange={(e) => handleUpdateInstance({ jvm_args: e.target.value })}
                    style={{
                      background: '#0A0A0A',
                      border: '1px solid #1C1C1C',
                      color: '#FFF',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.55em',
                      padding: '4px 8px',
                      width: 200,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.infoRowLabel}>{t('instanceDetail.javaPath')}</span>
                  <input
                    type="text"
                    value={instance.java_path || ''}
                    placeholder={t('instanceDetail.autoDetect')}
                    onChange={(e) => handleUpdateInstance({ java_path: e.target.value })}
                    style={{
                      background: '#0A0A0A',
                      border: '1px solid #1C1C1C',
                      color: '#FFF',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.55em',
                      padding: '4px 8px',
                      width: 200,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className={styles.rightCol}>
            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>{t('instanceDetail.playtime').toUpperCase()}</div>
              <div className={styles.statCardValue}>{playtimeH} h</div>
              <div className={styles.statCardSub}>
                {instance.playtime_seconds > 0
                  ? t('instanceDetail.playtimeMinutes', { minutes: String(Math.floor(instance.playtime_seconds / 60)) })
                  : t('instanceDetail.noPlaytime')}
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>{t('instanceDetail.downloadStatus')}</div>
              <div className={styles.statCardValue}>
                {isReady === null ? '⏳' : isReady ? '✅ ' + t('common.ready') : '⚠️ ' + t('common.needsDownload')}
              </div>
              <div className={styles.statCardSub}>
                {isReady ? t('instanceDetail.readyStatus') : t('instanceDetail.notReadyStatus')}
              </div>
              {!isReady && isReady !== null && (
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: '10%' }} />
                </div>
              )}
            </div>

            <div className={styles.exportBtn}>
              <Tooltip content={t('instanceDetail.exportAsZip')}>
                <Button
                  variant="secondary-highlight"
                  size="md"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? '⏳ ' + t('instanceDetail.exporting') : '📤 ' + t('instanceDetail.exportInstance')}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mods' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {installedMods.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noModsInstalled')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {installedMods.map((mod) => (
                <div
                  key={mod.filename}
                  style={{
                    background: '#141414',
                    border: '1px solid #1C1C1C',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF' }}>
                      {mod.filename}
                    </div>
                    <div style={{ fontSize: '0.5em', color: '#666', marginTop: 2 }}>
                      {t('instanceDetail.modSize', {
                        size: (mod.size / 1024).toFixed(1),
                        date: new Date(mod.installed_at).toLocaleDateString(),
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'multiplayer' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 4px' }}>
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.9em',
                color: 'var(--color-accent)',
                letterSpacing: 3,
                marginBottom: 4,
              }}
            >
              {t('instanceDetail.mpTitle')}
            </div>
            <div style={{ fontSize: '0.5em', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
              {t('instanceDetail.mpDesc')}
            </div>
          </div>

          {!mpInstalled ? (
            <div style={{ background: '#141414', border: '1px solid #1C1C1C', padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '0.65em', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                {t('instanceDetail.mpNotInstalled')}
              </div>
              <Button variant="primary" size="md" onClick={handleMpInstall} disabled={mpLoading}>
                {mpLoading ? t('instanceDetail.mpInstalling') : t('instanceDetail.mpInstall')}
              </Button>
            </div>
          ) : !mpRunning ? (
            <div style={{ background: '#141414', border: '1px solid #1C1C1C', padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '0.55em', color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
                {t('instanceDetail.mpReady')}
              </div>
              <Button variant="primary" size="md" onClick={handleMpStart} disabled={mpLoading}>
                {mpLoading ? '...' : t('instanceDetail.mpStart')}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  background: '#141414',
                  border: '1px solid #1C1C1C',
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.5em', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
                    {t('instanceDetail.mpStatus')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.55em',
                      color: mpState === 'idle' ? 'var(--color-text-tertiary)' : 'var(--color-accent)',
                      marginLeft: 8,
                      fontWeight: 600,
                    }}
                  >
                    {mpState === 'idle'
                      ? t('instanceDetail.mpIdle')
                      : mpState === 'hosting'
                        ? t('instanceDetail.mpHostingStatus')
                        : mpState === 'guesting'
                          ? t('instanceDetail.mpGuestingStatus')
                          : mpState === 'scanning'
                            ? t('instanceDetail.mpScanningStatus')
                            : mpState}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={handleMpStop} disabled={mpLoading}>
                  {t('instanceDetail.mpStop')}
                </Button>
              </div>

              {mpState === 'idle' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, background: '#141414', border: '1px solid #1C1C1C', padding: 16 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.75em',
                        color: 'var(--color-accent)',
                        letterSpacing: 2,
                        marginBottom: 8,
                      }}
                    >
                      {t('instanceDetail.mpHostMode')}
                    </div>
                    <div
                      style={{
                        fontSize: '0.5em',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {t('instanceDetail.mpHostDesc')}
                    </div>
                    <Button variant="primary" size="sm" onClick={handleMpHost} disabled={mpLoading}>
                      {t('instanceDetail.mpCreateRoom')}
                    </Button>
                  </div>
                  <div style={{ flex: 1, background: '#141414', border: '1px solid #1C1C1C', padding: 16 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.75em',
                        color: 'var(--color-accent)',
                        letterSpacing: 2,
                        marginBottom: 8,
                      }}
                    >
                      {t('instanceDetail.mpGuestMode')}
                    </div>
                    <div
                      style={{
                        fontSize: '0.5em',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {t('instanceDetail.mpGuestDesc')}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={mpJoinCode}
                        onChange={(e) => setMpJoinCode(e.target.value)}
                        placeholder={t('instanceDetail.mpEnterCode')}
                        style={{
                          flex: 1,
                          background: '#0D0D0D',
                          border: '1px solid #2A2A2A',
                          color: '#FFF',
                          fontSize: '0.55em',
                          padding: '6px 10px',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleMpJoin()}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleMpJoin}
                        disabled={mpLoading || !mpJoinCode.trim()}
                      >
                        {t('instanceDetail.mpJoin')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {mpState === 'hosting' && mpRoomCode && (
                <div style={{ background: '#141414', border: '1px solid var(--color-accent-15)', padding: 16 }}>
                  <div
                    style={{ fontSize: '0.5em', color: 'var(--color-text-muted)', letterSpacing: 1, marginBottom: 6 }}
                  >
                    {t('instanceDetail.mpInvitationCode')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75em',
                        color: 'var(--color-accent)',
                        letterSpacing: 2,
                        wordBreak: 'break-all',
                      }}
                    >
                      {mpRoomCode}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(mpRoomCode);
                        addToast({ type: 'success', title: t('instanceDetail.mpCopied'), message: '' });
                      }}
                    >
                      {t('instanceDetail.mpCopy')}
                    </Button>
                  </div>
                  <div style={{ fontSize: '0.45em', color: 'var(--color-text-faint)', marginTop: 8, lineHeight: 1.5 }}>
                    {t('instanceDetail.mpHostHint')}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button variant="secondary" size="sm" onClick={handleMpDisconnect}>
                      {t('instanceDetail.mpDisconnect')}
                    </Button>
                  </div>
                </div>
              )}

              {mpState === 'guesting' && (
                <div style={{ background: '#141414', border: '1px solid var(--color-accent-15)', padding: 16 }}>
                  <div style={{ fontSize: '0.55em', color: 'var(--color-success)', marginBottom: 8 }}>
                    {t('instanceDetail.mpConnected')}
                  </div>
                  <div style={{ fontSize: '0.45em', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                    {t('instanceDetail.mpGuestHint')}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button variant="secondary" size="sm" onClick={handleMpDisconnect}>
                      {t('instanceDetail.mpDisconnect')}
                    </Button>
                  </div>
                </div>
              )}

              {mpState === 'scanning' && (
                <div style={{ background: '#141414', border: '1px solid #1C1C1C', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.55em', color: 'var(--color-accent)' }}>
                    {t('instanceDetail.mpScanning')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'saves' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {worlds.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noSaves')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {worlds.map((world) => (
                <div
                  key={world.name}
                  style={{
                    background: '#141414',
                    border: '1px solid #1C1C1C',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF' }}>
                      🌍 {world.name}
                    </div>
                    <div style={{ fontSize: '0.5em', color: '#666', marginTop: 2 }}>
                      {world.game_mode} · {world.difficulty} · {world.size_mb.toFixed(1)} MB
                      {world.last_played && ` · ${relativeTime(world.last_played)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {world.seed && <Badge variant="muted">Seed: {world.seed}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'logs' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {logFiles.map((log) => (
              <button
                key={log.filename}
                onClick={() => setSelectedLog(log.filename)}
                style={{
                  background: selectedLog === log.filename ? 'var(--color-accent)' : '#141414',
                  color: selectedLog === log.filename ? '#000' : '#FFF',
                  border: '1px solid #1C1C1C',
                  padding: '4px 10px',
                  fontSize: '0.5em',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                {log.filename} ({(log.size / 1024).toFixed(0)}KB)
              </button>
            ))}
            {logFiles.length === 0 && (
              <span style={{ fontSize: '0.5em', color: '#666' }}>{t('instanceDetail.noLogs')}</span>
            )}
          </div>
          {selectedLog ? (
            loadingLog ? (
              <div style={{ fontSize: '0.6em', color: '#666', padding: 20 }}>{t('common.loading')}</div>
            ) : (
              <div
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #1C1C1C',
                  padding: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.5em',
                  color: '#AAA',
                  maxHeight: 400,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {logContent}
              </div>
            )
          ) : (
            <div style={{ padding: 20 }}>
              <GameConsole visible={true} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'optimize' && (
        <div className={presetStyles.container}>
          {presetsLoading ? (
            <div className={presetStyles.loading}>{t('instanceDetail.loadingPresets')}</div>
          ) : (
            <>
              <div className={presetStyles.cards}>
                {presets.map((preset) => {
                  const result = applyResults[preset.id];
                  const isApplying = applyingPreset === preset.id;
                  const perfBadgeClass =
                    preset.performance_level === 'low'
                      ? presetStyles.badgeLow
                      : preset.performance_level === 'medium'
                        ? presetStyles.badgeMedium
                        : presetStyles.badgeHigh;
                  return (
                    <div key={preset.id} className={presetStyles.card}>
                      <div className={presetStyles.cardHeader}>
                        <span className={presetStyles.cardName}>{preset.name}</span>
                        <span className={perfBadgeClass}>{preset.performance_level}</span>
                      </div>
                      <p className={presetStyles.cardDesc}>{preset.description}</p>
                      <div>
                        <div className={presetStyles.modsLabel}>Included Mods</div>
                        <div className={presetStyles.modPills}>
                          {preset.mods.map((mod) => (
                            <span key={mod.slug} className={presetStyles.modPill}>
                              {mod.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={presetStyles.ramInfo}>
                        <span className={presetStyles.ramLabel}>{t('instanceDetail.minRam')}</span>
                        <span className={presetStyles.ramValue}>{Math.round(preset.min_ram_mb / 1024)} GB</span>
                      </div>
                      <div className={presetStyles.applyBtn}>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApplyPreset(preset.id)}
                          disabled={isApplying}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {isApplying ? t('instanceDetail.applying') : t('instanceDetail.applyPreset')}
                        </Button>
                      </div>
                      {result && (
                        <div className={presetStyles.applyResult}>
                          <div className={presetStyles.applyResultSummary}>
                            <span className={presetStyles.applyResultSuccess}>
                              ✓ {t('instanceDetail.presetSucceeded', { count: String(result.succeeded) })}
                            </span>
                            {result.failed > 0 && (
                              <span className={presetStyles.applyResultFailed}>
                                ✗ {t('instanceDetail.presetFailed', { count: String(result.failed) })}
                              </span>
                            )}
                          </div>
                          {result.errors.length > 0 && (
                            <div className={presetStyles.applyResultErrors}>
                              {result.errors.map((err, i) => (
                                <span key={i} className={presetStyles.applyResultError}>
                                  {err}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {presets.length === 0 && <div className={presetStyles.loading}>{t('instanceDetail.noPresets')}</div>}
            </>
          )}
        </div>
      )}

      {activeTab === 'migrate' && (
        <div className={styles.migrateTab}>
          <div className={styles.migrateSection}>
            <div className={styles.migrateSectionHeader}>{t('instanceDetail.versionMigration')}</div>
            <div className={styles.migrateRow}>
              <select
                className={styles.migrateSelect}
                value={migrationTarget}
                onChange={(e) => setMigrationTarget(e.target.value)}
              >
                <option value="">{t('instanceDetail.selectTargetVersion')}</option>
                {versions
                  .filter((v) => v.type === 'release' || v.type === 'snapshot')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCheckMigration}
                disabled={!migrationTarget || checkingMigration}
              >
                {checkingMigration ? t('instanceDetail.checking') : t('instanceDetail.checkCompat')}
              </Button>
            </div>
            {migrationResults && (
              <div className={styles.migrateResults}>
                {migrationResults.length === 0 ? (
                  <div className={styles.migrateEmpty}>
                    {t('instanceDetail.allCompatible', { version: migrationTarget })}
                  </div>
                ) : (
                  migrationResults.map((item) => {
                    const statusBadgeClass =
                      item.status === 'compatible'
                        ? styles.badgeGreen
                        : item.status === 'pending'
                          ? styles.badgeYellow
                          : styles.badgeGray;
                    return (
                      <div key={item.mod_slug} className={styles.migrateResultItem}>
                        <div className={styles.migrateResultInfo}>
                          <span className={styles.migrateResultName}>{item.mod_name}</span>
                          <span className={styles.migrateResultSlug}>{item.mod_slug}</span>
                        </div>
                        <div className={styles.migrateResultRight}>
                          <span className={statusBadgeClass}>{item.status}</span>
                          <span className={styles.migrateResultDetail}>{item.detail}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className={styles.migrateSection}>
            <div className={styles.migrateSectionHeader}>{t('instanceDetail.smartTune')}</div>
            <p className={styles.migrateDesc}>{t('instanceDetail.smartTuneDesc')}</p>
            <div className={styles.migrateRow}>
              <Button variant="secondary" size="sm" onClick={handleSmartTune} disabled={tuningMemory}>
                {tuningMemory ? t('instanceDetail.analyzing') : t('instanceDetail.smartTuneBtn')}
              </Button>
              {smartMemory !== null && (
                <span className={styles.migrateMemoryResult}>
                  {t('instanceDetail.recommended')}: <strong>{smartMemory} MB</strong> (
                  {(smartMemory / 1024).toFixed(1)} GB)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className={styles.profileTab}>
          {loadingProfiling ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.loadingProfiling')}</div>
          ) : !profilingData ? (
            <div className={styles.placeholderTab}>
              {t('instanceDetail.noProfilingData') || 'No profiling data yet - launch the game first'}
            </div>
          ) : (
            <div className={styles.profileContent}>
              <div className={styles.profileHeader}>
                <span className={styles.profileHeaderStage}>{t('instanceDetail.profileStage')}</span>
                <span className={styles.profileHeaderDuration}>{t('instanceDetail.profileDuration')}</span>
                <span className={styles.profileHeaderDetails}>{t('instanceDetail.profileDetails')}</span>
              </div>
              {profilingData.map((item, i) => {
                const maxDuration = Math.max(...profilingData.map((p) => p.duration_ms), 1);
                const pct = (item.duration_ms / maxDuration) * 100;
                const colorClass =
                  item.duration_ms < 500 ? styles.barGreen : item.duration_ms < 2000 ? styles.barYellow : styles.barRed;
                const durationLabel =
                  item.duration_ms >= 1000 ? `${(item.duration_ms / 1000).toFixed(1)}s` : `${item.duration_ms}ms`;
                return (
                  <div key={i} className={styles.profileRow}>
                    <span className={styles.profileStage}>{item.stage}</span>
                    <div className={styles.profileBarWrap}>
                      <div className={`${styles.profileBar} ${colorClass}`} style={{ width: `${pct}%` }} />
                      <span className={styles.profileDuration}>{durationLabel}</span>
                    </div>
                    <span className={styles.profileDetails}>{item.details}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fps' && (
        <div className={styles.fpsTab}>
          {loadingFps ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.loadingFps')}</div>
          ) : !fpsData ? (
            <div className={styles.placeholderTab}>
              {t('instanceDetail.noFpsData') || 'Run the game with monitoring enabled'}
            </div>
          ) : (
            <div className={styles.fpsContent}>
              <div className={styles.fpsStats}>
                <div className={styles.fpsStatCard}>
                  <div className={styles.fpsStatLabel}>{t('instanceDetail.fpsAvg')}</div>
                  <div className={styles.fpsStatValue}>{fpsData.avg_fps.toFixed(0)}</div>
                </div>
                <div className={styles.fpsStatCard}>
                  <div className={styles.fpsStatLabel}>{t('instanceDetail.fpsMin')}</div>
                  <div className={styles.fpsStatValue}>{fpsData.min_fps.toFixed(0)}</div>
                </div>
                <div className={styles.fpsStatCard}>
                  <div className={styles.fpsStatLabel}>{t('instanceDetail.fpsMax')}</div>
                  <div className={styles.fpsStatValue}>{fpsData.max_fps.toFixed(0)}</div>
                </div>
              </div>
              <div className={styles.fpsChartSection}>
                <div className={styles.fpsChartHeader}>{t('instanceDetail.fpsFrameTimes')}</div>
                <div className={styles.fpsChart}>
                  {fpsData.frame_times_ms.slice(0, 30).map((ft, i) => {
                    const fpsFromFt = ft > 0 ? 1000 / ft : 999;
                    const colorClass =
                      fpsFromFt >= 60 ? styles.barGreen : fpsFromFt >= 30 ? styles.barYellow : styles.barRed;
                    const maxFt = Math.max(...fpsData.frame_times_ms.slice(0, 30), 1);
                    const pct = (ft / maxFt) * 100;
                    return (
                      <div key={i} className={styles.fpsBarRow}>
                        <span className={styles.fpsBarIndex}>{i + 1}</span>
                        <div className={styles.fpsBarTrack}>
                          <div className={`${styles.fpsBar} ${colorClass}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.fpsBarValue}>{ft.toFixed(1)}ms</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'snapshots' && (
        <div className={styles.snapshotsTab}>
          <div className={styles.snapshotsHeader}>
            <div className={styles.snapshotsCreateRow}>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder={t('instanceDetail.snapshotName')}
                className={styles.snapshotInput}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
              />
              <Button variant="primary" size="sm" onClick={handleCreateSnapshot} disabled={snapshotLoading}>
                {snapshotLoading ? t('instanceDetail.creating') : '📸 ' + t('instanceDetail.createSnapshot')}
              </Button>
            </div>
          </div>

          {snapshots.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noSnapshots')}</div>
          ) : (
            <div className={styles.snapshotList}>
              <div className={styles.snapshotTableHeader}>
                <span className={styles.snapshotColName}>{t('instanceDetail.snapshotNameCol')}</span>
                <span className={styles.snapshotColDate}>{t('instanceDetail.snapshotDateCol')}</span>
                <span className={styles.snapshotColSize}>{t('instanceDetail.snapshotSizeCol')}</span>
                <span className={styles.snapshotColActions}>{t('instanceDetail.snapshotActionsCol')}</span>
              </div>
              {snapshots.map((snap) => (
                <div key={snap.id} className={styles.snapshotRow}>
                  <span className={styles.snapshotColName}>{snap.name}</span>
                  <span className={styles.snapshotColDate}>
                    {new Date(snap.created_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className={styles.snapshotColSize}>{(snap.size_bytes / 1048576).toFixed(1)} MB</span>
                  <span className={styles.snapshotColActions}>
                    <Button
                      variant="secondary-highlight"
                      size="sm"
                      onClick={() => handleRestoreSnapshot(snap.id, snap.name)}
                    >
                      {'↺ ' + t('instanceDetail.restore')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteSnapshot(snap.id, snap.name)}>
                      {'✕ ' + t('common.delete')}
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('instances.deleteTitle')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {t('instanceDetail.deleteConfirm', { name: instance.name })}
      </Modal>

      {/* Duplicate modal */}
      <Modal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        title={t('instanceDetail.duplicateInstance')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDuplicateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={confirmDuplicate} disabled={!duplicateName.trim()}>
              {t('instanceDetail.duplicate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>
            {t('instanceDetail.newInstanceName')}
          </label>
          <TextInput
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            placeholder={t('instanceDetail.instanceName')}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={mono ? styles.infoRowValueMono : styles.infoRowValue}>{value}</span>
    </div>
  );
}
