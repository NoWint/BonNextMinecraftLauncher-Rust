import type { ComponentNode } from '../../utils/schema';

interface EditorFlexRowProps {
  node: ComponentNode;
  renderChildren: (children: ComponentNode[]) => React.ReactNode;
}

export function EditorFlexRow({ node, renderChildren }: EditorFlexRowProps) {
  const { gap = '0px', align = 'stretch', justify = 'start' } = node.props as Record<string, string>;
  const justifyContent = justify === 'between' ? 'space-between' : justify;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap,
      alignItems: align,
      justifyContent,
      width: '100%',
      height: '100%',
    }}>
      {renderChildren(node.children)}
    </div>
  );
}
