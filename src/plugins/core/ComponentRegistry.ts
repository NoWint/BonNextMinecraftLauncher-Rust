// src/plugins/core/ComponentRegistry.ts
import type { ComponentType } from 'react';

type LazyComponent = () => Promise<{ default: ComponentType<unknown> }>;

/**
 * 组件字符串名 → 懒加载函数的映射表。
 * 内置组件在此静态注册，第三方组件由 PluginLoader 动态注册。
 */
export class ComponentRegistry {
  private components = new Map<string, LazyComponent>();

  register(name: string, loader: LazyComponent): void {
    if (this.components.has(name)) {
      console.warn(`[ComponentRegistry] Component "${name}" already registered, overwriting`);
    }
    this.components.set(name, loader);
  }

  resolve(name: string): LazyComponent | undefined {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  /** 注册内置组件（在应用启动时调用一次） */
  registerBuiltins(entries: Record<string, LazyComponent>): void {
    for (const [name, loader] of Object.entries(entries)) {
      this.register(name, loader);
    }
  }

  /** 清空（测试用） */
  clear(): void {
    this.components.clear();
  }
}

export const componentRegistry = new ComponentRegistry();
