import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useShellStore } from '../../../../shared/stores/shellStore';
import { logger } from '../../../../shared/utils/logger';
import styles from './ShellManagementSection.module.css';

export function ShellManagementSection() {
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
      <h2 className={styles.title}>Shell Management</h2>

      <div className={styles.shellList}>
        {state.availableShells.length === 0 && (
          <div className={styles.emptyState}>No shells available</div>
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
                  {shell.isCustom && <span className={styles.shellCardBadge}>Custom</span>}
                </span>
                <div className={styles.shellCardMeta}>
                  {shell.isCustom && customMeta
                    ? `${customMeta.author ? `by ${customMeta.author}` : 'Custom shell'}`
                    : 'Built-in'
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
                    Activate
                  </button>
                )}
                {shell.isCustom && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => handleRemove(shell.id)}
                  >
                    Remove
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
          placeholder="Path to shell folder or .zip file"
          style={{
            flex: 1,
            padding: '0.5em 0.8em',
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-primary)',
            fontSize: '0.85em',
            borderRadius: '2px',
            outline: 'none',
          }}
        />
        <button
          className={styles.importBtn}
          onClick={handleImportFromPath}
          disabled={importing || !pathInput.trim()}
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
        <button
          className={styles.importBtn}
          onClick={handleImportFromDialog}
          disabled={importing}
        >
          Browse File
        </button>
        <button
          className={styles.importBtn}
          onClick={handleImportFolderFromDialog}
          disabled={importing}
        >
          Browse Folder
        </button>
      </div>
    </div>
  );
}
