import React from 'react';
import type { ComponentNode, ShellConfig } from '../utils/schema';
import { COMPONENT_MAP } from './component-map';

interface ShellRendererProps {
  config: ShellConfig;
  activeRoute?: string;
}

/** Recursively render a component node tree */
function RenderNode({ node }: { node: ComponentNode }) {
  const Component = COMPONENT_MAP[node.type];
  if (!Component) {
    return (
      <div style={{
        padding: '8px',
        background: 'rgba(255,59,48,0.1)',
        border: '1px dashed #ff3b30',
        borderRadius: '4px',
        color: '#ff3b30',
        fontSize: '11px',
      }}>
        Unknown: {node.type}
      </div>
    );
  }

  const renderChildren = (children: ComponentNode[]) => (
    <>
      {children.map(child => <RenderNode key={child.id} node={child} />)}
    </>
  );

  return <Component node={node} renderChildren={renderChildren} />;
}

/** Main shell renderer — renders a full ShellConfig */
export function ShellRenderer({ config, activeRoute = '/home' }: ShellRendererProps) {
  // Inject theme variables
  const themeStyle = Object.entries(config.theme.variables).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const page = config.pages[activeRoute];
  if (!page) {
    return (
      <div style={{ padding: '24px', color: '#8e8e93', fontSize: '13px' }}>
        No layout defined for route: {activeRoute}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      ...themeStyle,
    } as React.CSSProperties}>
      <RenderNode node={page.layout} />
    </div>
  );
}

export default ShellRenderer;
