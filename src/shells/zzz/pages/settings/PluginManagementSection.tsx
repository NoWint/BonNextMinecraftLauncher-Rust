import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useAllPlugins } from '../../../../app/hooks/useAllPlugins';
import { usePluginManager } from '../../../../app/hooks/usePluginManager';
import { useToast } from '../../../../shared/stores/toastStore';
import { useI18n } from '../../../../shared/i18n';
import { logger } from '../../../../shared/utils/logger';
import { Modal, Button } from '../../components/ui';
import { PluginLogViewer } from '../../../../app/components/PluginLogViewer';
import type { RegisteredPlugin } from '../../../../plugins/core/types';
import styles from './PluginManagementSection.module.css';

/** Third-party plugin info returned by the backend `list_installed_plugins` command. */
interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions: string[];
  directory: string;
}

type TabId = 'registered' | 'installed';

/** Map a permission string to a human-readable description. */
function permissionDescription(perm: string): string {
  if (perm.startsWith('http:')) {
    return `HTTP requests to ${perm.slice(5)}`;
  }
  if (perm.startsWith('fs:read:')) {
    return `Read files (${perm.slice(8)})`;
  }
  if (perm.startsWith('fs:write:')) {
    return `Write files (${perm.slice(9)})`;
  }
  if (perm.startsWith('invoke:')) {
    return `Call ${perm.slice(7)} backend commands`;
  }
  if (perm === 'events:listen') return 'Listen to events';
  if (perm === 'events:emit') return 'Emit events';
  if (perm.startsWith('storage:')) return 'Use persistent storage';
  return perm;
}

export function PluginManagementSection() {
  const registeredPlugins = useAllPlugins();
  const manager = usePluginManager();
  const { addToast } = useToast();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<TabId>('registered');
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPluginInfo[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState<{
    mode: 'install' | 'activate';
    permissions: string[];
    onApprove: () => void;
    onCancel: () => void;
    pluginName: string;
    pluginVersion: string;
  } | null>(null);

  const refreshInstalled = useCallback(async () => {
    setLoadingInstalled(true);
    try {
      const list = await invoke<InstalledPluginInfo[]>('list_installed_plugins');
      setInstalledPlugins(list);
    } catch (e) {
      logger.error('Failed to list installed plugins:', e);
    } finally {
      setLoadingInstalled(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'installed') {
      void refreshInstalled();
    }
  }, [activeTab, refreshInstalled]);

  const handleActivate = async (pluginId: string) => {
    const plugin = registeredPlugins.find((p) => p.definition.id === pluginId);
    if (!plugin) {
      void doActivate(pluginId);
      return;
    }
    const permissions = plugin.manifest?.permissions ?? [];
    // Always show a confirmation modal so the user explicitly acknowledges
    // what they are activating — even when no permissions are declared.
    setPendingApproval({
      mode: 'activate',
      permissions,
      pluginName: plugin.definition.name,
      pluginVersion: plugin.definition.version,
      onApprove: () => {
        setPendingApproval(null);
        void doActivate(pluginId);
      },
      onCancel: () => {
        setPendingApproval(null);
      },
    });
  };

  const doActivate = async (pluginId: string) => {
    setBusyPluginId(pluginId);
    try {
      await manager.activate(pluginId);
      addToast({ type: 'success', title: `Plugin "${pluginId}" activated` });
    } catch (e) {
      addToast({ type: 'error', title: `Failed to activate: ${String(e)}` });
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleDeactivate = async (pluginId: string) => {
    setBusyPluginId(pluginId);
    try {
      await manager.deactivate(pluginId);
      addToast({ type: 'info', title: `Plugin "${pluginId}" deactivated` });
    } catch (e) {
      addToast({ type: 'error', title: `Failed to deactivate: ${String(e)}` });
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleReset = (pluginId: string) => {
    manager.resetPlugin(pluginId);
    addToast({ type: 'info', title: `Plugin "${pluginId}" reset` });
  };

  const handleInstallFromDialog = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Plugin Archive', extensions: ['zip'] },
          { name: 'All', extensions: ['*'] },
        ],
      });
      if (!selected || typeof selected !== 'string') return;
      await doInstall(selected);
    } catch (e) {
      setError(`Install failed: ${String(e)}`);
    }
  };

  const doInstall = async (zipPath: string) => {
    setInstalling(true);
    setError('');
    try {
      // Backend constraint: install_plugin extracts the archive to disk and
      // returns InstalledPluginInfo (there is no preview-only command). Per
      // spec §7 we must validate permissions before activation, so we install,
      // re-read the on-disk manifest to confirm the declared permissions, then
      // require explicit user approval before keeping the plugin. Denial
      // triggers a full uninstall to clean up.
      const info = await invoke<InstalledPluginInfo>('install_plugin', { zipPath });

      // Re-read the actual on-disk manifest so the permissions shown to the
      // user come from the installed plugin, not just the install return value.
      let permissions = info.permissions;
      try {
        const manifest = await invoke<Record<string, unknown>>('get_plugin_manifest', {
          pluginId: info.id,
        });
        const raw = manifest['permissions'];
        if (Array.isArray(raw)) {
          permissions = raw.filter((v): v is string => typeof v === 'string');
        }
      } catch (e) {
        logger.warn(
          'Failed to re-read manifest after install; falling back to install_plugin permissions:',
          e,
        );
      }

      setPendingApproval({
        mode: 'install',
        permissions,
        pluginName: info.name,
        pluginVersion: info.version,
        onApprove: () => {
          setPendingApproval(null);
          addToast({ type: 'success', title: `Plugin "${info.name}" v${info.version} installed` });
          void refreshInstalled();
        },
        onCancel: () => {
          setPendingApproval(null);
          void (async () => {
            try {
              await invoke('uninstall_plugin', { pluginId: info.id });
              addToast({ type: 'info', title: `Plugin "${info.name}" uninstalled (permissions denied)` });
            } catch (e) {
              addToast({ type: 'error', title: `Failed to uninstall after denial: ${String(e)}` });
            } finally {
              await refreshInstalled();
            }
          })();
        },
      });
    } catch (e) {
      setError(`Install failed: ${String(e)}`);
      addToast({ type: 'error', title: `Install failed: ${String(e)}` });
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm(`Uninstall plugin "${pluginId}"? This cannot be undone.`)) return;
    setBusyPluginId(pluginId);
    try {
      await invoke('uninstall_plugin', { pluginId });
      addToast({ type: 'info', title: `Plugin "${pluginId}" uninstalled` });
      await refreshInstalled();
    } catch (e) {
      addToast({ type: 'error', title: `Uninstall failed: ${String(e)}` });
    } finally {
      setBusyPluginId(null);
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>
        {t('settings.plugins.title') || 'Plugin Management'}
      </h2>
      <p className={styles.subtitle}>
        {t('settings.plugins.subtitle') ||
          'Manage builtin and third-party plugins. Install .zip archives to extend the launcher.'}
      </p>

      <div className={styles.tabRow}>
        <button
          className={`${styles.tab} ${activeTab === 'registered' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('registered')}
        >
          {t('settings.plugins.registered') || 'Registered'} ({registeredPlugins.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'installed' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          {t('settings.plugins.installed') || 'Installed (3rd-party)'} ({installedPlugins.length})
        </button>
      </div>

      {activeTab === 'registered' && (
        <div className={styles.pluginList}>
          {registeredPlugins.length === 0 && (
            <div className={styles.emptyState}>
              {t('settings.plugins.noRegistered') || 'No plugins registered.'}
            </div>
          )}
          {registeredPlugins.map((p) => (
            <RegisteredPluginCard
              key={p.definition.id}
              plugin={p}
              busy={busyPluginId === p.definition.id}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onReset={handleReset}
            />
          ))}
        </div>
      )}

      {activeTab === 'installed' && (
        <>
          <div className={styles.pluginList}>
            {loadingInstalled && (
              <div className={styles.emptyState}>
                {t('settings.plugins.loading') || 'Loading...'}
              </div>
            )}
            {!loadingInstalled && installedPlugins.length === 0 && (
              <div className={styles.emptyState}>
                {t('settings.plugins.noInstalled') ||
                  'No third-party plugins installed. Use the button below to install a .zip.'}
              </div>
            )}
            {installedPlugins.map((p) => (
              <InstalledPluginCard
                key={p.id}
                plugin={p}
                busy={busyPluginId === p.id}
                onUninstall={handleUninstall}
              />
            ))}
          </div>

          <div className={styles.installRow}>
            <button
              className={styles.actionBtn}
              onClick={handleInstallFromDialog}
              disabled={installing}
            >
              {installing
                ? t('settings.plugins.installing') || 'Installing...'
                : t('settings.plugins.installBtn') || 'Install from .zip'}
            </button>
          </div>
          {error && <div className={styles.errorText}>{error}</div>}
        </>
      )}

      <Modal
        open={pendingApproval !== null}
        onClose={() => pendingApproval?.onCancel()}
        title={
          pendingApproval?.mode === 'install'
            ? t('settings.plugins.downloadedAwaitingApproval') ||
              'Plugin downloaded — awaiting approval'
            : t('settings.plugins.permissionApproval') || 'Plugin Permission Approval'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => pendingApproval?.onCancel()}>
              {t('settings.plugins.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={() => pendingApproval?.onApprove()}>
              {t('settings.plugins.approve') || 'Approve'}
            </Button>
          </>
        }
      >
        {pendingApproval && (
          <div>
            <p className={styles.approvalPrompt}>
              {pendingApproval.mode === 'install'
                ? pendingApproval.permissions.length > 0
                  ? t('settings.plugins.downloadedPrompt') ||
                    'This plugin has been downloaded. Review its permissions and approve to keep it installed. Cancel will uninstall it.'
                  : t('settings.plugins.downloadedNoPermsPrompt') ||
                    'This plugin has been downloaded and declares no permissions. Approve to keep it installed. Cancel will uninstall it.'
                : pendingApproval.permissions.length > 0
                  ? t('settings.plugins.permissionPrompt') ||
                    'This plugin requests the following permissions. Approve to continue:'
                  : t('settings.plugins.activateNoPermsPrompt') ||
                    'This plugin does not declare any permissions. Confirm to activate?'}
            </p>
            <p className={styles.approvalName}>
              {pendingApproval.pluginName}{' '}
              <span className={styles.approvalVersion}>
                v{pendingApproval.pluginVersion}
              </span>
            </p>
            {pendingApproval.permissions.length > 0 ? (
              <ul className={styles.approvalPermList}>
                {pendingApproval.permissions.map((perm) => (
                  <li key={perm} className={styles.approvalPermItem}>
                    <code className={styles.approvalPermCode}>{perm}</code>
                    <span>{permissionDescription(perm)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.approvalNoPerms}>
                {t('settings.plugins.noPermissionsDeclared') || 'No permissions declared.'}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function RegisteredPluginCard({
  plugin,
  busy,
  onActivate,
  onDeactivate,
  onReset,
}: {
  plugin: RegisteredPlugin;
  busy: boolean;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onReset: (id: string) => void;
}) {
  const { t } = useI18n();
  const { definition, manifest, state, error, failureCount, lastError, autoDisabled } = plugin;
  const isActive = state === 'active';
  const isError = state === 'error';
  const permissions = manifest?.permissions ?? [];
  const [showLogs, setShowLogs] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const handleResetAndRetry = async () => {
    onReset(definition.id);
    // 重置后立即尝试激活
    onActivate(definition.id);
  };

  return (
    <>
      <div
        className={`${styles.pluginCard} ${
          isActive ? styles.pluginCardActive : ''
        } ${isError ? styles.pluginCardError : ''}`}
      >
        <div className={styles.pluginCardInfo}>
          <div className={styles.pluginCardHeader}>
            <span className={styles.pluginCardName}>{definition.name}</span>
            <span className={styles.pluginCardVersion}>v{definition.version}</span>
            <span className={`${styles.pluginCardBadge} ${styles.badgeBuiltin}`}>{t('settings.plugin.builtin')}</span>
            <span
              className={`${styles.pluginCardBadge} ${
                isActive
                  ? styles.badgeStateActive
                  : isError
                    ? styles.badgeStateError
                    : styles.badgeStateInactive
              }`}
            >
              {state}
            </span>
            {autoDisabled && (
              <span className={`${styles.pluginCardBadge} ${styles.badgeAutoDisabled}`}>
                {t('settings.plugin.autoDisabled')}
              </span>
            )}
          </div>
          {definition.description && (
            <div className={styles.pluginCardDesc}>{definition.description}</div>
          )}
          <div className={styles.pluginCardMeta}>
            <code>{definition.id}</code>
            {manifest?.author && <span> · {t('settings.plugin.byAuthor', { author: manifest.author })}</span>}
          </div>
          {permissions.length > 0 && (
            <div className={styles.permissionsRow}>
              {permissions.map((perm) => (
                <span key={perm} className={styles.permissionChip}>
                  {perm}
                </span>
              ))}
            </div>
          )}
          {error && <div className={styles.errorText}>{error}</div>}
          {failureCount && failureCount > 0 && !isActive && (
            <div className={styles.failureInfo}>
              {t('settings.plugin.failures')} {failureCount}
              {lastError && (
                <button
                  className={styles.errorDetailsBtn}
                  onClick={() => setShowErrorDetails(true)}
                >
                  {t('settings.plugin.details')}
                </button>
              )}
            </div>
          )}
        </div>
        <div className={styles.pluginCardActions}>
          <button
            className={styles.logsBtn}
            onClick={() => setShowLogs(true)}
          >
            {t('settings.plugin.viewLogs')}
          </button>
          {autoDisabled && (
            <button
              className={styles.actionBtn}
              disabled={busy}
              onClick={handleResetAndRetry}
            >
              {t('settings.plugin.resetRetry')}
            </button>
          )}
          {!isActive && (
            <button
              className={styles.actionBtn}
              disabled={busy}
              onClick={() => onActivate(definition.id)}
            >
              {t('settings.plugin.activate')}
            </button>
          )}
          {isActive && (
            <button
              className={`${styles.actionBtn} ${styles.deactivateBtn}`}
              disabled={busy}
              onClick={() => onDeactivate(definition.id)}
            >
              {t('settings.plugin.deactivate')}
            </button>
          )}
        </div>
      </div>
      <Modal
        open={showLogs}
        onClose={() => setShowLogs(false)}
        title={t('settings.plugin.pluginLogs', { name: definition.name })}
      >
        <PluginLogViewer pluginId={definition.id} />
      </Modal>
      <Modal
        open={showErrorDetails}
        onClose={() => setShowErrorDetails(false)}
        title={t('settings.plugin.errorDetails', { name: definition.name })}
      >
        {lastError && (
          <div className={styles.errorDetailsContent}>
            <div className={styles.errorDetailsRow}>
              <span className={styles.errorDetailsLabel}>{t('settings.plugin.time')}</span>
              <span className={styles.errorDetailsValue}>
                {new Date(lastError.timestamp).toLocaleString()}
              </span>
            </div>
            <div className={styles.errorDetailsRow}>
              <span className={styles.errorDetailsLabel}>{t('settings.plugin.failures')}</span>
              <span className={styles.errorDetailsValue}>{failureCount ?? 0}</span>
            </div>
            <div className={styles.errorDetailsRow}>
              <span className={styles.errorDetailsLabel}>{t('settings.plugin.message')}</span>
              <span className={styles.errorDetailsValue}>{lastError.message}</span>
            </div>
            {lastError.stack && (
              <div className={styles.errorDetailsStack}>
                <pre>{lastError.stack}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function InstalledPluginCard({
  plugin,
  busy,
  onUninstall,
}: {
  plugin: InstalledPluginInfo;
  busy: boolean;
  onUninstall: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.pluginCard}>
      <div className={styles.pluginCardInfo}>
        <div className={styles.pluginCardHeader}>
          <span className={styles.pluginCardName}>{plugin.name}</span>
          <span className={styles.pluginCardVersion}>v{plugin.version}</span>
          <span className={`${styles.pluginCardBadge} ${styles.badgeThirdParty}`}>{t('settings.plugin.thirdParty')}</span>
        </div>
        {plugin.description && (
          <div className={styles.pluginCardDesc}>{plugin.description}</div>
        )}
        <div className={styles.pluginCardMeta}>
          <code>{plugin.id}</code>
          {plugin.author && <span> · {t('settings.plugin.byAuthor', { author: plugin.author })}</span>}
        </div>
        {plugin.permissions.length > 0 && (
          <div className={styles.permissionsRow}>
            {plugin.permissions.map((perm) => (
              <span key={perm} className={styles.permissionChip}>
                {perm}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.pluginCardActions}>
        <button
          className={styles.uninstallBtn}
          disabled={busy}
          onClick={() => onUninstall(plugin.id)}
        >
          {t('settings.plugin.uninstall')}
        </button>
      </div>
    </div>
  );
}
