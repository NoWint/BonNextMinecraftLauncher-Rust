import type { ComponentNode } from '../../utils/schema';

interface EditorLaunchPanelProps {
  node: ComponentNode;
}

export function EditorLaunchPanel({ node }: EditorLaunchPanelProps) {
  const { showInstanceSelect = true } = node.props as Record<string, any>;

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-card, #1a1a1a)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {showInstanceSelect && (
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-secondary, #141414)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--editor-text-secondary, #8e8e93)',
        }}>
          Select Instance...
        </div>
      )}
      <div style={{
        padding: '10px 20px',
        background: 'var(--editor-accent, #007AFF)',
        color: '#fff',
        borderRadius: '6px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '13px',
        cursor: 'pointer',
      }}>
        Launch
      </div>
    </div>
  );
}
