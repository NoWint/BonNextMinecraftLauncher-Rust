import type { ComponentNode } from '../../utils/schema';

interface EditorSettingsNavProps {
  node: ComponentNode;
}

export function EditorSettingsNav({ node }: EditorSettingsNavProps) {
  const { sections = 'theme,memory,network,security' } = node.props as Record<string, any>;
  const sectionList = String(sections).split(',').map(s => s.trim());

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '8px',
    }}>
      {sectionList.map((section, i) => (
        <div key={i} style={{
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          color: i === 0 ? 'var(--editor-accent, #007AFF)' : 'var(--editor-text-secondary, #8e8e93)',
          background: i === 0 ? 'rgba(0,122,255,0.1)' : 'transparent',
          cursor: 'pointer',
        }}>
          {section}
        </div>
      ))}
    </div>
  );
}
