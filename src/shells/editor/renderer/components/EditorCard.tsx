import type { ComponentNode } from '../../utils/schema';

interface EditorCardProps {
  node: ComponentNode;
  renderChildren: (children: ComponentNode[]) => React.ReactNode;
}

export function EditorCard({ node, renderChildren }: EditorCardProps) {
  const { title = 'Card Title', padding = '16px' } = node.props as Record<string, string>;

  return (
    <div style={{
      padding,
      background: 'var(--color-panel-alt, #1a1a1a)',
      borderRadius: '8px',
      border: '1px solid var(--editor-border, rgba(255,255,255,0.08))',
    }}>
      {title && <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--editor-text, #fff)' }}>{title}</div>}
      {renderChildren(node.children)}
    </div>
  );
}
