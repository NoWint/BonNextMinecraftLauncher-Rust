import { useState, useEffect, useCallback } from 'react';
import { formatError } from '../utils/errorMapping';
import { api, type ContentCounts, type InstalledModInfo, type UpdateInfo } from '../api';
import { useInstances } from '../stores/instanceStore';
import { useToast } from '../stores/toastStore';
import { useI18n } from '../i18n';
import { SectionHeader, Ticker } from '../components/layout';
import { Button, Modal, Tabs, Select } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { CardSkeleton } from '../components/ui/Skeleton';
import styles from './LibraryPage.module.css';

type UpdateStatus = 'pending' | 'downloading' | 'complete' | 'failed';

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function LibraryPage() {
  const { state: instState } = useInstances();
  const { addToast } = useToast();
  const { t } = useI18n();

  const TABS = [
    { id: 'mods', label: t('library.mods') },
    { id: 'resourcepacks', label: t('library.resourcePacks') },
    { id: 'shaders', label: t('library.shaders') },
    { id: 'worlds', label: t('library.worlds') },
  ];

  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState('mods');
  const [mods, setMods] = useState<InstalledModInfo[]>([]);
  const [resourcepacks, setResourcepacks] = useState<string[]>([]);
  const [shaders, setShaders] = useState<string[]>([]);
  const [counts, setCounts] = useState<ContentCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [updateProgress, setUpdateProgress] = useState<Record<string, UpdateStatus>>({});
  const [updatingAll, setUpdatingAll] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null);

  const instances = instState.instances;
  const selectedInstance = instances.find((i) => i.id === selectedId);

  useEffect(() => {
    if (instances.length > 0 && !selectedId) {
      setSelectedId(instances[0].id);
    }
  }, [instances, selectedId]);

  const loadContent = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const [m, r, s, c] = await Promise.all([
        api.listInstanceMods(selectedId),
        api.listInstanceResourcepacks(selectedId),
        api.listInstanceShaders(selectedId),
        api.getContentCounts(selectedId),
      ]);
      setMods(m);
      setResourcepacks(r);
      setShaders(s);
      setCounts(c);
    } catch (e) {
      console.error('Failed to load library:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const checkForUpdates = async () => {
    if (!selectedId) return;
    setCheckingUpdates(true);
    try {
      const result = await api.checkContentUpdates(selectedId);
      setUpdates(result);
      if (result.length === 0) {
        addToast({ type: 'info', title: t('library.allUpToDate'), message: t('library.noUpdatesAvailable') });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('library.updateCheckFailed'), message: formatError(e) });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const updateItem = async (update: UpdateInfo) => {
    if (!selectedId) return;
    setUpdatingItems((prev) => new Set(prev).add(update.filename));
    try {
      const versions = await api.getModVersions(update.slug);
      if (versions.length === 0) throw new Error('No versions found');
      const latest = versions[0];
      const primaryFile =
        latest.files.find((f) => !f.filename.includes('sources') && !f.filename.includes('javadoc')) || latest.files[0];

      // Remove old file
      try {
        await api.removeInstalledMod(selectedId, update.filename);
      } catch (e) {
        console.error('Failed to remove mod:', e);
      }

      // Download new version
      await api.installContent(
        primaryFile.url,
        primaryFile.filename,
        selectedId,
        update.content_type,
        primaryFile.hashes.sha1 || undefined,
        update.slug,
        latest.id,
      );

      addToast({ type: 'success', title: t('library.updated'), message: `${update.slug} -> ${latest.version_number}` });

      // Refresh
      setUpdates((prev) => prev.filter((u) => u.filename !== update.filename));
      loadContent();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('library.updateFailed'), message: formatError(e) });
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(update.filename);
        return next;
      });
    }
  };

  const updateAll = async () => {
    if (!selectedId || updates.length === 0) return;
    setUpdatingAll(true);
    const initial: Record<string, UpdateStatus> = {};
    updates.forEach((u) => {
      initial[u.filename] = 'pending';
    });
    setUpdateProgress(initial);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      setUpdateProgress((prev) => ({ ...prev, [update.filename]: 'downloading' }));

      try {
        const versions = await api.getModVersions(update.slug);
        if (versions.length === 0) throw new Error('No versions found');
        const latest = versions[0];
        const primaryFile =
          latest.files.find((f) => !f.filename.includes('sources') && !f.filename.includes('javadoc')) ||
          latest.files[0];

        try {
          await api.removeInstalledMod(selectedId, update.filename);
        } catch (e) {
          /* ok if already removed */
        }

        await api.installContent(
          primaryFile.url,
          primaryFile.filename,
          selectedId,
          update.content_type,
          primaryFile.hashes.sha1 || undefined,
          update.slug,
          latest.id,
        );

        setUpdateProgress((prev) => ({ ...prev, [update.filename]: 'complete' }));
        successCount++;
      } catch (e: unknown) {
        setUpdateProgress((prev) => ({ ...prev, [update.filename]: 'failed' }));
        failCount++;
        console.error(`Failed to update ${update.slug}:`, e);
      }
    }

    setUpdates([]);
    loadContent();
    setUpdatingAll(false);

    if (failCount === 0) {
      addToast({
        type: 'success',
        title: t('library.updateSummary'),
        message: t('library.allUpdated', { count: String(successCount) }),
      });
    } else {
      addToast({
        type: 'warning',
        title: t('library.updateSummary'),
        message: t('library.partialUpdated', { succeeded: String(successCount), failed: String(failCount) }),
      });
    }
  };

  const handleBulkUpdate = async () => {
    if (!selectedId) return;
    setBulkUpdating(true);
    setBulkResult(null);
    try {
      const result = await api.bulkUpdateContent(selectedId);
      setBulkResult(result);
      loadContent();
      setUpdates([]);
      if (result.failed === 0) {
        addToast({
          type: 'success',
          title: t('library.updateSummary'),
          message: t('library.allUpdated', { count: String(result.succeeded) }),
        });
      } else {
        addToast({
          type: 'warning',
          title: t('library.updateSummary'),
          message: t('library.partialUpdated', { succeeded: String(result.succeeded), failed: String(result.failed) }),
        });
      }
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('library.bulkUpdateFailed'), message: formatError(e) });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleRemoveMod = async () => {
    if (!removeTarget || !selectedId) return;
    try {
      await api.removeInstalledMod(selectedId, removeTarget);
      addToast({ type: 'success', title: t('common.remove'), message: removeTarget });
      setRemoveTarget(null);
      loadContent();
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('library.remove'), message: formatError(e) });
    }
  };

  // Build instance options for Select
  const instanceOptions = instances.map((inst) => ({
    value: inst.id,
    label: `${inst.name} (${inst.version_id})`,
  }));

  return (
    <div className={styles.page}>
      <SectionHeader title={t('library.contentLibrary')} subtitle={t('library.managePerInstance')} />

      {/* Instance selector */}
      <div className={styles.instanceRow}>
        <span className={styles.instanceRow__label}>{t('library.instance')}</span>
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={[{ value: '', label: t('library.selectInstance') }, ...instanceOptions]}
        />
      </div>

      {/* Summary */}
      {counts && selectedInstance && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.mods}</div>
            <div className={styles.summaryCard__label}>{t('library.mods')}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.resourcepacks}</div>
            <div className={styles.summaryCard__label}>{t('library.resourcePacks')}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.shaders}</div>
            <div className={styles.summaryCard__label}>{t('library.shaders')}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryCard__value}>{counts.worlds}</div>
            <div className={styles.summaryCard__label}>{t('library.worlds')}</div>
          </div>
        </div>
      )}

      {/* Updates section */}
      {selectedId && (
        <div className={styles.updatesSection}>
          <div className={styles.updatesSection__header}>
            <div>
              <span className={styles.updatesSection__title}>{t('library.updates')}</span>
              {updates.length > 0 && (
                <span className={styles.updatesSection__count}>
                  {t('library.available', { count: String(updates.length) })}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="secondary" size="sm" disabled={checkingUpdates} onClick={checkForUpdates}>
                {checkingUpdates ? t('library.checking') : t('library.checkForUpdates')}
              </Button>
              <Button variant="primary" size="sm" disabled={bulkUpdating} onClick={handleBulkUpdate}>
                {bulkUpdating ? t('library.updatingStatus') : t('library.checkAllUpdates')}
              </Button>
              {updates.length > 0 && !updatingAll && (
                <Button variant="secondary-highlight" size="sm" onClick={updateAll}>
                  {t('library.updateAll')} ({updates.length})
                </Button>
              )}
              {updatingAll && (
                <span className={styles.updatingLabel}>
                  {t('library.updating', {
                    current: String(
                      Object.values(updateProgress).filter((s) => s === 'complete' || s === 'failed').length + 1,
                    ),
                    total: String(updates.length),
                    name: updates[0]?.slug || '',
                  })}
                </span>
              )}
            </div>
          </div>

          {updates.length > 0 ? (
            <div>
              {updates.map((update, index) => {
                const status = updateProgress[update.filename];
                const isUpdating = updatingAll && status;
                return (
                  <div key={update.filename} className={styles.updateItem}>
                    {isUpdating ? (
                      <span className={`${styles.updateStatusIcon} ${styles[`status_${status}`]}`}>
                        {status === 'pending' && '\u{25CB}'}
                        {status === 'downloading' && '\u{25D4}'}
                        {status === 'complete' && '\u{2713}'}
                        {status === 'failed' && '\u{2717}'}
                      </span>
                    ) : (
                      <span className={styles.updateIndex}>{index + 1}</span>
                    )}
                    <div className={styles.updateItem__name}>
                      {update.slug}
                      <span className={styles.updateItem__filename}> ({update.filename})</span>
                    </div>
                    <div className={styles.updateItem__versions}>
                      {update.installed_version && (
                        <span className={styles.updateItem__oldVer}>{update.installed_version}</span>
                      )}
                      <Icon name="arrowRight" size={10} />
                      <span className={styles.updateItem__newVer}>{update.latest_version}</span>
                    </div>
                    {!updatingAll && !updatingItems.has(update.filename) && (
                      <Button variant="secondary-highlight" size="sm" onClick={() => updateItem(update)}>
                        {t('library.individualUpdate')}
                      </Button>
                    )}
                    {updatingItems.has(update.filename) && (
                      <span className={styles.updatingLabel}>{t('library.updatingStatus')}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !checkingUpdates &&
            updates.length === 0 &&
            !updatingAll && <div className={styles.updatesSection__empty}>{t('library.clickToCheck')}</div>
          )}
        </div>
      )}

      {/* Content type tabs */}
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {/* Content list */}
      {loading ? (
        <div className={styles.loadingGrid}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : !selectedId ? (
        <div className={styles.empty}>
          <div className={styles.empty__title}>{t('library.selectInstanceHint')}</div>
          <div className={styles.empty__desc}>{t('library.selectInstanceDesc')}</div>
        </div>
      ) : (
        <>
          {/* Mods tab */}
          {activeTab === 'mods' &&
            (mods.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>{t('library.noModsInstalled')}</div>
                <div className={styles.empty__desc}>{t('library.noModsInstalledDesc')}</div>
                <Button variant="secondary" size="sm" onClick={() => (window.location.hash = '#/mods')}>
                  {t('library.browseMods')}
                </Button>
              </div>
            ) : (
              <div className={styles.list}>
                {mods.map((mod) => (
                  <div key={mod.filename} className={styles.item}>
                    <div className={styles.item__icon}>{'\u{1F9F5}'}</div>
                    <div className={styles.item__name}>{mod.filename}</div>
                    <div className={styles.item__meta}>{formatSize(mod.size)}</div>
                    <div className={styles.item__meta}>
                      {mod.installed_at ? new Date(mod.installed_at).toLocaleDateString() : ''}
                    </div>
                    <div className={styles.item__actions}>
                      <Button variant="danger" size="sm" onClick={() => setRemoveTarget(mod.filename)}>
                        {t('library.remove')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {/* Resource packs tab */}
          {activeTab === 'resourcepacks' &&
            (resourcepacks.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>{t('library.noResourcePacks')}</div>
                <div className={styles.empty__desc}>{t('library.noResourcePacksDesc')}</div>
              </div>
            ) : (
              <div className={styles.list}>
                {resourcepacks.map((name) => (
                  <div key={name} className={styles.item}>
                    <div className={styles.item__icon}>{'\u{1F3A8}'}</div>
                    <div className={styles.item__name}>{name}</div>
                  </div>
                ))}
              </div>
            ))}

          {/* Shaders tab */}
          {activeTab === 'shaders' &&
            (shaders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>{t('library.noShaders')}</div>
                <div className={styles.empty__desc}>{t('library.noShadersDesc')}</div>
              </div>
            ) : (
              <div className={styles.list}>
                {shaders.map((name) => (
                  <div key={name} className={styles.item}>
                    <div className={styles.item__icon}>{'\u{2728}'}</div>
                    <div className={styles.item__name}>{name}</div>
                  </div>
                ))}
              </div>
            ))}

          {/* Worlds tab */}
          {activeTab === 'worlds' &&
            (counts && counts.worlds === 0 ? (
              <div className={styles.empty}>
                <div className={styles.empty__title}>{t('library.noWorlds')}</div>
                <div className={styles.empty__desc}>{t('library.noWorldsDesc')}</div>
              </div>
            ) : (
              <div className={styles.empty}>
                <div className={styles.empty__title}>{t('library.worldManagement')}</div>
                <div className={styles.empty__desc}>{t('library.worldManagementDesc')}</div>
                {selectedInstance && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        const gameDir = await api.getGameDir();
                        await api.openFolder(`${gameDir}/instances/${selectedInstance.id}/.minecraft/saves`);
                      } catch (e) {
                        console.error('Failed to load library:', e);
                      }
                    }}
                  >
                    {t('library.openSavesFolder')}
                  </Button>
                )}
              </div>
            ))}
        </>
      )}

      {/* Bulk update result modal */}
      <Modal
        open={bulkResult !== null}
        onClose={() => setBulkResult(null)}
        title={t('library.bulkUpdateResults')}
        actions={
          <Button variant="primary" size="sm" onClick={() => setBulkResult(null)}>
            {t('library.ok')}
          </Button>
        }
      >
        {bulkResult && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2em', color: 'var(--color-success)' }}>
                  {bulkResult.succeeded}
                </div>
                <div style={{ fontSize: '0.5em', color: 'var(--color-text-dim)', letterSpacing: 2 }}>
                  {t('library.succeeded')}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.2em',
                    color: bulkResult.failed > 0 ? 'var(--color-error)' : 'var(--color-text-dim)',
                  }}
                >
                  {bulkResult.failed}
                </div>
                <div style={{ fontSize: '0.5em', color: 'var(--color-text-dim)', letterSpacing: 2 }}>
                  {t('library.failed')}
                </div>
              </div>
            </div>
            {bulkResult.errors.length > 0 && (
              <div>
                <div
                  style={{ fontSize: '0.45em', color: 'var(--color-text-muted)', letterSpacing: 2, marginBottom: 6 }}
                >
                  {t('library.errors')}
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {bulkResult.errors.map((err, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '0.5em',
                        color: 'var(--color-error)',
                        padding: '4px 6px',
                        background: 'var(--color-panel-alt)',
                        border: '1px solid var(--color-border)',
                        marginBottom: 2,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Remove confirmation */}
      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={t('library.removeMod')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>
              {t('library.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={handleRemoveMod}>
              {t('library.remove')}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)' }}>
          {t('library.removeConfirm', { name: removeTarget || '' })}
        </p>
      </Modal>

      <Ticker
        messages={[
          t('library.tickerInstance', {
            name: selectedInstance?.name || 'None',
            version: selectedInstance?.version_id || 'N/A',
          }),
          t('library.tickerTotal', {
            count: String((counts?.mods || 0) + (counts?.resourcepacks || 0) + (counts?.shaders || 0)),
          }),
          t('library.tickerStorage'),
        ]}
      />
    </div>
  );
}
