import { convertFileSrc } from '@tauri-apps/api/core';
import type { CustomShellMeta } from '../types/custom-shell';
import type { ShellDefinition } from '../types/shell';

/**
 * Load a custom shell's JS entry via Tauri asset protocol + dynamic import().
 * Returns the module's default export (a React component).
 */
async function loadCustomShellModule(shellId: string): Promise<{ default: React.ComponentType }> {
  const entryPath = await import('../api').then((m) => m.api.getCustomShellEntry(shellId));
  const entryUrl = convertFileSrc(entryPath);
  const module = await import(/* @vite-ignore */ entryUrl);
  return { default: module.default };
}

/**
 * Inject a custom shell's CSS file into the document head.
 * Removes any previously injected CSS for the same shell.
 */
export function injectShellCss(shellId: string, cssPath: string): void {
  ejectShellCss(shellId);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = convertFileSrc(cssPath);
  link.setAttribute('data-shell-id', shellId);
  document.head.appendChild(link);
}

/**
 * Remove a custom shell's injected CSS from the document head.
 */
export function ejectShellCss(shellId: string): void {
  const existing = document.querySelector(`link[data-shell-id="${shellId}"]`);
  if (existing) {
    existing.remove();
  }
}

/**
 * Convert a CustomShellMeta (from Rust backend) into a ShellDefinition
 * that can be registered in the shell-registry.
 */
export function customShellToDefinition(meta: CustomShellMeta): ShellDefinition {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description || `Custom shell by ${meta.author || 'unknown'}`,
    icon: meta.icon || '📦',
    loader: () => loadCustomShellModule(meta.id),
    supportedRoutes: meta.supported_routes,
    supportedThemes: meta.supported_themes,
    isCustom: true,
  };
}

/**
 * Load and inject CSS for a custom shell if it has one.
 * Returns the CSS path if injected, null otherwise.
 */
export async function loadShellCss(shellId: string): Promise<string | null> {
  const cssPath = await import('../api').then((m) => m.api.getCustomShellCss(shellId));
  if (cssPath) {
    injectShellCss(shellId, cssPath);
  }
  return cssPath;
}
