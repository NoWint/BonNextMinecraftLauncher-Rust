/// <reference types="vite/client" />

interface Window {
  __bonnext_logs?: {
    getEntries: () => import('./utils/logger').LogEntry[];
    clear: () => void;
  };
}

declare module 'liquid-glass-component-kit' {
  export interface LiquidGlassOptions {
    intensity?: 'subtle' | 'normal' | 'strong';
  }
  export interface LiquidGlassEffect {
    remove: () => void;
  }
  export function applyLiquidGlass(element: HTMLElement, options?: LiquidGlassOptions): LiquidGlassEffect;
  export function applyToMultiple(elements: NodeListOf<Element> | Element[], options?: LiquidGlassOptions): LiquidGlassEffect[];
  export function cleanupAll(): void;
}

declare module 'tauri-plugin-liquid-glass-api' {
  export enum GlassMaterialVariant {
    Regular = 0,
    Clear = 1,
    Dock = 2,
    AppIcons = 3,
    Widgets = 4,
    Text = 5,
    Avplayer = 6,
    Facetime = 7,
    ControlCenter = 8,
    NotificationCenter = 9,
    Monogram = 10,
    Bubbles = 11,
    Identity = 12,
    FocusBorder = 13,
    FocusPlatter = 14,
    Keyboard = 15,
    Sidebar = 16,
    AbuttedSidebar = 17,
    Inspector = 18,
    Control = 19,
    Loupe = 20,
    Slider = 21,
    Camera = 22,
    CartouchePopover = 23,
  }
  export interface LiquidGlassConfig {
    enabled?: boolean;
    cornerRadius?: number;
    tintColor?: string;
    variant?: GlassMaterialVariant;
  }
  export function isGlassSupported(): Promise<boolean>;
  export function setLiquidGlassEffect(config: LiquidGlassConfig): Promise<void>;
}
