import type { Plugin, PluginManifest } from './types';

interface TauriFsApi {
  readDir(path: string): Promise<Array<{ path: string; children?: unknown }>>;
  readTextFile(path: string): Promise<string>;
}

export class PluginLoader {
  private builtinPlugins: Plugin[] = [];

  registerBuiltin(plugin: Plugin): void {
    this.builtinPlugins.push(plugin);
  }

  getBuiltinPlugins(): Plugin[] {
    return [...this.builtinPlugins];
  }

  async loadExternalFromDir(_dirPath: string): Promise<Plugin[]> {
    const externalPlugins: Plugin[] = [];

    try {
      const fsModule = ['@tauri-apps', 'plugin-fs'].join('/');
      const fs: TauriFsApi = await import(/* @vite-ignore */ fsModule);
      const entries = await fs.readDir(_dirPath);

      for (const entry of entries) {
        if (entry.children) {
          try {
            const manifest = await this.loadManifest(entry.path, fs);
            if (manifest) {
              const plugin = await this.loadPluginFromManifest(manifest, entry.path);
              if (plugin) {
                externalPlugins.push(plugin);
              }
            }
          } catch (e) {
            console.warn(`Failed to load plugin from ${entry.path}:`, e);
          }
        }
      }
    } catch {
      console.warn('Plugin directory not accessible, skipping external plugins');
    }

    return externalPlugins;
  }

  private async loadManifest(pluginDir: string, fs?: TauriFsApi): Promise<PluginManifest | null> {
    try {
      if (!fs) {
        const fsModule = ['@tauri-apps', 'plugin-fs'].join('/');
        fs = await import(/* @vite-ignore */ fsModule);
      }
      const content = await fs!.readTextFile(`${pluginDir}/manifest.json`);
      return JSON.parse(content) as PluginManifest;
    } catch {
      return null;
    }
  }

  private async loadPluginFromManifest(manifest: PluginManifest, pluginDir: string): Promise<Plugin | null> {
    try {
      const entryPath = `${pluginDir}/${manifest.entry}`;
      const module = await import(/* @vite-ignore */ entryPath);
      const plugin: Plugin = module.default || module;

      if (!plugin.id || !plugin.activate || !plugin.deactivate) {
        console.warn(`Plugin from ${pluginDir} does not implement the Plugin interface`);
        return null;
      }

      return plugin;
    } catch (e) {
      console.warn(`Failed to load plugin entry from ${pluginDir}:`, e);
      return null;
    }
  }

  validatePlugin(plugin: Plugin): boolean {
    return !!(
      plugin.id &&
      typeof plugin.id === 'string' &&
      plugin.name &&
      typeof plugin.name === 'string' &&
      plugin.version &&
      typeof plugin.version === 'string' &&
      typeof plugin.activate === 'function' &&
      typeof plugin.deactivate === 'function'
    );
  }
}
