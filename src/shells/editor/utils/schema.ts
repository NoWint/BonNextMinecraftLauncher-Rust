/** A single component node in the editor tree */
export interface ComponentNode {
  /** Unique instance ID within the tree */
  id: string;
  /** Component type name (e.g. 'Sidebar', 'FlexRow') */
  type: string;
  /** Component properties */
  props: Record<string, unknown>;
  /** Child components (empty for leaf components) */
  children: ComponentNode[];
}

/** Theme configuration for a shell */
export interface ShellTheme {
  mode: 'dark' | 'light';
  variables: Record<string, string>;
}

/** Page layout definition */
export interface PageLayout {
  layout: ComponentNode;
}

/** Full shell configuration — the output of the editor */
export interface ShellConfig {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  theme: ShellTheme;
  pages: Record<string, PageLayout>;
}

/** Property schema for a component type */
export interface PropSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'select';
  defaultValue: unknown;
  options?: string[]; // for 'select' type
}

/** Component definition in the registry */
export interface ComponentDefinition {
  type: string;
  label: string;
  icon: string;
  category: 'layout' | 'feature' | 'ui';
  isContainer: boolean;
  propSchema: PropSchema[];
  defaultProps: Record<string, unknown>;
}

/** Editor state */
export interface EditorState {
  config: ShellConfig;
  selectedNodeId: string | null;
  activePage: string;
  history: ShellConfig[];
  historyIndex: number;
}
