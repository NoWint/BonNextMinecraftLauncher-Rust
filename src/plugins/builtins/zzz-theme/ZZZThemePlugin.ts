import type { Plugin, PluginContextType } from '@/plugins/core';
import { ThemeService } from './ThemeService';
import { zzzDarkContribution, zzzLightContribution, zzzOledContribution } from './contributions';

export class ZZZThemePlugin implements Plugin {
  id = 'com.bonnext.zzz-theme';
  name = 'ZZZ Theme';
  version = '1.0.0';
  description = 'Default ZZZ Neo-Tokyo cyberpunk theme (dark, light, OLED)';

  private themeService: ThemeService | null = null;

  async activate(context: PluginContextType): Promise<void> {
    this.themeService = new ThemeService();

    context.provideService('bonnext:theme', this.themeService);

    this.themeService.registerTheme(zzzDarkContribution, this.id);
    this.themeService.registerTheme(zzzLightContribution, this.id);
    this.themeService.registerTheme(zzzOledContribution, this.id);

    context.contributeExtension('bonnext:theme', zzzDarkContribution);
    context.contributeExtension('bonnext:theme', zzzLightContribution);
    context.contributeExtension('bonnext:theme', zzzOledContribution);

    let initialTheme = 'zzz-dark';
    try {
      const stored = localStorage.getItem('bonnext:theme');
      if (stored) {
        const migrated = stored === 'dark' || stored === 'light' || stored === 'oled' ? `zzz-${stored}` : stored;
        const available = this.themeService.getAvailableThemes();
        if (available.some((t) => t.id === migrated)) {
          initialTheme = migrated;
        }
      }
    } catch {
      /* empty */
    }

    await this.themeService.switchTheme(initialTheme, { animate: false });
  }

  async deactivate(): Promise<void> {
    this.themeService = null;
  }

  getThemeService(): ThemeService | null {
    return this.themeService;
  }
}
