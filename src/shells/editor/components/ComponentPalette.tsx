import { useDraggable } from '@dnd-kit/core';
import type { EditorStateAPI } from '../hooks/useEditorState';
import { getComponentsByCategory } from '../utils/component-registry';
import styles from './ComponentPalette.module.css';

interface ComponentPaletteProps {
  editor: EditorStateAPI;
}

const CATEGORIES: { key: 'layout' | 'feature' | 'ui'; label: string }[] = [
  { key: 'layout', label: 'Layout' },
  { key: 'feature', label: 'Features' },
  { key: 'ui', label: 'UI' },
];

function DraggableItem({ type, icon, label }: { type: string; icon: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { componentType: type },
  });

  return (
    <button
      ref={setNodeRef}
      className={styles.componentItem}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      {...listeners}
      {...attributes}
      title={`Drag to add ${label}`}
    >
      <span className={styles.componentIcon}>{icon}</span>
      <span className={styles.componentLabel}>{label}</span>
    </button>
  );
}

export function ComponentPalette({ editor: _editor }: ComponentPaletteProps) {
  return (
    <div className={styles.palette}>
      {CATEGORIES.map(cat => {
        const components = getComponentsByCategory(cat.key);
        return (
          <div key={cat.key} className={styles.category}>
            <div className={styles.categoryTitle}>{cat.label}</div>
            {components.map(comp => (
              <DraggableItem
                key={comp.type}
                type={comp.type}
                icon={comp.icon}
                label={comp.label}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
