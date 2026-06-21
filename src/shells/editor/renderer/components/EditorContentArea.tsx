import type { ComponentNode } from '../../utils/schema';

interface EditorContentAreaProps {
  node: ComponentNode;
}

export function EditorContentArea({ node }: EditorContentAreaProps) {
  const { defaultRoute = '/home' } = node.props as Record<string, any>;

  return (
    <div style={{
      flex: 1,
      padding: '16px',
      background: 'var(--color-bg, #0d0d0d)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--editor-text-tertiary, #636366)',
      fontSize: '12px',
    }}>
      Content: {defaultRoute}
    </div>
  );
}
