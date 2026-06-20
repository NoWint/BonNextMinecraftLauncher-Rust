import { definePlugin } from '@/plugins/core';
import type { PluginContext } from '@/plugins/core';
import { ThemeService } from './ThemeService';
import { zzzDarkContribution, zzzLightContribution, zzzOledContribution } from './contributions';

let themeService: ThemeService | null = null;

export const zzzThemePlugin = definePlugin({
  id: 'com.bonnext.zzz-theme',
  name: 'ZZZ Theme',
  version: '1.0.0',
  description: 'Default ZZZ Neo-Tokyo cyberpunk theme (dark, light, OLED)',

  activate(ctx: PluginContext) {
    themeService = new ThemeService();

    // Register themes via the new plugin context
    ctx.registerTheme(zzzDarkContribution);
    ctx.registerTheme(zzzLightContribution);
    ctx.registerTheme(zzzOledContribution);

    // Also register with ThemeService for runtime switching
    themeService.registerTheme(zzzDarkContribution, ctx.pluginId);
    themeService.registerTheme(zzzLightContribution, ctx.pluginId);
    themeService.registerTheme(zzzOledContribution, ctx.pluginId);

    // Apply initial theme
    let initialTheme = 'zzz-dark';
    try {
      const stored = localStorage.getItem('bonnext:theme');
      if (stored) {
        const migrated = stored === 'dark' || stored === 'light' || stored === 'oled' ? `zzz-${stored}` : stored;
        const available = themeService.getAvailableThemes();
        if (available.some((t) => t.id === migrated)) {
          initialTheme = migrated;
        }
      }
    } catch {
      /* empty */
    }

    themeService.switchTheme(initialTheme, { animate: false });
  },

  deactivate() {
    themeService = null;
  },
});

export function getThemeService(): ThemeService | null {
  return themeService;
}
