import { ExtensionPointBase } from './ExtensionPoint';

export interface ThemeContribution {
  id: string;
  name: string;
  cssVariables: Record<string, string>;
  componentOverrides?: Record<string, { cssModulePath: string }>;
  fonts?: Array<{
    family: string;
    src: string;
    weight?: number;
    style?: string;
  }>;
  mode: 'light' | 'dark' | 'auto';
}

export class ThemeExtensionPoint extends ExtensionPointBase<ThemeContribution> {
  readonly id = 'bonnext:theme';
  readonly name = 'Theme Extension Point';

  getContributionById(id: string): ThemeContribution | undefined {
    return this.getContributions().find((c) => c.id === id);
  }

  getAvailableThemeIds(): string[] {
    return this.getContributions().map((c) => c.id);
  }

  getContributionsByMode(mode: 'light' | 'dark'): ThemeContribution[] {
    return this.getContributions().filter((c) => c.mode === mode || c.mode === 'auto');
  }
}
