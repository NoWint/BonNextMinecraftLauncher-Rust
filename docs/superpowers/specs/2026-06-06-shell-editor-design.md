# Shell Editor — Design Spec

**Date**: 2026-06-06
**Status**: Approved
**Author**: Brainstorming session

## Overview

A new built-in Shell (`id: 'editor'`) that serves as a visual drag-and-drop shell editor. Users can assemble custom launcher UIs from BonNext's component library, configure properties, preview in real-time, and save as JSON configuration. The saved shell is compatible with the custom shell import feature (manifest.json + shell.json).

## 1. Architecture

### 1.1 Positioning

A built-in Shell accessible via ShellSwitcher as "Shell Editor". When activated, the user enters a three-panel editor environment. The editor produces JSON configuration files that are rendered by a built-in ShellRenderer.

### 1.2 Layout

Three-panel layout with SwiftUI design language:

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: [Page tabs] [Theme] [Undo/Redo] [Save/Export] │
├──────────┬──────────────────────────┬───────────────────┤
│          │                          │                   │
│ Component│       Canvas             │  Property Panel   │
│  Palette │  (drag & drop + preview) │  (edit selected)  │
│          │                          │                   │
│  200px   │       flex: 1            │     220px         │
│          │                          │                   │
├──────────┴──────────────────────────┴───────────────────┤
│  Status Bar: [Shell name] [Component count] [Saved at]  │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Design Language

SwiftUI Shell aesthetic:
- **Light mode**: `#fafafa` background, `#f0f0f0` sidebar, SF Pro font stack
- **Dark mode**: `#1c1c1e` background, `#2c2c2e` sidebar
- **Accent**: `#007AFF` (Apple Blue)
- **Glass effect**: `backdrop-filter: blur(20px)` + semi-transparent backgrounds
- **Typography**: SF Pro Display for headings, SF Pro Text for body

### 1.4 Data Flow

```
User drags component → Canvas adds node → Component tree (JSON) updated
User edits property → PropertyPanel updates → Node props change → Canvas re-renders
User saves → JSON config written to {data_dir}/shells/{id}/shell.json + manifest.json
User exports → Shell directory packaged as .zip
User imports → Existing shell.json opened in editor for editing
```

## 2. Component Library & JSON Schema

### 2.1 Layout Containers

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `FlexRow` | Horizontal flex layout | gap, align, justify |
| `FlexCol` | Vertical flex layout | gap, align, justify |
| `TabView` | Tab container | tabs[], activeTab |
| `ScrollArea` | Scrollable region | direction, maxHeight |

### 2.2 Feature Components

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Sidebar` | Side navigation bar | width, items[], collapsed |
| `LaunchPanel` | Game launch panel | showInstanceSelect, showQuickLaunch |
| `InstanceList` | Instance list | viewMode (grid/list), showFilters |
| `ContentArea` | Main content area (route renderer) | defaultRoute |
| `DownloadPanel` | Download manager panel | position (floating/sidebar) |
| `SettingsNav` | Settings page navigation | sections[] |
| `NewsWidget` | News widget | maxItems, layout |
| `SearchPalette` | Search palette | placeholder, hotkeys |

### 2.3 UI Base Components

| Component | Description | Key Props |
|-----------|-------------|-----------|
| `Button` | Button | label, variant, onClick |
| `Card` | Card container | title, padding, shadow |
| `Badge` | Badge | text, color |
| `Modal` | Modal dialog | title, trigger |
| `Tooltip` | Tooltip | text, position |

### 2.4 JSON Configuration Schema

```json
{
  "id": "my-shell",
  "name": "My Shell",
  "version": "1.0.0",
  "theme": {
    "mode": "dark",
    "variables": {
      "--bg-primary": "#0d0d0d",
      "--accent": "#ffe600"
    }
  },
  "pages": {
    "/home": {
      "layout": {
        "type": "FlexRow",
        "props": { "gap": "0" },
        "children": [
          {
            "type": "Sidebar",
            "props": { "width": "60px", "items": ["home", "instances", "settings"] }
          },
          {
            "type": "FlexCol",
            "props": { "gap": "8px" },
            "children": [
              { "type": "LaunchPanel", "props": {} },
              { "type": "ContentArea", "props": { "defaultRoute": "/home" } }
            ]
          }
        ]
      }
    },
    "/instances": { "layout": {} },
    "/settings": { "layout": {} }
  }
}
```

Key design decisions:
- Each route maps to an independent page layout
- Component tree is recursive (type + props + children)
- Theme variables embedded inline, injected as CSS at runtime
- Saved as `shell.json`, paired with `manifest.json` to form a custom shell package

## 3. Shell Renderer

### 3.1 How It Works

The editor-generated JSON is rendered by a built-in `ShellRenderer` that serves as the `shell.js` entry for custom shells:

```
User saves edit → generates shell.json
                        ↓
Custom shell's shell.js = ShellRenderer (built-in)
                        ↓
ShellRenderer reads shell.json → recursively renders component tree
```

Renderer logic:
1. Read `shell.json` from the same directory
2. Find the layout for the current route
3. Recursively traverse the component tree, mapping `type` to React components
4. Pass `props` and render `children`
5. Inject theme variables as CSS custom properties

This means **editor-generated shells don't need JS compilation** — they reuse the built-in ShellRenderer, and the JSON configuration IS the "code".

### 3.2 Component Map

The renderer maintains a map from string type names to actual React components:

```typescript
const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  FlexRow: FlexRowComponent,
  FlexCol: FlexColComponent,
  Sidebar: SidebarComponent,
  LaunchPanel: LaunchPanelComponent,
  InstanceList: InstanceListComponent,
  ContentArea: ContentAreaComponent,
  // ... etc
};
```

## 4. Editor Interactions

### 4.1 Drag & Drop

- Drag components from the left palette onto the canvas → insert node at target position
- Drag within canvas to reorder components and change nesting
- Implemented with `@dnd-kit/core` (lightweight, React-native)

### 4.2 Selection & Property Editing

- Click a component on canvas → right panel shows editable properties for that component
- Property panel dynamically generates form fields based on component type (string→input, color→picker, boolean→toggle)
- Property changes → real-time canvas preview update

### 4.3 Undo / Redo

- `useReducer` + history stack
- Each operation pushes a snapshot; undo pops back

### 4.4 Save / Export / Import

- **Save**: Write component tree JSON to `{data_dir}/shells/{id}/shell.json` + `manifest.json`
- **Export**: Package shell directory as `.zip`
- **Import**: Read existing `shell.json`, open in editor for re-editing

## 5. File Structure

```
src/shells/editor/
├── index.ts                          # ShellDefinition registration
├── AppShell.tsx                      # Editor main entry
├── components/
│   ├── ComponentPalette.tsx          # Left panel: component library
│   ├── ComponentPalette.module.css
│   ├── Canvas.tsx                    # Center: canvas
│   ├── Canvas.module.css
│   ├── PropertyPanel.tsx             # Right panel: property editor
│   ├── PropertyPanel.module.css
│   ├── Toolbar.tsx                   # Top toolbar
│   ├── Toolbar.module.css
│   ├── StatusBar.tsx                 # Bottom status bar
│   ├── StatusBar.module.css
│   ├── DragItem.tsx                  # Draggable component item
│   ├── CanvasNode.tsx                # Component node on canvas
│   └── PropertyField.tsx             # Property field (dynamic form)
├── hooks/
│   ├── useEditorState.ts             # Editor state (component tree + history)
│   └── useShellRenderer.ts           # Renderer mapping (type → React component)
├── utils/
│   ├── component-registry.ts         # Component metadata (types, prop schemas)
│   ├── shell-io.ts                   # Save/load/export/import shell.json
│   └── schema.ts                     # JSON Schema type definitions
├── styles/
│   ├── tokens.css                    # SwiftUI-style design tokens
│   ├── themes.css                    # dark/light themes
│   └── global.css                    # Global styles
└── renderer/                         # Shell renderer (for generated custom shells)
    ├── ShellRenderer.tsx             # JSON → React renderer
    └── component-map.ts              # type → React component mapping
```

## 6. Shell Registration

Registered as the 5th built-in shell in `shell-registry.ts`:

```typescript
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

The Editor Shell only supports the `/editor` route — it is a standalone editing environment.

## 7. Integration with Custom Shell Import

- Editor-saved shell packages are fully compatible with the existing import feature (manifest.json + shell.js + shell.css)
- `shell.js` is actually the built-in ShellRenderer, which reads `shell.json` from the same directory
- Users can "import" existing shells into the editor for re-editing
- The `set_active_shell` command (already modified to accept any ID) allows switching to editor-created shells

## 8. Future Considerations (Out of Scope for v1)

- **Code view**: Toggle between visual editor and JSON code editor
- **Custom component upload**: Allow users to register their own React components
- **Template marketplace**: Share and download shell templates
- **Responsive preview**: Preview shell at different window sizes
- **Animation editor**: Visual animation timeline for transitions
