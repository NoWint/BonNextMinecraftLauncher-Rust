import type { ComponentType } from 'react';
import type { ComponentNode } from '../utils/schema';
import { EditorFlexRow } from './components/EditorFlexRow';
import { EditorFlexCol } from './components/EditorFlexCol';
import { EditorSidebar } from './components/EditorSidebar';
import { EditorLaunchPanel } from './components/EditorLaunchPanel';
import { EditorInstanceList } from './components/EditorInstanceList';
import { EditorContentArea } from './components/EditorContentArea';
import { EditorDownloadPanel } from './components/EditorDownloadPanel';
import { EditorSettingsNav } from './components/EditorSettingsNav';
import { EditorButton } from './components/EditorButton';
import { EditorCard } from './components/EditorCard';

// Each renderer component receives node + renderChildren (for containers)
export interface RendererComponentProps {
  node: ComponentNode;
  renderChildren: (children: ComponentNode[]) => React.ReactNode;
}

export const COMPONENT_MAP: Record<string, ComponentType<RendererComponentProps>> = {
  FlexRow: EditorFlexRow,
  FlexCol: EditorFlexCol,
  Sidebar: EditorSidebar as ComponentType<RendererComponentProps>,
  LaunchPanel: EditorLaunchPanel as ComponentType<RendererComponentProps>,
  InstanceList: EditorInstanceList as ComponentType<RendererComponentProps>,
  ContentArea: EditorContentArea as ComponentType<RendererComponentProps>,
  DownloadPanel: EditorDownloadPanel as ComponentType<RendererComponentProps>,
  SettingsNav: EditorSettingsNav as ComponentType<RendererComponentProps>,
  Button: EditorButton as ComponentType<RendererComponentProps>,
  Card: EditorCard,
  TabView: EditorFlexCol, // fallback: render as column
  ScrollArea: EditorFlexCol, // fallback: render as column
  Badge: EditorButton as ComponentType<RendererComponentProps>, // fallback: render as button
};
