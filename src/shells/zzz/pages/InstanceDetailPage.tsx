import { useState, useEffect, useCallback, useMemo, lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  api,
  type GameInstance,
  type InstalledModInfo,
  type WorldInfo,
  type WorldBackupInfo,
  type LogFileInfo,
  type OptimizationPreset,
  type VersionEntry,
  type RunningGameInfo,
  type PreLaunchReport,
  type HealthCheckReport,
} from '../../../shared/api';
import { useAuth } from '../../../shared/stores/authStore';
import { useInstances } from '../../../shared/stores/instanceStore';
import { useToast } from '../../../shared/stores/toastStore';
import { useI18n } from '../../../shared/i18n';
import { Badge, Modal, TextInput, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { getLoaderIcon, getLoaderLabel } from '../../../shared/utils/loader';
import GameConsole from '../components/ui/GameConsole';
import LogViewer from '../components/ui/LogViewer';
import { relativeTime } from '../../../shared/utils/time';
import { formatError } from '../../../shared/utils/errorMapping';
import { open, save } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { showContextMenu, type ContextMenuItem } from '../components/ContextMenu';
import styles from './InstanceDetailPage.module.css';
import presetStyles from '../components/ui/OptimizationPresets.module.css';
import { usePluginInstanceTabs } from '../../../app/hooks/usePluginInstanceTabs';
import { PluginErrorBoundary } from '../../../app/components/PluginErrorBoundary';

type SnapshotInfo = {
  id: string;
  name: string;
  created_at: string;
  size_bytes: number;
};

function buildDetailTabs(t: (key: string) => string, modCount: number) {
  return [
    { id: 'overview', label: t('instanceDetail.overview') },
    { id: 'mods', label: `${t('instanceDetail.mods')} (${modCount})` },
    { id: 'resourcepacks', label: t('instanceDetail.resourcePacks') },
    { id: 'saves', label: t('instanceDetail.saves') },
    { id: 'schematics', label: t('instanceDetail.schematics') },
    { id: 'logs', label: t('instanceDetail.logs') },
    { id: 'screenshots', label: t('instanceDetail.screenshots') },
    { id: 'snapshots', label: t('instanceDetail.snapshots') },
    { id: 'optimize', label: t('instanceDetail.optimize') },
    { id: 'migrate', label: t('instanceDetail.migrate') },
  ];
}

export default function InstanceDetailPage() {
  const { state: authState } = useAuth();
  const { state, deleteInstance, reloadInstances } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();
  const { id: routeId = '' } = useParams<{ id: string }>();
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

  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // 资源包 + 投影文件（参考 HMCL VersionPage resourcePackTab / schematicsTab）
  const [resourcePacks, setResourcePacks] = useState<string[]>([]);
  const [resourcePacksLoading, setResourcePacksLoading] = useState(false);
  const [schematics, setSchematics] = useState<string[]>([]);
  const [schematicsLoading, setSchematicsLoading] = useState(false);

  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotLoading, setSnapshotLoading] = useState(false);

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

  const [healthReport, setHealthReport] = useState<HealthCheckReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);

  const [showLogViewer, setShowLogViewer] = useState(false);
  const [runningGames, setRunningGames] = useState<RunningGameInfo[]>([]);
  const [preLaunchReport, setPreLaunchReport] = useState<PreLaunchReport | null>(null);
  const [showPreLaunchModal, setShowPreLaunchModal] = useState(false);
  const [checkingPreLaunch, setCheckingPreLaunch] = useState(false);
  const [removeModTarget, setRemoveModTarget] = useState<string | null>(null);
  const [togglingMod, setTogglingMod] = useState<string | null>(null);

  // 存档管理状态（参考 HMCL WorldBackupTask）
  const [worldBackups, setWorldBackups] = useState<WorldBackupInfo[]>([]);
  const [backingUpWorld, setBackingUpWorld] = useState<string | null>(null);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);

  // Mods 搜索/过滤/批量选择（参考 HMCL ModListPage 三态工具栏）
  const [modSearch, setModSearch] = useState('');
  const [modFilter, setModFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [modInfoTarget, setModInfoTarget] = useState<InstalledModInfo | null>(null);

  // 实例目录路径（用于快速打开子目录，参考 HMCL VersionPage 浏览按钮）
  const [instanceGameDir, setInstanceGameDir] = useState<string>('');

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
          setInstanceGameDir(`${gameDir}/instances/${instanceId}/.minecraft`);
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
    if (activeTab === 'screenshots' && instanceId) {
      loadScreenshots();
    }
  }, [activeTab, instanceId]);

  // 资源包/投影懒加载（参考 HMCL VersionPage 标签懒加载）
  useEffect(() => {
    if (activeTab === 'resourcepacks' && instanceId) {
      setResourcePacksLoading(true);
      api.listInstanceResourcepacks(instanceId)
        .then(setResourcePacks)
        .catch(() => setResourcePacks([]))
        .finally(() => setResourcePacksLoading(false));
    }
  }, [activeTab, instanceId]);

  useEffect(() => {
    if (activeTab === 'schematics' && instanceId) {
      setSchematicsLoading(true);
      api.listInstanceSchematics(instanceId)
        .then(setSchematics)
        .catch(() => setSchematics([]))
        .finally(() => setSchematicsLoading(false));
    }
  }, [activeTab, instanceId]);

  useEffect(() => {
    if (activeTab === 'snapshots' && instanceId) {
      loadSnapshots();
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

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const games = await api.getRunningGames();
        if (!cancelled) setRunningGames(games);
      } catch {
        if (!cancelled) setRunningGames([]);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Apply Failed', message: formatError(e) || t('instanceDetail.presetFailed') });
    } finally {
      setApplyingPreset(null);
    }
  };

  const refreshMods = useCallback(() => {
    if (!instanceId) return;
    api
      .listInstanceMods(instanceId)
      .then(setInstalledMods)
      .catch(() => {});
  }, [instanceId]);

  const handleToggleMod = async (filename: string) => {
    if (!instanceId) return;
    setTogglingMod(filename);
    try {
      const newEnabled = await api.toggleMod(instanceId, filename);
      setInstalledMods((prev) =>
        prev.map((m) => (m.filename === filename ? { ...m, enabled: newEnabled } : m)),
      );
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('library.toggleModFailed'), message: formatError(e) });
    } finally {
      setTogglingMod(null);
    }
  };

  const handleRemoveMod = async () => {
    if (!removeModTarget || !instanceId) return;
    try {
      await api.removeInstalledMod(instanceId, removeModTarget);
      addToast({ type: 'success', title: t('common.remove'), message: removeModTarget });
      setRemoveModTarget(null);
      refreshMods();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('library.remove'), message: formatError(e) });
    }
  };

  // 批量操作（参考 HMCL ModListPage Selecting 态）
  const handleBatchToggleMods = async (enable: boolean) => {
    if (!instanceId || selectedMods.size === 0) return;
    const targets = installedMods.filter((m) => selectedMods.has(m.filename) && m.enabled !== enable);
    for (const mod of targets) {
      try {
        const newEnabled = await api.toggleMod(instanceId, mod.filename);
        setInstalledMods((prev) =>
          prev.map((m) => (m.filename === mod.filename ? { ...m, enabled: newEnabled } : m)),
        );
      } catch {
        /* 静默忽略单个失败 */
      }
    }
    addToast({
      type: 'success',
      title: enable ? t('library.enable') : t('library.disable'),
      message: `${targets.length} mod(s)`,
    });
    setSelectedMods(new Set());
  };

  const handleBatchDeleteMods = async () => {
    if (!instanceId || selectedMods.size === 0) return;
    if (!confirm(t('instanceDetail.batchDeleteConfirm', { count: String(selectedMods.size) }))) return;
    const targets = [...selectedMods];
    let failed = 0;
    for (const filename of targets) {
      try {
        await api.removeInstalledMod(instanceId, filename);
      } catch {
        failed++;
      }
    }
    setSelectedMods(new Set());
    refreshMods();
    addToast({
      type: failed === 0 ? 'success' : 'error',
      title: t('common.delete'),
      message: `${targets.length - failed} deleted${failed > 0 ? `, ${failed} failed` : ''}`,
    });
  };

  const handleToggleModSelection = (filename: string) => {
    setSelectedMods((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const handleSelectAllMods = () => {
    setSelectedMods(new Set(filteredMods.map((m) => m.filename)));
  };

  const handleClearModSelection = () => {
    setSelectedMods(new Set());
  };

  // 打开实例子目录（参考 HMCL VersionPage 浏览按钮）
  const handleOpenSubFolder = (subpath: string) => {
    if (!instanceGameDir) return;
    api.openFolder(`${instanceGameDir}/${subpath}`).catch(() => {
      addToast({ type: 'error', title: t('common.error'), message: subpath });
    });
  };

  // 打开存档目录
  const handleOpenWorldFolder = (worldName: string) => {
    handleOpenSubFolder(`saves/${worldName}`);
  };

  // ═══════════════════════════════════════════════════════════════════
  // 存档管理（参考 HMCL WorldBackupTask / VersionSettings）
  // ═══════════════════════════════════════════════════════════════════
  const refreshWorlds = useCallback(() => {
    if (!instanceId) return;
    api.listInstanceSaves(instanceId).then(setWorlds).catch(() => {});
  }, [instanceId]);

  const refreshBackups = useCallback(async () => {
    if (!instanceId) return;
    try {
      const backups = await api.listWorldBackups(instanceId);
      setWorldBackups(backups);
    } catch {
      setWorldBackups([]);
    }
  }, [instanceId]);

  useEffect(() => {
    if (activeTab === 'saves' && instanceId) {
      refreshBackups();
    }
  }, [activeTab, instanceId, refreshBackups]);

  const handleBackupWorld = async (worldName: string) => {
    if (!instanceId) return;
    setBackingUpWorld(worldName);
    try {
      await api.backupWorld(instanceId, worldName);
      addToast({ type: 'success', title: t('instanceDetail.backupCreated'), message: worldName });
      await refreshBackups();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.backupFailed'), message: formatError(e) });
    } finally {
      setBackingUpWorld(null);
    }
  };

  const handleRestoreBackup = async (backupFilename: string) => {
    if (!instanceId) return;
    setRestoringBackup(backupFilename);
    try {
      const restoredName = await api.restoreWorld(instanceId, backupFilename);
      addToast({ type: 'success', title: t('instanceDetail.restoreBackup'), message: t('instanceDetail.restoreSuccess', { name: restoredName }) });
      refreshWorlds();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.restoreFailed'), message: formatError(e) });
    } finally {
      setRestoringBackup(null);
    }
  };

  const handleDeleteBackup = async (backupFilename: string) => {
    if (!instanceId) return;
    if (!confirm(t('instanceDetail.deleteBackupConfirm', { name: backupFilename }))) return;
    try {
      await api.deleteWorldBackup(instanceId, backupFilename);
      await refreshBackups();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('common.delete'), message: formatError(e) });
    }
  };

  const handleExportWorld = async (worldName: string) => {
    if (!instanceId) return;
    try {
      const path = await save({
        defaultPath: `${worldName}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (path && typeof path === 'string') {
        await api.exportWorld(instanceId, worldName, path);
        addToast({ type: 'success', title: t('instanceDetail.exportWorld'), message: worldName });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.exportWorld'), message: formatError(e) });
    }
  };

  const handleImportWorld = async () => {
    if (!instanceId) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (selected && typeof selected === 'string') {
        const worldName = await api.importWorld(instanceId, selected);
        addToast({ type: 'success', title: t('instanceDetail.importWorld'), message: t('instanceDetail.importWorldSuccess', { name: worldName }) });
        refreshWorlds();
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.importWorldFailed'), message: formatError(e) });
    }
  };

  const handleRenameWorld = async (oldName: string) => {
    if (!instanceId) return;
    const newName = prompt(t('instanceDetail.renameWorldPrompt'), oldName);
    if (!newName || newName === oldName) return;
    try {
      await api.renameWorld(instanceId, oldName, newName);
      refreshWorlds();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.renameWorld'), message: formatError(e) });
    }
  };

  const handleDuplicateWorld = async (worldName: string) => {
    if (!instanceId) return;
    const newName = prompt(t('instanceDetail.duplicateWorldPrompt'), `${worldName}_copy`);
    if (!newName) return;
    try {
      await api.duplicateWorld(instanceId, worldName, newName);
      refreshWorlds();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.duplicateWorld'), message: formatError(e) });
    }
  };

  const handleDeleteWorld = async (worldName: string) => {
    if (!instanceId) return;
    if (!confirm(t('instanceDetail.deleteWorldConfirm', { name: worldName }))) return;
    try {
      await api.deleteWorld(instanceId, worldName);
      refreshWorlds();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.deleteWorld'), message: formatError(e) });
    }
  };

  // 存档右键/更多菜单（参考 HMCL WorldListCell PopupMenu）
  const handleShowWorldMenu = (e: React.MouseEvent, world: WorldInfo) => {
    const items: ContextMenuItem[] = [
      { id: 'backup', label: t('instanceDetail.backupWorld'), action: () => handleBackupWorld(world.name) },
      { id: 'export', label: t('instanceDetail.exportWorld'), action: () => handleExportWorld(world.name) },
      { id: 'sep1', label: '', separator: true, action: () => {} },
      { id: 'rename', label: t('instanceDetail.renameWorld'), action: () => handleRenameWorld(world.name) },
      { id: 'duplicate', label: t('instanceDetail.duplicateWorld'), action: () => handleDuplicateWorld(world.name) },
      { id: 'sep2', label: '', separator: true, action: () => {} },
      { id: 'openFolder', label: t('instanceDetail.openWorldFolder'), action: () => handleOpenWorldFolder(world.name) },
      { id: 'sep3', label: '', separator: true, action: () => {} },
      { id: 'delete', label: t('instanceDetail.deleteWorld'), danger: true, action: () => handleDeleteWorld(world.name) },
    ];
    showContextMenu(e, items);
  };

  const handleCheckMigration = async () => {
    if (!instanceId || !migrationTarget) return;
    setCheckingMigration(true);
    setMigrationResults(null);
    try {
      const results = await api.checkMigrationReadiness(instanceId, migrationTarget);
      setMigrationResults(results);
    } catch (e: unknown) {
      addToast({
        type: 'error',
        title: 'Migration Check Failed',
        message: formatError(e) || 'Failed to check migration',
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
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Smart Tune Failed', message: formatError(e) || 'Failed to tune memory' });
    } finally {
      setTuningMemory(false);
    }
  };

  const handleHealthCheck = async () => {
    if (!instanceId) return;
    setHealthLoading(true);
    setHealthReport(null);
    try {
      const report = await api.healthCheck(instanceId);
      setHealthReport(report);
      setHealthModalOpen(true);
    } catch (e: unknown) {
      addToast({
        type: 'error',
        title: 'Health Check Failed',
        message: formatError(e) || 'Failed to run health check',
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const loadScreenshots = async () => {
    setScreenshotLoading(true);
    try {
      const list = await api.listScreenshots(instanceId);
      setScreenshots(list.map((s) => s.path));
    } catch {
      /* empty */
    }
    setScreenshotLoading(false);
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
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Snapshot failed', message: formatError(e) || 'Failed to create snapshot' });
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
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Restore failed', message: formatError(e) || 'Failed to restore snapshot' });
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string, name: string) => {
    if (!instanceId) return;
    if (!confirm(`Delete snapshot "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteSnapshot(instanceId, snapshotId);
      await loadSnapshots();
      addToast({ type: 'success', title: 'Deleted', message: `Snapshot "${name}" deleted` });
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Delete failed', message: formatError(e) || 'Failed to delete snapshot' });
    }
  };

  const handleLaunch = useCallback(async () => {
    if (!instance) return;
    setError('');
    setCheckingPreLaunch(true);
    try {
      const report = await api.preLaunchCheck(instance.id);
      setPreLaunchReport(report);
      const hasFail = report.items.some((i) => i.status === 'fail');
      if (hasFail) {
        setShowPreLaunchModal(true);
        return;
      }
      const hasWarn = report.items.some((i) => i.status === 'warn');
      if (hasWarn) {
        setShowPreLaunchModal(true);
        return;
      }
    } catch {
      /* empty */
    } finally {
      setCheckingPreLaunch(false);
    }
    await doLaunch();
  }, [instance, auth, addToast, t]);

  const doLaunch = useCallback(async () => {
    if (!instance) return;
    setError('');
    setShowPreLaunchModal(false);
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
    } catch (e: unknown) {
      setError(formatError(e) || t('instances.launchFailed'));
      addToast({
        type: 'error',
        title: t('instances.launchFailed'),
        message: formatError(e) || t('instances.launchFailed'),
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
    } catch (e: unknown) {
      setIconStatus('error');
      addToast({ type: 'error', title: 'Icon Failed', message: formatError(e) || 'Failed to set icon' });
      setTimeout(() => setIconStatus('idle'), 2500);
    }
  };

  const handleDelete = async () => {
    if (!instance) return;
    try {
      await deleteInstance(instance.id);
      addToast({ type: 'success', title: 'Deleted', message: `Instance "${instance.name}" deleted` });
      navigate('/instances');
    } catch (e) {
      addToast({ type: 'error', title: 'Delete failed', message: formatError(e) });
    }
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
    } catch (e: unknown) {
      addToast({ type: 'error', title: 'Duplicate failed', message: formatError(e) || 'Failed to duplicate' });
    }
  };

  const handleExport = async () => {
    if (!instance) return;
    setExporting(true);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const safeName = instance.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = await save({
        defaultPath: `${safeName}.mrpack`,
        filters: [{ name: 'Mrpack', extensions: ['mrpack'] }],
      });
      if (path && typeof path === 'string') {
        await api.exportMrpack(instance.id, path);
        addToast({ type: 'success', title: t('instances.exportAsMrpack') || 'Exported' });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instances.exportFailed') || 'Export failed', message: formatError(e) || '' });
    } finally {
      setExporting(false);
    }
  };

  // 管理菜单操作（参考 HMCL VersionPage 管理按钮）
  const handleExportConfig = async () => {
    if (!instanceId) return;
    try {
      const code = await api.exportInstanceConfig(instanceId);
      await navigator.clipboard.writeText(code);
      addToast({ type: 'success', title: t('instanceDetail.exportConfig'), message: t('instanceDetail.configCopied') });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.exportConfig'), message: formatError(e) });
    }
  };

  const handleImportConfig = async () => {
    const code = prompt(t('instanceDetail.importConfigPrompt'));
    if (!code) return;
    try {
      await api.importInstanceConfig(code.trim());
      addToast({ type: 'success', title: t('instanceDetail.importConfig') });
      window.location.reload();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.importConfig'), message: formatError(e) });
    }
  };

  const handleCleanTrash = async () => {
    try {
      const count = await api.cleanupTrash();
      addToast({ type: 'success', title: t('instanceDetail.cleanTrash'), message: `${count} items` });
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('instanceDetail.cleanTrash'), message: formatError(e) });
    }
  };

  const handleUpdateInstance = useCallback(
    async (updates: Partial<GameInstance>) => {
      if (!instance) return;
      try {
        const updated = { ...instance, ...updates };
        await api.updateInstance(updated);
        setInstance(updated);
        addToast({ type: 'success', title: t('instanceDetail.updateSuccess') });
      } catch (e: unknown) {
        addToast({ type: 'error', title: t('instanceDetail.updateFailed'), message: formatError(e) });
      }
    },
    [instance, addToast, t],
  );

  const pluginTabs = usePluginInstanceTabs();
  const pluginTabComponents = useMemo(() => {
    const map: Record<string, LazyExoticComponent<ComponentType<unknown>>> = {};
    for (const tab of pluginTabs) {
      map[tab.id] = lazy(tab.component);
    }
    return map;
  }, [pluginTabs]);
  const DETAIL_TABS = useMemo(() => {
    const base = buildDetailTabs(t, installedMods.length);
    return [
      ...base,
      ...pluginTabs.map((tab) => ({ id: tab.id, label: tab.label })),
    ];
  }, [t, installedMods.length, pluginTabs]);

  // 过滤后的模组列表（搜索 + 启用/禁用过滤）
  const filteredMods = useMemo(() => {
    const q = modSearch.trim().toLowerCase();
    return installedMods.filter((m) => {
      if (modFilter === 'enabled' && !m.enabled) return false;
      if (modFilter === 'disabled' && m.enabled) return false;
      if (q && !m.filename.toLowerCase().includes(q) && !(m.slug || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [installedMods, modSearch, modFilter]);

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
      {/* 面包屑由全局 PageBreadcrumb 统一渲染，此处不再重复 */}

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
            <span className={styles.topBarIconEmoji}><Icon name={getLoaderIcon(instance.loader_type)} size={28} /></span>
          )}
          {iconStatus === 'loading' && <span className={styles.iconStatusOverlay}><Icon name="hourglass" size={12} /></span>}
          {iconStatus === 'success' && <span className={styles.iconStatusOverlay}><Icon name="check" size={12} /></span>}
          {iconStatus === 'error' && <span className={styles.iconStatusOverlay}><Icon name="cross" size={12} /></span>}
        </div>
        <div className={styles.topBarInfo}>
          <div className={styles.topBarNameRow}>
            <span className={styles.topBarName}>{instance.name.toUpperCase()}</span>
            <Badge variant="accent">{instance.version_id}</Badge>
            {instance.loader_type && <Badge variant="muted">{instance.loader_type}</Badge>}
            {isReady !== null && <span style={{ fontSize: '0.6em' }}>{isReady ? <Icon name="checkCircle" size={12} /> : <Icon name="warning" size={12} />}</span>}
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
          {runningGames.some((g) => g.instance_id === instanceId && g.state === 'running') && (
            <Tooltip content={t('instanceDetail.viewLogs')}>
              <Button variant="secondary" size="sm" onClick={() => setShowLogViewer(true)}>
                <Icon name="copy" size={14} /> {t('instanceDetail.logs')}
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('common.launch')}>
            <Button variant="primary" size="md" onClick={handleLaunch} disabled={checkingPreLaunch}>
              <Icon name="play" size={14} /> {t('instanceDetail.launch')}
            </Button>
          </Tooltip>
          <Tooltip content={t('instanceDetail.healthCheck')}>
            <Button variant="secondary" size="sm" onClick={handleHealthCheck} disabled={healthLoading}>
              <Icon name="lightbulb" size={14} /> {healthLoading ? t('common.checking') : t('instanceDetail.healthCheck')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* HMCL VersionPage layout: left sidebar (vertical tabs + bottom toolbar) + right content */}
      <div className={styles.detailLayout}>
        <aside className={styles.detailSidebar}>
          {/* 垂直标签栏 */}
          <div className={styles.detailSidebar__tabs}>
            <div className={styles.vTabCategory}>{t('instanceDetail.management')}</div>
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.vTab} ${activeTab === tab.id ? styles.vTabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 底部工具栏（参考 HMCL VersionPage：浏览/管理/删除） */}
          <div className={styles.detailSidebar__toolbar}>
            {/* 浏览下拉菜单 */}
            <button
              className={styles.toolbarBtn}
              onClick={(e) => {
                showContextMenu(e as unknown as React.MouseEvent, [
                  { id: 'root', label: t('instanceDetail.folderGameDir'), action: () => handleOpenSubFolder('') },
                  { id: 'mods', label: t('instanceDetail.folderMods'), action: () => handleOpenSubFolder('mods') },
                  { id: 'saves', label: t('instanceDetail.folderSaves'), action: () => handleOpenSubFolder('saves') },
                  { id: 'resourcepacks', label: t('instanceDetail.folderResourcePacks'), action: () => handleOpenSubFolder('resourcepacks') },
                  { id: 'shaderpacks', label: t('instanceDetail.folderShaderPacks'), action: () => handleOpenSubFolder('shaderpacks') },
                  { id: 'screenshots', label: t('instanceDetail.folderScreenshots'), action: () => handleOpenSubFolder('screenshots') },
                  { id: 'config', label: t('instanceDetail.folderConfig'), action: () => handleOpenSubFolder('config') },
                  { id: 'logs', label: t('instanceDetail.folderLogs'), action: () => handleOpenSubFolder('logs') },
                  { id: 'crashreports', label: t('instanceDetail.folderCrashReports'), action: () => handleOpenSubFolder('crash-reports') },
                ]);
              }}
            >
              <Icon name="folder" size={14} /> {t('instanceDetail.browse')}
            </button>
            {/* 导出 */}
            <button
              className={styles.toolbarBtn}
              onClick={handleExport}
              disabled={exporting}
            >
              <Icon name="upload" size={14} /> {exporting ? t('instanceDetail.exporting') : t('instanceDetail.export')}
            </button>
            {/* 复制 */}
            <button
              className={styles.toolbarBtn}
              onClick={handleDuplicate}
            >
              <Icon name="copy" size={14} /> {t('instanceDetail.duplicate')}
            </button>
            {/* 管理下拉菜单 */}
            <button
              className={styles.toolbarBtn}
              onClick={(e) => {
                showContextMenu(e as unknown as React.MouseEvent, [
                  { id: 'exportConfig', label: t('instanceDetail.exportConfig'), action: () => handleExportConfig() },
                  { id: 'importConfig', label: t('instanceDetail.importConfig'), action: () => handleImportConfig() },
                  { id: 'sep1', label: '', separator: true, action: () => {} },
                  { id: 'cleanTrash', label: t('instanceDetail.cleanTrash'), action: () => handleCleanTrash() },
                ]);
              }}
            >
              <Icon name="settings" size={14} /> {t('instanceDetail.management')}
            </button>
            {/* 删除 */}
            <button
              className={`${styles.toolbarBtn} ${styles['toolbarBtn--danger']}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Icon name="trash" size={14} /> {t('instanceDetail.delete')}
            </button>
          </div>
        </aside>

        {/* 右侧内容区 */}
        <div className={styles.detailContent}>
      {activeTab === 'overview' && (
        <div className={styles.tabContent}>
          {/* Left column */}
          <div className={styles.leftCol}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>{t('instanceDetail.versionInfo').toUpperCase()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <InfoRow label={t('instanceDetail.info.minecraft')} value={instance.version_id} />
                <InfoRow
                  label={t('instanceDetail.info.loader')}
                  value={
                    instance.loader_type
                      ? `${getLoaderLabel(instance.loader_type)} ${instance.loader_version || ''}`
                      : t('common.vanilla')
                  }
                />
                <InfoRow label={t('instanceDetail.info.java')} value={instance.java_path || t('instanceDetail.autoDetect')} />
                <InfoRow label={t('instanceDetail.info.created')} value={new Date(instance.created_at).toLocaleDateString()} />
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
                {isReady === null ? <Icon name="hourglass" size={12} /> : isReady ? <><Icon name="checkCircle" size={12} /> {t('common.ready')}</> : <><Icon name="warning" size={12} /> {t('common.needsDownload')}</>}
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
                  {exporting ? <><Icon name="hourglass" size={12} /> {t('instanceDetail.exporting')}</> : <><Icon name="upload" size={14} /> {t('instanceDetail.exportInstance')}</>}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mods' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {installedMods.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noModsInstalled')}</div>
          ) : (
            <>
              {/* 工具栏（参考 HMCL ModListPage 三态：Normal / Selecting / Search） */}
              {selectedMods.size > 0 ? (
                /* Selecting 态：批量操作 */
                <div className={styles.modToolbar}>
                  <span className={styles.modCount}>
                    {t('instanceDetail.selectedCount', { count: String(selectedMods.size) })}
                  </span>
                  <Button variant="primary" size="sm" onClick={() => handleBatchToggleMods(true)}>
                    <Icon name="check" size={12} /> {t('library.enable')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleBatchToggleMods(false)}>
                    <Icon name="cross" size={12} /> {t('library.disable')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleBatchDeleteMods}>
                    <Icon name="trash" size={12} /> {t('common.delete')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleSelectAllMods}>
                    {t('instanceDetail.selectAll')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleClearModSelection}>
                    {t('instanceDetail.deselectAll')}
                  </Button>
                </div>
              ) : (
                /* Normal 态：搜索/过滤/操作 */
                <div className={styles.modToolbar}>
                  <div className={styles.modSearchWrap}>
                    <Icon name="search" size={12} />
                    <input
                      type="text"
                      className={styles.modSearchInput}
                      placeholder={t('instanceDetail.modSearchPlaceholder')}
                      value={modSearch}
                      onChange={(e) => setModSearch(e.target.value)}
                    />
                    {modSearch && (
                      <button
                        type="button"
                        className={styles.modSearchClear}
                        onClick={() => setModSearch('')}
                        title={t('common.clear')}
                      >
                        <Icon name="cross" size={12} />
                      </button>
                    )}
                  </div>
                  <div className={styles.modFilterGroup}>
                    {(['all', 'enabled', 'disabled'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`${styles.modFilterBtn} ${modFilter === f ? styles.modFilterBtnActive : ''}`}
                        onClick={() => setModFilter(f)}
                      >
                        {f === 'all'
                          ? t('instanceDetail.modFilterAll')
                          : f === 'enabled'
                            ? t('instanceDetail.modFilterEnabled')
                            : t('instanceDetail.modFilterDisabled')}
                      </button>
                    ))}
                  </div>
                  <Tooltip content={t('instanceDetail.openModsFolder')}>
                    <Button variant="secondary" size="sm" onClick={() => handleOpenSubFolder('mods')}>
                      <Icon name="settings" size={12} />
                    </Button>
                  </Tooltip>
                  <span className={styles.modCount}>
                    {filteredMods.length} / {installedMods.length}
                  </span>
                </div>
              )}

              {/* Mod 列表 */}
              {filteredMods.length === 0 ? (
                <div className={styles.placeholderTab}>{t('instanceDetail.noModsMatched')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredMods.map((mod) => {
                    const isDisabled = mod.enabled === false;
                    const isSelected = selectedMods.has(mod.filename);
                    return (
                      <div
                        key={mod.filename}
                        className={`${styles.modRow} ${isDisabled ? styles.modRowDisabled : ''} ${isSelected ? styles.modRowSelected : ''}`}
                      >
                        <label className={styles.modCheckbox} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleModSelection(mod.filename)}
                          />
                        </label>
                        <div className={styles.modRow__info}>
                          <div className={styles.modRow__name}>{mod.filename}</div>
                          <div className={styles.modRow__meta}>
                            {t('instanceDetail.modSize', {
                              size: (mod.size / 1024).toFixed(1),
                              date: new Date(mod.installed_at).toLocaleDateString(),
                            })}
                            {mod.slug && ` · ${mod.slug}`}
                            {mod.source && ` · ${mod.source}`}
                          </div>
                        </div>
                        <div className={styles.modRow__actions}>
                          {mod.pinned && <Badge variant="accent">PIN</Badge>}
                          {isDisabled && <Badge variant="muted">{t('library.disable')}</Badge>}
                          <Tooltip content={t('instanceDetail.modInfo')}>
                            <Button variant="secondary" size="sm" onClick={() => setModInfoTarget(mod)}>
                              <Icon name="lightbulb" size={12} />
                            </Button>
                          </Tooltip>
                          <Button
                            variant={isDisabled ? 'primary' : 'secondary'}
                            size="sm"
                            disabled={togglingMod === mod.filename}
                            onClick={() => handleToggleMod(mod.filename)}
                          >
                            {togglingMod === mod.filename
                              ? <Icon name="hourglass" size={12} />
                              : isDisabled ? t('library.enable') : t('library.disable')}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setRemoveModTarget(mod.filename)}>
                            <Icon name="trash" size={12} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'saves' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 顶部操作栏（参考 HMCL WorldListPage） */}
          <div className={styles.savesToolbar}>
            <Button variant="secondary" size="sm" onClick={handleImportWorld}>
              <Icon name="download" size={14} /> {t('instanceDetail.importWorld')}
            </Button>
            <Button variant="secondary" size="sm" onClick={refreshWorlds}>
              <Icon name="arrowCurveLeft" size={14} /> {t('common.refresh') || 'Refresh'}
            </Button>
          </div>

          {/* 存档列表 */}
          {worlds.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noSaves')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {worlds.map((world) => (
                <div
                  key={world.name}
                  className={styles.worldRow}
                  onContextMenu={(e) => handleShowWorldMenu(e, world)}
                >
                  <div className={styles.worldRow__info}>
                    <div className={styles.worldRow__name}>
                      <Icon name="globe" size={14} /> {world.name}
                    </div>
                    <div className={styles.worldRow__meta}>
                      {world.game_mode} · {world.difficulty} · {world.size_mb.toFixed(1)} MB
                      {world.last_played && ` · ${relativeTime(world.last_played)}`}
                      {world.version_name && ` · ${world.version_name}`}
                    </div>
                  </div>
                  <div className={styles.worldRow__badges}>
                    {world.seed != null && <Badge variant="muted">Seed: {world.seed}</Badge>}
                    {world.hardcore && <Badge variant="accent">Hardcore</Badge>}
                  </div>
                  <div className={styles.worldRow__actions}>
                    {/* 主操作：备份（最常用） */}
                    <Tooltip content={t('instanceDetail.backupWorld')}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={backingUpWorld === world.name}
                        onClick={() => handleBackupWorld(world.name)}
                      >
                        {backingUpWorld === world.name ? <Icon name="hourglass" size={12} /> : <Icon name="copy" size={12} />}
                      </Button>
                    </Tooltip>
                    {/* 更多操作：右键菜单（参考 HMCL WorldListCell PopupMenu） */}
                    <Tooltip content={t('instanceDetail.moreActions')}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => handleShowWorldMenu(e as unknown as React.MouseEvent, world)}
                      >
                        <Icon name="settings" size={12} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 备份列表（参考 HMCL WorldBackupTask） */}
          <div className={styles.backupsSection}>
            <div className={styles.backupsHeader}>
              <span className={styles.backupsTitle}>
                {t('instanceDetail.worldBackupsCount', { count: String(worldBackups.length) })}
              </span>
            </div>
            {worldBackups.length === 0 ? (
              <div className={styles.backupsEmpty}>{t('instanceDetail.noBackups')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {worldBackups.map((backup) => (
                  <div key={backup.filename} className={styles.backupRow}>
                    <div className={styles.backupRow__info}>
                      <div className={styles.backupRow__name}>{backup.world_name}</div>
                      <div className={styles.backupRow__meta}>
                        {new Date(backup.created_at).toLocaleString('zh-CN', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                        {' · '}{backup.size_mb.toFixed(1)} MB
                      </div>
                      <div className={styles.backupRow__file}>{backup.filename}</div>
                    </div>
                    <div className={styles.backupRow__actions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={restoringBackup === backup.filename}
                        onClick={() => handleRestoreBackup(backup.filename)}
                      >
                        {restoringBackup === backup.filename
                          ? <Icon name="hourglass" size={12} />
                          : <><Icon name="arrowCurveLeft" size={12} /> {t('instanceDetail.restoreBackup')}</>}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteBackup(backup.filename)}>
                        <Icon name="trash" size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 资源包管理（参考 HMCL VersionPage resourcePackTab） */}
      {activeTab === 'resourcepacks' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.savesToolbar}>
            <Button variant="secondary" size="sm" onClick={() => handleOpenSubFolder('resourcepacks')}>
              <Icon name="settings" size={14} /> {t('instanceDetail.openFolder')}
            </Button>
          </div>
          {resourcePacksLoading ? (
            <div className={styles.placeholderTab}>{t('common.loading') || 'Loading...'}</div>
          ) : resourcePacks.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noResourcePacks')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {resourcePacks.map((name) => (
                <div key={name} className={styles.modRow}>
                  <div className={styles.modRow__info}>
                    <div className={styles.modRow__name}>
                      <Icon name="palette" size={14} /> {name}
                    </div>
                  </div>
                  <div className={styles.modRow__actions}>
                    <Button variant="secondary" size="sm" onClick={() => handleOpenSubFolder(`resourcepacks/${name}`)}>
                      <Icon name="settings" size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 投影文件管理（参考 HMCL VersionPage schematicsTab） */}
      {activeTab === 'schematics' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.savesToolbar}>
            <Button variant="secondary" size="sm" onClick={() => handleOpenSubFolder('schematics')}>
              <Icon name="folder" size={14} /> {t('instanceDetail.openFolder')}
            </Button>
          </div>
          {schematicsLoading ? (
            <div className={styles.placeholderTab}>{t('common.loading') || 'Loading...'}</div>
          ) : schematics.length === 0 ? (
            <div className={styles.placeholderTab}>{t('instanceDetail.noSchematics')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {schematics.map((name) => (
                <div key={name} className={styles.modRow}>
                  <div className={styles.modRow__info}>
                    <div className={styles.modRow__name}>
                      <Icon name="cube" size={14} /> {name}
                    </div>
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
                        <div className={presetStyles.modsLabel}>{t('instanceDetail.includedMods')}</div>
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
                              <Icon name="check" size={12} /> {t('instanceDetail.presetSucceeded', { count: String(result.succeeded) })}
                            </span>
                            {result.failed > 0 && (
                              <span className={presetStyles.applyResultFailed}>
                                <Icon name="cross" size={12} /> {t('instanceDetail.presetFailed', { count: String(result.failed) })}
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

      {activeTab === 'screenshots' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {screenshotLoading ? (
            <p style={{ color: 'var(--color-text-dim)', fontSize: '0.7em', padding: '1em' }}>{t('instanceDetail.screenshotsLoading')}</p>
          ) : screenshots.length === 0 ? (
            <p style={{ color: 'var(--color-text-dim)', fontSize: '0.7em', padding: '1em' }}>{t('instanceDetail.noScreenshots')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {screenshots.map((path, i) => (
                <img
                  key={i}
                  src={path}
                  alt={t('instanceDetail.screenshotAlt', { index: String(i + 1) })}
                  style={{
                    width: '100%',
                    aspectRatio: '16/10',
                    objectFit: 'cover',
                    clipPath: 'var(--clip-small)',
                    cursor: 'pointer',
                  }}
                  onClick={() => api.openFolder(path)}
                />
              ))}
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
                {snapshotLoading ? t('instanceDetail.creating') : <><Icon name="camera" size={14} /> {t('instanceDetail.createSnapshot')}</>}
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
                      <><Icon name="arrowCurveLeft" size={14} /> {t('instanceDetail.restore')}</>
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteSnapshot(snap.id, snap.name)}>
                      <><Icon name="cross" size={14} /> {t('common.delete')}</>
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pluginTabs.map((tab) => {
        if (activeTab !== tab.id) return null;
        const LazyComponent = pluginTabComponents[tab.id];
        return (
          <div key={tab.id} className={styles.tabContent}>
            <PluginErrorBoundary pluginId={tab.pluginId}>
              <Suspense fallback={<div>{t('common.loading')}</div>}>
                {LazyComponent && <LazyComponent />}
              </Suspense>
            </PluginErrorBoundary>
          </div>
        );
      })}

        </div>
        {/* ---- End of detailContent ---- */}
      </div>
      {/* ---- End of detailLayout ---- */}

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

      {/* Log Viewer modal */}
      <Modal
        open={showLogViewer}
        onClose={() => setShowLogViewer(false)}
        title={t('instanceDetail.gameLogViewer')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShowLogViewer(false)}>
            {t('common.cancel') || 'Close'}
          </Button>
        }
      >
        <div style={{ height: 400 }}>
          <LogViewer instanceId={instanceId} visible={showLogViewer} />
        </div>
      </Modal>

      {/* Pre-launch check modal */}
      <Modal
        open={showPreLaunchModal}
        onClose={() => setShowPreLaunchModal(false)}
        title={t('instanceDetail.preLaunchCheck')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowPreLaunchModal(false)}>
              {t('common.cancel')}
            </Button>
            {preLaunchReport && preLaunchReport.can_launch && (
              <Button variant="primary" size="sm" onClick={doLaunch}>
                {t('instanceDetail.launchAnyway')}
              </Button>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {preLaunchReport?.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: '#141414',
                border: '1px solid #1C1C1C',
                fontSize: '0.55em',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  minWidth: 40,
                  color: item.status === 'pass' ? '#00FF88' : item.status === 'warn' ? '#FFE600' : '#FF6B6B',
                }}
              >
                {item.status.toUpperCase()}
              </span>
              <span style={{ color: '#AAA', flex: 1 }}>{item.message}</span>
            </div>
          ))}
          {preLaunchReport && !preLaunchReport.can_launch && (
            <div style={{ fontSize: '0.55em', color: '#FF6B6B', marginTop: 8 }}>
              {t('instanceDetail.cannotLaunch')}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={healthModalOpen}
        onClose={() => setHealthModalOpen(false)}
        title="HEALTH CHECK"
        actions={
          <Button variant="primary" size="sm" onClick={() => setHealthModalOpen(false)}>
            {t('common.ok')}
          </Button>
        }
      >
        {healthReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8em' }}>
                Overall: {healthReport.overall === 'pass' ? <Icon name="checkCircle" size={12} /> : healthReport.overall === 'warn' ? <Icon name="warning" size={12} /> : <Icon name="crossCircle" size={12} />}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55em', color: 'var(--color-text-dim)' }}>
                {healthReport.instance_id}
              </span>
            </div>
            {healthReport.items.map((item, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--color-panel-alt)',
                  border: '1px solid var(--color-border)',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6em', color: '#FFF' }}>{item.name}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.55em',
                      color:
                        item.status === 'pass'
                          ? 'var(--color-success)'
                          : item.status === 'warn'
                            ? 'var(--color-accent)'
                            : 'var(--color-error)',
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: '0.5em', color: 'var(--color-text-secondary)' }}>{item.message}</span>
                {item.suggestion && (
                  <span style={{ fontSize: '0.5em', color: 'var(--color-accent)' }}><Icon name="lightbulb" size={12} /> {item.suggestion}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={!!removeModTarget}
        onClose={() => setRemoveModTarget(null)}
        title={t('library.removeMod')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoveModTarget(null)}>
              {t('library.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemoveMod}>
              {t('library.remove')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>
          {t('library.removeConfirm', { name: removeModTarget || '' })}
        </p>
      </Modal>

      {/* 模组详情对话框（参考 HMCL ModInfoDialog） */}
      <Modal
        open={!!modInfoTarget}
        onClose={() => setModInfoTarget(null)}
        title={t('instanceDetail.modInfo')}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setModInfoTarget(null)}>
            {t('common.ok')}
          </Button>
        }
      >
        {modInfoTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 360 }}>
            <div style={{ fontSize: '0.7em', fontFamily: 'var(--font-mono)', color: '#FFF', wordBreak: 'break-all' }}>
              {modInfoTarget.filename}
            </div>
            <InfoRow label={t('instanceDetail.modStatus')} value={modInfoTarget.enabled === false ? t('library.disable') : t('library.enable')} />
            <InfoRow label={t('instanceDetail.modSizeLabel')} value={`${(modInfoTarget.size / 1024).toFixed(1)} KB`} mono />
            <InfoRow label={t('instanceDetail.modInstalledAt')} value={new Date(modInfoTarget.installed_at).toLocaleString()} />
            {modInfoTarget.slug && <InfoRow label="Slug" value={modInfoTarget.slug} mono />}
            {modInfoTarget.source && <InfoRow label={t('instanceDetail.modSource')} value={modInfoTarget.source} />}
            {modInfoTarget.pinned && <InfoRow label={t('instanceDetail.modPinned')} value={t('common.yes')} />}
          </div>
        )}
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
