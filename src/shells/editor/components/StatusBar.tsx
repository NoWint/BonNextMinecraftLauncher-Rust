import type { EditorStateAPI } from '../hooks/useEditorState';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  editor: EditorStateAPI;
}

function countNodes(editor: EditorStateAPI): number {
  const page = editor.state.config.pages[editor.state.activePage];
  if (!page) return 0;
  let count = 0;
  function walk(node: any) {
    count++;
    if (node.children) node.children.forEach(walk);
  }
  walk(page.layout);
  return count;
}

export function StatusBar({ editor }: StatusBarProps) {
  const nodeCount = countNodes(editor);

  return (
    <div className={styles.statusbar}>
      <span className={styles.item}>{editor.state.config.name}</span>
      <span className={styles.separator}>|</span>
      <span className={styles.item}>{nodeCount} components</span>
      <span className={styles.separator}>|</span>
      <span className={styles.item}>{editor.state.activePage}</span>
      <span className={styles.separator}>|</span>
      <span className={styles.item}>{editor.state.config.theme.mode}</span>
    </div>
  );
}
