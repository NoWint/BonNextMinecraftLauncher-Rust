import type { EditorStateAPI } from '../hooks/useEditorState';
import { saveShellConfig } from '../utils/shell-io';
import { useToast } from '../../../shared/stores/toastStore';
import styles from './Toolbar.module.css';

const PAGES = ['/home', '/instances', '/settings', '/versions', '/library', '/collections', '/store'];

interface ToolbarProps {
  editor: EditorStateAPI;
}

export function Toolbar({ editor }: ToolbarProps) {
  const { addToast } = useToast();

  const handleSave = async () => {
    try {
      await saveShellConfig(editor.state.config);
      addToast({ title: 'Shell saved', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Save failed', message: e?.message || String(e), type: 'error' });
    }
  };

  const handleThemeToggle = () => {
    const newMode = editor.state.config.theme.mode === 'dark' ? 'light' : 'dark';
    editor.updateTheme({ mode: newMode });
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.logo}>🎨 Shell Editor</span>
        <div className={styles.pageTabs}>
          {PAGES.map(page => (
            <button
              key={page}
              className={`${styles.pageTab} ${editor.state.activePage === page ? styles.pageTabActive : ''}`}
              onClick={() => editor.setActivePage(page)}
            >
              {page}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={editor.undo} disabled={!editor.canUndo} title="Undo">↩</button>
        <button className={styles.iconBtn} onClick={editor.redo} disabled={!editor.canRedo} title="Redo">↪</button>
        <button className={styles.iconBtn} onClick={handleThemeToggle} title="Toggle theme">
          {editor.state.config.theme.mode === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className={styles.saveBtn} onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}
