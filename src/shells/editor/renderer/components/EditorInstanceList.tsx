import type { ComponentNode } from '../../utils/schema';

interface EditorInstanceListProps {
  node: ComponentNode;
}

export function EditorInstanceList({ node }: EditorInstanceListProps) {
  const { viewMode = 'grid' } = node.props as Record<string, any>;

  return (
    <div style={{
      display: viewMode === 'grid' ? 'grid' : 'flex',
      gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(120px, 1fr))' : undefined,
      flexDirection: viewMode === 'list' ? 'column' : undefined,
      gap: '8px',
      padding: '8px',
    }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          padding: '12px',
          background: 'var(--bg-card, #1a1a1a)',
          borderRadius: '6px',
          fontSize: '11px',
          color: 'var(--editor-text-secondary, #8e8e93)',
        }}>
          Instance {i}
        </div>
      ))}
    </div>
  );
}
