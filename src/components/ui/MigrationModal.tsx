import { useState, useEffect, useCallback } from 'react';
import { formatError } from '../../shared/utils/errorMapping';
import { api, type DetectedLauncher, type MigrateableInstance, type MigrationIssue, type MigrationFixResult } from '../../api';
import { Button } from './Button';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { useI18n } from '../../shared/i18n';
import { useToast } from '../../shared/stores/toastStore';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './MigrationModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onMigrated: () => void;
}

type Step = 'select-launcher' | 'select-instances' | 'migrating' | 'fixing';

export function MigrationModal({ open: isOpen, onClose, onMigrated }: Props) {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [step, setStep] = useState<Step>('select-launcher');
  const [launchers, setLaunchers] = useState<DetectedLauncher[]>([]);
  const [selectedLauncher, setSelectedLauncher] = useState<DetectedLauncher | null>(null);
  const [instances, setInstances] = useState<MigrateableInstance[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [_customPath, setCustomPath] = useState('');
  const [_migratedInstanceIds, setMigratedInstanceIds] = useState<string[]>([]);
  const [fixIssues, setFixIssues] = useState<Map<string, MigrationIssue[]>>(new Map());
  const [fixResults, setFixResults] = useState<Map<string, MigrationFixResult>>(new Map());
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep('select-launcher');
      setSelectedLauncher(null);
      setInstances([]);
      setSelectedInstances(new Set());
      setMigratedCount(0);
      setCustomPath('');
      return;
    }
    setScanning(true);
    api
      .detectLaunchers()
      .then(setLaunchers)
      .catch(() => {
        addToast({ type: 'error', title: t('migration.scanFailed') });
      })
      .finally(() => setScanning(false));
  }, [isOpen]);

  const handleSelectLauncher = useCallback(
    async (launcher: DetectedLauncher) => {
      setSelectedLauncher(launcher);
      setScanning(true);
      try {
        const insts = await api.scanLauncherInstances(launcher.launcher_type, launcher.game_dir);
        setInstances(insts);
        setStep('select-instances');
      } catch (e: unknown) {
        addToast({ type: 'error', title: t('migration.scanFailed'), message: formatError(e) });
      } finally {
        setScanning(false);
      }
    },
    [addToast, t],
  );

  const handleCustomDirectory = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;
    setCustomPath(selected);
    setScanning(true);
    try {
      const insts = await api.scanCustomDirectory(selected);
      if (insts.length === 0) {
        addToast({ type: 'info', title: t('migration.noInstancesFound') });
        return;
      }
      setInstances(insts);
      setStep('select-instances');
    } catch (e: unknown) {
      addToast({ type: 'error', title: t('migration.scanFailed'), message: formatError(e) });
    } finally {
      setScanning(false);
    }
  }, [addToast, t]);

  const toggleInstance = useCallback((idx: number) => {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedInstances.size === instances.length) {
      setSelectedInstances(new Set());
    } else {
      setSelectedInstances(new Set(instances.map((_, i) => i)));
    }
  }, [selectedInstances.size, instances.length]);

  const handleMigrate = useCallback(async () => {
    if (selectedInstances.size === 0) return;
    setMigrating(true);
    setStep('migrating');
    let count = 0;
    const newIds: string[] = [];
    for (const idx of selectedInstances) {
      const inst = instances[idx];
      try {
        const result = await api.migrateInstance({
          name: inst.name,
          versionId: inst.version_id,
          loaderType: inst.loader_type,
          loaderVersion: inst.loader_version,
          sourceGameDir: inst.game_dir,
          launcherType: inst.launcher_type,
          javaPath: inst.java_path,
          jvmArgs: inst.jvm_args,
          minMemory: inst.min_memory,
          maxMemory: inst.max_memory,
        });
        count++;
        setMigratedCount(count);
        if (result?.id) newIds.push(result.id);
      } catch (e: unknown) {
        addToast({
          type: 'error',
          title: t('migration.migrateFailed'),
          message: `${inst.name}: ${formatError(e)}`,
        });
      }
    }
    setMigratedInstanceIds(newIds);
    setMigrating(false);

    if (newIds.length > 0) {
      const issuesMap = new Map<string, MigrationIssue[]>();
      for (const instId of newIds) {
        try {
          const issues = await api.diagnoseMigration(instId);
          if (issues.length > 0) issuesMap.set(instId, issues);
        } catch { /* skip */ }
      }
      setFixIssues(issuesMap);
      if (issuesMap.size > 0) {
        setStep('fixing');
      }
    }

    addToast({
      type: 'success',
      title: t('migration.migrated'),
      message: t('migration.migratedCount', { count: String(count) }),
    });
    onMigrated();
  }, [selectedInstances, instances, addToast, t, onMigrated]);

  const handleClose = useCallback(() => {
    if (migrating || fixing) return;
    onClose();
  }, [migrating, fixing, onClose]);

  const handleOneClickFix = useCallback(async () => {
    setFixing(true);
    const resultsMap = new Map<string, MigrationFixResult>();
    for (const [instId, issues] of fixIssues) {
      try {
        const result = await api.fixMigrationIssues(instId, issues);
        resultsMap.set(instId, result);
      } catch (e: unknown) {
        addToast({ type: 'error', title: t('migration.fixFailed'), message: formatError(e) });
      }
    }
    setFixResults(resultsMap);
    setFixing(false);
    const totalFixed = Array.from(resultsMap.values()).reduce((sum, r) => sum + r.fixed, 0);
    if (totalFixed > 0) {
      addToast({ type: 'success', title: t('migration.fixComplete'), message: t('migration.fixCount', { count: String(totalFixed) }) });
    }
    onMigrated();
  }, [fixIssues, addToast, t, onMigrated]);

  const launcherIcon = (type: string) => {
    switch (type) {
      case 'vanilla':
        return <Icon name="dotGreen" size={12} />;
      case 'hmcl':
        return <Icon name="dotBlue" size={12} />;
      case 'pcl2':
        return <Icon name="dotPurple" size={12} />;
      case 'multimc':
        return <Icon name="dotOrange" size={12} />;
      default:
        return <Icon name="dotWhite" size={12} />;
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={t('migration.title')}
      actions={
        step === 'select-instances' && !migrating ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setStep('select-launcher')}>
              {t('common.back')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleMigrate} disabled={selectedInstances.size === 0}>
              {t('migration.migrateBtn', { count: String(selectedInstances.size) })}
            </Button>
          </>
        ) : step === 'migrating' ? null : (
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
        )
      }
    >
      {step === 'select-launcher' && (
        <div className={styles.launcherList}>
          <p className={styles.hint}>{t('migration.selectLauncher')}</p>
          {scanning ? (
            <div className={styles.loading}>{t('migration.scanning')}</div>
          ) : launchers.length === 0 ? (
            <div className={styles.empty}>
              <p>{t('migration.noLaunchersFound')}</p>
              <Button variant="secondary" size="sm" onClick={handleCustomDirectory}>
                {t('migration.selectCustomDir')}
              </Button>
            </div>
          ) : (
            <>
              {launchers.map((l) => (
                <button
                  key={l.launcher_type + l.game_dir}
                  className={styles.launcherCard}
                  onClick={() => handleSelectLauncher(l)}
                  disabled={scanning}
                >
                  <span className={styles.launcherIcon}>{launcherIcon(l.launcher_type)}</span>
                  <div className={styles.launcherInfo}>
                    <span className={styles.launcherName}>{l.name}</span>
                    <span className={styles.launcherDir}>{l.game_dir}</span>
                  </div>
                  <span className={styles.launcherCount}>
                    {t('migration.instanceCount', { count: String(l.instance_count) })}
                  </span>
                </button>
              ))}
              <div className={styles.customDir}>
                <Button variant="secondary" size="sm" onClick={handleCustomDirectory}>
                  {t('migration.selectCustomDir')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'select-instances' && (
        <div className={styles.instanceList}>
          <div className={styles.instanceHeader}>
            <p className={styles.hint}>
              {selectedLauncher
                ? t('migration.foundInstances', { name: selectedLauncher.name })
                : t('migration.foundInstancesCustom')}
            </p>
            <button className={styles.selectAllBtn} onClick={selectAll}>
              {selectedInstances.size === instances.length ? t('migration.deselectAll') : t('migration.selectAll')}
            </button>
          </div>
          {instances.map((inst, idx) => (
            <button
              key={idx}
              className={`${styles.instanceCard} ${selectedInstances.has(idx) ? styles['instanceCard--selected'] : ''}`}
              onClick={() => toggleInstance(idx)}
            >
              <div className={styles.instanceCheck}>
                {selectedInstances.has(idx) ? (
                  <Icon name="checkbox" size={14} />
                ) : (
                  <Icon name="checkboxEmpty" size={14} />
                )}
              </div>
              <div className={styles.instanceInfo}>
                <span className={styles.instanceName}>{inst.name}</span>
                <span className={styles.instanceMeta}>
                  {inst.version_id}
                  {inst.loader_type && ` · ${inst.loader_type}${inst.loader_version ? ` ${inst.loader_version}` : ''}`}
                  {inst.size_mb > 0 && ` · ${inst.size_mb} MB`}
                </span>
              </div>
              <div className={styles.instanceTags}>
                {inst.has_mods && <span className={styles.tag}>{t('migration.hasMods')}</span>}
                {inst.has_saves && <span className={styles.tag}>{t('migration.hasSaves')}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 'migrating' && (
        <div className={styles.migrating}>
          <div className={styles.spinner} />
          <p>
            {t('migration.migratingProgress', { count: String(migratedCount), total: String(selectedInstances.size) })}
          </p>
        </div>
      )}

      {step === 'fixing' && (
        <div className={styles.fixSection}>
          <p className={styles.hint}>{t('migration.fixTitle')}</p>
          {Array.from(fixIssues.entries()).map(([instId, issues]) => (
            <div key={instId} className={styles.fixInstance}>
              <div className={styles.fixInstanceHeader}>
                <span className={styles.fixInstanceName}>{instId.replace(/^migrated_[^_]+_/, '')}</span>
                <span className={styles.fixIssueCount}>{issues.length} {t('migration.issues')}</span>
              </div>
              {issues.map((issue, i) => (
                <div key={i} className={`${styles.fixIssue} ${styles[`fixIssue--${issue.severity}`] || ''}`}>
                  <span className={styles.fixIssueType}>{issue.issue_type}</span>
                  <span className={styles.fixIssueDesc}>{issue.description}</span>
                  {issue.auto_fixable && <span className={styles.fixAutoTag}>{t('migration.autoFixable')}</span>}
                </div>
              ))}
              {fixResults.has(instId) && (
                <div className={styles.fixResult}>
                  {fixResults.get(instId)!.details.map((d, i) => (
                    <div key={i} className={styles.fixResultLine}>{d}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {fixResults.size === 0 ? (
            <div className={styles.fixActions}>
              <Button variant="primary" size="sm" onClick={handleOneClickFix} disabled={fixing}>
                {fixing ? t('migration.fixing') : t('migration.oneClickFix')}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClose}>
                {t('common.skip')}
              </Button>
            </div>
          ) : (
            <div className={styles.fixActions}>
              <Button variant="primary" size="sm" onClick={handleClose}>
                {t('common.done')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
