import type { ComponentNode } from '../../utils/schema';

interface EditorButtonProps {
  node: ComponentNode;
}

export function EditorButton({ node }: EditorButtonProps) {
  const { label = 'Button', variant = 'primary' } = node.props as Record<string, any>;
  const bg = variant === 'primary' ? 'var(--editor-accent, #007AFF)' : variant === 'secondary' ? 'var(--editor-bg-tertiary, #3a3a3c)' : 'transparent';
  const color = variant === 'primary' ? '#fff' : 'var(--editor-text, #fff)';

  return (
    <button style={{
      padding: '6px 16px',
      background: bg,
      color,
      border: variant === 'ghost' ? '1px solid var(--editor-border, rgba(255,255,255,0.08))' : 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
    }}>
      {label}
    </button>
  );
}
