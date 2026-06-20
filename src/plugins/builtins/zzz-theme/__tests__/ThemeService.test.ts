import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeService } from '../ThemeService';
import type { ThemeContribution } from '@/plugins/core';

type ThemeContributionWithoutPluginId = Omit<ThemeContribution, 'pluginId'>;

const darkTheme: ThemeContributionWithoutPluginId = {
  id: 'zzz-dark',
  name: 'ZZZ Dark',
  cssVariables: { '--bg-primary': '#0d0d0d', '--text-primary': '#ffffff' },
  mode: 'dark',
};

const lightTheme: ThemeContributionWithoutPluginId = {
  id: 'zzz-light',
  name: 'ZZZ Light',
  cssVariables: { '--bg-primary': '#fafafa', '--text-primary': '#1a1a1a' },
  mode: 'light',
};

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    service = new ThemeService();
  });

  it('should register themes', () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.registerTheme(lightTheme, 'com.bonnext.zzz-theme');
    expect(service.getAvailableThemes()).toHaveLength(2);
  });

  it('should switch current theme', async () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.registerTheme(lightTheme, 'com.bonnext.zzz-theme');
    await service.switchTheme('zzz-light');
    expect(service.getCurrentTheme().id).toBe('zzz-light');
  });

  it('should throw when switching to unknown theme', async () => {
    await expect(service.switchTheme('unknown')).rejects.toThrow(/not found/);
  });

  it('should notify listeners on theme change', async () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.registerTheme(lightTheme, 'com.bonnext.zzz-theme');
    const changes: string[] = [];
    service.onThemeChange((info) => changes.push(info.id));
    await service.switchTheme('zzz-light');
    expect(changes).toEqual(['zzz-light']);
  });

  it('should unsubscribe listener', async () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    const changes: string[] = [];
    const unsub = service.onThemeChange((info) => changes.push(info.id));
    unsub();
    await service.switchTheme('zzz-dark');
    expect(changes).toHaveLength(0);
  });

  it('should add and remove rules', () => {
    const rule = {
      id: 'system-pref',
      name: 'System Preference',
      priority: 10,
      condition: { type: 'system' as const, preference: 'dark' as const },
      targetTheme: 'zzz-dark',
      enabled: true,
    };
    service.addRule(rule);
    expect(service.getActiveRules()).toHaveLength(1);
    service.removeRule('system-pref');
    expect(service.getActiveRules()).toHaveLength(0);
  });

  it('should unregister themes', () => {
    service.registerTheme(darkTheme, 'com.bonnext.zzz-theme');
    service.unregisterTheme('zzz-dark');
    expect(service.getAvailableThemes()).toHaveLength(0);
  });
});
