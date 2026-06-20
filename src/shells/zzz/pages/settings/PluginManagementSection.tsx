import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useAllPlugins } from '../../../../app/hooks/useAllPlugins';
import { usePluginManager } from '../../../../app/hooks/usePluginManager';
import { useToast } from '../../../../shared/stores/toastStore';
import { useI18n } from '../../../../shared/i18n';
import { logger } from '../../../../shared/utils/logger';
import { Modal, Button } from '../../components/ui';
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
    const permissions = plugin?.manifest?.permissions ?? [];
    if (permissions.length > 0 && plugin) {
      setPendingApproval({
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
      return;
    }
    void doActivate(pluginId);
  };

  const doActivate = async (pluginId: string) => {
    setBusyPluginId(pluginId);
    try {
      await manager.activate(pluginId);
      addToast(`Plugin "${pluginId}" activated`, 'success');
    } catch (e) {
      addToast(`Failed to activate: ${String(e)}`, 'error');
    } finally {
      setBusyPluginId(null);
    }
  };

  const handleDeactivate = async (pluginId: string) => {
    setBusyPluginId(pluginId);
    try {
      await manager.deactivate(pluginId);
      addToast(`Plugin "${pluginId}" deactivated`, 'info');
    } catch (e) {
      addToast(`Failed to deactivate: ${String(e)}`, 'error');
    } finally {
      setBusyPluginId(null);
    }
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
      const info = await invoke<InstalledPluginInfo>('install_plugin', { zipPath });
      if (info.permissions && info.permissions.length > 0) {
        setPendingApproval({
          permissions: info.permissions,
          pluginName: info.name,
          pluginVersion: info.version,
          onApprove: () => {
            setPendingApproval(null);
            addToast(`Plugin "${info.name}" v${info.version} installed`, 'success');
            void refreshInstalled();
          },
          onCancel: () => {
            setPendingApproval(null);
            void (async () => {
              try {
                await invoke('uninstall_plugin', { pluginId: info.id });
                addToast(`Plugin "${info.name}" uninstalled (permissions denied)`, 'info');
              } catch (e) {
                addToast(`Failed to uninstall after denial: ${String(e)}`, 'error');
              } finally {
                await refreshInstalled();
              }
            })();
          },
        });
      } else {
        addToast(`Plugin "${info.name}" v${info.version} installed`, 'success');
        await refreshInstalled();
      }
    } catch (e) {
      setError(`Install failed: ${String(e)}`);
      addToast(`Install failed: ${String(e)}`, 'error');
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm(`Uninstall plugin "${pluginId}"? This cannot be undone.`)) return;
    setBusyPluginId(pluginId);
    try {
      await invoke('uninstall_plugin', { pluginId });
      addToast(`Plugin "${pluginId}" uninstalled`, 'info');
      await refreshInstalled();
    } catch (e) {
      addToast(`Uninstall failed: ${String(e)}`, 'error');
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
        title={t('settings.plugins.permissionApproval') || 'Plugin Permission Approval'}
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
            <p style={{ margin: '0 0 12px' }}>
              {t('settings.plugins.permissionPrompt') ||
                'This plugin requests the following permissions. Approve to continue:'}
            </p>
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>
              {pendingApproval.pluginName}{' '}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                v{pendingApproval.pluginVersion}
              </span>
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingApproval.permissions.map((perm) => (
                <li key={perm} style={{ listStyle: 'disc' }}>
                  <code style={{ marginRight: '8px' }}>{perm}</code>
                  <span>{permissionDescription(perm)}</span>
                </li>
              ))}
            </ul>
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
}: {
  plugin: RegisteredPlugin;
  busy: boolean;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
}) {
  const { definition, manifest, state, error } = plugin;
  const isActive = state === 'active';
  const isError = state === 'error';
  const permissions = manifest?.permissions ?? [];

  return (
    <div
      className={`${styles.pluginCard} ${
        isActive ? styles.pluginCardActive : ''
      } ${isError ? styles.pluginCardError : ''}`}
    >
      <div className={styles.pluginCardInfo}>
        <div className={styles.pluginCardHeader}>
          <span className={styles.pluginCardName}>{definition.name}</span>
          <span className={styles.pluginCardVersion}>v{definition.version}</span>
          <span className={`${styles.pluginCardBadge} ${styles.badgeBuiltin}`}>builtin</span>
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
        </div>
        {definition.description && (
          <div className={styles.pluginCardDesc}>{definition.description}</div>
        )}
        <div className={styles.pluginCardMeta}>
          <code>{definition.id}</code>
          {manifest?.author && <span> · by {manifest.author}</span>}
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
      </div>
      <div className={styles.pluginCardActions}>
        {!isActive && (
          <button
            className={styles.actionBtn}
            disabled={busy}
            onClick={() => onActivate(definition.id)}
          >
            Activate
          </button>
        )}
        {isActive && (
          <button
            className={`${styles.actionBtn} ${styles.deactivateBtn}`}
            disabled={busy}
            onClick={() => onDeactivate(definition.id)}
          >
            Deactivate
          </button>
        )}
      </div>
    </div>
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
  return (
    <div className={styles.pluginCard}>
      <div className={styles.pluginCardInfo}>
        <div className={styles.pluginCardHeader}>
          <span className={styles.pluginCardName}>{plugin.name}</span>
          <span className={styles.pluginCardVersion}>v{plugin.version}</span>
          <span className={`${styles.pluginCardBadge} ${styles.badgeThirdParty}`}>3rd-party</span>
        </div>
        {plugin.description && (
          <div className={styles.pluginCardDesc}>{plugin.description}</div>
        )}
        <div className={styles.pluginCardMeta}>
          <code>{plugin.id}</code>
          {plugin.author && <span> · by {plugin.author}</span>}
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
          Uninstall
        </button>
      </div>
    </div>
  );
}
