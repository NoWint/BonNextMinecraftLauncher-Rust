import type { ThemeContribution } from '@/plugins/core';

export interface ThemeInfo {
  id: string;
  name: string;
  mode: 'light' | 'dark' | 'auto';
  pluginId: string;
}

export interface ThemeRule {
  id: string;
  name: string;
  priority: number;
  condition: RuleCondition;
  targetTheme: string;
  enabled: boolean;
}

export type RuleCondition =
  | { type: 'time'; from: string; to: string }
  | { type: 'system'; preference: 'dark' | 'light' }
  | { type: 'instance'; instanceId: string }
  | { type: 'custom'; check: () => boolean };

export type Unsubscribe = () => void;
export type ThemeChangeCallback = (theme: ThemeInfo) => void;

interface RegisteredTheme {
  info: ThemeInfo;
  cssVariables: Record<string, string>;
  fonts?: Array<{ family: string; src: string; weight?: number; style?: string }>;
}

/**
 * ThemeService is a pure theme registry / state service.
 *
 * It no longer manipulates the DOM. Theme CSS variables and theme classes are
 * applied exclusively by the core themeStore, which consumes plugin theme
 * contributions via the usePluginThemes hook. This removes the previous
 * conflict where ThemeService.switchTheme() and themeStore both wrote to the
 * same documentElement attributes (CSS variables + theme classes) and
 * overwrote each other.
 *
 * @deprecated Theme application is handled by the core themeStore. This class
 * is retained as a metadata registry + rules engine for plugin/service-registry
 * compatibility. switchTheme() only updates internal state and notifies
 * listeners; it does not touch the DOM.
 */
export class ThemeService {
  private themes = new Map<string, RegisteredTheme>();
  private currentThemeId: string | null = null;
  private listeners: ThemeChangeCallback[] = [];
  private rules: ThemeRule[] = [];

  registerTheme(contribution: Omit<ThemeContribution, 'pluginId'>, pluginId: string): void {
    this.themes.set(contribution.id, {
      info: {
        id: contribution.id,
        name: contribution.name,
        mode: contribution.mode,
        pluginId,
      },
      cssVariables: contribution.cssVariables,
      fonts: contribution.fonts,
    });

    if (this.currentThemeId === null) {
      this.currentThemeId = contribution.id;
    }
  }

  unregisterTheme(id: string): void {
    this.themes.delete(id);
  }

  getCurrentTheme(): ThemeInfo {
    if (!this.currentThemeId) {
      throw new Error('No theme is currently active');
    }
    const theme = this.themes.get(this.currentThemeId);
    if (!theme) {
      throw new Error(`Current theme "${this.currentThemeId}" not found`);
    }
    return theme.info;
  }

  getAvailableThemes(): ThemeInfo[] {
    return Array.from(this.themes.values()).map((t) => t.info);
  }

  getThemeVariables(id: string): Record<string, string> | undefined {
    return this.themes.get(id)?.cssVariables;
  }

  /**
   * Update the active theme id and notify listeners.
   *
   * DOM application is intentionally NOT performed here; the core themeStore
   * owns all DOM writes. The options argument is accepted for backwards
   * compatibility but has no effect.
   */
  async switchTheme(themeId: string, _options?: { animate?: boolean; seedColor?: string }): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme "${themeId}" not found`);
    }

    this.currentThemeId = themeId;

    for (const listener of this.listeners) {
      listener(theme.info);
    }
  }

  onThemeChange(callback: ThemeChangeCallback): Unsubscribe {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  addRule(rule: ThemeRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  getActiveRules(): ThemeRule[] {
    return this.rules.filter((r) => r.enabled);
  }

  evaluateRules(): string | null {
    for (const rule of this.getActiveRules()) {
      if (this.evaluateCondition(rule.condition)) {
        return rule.targetTheme;
      }
    }
    return null;
  }

  private evaluateCondition(condition: RuleCondition): boolean {
    switch (condition.type) {
      case 'system': {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(`(prefers-color-scheme: ${condition.preference})`).matches;
      }
      case 'time': {
        const now = new Date();
        const hours = now.getHours();
        const [fromH] = condition.from.split(':').map(Number);
        const [toH] = condition.to.split(':').map(Number);
        return hours >= fromH && hours < toH;
      }
      case 'custom':
        return condition.check();
      default:
        return false;
    }
  }
}
