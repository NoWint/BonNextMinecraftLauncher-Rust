import { useState, useEffect, useCallback } from 'react';
import { api, type GameInstance, type InstalledModInfo, type WorldInfo, type LogFileInfo, type OptimizationPreset, type VersionEntry } from '../api';
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

function useDetailTabs(t: (key: string) => string, modCount: number) {
  return [
    { id: 'overview', label: t('instanceDetail.overview') },
    { id: 'mods', label: `${t('instanceDetail.mods')} (${modCount})` },
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

  const [presets, setPresets] = useState<OptimizationPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [applyResults, setApplyResults] = useState<Record<string, { succeeded: number; failed: number; errors: string[] } | null>>({});
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [migrationTarget, setMigrationTarget] = useState('');
  const [migrationResults, setMigrationResults] = useState<Array<{ mod_slug: string; mod_name: string; status: string; detail: string }> | null>(null);
  const [checkingMigration, setCheckingMigration] = useState(false);
  const [smartMemory, setSmartMemory] = useState<number | null>(null);
  const [tuningMemory, setTuningMemory] = useState(false);

  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconStatus, setIconStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [profilingData, setProfilingData] = useState<Array<{ stage: string; duration_ms: number; details: string }> | null>(null);
  const [loadingProfiling, setLoadingProfiling] = useState(false);

  const [fpsData, setFpsData] = useState<{ avg_fps: number; min_fps: number; p1_low_fps: number; frame_times_ms: number[] } | null>(null);
  const [loadingFps, setLoadingFps] = useState(false);

  const instanceId = window.location.hash.replace('#/instances/', '').split('?')[0];

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
      api.getGameDir().then((gameDir) => {
        const iconPath = `${gameDir}/instances/${instanceId}/icon.png`;
        setIconUrl(convertFileSrc(iconPath));
      }).catch(() => {});
    }
  }, [instanceId]);

  useEffect(() => {
    if (instanceId) {
      api.checkInstanceReady(instanceId).then(setIsReady).catch(() => setIsReady(null));
      api.listInstanceMods(instanceId).then(setInstalledMods).catch(() => setInstalledMods([]));
      api.listInstanceSaves(instanceId).then(setWorlds).catch(() => setWorlds([]));
      api.listInstanceLogs(instanceId).then(setLogFiles).catch(() => setLogFiles([]));
    }
  }, [instanceId]);

  useEffect(() => {
    if (selectedLog && instanceId) {
      setLoadingLog(true);
      api.readLogFile(instanceId, selectedLog, 500)
        .then(setLogContent)
        .catch(() => setLogContent('Failed to load log file'))
        .finally(() => setLoadingLog(false));
    }
  }, [selectedLog, instanceId]);

  useEffect(() => {
    if (activeTab === 'snapshots' && instanceId) {
      loadSnapshots();
    }
  }, [activeTab, instanceId]);

  useEffect(() => {
    if (activeTab === 'optimize' && instanceId && presets.length === 0) {
      setPresetsLoading(true);
      api.getOptimizationPresets()
        .then(setPresets)
        .catch(() => setPresets([]))
        .finally(() => setPresetsLoading(false));
    }
  }, [activeTab, instanceId, presets.length]);

  useEffect(() => {
    if (activeTab === 'migrate' && instanceId && versions.length === 0) {
      api.getVersions()
        .then(setVersions)
        .catch(() => setVersions([]));
    }
  }, [activeTab, instanceId, versions.length]);

  useEffect(() => {
    if (activeTab === 'profile' && instanceId && profilingData === null) {
      setLoadingProfiling(true);
      api.getLaunchProfilingData(instanceId)
        .then((data) => setProfilingData(data.length > 0 ? data : null))
        .catch(() => setProfilingData(null))
        .finally(() => setLoadingProfiling(false));
    }
  }, [activeTab, instanceId, profilingData]);

  useEffect(() => {
    if (activeTab === 'fps' && instanceId && fpsData === null) {
      setLoadingFps(true);
      api.getFrameTimeData(instanceId)
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
      addToast({ type: 'success', title: 'Preset Applied', message: `${result.succeeded} succeeded, ${result.failed} failed` });
      api.listInstanceMods(instanceId).then(setInstalledMods).catch(() => {});
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
      addToast({ type: 'error', title: 'Migration Check Failed', message: e?.toString() || 'Failed to check migration' });
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
    const name = snapshotName.trim() || `Snapshot ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
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
        instance.version_id, instance.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', instance.max_memory, instance.min_memory,
        instance.java_path || undefined, instance.jvm_args || undefined,
        instance.id,
      );
      addToast({ type: 'success', title: 'Launching', message: `${instance.name} is starting...` });
    } catch (e: any) {
      setError(e?.toString() || 'Launch failed');
      addToast({ type: 'error', title: 'Launch failed', message: e?.toString() || 'Launch failed' });
      setTimeout(() => setError(''), 8000);
    }
  }, [instance, auth, addToast]);

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
    window.location.hash = '#/instances';
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
      window.location.hash = '#/instances';
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

  const handleUpdateInstance = useCallback(async (updates: Partial<GameInstance>) => {
    if (!instance) return;
    try {
      const updated = { ...instance, ...updates };
      await api.updateInstance(updated);
      setInstance(updated);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Update failed', message: e?.toString() || 'Failed to update instance' });
    }
  }, [instance, addToast]);

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

  const DETAIL_TABS = useDetailTabs(t, installedMods.length);
  const memoryGB = Math.round(instance.max_memory / 1024);
  const playtimeH = instance.playtime_seconds > 0
    ? (instance.playtime_seconds / 3600).toFixed(1)
    : '0';

  return (
    <div className={`page-enter ${styles.page}`}>
      <BreadcrumbComp
        items={[
          { label: t('instances.title'), href: '#/instances' },
          { label: instance.name },
        ]}
      />

      {/* Top info bar */}
      <div className={styles.topBar}>
        <div
          className={`${styles.topBarIcon} ${iconStatus === 'success' ? styles.topBarIconSuccess : ''} ${iconStatus === 'error' ? styles.topBarIconError : ''} ${iconStatus === 'loading' ? styles.topBarIconLoading : ''}`}
          onClick={handlePickIcon}
          title="Click to change icon"
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={instance.name}
              className={styles.topBarIconImg}
              onError={() => setIconUrl(null)}
            />
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
            {isReady !== null && (
              <span style={{ fontSize: '0.6em' }}>
                {isReady ? '✅' : '⚠️'}
              </span>
            )}
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
            <Button variant="primary" size="md" onClick={handleLaunch}>▶ {t('instanceDetail.launch')}</Button>
          </Tooltip>
          <Tooltip content="Export as .mrpack modpack">
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>📤 {exporting ? 'Exporting...' : 'Export'}</Button>
          </Tooltip>
          <Tooltip content="Duplicate this instance">
            <Button variant="secondary" size="sm" onClick={handleDuplicate}>📋 Duplicate</Button>
          </Tooltip>
          <Tooltip content={t('instanceDetail.delete')}>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>{t('instanceDetail.delete')}</Button>
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
                <InfoRow label="Loader" value={instance.loader_type ? `${getLoaderLabel(instance.loader_type)} ${instance.loader_version || ''}` : 'Vanilla'} />
                <InfoRow label="Java" value={instance.java_path || t('instanceDetail.autoDetect')} />
                <InfoRow label="Created" value={new Date(instance.created_at).toLocaleDateString()} />
                <InfoRow label="Status" value={isReady === null ? 'Checking...' : isReady ? 'Ready' : 'Needs download'} mono />
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
                  <span className={styles.infoRowLabel}>Min Memory</span>
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
                  <span className={styles.infoRowLabel}>JVM Args</span>
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
                  <span className={styles.infoRowLabel}>Java Path</span>
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
                {instance.playtime_seconds > 0 ? `${Math.floor(instance.playtime_seconds / 60)} minutes total` : 'No playtime recorded'}
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statCardLabel}>DOWNLOAD STATUS</div>
              <div className={styles.statCardValue}>
                {isReady === null ? '⏳' : isReady ? '✅ Ready' : '⚠️ Not ready'}
              </div>
              <div className={styles.statCardSub}>
                {isReady ? 'Game files are ready to play' : 'Run launch to download required files'}
              </div>
              {!isReady && isReady !== null && (
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: '10%' }} />
                </div>
              )}
            </div>

            <div className={styles.exportBtn}>
              <Tooltip content="Export instance as ZIP archive">
                <Button
                  variant="secondary-highlight"
                  size="md"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? '⏳ Exporting...' : '📤 ' + t('instanceDetail.exportInstance')}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mods' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {installedMods.length === 0 ? (
            <div className={styles.placeholderTab}>
              No mods installed yet. Browse the mod marketplace to find mods.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {installedMods.map((mod) => (
                <div key={mod.filename} style={{
                  background: '#141414', border: '1px solid #1C1C1C',
                  padding: '10px 14px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF' }}>
                      {mod.filename}
                    </div>
                    <div style={{ fontSize: '0.5em', color: '#666', marginTop: 2 }}>
                      {(mod.size / 1024).toFixed(1)} KB · Installed {new Date(mod.installed_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'saves' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {worlds.length === 0 ? (
            <div className={styles.placeholderTab}>
              {t('instanceDetail.noSaves')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {worlds.map((world) => (
                <div key={world.name} style={{
                  background: '#141414', border: '1px solid #1C1C1C',
                  padding: '10px 14px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
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
                    {world.seed && (
                      <Badge variant="muted">Seed: {world.seed}</Badge>
                    )}
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
              <span style={{ fontSize: '0.5em', color: '#666' }}>
                {t('instanceDetail.noLogs')}
              </span>
            )}
          </div>
          {selectedLog ? (
            loadingLog ? (
              <div style={{ fontSize: '0.6em', color: '#666', padding: 20 }}>Loading...</div>
            ) : (
              <div style={{
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
              }}>
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
            <div className={presetStyles.loading}>Loading presets...</div>
          ) : (
            <>
              <div className={presetStyles.cards}>
                {presets.map((preset) => {
                  const result = applyResults[preset.id];
                  const isApplying = applyingPreset === preset.id;
                  const perfBadgeClass =
                    preset.performance_level === 'low' ? presetStyles.badgeLow :
                    preset.performance_level === 'medium' ? presetStyles.badgeMedium :
                    presetStyles.badgeHigh;
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
                            <span key={mod.slug} className={presetStyles.modPill}>{mod.name}</span>
                          ))}
                        </div>
                      </div>
                      <div className={presetStyles.ramInfo}>
                        <span className={presetStyles.ramLabel}>Min RAM</span>
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
                          {isApplying ? 'Applying...' : 'Apply'}
                        </Button>
                      </div>
                      {result && (
                        <div className={presetStyles.applyResult}>
                          <div className={presetStyles.applyResultSummary}>
                            <span className={presetStyles.applyResultSuccess}>✓ {result.succeeded} succeeded</span>
                            {result.failed > 0 && (
                              <span className={presetStyles.applyResultFailed}>✗ {result.failed} failed</span>
                            )}
                          </div>
                          {result.errors.length > 0 && (
                            <div className={presetStyles.applyResultErrors}>
                              {result.errors.map((err, i) => (
                                <span key={i} className={presetStyles.applyResultError}>{err}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {presets.length === 0 && (
                <div className={presetStyles.loading}>No optimization presets available</div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'migrate' && (
        <div className={styles.migrateTab}>
          <div className={styles.migrateSection}>
            <div className={styles.migrateSectionHeader}>VERSION MIGRATION</div>
            <div className={styles.migrateRow}>
              <select
                className={styles.migrateSelect}
                value={migrationTarget}
                onChange={(e) => setMigrationTarget(e.target.value)}
              >
                <option value="">Select target version...</option>
                {versions
                  .filter((v) => v.type === 'release' || v.type === 'snapshot')
                  .map((v) => (
                    <option key={v.id} value={v.id}>{v.id}</option>
                  ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCheckMigration}
                disabled={!migrationTarget || checkingMigration}
              >
                {checkingMigration ? 'Checking...' : 'Check Compatibility'}
              </Button>
            </div>
            {migrationResults && (
              <div className={styles.migrateResults}>
                {migrationResults.length === 0 ? (
                  <div className={styles.migrateEmpty}>All mods are compatible with {migrationTarget}!</div>
                ) : (
                  migrationResults.map((item) => {
                    const statusBadgeClass =
                      item.status === 'compatible' ? styles.badgeGreen :
                      item.status === 'pending' ? styles.badgeYellow :
                      styles.badgeGray;
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
            <div className={styles.migrateSectionHeader}>SMART TUNE MEMORY</div>
            <p className={styles.migrateDesc}>
              Analyze this instance's installed content and recommend the optimal memory allocation.
            </p>
            <div className={styles.migrateRow}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSmartTune}
                disabled={tuningMemory}
              >
                {tuningMemory ? 'Analyzing...' : 'Smart Tune'}
              </Button>
              {smartMemory !== null && (
                <span className={styles.migrateMemoryResult}>
                  Recommended: <strong>{smartMemory} MB</strong> ({(smartMemory / 1024).toFixed(1)} GB)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className={styles.profileTab}>
          {loadingProfiling ? (
            <div className={styles.placeholderTab}>Loading profiling data...</div>
          ) : !profilingData ? (
            <div className={styles.placeholderTab}>
              {t('instanceDetail.noProfilingData') || 'No profiling data yet - launch the game first'}
            </div>
          ) : (
            <div className={styles.profileContent}>
              <div className={styles.profileHeader}>
                <span className={styles.profileHeaderStage}>STAGE</span>
                <span className={styles.profileHeaderDuration}>DURATION</span>
                <span className={styles.profileHeaderDetails}>DETAILS</span>
              </div>
              {profilingData.map((item, i) => {
                const maxDuration = Math.max(...profilingData.map((p) => p.duration_ms), 1);
                const pct = (item.duration_ms / maxDuration) * 100;
                const colorClass =
                  item.duration_ms < 500 ? styles.barGreen :
                  item.duration_ms < 2000 ? styles.barYellow :
                  styles.barRed;
                const durationLabel = item.duration_ms >= 1000
                  ? `${(item.duration_ms / 1000).toFixed(1)}s`
                  : `${item.duration_ms}ms`;
                return (
                  <div key={i} className={styles.profileRow}>
                    <span className={styles.profileStage}>{item.stage}</span>
                    <div className={styles.profileBarWrap}>
                      <div
                        className={`${styles.profileBar} ${colorClass}`}
                        style={{ width: `${pct}%` }}
                      />
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
            <div className={styles.placeholderTab}>Loading FPS data...</div>
          ) : !fpsData ? (
            <div className={styles.placeholderTab}>
              {t('instanceDetail.noFpsData') || 'Run the game with monitoring enabled'}
            </div>
          ) : (
            <div className={styles.fpsContent}>
              <div className={styles.fpsStats}>
                <div className={styles.fpsStatCard}>
                  <div className={styles.fpsStatLabel}>AVG FPS</div>
                  <div className={styles.fpsStatValue}>{fpsData.avg_fps.toFixed(0)}</div>
                </div>
                <div className={styles.fpsStatCard}>
                  <div className={styles.fpsStatLabel}>MIN FPS</div>
                  <div className={styles.fpsStatValue}>{fpsData.min_fps.toFixed(0)}</div>
                </div>
                <div className={styles.fpsStatCard}>
                  <div className={styles.fpsStatLabel}>1% LOW</div>
                  <div className={styles.fpsStatValue}>{fpsData.p1_low_fps.toFixed(0)}</div>
                </div>
              </div>
              <div className={styles.fpsChartSection}>
                <div className={styles.fpsChartHeader}>FRAME TIMES (first 30 frames)</div>
                <div className={styles.fpsChart}>
                  {fpsData.frame_times_ms.slice(0, 30).map((ft, i) => {
                    const fpsFromFt = ft > 0 ? 1000 / ft : 999;
                    const colorClass =
                      fpsFromFt >= 60 ? styles.barGreen :
                      fpsFromFt >= 30 ? styles.barYellow :
                      styles.barRed;
                    const maxFt = Math.max(...fpsData.frame_times_ms.slice(0, 30), 1);
                    const pct = (ft / maxFt) * 100;
                    return (
                      <div key={i} className={styles.fpsBarRow}>
                        <span className={styles.fpsBarIndex}>{i + 1}</span>
                        <div className={styles.fpsBarTrack}>
                          <div
                            className={`${styles.fpsBar} ${colorClass}`}
                            style={{ width: `${pct}%` }}
                          />
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
                placeholder="Snapshot name (optional)"
                className={styles.snapshotInput}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSnapshot}
                disabled={snapshotLoading}
              >
                {snapshotLoading ? 'Creating...' : '📸 Create Snapshot'}
              </Button>
            </div>
          </div>

          {snapshots.length === 0 ? (
            <div className={styles.placeholderTab}>
              No snapshots yet. Create one to save your current mods, configs, and world saves.
            </div>
          ) : (
            <div className={styles.snapshotList}>
              <div className={styles.snapshotTableHeader}>
                <span className={styles.snapshotColName}>NAME</span>
                <span className={styles.snapshotColDate}>CREATED</span>
                <span className={styles.snapshotColSize}>SIZE</span>
                <span className={styles.snapshotColActions}>ACTIONS</span>
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
                  <span className={styles.snapshotColSize}>
                    {(snap.size_bytes / 1048576).toFixed(1)} MB
                  </span>
                  <span className={styles.snapshotColActions}>
                    <Button
                      variant="secondary-highlight"
                      size="sm"
                      onClick={() => handleRestoreSnapshot(snap.id, snap.name)}
                    >
                      ↺ Restore
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteSnapshot(snap.id, snap.name)}
                    >
                      ✕ Delete
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
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>{t('common.delete')}</Button>
          </>
        }
      >
        {t('instanceDetail.deleteConfirm', { name: instance.name })}
      </Modal>

      {/* Duplicate modal */}
      <Modal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        title="Duplicate Instance"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDuplicateOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={confirmDuplicate} disabled={!duplicateName.trim()}>
              Duplicate
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>New instance name:</label>
          <TextInput
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
            placeholder="Instance name"
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
