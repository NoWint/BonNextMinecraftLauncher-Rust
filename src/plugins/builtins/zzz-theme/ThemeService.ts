import type { ThemeContribution } from '@/plugins/extensions';

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

const THEME_CLASSES = ['theme-dark', 'theme-light', 'theme-oled', 'theme-md3-dark', 'theme-md3-light'];

function getThemeClass(themeId: string): string {
  if (themeId.startsWith('zzz-')) {
    const modeMap: Record<string, string> = { dark: 'theme-dark', light: 'theme-light', oled: 'theme-oled' };
    const legacy = themeId.replace('zzz-', '');
    return modeMap[legacy] || 'theme-dark';
  }
  if (themeId.startsWith('md3-')) {
    return `theme-${themeId}`;
  }
  return `theme-${themeId}`;
}

export class ThemeService {
  private themes = new Map<string, RegisteredTheme>();
  private currentThemeId: string | null = null;
  private currentAppliedVars: Set<string> = new Set();
  private listeners: ThemeChangeCallback[] = [];
  private rules: ThemeRule[] = [];

  registerTheme(contribution: ThemeContribution, pluginId: string): void {
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

  async switchTheme(themeId: string, options?: { animate?: boolean; seedColor?: string }): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme "${themeId}" not found`);
    }

    this.currentThemeId = themeId;

    if (typeof document !== 'undefined') {
      this.applyThemeToDOM(theme, options?.animate ?? true);
    }

    for (const listener of this.listeners) {
      listener(theme.info);
    }
  }

  private applyThemeToDOM(theme: RegisteredTheme, animate: boolean): void {
    const root = document.documentElement;

    if (animate) {
      root.classList.add('theme-transition');
    }

    for (const key of this.currentAppliedVars) {
      root.style.removeProperty(key);
    }
    this.currentAppliedVars.clear();

    for (const THEME_CLASS of THEME_CLASSES) {
      root.classList.remove(THEME_CLASS);
    }

    for (const [key, value] of Object.entries(theme.cssVariables)) {
      root.style.setProperty(key, value);
      this.currentAppliedVars.add(key);
    }

    root.classList.add(getThemeClass(theme.info.id));

    if (animate) {
      setTimeout(() => {
        root.classList.remove('theme-transition');
      }, 350);
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
