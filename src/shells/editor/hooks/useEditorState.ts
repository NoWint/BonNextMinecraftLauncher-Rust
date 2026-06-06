import { useReducer, useCallback } from 'react';
import type { ShellConfig, ComponentNode } from '../utils/schema';
import { createDefaultConfig } from '../utils/shell-io';
import { createDefaultNode } from '../utils/component-registry';

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
  const treeWithoutNode = removeNodeFromTree(root, nodeId);
  const nodeData = findNodeById(root, nodeId);
  if (!nodeData) return root;
  return updateNodeInTree(treeWithoutNode, newParentId, (parent) => {
    const newChildren = [...parent.children];
    newChildren.splice(index, 0, nodeData);
    return { ...parent, children: newChildren };
  });
}

function pushHistory(state: EditorState, newConfig: ShellConfig): EditorState {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(newConfig)));
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

export type EditorStateAPI = ReturnType<typeof useEditorState>;
