import type { EditorStateAPI } from '../hooks/useEditorState';
import { getComponentDef } from '../utils/component-registry';
import { PropertyField } from './PropertyField';
import styles from './PropertyPanel.module.css';

interface PropertyPanelProps {
  editor: EditorStateAPI;
}

export function PropertyPanel({ editor }: PropertyPanelProps) {
  const selectedNode = editor.getSelectedNode();

  if (!selectedNode) {
    return (
      <div className={styles.panel}>
        <div className={styles.emptyState}>
          Select a component to edit its properties
        </div>
      </div>
    );
  }

  const def = getComponentDef(selectedNode.type);

  const handlePropChange = (key: string, value: unknown) => {
    editor.updateNodeProps(selectedNode.id, { [key]: value });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.icon}>{def?.icon || '📦'}</span>
        <span className={styles.title}>{selectedNode.type}</span>
      </div>
      <div className={styles.props}>
        {def?.propSchema.map(schema => (
          <PropertyField
            key={schema.key}
            schema={schema}
            value={selectedNode.props[schema.key]}
            onChange={handlePropChange}
          />
        ))}
      </div>
      {selectedNode.children.length > 0 && (
        <div className={styles.childrenInfo}>
          {selectedNode.children.length} child{selectedNode.children.length !== 1 ? 'ren' : ''}
        </div>
      )}
    </div>
  );
}
