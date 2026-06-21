import type { ComponentNode } from '../../utils/schema';

interface EditorSidebarProps {
  node: ComponentNode;
}

export function EditorSidebar({ node }: EditorSidebarProps) {
  const { width = '60px', items = 'home,instances,settings', collapsed = false } = node.props as Record<string, any>;
  const navItems = String(items).split(',').map(s => s.trim());

  return (
    <div style={{
      width: collapsed ? '48px' : width,
      minWidth: collapsed ? '48px' : width,
      height: '100%',
      background: 'var(--color-panel, #141414)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
      gap: '4px',
      borderRight: '1px solid var(--editor-border, rgba(255,255,255,0.08))',
    }}>
      {navItems.map((item, i) => (
        <div key={i} style={{
          width: collapsed ? '36px' : '80%',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          background: i === 0 ? 'var(--editor-accent, #007AFF)' : 'transparent',
          color: i === 0 ? '#fff' : 'var(--editor-text-secondary, #8e8e93)',
          fontSize: '11px',
          fontWeight: 500,
          cursor: 'pointer',
        }}>
          {collapsed ? item.charAt(0).toUpperCase() : item}
        </div>
      ))}
    </div>
  );
}
