import type { ComponentNode } from '../../utils/schema';

interface EditorFlexColProps {
  node: ComponentNode;
  renderChildren: (children: ComponentNode[]) => React.ReactNode;
}

export function EditorFlexCol({ node, renderChildren }: EditorFlexColProps) {
  const { gap = '0px', align = 'stretch', justify = 'start' } = node.props as Record<string, string>;
  const justifyContent = justify === 'between' ? 'space-between' : justify;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
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
