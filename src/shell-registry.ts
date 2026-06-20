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

export function registerCustomShell(shell: ShellDefinition): void {
  if (registry.has(shell.id) && !registry.get(shell.id)?.isCustom) {
    console.warn(`Cannot register custom shell "${shell.id}": conflicts with built-in shell.`);
    return;
  }
  registry.set(shell.id, shell);
  components.set(shell.id, React.lazy(shell.loader));
}

export function unregisterShell(id: string): void {
  registry.delete(id);
  components.delete(id);
}

export function clearCustomShells(): void {
  for (const [id, def] of registry.entries()) {
    if (def.isCustom) {
      registry.delete(id);
      components.delete(id);
    }
  }
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

// Phase 4: 多 Shell 架构已移除 — ZZZ Shell 是唯一内置 Shell。
// Swift Shell / Editor Shell 已作为插件存在于 plugins/builtins/ 中，
// 不再作为内置 Shell 注册。Fluent / TV Shell 已弃用。
import { zzzShell } from './shells/zzz';

registerShell(zzzShell);
