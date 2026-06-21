import { definePlugin } from '@/plugins/core';
import type { PluginContext } from '@/plugins/core';
import type { ThemeService } from './ThemeService';
import { zzzDarkContribution, zzzLightContribution, zzzOledContribution } from './contributions';

export const zzzThemePlugin = definePlugin({
  id: 'com.bonnext.zzz-theme',
  name: 'ZZZ Theme',
  version: '1.0.0',
  description: 'Default ZZZ Neo-Tokyo cyberpunk theme (dark, light, OLED)',

  activate(ctx: PluginContext) {
    // Themes are registered through the plugin context. The core themeStore
    // consumes these contributions (via usePluginThemes) and is the single
    // source of truth for applying the theme class + CSS variables to the DOM.
    //
    // ThemeService is intentionally NOT instantiated here: its switchTheme()
    // used to write directly to the DOM and raced with themeStore, causing the
    // two systems to overwrite each other's CSS variables and theme classes.
    ctx.registerTheme(zzzDarkContribution);
    ctx.registerTheme(zzzLightContribution);
    ctx.registerTheme(zzzOledContribution);
  },

  deactivate() {
    // Registered theme contributions are revoked by the plugin manager on unload.
  },
});

/**
 * @deprecated Theme management is handled by the core themeStore. This accessor
 * is retained for backwards API compatibility but always returns null.
 */
export function getThemeService(): ThemeService | null {
  return null;
}
