import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEditorState } from './hooks/useEditorState';
import { Toolbar } from './components/Toolbar';
import { ComponentPalette } from './components/ComponentPalette';
import { Canvas } from './components/Canvas';
import { PropertyPanel } from './components/PropertyPanel';
import { StatusBar } from './components/StatusBar';
import './styles/global.css';

export default function EditorAppShell() {
  const editor = useEditorState();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const componentType = active.data.current?.componentType as string;
    if (!componentType) return;

    // Determine the target parent node
    const parentId = (over.id as string) || 'root';
    editor.addNode(parentId, componentType);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="editor-shell" data-theme={editor.state.config.theme.mode}>
        <Toolbar editor={editor} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ComponentPalette editor={editor} />
          <Canvas editor={editor} />
          <PropertyPanel editor={editor} />
        </div>
        <StatusBar editor={editor} />
      </div>
    </DndContext>
  );
}
