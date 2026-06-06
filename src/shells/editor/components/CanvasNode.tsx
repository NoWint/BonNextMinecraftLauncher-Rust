import { useDroppable } from '@dnd-kit/core';
import type { ComponentNode } from '../utils/schema';
import type { EditorStateAPI } from '../hooks/useEditorState';
import { getComponentDef } from '../utils/component-registry';
import styles from './CanvasNode.module.css';

interface CanvasNodeProps {
  node: ComponentNode;
  editor: EditorStateAPI;
  depth: number;
}

export function CanvasNode({ node, editor, depth }: CanvasNodeProps) {
  const isSelected = editor.state.selectedNodeId === node.id;
  const def = getComponentDef(node.type);

  const { setNodeRef, isOver } = useDroppable({
    id: node.id,
    data: { nodeType: 'canvas-node', isContainer: def?.isContainer },
    disabled: !def?.isContainer,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    editor.selectNode(node.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    editor.removeNode(node.id);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    editor.addNode(node.id, 'FlexCol');
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.node} ${isSelected ? styles.nodeSelected : ''} ${isOver ? styles.nodeDropOver : ''}`}
      onClick={handleClick}
      style={{ marginLeft: depth * 12 }}
    >
      <div className={styles.nodeHeader}>
        <span className={styles.nodeIcon}>{def?.icon || '📦'}</span>
        <span className={styles.nodeType}>{node.type}</span>
        {def?.isContainer && (
          <button className={styles.addChildBtn} onClick={handleAddChild} title="Add child">+</button>
        )}
        <button className={styles.deleteBtn} onClick={handleDelete} title="Remove">×</button>
      </div>
      {node.children.length > 0 && (
        <div className={styles.nodeChildren}>
          {node.children.map(child => (
            <CanvasNode key={child.id} node={child} editor={editor} depth={depth + 1} />
          ))}
        </div>
      )}
      {def?.isContainer && node.children.length === 0 && (
        <div className={`${styles.emptyDropZone} ${isOver ? styles.emptyDropZoneOver : ''}`}>
          {isOver ? 'Drop here!' : 'Drop components here'}
        </div>
      )}
    </div>
  );
}
