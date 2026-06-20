import { useDroppable } from '@dnd-kit/core';
import type { EditorStateAPI } from '../hooks/useEditorState';
import { CanvasNode } from './CanvasNode';
import { ShellRenderer } from '../renderer/ShellRenderer';
import styles from './Canvas.module.css';

interface CanvasProps {
  editor: EditorStateAPI;
}

export function Canvas({ editor }: CanvasProps) {
  const page = editor.state.config.pages[editor.state.activePage];

  const { setNodeRef: setCanvasRef, isOver } = useDroppable({
    id: 'canvas-root',
    data: { nodeType: 'canvas-root' },
  });

  const handleCanvasClick = () => {
    editor.selectNode(null);
  };

  if (!page) {
    return (
      <div className={styles.canvas} onClick={handleCanvasClick}>
        <div className={styles.emptyState}>Select a page to edit</div>
      </div>
    );
  }

  return (
    <div className={styles.canvas} onClick={handleCanvasClick}>
      <div className={styles.canvasHeader}>
        <span className={styles.canvasTitle}>Tree View</span>
        <span className={styles.canvasRoute}>{editor.state.activePage}</span>
      </div>
      <div ref={setCanvasRef} className={`${styles.treeView} ${isOver ? styles.treeViewDropOver : ''}`}>
        <CanvasNode node={page.layout} editor={editor} depth={0} />
      </div>
      <div className={styles.divider} />
      <div className={styles.canvasHeader}>
        <span className={styles.canvasTitle}>Preview</span>
      </div>
      <div className={styles.preview}>
        <ShellRenderer config={editor.state.config} activeRoute={editor.state.activePage} />
      </div>
    </div>
  );
}
