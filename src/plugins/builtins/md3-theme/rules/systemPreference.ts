import type { ThemeRule } from '@/plugins/builtins/zzz-theme/ThemeService';

export function createSystemPreferenceRule(targetDark: string, _targetLight: string): ThemeRule {
  return {
    id: 'md3-system-preference',
    name: 'System Color Scheme',
    priority: 10,
    condition: { type: 'system', preference: 'dark' },
    targetTheme: targetDark,
    enabled: false,
  };
}

export function createSystemLightPreferenceRule(targetLight: string): ThemeRule {
  return {
    id: 'md3-system-light-preference',
    name: 'System Light Preference',
    priority: 9,
    condition: { type: 'system', preference: 'light' },
    targetTheme: targetLight,
    enabled: false,
  };
}
