import type { Plugin } from './types';

export class DependencyResolver {
  resolve(plugins: Plugin[]): string[] {
    const pluginMap = new Map(plugins.map((p) => [p.id, p]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`Circular dependency detected involving plugin "${id}"`);
      }

      const plugin = pluginMap.get(id);
      if (!plugin) {
        throw new Error(`Missing dependency: "${id}" is not registered`);
      }

      visiting.add(id);

      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          visit(dep.id);
        }
      }

      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const plugin of plugins) {
      visit(plugin.id);
    }

    return order;
  }
}
