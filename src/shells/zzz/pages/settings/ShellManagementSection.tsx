import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useShellStore } from '../../../../shared/stores/shellStore';
import { logger } from '../../../../shared/utils/logger';
import { useI18n } from '../../../../shared/i18n';
import styles from './ShellManagementSection.module.css';

export function ShellManagementSection() {
  const { t } = useI18n();
  const { state, setActiveShell, importShell, removeShell } = useShellStore();
  const [importing, setImporting] = useState(false);
  const [pathInput, setPathInput] = useState('');

  const handleImportFromPath = async () => {
    if (!pathInput.trim()) return;
    setImporting(true);
    try {
      await importShell(pathInput.trim());
      setPathInput('');
    } catch (e: any) {
      logger.error('Import failed:', e);
    } finally {
      setImporting(false);
    }
  };

  const handleImportFromDialog = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Shell Archive', extensions: ['zip'] },
          { name: 'All', extensions: ['*'] },
        ],
      });
      if (selected && typeof selected === 'string') {
        setImporting(true);
        try {
          await importShell(selected);
        } catch (e: any) {
          logger.error('Import failed:', e);
        } finally {
          setImporting(false);
        }
      }
    } catch {
      /* dialog cancelled */
    }
  };

  const handleImportFolderFromDialog = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setImporting(true);
        try {
          await importShell(selected);
        } catch (e: any) {
          logger.error('Import failed:', e);
        } finally {
          setImporting(false);
        }
      }
    } catch {
      /* dialog cancelled */
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeShell(id);
    } catch (e: any) {
      logger.error('Remove failed:', e);
    }
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>{t('settings.shell.title')}</h2>

      <div className={styles.shellList}>
        {state.availableShells.length === 0 && (
          <div className={styles.emptyState}>{t('settings.shell.empty')}</div>
        )}
        {state.availableShells.map((shell) => {
          const isActive = shell.id === state.activeShell;
          const customMeta = state.customShells.find(m => m.id === shell.id);
          return (
            <div
              key={shell.id}
              className={`${styles.shellCard} ${isActive ? styles.shellCardActive : ''}`}
            >
              <div className={styles.shellCardInfo}>
                <span className={styles.shellCardName}>
                  {shell.name}
                  {shell.isCustom && <span className={styles.shellCardBadge}>{t('settings.shell.custom')}</span>}
                </span>
                <div className={styles.shellCardMeta}>
                  {shell.isCustom && customMeta
                    ? (customMeta.author ? t('settings.shell.byAuthor', { author: customMeta.author }) : t('settings.shell.customShell'))
                    : t('settings.shell.builtin')
                  }
                  {' — '}{shell.description}
                </div>
              </div>
              <div className={styles.shellCardActions}>
                {!isActive && (
                  <button
                    className={styles.importBtn}
                    onClick={() => setActiveShell(shell.id)}
                  >
                    {t('settings.shell.activate')}
                  </button>
                )}
                {shell.isCustom && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemove(shell.id)}
                  >
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.importRow}>
        <input
          type="text"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          placeholder={t('settings.shell.pathPlaceholder')}
          style={{
            flex: 1,
            padding: '0.5em 0.8em',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border-light)',
            color: 'var(--color-text)',
            fontSize: '0.85em',
            clipPath: 'var(--clip-badge)',
            outline: 'none',
          }}
        />
        <button
          className={styles.importBtn}
          onClick={handleImportFromPath}
          disabled={importing || !pathInput.trim()}
        >
          {importing ? t('common.importing') : t('common.import')}
        </button>
        <button
          className={styles.importBtn}
          onClick={handleImportFromDialog}
          disabled={importing}
        >
          {t('settings.shell.browseFile')}
        </button>
        <button
          className={styles.importBtn}
          onClick={handleImportFolderFromDialog}
          disabled={importing}
        >
          {t('settings.shell.browseFolder')}
        </button>
      </div>
    </div>
  );
}
