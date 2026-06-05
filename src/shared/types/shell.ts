export interface ShellDefinition {
  /** Shell unique identifier for config persistence and routing */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in shell selector */
  description: string;
  /** Icon (emoji or SVG path) */
  icon: string;
  /** React.lazy factory — Vite auto code-splits */
  loader: () => Promise<{ default: React.ComponentType }>;
  /** Routes this shell supports (TV may omit some) */
  supportedRoutes: string[];
  /** Theme variants this shell supports */
  supportedThemes: string[];
}
