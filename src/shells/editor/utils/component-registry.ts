import type { ComponentDefinition, ComponentNode } from './schema';

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  // Layout containers
  {
    type: 'FlexRow',
    label: 'Flex Row',
    icon: '↔️',
    category: 'layout',
    isContainer: true,
    propSchema: [
      { key: 'gap', label: 'Gap', type: 'string', defaultValue: '0px' },
      { key: 'align', label: 'Align', type: 'select', defaultValue: 'stretch', options: ['stretch', 'start', 'center', 'end'] },
      { key: 'justify', label: 'Justify', type: 'select', defaultValue: 'start', options: ['start', 'center', 'end', 'between'] },
    ],
    defaultProps: { gap: '0px', align: 'stretch', justify: 'start' },
  },
  {
    type: 'FlexCol',
    label: 'Flex Column',
    icon: '↕️',
    category: 'layout',
    isContainer: true,
    propSchema: [
      { key: 'gap', label: 'Gap', type: 'string', defaultValue: '0px' },
      { key: 'align', label: 'Align', type: 'select', defaultValue: 'stretch', options: ['stretch', 'start', 'center', 'end'] },
      { key: 'justify', label: 'Justify', type: 'select', defaultValue: 'start', options: ['start', 'center', 'end', 'between'] },
    ],
    defaultProps: { gap: '0px', align: 'stretch', justify: 'start' },
  },
  {
    type: 'TabView',
    label: 'Tab View',
    icon: '📑',
    category: 'layout',
    isContainer: true,
    propSchema: [
      { key: 'tabs', label: 'Tabs', type: 'string', defaultValue: 'Tab 1, Tab 2' },
      { key: 'activeTab', label: 'Active Tab', type: 'number', defaultValue: 0 },
    ],
    defaultProps: { tabs: 'Tab 1, Tab 2', activeTab: 0 },
  },
  {
    type: 'ScrollArea',
    label: 'Scroll Area',
    icon: '📜',
    category: 'layout',
    isContainer: true,
    propSchema: [
      { key: 'direction', label: 'Direction', type: 'select', defaultValue: 'vertical', options: ['vertical', 'horizontal'] },
      { key: 'maxHeight', label: 'Max Height', type: 'string', defaultValue: '100%' },
    ],
    defaultProps: { direction: 'vertical', maxHeight: '100%' },
  },

  // Feature components
  {
    type: 'Sidebar',
    label: 'Sidebar',
    icon: '📱',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'width', label: 'Width', type: 'string', defaultValue: '60px' },
      { key: 'items', label: 'Nav Items', type: 'string', defaultValue: 'home,instances,settings' },
      { key: 'collapsed', label: 'Collapsed', type: 'boolean', defaultValue: false },
    ],
    defaultProps: { width: '60px', items: 'home,instances,settings', collapsed: false },
  },
  {
    type: 'LaunchPanel',
    label: 'Launch Panel',
    icon: '🚀',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'showInstanceSelect', label: 'Show Instance Select', type: 'boolean', defaultValue: true },
      { key: 'showQuickLaunch', label: 'Show Quick Launch', type: 'boolean', defaultValue: true },
    ],
    defaultProps: { showInstanceSelect: true, showQuickLaunch: true },
  },
  {
    type: 'InstanceList',
    label: 'Instance List',
    icon: '📋',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'viewMode', label: 'View Mode', type: 'select', defaultValue: 'grid', options: ['grid', 'list'] },
      { key: 'showFilters', label: 'Show Filters', type: 'boolean', defaultValue: true },
    ],
    defaultProps: { viewMode: 'grid', showFilters: true },
  },
  {
    type: 'ContentArea',
    label: 'Content Area',
    icon: '📄',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'defaultRoute', label: 'Default Route', type: 'string', defaultValue: '/home' },
    ],
    defaultProps: { defaultRoute: '/home' },
  },
  {
    type: 'DownloadPanel',
    label: 'Download Panel',
    icon: '⬇️',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'position', label: 'Position', type: 'select', defaultValue: 'floating', options: ['floating', 'sidebar'] },
    ],
    defaultProps: { position: 'floating' },
  },
  {
    type: 'SettingsNav',
    label: 'Settings Nav',
    icon: '⚙️',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'sections', label: 'Sections', type: 'string', defaultValue: 'theme,memory,network,security' },
    ],
    defaultProps: { sections: 'theme,memory,network,security' },
  },
  {
    type: 'NewsWidget',
    label: 'News Widget',
    icon: '📰',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'maxItems', label: 'Max Items', type: 'number', defaultValue: 5 },
      { key: 'layout', label: 'Layout', type: 'select', defaultValue: 'card', options: ['card', 'list'] },
    ],
    defaultProps: { maxItems: 5, layout: 'card' },
  },
  {
    type: 'SearchPalette',
    label: 'Search Palette',
    icon: '🔍',
    category: 'feature',
    isContainer: false,
    propSchema: [
      { key: 'placeholder', label: 'Placeholder', type: 'string', defaultValue: 'Search...' },
    ],
    defaultProps: { placeholder: 'Search...' },
  },

  // UI base components
  {
    type: 'Button',
    label: 'Button',
    icon: '🔘',
    category: 'ui',
    isContainer: false,
    propSchema: [
      { key: 'label', label: 'Label', type: 'string', defaultValue: 'Button' },
      { key: 'variant', label: 'Variant', type: 'select', defaultValue: 'primary', options: ['primary', 'secondary', 'ghost'] },
    ],
    defaultProps: { label: 'Button', variant: 'primary' },
  },
  {
    type: 'Card',
    label: 'Card',
    icon: '🃏',
    category: 'ui',
    isContainer: true,
    propSchema: [
      { key: 'title', label: 'Title', type: 'string', defaultValue: 'Card Title' },
      { key: 'padding', label: 'Padding', type: 'string', defaultValue: '16px' },
    ],
    defaultProps: { title: 'Card Title', padding: '16px' },
  },
  {
    type: 'Badge',
    label: 'Badge',
    icon: '🏷️',
    category: 'ui',
    isContainer: false,
    propSchema: [
      { key: 'text', label: 'Text', type: 'string', defaultValue: 'Badge' },
      { key: 'color', label: 'Color', type: 'color', defaultValue: '#007AFF' },
    ],
    defaultProps: { text: 'Badge', color: '#007AFF' },
  },
];

/** Get a component definition by type */
export function getComponentDef(type: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find(c => c.type === type);
}

/** Get components by category */
export function getComponentsByCategory(category: 'layout' | 'feature' | 'ui'): ComponentDefinition[] {
  return COMPONENT_DEFINITIONS.filter(c => c.category === category);
}

/** Generate a unique node ID */
let nodeIdCounter = 0;
export function generateNodeId(): string {
  return `node_${Date.now()}_${++nodeIdCounter}`;
}

/** Create a default component node from a type definition */
export function createDefaultNode(type: string): ComponentNode | null {
  const def = getComponentDef(type);
  if (!def) return null;
  return {
    id: generateNodeId(),
    type: def.type,
    props: { ...def.defaultProps },
    children: [],
  };
}
