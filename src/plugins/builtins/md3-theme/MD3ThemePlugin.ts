import type { Plugin, PluginContextType, PluginDependency } from '@/plugins/core';
import { ThemeService } from '@/plugins/builtins/zzz-theme/ThemeService';
import { generateMD3Contributions, MD3_SEED_PRESETS } from './contributions';
import { createSystemPreferenceRule, createSystemLightPreferenceRule } from './rules/systemPreference';
import type { LayoutContribution, MD3TypographyScale } from '@/plugins/extensions';
import { MD3Button } from './wrappers/MD3Button';
import { MD3FAB } from './wrappers/MD3FAB';
import { MD3Card } from './wrappers/MD3Card';
import { MD3Dialog } from './wrappers/MD3Dialog';
import { MD3TextField } from './wrappers/MD3TextField';
import { MD3Select } from './wrappers/MD3Select';
import { MD3Switch } from './wrappers/MD3Switch';
import { MD3Checkbox } from './wrappers/MD3Checkbox';
import { MD3Tabs } from './wrappers/MD3Tabs';
import { MD3Chip } from './wrappers/MD3Chip';
import { MD3Badge } from './wrappers/MD3Badge';
import { MD3List } from './wrappers/MD3List';
import { MD3Icon } from './wrappers/MD3Icon';
import { MD3Divider } from './wrappers/MD3Divider';
import { MD3NavigationRail } from './layout/MD3NavigationRail';
import { MD3TopAppBar } from './layout/MD3TopAppBar';

import './tokens/md3-shared.css';
import './tokens/md3-dark.css';
import './tokens/md3-light.css';
import './tokens/md3-typography.css';
import './tokens/md3-sys-colors.css';

const MD3_TYPOGRAPHY: MD3TypographyScale = {
  displayLarge: '500 3.5625rem/1.12 Roboto, sans-serif',
  displayMedium: '500 2.8125rem/1.16 Roboto, sans-serif',
  displaySmall: '500 2.25rem/1.22 Roboto, sans-serif',
  headlineLarge: '400 2rem/1.25 Roboto, sans-serif',
  headlineMedium: '400 1.75rem/1.29 Roboto, sans-serif',
  headlineSmall: '400 1.5rem/1.33 Roboto, sans-serif',
  titleLarge: '500 1.375rem/1.27 Roboto, sans-serif',
  titleMedium: '500 1rem/1.5 Roboto, sans-serif',
  titleSmall: '500 0.875rem/1.43 Roboto, sans-serif',
  bodyLarge: '400 1rem/1.5 Roboto, sans-serif',
  bodyMedium: '400 0.875rem/1.43 Roboto, sans-serif',
  bodySmall: '400 0.75rem/1.33 Roboto, sans-serif',
  labelLarge: '500 0.875rem/1.43 Roboto, sans-serif',
  labelMedium: '500 0.75rem/1.33 Roboto, sans-serif',
  labelSmall: '500 0.6875rem/1.45 Roboto, sans-serif',
};

export class MD3ThemePlugin implements Plugin {
  id = 'com.bonnext.md3-theme';
  name = 'Material Design 3 Theme';
  version = '1.0.0';
  description = 'Material Design 3 theme with dynamic color and full layout restructuring';
  dependencies: PluginDependency[] = [{ id: 'com.bonnext.zzz-theme', version: '^1.0.0' }];

  private currentSeedColor: string = MD3_SEED_PRESETS[0].color;
  private registeredThemeIds: string[] = [];
  private layoutContribution: LayoutContribution | null = null;
  private fontLink: HTMLLinkElement | null = null;

  async activate(context: PluginContextType): Promise<void> {
    const themeService = context.consumeService('bonnext:theme') as ThemeService | undefined;
    if (!themeService) {
      throw new Error('MD3ThemePlugin: ThemeService not available. ZZZ theme plugin must be activated first.');
    }

    try {
      const saved = localStorage.getItem('bonnext:md3-seed-color');
      if (saved) this.currentSeedColor = saved;
    } catch {
      /* empty */
    }

    this.registerThemes(themeService);

    const darkId = this.registeredThemeIds.find((id) => id.endsWith('-dark'));
    const lightId = this.registeredThemeIds.find((id) => id.endsWith('-light'));
    if (darkId && lightId) {
      themeService.addRule(createSystemPreferenceRule(darkId, lightId));
      themeService.addRule(createSystemLightPreferenceRule(lightId));
    }

    const contributions = generateMD3Contributions(this.currentSeedColor);
    for (const contribution of contributions) {
      context.contributeExtension('bonnext:theme', contribution);
    }

    try {
      // @ts-expect-error @material/web may not be installed
      await import('@material/web/all.js');
    } catch (e) {
      console.warn('[MD3ThemePlugin] Failed to load @material/web:', e);
    }

    this.loadRobotoFont();

    const currentThemeId = themeService.getCurrentTheme()?.id;
    if (currentThemeId && currentThemeId.startsWith('md3-')) {
      this.layoutContribution = this.createLayoutContribution();
      context.contributeExtension('bonnext:layout', this.layoutContribution);
    }

    themeService.onThemeChange((themeInfo) => {
      if (themeInfo.id.startsWith('md3-')) {
        if (!this.layoutContribution) {
          this.layoutContribution = this.createLayoutContribution();
          context.contributeExtensionRuntime('bonnext:layout', this.layoutContribution);
        }
      } else {
        if (this.layoutContribution) {
          context.retractExtension('bonnext:layout', this.layoutContribution);
          this.layoutContribution = null;
        }
      }
    });
  }

  async deactivate(): Promise<void> {
    this.registeredThemeIds = [];
    this.layoutContribution = null;
    if (this.fontLink && this.fontLink.parentNode) {
      this.fontLink.parentNode.removeChild(this.fontLink);
      this.fontLink = null;
    }
  }

  private loadRobotoFont(): void {
    if (document.querySelector('link[data-bonnext-roboto]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
    link.setAttribute('data-bonnext-roboto', 'true');
    document.head.appendChild(link);
    this.fontLink = link;
  }

  private createLayoutContribution(): LayoutContribution {
    return {
      NavigationRail: MD3NavigationRail,
      TopAppBar: MD3TopAppBar,
      FAB: MD3FAB,
      components: {
        Button: MD3Button,
        Card: MD3Card,
        Dialog: MD3Dialog,
        TextField: MD3TextField,
        Select: MD3Select,
        Switch: MD3Switch,
        Checkbox: MD3Checkbox,
        Tabs: MD3Tabs,
        Chip: MD3Chip,
        Badge: MD3Badge,
        List: MD3List,
        Icon: MD3Icon,
        Divider: MD3Divider,
      },
      typography: MD3_TYPOGRAPHY,
      themeTokens: {},
    };
  }

  private registerThemes(themeService: ThemeService): void {
    for (const id of this.registeredThemeIds) {
      themeService.unregisterTheme(id);
    }
    this.registeredThemeIds = [];

    const contributions = generateMD3Contributions(this.currentSeedColor);
    for (const contribution of contributions) {
      themeService.registerTheme(contribution, this.id);
      this.registeredThemeIds.push(contribution.id);
    }
  }

  changeSeedColor(seedColor: string, themeService: ThemeService): void {
    this.currentSeedColor = seedColor;
    try {
      localStorage.setItem('bonnext:md3-seed-color', seedColor);
    } catch {
      /* empty */
    }
    const currentId = themeService.getCurrentTheme()?.id;
    this.registerThemes(themeService);
    if (currentId && this.registeredThemeIds.includes(currentId)) {
      themeService.switchTheme(currentId, { animate: false }).catch(() => {});
    }
  }

  getCurrentSeedColor(): string {
    return this.currentSeedColor;
  }
}
