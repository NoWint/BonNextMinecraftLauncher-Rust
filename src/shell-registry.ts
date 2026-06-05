import React from 'react';
import type { ShellDefinition } from './shared/types/shell';

type LazyShellComponent = React.LazyExoticComponent<React.ComponentType>;

const registry = new Map<string, ShellDefinition>();
const components = new Map<string, LazyShellComponent>();

export function registerShell(shell: ShellDefinition): void {
  if (registry.has(shell.id)) {
    console.warn(`Shell "${shell.id}" already registered, skipping.`);
    return;
  }
  registry.set(shell.id, shell);
  components.set(shell.id, React.lazy(shell.loader));
}

export function getShellComponent(id: string): LazyShellComponent {
  const component = components.get(id);
  if (!component) {
    throw new Error(
      `Shell "${id}" not registered. Available: ${Array.from(registry.keys()).join(', ')}`
    );
  }
  return component;
}

export function getAllShells(): ShellDefinition[] {
  return Array.from(registry.values());
}

export function isShellRegistered(id: string): boolean {
  return registry.has(id);
}

// Register all shells — each index.ts only exports ShellDefinition (tiny, < 1KB)
import { zzzShell } from './shells/zzz';
import { swiftuiShell } from './shells/swiftui';
import { fluentShell } from './shells/fluent';
import { tvShell } from './shells/tv';

registerShell(zzzShell);
registerShell(swiftuiShell);
registerShell(fluentShell);
registerShell(tvShell);
