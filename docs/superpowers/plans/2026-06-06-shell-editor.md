# Shell Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visual drag-and-drop Shell Editor as a new built-in Shell, allowing users to create custom launcher UIs from BonNext's component library and save as JSON configuration.

**Architecture:** Three-panel editor (ComponentPalette + Canvas + PropertyPanel) with SwiftUI design language. Editor produces JSON component trees saved as `shell.json`, rendered at runtime by a built-in ShellRenderer. Drag-and-drop via `@dnd-kit/core`. Editor state managed by `useEditorState` hook with undo/redo history stack.

**Tech Stack:** React 18, TypeScript, CSS Modules, `@dnd-kit/core` + `@dnd-kit/sortable`, Tauri v2 IPC

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/shells/editor/index.ts` | ShellDefinition registration |
| `src/shells/editor/AppShell.tsx` | Editor main entry — three-panel layout |
| `src/shells/editor/styles/tokens.css` | SwiftUI-style design tokens |
| `src/shells/editor/styles/themes.css` | dark/light themes |
| `src/shells/editor/styles/global.css` | Global styles |
| `src/shells/editor/utils/schema.ts` | JSON Schema type definitions (ShellConfig, ComponentNode, etc.) |
| `src/shells/editor/utils/component-registry.ts` | Component metadata — types, prop schemas, categories |
| `src/shells/editor/utils/shell-io.ts` | Save/load/export/import shell.json via Tauri commands |
| `src/shells/editor/hooks/useEditorState.ts` | Editor state — component tree, selection, history (undo/redo) |
| `src/shells/editor/components/Toolbar.tsx` | Top toolbar — page tabs, theme, undo/redo, save/export/import |
| `src/shells/editor/components/Toolbar.module.css` | Toolbar styles |
| `src/shells/editor/components/ComponentPalette.tsx` | Left panel — draggable component list |
| `src/shells/editor/components/ComponentPalette.module.css` | Palette styles |
| `src/shells/editor/components/Canvas.tsx` | Center — drop zone + component tree rendering |
| `src/shells/editor/components/Canvas.module.css` | Canvas styles |
| `src/shells/editor/components/CanvasNode.tsx` | Single component node on canvas (selectable, droppable) |
| `src/shells/editor/components/CanvasNode.module.css` | Node styles |
| `src/shells/editor/components/PropertyPanel.tsx` | Right panel — property editor for selected component |
| `src/shells/editor/components/PropertyPanel.module.css` | Property panel styles |
| `src/shells/editor/components/PropertyField.tsx` | Dynamic form field renderer (string/color/bool/number/select) |
| `src/shells/editor/components/StatusBar.tsx` | Bottom status bar |
| `src/shells/editor/components/StatusBar.module.css` | Status bar styles |
| `src/shells/editor/renderer/ShellRenderer.tsx` | JSON → React renderer for custom shells |
| `src/shells/editor/renderer/component-map.ts` | type string → React component mapping |
| `src/shells/editor/renderer/components/EditorFlexRow.tsx` | FlexRow layout component |
| `src/shells/editor/renderer/components/EditorFlexCol.tsx` | FlexCol layout component |
| `src/shells/editor/renderer/components/EditorSidebar.tsx` | Sidebar feature component |
| `src/shells/editor/renderer/components/EditorLaunchPanel.tsx` | LaunchPanel feature component |
| `src/shells/editor/renderer/components/EditorInstanceList.tsx` | InstanceList feature component |
| `src/shells/editor/renderer/components/EditorContentArea.tsx` | ContentArea feature component |
| `src/shells/editor/renderer/components/EditorDownloadPanel.tsx` | DownloadPanel feature component |
| `src/shells/editor/renderer/components/EditorSettingsNav.tsx` | SettingsNav feature component |
| `src/shells/editor/renderer/components/EditorButton.tsx` | Button UI component |
| `src/shells/editor/renderer/components/EditorCard.tsx` | Card UI component |

### Modified Files

| File | Change |
|------|--------|
| `src/shell-registry.ts` | Register editorShell |
| `src-tauri/src/commands/shell.rs` | Add `save_shell_config` and `load_shell_config` commands |
| `src-tauri/src/lib.rs` | Register new commands |
| `src/shared/api/shell.ts` | Add save/load shell config API wrappers |
| `src/shared/api/index.ts` | Export new API methods |

---

### Task 1: Schema & Type Definitions

**Files:**
- Create: `src/shells/editor/utils/schema.ts`

- [ ] **Step 1: Create the schema type definitions**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors related to schema.ts

- [ ] **Step 3: Commit**

```bash
git add src/shells/editor/utils/schema.ts
git commit -m "feat(editor): add schema type definitions for shell editor"
```

---

### Task 2: Component Registry

**Files:**
- Create: `src/shells/editor/utils/component-registry.ts`

- [ ] **Step 1: Create the component registry with all component definitions**

```typescript
import type { ComponentDefinition } from './schema';

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
    children: def.isContainer ? [] : [],
  };
}

// Import ComponentNode from schema
import type { ComponentNode } from './schema';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shells/editor/utils/component-registry.ts
git commit -m "feat(editor): add component registry with all component definitions"
```

---

### Task 3: Shell IO — Save/Load Backend Commands

**Files:**
- Modify: `src-tauri/src/commands/shell.rs` — add `save_shell_config` and `load_shell_config`
- Modify: `src-tauri/src/lib.rs` — register new commands
- Modify: `src/shared/api/shell.ts` — add API wrappers
- Modify: `src/shared/api/index.ts` — export new methods
- Create: `src/shells/editor/utils/shell-io.ts`

- [ ] **Step 1: Add Rust commands for saving/loading shell config JSON**

Add to `src-tauri/src/commands/shell.rs`:

```rust
#[tauri::command]
pub async fn save_shell_config(shell_id: String, config_json: String) -> Result<(), LauncherError> {
    let data_dir = paths::get_game_dir();
    let shell_dir = data_dir.join("shells").join(&shell_id);

    fs::create_dir_all(&shell_dir).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to create shell dir: {}", e)))
    })?;

    let config_path = shell_dir.join("shell.json");
    fs::write(&config_path, &config_json).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to write shell config: {}", e)))
    })?;

    // Also write/update manifest.json
    let manifest = serde_json::json!({
        "id": shell_id,
        "name": shell_id,
        "version": "1.0.0",
        "entry": "shell.json",
        "supported_themes": ["dark", "light"],
        "supported_routes": ["/home", "/instances", "/settings", "/versions", "/library", "/collections", "/store"],
    });
    let manifest_path = shell_dir.join("manifest.json");
    let manifest_str = serde_json::to_string_pretty(&manifest).map_err(|e| {
        LauncherError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to serialize manifest: {}", e)))
    })?;
    fs::write(&manifest_path, &manifest_str).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to write manifest: {}", e)))
    })?;

    Ok(())
}

#[tauri::command]
pub async fn load_shell_config(shell_id: String) -> Result<String, LauncherError> {
    let data_dir = paths::get_game_dir();
    let config_path = data_dir.join("shells").join(&shell_id).join("shell.json");

    if !config_path.exists() {
        return Ok("{}");
    }

    fs::read_to_string(&config_path).await.map_err(|e| {
        LauncherError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to read shell config: {}", e)))
    })
}
```

Note: Adapt error types to match the actual `LauncherError` enum in the project (check `src-tauri/src/error.rs`). The project uses `LauncherError::Io(std::io::Error)` with `#[from]`.

- [ ] **Step 2: Register new commands in `src-tauri/src/lib.rs`**

Add after the existing shell commands:
```rust
commands::shell::save_shell_config,
commands::shell::load_shell_config,
```

- [ ] **Step 3: Add API wrappers in `src/shared/api/shell.ts`**

```typescript
export const saveShellConfig = (shellId: string, configJson: string): Promise<void> =>
  invoke<void>('save_shell_config', { shellId, configJson });

export const loadShellConfig = (shellId: string): Promise<string> =>
  invoke<string>('load_shell_config', { shellId });
```

- [ ] **Step 4: Export in `src/shared/api/index.ts`**

Add to the re-export line and the `api` object:
```typescript
saveShellConfig: shell.saveShellConfig,
loadShellConfig: shell.loadShellConfig,
```

- [ ] **Step 5: Create `src/shells/editor/utils/shell-io.ts`**

```typescript
import { api } from '../../../shared/api';
import type { ShellConfig } from './schema';

export async function saveShellConfig(config: ShellConfig): Promise<void> {
  const json = JSON.stringify(config, null, 2);
  await api.saveShellConfig(config.id, json);
}

export async function loadShellConfig(shellId: string): Promise<ShellConfig | null> {
  const json = await api.loadShellConfig(shellId);
  if (!json || json === '{}') return null;
  return JSON.parse(json) as ShellConfig;
}

export function createDefaultConfig(id: string, name: string): ShellConfig {
  return {
    id,
    name,
    version: '1.0.0',
    author: '',
    description: '',
    theme: {
      mode: 'dark',
      variables: {
        '--bg-primary': '#0d0d0d',
        '--bg-secondary': '#141414',
        '--bg-card': '#1a1a1a',
        '--text-primary': '#ffffff',
        '--accent': '#ffe600',
      },
    },
    pages: {
      '/home': { layout: { id: 'root', type: 'FlexRow', props: { gap: '0' }, children: [] } },
      '/instances': { layout: { id: 'root', type: 'FlexRow', props: { gap: '0' }, children: [] } },
      '/settings': { layout: { id: 'root', type: 'FlexRow', props: { gap: '0' }, children: [] } },
    },
  };
}
```

- [ ] **Step 6: Verify Rust + TypeScript compile**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3`
Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: Both pass

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/shell.rs src-tauri/src/lib.rs src/shared/api/shell.ts src/shared/api/index.ts src/shells/editor/utils/shell-io.ts
git commit -m "feat(editor): add shell config save/load backend and frontend IO"
```

---

### Task 4: Editor State Hook (useEditorState)

**Files:**
- Create: `src/shells/editor/hooks/useEditorState.ts`

- [ ] **Step 1: Create the editor state hook with undo/redo**

```typescript
import { useReducer, useCallback } from 'react';
import type { ShellConfig, ComponentNode } from '../utils/schema';
import { createDefaultConfig } from '../utils/shell-io';
import { generateNodeId, createDefaultNode, getComponentDef } from '../utils/component-registry';

interface EditorState {
  config: ShellConfig;
  selectedNodeId: string | null;
  activePage: string;
  history: ShellConfig[];
  historyIndex: number;
}

type EditorAction =
  | { type: 'SET_CONFIG'; payload: ShellConfig }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'SET_ACTIVE_PAGE'; payload: string }
  | { type: 'ADD_NODE'; payload: { parentId: string; node: ComponentNode } }
  | { type: 'REMOVE_NODE'; payload: string }
  | { type: 'MOVE_NODE'; payload: { nodeId: string; newParentId: string; index: number } }
  | { type: 'UPDATE_NODE_PROPS'; payload: { nodeId: string; props: Record<string, unknown> } }
  | { type: 'UPDATE_THEME'; payload: { mode?: 'dark' | 'light'; variables?: Record<string, string> } }
  | { type: 'UPDATE_META'; payload: { name?: string; version?: string; author?: string; description?: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function findNodeById(root: ComponentNode, id: string): ComponentNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function findParentNode(root: ComponentNode, id: string): { parent: ComponentNode; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === id) {
      return { parent: root, index: i };
    }
    const found = findParentNode(root.children[i], id);
    if (found) return found;
  }
  return null;
}

function updateNodeInTree(root: ComponentNode, nodeId: string, updater: (node: ComponentNode) => ComponentNode): ComponentNode {
  if (root.id === nodeId) return updater(root);
  return {
    ...root,
    children: root.children.map(child => updateNodeInTree(child, nodeId, updater)),
  };
}

function removeNodeFromTree(root: ComponentNode, nodeId: string): ComponentNode {
  return {
    ...root,
    children: root.children
      .filter(child => child.id !== nodeId)
      .map(child => removeNodeFromTree(child, nodeId)),
  };
}

function addNodeToTree(root: ComponentNode, parentId: string, node: ComponentNode): ComponentNode {
  if (root.id === parentId) {
    return { ...root, children: [...root.children, node] };
  }
  return {
    ...root,
    children: root.children.map(child => addNodeToTree(child, parentId, node)),
  };
}

function moveNodeInTree(root: ComponentNode, nodeId: string, newParentId: string, index: number): ComponentNode {
  // First remove from old position
  const treeWithoutNode = removeNodeFromTree(root, nodeId);
  // Find the node data
  const nodeData = findNodeById(root, nodeId);
  if (!nodeData) return root;
  // Add to new position
  return updateNodeInTree(treeWithoutNode, newParentId, (parent) => {
    const newChildren = [...parent.children];
    newChildren.splice(index, 0, nodeData);
    return { ...parent, children: newChildren };
  });
}

function pushHistory(state: EditorState, newConfig: ShellConfig): EditorState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(newConfig)));
  // Keep max 50 history entries
  if (newHistory.length > 50) newHistory.shift();
  return {
    ...state,
    config: newConfig,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        config: action.payload,
        history: [JSON.parse(JSON.stringify(action.payload))],
        historyIndex: 0,
      };

    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.payload };

    case 'SET_ACTIVE_PAGE':
      return { ...state, activePage: action.payload, selectedNodeId: null };

    case 'ADD_NODE': {
      const page = state.config.pages[state.activePage];
      if (!page) return state;
      const newLayout = addNodeToTree(page.layout, action.payload.parentId, action.payload.node);
      const newConfig = {
        ...state.config,
        pages: { ...state.config.pages, [state.activePage]: { layout: newLayout } },
      };
      return { ...pushHistory(state, newConfig), selectedNodeId: action.payload.node.id };
    }

    case 'REMOVE_NODE': {
      const page = state.config.pages[state.activePage];
      if (!page) return state;
      const newLayout = removeNodeFromTree(page.layout, action.payload);
      const newConfig = {
        ...state.config,
        pages: { ...state.config.pages, [state.activePage]: { layout: newLayout } },
      };
      return { ...pushHistory(state, newConfig), selectedNodeId: null };
    }

    case 'MOVE_NODE': {
      const page = state.config.pages[state.activePage];
      if (!page) return state;
      const newLayout = moveNodeInTree(page.layout, action.payload.nodeId, action.payload.newParentId, action.payload.index);
      const newConfig = {
        ...state.config,
        pages: { ...state.config.pages, [state.activePage]: { layout: newLayout } },
      };
      return pushHistory(state, newConfig);
    }

    case 'UPDATE_NODE_PROPS': {
      const page = state.config.pages[state.activePage];
      if (!page) return state;
      const newLayout = updateNodeInTree(page.layout, action.payload.nodeId, (node) => ({
        ...node,
        props: { ...node.props, ...action.payload.props },
      }));
      const newConfig = {
        ...state.config,
        pages: { ...state.config.pages, [state.activePage]: { layout: newLayout } },
      };
      return pushHistory(state, newConfig);
    }

    case 'UPDATE_THEME': {
      const newConfig = {
        ...state.config,
        theme: {
          mode: action.payload.mode ?? state.config.theme.mode,
          variables: { ...state.config.theme.variables, ...(action.payload.variables ?? {}) },
        },
      };
      return pushHistory(state, newConfig);
    }

    case 'UPDATE_META': {
      const newConfig = {
        ...state.config,
        name: action.payload.name ?? state.config.name,
        version: action.payload.version ?? state.config.version,
        author: action.payload.author ?? state.config.author,
        description: action.payload.description ?? state.config.description,
      };
      return pushHistory(state, newConfig);
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        config: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
        selectedNodeId: null,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        config: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
        selectedNodeId: null,
      };
    }

    default:
      return state;
  }
}

export function useEditorState(initialId?: string, initialName?: string) {
  const [state, dispatch] = useReducer(editorReducer, {
    config: createDefaultConfig(initialId || 'my-shell', initialName || 'My Shell'),
    selectedNodeId: null,
    activePage: '/home',
    history: [],
    historyIndex: -1,
  });

  const setConfig = useCallback((config: ShellConfig) => {
    dispatch({ type: 'SET_CONFIG', payload: config });
  }, []);

  const selectNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SELECT_NODE', payload: nodeId });
  }, []);

  const setActivePage = useCallback((page: string) => {
    dispatch({ type: 'SET_ACTIVE_PAGE', payload: page });
  }, []);

  const addNode = useCallback((parentId: string, componentType: string) => {
    const node = createDefaultNode(componentType);
    if (node) {
      dispatch({ type: 'ADD_NODE', payload: { parentId, node } });
    }
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    dispatch({ type: 'REMOVE_NODE', payload: nodeId });
  }, []);

  const moveNode = useCallback((nodeId: string, newParentId: string, index: number) => {
    dispatch({ type: 'MOVE_NODE', payload: { nodeId, newParentId, index } });
  }, []);

  const updateNodeProps = useCallback((nodeId: string, props: Record<string, unknown>) => {
    dispatch({ type: 'UPDATE_NODE_PROPS', payload: { nodeId, props } });
  }, []);

  const updateTheme = useCallback((updates: { mode?: 'dark' | 'light'; variables?: Record<string, string> }) => {
    dispatch({ type: 'UPDATE_THEME', payload: updates });
  }, []);

  const updateMeta = useCallback((updates: { name?: string; version?: string; author?: string; description?: string }) => {
    dispatch({ type: 'UPDATE_META', payload: updates });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const getSelectedNode = useCallback((): ComponentNode | null => {
    if (!state.selectedNodeId) return null;
    const page = state.config.pages[state.activePage];
    if (!page) return null;
    return findNodeById(page.layout, state.selectedNodeId);
  }, [state.selectedNodeId, state.config, state.activePage]);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return {
    state,
    setConfig,
    selectNode,
    setActivePage,
    addNode,
    removeNode,
    moveNode,
    updateNodeProps,
    updateTheme,
    updateMeta,
    undo,
    redo,
    getSelectedNode,
    canUndo,
    canRedo,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shells/editor/hooks/useEditorState.ts
git commit -m "feat(editor): add editor state hook with undo/redo"
```

---

### Task 5: Styles — SwiftUI Design Tokens, Themes, Global CSS

**Files:**
- Create: `src/shells/editor/styles/tokens.css`
- Create: `src/shells/editor/styles/themes.css`
- Create: `src/shells/editor/styles/global.css`

- [ ] **Step 1: Create tokens.css**

```css
:root {
  /* Editor-specific tokens */
  --editor-palette-width: 200px;
  --editor-property-width: 220px;
  --editor-toolbar-height: 44px;
  --editor-statusbar-height: 28px;
  --editor-accent: #007AFF;
  --editor-accent-hover: #0066d6;
  --editor-danger: #ff3b30;
  --editor-success: #34c759;
  --editor-warning: #ff9500;
  --editor-border-radius: 8px;
  --editor-border-radius-sm: 4px;
  --editor-font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  --editor-font-mono: 'SF Mono', 'Fira Code', monospace;
  --editor-transition: 150ms ease;
}
```

- [ ] **Step 2: Create themes.css**

```css
.theme-dark .editor-shell,
.editor-shell[data-theme='dark'] {
  --editor-bg: #1c1c1e;
  --editor-bg-secondary: #2c2c2e;
  --editor-bg-tertiary: #3a3a3c;
  --editor-bg-hover: #3a3a3c;
  --editor-surface: #2c2c2e;
  --editor-text: #ffffff;
  --editor-text-secondary: #8e8e93;
  --editor-text-tertiary: #636366;
  --editor-border: rgba(255, 255, 255, 0.08);
  --editor-border-active: var(--editor-accent);
  --editor-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  --editor-canvas-bg: #0d0d0d;
  --editor-canvas-dot: rgba(255, 255, 255, 0.06);
  --editor-selection: rgba(0, 122, 255, 0.2);
  --editor-drop-target: rgba(0, 122, 255, 0.15);
}

.theme-light .editor-shell,
.editor-shell[data-theme='light'] {
  --editor-bg: #f5f5f7;
  --editor-bg-secondary: #e8e8ed;
  --editor-bg-tertiary: #d1d1d6;
  --editor-bg-hover: #d1d1d6;
  --editor-surface: #ffffff;
  --editor-text: #1c1c1e;
  --editor-text-secondary: #6e6e73;
  --editor-text-tertiary: #aeaeb2;
  --editor-border: rgba(0, 0, 0, 0.08);
  --editor-border-active: var(--editor-accent);
  --editor-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --editor-canvas-bg: #fafafa;
  --editor-canvas-dot: rgba(0, 0, 0, 0.06);
  --editor-selection: rgba(0, 122, 255, 0.15);
  --editor-drop-target: rgba(0, 122, 255, 0.1);
}
```

- [ ] **Step 3: Create global.css**

```css
@import './tokens.css';
@import './themes.css';

.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: var(--editor-font);
  font-size: 13px;
  color: var(--editor-text);
  background: var(--editor-bg);
  overflow: hidden;
  user-select: none;
}

.editor-shell * {
  box-sizing: border-box;
}

.editor-shell input,
.editor-shell select {
  font-family: var(--editor-font);
  font-size: 12px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shells/editor/styles/
git commit -m "feat(editor): add SwiftUI-style design tokens, themes, and global CSS"
```

---

### Task 6: Editor UI Components — Toolbar, ComponentPalette, Canvas, PropertyPanel, StatusBar

**Files:**
- Create all 10 files listed in the file structure for the UI components

This is the largest task. Each component should be created with its CSS Module. The key interactions:

- **Toolbar**: Page tabs (click to switch active page), theme toggle, undo/redo buttons, save/export/import buttons
- **ComponentPalette**: Lists components grouped by category (layout/feature/ui), each item is draggable
- **Canvas**: Renders the component tree for the active page, supports drop zones, click to select, delete key to remove
- **CanvasNode**: Renders a single component node with selection highlight, drop indicator for children
- **PropertyPanel**: Shows props of selected node, dynamic form fields based on propSchema
- **PropertyField**: Renders a single form field (string→input, color→color picker, boolean→checkbox, number→number input, select→dropdown)
- **StatusBar**: Shows shell name, component count, last saved time

Due to the size, implement each component as a focused sub-step. All components use the `useEditorState` hook from Task 4.

- [ ] **Step 1: Create Toolbar.tsx + Toolbar.module.css**
- [ ] **Step 2: Create ComponentPalette.tsx + ComponentPalette.module.css**
- [ ] **Step 3: Create CanvasNode.tsx + CanvasNode.module.css**
- [ ] **Step 4: Create Canvas.tsx + Canvas.module.css**
- [ ] **Step 5: Create PropertyField.tsx**
- [ ] **Step 6: Create PropertyPanel.tsx + PropertyPanel.module.css**
- [ ] **Step 7: Create StatusBar.tsx + StatusBar.module.css**
- [ ] **Step 8: Verify TypeScript compiles**
- [ ] **Step 9: Commit**

```bash
git add src/shells/editor/components/
git commit -m "feat(editor): add all editor UI components"
```

---

### Task 7: AppShell & Shell Registration

**Files:**
- Create: `src/shells/editor/AppShell.tsx`
- Create: `src/shells/editor/index.ts`
- Modify: `src/shell-registry.ts` — register editorShell

- [ ] **Step 1: Create AppShell.tsx**

The main editor entry that composes all panels:

```typescript
import { useEditorState } from './hooks/useEditorState';
import { Toolbar } from './components/Toolbar';
import { ComponentPalette } from './components/ComponentPalette';
import { Canvas } from './components/Canvas';
import { PropertyPanel } from './components/PropertyPanel';
import { StatusBar } from './components/StatusBar';
import './styles/global.css';

export default function EditorAppShell() {
  const editor = useEditorState();

  return (
    <div className="editor-shell" data-theme={editor.state.config.theme.mode}>
      <Toolbar editor={editor} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <ComponentPalette editor={editor} />
        <Canvas editor={editor} />
        <PropertyPanel editor={editor} />
      </div>
      <StatusBar editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Create index.ts**

```typescript
import type { ShellDefinition } from '../../shared/types/shell';

export const editorShell: ShellDefinition = {
  id: 'editor',
  name: 'Shell Editor',
  description: '可视化 Shell 编辑器 — 拖拽创建自定义界面',
  icon: '🎨',
  loader: () => import('./AppShell'),
  supportedRoutes: ['/editor'],
  supportedThemes: ['dark', 'light'],
};
```

- [ ] **Step 3: Register in shell-registry.ts**

Add import and registration:
```typescript
import { editorShell } from './shells/editor';
registerShell(editorShell);
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shells/editor/AppShell.tsx src/shells/editor/index.ts src/shell-registry.ts
git commit -m "feat(editor): add editor AppShell and register as built-in shell"
```

---

### Task 8: Shell Renderer — JSON to React

**Files:**
- Create: `src/shells/editor/renderer/component-map.ts`
- Create: `src/shells/editor/renderer/ShellRenderer.tsx`
- Create: `src/shells/editor/renderer/components/EditorFlexRow.tsx`
- Create: `src/shells/editor/renderer/components/EditorFlexCol.tsx`
- Create: `src/shells/editor/renderer/components/EditorSidebar.tsx`
- Create: `src/shells/editor/renderer/components/EditorLaunchPanel.tsx`
- Create: `src/shells/editor/renderer/components/EditorInstanceList.tsx`
- Create: `src/shells/editor/renderer/components/EditorContentArea.tsx`
- Create: `src/shells/editor/renderer/components/EditorDownloadPanel.tsx`
- Create: `src/shells/editor/renderer/components/EditorSettingsNav.tsx`
- Create: `src/shells/editor/renderer/components/EditorButton.tsx`
- Create: `src/shells/editor/renderer/components/EditorCard.tsx`

- [ ] **Step 1: Create all renderer components**

Each renderer component is a simplified version of the real BonNext component that accepts props from the JSON config. For example:

**EditorFlexRow.tsx:**
```typescript
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
```

Similar pattern for all other components. Feature components (Sidebar, LaunchPanel, etc.) render simplified placeholder UIs that look like the real components but are static.

- [ ] **Step 2: Create component-map.ts**

Maps type strings to renderer components.

- [ ] **Step 3: Create ShellRenderer.tsx**

The main renderer that reads shell.json and recursively renders the component tree. This component also serves as the entry point for custom shells created by the editor.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shells/editor/renderer/
git commit -m "feat(editor): add ShellRenderer and all renderer components"
```

---

### Task 9: Install @dnd-kit and Wire Up Drag & Drop

**Files:**
- Modify: `package.json` (add @dnd-kit dependencies)
- Modify: `src/shells/editor/components/ComponentPalette.tsx` — make items draggable
- Modify: `src/shells/editor/components/Canvas.tsx` — add drop zones
- Modify: `src/shells/editor/components/CanvasNode.tsx` — add sortable/droppable

- [ ] **Step 1: Install @dnd-kit**

Run: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Wrap AppShell in DndContext**

Add `<DndContext>` provider in AppShell.tsx with custom sensors and collision detection.

- [ ] **Step 3: Make ComponentPalette items draggable**

Use `useDraggable` from @dnd-kit for each component item.

- [ ] **Step 4: Make Canvas a drop target**

Use `useDroppable` for the canvas root and for each container node's children area.

- [ ] **Step 5: Handle drop events**

In the `onDragEnd` handler, determine the target parent and insert the new node or move an existing node.

- [ ] **Step 6: Verify the app builds**

Run: `pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/shells/editor/
git commit -m "feat(editor): wire up drag and drop with @dnd-kit"
```

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Run full build check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3 && npx tsc --noEmit 2>&1 | head -10`
Expected: Both pass

- [ ] **Step 2: Run `pnpm tauri dev` and verify**

1. ShellSwitcher shows "Shell Editor" option
2. Clicking it opens the editor with three-panel layout
3. Component palette shows all components grouped by category
4. Dragging a component to canvas adds it
5. Clicking a component on canvas selects it and shows properties
6. Editing properties updates the canvas preview
7. Save button persists the shell config
8. Undo/redo works

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(editor): shell editor v1 complete"
```

---

## Self-Review

**1. Spec coverage:**
- Section 1 (Architecture): Covered by Tasks 5, 6, 7
- Section 2 (Component Library & Schema): Covered by Tasks 1, 2
- Section 3 (Shell Renderer): Covered by Task 8
- Section 4 (Editor Interactions): Covered by Tasks 4, 6, 9
- Section 5 (File Structure): All files mapped to tasks
- Section 6 (Shell Registration): Covered by Task 7
- Section 7 (Integration): Covered by Tasks 3, 8

**2. Placeholder scan:** Task 6 is intentionally high-level (10 sub-steps) because writing all 10 component files with full code would exceed reasonable plan length. Each sub-step should be implemented with actual code during execution.

**3. Type consistency:** `ShellConfig`, `ComponentNode`, `PropSchema`, `ComponentDefinition` are defined in Task 1 and used consistently throughout. `useEditorState` hook interface is defined in Task 4 and used in Tasks 6-7.
