import { useState, useEffect, useCallback } from 'react';
import { api, type GameInstance, type InstalledModInfo } from '../api';
import { useAuth } from '../stores/authStore';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { Badge, Tabs, Modal, Breadcrumb as BreadcrumbComp, TextInput, Tooltip } from '../components/ui';
import { Button } from '../components/ui';
import { relativeTime } from '../utils/time';
import styles from './InstanceDetailPage.module.css';

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
    { id: 'saves', label: t('instanceDetail.saves') },
    { id: 'logs', label: t('instanceDetail.logs') },
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
      api.checkInstanceReady(instanceId).then(setIsReady).catch(() => setIsReady(null));
      api.listInstanceMods(instanceId).then(setInstalledMods).catch(() => setInstalledMods([]));
    }
  }, [instanceId]);

  const handleLaunch = useCallback(async () => {
    if (!instance) return;
    setError('');
    try {
      await api.launchGame(
        instance.version_id, instance.version_url,
        auth?.username || 'Player', auth?.uuid || '',
        auth?.access_token || '', instance.max_memory, instance.min_memory,
        instance.java_path || undefined, instance.jvm_args || undefined,
      );
      addToast({ type: 'success', title: 'Launching', message: `${instance.name} is starting...` });
    } catch (e: any) {
      setError(e?.toString() || 'Launch failed');
      addToast({ type: 'error', title: 'Launch failed', message: e?.toString() || 'Launch failed' });
      setTimeout(() => setError(''), 8000);
    }
  }, [instance, auth, addToast]);

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
        <div className={styles.topBarIcon}>{getLoaderIcon(instance.loader_type)}</div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <InfoRow label={t('instanceDetail.allocatedMemory')} value={`${memoryGB} GB`} mono />
                <InfoRow label="Min Memory" value={`${Math.round(instance.min_memory / 1024)} GB`} mono />
                <InfoRow label="JVM Args" value={instance.jvm_args || t('instanceDetail.default')} mono />
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
        <div className={styles.placeholderTab}>{t('instanceDetail.comingSoon')}</div>
      )}
      {activeTab === 'logs' && (
        <div className={styles.placeholderTab}>{t('instanceDetail.comingSoon')}</div>
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
